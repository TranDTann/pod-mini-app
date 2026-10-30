/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- ag-psd leaves many PSD fields untyped */
// Biên dịch PSD → spec + ảnh (thuần TS, chạy được trong Web Worker lẫn Node).
// Ảnh được ghi qua CompileIO: Node ghi PNG ra thư mục (compile-node.ts), Worker giữ RGBA trong bộ nhớ.
import { initializeCanvas, readPsd, type Layer, type Psd } from 'ag-psd';
import type { Geometry, MockupSpec, SlotInfo, SmartFilter, SpecNode, VectorMask } from './types';
import { makeAdjustment } from './adjust';

let canvasReady = false;
function ensureCanvas() {
  if (canvasReady) return;
  // chỉ cần ImageData thô — không dùng canvas thật
  initializeCanvas(
    (() => { throw new Error('canvas not available'); }) as never,
    ((w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4), colorSpace: 'srgb' })) as never,
  );
  canvasReady = true;
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' ? v : v && typeof v === 'object' && 'value' in (v as object) ? Number((v as { value: number }).value) : d);

/** Ảnh 16/32-bit → 8-bit (32-bit của Photoshop là tuyến tính → mã hoá gamma sRGB xấp xỉ 2.2). */
function to8(data: ArrayBufferView): Uint8ClampedArray {
  if (data instanceof Uint8Array || data instanceof Uint8ClampedArray) return data as Uint8ClampedArray;
  if (data instanceof Uint16Array) { const o = new Uint8ClampedArray(data.length); for (let i = 0; i < data.length; i++) o[i] = Math.round(data[i] / 257); return o; }
  if (data instanceof Float32Array) {
    const o = new Uint8ClampedArray(data.length);
    for (let i = 0; i < data.length; i++) o[i] = (i & 3) === 3 ? Math.round(data[i] * 255) : Math.round(Math.pow(Math.max(0, Math.min(1, data[i])), 1 / 2.2) * 255);
    return o;
  }
  throw new Error('Kiểu dữ liệu ảnh không hỗ trợ');
}

export type CompileIO = {
  /** Ghi một ảnh 8-bit; gray = ảnh mask (giá trị nằm ở kênh R) */
  save(src: string, img: { width: number; height: number; data: Uint8ClampedArray }, gray: boolean): Promise<void>;
  /** Giải mã nội dung nhúng của smart object (không có = bỏ qua contentSrc, chỉ dùng để kiểm chứng) */
  decodeLinked?(data: Uint8Array, name: string): Promise<{ width: number; height: number; data: Uint8ClampedArray } | null>;
};

export function geometryFromPlaced(pl: NonNullable<Layer['placedLayer']>, warn: (m: string) => void): Geometry {
  const W = pl.width ?? 0, H = pl.height ?? 0;
  const quad = (pl.nonAffineTransform ?? pl.transform) as Geometry['quad'];
  const w = pl.warp as any;
  const b = w?.bounds;
  const bounds: Geometry['bounds'] = b ? [num(b.left), num(b.top), num(b.right), num(b.bottom)] : [0, 0, W, H];
  const env = w?.customEnvelopeWarp;
  const pts: { x: number; y: number }[] | undefined = env?.meshPoints;
  if (w && w.style && w.style !== 'none' && w.style !== 'custom') {
    warn(`Smart object dùng warp kiểu preset "${w.style}" — chưa hỗ trợ, đang dựng như không warp. Trong Photoshop chọn Warp → Custom rồi lưu lại để chuyển sang lưới.`);
  }
  if (!w || w.style !== 'custom' || !pts?.length) {
    const meshX: number[] = [], meshY: number[] = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      meshX.push(bounds[0] + (c / 3) * (bounds[2] - bounds[0]));
      meshY.push(bounds[1] + (r / 3) * (bounds[3] - bounds[1]));
    }
    return { contentWidth: W, contentHeight: H, bounds, quad, rows: 4, cols: 4, meshX, meshY, sliceX: [bounds[0], bounds[2]], sliceY: [bounds[1], bounds[3]] };
  }
  const sliceX: number[] = env.quiltSliceX?.length ? env.quiltSliceX.map(num) : [bounds[0], bounds[2]];
  const sliceY: number[] = env.quiltSliceY?.length ? env.quiltSliceY.map(num) : [bounds[1], bounds[3]];
  const cols = w.deformNumCols ?? (sliceX.length - 1) * 3 + 1;
  const rows = w.deformNumRows ?? (sliceY.length - 1) * 3 + 1;
  if (rows * cols !== pts.length || rows !== (sliceY.length - 1) * 3 + 1 || cols !== (sliceX.length - 1) * 3 + 1) {
    throw new Error(`Lưới warp không khớp: ${rows}×${cols} vs ${pts.length} điểm, slices ${sliceX.length}/${sliceY.length}`);
  }
  return { contentWidth: W, contentHeight: H, bounds, quad, rows, cols, meshX: pts.map(p => p.x), meshY: pts.map(p => p.y), sliceX, sliceY };
}

