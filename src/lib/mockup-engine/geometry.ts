// Hình học smart object kiểu Photoshop: perspective (nonAffineTransform) + warp lưới Bezier từng mảnh.
//
// Với điểm (x, y) trong không gian nội dung (bounds):
//   1. chọn mảnh (i, j) sao cho sliceY[i] ≤ y ≤ sliceY[i+1], sliceX[j] ≤ x ≤ sliceX[j+1]
//      s = (x − sliceX[j]) / (sliceX[j+1] − sliceX[j]),  t = (y − sliceY[i]) / (sliceY[i+1] − sliceY[i])
//   2. điểm điều khiển P[r][c] (r = 3i..3i+3, c = 3j..3j+3)
//   3. chuẩn hoá theo bbox của TOÀN BỘ điểm lưới:  n = (P − min) / (max − min)
//   4. chiếu perspective: C = H(n), H: hình vuông đơn vị → quad
//   5. Q(x, y) = Σa Σb B_a(t) · B_b(s) · C[3i+a][3j+b]          (B = Bernstein bậc 3)
// Bước 3–5 đã được kiểm chứng với raster do chính Photoshop render (xem README).

import type { Geometry, RGBA } from './types';

export type Homography = { a: number; b: number; c: number; d: number; e: number; f: number; g: number; h: number };

/** Homography hình vuông đơn vị → tứ giác (Heckbert 1989). q = [x0,y0, x1,y1, x2,y2, x3,y3] = TL,TR,BR,BL. */
export function squareToQuad(q: ArrayLike<number>): Homography {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = Array.from(q);
  const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
  if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) {
    return { a: x1 - x0, b: x3 - x0, c: x0, d: y1 - y0, e: y3 - y0, f: y0, g: 0, h: 0 };
  }
  const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / den, h = (dx1 * sy - sx * dy1) / den;
  return { a: x1 - x0 + g * x1, b: x3 - x0 + h * x3, c: x0, d: y1 - y0 + g * y1, e: y3 - y0 + h * y3, f: y0, g, h };
}

export function applyH(H: Homography, s: number, t: number): [number, number] {
  const w = H.g * s + H.h * t + 1;
  return [(H.a * s + H.b * t + H.c) / w, (H.d * s + H.e * t + H.f) / w];
}

/** Điểm điều khiển trên canvas (bước 3 + 4). */
export function canvasControlPoints(g: Geometry): { cx: Float64Array; cy: Float64Array } {
  let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  for (let k = 0; k < g.meshX.length; k++) {
    const x = g.meshX[k], y = g.meshY[k];
    if (x < xmin) xmin = x; if (x > xmax) xmax = x; if (y < ymin) ymin = y; if (y > ymax) ymax = y;
  }
  const H = squareToQuad(g.quad);
  const n = g.meshX.length, cx = new Float64Array(n), cy = new Float64Array(n);
  const sw = xmax - xmin || 1, sh = ymax - ymin || 1;
  for (let k = 0; k < n; k++) {
    const p = applyH(H, (g.meshX[k] - xmin) / sw, (g.meshY[k] - ymin) / sh);
    cx[k] = p[0]; cy[k] = p[1];
  }
  return { cx, cy };
}

function bern(t: number, o: Float64Array) {
  const s = 1 - t;
  o[0] = s * s * s; o[1] = 3 * s * s * t; o[2] = 3 * s * t * t; o[3] = t * t * t;
}

/** Ánh xạ thuận: toạ độ nội dung (px, theo bounds) → canvas. */
export function makeForward(g: Geometry) {
  const { cx, cy } = canvasControlPoints(g);
  const nX = g.sliceX.length - 1, nY = g.sliceY.length - 1, cols = g.cols;
  const bs = new Float64Array(4), bt = new Float64Array(4);
  const find = (sl: number[], v: number, n: number) => {
    let j = 0;
    while (j < n - 1 && v > sl[j + 1]) j++;
    return j;
  };
  return (x: number, y: number): [number, number] => {
    const j = find(g.sliceX, x, nX), i = find(g.sliceY, y, nY);
    const s = (x - g.sliceX[j]) / (g.sliceX[j + 1] - g.sliceX[j]);
    const t = (y - g.sliceY[i]) / (g.sliceY[i + 1] - g.sliceY[i]);
    bern(s, bs); bern(t, bt);
    let X = 0, Y = 0;
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
      const w = bt[a] * bs[b], k = (3 * i + a) * cols + 3 * j + b;
      X += w * cx[k]; Y += w * cy[k];
    }
    return [X, Y];
  };
}

