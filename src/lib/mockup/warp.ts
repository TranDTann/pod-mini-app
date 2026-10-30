// Toán học biến đổi smart object của Photoshop (perspective + custom envelope warp 4×4).
//
//   (u,v) ∈ [0,1]²  — toạ độ chuẩn hoá trong nội dung smart object (pixel = u·W, v·H)
//   1) P_k   : 16 điểm lưới (meshX/meshY), k = 4·row + col
//   2) n_k   = ((x_k − xmin)/(xmax − xmin), (y_k − ymin)/(ymax − ymin))   ← bbox của 16 điểm
//   3) C_k   = H(n_k)        H: homography biến hình vuông đơn vị → tứ giác `quad`
//   4) Q(u,v)= Σ_i Σ_j B_i(v)·B_j(u)·C_(4i+j)    B: đa thức Bernstein bậc 3
//   → Q(u,v) là vị trí trên canvas mockup của pixel (u·W, v·H) trong smart object.

import { MOCKUP, type MockupConfig } from './config';

export type Vec2 = [number, number];
export type Homography = { a: number; b: number; c: number; d: number; e: number; f: number; g: number; h: number };

/** Homography hình vuông đơn vị → tứ giác (Heckbert). q = [TL, TR, BR, BL]. */
export function squareToQuad(q: readonly (readonly [number, number])[]): Homography {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const sx = x0 - x1 + x2 - x3;
  const sy = y0 - y1 + y2 - y3;
  if (Math.abs(sx) < 1e-12 && Math.abs(sy) < 1e-12) {
    // affine
    return { a: x1 - x0, b: x3 - x0, c: x0, d: y1 - y0, e: y3 - y0, f: y0, g: 0, h: 0 };
  }
  const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / den;
  const h = (dx1 * sy - sx * dy1) / den;
  return {
    a: x1 - x0 + g * x1, b: x3 - x0 + h * x3, c: x0,
    d: y1 - y0 + g * y1, e: y3 - y0 + h * y3, f: y0,
    g, h,
  };
}

export function applyH(H: Homography, s: number, t: number): Vec2 {
  const w = H.g * s + H.h * t + 1;
  return [(H.a * s + H.b * t + H.c) / w, (H.d * s + H.e * t + H.f) / w];
}

/** 16 điểm điều khiển sau khi chiếu lên canvas (bước 2 + 3). */
export function controlPointsOnCanvas(cfg: MockupConfig = MOCKUP): { cx: Float64Array; cy: Float64Array } {
  const mx = cfg.meshX, my = cfg.meshY;
  const xmin = Math.min(...mx), xmax = Math.max(...mx);
  const ymin = Math.min(...my), ymax = Math.max(...my);
  const H = squareToQuad(cfg.quad);
  const cx = new Float64Array(16), cy = new Float64Array(16);
  for (let k = 0; k < 16; k++) {
    const [X, Y] = applyH(H, (mx[k] - xmin) / (xmax - xmin), (my[k] - ymin) / (ymax - ymin));
    cx[k] = X; cy[k] = Y;
  }
  return { cx, cy };
}

function bernstein(t: number, out: Float64Array) {
  const s = 1 - t;
  out[0] = s * s * s; out[1] = 3 * s * s * t; out[2] = 3 * s * t * t; out[3] = t * t * t;
}

/** Hàm biến đổi thuận: (u,v) của smart object → (X,Y) trên canvas mockup (bước 4). */
export function makeForwardMap(cfg: MockupConfig = MOCKUP) {
  const { cx, cy } = controlPointsOnCanvas(cfg);
  const bu = new Float64Array(4), bv = new Float64Array(4);
  return (u: number, v: number): Vec2 => {
    bernstein(u, bu); bernstein(v, bv);
    let X = 0, Y = 0;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const w = bv[i] * bu[j];
      X += w * cx[4 * i + j]; Y += w * cy[4 * i + j];
    }
    return [X, Y];
  };
}

export type UvLut = {
  /** toạ độ canvas của góc trên-trái LUT */
  x: number; y: number;
  /** kích thước LUT (= printArea × ss) */
  width: number; height: number;
  /** hệ số siêu lấy mẫu (supersampling) */
  ss: number;
  /** [u0, v0, u1, v1, ...] ; -1 = không có smart object phủ */
  uv: Float32Array;
};

/**
 * Bảng tra ngược: với mỗi pixel trong vùng in → (u,v) trong smart object.
 * Cách làm: chia (u,v) thành lưới N×N, đẩy qua makeForwardMap, rồi raster từng tam giác
 * và nội suy barycentric (giống texture-mapping của GPU). Chỉ cần tính 1 lần cho mỗi mockup.
 */
export function buildUvLut(cfg: MockupConfig = MOCKUP, N = 96, ss = 2): UvLut {
  const fwd = makeForwardMap(cfg);
  const { x: rx, y: ry, width: rw, height: rh } = cfg.printArea;
  const W = rw * ss, Hh = rh * ss;
  const uv = new Float32Array(W * Hh * 2).fill(-1);

  // lưới đỉnh, quy đổi sang hệ toạ độ LUT (pixel LUT tâm tại +0.5)
  const PX = new Float64Array((N + 1) * (N + 1)), PY = new Float64Array((N + 1) * (N + 1));
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const [X, Y] = fwd(j / N, i / N);
    PX[i * (N + 1) + j] = (X - rx) * ss;
    PY[i * (N + 1) + j] = (Y - ry) * ss;
  }

  const raster = (a: number, b: number, c: number, ua: number, va: number, ub: number, vb: number, uc: number, vc: number) => {
    const x0 = PX[a], y0 = PY[a], x1 = PX[b], y1 = PY[b], x2 = PX[c], y2 = PY[c];
    const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
    const maxX = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
    const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
    const maxY = Math.min(Hh - 1, Math.ceil(Math.max(y0, y1, y2)));
    if (minX > maxX || minY > maxY) return;
    const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
    if (Math.abs(d) < 1e-12) return;
    for (let py = minY; py <= maxY; py++) {
      const gy = py + 0.5;
      for (let px = minX; px <= maxX; px++) {
        const gx = px + 0.5;
        const l0 = ((y1 - y2) * (gx - x2) + (x2 - x1) * (gy - y2)) / d;
        const l1 = ((y2 - y0) * (gx - x2) + (x0 - x2) * (gy - y2)) / d;
        const l2 = 1 - l0 - l1;
        if (l0 < -1e-6 || l1 < -1e-6 || l2 < -1e-6) continue;
        const o = (py * W + px) * 2;
        uv[o] = l0 * ua + l1 * ub + l2 * uc;
        uv[o + 1] = l0 * va + l1 * vb + l2 * vc;
      }
    }
  };

  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const p00 = i * (N + 1) + j, p01 = p00 + 1, p10 = p00 + N + 1, p11 = p10 + 1;
    const u0 = j / N, u1 = (j + 1) / N, v0 = i / N, v1 = (i + 1) / N;
    raster(p00, p01, p11, u0, v0, u1, v0, u1, v1);
    raster(p00, p11, p10, u0, v0, u1, v1, u0, v1);
  }
  return { x: rx, y: ry, width: W, height: Hh, ss, uv };
}