/** Smart filter dạng chỉnh màu (Curves/Levels/...) → cùng định dạng tham số với adjustment layer. */
function filterAdjustment(it: any): { type: string; [k: string]: unknown } | null {
  const f = it.filter ?? {};
  const order = ['composite', 'red', 'green', 'blue'];
  if (it.type === 'curves') {
    const channels: ({ input: number; output: number }[] | undefined)[] = [[], [], [], []];
    for (const a of f.adjustments ?? []) {
      const pts = (a.curve ?? []).map((p: any) => ({ input: p.x, output: p.y }));
      for (const ch of a.channels ?? []) { const k = order.indexOf(ch); if (k >= 0) channels[k] = pts; }
    }
    return { type: 'curves', channels };
  }
  if (it.type === 'levels') {
    const def = { shadowInput: 0, highlightInput: 255, shadowOutput: 0, highlightOutput: 255, midtoneInput: 1 };
    const channels = [def, def, def, def].map(x => ({ ...x }));
    for (const a of f.adjustments ?? []) for (const ch of a.channels ?? []) {
      const k = order.indexOf(ch); if (k < 0) continue;
      channels[k] = { shadowInput: a.input?.[0] ?? 0, highlightInput: a.input?.[1] ?? 255, shadowOutput: a.output?.[0] ?? 0, highlightOutput: a.output?.[1] ?? 255, midtoneInput: a.gamma ?? 1 };
    }
    return { type: 'levels', channels };
  }
  if (['invert', 'posterize', 'threshold', 'hue/saturation', 'brightness/contrast', 'exposure'].includes(it.type)) return { type: it.type, ...f };
  return null;
}

function slotKey(name: string) { return name.replace(/\.(psd|psb|png|jpe?g|tiff?|pdf|ai)$/i, ''); }

function hasContent(d: Uint8ClampedArray) {
  // ảnh gộp do tool bên thứ ba ghi có thể toàn trắng
  for (let i = 0; i < d.length; i += 4 * 97) if (d[i] !== 255 || d[i + 1] !== 255 || d[i + 2] !== 255) return true;
  return false;
}

/**
 * Mockup cũ: group màu ("Colors") chỉ gồm các fill bật clipping nhưng không có layer gốc trong group,
 * nên sẽ phủ cả canvas. Ý đồ của file là nhuộm sản phẩm: đưa các fill ra ngoài để clip vào layer ngay dưới group.
 * path giữ nguyên để bật/tắt theo tên như cũ. Các fill đều ẩn trong file nên ảnh gốc không đổi.
 */
