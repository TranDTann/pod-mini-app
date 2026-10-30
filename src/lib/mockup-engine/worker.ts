/// <reference lib="webworker" />
// Web Worker: dựng mockup ngoài luồng UI.
import { compilePsdData } from './compile';
import { MockupRenderer, type RenderOptions } from './engine';
import type { Placement } from './raster';
import type { MockupSpec, RGBA } from './types';

const renderers = new Map<string, Promise<MockupRenderer>>();
const NO_ART: RGBA = { width: 0, height: 0, data: new Uint8ClampedArray(0) };

async function decode(blob: Blob): Promise<RGBA> {
  const bmp = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0);
  const id = ctx.getImageData(0, 0, bmp.width, bmp.height);
  bmp.close();
  return { width: id.width, height: id.height, data: id.data };
}

function renderer(base: string) {
  let r = renderers.get(base);
  if (!r) {
    r = (async () => {
      const spec: MockupSpec = await (await fetch(`${base}/spec.json`)).json();
      return MockupRenderer.create(spec, async src => decode(await (await fetch(`${base}/${src}`)).blob()));
    })();
    renderers.set(base, r);
  }
  return r;
}

export type WorkerRequest = {
  id: number;
  base: string;                                  // vd "/mockups/tshirt-mockup", hoặc khoá của PSD đã biên dịch
  art?: Blob;                                    // ảnh thiết kế
  slot?: string;                                 // mặc định: slot đầu tiên
  placement?: Placement;
  /** Nhiều slot cùng lúc (thay cho art/slot) */
  arts?: { slot: string; art: Blob; placement?: Placement; artKey?: string }[];
  options?: Omit<RenderOptions, 'slots'>;
  /** Trả về ảnh đã mã hoá ngay trong worker thay vì buffer điểm ảnh. JPEG nhanh hơn nhiều, dùng để hiển thị (nền trắng). */
  encode?: 'png' | 'jpeg';
};

/** Biên dịch một PSD upload ngay trong worker; ảnh layer giữ trong bộ nhớ của worker. */
export type WorkerCompileRequest = { id: number; compile: true; key: string; buffer: ArrayBuffer; source: string; thumbnailSide: number };

async function compileUpload({ key, buffer, source, thumbnailSide }: WorkerCompileRequest) {
  const images = new Map<string, RGBA>();
  const spec = await compilePsdData(buffer, source, {
    async save(src, img) { images.set(src, img); },
  });
  const r = await MockupRenderer.create(spec, async (src) => {
    const img = images.get(src);
    if (!img) throw new Error(`Thiếu ảnh ${src}`);
    return img;
  });
  renderers.set(key, Promise.resolve(r));
  const preview = spec.compositeSrc ? images.get(spec.compositeSrc)! : await r.render({ emptySlot: 'preview' });
  return { spec, thumbnail: await thumbnail(preview, thumbnailSide) };
}

async function thumbnail(img: RGBA, side: number) {
  const full = new OffscreenCanvas(img.width, img.height);
  full.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  const s = Math.min(1, side / Math.max(img.width, img.height));
  const out = new OffscreenCanvas(Math.round(img.width * s), Math.round(img.height * s));
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(full, 0, 0, out.width, out.height);
  const blob = await out.convertToBlob({ type: 'image/png' });
  return new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result as string);
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(blob);
  });
}

self.onmessage = async (e: MessageEvent<WorkerRequest | WorkerCompileRequest | { release: string }>) => {
  if ('release' in e.data) {
    renderers.delete(e.data.release);
    return;
  }
  if ('compile' in e.data) {
    const { id } = e.data;
    try {
      (self as unknown as Worker).postMessage({ id, ...(await compileUpload(e.data)) });
    } catch (err) {
      (self as unknown as Worker).postMessage({ id, error: String(err) });
    }
    return;
  }
  const { id, base, art, slot, placement, arts, options, encode } = e.data;
  try {
    const r = await renderer(base);
    const key = slot ?? r.spec.slots[0]?.key;
    const slots: RenderOptions['slots'] = art && key ? { [key]: { art: await decode(art), placement } } : {};
    for (const a of arts ?? []) {
      // Ảnh đã warp rồi (chỉ đổi màu áo): không giải mã lại
      const cached = a.artKey && r.hasSmartContent(a.slot, a.artKey, options ?? {});
      slots[a.slot] = { art: cached ? NO_ART : await decode(a.art), placement: a.placement, cacheKey: a.artKey };
    }
    const out = await r.render({ ...options, slots });
    if (encode) {
      const pixels = new OffscreenCanvas(out.width, out.height);
      pixels.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(out.data), out.width, out.height), 0, 0);
      let c = pixels;
      if (encode === 'jpeg') {
        c = new OffscreenCanvas(out.width, out.height);
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, out.width, out.height);
        ctx.drawImage(pixels, 0, 0);
      }
      const blob = await c.convertToBlob(encode === 'jpeg' ? { type: 'image/jpeg', quality: 0.92 } : { type: 'image/png' });
      (self as unknown as Worker).postMessage({ id, blob });
      return;
    }
    const buf = (out.data as Uint8ClampedArray).buffer as ArrayBuffer;
    (self as unknown as Worker).postMessage({ id, width: out.width, height: out.height, buffer: buf, warnings: r.spec.warnings }, [buf]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) });
  }
};
