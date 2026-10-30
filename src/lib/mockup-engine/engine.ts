// API dựng mockup từ spec (thuần TS — dùng chung cho trình duyệt và Node).
//
//   const r = await MockupRenderer.create(spec, loadPng);
//   const out = await r.render({ slots: { Design_Front_4200x4800: { art, placement: { fit: 'contain' } } } });

import { makeAdjustment } from './adjust';
import { compositeList, type Content, type PNode } from './compose';
import { denseMesh, isIdentityWarp, renderWarped, type DenseMesh, type Texture } from './geometry';
import { makeTexture, maskAt, rasterMaskField, vectorMaskField, type MaskField, type Placement } from './raster';
import { applySmartFilters } from './filters';
import type { Geometry, MockupSpec, RGBA, SmartNode, SpecNode } from './types';

export type Loader = (src: string) => Promise<RGBA>;

export type SlotInput =
  // ảnh thiết kế + cách đặt vào khung nội dung; cacheKey = định danh ảnh, cùng khoá thì dùng lại raster đã warp
  | { art: RGBA; placement?: Placement; cacheKey?: string }
  | { content: RGBA };                     // nội dung đã dựng sẵn đúng tỉ lệ khung (W×H hoặc thu nhỏ cùng tỉ lệ)

export type RenderOptions = {
  slots?: Record<string, SlotInput | undefined>;
  /** bật/tắt layer theo path, vd { 'Áo (bật 1 layer màu để đổi màu áo)/Red': true } */
  visibility?: Record<string, boolean>;
  /** đổi màu layer Solid Color theo path */
  solidColors?: Record<string, [number, number, number]>;
  /**
   * 'photoshop' (mặc định): lấy mẫu như Photoshop — warp: bicubic trên nội dung độ phân giải gốc;
   *                          không warp: lọc Lanczos theo tỉ lệ thu nhỏ rồi bicubic.
   * 'smooth': khử răng cưa mạnh hơn Photoshop (lọc diện tích + siêu lấy mẫu 3×3).
   */
  quality?: 'photoshop' | 'smooth';
  /** slot không có ảnh: 'preview' = dùng raster Photoshop lưu trong PSD, 'empty' = để trống */
  emptySlot?: 'preview' | 'empty';
  /**
   * Mockup "cửa sổ in" (mask vùng in rất nhỏ so với smart object đã warp, xem printWindowGeometry):
   * đặt ảnh thẳng vào đúng vùng mask thay vì uốn theo warp. Không ảnh hưởng mockup khác.
   * Mặc định tắt: giống hệt Replace Contents của Photoshop.
   */
  printWindow?: boolean;
  /**
   * Giữ màu hình in khi đổi màu sản phẩm (ngoài Photoshop): smart object blend Linear Burn/Multiply…
   * sẽ tối theo áo, nên phần có hình in lấy từ bản render với `visibility` này (sản phẩm chưa nhuộm).
   * Smart object blend Normal không cần: không tốn thêm lượt render.
   */
  printBase?: Record<string, boolean>;
};

/** Hình in đang blend khác Normal: nội dung đã dựng + các mask giới hạn nó. */
type BlendedPrint = { content: Extract<Content, { kind: 'f32' }>; masks: MaskField[] };

/** Mask chiếm dưới tỉ lệ này của smart object thì mới coi là cửa sổ in (mockup đã khảo sát: 0.09 so với ≥ 0.74). */
const PRINT_WINDOW_MAX_RATIO = 0.5;

