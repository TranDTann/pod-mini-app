/**
 * Renderer chạy được cả browser (HTMLCanvasElement / OffscreenCanvas) lẫn Node (@napi-rs/canvas, skia-canvas).
 * Chỉ dùng Canvas 2D API chuẩn + hàm createCanvas được inject.
 */
import { bezierPatch, isParallelogram, quadSize, squareToQuad } from './geometry';
import type { PrintArea, Pt, RenderNode, SideSpec, TemplateSpec } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyCanvas = any;
type AnyImage = any; // HTMLImageElement | ImageBitmap | Canvas | napi Image
type Ctx = any; // CanvasRenderingContext2D

export interface RenderEnv {
  createCanvas: (w: number, h: number) => AnyCanvas;
}
export type Fit = 'contain' | 'cover' | 'fill';
export type Align = 'top' | 'center';

export interface MockupOptions {
  side: string;
  /** colorKey; null = không áp layer màu nào (giữ màu ảnh gốc); undefined = màu mặc định của side */
  color?: string | null;
  /** ảnh design của khách theo areaKey */
  designs?: Record<string, AnyImage | undefined>;
  /** print file đã compose sẵn (ưu tiên hơn designs) */
  printFiles?: Record<string, AnyCanvas | undefined>;
  /** asset id → ảnh đã load */
  assets: Record<string, AnyImage>;
  scale?: number;
  fit?: Fit;
  align?: Align;
  showGuides?: boolean;
}

const BLEND: Record<string, string> = {
  normal: 'source-over', 'pass through': 'source-over', multiply: 'multiply', screen: 'screen', overlay: 'overlay',
  darken: 'darken', lighten: 'lighten', 'color dodge': 'color-dodge', 'color burn': 'color-burn',
  'hard light': 'hard-light', 'soft light': 'soft-light', difference: 'difference', exclusion: 'exclusion',
  hue: 'hue', saturation: 'saturation', color: 'color', luminosity: 'luminosity',
  // xấp xỉ
  'linear dodge': 'lighter', 'linear burn': 'multiply', 'darker color': 'darken', 'lighter color': 'lighten',
};
export const canvasBlend = (b: string) => BLEND[b] ?? 'source-over';

/**
 * Đặt design của khách vào khung print file đúng kích thước sản xuất (VD 4200x4800).
 * Kết quả vừa dùng để in, vừa là "texture" để vẽ lên mockup.
 */
export function composePrintFile(area: PrintArea, design: AnyImage, env: RenderEnv, fit: Fit = 'contain', align: Align = 'top', scale = 1): AnyCanvas {
  const W = Math.max(1, Math.round(area.designSize.width * scale)), H = Math.max(1, Math.round(area.designSize.height * scale));
  const c = env.createCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  const iw = design.width, ih = design.height;
  let w = W, h = H;
  if (fit !== 'fill') {
    const s = fit === 'contain' ? Math.min(W / iw, H / ih) : Math.max(W / iw, H / ih);
    w = iw * s; h = ih * s;
  }
  const x = (W - w) / 2, y = align === 'top' ? 0 : (H - h) / 2;
  ctx.drawImage(design, x, y, w, h);
  return c;
}

/** Vẽ ảnh vào tứ giác: affine nếu là hình bình hành, ngược lại chia lưới tam giác (perspective / mesh warp). */
export function drawToArea(ctx: Ctx, img: AnyImage, area: PrintArea, grid = 16) {
  const sw = img.width, sh = img.height;
  const q = area.quad;
  if (!area.warp && isParallelogram(q)) {
    const [[x0, y0], [x1, y1], , [x3, y3]] = q;
    ctx.save();
    ctx.transform((x1 - x0) / sw, (y1 - y0) / sw, (x3 - x0) / sh, (y3 - y0) / sh, x0, y0);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
    return;
  }
  const P = area.warp ? bezierPatch(area.warp.points, area.warp.cols, area.warp.rows) : squareToQuad(q);
  for (let i = 0; i < grid; i++) {
    for (let j = 0; j < grid; j++) {
      const u0 = j / grid, u1 = (j + 1) / grid, v0 = i / grid, v1 = (i + 1) / grid;
      const s00: Pt = [u0 * sw, v0 * sh], s10: Pt = [u1 * sw, v0 * sh], s11: Pt = [u1 * sw, v1 * sh], s01: Pt = [u0 * sw, v1 * sh];
      const d00 = P(u0, v0), d10 = P(u1, v0), d11 = P(u1, v1), d01 = P(u0, v1);
      drawTriangle(ctx, img, s00, s10, s11, d00, d10, d11);
      drawTriangle(ctx, img, s00, s11, s01, d00, d11, d01);
    }
  }
}