export type DenseMesh = {
  nu: number; nv: number;          // số đỉnh theo u, v
  u: Float64Array; v: Float64Array; // toạ độ nội dung chuẩn hoá theo bounds (có thể <0 hoặc >1 ở dải lề)
  X: Float64Array; Y: Float64Array; // toạ độ canvas
  bbox: [number, number, number, number];
  scaleU: number; scaleV: number;   // px canvas trên 1 px nội dung (trung bình) theo u, v
};

/** Warp có thật sự uốn không (khác lưới đều)? Photoshop dùng 2 bộ lấy mẫu khác nhau cho 2 trường hợp. */
export function isIdentityWarp(g: Geometry) {
  if (g.rows !== 4 || g.cols !== 4) return false;
  const [bl, bt, br, bb] = g.bounds, tol = 1e-6 * Math.max(br - bl, bb - bt);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    const k = r * 4 + c;
    if (Math.abs(g.meshX[k] - (bl + (c / 3) * (br - bl))) > tol || Math.abs(g.meshY[k] - (bt + (r / 3) * (bb - bt))) > tol) return false;
  }
  return true;
}

/**
 * Lưới dày (mỗi mảnh chia k×k) — đỉnh chung giữa các mảnh trùng khít nên không hở.
 * marginPx: kéo dài lưới ra ngoài mép nội dung (ngoại suy đa thức Bezier) để bộ lọc
 * bicubic tạo mép khử răng cưa giống Photoshop.
 */
export function denseMesh(g: Geometry, maxEdgePx = 3, marginPx = 0): DenseMesh {
  const fwd = makeForward(g);
  const nX = g.sliceX.length - 1, nY = g.sliceY.length - 1;
  const [bl, bt, br, bb] = g.bounds;
  const pick = (len: number) => Math.max(4, Math.min(256, Math.ceil(len / maxEdgePx)));
  const segX: number[] = [], segY: number[] = [];
  for (let j = 0; j < nX; j++) {
    const ym = (g.sliceY[0] + g.sliceY[nY]) / 2;
    const p0 = fwd(g.sliceX[j], ym), p1 = fwd(g.sliceX[j + 1], ym);
    segX.push(pick(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) * 1.5));
  }
  for (let i = 0; i < nY; i++) {
    const xm = (g.sliceX[0] + g.sliceX[nX]) / 2;
    const p0 = fwd(xm, g.sliceY[i]), p1 = fwd(xm, g.sliceY[i + 1]);
    segY.push(pick(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) * 1.5));
  }
  const xsrc: number[] = [], ysrc: number[] = [];
  if (marginPx > 0) xsrc.push(g.sliceX[0] - marginPx);
  for (let j = 0; j < nX; j++) for (let k = 0; k < segX[j]; k++) xsrc.push(g.sliceX[j] + (k / segX[j]) * (g.sliceX[j + 1] - g.sliceX[j]));
  xsrc.push(g.sliceX[nX]);
  if (marginPx > 0) { xsrc.push(g.sliceX[nX] + marginPx); ysrc.push(g.sliceY[0] - marginPx); }
  for (let i = 0; i < nY; i++) for (let k = 0; k < segY[i]; k++) ysrc.push(g.sliceY[i] + (k / segY[i]) * (g.sliceY[i + 1] - g.sliceY[i]));
  ysrc.push(g.sliceY[nY]);
  if (marginPx > 0) ysrc.push(g.sliceY[nY] + marginPx);
  const nu = xsrc.length, nv = ysrc.length, N = nu * nv;
  const u = new Float64Array(N), v = new Float64Array(N), X = new Float64Array(N), Y = new Float64Array(N);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let r = 0; r < nv; r++) for (let c = 0; c < nu; c++) {
    const k = r * nu + c;
    const p = fwd(xsrc[c], ysrc[r]);
    u[k] = (xsrc[c] - bl) / (br - bl); v[k] = (ysrc[r] - bt) / (bb - bt);
    X[k] = p[0]; Y[k] = p[1];
    if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
  }
  let su = 0, sv = 0, nsu = 0, nsv = 0;
  for (let r = 0; r < nv; r++) for (let c = 0; c + 1 < nu; c++) {
    const k = r * nu + c, du = (u[k + 1] - u[k]) * g.contentWidth;
    if (du > 0) { su += Math.hypot(X[k + 1] - X[k], Y[k + 1] - Y[k]) / du; nsu++; }
  }
  for (let r = 0; r + 1 < nv; r++) for (let c = 0; c < nu; c++) {
    const k = r * nu + c, dv = (v[k + nu] - v[k]) * g.contentHeight;
    if (dv > 0) { sv += Math.hypot(X[k + nu] - X[k], Y[k + nu] - Y[k]) / dv; nsv++; }
  }
  return { nu, nv, u, v, X, Y, bbox: [x0, y0, x1, y1], scaleU: su / Math.max(1, nsu), scaleV: sv / Math.max(1, nsv) };
}

