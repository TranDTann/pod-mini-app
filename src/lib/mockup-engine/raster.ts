// Tiện ích ảnh thuần TS: resample, đặt ảnh vào khung nội dung smart object, mask, vector mask.

import type { RGBA, RasterMask, VectorMask } from './types';

/** Lấy mẫu vùng nguồn [sx,sy,sw,sh] (px, thực) vào vùng đích [dx,dy,dw,dh] của dst (premultiplied, lọc diện tích khi thu nhỏ, song tuyến khi phóng to). */
export function drawImage(dst: RGBA, src: RGBA, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number) {
  const D = dst.data, S = src.data, SW = src.width, SH = src.height;
  const x0 = Math.max(0, Math.floor(dx)), x1 = Math.min(dst.width, Math.ceil(dx + dw));
  const y0 = Math.max(0, Math.floor(dy)), y1 = Math.min(dst.height, Math.ceil(dy + dh));
  const kx = sw / dw, ky = sh / dh; // px nguồn trên 1 px đích
  const tap = (acc: number[], X: number, Y: number, w: number) => {
    if (X < 0 || Y < 0 || X >= SW || Y >= SH || w <= 0) return;
    const o = (Y * SW + X) * 4, a = (S[o + 3] / 255) * w;
    acc[0] += S[o] * a; acc[1] += S[o + 1] * a; acc[2] += S[o + 2] * a; acc[3] += a; acc[4] += w;
  };
  const acc = [0, 0, 0, 0, 0];
  for (let y = y0; y < y1; y++) {
    // độ phủ theo chiều dọc của pixel đích (cạnh mép đặt chính xác theo phần trăm)
    const covY = Math.min(y + 1, dy + dh) - Math.max(y, dy);
    if (covY <= 0) continue;
    for (let x = x0; x < x1; x++) {
      const covX = Math.min(x + 1, dx + dw) - Math.max(x, dx);
      if (covX <= 0) continue;
      acc.fill(0);
      // vùng nguồn tương ứng với pixel đích
      const fx0 = sx + (Math.max(x, dx) - dx) * kx, fx1 = sx + (Math.min(x + 1, dx + dw) - dx) * kx;
      const fy0 = sy + (Math.max(y, dy) - dy) * ky, fy1 = sy + (Math.min(y + 1, dy + dh) - dy) * ky;
      if (kx > 1 || ky > 1) {
        // thu nhỏ: trung bình diện tích (box filter chính xác theo phần pixel)
        for (let Y = Math.floor(fy0); Y < Math.ceil(fy1); Y++) {
          const wy = Math.min(Y + 1, fy1) - Math.max(Y, fy0);
          for (let X = Math.floor(fx0); X < Math.ceil(fx1); X++) {
            tap(acc, X, Y, (Math.min(X + 1, fx1) - Math.max(X, fx0)) * wy);
          }
        }
      } else {
        // phóng to: song tuyến tại tâm
        const cx = (fx0 + fx1) / 2 - 0.5, cy = (fy0 + fy1) / 2 - 0.5;
        const ix = Math.floor(cx), iy = Math.floor(cy), wx = cx - ix, wy = cy - iy;
        const X0 = Math.max(0, Math.min(SW - 1, ix)), X1 = Math.max(0, Math.min(SW - 1, ix + 1));
        const Y0 = Math.max(0, Math.min(SH - 1, iy)), Y1 = Math.max(0, Math.min(SH - 1, iy + 1));
        tap(acc, X0, Y0, (1 - wx) * (1 - wy)); tap(acc, X1, Y0, wx * (1 - wy));
        tap(acc, X0, Y1, (1 - wx) * wy); tap(acc, X1, Y1, wx * wy);
      }
      if (acc[4] <= 0) continue;
      const a = (acc[3] / acc[4]) * covX * covY; // alpha mới (có tính phần mép)
      const o = (y * dst.width + x) * 4;
      const da = D[o + 3] / 255;
      const ca = acc[3] > 0 ? 1 / acc[3] : 0;
      // ghép "over" lên dst
      const oa = a + da * (1 - a);
      if (oa <= 0) continue;
      for (let c = 0; c < 3; c++) {
        const sc = acc[c] * ca; // màu nguồn (straight)
        D[o + c] = Math.round((sc * a + D[o + c] * da * (1 - a)) / oa);
      }
      D[o + 3] = Math.round(oa * 255);
    }
  }
}