function drawTriangle(ctx: Ctx, img: AnyImage, s0: Pt, s1: Pt, s2: Pt, d0: Pt, d1: Pt, d2: Pt) {
  // nới tam giác đích ~0.8px THIẾT BỊ (tính theo transform hiện tại) để không lộ đường nối
  const m = ctx.getTransform?.();
  const px = 0.8 / ((m && Math.hypot(m.a, m.b)) || 1);
  const cx = (d0[0] + d1[0] + d2[0]) / 3, cy = (d0[1] + d1[1] + d2[1]) / 3;
  const grow = (p: Pt): Pt => {
    const dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1;
    return [p[0] + (dx / l) * px, p[1] + (dy / l) * px];
  };
  const [e0, e1, e2] = [grow(d0), grow(d1), grow(d2)];
  const den = (s1[0] - s0[0]) * (s2[1] - s0[1]) - (s2[0] - s0[0]) * (s1[1] - s0[1]);
  if (Math.abs(den) < 1e-9) return;
  const a = ((d1[0] - d0[0]) * (s2[1] - s0[1]) - (d2[0] - d0[0]) * (s1[1] - s0[1])) / den;
  const c = ((d2[0] - d0[0]) * (s1[0] - s0[0]) - (d1[0] - d0[0]) * (s2[0] - s0[0])) / den;
  const b = ((d1[1] - d0[1]) * (s2[1] - s0[1]) - (d2[1] - d0[1]) * (s1[1] - s0[1])) / den;
  const d = ((d2[1] - d0[1]) * (s1[0] - s0[0]) - (d1[1] - d0[1]) * (s2[0] - s0[0])) / den;
  const e = d0[0] - a * s0[0] - c * s0[1];
  const f = d0[1] - b * s0[0] - d * s0[1];
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(e0[0], e0[1]); ctx.lineTo(e1[0], e1[1]); ctx.lineTo(e2[0], e2[1]); ctx.closePath();
  ctx.clip();
  ctx.transform(a, b, c, d, e, f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

/** Render mockup 1 side với 1 màu + design. */
export function renderMockup(spec: TemplateSpec, env: RenderEnv, o: MockupOptions): AnyCanvas {
  const side = spec.sides.find((s) => s.key === o.side);
  if (!side) throw new Error(`Side "${o.side}" không tồn tại`);
  const scale = o.scale ?? 1;
  const W = Math.round(spec.canvas.width * scale), H = Math.round(spec.canvas.height * scale);
  const color = o.color === undefined ? side.defaultColor : o.color;
  const out = env.createCanvas(W, H);
  const ctx = out.getContext('2d');
  const assetByRef = new Map(Object.values(spec.assets).filter((a) => !a.id.endsWith('__mask')).map((a) => [a.ref, a]));

  const newLayer = () => {
    const c = env.createCanvas(W, H);
    const l = c.getContext('2d');
    l.imageSmoothingQuality = 'high';
    l.setTransform(scale, 0, 0, scale, 0, 0);
    return { c, l };
  };
  const drawAsset = (l: Ctx, id: string) => {
    const a = spec.assets[id], img = o.assets[id];
    if (a && img) l.drawImage(img, a.left, a.top, a.width, a.height);
  };
  // texture design: thu nhỏ trước cho đúng cỡ hiển thị (nhanh hơn rất nhiều khi phải chia lưới)
  const textures = new Map<string, AnyCanvas>();
  const textureFor = (area: PrintArea) => {
    if (textures.has(area.key)) return textures.get(area.key);
    const pf = o.printFiles?.[area.key];
    const d = o.designs?.[area.key];
    const qs = quadSize(area.quad);
    const want = Math.min(1, (Math.max(qs.width, qs.height) * scale * 2) / Math.max(area.designSize.width, area.designSize.height));
    let tex: AnyCanvas | undefined;
    if (pf) {
      tex = env.createCanvas(Math.round(pf.width * want), Math.round(pf.height * want));
      const t = tex.getContext('2d'); t.imageSmoothingQuality = 'high';
      t.drawImage(pf, 0, 0, tex.width, tex.height);
    } else if (d) tex = composePrintFile(area, d, env, o.fit, o.align, want);
    textures.set(area.key, tex);
    return tex;
  };

  for (const node of side.stack) {
    if (node.kind === 'color' && node.colorKey !== color) continue;
    // template "mỗi màu 1 ảnh" không có ảnh trung tính → color=null vẫn dùng ảnh màu mặc định
    if (node.kind === 'image' && node.colorKey && node.colorKey !== (color ?? side.defaultColor)) continue;
    const { c, l } = newLayer();
    if (node.kind === 'image') drawAsset(l, node.asset);
    else if (node.kind === 'color') { l.fillStyle = node.hex; l.fillRect(0, 0, spec.canvas.width, spec.canvas.height); }
    else {
      const area = side.printAreas.find((a) => a.key === node.areaKey);
      const tex = area && textureFor(area);
      if (!area || !tex) continue;
      drawToArea(l, tex, area);
    }
    // clip vào base không có ảnh (VD base bị bỏ qua) → bỏ node, đừng tô màu ra cả canvas
    if (!applyMasks(l, node, spec, o, assetByRef, drawAsset, newLayer)) continue;
    ctx.globalCompositeOperation = canvasBlend(node.blend);
    ctx.globalAlpha = node.opacity;
    ctx.drawImage(c, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  if (o.showGuides) {
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2 / scale;
    ctx.strokeStyle = '#ff2d55';
    for (const a of side.printAreas) {
      ctx.beginPath();
      a.quad.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }
  return out;
}

function applyMasks(
  l: Ctx, node: RenderNode, spec: TemplateSpec, o: MockupOptions,
  assetByRef: Map<string, { id: string }>, drawAsset: (l: Ctx, id: string) => void,
  newLayer: () => { c: AnyCanvas; l: Ctx },
): boolean {
  if (node.mask) {
    const m = spec.assets[node.mask.asset];
    const { c, l: ml } = newLayer();
    if (node.mask.defaultVisible) {
      ml.fillRect(0, 0, spec.canvas.width, spec.canvas.height);
      ml.clearRect(m.left, m.top, m.width, m.height);
    }
    drawAsset(ml, node.mask.asset);
    l.save(); l.setTransform(1, 0, 0, 1, 0, 0);
    l.globalCompositeOperation = 'destination-in';
    l.drawImage(c, 0, 0);
    l.restore();
  }
  if (node.clipTo) {
    const base = assetByRef.get(node.clipTo);
    if (!base) return false;
    // vẽ base ra 1 canvas full-size rồi destination-in (tránh khác biệt "bounded compositing" giữa các engine)
    const { c, l: bl } = newLayer();
    drawAsset(bl, base.id);
    l.save(); l.setTransform(1, 0, 0, 1, 0, 0);
    l.globalCompositeOperation = 'destination-in';
    l.drawImage(c, 0, 0);
    l.restore();
  }
  return true;
}

export function listVariants(spec: TemplateSpec): { side: SideSpec; color: string | null }[] {
  return spec.sides.flatMap((side): { side: SideSpec; color: string | null }[] =>
    side.colors.length ? side.colors.map((c) => ({ side, color: c })) : [{ side, color: null }]);
}
