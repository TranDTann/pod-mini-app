'use client';
// Bọc phần lõi cho trình duyệt: tải ảnh → ImageData, resample bằng canvas, xuất PNG.

import { MOCKUP, type Fit, type MockupConfig } from './config';
import { buildUvLut, type UvLut } from './warp';
import { composeMockup, fitRect, prepareMockup, warpSmartObject, type PreparedMockup, type RGBA } from './render';

export type Mode = 'straight' | 'photoshop';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return { c, ctx };
}

async function loadBitmap(src: string | Blob): Promise<ImageBitmap> {
  const blob = typeof src === 'string' ? await (await fetch(src)).blob() : src;
  return createImageBitmap(blob);
}

function toRGBA(bmp: ImageBitmap): RGBA {
  const { ctx } = canvas(bmp.width, bmp.height);
  ctx.drawImage(bmp, 0, 0);
  const id = ctx.getImageData(0, 0, bmp.width, bmp.height);
  return { width: id.width, height: id.height, data: id.data };
}

let cache: Promise<{ prep: PreparedMockup }> | null = null;

/** Tải /mockup/base.png + /mockup/effect.png một lần. */
export function loadMockup(baseUrl = '/mockup/base.png', effectUrl = '/mockup/effect.png') {
  cache ??= (async () => {
    const [b, e] = await Promise.all([loadBitmap(baseUrl), loadBitmap(effectUrl)]);
    return { prep: prepareMockup(toRGBA(b), toRGBA(e)) };
  })();
  return cache;
}

/**
 * mode 'straight'  : ảnh nằm thẳng, phủ kín vùng in (khuyên dùng).
 * mode 'photoshop' : giống hệt mở smart object rồi Place ảnh (fit canvas) — ảnh sẽ bị
 *                    nghiêng/méo theo warp có sẵn của PSD.
 */
export async function renderMockup(art: Blob, mode: Mode = 'straight', fit: Fit = 'cover'): Promise<Blob> {
  const { prep } = await loadMockup();
  const out = await composeArt(prep, MOCKUP, await loadBitmap(art), mode, fit);
  const { c, ctx } = canvas(prep.width, prep.height);
  ctx.putImageData(new ImageData(out, prep.width, prep.height), 0, 0);
  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'));
}

const luts = new WeakMap<MockupConfig, UvLut>();

/** Như renderMockup nhưng với mockup bất kỳ (config + base/effect trích từ PSD). Trả về pixel RGBA. */
export async function composeArt(
  prep: PreparedMockup,
  cfg: MockupConfig,
  bmp: ImageBitmap,
  mode: Mode = 'straight',
  fit: Fit = 'cover',
): Promise<Uint8ClampedArray<ArrayBuffer>> {
  const { width: rw, height: rh } = cfg.printArea;
  let layer: RGBA;

  if (mode === 'straight') {
    const { ctx } = canvas(rw, rh);
    const r = fitRect(bmp.width, bmp.height, rw, rh, fit);
    ctx.drawImage(bmp, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
    const id = ctx.getImageData(0, 0, rw, rh);
    layer = { width: rw, height: rh, data: id.data };
  } else {
    // nội dung smart object ở scale 0.5 (1807×1531) — đủ nét và chống răng cưa
    const sw = Math.round(cfg.smartObject.width * 0.5), sh = Math.round(cfg.smartObject.height * 0.5);
    const { ctx } = canvas(sw, sh);
    const r = fitRect(bmp.width, bmp.height, sw, sh, 'contain'); // Photoshop "Place" = fit trong canvas
    ctx.drawImage(bmp, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
    const id = ctx.getImageData(0, 0, sw, sh);
    let lut = luts.get(cfg);
    if (!lut) luts.set(cfg, (lut = buildUvLut(cfg, 96, 2)));
    layer = warpSmartObject({ width: sw, height: sh, data: id.data }, lut, cfg);
  }

  return composeMockup(prep, layer, cfg);
}

export { toRGBA, loadBitmap };
