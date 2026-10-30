// Bộ ghép layer theo mô hình Photoshop, xử lý theo từng hàng pixel (ít bộ nhớ, chạy được trên trình duyệt).
//
// Quy tắc:
// • Layer thường:  α = α_pixel · mask · vectorMask · opacity · fill, rồi blend "source-over" với mode của layer.
// • Clipping mask (Blend Clipped Layers as Group = bật, mặc định):
//     unit = layer gốc (alpha = hình dạng S của layer gốc, gồm cả mask)
//     từng layer clip trộn THẲNG vào màu của unit:  Cu ← (1 − αL)·Cu + αL·B(Cu, CL), alpha unit giữ nguyên = S
//     (giống vẽ lên layer có khoá trong suốt — kiểm chứng bằng composite Photoshop, lệch ≤ 1.3/255)
//     sau đó unit ghép xuống nền bằng mode + opacity của layer gốc.
// • Adjustment layer: nguồn = adj(màu nền) tại chính pixel đó, trộn kiểu như trên (không đổi alpha nền).
// • Group Pass Through: các layer con ghép thẳng lên nền; nếu group có opacity/mask:
//     kết quả = lerp(nền, nền_đã_ghép_con, opacity · mask).
// • Group thường (Normal/Multiply/...): ghép con trên nền trong suốt (cô lập), rồi blend cả group xuống.

import { blendPixel, SEPARABLE, UNCLAMPED } from './blend';
import type { ColorFn } from './adjust';
import type { BlendMode, SpecNode } from './types';
import { maskAt, type MaskField } from './raster';

export type Content =
  | { kind: 'u8'; left: number; top: number; width: number; height: number; data: Uint8ClampedArray | Uint8Array }
  | { kind: 'f32'; left: number; top: number; width: number; height: number; data: Float32Array }
  | { kind: 'solid'; color: [number, number, number] };

export type PNode = {
  spec: SpecNode;
  hidden: boolean;
  mode: BlendMode;
  opacity: number;
  fill: number;
  clipping: boolean;
  bcag: boolean;
  content?: Content;
  masks: MaskField[];
  children?: PNode[];
  rect: [number, number, number, number]; // vùng có thể ảnh hưởng (x0,y0,x1,y1)
  /** Blend If: [đen0, đen1, trắng0, trắng1] cho Gray và từng kênh R,G,B — nguồn (layer) và đích (bên dưới) */
  blendIf?: { src: number[][]; dst: number[][] };
  /** adjustment layer: hàm đổi màu */
  adjust?: ColorFn | null;
};

const lumGray = (r: number, g: number, b: number) => 0.3 * r + 0.59 * g + 0.11 * b;
function rangeW(v: number, r: number[]) {
  const [b0, b1, w0, w1] = r;
  if (v < b0 || v > w1) return 0;
  if (v < b1) return (v - b0) / (b1 - b0);
  if (v > w0) return (w1 - v) / (w1 - w0);
  return 1;
}
/** Nhân alpha theo Blend If (giá trị 0..255). */
function applyBlendIf(p: PNode, row: Float32Array, C: Float32Array, A: Float32Array, n: number) {
  const bi = p.blendIf!;
  for (let i = 0; i < n; i++) {
    if (A[i] <= 0) continue;
    const r = C[i * 3] * 255, g = C[i * 3 + 1] * 255, b = C[i * 3 + 2] * 255;
    const ab = row[i * 4 + 3], k = ab > 0 ? 255 / ab : 0;
    const R = row[i * 4] * k, G = row[i * 4 + 1] * k, B = row[i * 4 + 2] * k;
    // "This Layer"
    let ws = rangeW(lumGray(r, g, b), bi.src[0]);
    const s3 = [r, g, b], d3 = [R, G, B];
    for (let c = 0; c < 3 && ws > 0; c++) ws *= rangeW(s3[c], bi.src[c + 1]);
    // "Underlying Layer" — chỉ có tác dụng theo độ phủ của nền (nền trong suốt → không có gì để so)
    let wd = rangeW(lumGray(R, G, B), bi.dst[0]);
    for (let c = 0; c < 3 && wd > 0; c++) wd *= rangeW(d3[c], bi.dst[c + 1]);
    const w = ws * (1 - row[i * 4 + 3] * (1 - wd));
    A[i] *= w;
  }
}

