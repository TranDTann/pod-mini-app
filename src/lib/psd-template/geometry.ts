import type { Pt, Quad, Rect } from './types';

/** Ánh xạ hình vuông đơn vị (u,v ∈ [0,1]) → tứ giác bất kỳ (homography). Dùng cho smart object bị perspective. */
export function squareToQuad(q: Quad): (u: number, v: number) => Pt {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let g = 0, h = 0;
  if (Math.abs(dx3) > 1e-6 || Math.abs(dy3) > 1e-6) {
    const den = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / den;
    h = (dx1 * dy3 - dx3 * dy1) / den;
  }
  const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, c = x0;
  const d = y1 - y0 + g * y1, e = y3 - y0 + h * y3, f = y0;
  return (u, v) => {
    const w = g * u + h * v + 1;
    return [(a * u + b * v + c) / w, (d * u + e * v + f) / w];
  };
}

export function isParallelogram(q: Quad, tol = 0.5): boolean {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  return Math.abs(x0 - x1 + x2 - x3) < tol && Math.abs(y0 - y1 + y2 - y3) < tol;
}

export function quadFromArray(t: number[]): Quad {
  return [[t[0], t[1]], [t[2], t[3]], [t[4], t[5]], [t[6], t[7]]];
}

export function rectToQuad([l, t, r, b]: Rect): Quad {
  return [[l, t], [r, t], [r, b], [l, b]];
}

export function quadBounds(q: Quad): Rect {
  const xs = q.map((p) => p[0]), ys = q.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

export function quadSize(q: Quad): { width: number; height: number } {
  const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  return { width: (dist(q[0], q[1]) + dist(q[3], q[2])) / 2, height: (dist(q[0], q[3]) + dist(q[1], q[2])) / 2 };
}

export function iou(a: Rect, b: Rect): number {
  const ix = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  const iy = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const inter = ix * iy;
  const area = (r: Rect) => Math.max(0, r[2] - r[0]) * Math.max(0, r[3] - r[1]);
  const uni = area(a) + area(b) - inter;
  return uni > 0 ? inter / uni : 0;
}

function bernstein(n: number, i: number, t: number): number {
  let c = 1;
  for (let k = 1; k <= i; k++) c = (c * (n - k + 1)) / k;
  return c * t ** i * (1 - t) ** (n - i);
}

/** Đánh giá mặt Bézier (mesh warp của Photoshop) tại (u,v). points: rows×cols, theo hàng. */
export function bezierPatch(points: Pt[], cols: number, rows: number): (u: number, v: number) => Pt {
  return (u, v) => {
    let x = 0, y = 0;
    for (let i = 0; i < rows; i++) {
      const bv = bernstein(rows - 1, i, v);
      for (let j = 0; j < cols; j++) {
        const w = bv * bernstein(cols - 1, j, u);
        const p = points[i * cols + j];
        x += w * p[0];
        y += w * p[1];
      }
    }
    return [x, y];
  };
}