export type Fit = 'contain' | 'cover' | 'stretch' | 'none';
export type Align = 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/**
 * Cách đặt ảnh thiết kế vào khung nội dung smart object (vd 4200×4800 = vùng in 14×16 in @300 DPI).
 * - fit: contain (mặc định) | cover | stretch | none (giữ kích thước pixel gốc, có thể nhân `scale`)
 * - align: neo vị trí khi còn dư chỗ
 * - rect: đặt chính xác (px nội dung) — ưu tiên hơn fit/align
 * - offsetX/offsetY: dịch thêm (px nội dung), scale: nhân thêm kích thước
 */
export type Placement = { fit?: Fit; align?: Align; scale?: number; offsetX?: number; offsetY?: number; rect?: { x: number; y: number; width: number; height: number } };

export function placementRect(artW: number, artH: number, W: number, H: number, p: Placement = {}) {
  if (p.rect) return { ...p.rect };
  const fit = p.fit ?? 'contain';
  let w = artW, h = artH;
  if (fit === 'stretch') { w = W; h = H; }
  else if (fit !== 'none') {
    const s = fit === 'cover' ? Math.max(W / artW, H / artH) : Math.min(W / artW, H / artH);
    w = artW * s; h = artH * s;
  }
  w *= p.scale ?? 1; h *= p.scale ?? 1;
  const al = p.align ?? 'center';
  const x = al.includes('left') ? 0 : al.includes('right') ? W - w : (W - w) / 2;
  const y = al.startsWith('top') ? 0 : al.startsWith('bottom') ? H - h : (H - h) / 2;
  return { x: x + (p.offsetX ?? 0), y: y + (p.offsetY ?? 0), width: w, height: h };
}

/** DPI in thực tế của ảnh sau khi đặt (để cảnh báo ảnh vỡ khi in). */
export function effectiveDpi(artW: number, artH: number, contentW: number, contentH: number, contentDpi: number, p: Placement = {}) {
  const r = placementRect(artW, artH, contentW, contentH, p);
  return (artW / r.width) * contentDpi;
}

/** Tạo ảnh nội dung smart object ở độ phân giải thu nhỏ (tw×th) — toạ độ chuẩn hoá nên không mất chính xác hình học. */
export function buildContent(art: RGBA, W: number, H: number, tw: number, th: number, p: Placement = {}): RGBA {
  const out: RGBA = { width: tw, height: th, data: new Uint8ClampedArray(tw * th * 4) };
  const r = placementRect(art.width, art.height, W, H, p);
  const kx = tw / W, ky = th / H;
  drawImage(out, art, 0, 0, art.width, art.height, r.x * kx, r.y * ky, r.width * kx, r.height * ky);
  return out;
}

/** Mask dạng float 0..1 trên một khung, với giá trị bên ngoài khung. */
export type MaskField = { left: number; top: number; width: number; height: number; data: Float32Array; outside: number };

export function maskAt(m: MaskField, x: number, y: number) {
  const lx = x - m.left, ly = y - m.top;
  if (lx < 0 || ly < 0 || lx >= m.width || ly >= m.height) return m.outside;
  return m.data[ly * m.width + lx];
}

