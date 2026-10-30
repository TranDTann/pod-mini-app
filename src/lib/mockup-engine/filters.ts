// Smart filter áp lên raster smart object SAU khi đã biến đổi hình học (đơn vị px của canvas), như Photoshop.
import { makeAdjustment } from './adjust';
import type { SmartFilter } from './types';

type F32Rect = { left: number; top: number; width: number; height: number; data: Float32Array };

/** Gaussian blur trên ảnh premultiplied. Photoshop "Radius" ≈ độ lệch chuẩn σ (kiểm chứng bằng file mẫu). */
function gaussian(src: F32Rect, sigma: number, canvasW: number, canvasH: number): F32Rect {
  const r = Math.ceil(sigma * 3);
  const left = Math.max(0, src.left - r), top = Math.max(0, src.top - r);
  const right = Math.min(canvasW, src.left + src.width + r), bottom = Math.min(canvasH, src.top + src.height + r);
  const W = right - left, H = bottom - top;
  const k = new Float32Array(2 * r + 1);
  let sum = 0;
  for (let i = -r; i <= r; i++) { k[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma)); sum += k[i + r]; }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  // chép vào khung mở rộng
  const a = new Float32Array(W * H * 4);
  for (let y = 0; y < src.height; y++) {
    const dy = y + src.top - top;
    a.set(src.data.subarray(y * src.width * 4, (y + 1) * src.width * 4), (dy * W + (src.left - left)) * 4);
  }
  const b = new Float32Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let s0 = 0, s1 = 0, s2 = 0, s3 = 0;
    for (let i = -r; i <= r; i++) {
      const xx = x + i; if (xx < 0 || xx >= W) continue;
      const o = (y * W + xx) * 4, w = k[i + r];
      s0 += a[o] * w; s1 += a[o + 1] * w; s2 += a[o + 2] * w; s3 += a[o + 3] * w;
    }
    const o = (y * W + x) * 4; b[o] = s0; b[o + 1] = s1; b[o + 2] = s2; b[o + 3] = s3;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let s0 = 0, s1 = 0, s2 = 0, s3 = 0;
    for (let i = -r; i <= r; i++) {
      const yy = y + i; if (yy < 0 || yy >= H) continue;
      const o = (yy * W + x) * 4, w = k[i + r];
      s0 += b[o] * w; s1 += b[o + 1] * w; s2 += b[o + 2] * w; s3 += b[o + 3] * w;
    }
    const o = (y * W + x) * 4; a[o] = s0; a[o + 1] = s1; a[o + 2] = s2; a[o + 3] = s3;
  }
  return { left, top, width: W, height: H, data: a };
}

export function applySmartFilters(src: F32Rect, filters: SmartFilter[], canvasW: number, canvasH: number): F32Rect {
  let cur = src;
  for (const f of filters) {
    let next: F32Rect;
    if (f.type === 'gaussian blur') next = f.radius > 0 ? gaussian(cur, f.radius, canvasW, canvasH) : cur;
    else {
      const fn = makeAdjustment(f.adjustment).fn;
      if (!fn) continue;
      const d = new Float32Array(cur.data);
      const n = cur.width * cur.height, C = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const a = d[i * 4 + 3], k = a > 0 ? 1 / a : 0; for (let c = 0; c < 3; c++) C[i * 3 + c] = d[i * 4 + c] * k; }
      fn(C, n);
      for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) d[i * 4 + c] = C[i * 3 + c] * d[i * 4 + 3];
      next = { ...cur, data: d };
    }
    if (f.opacity < 1 && next !== cur) {
      // trộn với kết quả trước theo opacity của filter (mode Normal)
      const out = new Float32Array(next.data);
      for (let y = 0; y < cur.height; y++) for (let x = 0; x < cur.width; x++) {
        const X = x + cur.left - next.left, Y = y + cur.top - next.top;
        const o = (Y * next.width + X) * 4, q = (y * cur.width + x) * 4;
        for (let c = 0; c < 4; c++) out[o + c] = cur.data[q + c] + f.opacity * (next.data[o + c] - cur.data[q + c]);
      }
      // pixel chỉ có ở `next` (vùng mở rộng do blur) — nhân opacity
      for (let y = 0; y < next.height; y++) for (let x = 0; x < next.width; x++) {
        const X = x + next.left - cur.left, Y = y + next.top - cur.top;
        if (X >= 0 && Y >= 0 && X < cur.width && Y < cur.height) continue;
        const o = (y * next.width + x) * 4;
        for (let c = 0; c < 4; c++) out[o + c] = next.data[o + c] * f.opacity;
      }
      next = { ...next, data: out };
    }
    cur = next;
  }
  return cur;
}