/** Khung của phần mask đang hiện (≥ 50%); null nếu mask không giới hạn vùng. */
function maskBox(m: MaskField) {
  if (m.outside !== 0) return null;
  let x0 = m.width, y0 = m.height, x1 = -1, y1 = -1;
  for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
    if (m.data[y * m.width + x] < 0.5) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < 0 ? null : { left: m.left + x0, top: m.top + y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

/** Hình học thay thế khi `fields` (mask của layer và của gốc clipping) chỉ mở một ô nhỏ trên smart object. */
function printWindowGeometry(n: SmartNode, fields: MaskField[]): Geometry | null {
  const boxes = fields.map(maskBox).filter(b => !!b);
  if (!boxes.length) return null;
  const box = boxes.reduce((a, b) => (b.width * b.height < a.width * a.height ? b : a));
  const q = n.geometry.quad;
  const xs = [q[0], q[2], q[4], q[6]], ys = [q[1], q[3], q[5], q[7]];
  const area = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
  if (box.width * box.height >= PRINT_WINDOW_MAX_RATIO * area) return null;
  const { left: l, top: t, width: w, height: h } = box;
  const meshX: number[] = [], meshY: number[] = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { meshX.push((c / 3) * w); meshY.push((r / 3) * h); }
  return {
    contentWidth: w, contentHeight: h, bounds: [0, 0, w, h], quad: [l, t, l + w, t, l + w, t + h, l, t + h],
    rows: 4, cols: 4, meshX, meshY, sliceX: [0, w], sliceY: [0, h],
  };
}

const containsSmart = (n: SpecNode): boolean => n.type === 'smart' || (n.type === 'group' && n.children.some(containsSmart));

export class MockupRenderer {
  private images = new Map<string, Promise<RGBA>>();
  private meshes = new Map<string, DenseMesh>();
  private smartCache = new Map<SmartNode, { key: string; content: BlendedPrint['content'] }>();
  private plainCache: { key: string; image: RGBA } | null = null;
  private meshKey = new Map<SmartNode, number>();
  private masks = new Map<SpecNode, MaskField[]>();
  private windows = new Map<SmartNode, Geometry>();
  private prefixCache = new Map<string, Uint8ClampedArray>();

  private constructor(public spec: MockupSpec, private load: Loader) {}

  static async create(spec: MockupSpec, load: Loader) {
    const r = new MockupRenderer(spec, load);
    await r.preload(spec.layers);
    return r;
  }

  private img(src: string) {
    let p = this.images.get(src);
    if (!p) { p = this.load(src); this.images.set(src, p); }
    return p;
  }

  private async preload(list: SpecNode[]) {
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      const fields: MaskField[] = [];
      if (n.mask && !n.mask.disabled) fields.push(rasterMaskField(n.mask, await this.img(n.mask.src)));
      if (n.vectorMaskRaster && !n.vectorMaskRaster.disabled) fields.push(rasterMaskField(n.vectorMaskRaster, await this.img(n.vectorMaskRaster.src)));
      else if (n.vectorMask) { const f = vectorMaskField(n.vectorMask, this.spec.width, this.spec.height); if (f) fields.push(f); }
      this.masks.set(n, fields);
      if (n.type === 'pixel' && n.src) await this.img(n.src);
      if (n.type === 'smart') {
        if (n.preview) await this.img(n.preview.src);
        this.meshKey.set(n, this.meshKey.size);
        let b = i;
        while (n.clipping && b > 0 && list[b].clipping) b--;
        const win = printWindowGeometry(n, [...fields, ...(b !== i ? this.masks.get(list[b]) ?? [] : [])]);
        if (win) this.windows.set(n, win);
      }
      if (n.type === 'group') await this.preload(n.children);
    }
  }

  private mesh(n: SmartNode, g: Geometry, margin: number) {
    const key = `${this.meshKey.get(n)}${g === n.geometry ? '' : 'w'}@${margin.toFixed(3)}`;
    let m = this.meshes.get(key);
    if (!m) { m = denseMesh(g, 3, margin); this.meshes.set(key, m); }
    return m;
  }

  /** Dựng raster smart object trên canvas từ ảnh thiết kế (hình học + lấy mẫu + smart filter). */
  private renderSmart(n: SmartNode, input: SlotInput, o: RenderOptions, texCache: Map<string, Texture>): Extract<Content, { kind: 'f32' }> {
    const g = (o.printWindow && 'art' in input && this.windows.get(n)) || n.geometry;
    const W = this.spec.width, H = this.spec.height;
    const base = this.mesh(n, g, 0);
    const su = base.scaleU, sv = base.scaleV;
    const quality = o.quality ?? 'photoshop';
    const warped = !isIdentityWarp(g);
    let dx: number, dy: number, ss: number, filter: 'bicubic' | 'bilinear';
    if (quality === 'smooth') { dx = su * 3.15; dy = sv * 3.15; ss = 3; filter = 'bilinear'; }
    else if (warped) { dx = 1; dy = 1; ss = 1; filter = 'bicubic'; }            // Photoshop: warp lấy mẫu thẳng trên nội dung
    else { dx = Math.min(1, su); dy = Math.min(1, sv); ss = 1; filter = 'bicubic'; } // Photoshop: transform có lọc khi thu nhỏ
    const art = 'content' in input ? input.content : input.art;
    const placement: Placement = 'content' in input ? { fit: 'stretch' } : input.placement ?? {};
    const tkey = `${n.slot}|${dx.toFixed(5)}|${dy.toFixed(5)}|${JSON.stringify(placement)}|${g.contentWidth}x${g.contentHeight}`;
    let tex = texCache.get(tkey);
    if (!tex) { tex = makeTexture(art, g.contentWidth, g.contentHeight, placement, dx, dy); texCache.set(tkey, tex); }
    // lưới kéo dài ra ngoài mép để bộ lọc bicubic tạo mép mềm như Photoshop
    const margin = filter === 'bicubic' ? 2.5 / Math.max(1e-6, Math.min(tex.kx, tex.ky)) : 0;
    const w = renderWarped(this.mesh(n, g, margin), tex, g.contentWidth, g.contentHeight, W, H, { ss, filter });
    const f = n.filters?.length ? applySmartFilters(w, n.filters, W, H) : w;
    return { kind: 'f32', left: f.left, top: f.top, width: f.width, height: f.height, data: f.data };
  }

  private smartKey(cacheKey: string, o: RenderOptions) {
    return `${cacheKey}|${o.quality ?? 'photoshop'}|${!!o.printWindow}`;
  }

  /** Raster của smart object: đổi màu áo không đổi ảnh thiết kế nên không cần warp lại. */
  private smartContent(n: SmartNode, input: SlotInput, o: RenderOptions, texCache: Map<string, Texture>): BlendedPrint['content'] {
    const key = 'art' in input && input.cacheKey ? this.smartKey(input.cacheKey, o) : null;
    const hit = key && this.smartCache.get(n);
    if (hit && hit.key === key) return hit.content;
    const content = this.renderSmart(n, input, o, texCache);
    if (key) this.smartCache.set(n, { key, content });
    return content;
  }

  /** Mọi smart object của slot đã có raster cho ảnh này (khỏi phải giải mã ảnh). */
  hasSmartContent(slot: string, cacheKey: string, o: RenderOptions) {
    const key = this.smartKey(cacheKey, o);
    const covered = (list: SpecNode[]): boolean =>
      list.every(n => n.type === 'group' ? covered(n.children) : n.type !== 'smart' || n.slot !== slot || this.smartCache.get(n)?.key === key);
    return covered(this.spec.layers);
  }

  private async build(
    list: SpecNode[], o: RenderOptions, texCache: Map<string, Texture>,
    prints: BlendedPrint[], blended = false, inherited: MaskField[] = [],
  ): Promise<PNode[]> {
    const out: PNode[] = [];
    const W = this.spec.width, H = this.spec.height;
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      const hidden = o.visibility?.[n.path] !== undefined ? !o.visibility[n.path] : n.hidden;
      const p: PNode = {
        spec: n, hidden, mode: n.blendMode, opacity: n.opacity, fill: n.fillOpacity, clipping: n.clipping,
        bcag: n.blendClippedAsGroup, masks: this.masks.get(n) ?? [], rect: [0, 0, W, H], blendIf: n.blendIf,
      };
      let content: Content | undefined;
      if (n.type === 'pixel') {
        if (n.src) {
          const im = await this.img(n.src);
          content = { kind: 'u8', left: n.left, top: n.top, width: im.width, height: im.height, data: im.data };
        }
      } else if (n.type === 'solid') {
        const c = o.solidColors?.[n.path] ?? n.color;
        content = { kind: 'solid', color: [c[0] / 255, c[1] / 255, c[2] / 255] };
      } else if (n.type === 'smart') {
        const input = o.slots?.[n.slot];
        if (input) {
          const rendered = this.smartContent(n, input, o, texCache);
          content = rendered;
          if (!hidden && (blended || (n.blendMode !== 'normal' && n.blendMode !== 'pass through'))) {
            let b = i;
            while (n.clipping && b > 0 && list[b].clipping) b--;
            prints.push({ content: rendered, masks: [...inherited, ...(this.masks.get(n) ?? []), ...(b !== i ? this.masks.get(list[b]) ?? [] : [])] });
          }
        } else if ((o.emptySlot ?? 'preview') === 'preview' && n.preview) {
          const im = await this.img(n.preview.src);
          content = { kind: 'u8', left: n.preview.left, top: n.preview.top, width: im.width, height: im.height, data: im.data };
        }
      } else if (n.type === 'group') {
        const groupBlended = blended || (n.blendMode !== 'normal' && n.blendMode !== 'pass through');
        p.children = await this.build(n.children, o, texCache, hidden ? [] : prints, groupBlended, [...inherited, ...(this.masks.get(n) ?? [])]);
      } else if (n.type === 'adjust') {
        p.adjust = makeAdjustment(n.adjustment).fn;
      }
      p.content = content;
      // vùng ảnh hưởng (để bỏ qua hàng trống)
      let r: [number, number, number, number] = [0, 0, W, H];
      if (content && content.kind !== 'solid') r = [content.left, content.top, content.left + content.width, content.top + content.height];
      else if (p.children) {
        const rs = p.children.filter(c => !c.hidden).map(c => c.rect);
        r = rs.length ? [Math.min(...rs.map(q => q[0])), Math.min(...rs.map(q => q[1])), Math.max(...rs.map(q => q[2])), Math.max(...rs.map(q => q[3]))] : [0, 0, 0, 0];
      } else if (!content && n.type !== 'adjust') r = [0, 0, 0, 0];
      for (const m of p.masks) if (m.outside === 0) r = [Math.max(r[0], m.left), Math.max(r[1], m.top), Math.min(r[2], m.left + m.width), Math.min(r[3], m.top + m.height)];
      p.rect = r;
      out.push(p);
    }
    return out;
  }

  async render(o: RenderOptions = {}): Promise<RGBA> {
    const texCache = new Map<string, Texture>();
    const prints: BlendedPrint[] = [];
    const out = await this.renderOnce(o, texCache, prints);
    if (!o.printBase || !prints.length) return out;
    // Bản chưa nhuộm không phụ thuộc màu áo: cùng ảnh thiết kế thì dùng lại
    const arts = Object.entries(o.slots ?? {}).map(([slot, s]) => (s && 'art' in s && s.cacheKey ? `${slot}=${this.smartKey(s.cacheKey, o)}` : null));
    const plainKey = arts.every(Boolean) ? JSON.stringify([arts, o.printBase, o.solidColors ?? {}]) : null;
    let plain = plainKey && this.plainCache?.key === plainKey ? this.plainCache.image : null;
    if (!plain) {
      plain = await this.renderOnce({ ...o, visibility: o.printBase }, texCache, []);
      if (plainKey) this.plainCache = { key: plainKey, image: plain };
    }
    for (const p of prints) keepPrintColors(out.data, plain.data, out.width, out.height, p);
    return out;
  }

  private async renderOnce(o: RenderOptions, texCache: Map<string, Texture>, prints: BlendedPrint[]): Promise<RGBA> {
    const W = this.spec.width, H = this.spec.height;
    const nodes = await this.build(this.spec.layers, o, texCache, prints);

    // tách phần tĩnh (dưới smart object đầu tiên, tính theo nhóm clip) để cache
    let split = nodes.length;
    for (let i = 0; i < nodes.length; i++) {
      if (containsSmart(nodes[i].spec)) {
        split = i;
        while (split > 0 && nodes[split].clipping) split--; // lùi về layer gốc của nhóm clip
        break;
      }
    }
    const prefix = nodes.slice(0, split), suffix = nodes.slice(split);
    const key = JSON.stringify([split, o.visibility ?? {}, o.solidColors ?? {}]);
    let prefixData = this.prefixCache.get(key);
    if (!prefixData) {
      const data = new Uint8ClampedArray(W * H * 4);
      const row = new Float32Array(W * 4);
      for (let y = 0; y < H; y++) {
        row.fill(0);
        compositeList(prefix, row, y, 0, W);
        writeRow(row, data, y, 0, W, W);
      }
      // Mỗi bản nặng W×H×4 byte: chỉ giữ vài biến thể màu gần nhất
      if (this.prefixCache.size >= 8) this.prefixCache.delete(this.prefixCache.keys().next().value!);
      this.prefixCache.set(key, data);
      prefixData = data;
    }
    const out = prefixData.slice();

    // phần động: chỉ xử lý vùng bao các layer phía trên
    const vis = suffix.filter(p => !p.hidden);
    if (vis.length) {
      const x0 = Math.max(0, Math.floor(Math.min(...vis.map(p => p.rect[0])))), y0 = Math.max(0, Math.floor(Math.min(...vis.map(p => p.rect[1]))));
      const x1 = Math.min(W, Math.ceil(Math.max(...vis.map(p => p.rect[2])))), y1 = Math.min(H, Math.ceil(Math.max(...vis.map(p => p.rect[3]))));
      const n = Math.max(0, x1 - x0);
      const row = new Float32Array(n * 4);
      for (let y = y0; y < y1; y++) {
        readRow(out, row, y, x0, n, W);
        compositeList(suffix, row, y, x0, n);
        writeRow(row, out, y, x0, n, W);
      }
    }
    return { width: W, height: H, data: out };
  }
}