function blurField(f: MaskField, radius: number) {
  // xấp xỉ Gaussian bằng 3 lần box blur (sigma ≈ radius) — Feather của Photoshop chỉ xấp xỉ
  if (radius <= 0) return f;
  const pad = Math.ceil(radius * 3);
  const W = f.width + 2 * pad, H = f.height + 2 * pad;
  let a = new Float32Array(W * H).fill(f.outside);
  for (let y = 0; y < f.height; y++) a.set(f.data.subarray(y * f.width, (y + 1) * f.width), (y + pad) * W + pad);
  const box = Math.max(1, Math.round(Math.sqrt((12 * radius * radius) / 3 + 1)));
  const r = (box - 1) >> 1;
  const pass = (src: Float32Array, horiz: boolean) => {
    const dst = new Float32Array(W * H);
    const L = horiz ? W : H, M = horiz ? H : W;
    for (let m = 0; m < M; m++) {
      let s = 0;
      const at = (l: number) => src[horiz ? m * W + Math.max(0, Math.min(L - 1, l)) : Math.max(0, Math.min(L - 1, l)) * W + m];
      for (let l = -r; l <= r; l++) s += at(l);
      for (let l = 0; l < L; l++) {
        dst[horiz ? m * W + l : l * W + m] = s / (2 * r + 1);
        s += at(l + r + 1) - at(l - r);
      }
    }
    return dst;
  };
  for (let k = 0; k < 3; k++) a = pass(pass(a, true), false);
  return { left: f.left - pad, top: f.top - pad, width: W, height: H, data: a, outside: f.outside };
}

function applyDensity(f: MaskField, d?: number) {
  if (d === undefined || d >= 1) return f;
  for (let i = 0; i < f.data.length; i++) f.data[i] = 1 - d * (1 - f.data[i]);
  f.outside = 1 - d * (1 - f.outside);
  return f;
}

export function rasterMaskField(m: RasterMask, img: RGBA): MaskField {
  const data = new Float32Array(m.width * m.height);
  for (let i = 0; i < data.length; i++) data[i] = img.data[i * 4] / 255;
  let f: MaskField = { left: m.left, top: m.top, width: m.width, height: m.height, data, outside: m.defaultColor / 255 };
  f = applyDensity(f, m.density);
  return blurField(f, m.feather ?? 0);
}

// ---------- vector mask: làm phẳng Bezier rồi tô theo scanline, khử răng cưa 4×4 ----------
function flatten(knots: { points: number[] }[], closed: boolean) {
  const pts: number[] = [];
  const n = knots.length;
  if (!n) return pts;
  const segs = closed ? n : n - 1;
  pts.push(knots[0].points[2], knots[0].points[3]);
  for (let k = 0; k < segs; k++) {
    const A = knots[k].points, B = knots[(k + 1) % n].points;
    const p0x = A[2], p0y = A[3], p1x = A[4], p1y = A[5], p2x = B[0], p2y = B[1], p3x = B[2], p3y = B[3];
    const len = Math.hypot(p1x - p0x, p1y - p0y) + Math.hypot(p2x - p1x, p2y - p1y) + Math.hypot(p3x - p2x, p3y - p2y);
    const steps = Math.max(1, Math.min(200, Math.ceil(len / 2)));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, s = 1 - t;
      const a = s * s * s, b = 3 * s * s * t, c = 3 * s * t * t, d = t * t * t;
      pts.push(a * p0x + b * p1x + c * p2x + d * p3x, a * p0y + b * p1y + c * p2y + d * p3y);
    }
  }
  return pts;
}

function coverage(poly: number[], evenOdd: boolean, left: number, top: number, W: number, H: number) {
  // 16 hàng con theo chiều dọc + độ phủ chính xác theo chiều ngang → khử răng cưa gần như theo diện tích
  const out = new Float32Array(W * H);
  const SUB = 16;
  const n = poly.length / 2;
  const xs: { x: number; w: number }[] = [];
  for (let py = 0; py < H; py++) for (let sy = 0; sy < SUB; sy++) {
    const y = top + py + (sy + 0.5) / SUB;
    xs.length = 0;
    for (let i = 0; i < n; i++) {
      const ax = poly[2 * i], ay = poly[2 * i + 1], bx = poly[2 * ((i + 1) % n)], by = poly[2 * ((i + 1) % n) + 1];
      if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push({ x: ax + ((y - ay) / (by - ay)) * (bx - ax), w: by > ay ? 1 : -1 });
    }
    xs.sort((p, q) => p.x - q.x);
    let wind = 0;
    for (let k = 0; k + 1 < xs.length; k++) {
      wind += xs[k].w;
      const inside = evenOdd ? k % 2 === 0 : wind !== 0;
      if (!inside) continue;
      const xa = Math.max(0, xs[k].x - left), xb = Math.min(W, xs[k + 1].x - left);
      if (xb <= xa) continue;
      const pxA = Math.floor(xa), pxB = Math.min(W - 1, Math.floor(xb));
      for (let px = pxA; px <= pxB; px++) {
        const c = Math.min(px + 1, xb) - Math.max(px, xa);
        if (c > 0) out[py * W + px] += c / SUB;
      }
    }
  }
  return out;
}