function hoistBaselessClips(layers: SpecNode[]): SpecNode[] {
  const out: SpecNode[] = [];
  for (const n of layers) {
    if (n.type !== 'group') { out.push(n); continue; }
    const children = hoistBaselessClips(n.children);
    const baseless = children.length > 0 && children.every(c => c.type === 'solid' && c.clipping);
    if (baseless && out.some(p => !p.clipping)) out.push(...children);
    else out.push({ ...n, children });
  }
  return out;
}

export async function compilePsdData(buffer: ArrayBuffer | Buffer, source: string, io: CompileIO): Promise<MockupSpec> {
  ensureCanvas();
  const psd: Psd = readPsd(buffer, { useImageData: true, skipThumbnail: true });
  const savePng = (src: string, img: { width: number; height: number; data: ArrayBufferView }, gray = false) =>
    io.save(src, { width: img.width, height: img.height, data: to8(img.data) }, gray);
  const warnings: string[] = [];
  const warn = (m: string) => { if (!warnings.includes(m)) warnings.push(m); };
  if ((psd.bitsPerChannel ?? 8) !== 8) warn(`Tài liệu ${psd.bitsPerChannel}-bit: đã chuyển về 8-bit${psd.bitsPerChannel === 32 ? ' (32-bit tuyến tính → gamma 2.2, xấp xỉ)' : ''}.`);
  if (psd.colorMode !== undefined && psd.colorMode !== 3) warn('Tài liệu không phải RGB — màu sẽ sai.');
  const linked = new Map((psd.linkedFiles ?? []).map(f => [f.id, f]));
  const slots = new Map<string, SlotInfo>();
  const slotOfId = new Map<string, string>(); // id nội dung → khoá slot (tránh trùng tên file khác nội dung)
  let idx = 0;

  const walk = async (layers: Layer[] | undefined, parent: string): Promise<SpecNode[]> => {
    const out: SpecNode[] = [];
    for (const l of layers ?? []) {
      const id = idx++;
      const name = l.name ?? `layer ${id}`;
      const p = parent ? `${parent}/${name}` : name;
      const base: any = {
        name, path: p, hidden: !!l.hidden, blendMode: (l.blendMode ?? 'normal') as any,
        opacity: l.opacity ?? 1, fillOpacity: l.fillOpacity ?? 1, clipping: !!l.clipping,
        blendClippedAsGroup: (l as any).blendClippendElements ?? true,
      };
      // Kênh −2: nếu cờ fromVectorData thì đây là vector mask do Photoshop raster hoá; kênh −3 (realMask) là mask người dùng.
      const m = l.mask as any, rm = (l as any).realMask as any;
      const userMask = m?.fromVectorData ? rm : m;
      const vecRaster = m?.fromVectorData ? m : undefined;
      const saveMask = async (mk: any, tag: string, density?: number, feather?: number) => {
        if (mk?.imageData && mk.right > mk.left && mk.bottom > mk.top) {
          const src = `masks/${id}${tag}.png`;
          await savePng(src, mk.imageData, true);
          return { src, left: mk.left, top: mk.top, width: mk.right - mk.left, height: mk.bottom - mk.top, defaultColor: mk.defaultColor ?? 0, disabled: !!mk.disabled, density, feather };
        }
        return undefined;
      };
      if (userMask && !userMask.disabled) {
        base.mask = await saveMask(userMask, '', m?.userMaskDensity, m?.userMaskFeather);
        if (!base.mask && (userMask.defaultColor ?? 255) === 0 && !(m?.userMaskDensity < 1)) base.hidden = true; // mask rỗng nền đen = ẩn
      }
      const vm = l.vectorMask as any;
      if (vm?.paths?.length && !vm.disable) {
        const r = vecRaster ? await saveMask(vecRaster, 'v', m?.vectorMaskDensity, m?.vectorMaskFeather) : undefined;
        if (r) base.vectorMaskRaster = r;
        else base.vectorMask = {
          paths: vm.paths.map((q: any) => ({ open: !!q.open, operation: q.operation ?? 'combine', fillRule: q.fillRule ?? 'non-zero', knots: q.knots.map((k: any) => ({ points: k.points })) })),
          invert: !!vm.invert, fillStartsWithAllPixels: !!vm.fillStartsWithAllPixels, density: m?.vectorMaskDensity, feather: m?.vectorMaskFeather,
        } satisfies VectorMask;
      }
      if (l.effects && Object.values(l.effects).some((e: any) => Array.isArray(e) ? e.some(x => x?.enabled !== false && x?.present !== false) : e && typeof e === 'object' && e.enabled !== false && e.present !== false)) {
        if (!l.hidden) warn(`Layer "${p}" có Layer Style (hiệu ứng) — chưa dựng, bị bỏ qua.`);
      }
      if ((l as any).knockout) warn(`Layer "${p}" dùng Knockout — chưa hỗ trợ.`);
      const br = (l as any).blendingRanges;
      if (br) {
        const src = [br.compositeGrayBlendSource, ...(br.ranges ?? []).slice(0, 3).map((r: any) => r.sourceRange)];
        const dst = [br.compositeGraphBlendDestinationRange, ...(br.ranges ?? []).slice(0, 3).map((r: any) => r.destRange)];
        const isDefault = [...src, ...dst].every((r: number[]) => r && r[0] === 0 && r[1] === 0 && r[2] === 255 && r[3] === 255);
        if (!isDefault && src.length === 4 && dst.length === 4) base.blendIf = { src, dst };
      }
      if ((l as any).transparencyShapesLayer === false) warn(`Layer "${p}" tắt "Transparency Shapes Layer" — chưa mô phỏng.`);
      if ((l as any).blendMode === 'dissolve') warn(`Layer "${p}" dùng Dissolve — dựng như Normal.`);
      const adj = (l as any).adjustment;
      if (adj) {
        if (!makeAdjustment(adj).supported) { if (!l.hidden) warn(`Layer "${p}" là Adjustment "${adj.type}" — chưa hỗ trợ, bị bỏ qua. Cách xử lý: merge vào layer bên dưới trong Photoshop.`); continue; }
        if (adj.type === 'hue/saturation' || adj.type === 'brightness/contrast') if (!l.hidden) warn(`Layer "${p}" (${adj.type}): công thức dựng ngược — sai số nhỏ so với Photoshop.`);
        out.push({ ...base, type: 'adjust', adjustment: adj });
        continue;
      }

      if (l.children) {
        out.push({ ...base, type: 'group', children: await walk(l.children, p) });
      } else if (l.placedLayer) {
        const pl = l.placedLayer;
        const filters: SmartFilter[] = [];
        const fl = pl.filter as any;
        if (fl && fl.enabled !== false) {
          for (const it of fl.list ?? []) {
            if (it.enabled === false) continue;
            const bm = (it.blendMode ?? 'normal') as any, op = it.opacity ?? 1;
            if (bm !== 'normal') warn(`Smart filter "${it.name}" trên "${p}" dùng blend ${bm} — dựng như Normal.`);
            const adjOfFilter = filterAdjustment(it);
            if (it.type === 'gaussian blur') filters.push({ type: 'gaussian blur', radius: num(it.filter?.radius), opacity: op, blendMode: 'normal' });
            else if (adjOfFilter && makeAdjustment(adjOfFilter).supported) filters.push({ type: 'adjust', adjustment: adjOfFilter, opacity: op, blendMode: 'normal' });
            else warn(`Smart filter "${it.name}" (${it.type}) trên "${p}" chưa hỗ trợ — kết quả sẽ thiếu hiệu ứng này${it.type === 'displace' ? ' (Displace cần file bản đồ: Photoshop chỉ lưu đường dẫn, không nhúng vào PSD)' : ''}.`);
          }
        }
        const lf = linked.get(pl.id);
        let key = slotOfId.get(pl.id) ?? slotKey(lf?.name ?? name);
        if (!slotOfId.has(pl.id)) {
          // cùng tên file nhưng khác kích thước nội dung → slot riêng
          let k = key, i = 2;
          while (slots.has(k) && (slots.get(k)!.width !== pl.width || slots.get(k)!.height !== pl.height)) k = `${key}#${i++}`;
          key = k; slotOfId.set(pl.id, key);
        }
        let slot = slots.get(key)!;
        if (!slot) {
          slot = { key, name: lf?.name ?? name, width: pl.width ?? 0, height: pl.height ?? 0, dpi: num((pl as any).resolution, 72) || 72, layerPaths: [] };
          if (lf?.data && io.decodeLinked) {
            const c = await io.decodeLinked(lf.data, lf.name);
            if (c) { slot.contentSrc = `slots/${key}.png`; await savePng(slot.contentSrc, c); }
          }
          slots.set(key, slot);
        }
        slot.layerPaths.push(p);
        let preview: any;
        if (l.imageData && l.imageData.width && l.imageData.height) {
          preview = { src: `layers/${id}.png`, left: l.left ?? 0, top: l.top ?? 0, width: l.imageData.width, height: l.imageData.height };
          await savePng(preview.src, l.imageData);
        }
        out.push({ ...base, type: 'smart', slot: key, preview, geometry: geometryFromPlaced(pl, warn), filters: filters.length ? filters : undefined });
      } else if ((l as any).vectorStroke?.strokeEnabled && l.imageData?.width) {
        // shape có stroke: dùng raster Photoshop đã dựng sẵn (đã gồm fill + stroke + hình dạng) — không áp lại vector mask
        const src = `layers/${id}.png`;
        await savePng(src, l.imageData);
        const { vectorMask: _v, vectorMaskRaster: _r, ...rest } = base;
        out.push({ ...rest, type: 'pixel', src, left: l.left ?? 0, top: l.top ?? 0, width: l.imageData.width, height: l.imageData.height });
      } else if ((l as any).vectorFill) {
        const f = (l as any).vectorFill;
        if (f.type === 'color' && f.color) out.push({ ...base, type: 'solid', color: [f.color.r, f.color.g, f.color.b] });
        else { warn(`Layer "${p}" là ${f.type === 'solid' || f.type === 'noise' ? 'gradient' : f.type} fill — chưa dựng lại, dùng raster Photoshop lưu sẵn (nếu có).`); if (l.imageData?.width) { const src = `layers/${id}.png`; await savePng(src, l.imageData); const { vectorMask: _v, vectorMaskRaster: _r, ...rest } = base; out.push({ ...rest, type: 'pixel', src, left: l.left ?? 0, top: l.top ?? 0, width: l.imageData.width, height: l.imageData.height }); } }
      } else if (l.imageData && l.imageData.width && l.imageData.height) {
        const src = `layers/${id}.png`;
        await savePng(src, l.imageData);
        out.push({ ...base, type: 'pixel', src, left: l.left ?? 0, top: l.top ?? 0, width: l.imageData.width, height: l.imageData.height });
      } else {
        // layer trống: vẫn giữ vì nó có thể là gốc/thành viên của clipping (đổi cách ghép của layer khác)
        out.push({ ...base, type: 'pixel', src: '', left: 0, top: 0, width: 0, height: 0 });
      }
    }
    return out;
  };

  const layers = hoistBaselessClips(await walk(psd.children, ''));
  let compositeSrc: string | undefined;
  if (psd.imageData && hasContent(psd.imageData.data as Uint8ClampedArray)) {
    compositeSrc = 'composite.png';
    await savePng(compositeSrc, psd.imageData);
  } else warn('File không có ảnh gộp hợp lệ (composite trắng/rỗng) — dấu hiệu PSD không được lưu bằng Photoshop.');

  return { version: 1, source, width: psd.width, height: psd.height, layers, slots: [...slots.values()], warnings, compositeSrc };
}