/** Ghép mode đặc biệt khi Fill < 100%: trộn theo fill trước khi kẹp, rồi mới áp Opacity. */
function overSpecialFill(dst: Float32Array, C: Float32Array, A: Float32Array, n: number, mode: BlendMode, opacity: number) {
  const f = UNCLAMPED[mode]!;
  for (let i = 0; i < n; i++) {
    const as = A[i];
    if (as <= 0) continue;
    const o = i * 4, ab = dst[o + 3];
    const ao = as + ab * (1 - as);
    const inv = ab > 0 ? 1 / ab : 0;
    for (let c = 0; c < 3; c++) {
      const Cb = dst[o + c] * inv, Cs = C[i * 3 + c];
      const co = as * (1 - ab) * Cs + as * ab * f(Cb, Cs) + (1 - as) * ab * Cb;
      const straight = Math.min(1, Math.max(0, co / ao));
      dst[o + c] = dst[o + c] + opacity * (straight * ao - dst[o + c]);
    }
    dst[o + 3] = ab + opacity * (ao - ab);
  }
}

// ---------- bộ đệm tạm ----------
const pool: Float32Array[] = [];
const take = (n: number) => {
  for (let i = pool.length - 1; i >= 0; i--) if (pool[i].length >= n) { const b = pool[i]; pool.splice(i, 1); b.fill(0, 0, n); return b; }
  return new Float32Array(n);
};
const give = (...b: Float32Array[]) => { pool.push(...b); if (pool.length > 64) pool.splice(0, pool.length - 64); };

const tmpB = [0, 0, 0], tmpS = [0, 0, 0], tmpO = [0, 0, 0];

/** Ghép (C,A) lên dst (premultiplied) bằng source-over + blend mode. */
function over(dst: Float32Array, C: Float32Array, A: Float32Array, n: number, mode: BlendMode) {
  const sep = SEPARABLE[mode];
  for (let i = 0; i < n; i++) {
    const as = A[i];
    if (as <= 0) continue;
    const o = i * 4, ab = dst[o + 3];
    if (mode === 'normal' || mode === 'dissolve' || ab <= 0) {
      dst[o] = C[i * 3] * as + dst[o] * (1 - as);
      dst[o + 1] = C[i * 3 + 1] * as + dst[o + 1] * (1 - as);
      dst[o + 2] = C[i * 3 + 2] * as + dst[o + 2] * (1 - as);
      dst[o + 3] = as + ab * (1 - as);
      continue;
    }
    const inv = 1 / ab;
    for (let c = 0; c < 3; c++) { tmpB[c] = dst[o + c] * inv; tmpS[c] = C[i * 3 + c]; }
    if (sep) for (let c = 0; c < 3; c++) tmpO[c] = sep(tmpB[c], tmpS[c]);
    else blendPixel(mode, tmpB, tmpS, tmpO);
    for (let c = 0; c < 3; c++) {
      dst[o + c] = as * (1 - ab) * tmpS[c] + as * ab * tmpO[c] + (1 - as) * dst[o + c];
    }
    dst[o + 3] = as + ab * (1 - as);
  }
}

/**
 * Trộn vào màu của dst mà giữ nguyên alpha dst (layer clip / adjustment):
 *   C' = (1 − αs)·Cb + αs·B(Cb, Cs)
 * Với 8 mode đặc biệt khi fill < 1: trộn theo fill trên kết quả CHƯA kẹp, kẹp, rồi mới áp opacity.
 */