/** Ảnh làm texture cho nội dung smart object: px nội dung (X,Y) → px ảnh ((X − x0)·kx, (Y − y0)·ky). */
export type Texture = { img: RGBA; x0: number; y0: number; kx: number; ky: number };

// Bicubic Catmull-Rom (a = −0.5) — khớp raster Photoshop tốt nhất trong các phép thử
function cubicW(t: number) {
  t = Math.abs(t);
  return t <= 1 ? 1.5 * t * t * t - 2.5 * t * t + 1 : t < 2 ? -0.5 * t * t * t + 2.5 * t * t - 4 * t + 2 : 0;
}

/**
 * Render nội dung qua lưới (texture mapping).
 * filter 'bicubic' + ss 1  = cách Photoshop render smart object (mặc định)
 * filter 'bilinear' + ss 3 = chế độ khử răng cưa mạnh (mịn hơn Photoshop)
 * Trả về ảnh premultiplied Float32 trong khung trên canvas.
 */
export function renderWarped(mesh: DenseMesh, tex: Texture, contentW: number, contentH: number, canvasW: number, canvasH: number, opts: { ss?: number; filter?: 'bicubic' | 'bilinear' } = {}) {
  const ss = opts.ss ?? 1, bicubic = (opts.filter ?? 'bicubic') === 'bicubic';
  const x0 = Math.max(0, Math.floor(mesh.bbox[0])), y0 = Math.max(0, Math.floor(mesh.bbox[1]));
  const x1 = Math.min(canvasW, Math.ceil(mesh.bbox[2])), y1 = Math.min(canvasH, Math.ceil(mesh.bbox[3]));
  const W = Math.max(0, x1 - x0), H = Math.max(0, y1 - y0);
  const out = new Float32Array(W * H * 4);
  if (!W || !H) return { left: x0, top: y0, width: W, height: H, data: out };

  const { nu, nv, X, Y, u, v } = mesh;
  const T = 128;
  const tilesX = Math.ceil(W / T), tilesY = Math.ceil(H / T);
  const bins: number[][] = Array.from({ length: tilesX * tilesY }, () => []);
  const tri: number[] = [];
  for (let r = 0; r + 1 < nv; r++) for (let c = 0; c + 1 < nu; c++) {
    const a = r * nu + c, b = a + 1, d = a + nu, e = d + 1;
    tri.push(a, b, e, a, e, d);
  }
  for (let t = 0; t < tri.length; t += 3) {
    const ia = tri[t], ib = tri[t + 1], ic = tri[t + 2];
    const mnx = Math.min(X[ia], X[ib], X[ic]) - x0, mxx = Math.max(X[ia], X[ib], X[ic]) - x0;
    const mny = Math.min(Y[ia], Y[ib], Y[ic]) - y0, mxy = Math.max(Y[ia], Y[ib], Y[ic]) - y0;
    const tx0 = Math.max(0, Math.floor(mnx / T)), tx1 = Math.min(tilesX - 1, Math.floor(mxx / T));
    const ty0 = Math.max(0, Math.floor(mny / T)), ty1 = Math.min(tilesY - 1, Math.floor(mxy / T));
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) bins[ty * tilesX + tx].push(t);
  }

  const { img, x0: tx0c, y0: ty0c, kx, ky } = tex;
  const cw = img.width, ch = img.height, cd = img.data;
  const S = T * ss;
  const lutU = new Float32Array(S * S), lutV = new Float32Array(S * S);
  const wxs = new Float64Array(4), wys = new Float64Array(4);
  let r = 0, g = 0, b = 0, a = 0;
  const sample = (uu: number, vv: number) => {
    const fx = (uu * contentW - tx0c) * kx - 0.5, fy = (vv * contentH - ty0c) * ky - 0.5;
    const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    if (bicubic) {
      if (ix + 2 < 0 || iy + 2 < 0 || ix - 1 >= cw || iy - 1 >= ch) return;
      for (let k = 0; k < 4; k++) { wxs[k] = cubicW(tx - (k - 1)); wys[k] = cubicW(ty - (k - 1)); }
      for (let m = 0; m < 4; m++) {
        const qy = iy + m - 1; if (qy < 0 || qy >= ch) continue;
        for (let k = 0; k < 4; k++) {
          const qx = ix + k - 1; if (qx < 0 || qx >= cw) continue;
          const q = (qy * cw + qx) * 4, w = wxs[k] * wys[m], al = (cd[q + 3] / 255) * w;
          r += cd[q] * al; g += cd[q + 1] * al; b += cd[q + 2] * al; a += al;
        }
      }
    } else {
      for (let k = 0; k < 4; k++) {
        const qx = ix + (k & 1), qy = iy + (k >> 1);
        if (qx < 0 || qy < 0 || qx >= cw || qy >= ch) continue;
        const w = ((k & 1) ? tx : 1 - tx) * ((k >> 1) ? ty : 1 - ty);
        const q = (qy * cw + qx) * 4, al = (cd[q + 3] / 255) * w;
        r += cd[q] * al; g += cd[q + 1] * al; b += cd[q + 2] * al; a += al;
      }
    }
  };
  for (let ty = 0; ty < tilesY; ty++) for (let tx = 0; tx < tilesX; tx++) {
    const list = bins[ty * tilesX + tx];
    if (!list.length) continue;
    lutU.fill(NaN);
    const ox = x0 + tx * T, oy = y0 + ty * T;
    const tw = Math.min(T, W - tx * T), th = Math.min(T, H - ty * T);
    const sw = tw * ss, sh = th * ss;
    for (const t of list) {
      const ia = tri[t], ib = tri[t + 1], ic = tri[t + 2];
      const ax = (X[ia] - ox) * ss, ay = (Y[ia] - oy) * ss, bx = (X[ib] - ox) * ss, by = (Y[ib] - oy) * ss, cx = (X[ic] - ox) * ss, cy = (Y[ic] - oy) * ss;
      const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx))), maxX = Math.min(sw - 1, Math.ceil(Math.max(ax, bx, cx)));
      const minY = Math.max(0, Math.floor(Math.min(ay, by, cy))), maxY = Math.min(sh - 1, Math.ceil(Math.max(ay, by, cy)));
      if (minX > maxX || minY > maxY) continue;
      const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
      if (Math.abs(den) < 1e-12) continue;
      const ua = u[ia], ub = u[ib], uc = u[ic], va = v[ia], vb = v[ib], vc = v[ic];
      for (let py = minY; py <= maxY; py++) {
        const gy = py + 0.5;
        for (let px = minX; px <= maxX; px++) {
          const gx = px + 0.5;
          const l0 = ((by - cy) * (gx - cx) + (cx - bx) * (gy - cy)) / den;
          const l1 = ((cy - ay) * (gx - cx) + (ax - cx) * (gy - cy)) / den;
          const l2 = 1 - l0 - l1;
          if (l0 < -1e-7 || l1 < -1e-7 || l2 < -1e-7) continue;
          const o = py * S + px;
          lutU[o] = l0 * ua + l1 * ub + l2 * uc;
          lutV[o] = l0 * va + l1 * vb + l2 * vc;
        }
      }
    }
    const inv = 1 / (ss * ss);
    for (let py = 0; py < th; py++) for (let px = 0; px < tw; px++) {
      r = g = b = a = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const o = (py * ss + sy) * S + (px * ss + sx);
        const uu = lutU[o];
        if (uu !== uu) continue; // NaN = không có lưới phủ
        sample(uu, lutV[o]);
      }
      const o = ((ty * T + py) * W + (tx * T + px)) * 4;
      // bicubic có thể vượt [0,1] — kẹp như Photoshop
      const A = Math.min(1, Math.max(0, a * inv));
      out[o + 3] = A;
      const k = A > 0 && a > 0 ? A / (a * inv) : 0;
      out[o] = Math.min(A, Math.max(0, (r / 255) * inv * k));
      out[o + 1] = Math.min(A, Math.max(0, (g / 255) * inv * k));
      out[o + 2] = Math.min(A, Math.max(0, (b / 255) * inv * k));
    }
  }
  return { left: x0, top: y0, width: W, height: H, data: out };
}