export function vectorMaskField(v: VectorMask, canvasW: number, canvasH: number): MaskField | null {
  if (v.disabled) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const polys = v.paths.map(p => {
    const pts = flatten(p.knots, !p.open);
    for (let i = 0; i < pts.length; i += 2) { x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]); y0 = Math.min(y0, pts[i + 1]); y1 = Math.max(y1, pts[i + 1]); }
    return pts;
  });
  const start = v.fillStartsWithAllPixels ? 1 : 0;
  let outside = start;
  for (const p of v.paths) if (p.operation === 'intersect') outside = 0;
  if (!isFinite(x0)) { x0 = 0; y0 = 0; x1 = 0; y1 = 0; }
  const L = Math.max(0, Math.floor(x0)), T = Math.max(0, Math.floor(y0));
  const W = Math.max(0, Math.min(canvasW, Math.ceil(x1)) - L), H = Math.max(0, Math.min(canvasH, Math.ceil(y1)) - T);
  const acc = new Float32Array(W * H).fill(start);
  v.paths.forEach((p, i) => {
    const cov = coverage(polys[i], p.fillRule === 'even-odd', L, T, W, H);
    for (let k = 0; k < acc.length; k++) {
      const a = acc[k], b = Math.min(1, cov[k]);
      acc[k] = p.operation === 'subtract' ? a * (1 - b) : p.operation === 'intersect' ? a * b
        : p.operation === 'xor' || p.operation === 'exclude' ? a + b - 2 * a * b : a + b - a * b;
    }
  });
  let f: MaskField = { left: L, top: T, width: W, height: H, data: acc, outside };
  if (v.invert) { for (let k = 0; k < acc.length; k++) acc[k] = 1 - acc[k]; f.outside = 1 - outside; }
  f = applyDensity(f, v.density);
  return blurField(f, v.feather ?? 0);
}

// ---------- resample chất lượng cao (Lanczos3, tách 2 chiều, premultiplied) ----------
function lanczosWeights(srcLen: number, srcStart: number, srcSpan: number, dstLen: number) {
  // ánh xạ pixel đích i → vùng nguồn [srcStart, srcStart+srcSpan)
  const scale = srcSpan / dstLen, support = 3 * Math.max(1, scale), fscale = Math.max(1, scale);
  const idx: Int32Array[] = [], wts: Float32Array[] = [];
  const lz = (x: number) => { if (x === 0) return 1; if (Math.abs(x) >= 3) return 0; const px = Math.PI * x; return (3 * Math.sin(px) * Math.sin(px / 3)) / (px * px); };
  for (let i = 0; i < dstLen; i++) {
    const c = srcStart + (i + 0.5) * scale - 0.5;
    const a = Math.ceil(c - support), b = Math.floor(c + support);
    const ii: number[] = [], ww: number[] = [];
    let sum = 0;
    for (let j = a; j <= b; j++) {
      const w = lz((j - c) / fscale);
      if (w === 0) continue;
      const jj = Math.max(0, Math.min(srcLen - 1, j)); // biên: lặp điểm mép
      ii.push(jj); ww.push(w); sum += w;
    }
    idx.push(Int32Array.from(ii)); wts.push(Float32Array.from(ww.map(w => w / (sum || 1))));
  }
  return { idx, wts };
}