function lockBlend(dst: Float32Array, C: Float32Array, A: Float32Array, n: number, mode: BlendMode, fill = 1, opacity = 1) {
  const special = fill < 1 ? UNCLAMPED[mode] : undefined;
  const sep = special ?? SEPARABLE[mode];
  for (let i = 0; i < n; i++) {
    const o = i * 4, ab = dst[o + 3];
    if (ab <= 0) continue;
    const a = A[i] * (special ? fill : fill * opacity);
    if (a <= 0) continue;
    const inv = 1 / ab;
    for (let c = 0; c < 3; c++) { tmpB[c] = dst[o + c] * inv; tmpS[c] = C[i * 3 + c]; }
    if (sep) for (let c = 0; c < 3; c++) tmpO[c] = sep(tmpB[c], tmpS[c]);
    else blendPixel(mode, tmpB, tmpS, tmpO);
    for (let c = 0; c < 3; c++) {
      let v = tmpB[c] + a * (tmpO[c] - tmpB[c]);
      if (special) { v = v < 0 ? 0 : v > 1 ? 1 : v; v = tmpB[c] + opacity * (v - tmpB[c]); }
      dst[o + c] = v * ab;
    }
  }
}

/** Màu nền (straight) của hàng → C, rồi áp hàm adjustment. */
function adjustedColor(p: PNode, dst: Float32Array, C: Float32Array, n: number) {
  for (let i = 0; i < n; i++) {
    const a = dst[i * 4 + 3], k = a > 0 ? 1 / a : 0;
    C[i * 3] = dst[i * 4] * k; C[i * 3 + 1] = dst[i * 4 + 1] * k; C[i * 3 + 2] = dst[i * 4 + 2] * k;
  }
  p.adjust?.(C, n);
}

function applyMasks(p: PNode, A: Float32Array, y: number, xa: number, n: number) {
  for (const m of p.masks) {
    if (y < m.top || y >= m.top + m.height) { if (m.outside !== 1) for (let i = 0; i < n; i++) A[i] *= m.outside; continue; }
    for (let i = 0; i < n; i++) A[i] *= maskAt(m, xa + i, y);
  }
}

/** Màu (straight) + alpha (đã nhân mask, CHƯA nhân opacity/fill) của một node trên hàng y. */
function colorAlpha(p: PNode, y: number, xa: number, n: number, C: Float32Array, A: Float32Array) {
  C.fill(0, 0, n * 3); A.fill(0, 0, n);
  if (p.children) {
    const t = take(n * 4);
    compositeList(p.children, t, y, xa, n);
    for (let i = 0; i < n; i++) {
      const a = t[i * 4 + 3];
      A[i] = a;
      if (a > 0) { C[i * 3] = t[i * 4] / a; C[i * 3 + 1] = t[i * 4 + 1] / a; C[i * 3 + 2] = t[i * 4 + 2] / a; }
    }
    give(t);
  } else if (p.content) {
    const c = p.content;
    if (c.kind === 'solid') {
      for (let i = 0; i < n; i++) { C[i * 3] = c.color[0]; C[i * 3 + 1] = c.color[1]; C[i * 3 + 2] = c.color[2]; A[i] = 1; }
    } else {
      const ly = y - c.top;
      if (ly >= 0 && ly < c.height) {
        const i0 = Math.max(0, c.left - xa), i1 = Math.min(n, c.left + c.width - xa);
        for (let i = i0; i < i1; i++) {
          const o = (ly * c.width + (xa + i - c.left)) * 4;
          if (c.kind === 'u8') {
            A[i] = c.data[o + 3] / 255;
            C[i * 3] = c.data[o] / 255; C[i * 3 + 1] = c.data[o + 1] / 255; C[i * 3 + 2] = c.data[o + 2] / 255;
          } else {
            const a = c.data[o + 3];
            A[i] = a;
            if (a > 0) { C[i * 3] = c.data[o] / a; C[i * 3 + 1] = c.data[o + 1] / a; C[i * 3 + 2] = c.data[o + 2] / a; }
          }
        }
      }
    }
  }
  applyMasks(p, A, y, xa, n);
}