/** Phần hình in phủ tới (độ phủ × mask) lấy theo bản render `plain`, phần còn lại giữ nguyên. */
function keepPrintColors(out: RGBA['data'], plain: RGBA['data'], W: number, H: number, { content: c, masks }: BlendedPrint) {
  const x1 = Math.min(W, c.left + c.width), y1 = Math.min(H, c.top + c.height);
  for (let y = Math.max(0, c.top); y < y1; y++) for (let x = Math.max(0, c.left); x < x1; x++) {
    let a = c.data[((y - c.top) * c.width + x - c.left) * 4 + 3];
    if (a <= 0) continue;
    for (const m of masks) a *= maskAt(m, x, y);
    if (a <= 0) continue;
    const o = (y * W + x) * 4;
    for (let k = 0; k < 4; k++) out[o + k] += (plain[o + k] - out[o + k]) * a;
  }
}

function readRow(src: Uint8ClampedArray, row: Float32Array, y: number, x0: number, n: number, W: number) {
  for (let i = 0; i < n; i++) {
    const o = (y * W + x0 + i) * 4, a = src[o + 3] / 255;
    row[i * 4] = (src[o] / 255) * a; row[i * 4 + 1] = (src[o + 1] / 255) * a; row[i * 4 + 2] = (src[o + 2] / 255) * a; row[i * 4 + 3] = a;
  }
}

function writeRow(row: Float32Array, dst: Uint8ClampedArray, y: number, x0: number, n: number, W: number) {
  for (let i = 0; i < n; i++) {
    const o = (y * W + x0 + i) * 4, a = row[i * 4 + 3];
    if (a <= 0) { dst[o] = dst[o + 1] = dst[o + 2] = dst[o + 3] = 0; continue; }
    dst[o] = Math.round((row[i * 4] / a) * 255); dst[o + 1] = Math.round((row[i * 4 + 1] / a) * 255);
    dst[o + 2] = Math.round((row[i * 4 + 2] / a) * 255); dst[o + 3] = Math.round(a * 255);
  }
}
