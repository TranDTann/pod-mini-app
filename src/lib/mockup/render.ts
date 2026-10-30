// Phần lõi dựng mockup — thuần TypeScript, chạy được cả trình duyệt lẫn Node (không phụ thuộc DOM).
//
// Thứ tự layer trong PSD và công thức tương ứng (giá trị kênh 0..255):
//   Base   = Background + "Base Product"                     (Normal)
//   S      = pixel smart object đè lên fill trắng "Mask":  S = 255·(1−α) + C·α
//   X      = max(0, Base + S − 255)   trong vùng in,  X = Base ngoài vùng in       (Linear Burn)
//   Final  = X · (1 − k + k·E/255),   k = α_E · 179/255                            (Effect: Multiply 70%)

import { MOCKUP, type Fit, type MockupConfig } from './config';
import type { UvLut } from './warp';

export type RGBA = { width: number; height: number; data: Uint8ClampedArray | Uint8Array };

export type PreparedMockup = {
  width: number;
  height: number;
  /** mockup trống (chưa in) = Base × hệ số Effect — tính 1 lần, dùng lại cho mọi ảnh */
  blank: Uint8ClampedArray<ArrayBuffer>;
  /** Base và hệ số Effect chỉ trong vùng in (RGB, float) */
  baseRect: Float32Array;
  factorRect: Float32Array;
};

/** base: Background + Base Product đã gộp (3000×2000). effect: layer Effect (3000×2000, có alpha). */
export function prepareMockup(base: RGBA, effect: RGBA, cfg: MockupConfig = MOCKUP): PreparedMockup {
  const { width, height } = base;
  const n = width * height;
  const blank = new Uint8ClampedArray(n * 4);
  const { x: rx, y: ry, width: rw, height: rh } = cfg.printArea;
  const baseRect = new Float32Array(rw * rh * 3);
  const factorRect = new Float32Array(rw * rh * 3);
  const op = cfg.effectOpacity;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const k = (effect.data[o + 3] / 255) * op;
    const px = i % width, py = (i / width) | 0;
    const inRect = px >= rx && px < rx + rw && py >= ry && py < ry + rh;
    const r = inRect ? ((py - ry) * rw + (px - rx)) * 3 : -1;
    for (let c = 0; c < 3; c++) {
      const f = 1 - k + (k * effect.data[o + c]) / 255;
      const b = base.data[o + c];
      blank[o + c] = b * f + 0.5;
      if (r >= 0) { baseRect[r + c] = b; factorRect[r + c] = f; }
    }
    blank[o + 3] = 255;
  }
  return { width, height, blank, baseRect, factorRect };
}

/** layer: ảnh đúng kích thước vùng in (558×499), alpha thường (straight). */
export function composeMockup(prep: PreparedMockup, layer: RGBA, cfg: MockupConfig = MOCKUP): Uint8ClampedArray<ArrayBuffer> {
  const out = prep.blank.slice();
  const { x: rx, y: ry, width: rw, height: rh } = cfg.printArea;
  if (layer.width !== rw || layer.height !== rh) throw new Error(`layer phải là ${rw}×${rh}`);
  for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) {
    const li = (y * rw + x) * 4, ri = (y * rw + x) * 3;
    const oi = ((ry + y) * prep.width + (rx + x)) * 4;
    const a = layer.data[li + 3] / 255;
    for (let c = 0; c < 3; c++) {
      const S = 255 * (1 - a) + layer.data[li + c] * a;          // đè lên fill trắng
      const X = Math.max(0, prep.baseRect[ri + c] + S - 255);      // Linear Burn
      out[oi + c] = X * prep.factorRect[ri + c] + 0.5;             // Multiply (Effect)
    }
  }
  return out;
}

/** Toán đặt ảnh vào khung (dùng cho canvas.drawImage hoặc tự crop). Trả về vùng nguồn và vùng đích. */
export function fitRect(srcW: number, srcH: number, dstW: number, dstH: number, fit: Fit) {
  if (fit === 'stretch') return { sx: 0, sy: 0, sw: srcW, sh: srcH, dx: 0, dy: 0, dw: dstW, dh: dstH };
  const s = fit === 'cover' ? Math.max(dstW / srcW, dstH / srcH) : Math.min(dstW / srcW, dstH / srcH);
  if (fit === 'cover') {
    const sw = dstW / s, sh = dstH / s;
    return { sx: (srcW - sw) / 2, sy: (srcH - sh) / 2, sw, sh, dx: 0, dy: 0, dw: dstW, dh: dstH };
  }
  const dw = srcW * s, dh = srcH * s;
  return { sx: 0, sy: 0, sw: srcW, sh: srcH, dx: (dstW - dw) / 2, dy: (dstH - dh) / 2, dw, dh };
}

/**
 * Chế độ "photoshop": lấy mẫu nội dung smart object qua LUT (perspective + warp của PSD),
 * trả về layer đúng kích thước vùng in. `so` có thể là bản thu nhỏ của canvas 3613×3061
 * (khuyên dùng scale 0.5 để chống răng cưa) — toạ độ (u,v) là chuẩn hoá nên không phụ thuộc kích thước.
 */
export function warpSmartObject(so: RGBA, lut: UvLut, cfg: MockupConfig = MOCKUP): RGBA {
  const { width: rw, height: rh } = cfg.printArea;
  const ss = lut.ss, W = lut.width;
  const out = new Uint8ClampedArray(rw * rh * 4);
  const sw = so.width, sh = so.height, d = so.data;
  const acc = new Float64Array(4);
  const tap = (ix: number, iy: number, w: number) => {
    if (ix < 0 || iy < 0 || ix >= sw || iy >= sh || w === 0) return;
    const o = (iy * sw + ix) * 4, a = d[o + 3] * w;
    acc[0] += d[o] * a; acc[1] += d[o + 1] * a; acc[2] += d[o + 2] * a; acc[3] += a;
  };
  for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) {
    acc.fill(0);
    for (let sy2 = 0; sy2 < ss; sy2++) for (let sx2 = 0; sx2 < ss; sx2++) {
      const li = ((y * ss + sy2) * W + (x * ss + sx2)) * 2;
      const u = lut.uv[li], v = lut.uv[li + 1];
      if (u < 0) continue;
      // bilinear, premultiplied alpha
      const fx = u * sw - 0.5, fy = v * sh - 0.5;
      const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
      tap(x0, y0, (1 - tx) * (1 - ty)); tap(x0 + 1, y0, tx * (1 - ty));
      tap(x0, y0 + 1, (1 - tx) * ty); tap(x0 + 1, y0 + 1, tx * ty);
    }
    const o = (y * rw + x) * 4, n = ss * ss;
    if (acc[3] > 0) {
      out[o] = acc[0] / acc[3]; out[o + 1] = acc[1] / acc[3]; out[o + 2] = acc[2] / acc[3];
    }
    out[o + 3] = acc[3] / n + 0.5;
  }
  return { width: rw, height: rh, data: out };
}