const touches = (p: PNode, y: number) => y >= p.rect[1] && y < p.rect[3];
const hasAdjust = (p: PNode): boolean => p.adjust !== undefined || !!p.children?.some(hasAdjust);

function compositeNode(p: PNode, row: Float32Array, y: number, xa: number, n: number) {
  if (p.hidden || !touches(p, y)) return;
  // Photoshop: group Pass Through có Fill < 100% thì adjustment bên trong không xuyên xuống dưới → ghép như group cô lập
  if (p.children && p.mode === 'pass through' && (p.fill >= 1 || !p.children.some(hasAdjust))) {
    const k = p.opacity * p.fill;
    if (k >= 1 && p.masks.length === 0) { compositeList(p.children, row, y, xa, n); return; }
    const copy = take(n * 4);
    copy.set(row.subarray(0, n * 4));
    compositeList(p.children, copy, y, xa, n);
    const M = take(n); M.fill(k, 0, n); applyMasks(p, M, y, xa, n);
    for (let i = 0; i < n; i++) for (let c = 0; c < 4; c++) row[i * 4 + c] += M[i] * (copy[i * 4 + c] - row[i * 4 + c]);
    give(copy, M);
    return;
  }
  const C = take(n * 3), A = take(n);
  if (p.adjust !== undefined) {
    if (p.adjust) {
      adjustedColor(p, row, C, n);
      A.fill(1, 0, n); applyMasks(p, A, y, xa, n);
      if (p.blendIf) applyBlendIf(p, row, C, A, n);
      lockBlend(row, C, A, n, p.mode === 'pass through' ? 'normal' : p.mode, p.fill, p.opacity);
    }
    give(C, A);
    return;
  }
  colorAlpha(p, y, xa, n, C, A);
  if (p.blendIf) applyBlendIf(p, row, C, A, n);
  if (p.fill < 1 && UNCLAMPED[p.mode]) {
    for (let i = 0; i < n; i++) A[i] *= p.fill;
    overSpecialFill(row, C, A, n, p.mode, p.opacity);
  } else {
    const k = p.opacity * p.fill;
    if (k < 1) for (let i = 0; i < n; i++) A[i] *= k;
    over(row, C, A, n, p.mode === 'pass through' ? 'normal' : p.mode);
  }
  give(C, A);
}

export function compositeList(list: PNode[], row: Float32Array, y: number, xa: number, n: number) {
  for (let i = 0; i < list.length; i++) {
    const base = list[i];
    let j = i + 1;
    while (j < list.length && list[j].clipping) j++;
    const clipped = list.slice(i + 1, j);
    i = j - 1;
    if (!clipped.length || clipped.every(c => c.hidden) || base.adjust !== undefined) {
      compositeNode(base, row, y, xa, n);
      if (base.adjust !== undefined) for (const L of clipped) compositeNode(L, row, y, xa, n); // clip vào adjustment: xấp xỉ
      continue;
    }
    if (base.hidden || !touches(base, y)) continue; // layer gốc ẩn/không có pixel → cả nhóm clip không hiện
    if (base.children && base.mode === 'pass through' && base.fill >= 1 && base.bcag) {
      clipOnPassThrough(base, clipped, row, y, xa, n);
      continue;
    }
    const Cb = take(n * 3), Ab = take(n);
    colorAlpha(base, y, xa, n, Cb, Ab);               // Ab = hình dạng S của layer gốc
    const C = take(n * 3), A = take(n);
    if (base.bcag) {
      const unit = take(n * 4);
      const f = base.children && base.mode === 'pass through' ? 1 : base.fill;
      for (let q = 0; q < n; q++) {
        const a = Ab[q] * f;
        unit[q * 4] = Cb[q * 3] * a; unit[q * 4 + 1] = Cb[q * 3 + 1] * a; unit[q * 4 + 2] = Cb[q * 3 + 2] * a; unit[q * 4 + 3] = a;
      }
      for (const L of clipped) {
        if (L.hidden || !touches(L, y)) continue;
        const mode = L.mode === 'pass through' ? 'normal' : L.mode;
        if (L.adjust !== undefined) {
          if (!L.adjust) continue;
          adjustedColor(L, unit, C, n);
          A.fill(1, 0, n); applyMasks(L, A, y, xa, n);
        } else colorAlpha(L, y, xa, n, C, A);
        if (L.blendIf) applyBlendIf(L, unit, C, A, n);
        if (f >= 1) lockBlend(unit, C, A, n, mode, L.fill, L.opacity);
        else { const k = L.opacity * L.fill; for (let q = 0; q < n; q++) A[q] *= k * Ab[q]; over(unit, C, A, n, mode); }
      }
      for (let q = 0; q < n; q++) {
        const a = unit[q * 4 + 3];
        A[q] = a * base.opacity;
        if (a > 0) { C[q * 3] = unit[q * 4] / a; C[q * 3 + 1] = unit[q * 4 + 1] / a; C[q * 3 + 2] = unit[q * 4 + 2] / a; }
        else { C[q * 3] = C[q * 3 + 1] = C[q * 3 + 2] = 0; }
      }
      over(row, C, A, n, base.mode === 'pass through' ? 'normal' : base.mode);
      give(unit);
    } else {
      compositeNode(base, row, y, xa, n);
      for (const L of clipped) {
        if (L.hidden || !touches(L, y)) continue;
        colorAlpha(L, y, xa, n, C, A);
        const k = L.opacity * L.fill * base.opacity;
        for (let q = 0; q < n; q++) A[q] *= k * Ab[q];
        over(row, C, A, n, L.mode === 'pass through' ? 'normal' : L.mode);
      }
    }
    give(Cb, Ab, C, A);
  }
}