/** Cắt vùng [sx,sy,sw,sh] (px thực) của ảnh và resample thành dw×dh bằng Lanczos3. */
export function resampleLanczos(src: RGBA, sx: number, sy: number, sw: number, sh: number, dw: number, dh: number): RGBA {
  const S = src.data, W = src.width;
  const hx = lanczosWeights(src.width, sx, sw, dw), hy = lanczosWeights(src.height, sy, sh, dh);
  // chỉ cần các hàng nguồn mà bước dọc dùng tới
  let ry0 = src.height, ry1 = -1;
  for (const ii of hy.idx) for (const j of ii) { if (j < ry0) ry0 = j; if (j > ry1) ry1 = j; }
  const rows = Math.max(0, ry1 - ry0 + 1);
  const tmp = new Float32Array(rows * dw * 4);
  for (let y = 0; y < rows; y++) {
    const so = (y + ry0) * W;
    for (let x = 0; x < dw; x++) {
      const ii = hx.idx[x], ww = hx.wts[x];
      let r = 0, g = 0, b = 0, a = 0;
      for (let k = 0; k < ii.length; k++) {
        const q = (so + ii[k]) * 4, al = (S[q + 3] / 255) * ww[k];
        r += S[q] * al; g += S[q + 1] * al; b += S[q + 2] * al; a += al;
      }
      const o = (y * dw + x) * 4;
      tmp[o] = r; tmp[o + 1] = g; tmp[o + 2] = b; tmp[o + 3] = a;
    }
  }
  const out = new Uint8ClampedArray(dw * dh * 4);
  for (let y = 0; y < dh; y++) {
    const ii = hy.idx[y], ww = hy.wts[y];
    for (let x = 0; x < dw; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let k = 0; k < ii.length; k++) {
        const q = ((ii[k] - ry0) * dw + x) * 4, w = ww[k];
        r += tmp[q] * w; g += tmp[q + 1] * w; b += tmp[q + 2] * w; a += tmp[q + 3] * w;
      }
      const o = (y * dw + x) * 4, A = Math.min(1, Math.max(0, a));
      out[o + 3] = Math.round(A * 255);
      if (A > 0) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; }
    }
  }
  return { width: dw, height: dh, data: out };
}

/**
 * Texture cho smart object từ ảnh thiết kế + cách đặt.
 * density = px ảnh texture trên 1 px nội dung mong muốn (tối đa); ảnh chỉ bị thu nhỏ, không phóng to.
 * Phần ảnh nằm ngoài khung nội dung bị cắt bỏ (giống Photoshop: nội dung SO chỉ có W×H).
 */
export function makeTexture(art: RGBA, W: number, H: number, p: Placement, densityX: number, densityY: number) {
  const r = placementRect(art.width, art.height, W, H, p);
  const kx = art.width / r.width, ky = art.height / r.height; // px ảnh / px nội dung
  // phần nhìn thấy trong khung nội dung
  const cx0 = Math.max(0, r.x), cy0 = Math.max(0, r.y), cx1 = Math.min(W, r.x + r.width), cy1 = Math.min(H, r.y + r.height);
  if (cx1 <= cx0 || cy1 <= cy0) return { img: { width: 1, height: 1, data: new Uint8ClampedArray(4) }, x0: 0, y0: 0, kx: 1, ky: 1 };
  const ax0 = (cx0 - r.x) * kx, ay0 = (cy0 - r.y) * ky, aw = (cx1 - cx0) * kx, ah = (cy1 - cy0) * ky;
  const tx = Math.min(kx, densityX), ty = Math.min(ky, densityY);
  const dw = Math.max(1, Math.round((cx1 - cx0) * tx)), dh = Math.max(1, Math.round((cy1 - cy0) * ty));
  const exact = Math.abs(dw - aw) < 1e-6 && Math.abs(dh - ah) < 1e-6 && ax0 === 0 && ay0 === 0;
  const img = exact ? art : resampleLanczos(art, ax0, ay0, aw, ah, dw, dh);
  return { img, x0: cx0, y0: cy0, kx: dw / (cx1 - cx0), ky: dh / (cy1 - cy0) };
}