/**
 * Group Pass Through làm layer gốc của clipping: các layer con vẫn blend xuyên xuống nền,
 * hình dạng S = độ phủ riêng của group; layer clip trộn vào kết quả trong phạm vi S.
 */
function clipOnPassThrough(base: PNode, clipped: PNode[], row: Float32Array, y: number, xa: number, n: number) {
  const C = take(n * 3), A = take(n), M = take(n);
  // S0 = độ phủ riêng của group (ghép cô lập, chưa mask)
  const iso = take(n * 4);
  compositeList(base.children!, iso, y, xa, n);
  // R = con ghép xuyên xuống nền như Pass Through thường
  const R = take(n * 4);
  R.set(row.subarray(0, n * 4));
  compositeList(base.children!, R, y, xa, n);
  // G = màu riêng của group sau khi đã blend với nền:  R = (1 − S0)·nền + S0·G
  const G = take(n * 4);
  for (let i = 0; i < n; i++) {
    const s0 = iso[i * 4 + 3];
    for (let c = 0; c < 4; c++) G[i * 4 + c] = s0 > 1e-6 ? (R[i * 4 + c] - (1 - s0) * row[i * 4 + c]) / s0 : 0;
  }
  for (const L of clipped) {
    if (L.hidden || !touches(L, y)) continue;
    const mode = L.mode === 'pass through' ? 'normal' : L.mode;
    if (L.adjust !== undefined) { if (!L.adjust) continue; adjustedColor(L, G, C, n); A.fill(1, 0, n); applyMasks(L, A, y, xa, n); }
    else colorAlpha(L, y, xa, n, C, A);
    if (L.blendIf) applyBlendIf(L, G, C, A, n);
    lockBlend(G, C, A, n, mode, L.fill, L.opacity);
  }
  M.fill(base.opacity, 0, n); applyMasks(base, M, y, xa, n);  // opacity/mask của group như Pass Through
  for (let i = 0; i < n; i++) {
    const s0 = iso[i * 4 + 3];
    for (let c = 0; c < 4; c++) {
      const rc = (1 - s0) * row[i * 4 + c] + s0 * G[i * 4 + c];
      row[i * 4 + c] += M[i] * (rc - row[i * 4 + c]);
    }
  }
  give(C, A, M, iso, R, G);
}
