import { initializeCanvas, readPsd, type Layer } from 'ag-psd';
import { iou, quadBounds, quadFromArray, quadSize, rectToQuad, squareToQuad } from './geometry';
import type {
  AssetInfo, ColorOption, Issue, LayerReport, LayerType, MeshWarp, PrintArea, Pt, Rect,
  RenderNode, Role, SideSpec, TemplateProfile, TemplateSpec,
} from './types';

export const PARSER_VERSION = 'psd-template@1.0.0';

/* ------------------------------------------------------------------ */
/* Từ khoá nhận diện (đã bỏ dấu, lowercase). Mở rộng qua TemplateProfile */
/* ------------------------------------------------------------------ */
const SIDE_ALIASES: Record<string, string[]> = {
  front: ['front', 'front side', 'mat truoc', 'truoc', 'ft'],
  back: ['back', 'back side', 'mat sau', 'sau', 'bk'],
  left_sleeve: ['left sleeve', 'sleeve left', 'tay trai', 'tay ao trai'],
  right_sleeve: ['right sleeve', 'sleeve right', 'tay phai', 'tay ao phai'],
  neck: ['neck', 'neck label', 'co ao', 'nhan co'],
  hood: ['hood', 'mu ao'],
};
const AREA_ALIASES: Record<string, string[]> = {
  chest: ['chest', 'left chest', 'nguc', 'logo nguc'],
  pocket: ['pocket', 'tui'],
  sleeve: ['sleeve', 'tay ao'],
  full: ['full', 'all over', 'aop', 'toan bo'],
};
const COLOR_WORDS = [
  'white', 'black', 'red', 'blue', 'navy', 'green', 'yellow', 'pink', 'grey', 'gray', 'heather', 'purple', 'orange',
  'brown', 'beige', 'cream', 'maroon', 'sand', 'olive', 'royal',
  'trang', 'den', 'do', 'xanh', 'vang', 'hong', 'xam', 'tim', 'cam', 'nau', 'be', 'kem', 'reu', 'ghi',
];
const RE = {
  printArea: /\b(print ?area|printable|print zone|vung in|khu vuc in)\b/,
  design: /\b(design|artwork|thiet ke|your design|placeholder)\b/,
  guide: /\b(guide|guides|huong dan|watermark|xoa khi|delete me|remove|safe area|vung an toan|bleed|mau kiem tra)\b/,
  physical: /(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s*(in|inch|inches|"|cm|mm)(?=\W|$)/i,
  pixels: /(\d{3,5})\s*[x×*]\s*(\d{3,5})(?!\s*(?:[.,]\d|in\b|inch|cm|mm|"))/i,
  tag: /\[([a-z_-]+)(?:\s*[:=]\s*([^\]]+))?\]/gi,
};
const COLOR_BLENDS = new Set(['multiply', 'color', 'hue', 'overlay', 'soft light', 'linear burn', 'color burn']);
const CANVAS_BLENDS = new Set([
  'normal', 'pass through', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color dodge', 'color burn',
  'hard light', 'soft light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity',
]);
const ROLE_TAGS: Record<string, Role> = {
  base: 'base', color: 'color', design: 'design', printarea: 'printArea', overlay: 'overlay', static: 'static', ignore: 'ignore',
};

/* ------------------------------------------------------------------ */
interface N {
  ref: string;
  path: string;
  name: string;
  clean: string; // tên đã bỏ [tag]
  norm: string; // bỏ dấu + lowercase
  layer: Layer;
  type: LayerType;
  parent?: N;
  siblings: N[];
  index: number;
  order: number; // thứ tự DFS toàn cục (dưới → trên)
  children: N[];
  tags: Record<string, string>;
  role?: Role;
  reason: string;
  clipBase?: N;
  side?: string;
}

export interface ParseOptions {
  fileName?: string;
  profile?: TemplateProfile;
  /** false = chỉ đọc metadata (nhanh, dùng để validate lúc upload) */
  withImages?: boolean;
}
export interface RawImage { width: number; height: number; data: Uint8ClampedArray }
export interface ParseResult {
  spec: TemplateSpec;
  /** pixel của từng asset (base/overlay/static/mask) — lưu ra PNG rồi upload storage */
  images: Map<string, RawImage>;
}

export const normalizeName = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase()
    .replace(/[–—_|/\\()[\]{}:;,]+/g, ' ').replace(/\s+/g, ' ').trim();
export const slug = (s: string) => normalizeName(s).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'x';
const toHex = (c: { r: number; g: number; b: number }) =>
  '#' + [c.r, c.g, c.b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const hasWord = (norm: string, alias: string) => new RegExp(`(^|\\s)${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(norm);
const num = (s: string) => parseFloat(s.replace(',', '.'));

function layerType(l: Layer): LayerType {
  if (l.children) return 'group';
  if (l.placedLayer) return 'smartObject';
  if (l.adjustment) return 'adjustment';
  if (l.text) return 'text';
  if (l.vectorFill && !l.vectorMask) return 'fill';
  if (l.vectorMask && (l.vectorFill || l.vectorStroke)) return 'shape';
  if ((l.right ?? 0) > (l.left ?? 0) && (l.bottom ?? 0) > (l.top ?? 0)) return 'pixel';
  return 'empty';
}

function aliasLookup(norm: string, table: Record<string, string[]>): string | undefined {
  // alias dài match trước ("left sleeve" trước "sleeve")
  const entries = Object.entries(table).flatMap(([k, list]) => list.map((a) => [k, a] as const));
  entries.sort((a, b) => b[1].length - a[1].length);
  return entries.find(([, a]) => hasWord(norm, a))?.[0];
}

function parsePhysical(norm: string): PrintArea['physical'] | undefined {
  const m = norm.match(RE.physical);
  if (!m) return;
  const unit = m[3].startsWith('in') || m[3] === '"' ? 'in' : (m[3] as 'cm' | 'mm');
  return { width: num(m[1]), height: num(m[2]), unit };
}
function parsePixels(s: string): { width: number; height: number } | undefined {
  const m = s.match(RE.pixels);
  return m ? { width: +m[1], height: +m[2] } : undefined;
}
const UNIT_PER_INCH = { in: 1, cm: 2.54, mm: 25.4 } as const;

/* ------------------------------------------------------------------ */

let agReady = false;
/**
 * Parser chỉ cần pixel (useImageData), không cần canvas: cho ag-psd tạo ImageData thuần JS.
 * Làm cả trên browser — tránh mọi phụ thuộc vào canvas DOM khi parse (chạy được trong worker).
 */
function ensureAgPsd() {
  if (agReady) return;
  initializeCanvas(
    () => { throw new Error('parseTemplate dùng useImageData, không cần canvas'); },
    (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4), colorSpace: 'srgb' }) as unknown as ImageData,
  );
  agReady = true;
}

export function parseTemplate(buffer: ArrayBuffer | Uint8Array, opts: ParseOptions = {}): ParseResult {
  const profile = opts.profile;
  const withImages = opts.withImages !== false;
  const sideAliases = { ...SIDE_ALIASES, ...profile?.sideAliases };
  const areaAliases = { ...AREA_ALIASES, ...profile?.areaAliases };
  const defaultDpi = profile?.defaultDpi ?? 300;
  const issues: Issue[] = [];
  const issue = (level: Issue['level'], code: string, message: string, ref?: string) => issues.push({ level, code, message, ref });

  ensureAgPsd();
  const psd = readPsd(buffer as ArrayBuffer, {
    throwForMissingFeatures: false,
    logMissingFeatures: false,
    skipCompositeImageData: true,
    skipThumbnail: true,
    skipLinkedFilesData: true, // không cần nội dung smart object, chỉ cần transform
    skipLayerImageData: !withImages,
    useImageData: true,
  });
  const W = psd.width, H = psd.height;
  if ((psd.bitsPerChannel ?? 8) !== 8) issue('error', 'UNSUPPORTED_DEPTH', `PSD ${psd.bitsPerChannel}-bit – hãy lưu lại 8-bit/channel`);
  if (psd.colorMode !== undefined && psd.colorMode !== 3) issue('warn', 'COLOR_MODE', `Color mode ${psd.colorMode} (không phải RGB) – màu có thể lệch, nên chuyển sang RGB`);

  /* 1. Dựng cây có ref ổn định (KHÔNG dùng layer.id: smart object có thể không có id) */
  const all: N[] = [];
  const build = (layers: Layer[] | undefined, parent: N | undefined): N[] => {
    const out: N[] = [];
    (layers ?? []).forEach((layer, index) => {
      const name = layer.name ?? '';
      const tags: Record<string, string> = {};
      for (const m of name.matchAll(RE.tag)) tags[m[1].toLowerCase().replace(/[-_]/g, '')] = (m[2] ?? '').trim();
      const clean = name.replace(RE.tag, '').trim();
      const n: N = {
        ref: parent ? `${parent.ref}/${index}` : `${index}`,
        path: parent ? `${parent.path}/${clean}` : clean,
        name, clean, norm: normalizeName(clean), layer, type: layerType(layer), parent,
        siblings: out, index, order: 0, children: [], tags, reason: '',
      };
      out.push(n);
      all.push(n); // DFS pre-order; order thật (dưới→trên) gán bên dưới
      n.children = build(layer.children, n);
    });
    return out;
  };
  const roots = build(psd.children, undefined);
  // ag-psd: children[0] là layer DƯỚI CÙNG → DFS theo mảng = thứ tự vẽ
  let ord = 0;
  const assignOrder = (ns: N[]) => ns.forEach((n) => { n.order = ord++; assignOrder(n.children); });
  assignOrder(roots);
  all.sort((a, b) => a.order - b.order);

  const missingId = all.filter((n) => n.type !== 'group' && n.layer.id === undefined);
  if (missingId.length) {
    issue('info', 'MISSING_LAYER_ID', `${missingId.length} layer không có layer id (${missingId.map((n) => n.type).join(', ')}) → dùng ref/path làm khoá, đừng dùng layer.id`);
  }

  // clipping base = layer không-clip gần nhất phía dưới cùng cấp
  for (const n of all) {
    if (!n.layer.clipping) continue;
    for (let i = n.index - 1; i >= 0; i--) if (!n.siblings[i].layer.clipping) { n.clipBase = n.siblings[i]; break; }
  }

  /* 2. Phân loại role cho từng layer: profile override > [tag] > heuristic */
  const set = (n: N, role: Role | undefined, reason: string) => { n.role = role; n.reason = reason; };
  for (const n of all) {
    if (n.type === 'group') continue;
    const l = n.layer;
    const ov = profile?.overrides?.[n.ref] ?? profile?.overrides?.[n.path];
    if (ov?.role) { set(n, ov.role, 'profile override'); continue; }
    const tagRole = Object.keys(n.tags).map((t) => ROLE_TAGS[t]).find(Boolean);
    if (tagRole) { set(n, tagRole, `tag [${tagRole}]`); continue; }

    const blend = l.blendMode ?? 'normal';
    switch (n.type) {
      case 'smartObject':
        set(n, 'design', 'smart object'); break;
      case 'fill':
        if (l.clipping) set(n, 'color', `fill layer clip vào "${n.clipBase?.clean}"`);
        else if (l.mask && !l.mask.disabled) set(n, 'color', 'fill layer có layer mask');
        else if (COLOR_BLENDS.has(blend)) set(n, 'color', `fill layer blend ${blend}`);
        else set(n, l.hidden ? 'ignore' : 'static', 'fill layer thường');
        break;
      case 'shape': {
        const strokeOnly = !!l.vectorStroke && l.vectorStroke.fillEnabled === false;
        if (RE.printArea.test(n.norm)) set(n, 'printArea', 'shape, tên khớp "print area"');
        else if (strokeOnly) set(n, 'printArea', 'shape chỉ có viền');
        else if (RE.design.test(n.norm)) set(n, 'design', 'shape placeholder tên "design"');
        else set(n, l.hidden ? 'ignore' : 'static', 'shape thường');
        break;
      }
      case 'adjustment':
        set(n, 'ignore', `adjustment layer (${l.adjustment?.type}) – renderer chưa hỗ trợ`);
        if (!l.hidden) issue('warn', 'ADJUSTMENT_IGNORED', `Bỏ qua adjustment "${n.clean}" (${l.adjustment?.type}). Nếu dùng để đổi màu áo, hãy thay bằng Solid Color fill layer.`, n.ref);
        break;
      case 'text':
        set(n, l.hidden ? 'ignore' : 'static', 'text (dùng bản raster)'); break;
      case 'empty':
        set(n, 'ignore', 'layer rỗng'); break;
      case 'pixel':
        if (RE.guide.test(n.norm)) set(n, 'ignore', 'tên giống guide/watermark');
        else if (RE.printArea.test(n.norm)) set(n, 'printArea', 'pixel, tên khớp "print area"');
        else if (RE.design.test(n.norm) && !l.clipping) set(n, 'design', 'pixel placeholder tên "design"');
        else if (l.hidden && COLOR_WORDS.some((w) => hasWord(n.norm, w))) set(n, 'color', 'layer ảnh ẩn mang tên màu (biến thể ảnh)');
        else if (l.hidden) set(n, 'ignore', 'layer ẩn');
        else set(n, undefined, ''); // quyết định ở bước side
        break;
    }
  }

  /* 3. Xác định side: group gần nhất (tính từ slot design/printArea đi lên) có chứa ảnh sản phẩm */
  const isGroupSideTagged = (g: N) => g.tags.side !== undefined || !!profile?.overrides?.[g.ref]?.side || !!profile?.overrides?.[g.path]?.side;
  const subtree = (g: N): N[] => g.children.flatMap((c) => [c, ...subtree(c)]);
  const hasProductImage = (g: N) => subtree(g).some((n) => (n.type === 'pixel' && n.role === undefined) || n.role === 'base' || (n.role === 'color' && n.type === 'pixel'));
  const containerOf = (n: N): N | null => {
    for (let p = n.parent; p; p = p.parent) if (isGroupSideTagged(p) || hasProductImage(p)) return p;
    return null; // root
  };
  const slots = all.filter((n) => n.role === 'design' || n.role === 'printArea');
  const containers = new Map<string, N | null>();
  for (const s of slots) { const c = containerOf(s); containers.set(c?.ref ?? '', c); }
  // group được tag [side:…] nhưng chưa có slot vẫn tính là side (để báo lỗi NO_PRINT_AREA)
  for (const n of all) if (n.type === 'group' && isGroupSideTagged(n)) containers.set(n.ref, n);
  // group "ảnh sản phẩm + layer màu clip vào nó" (VD "Front side", "Back side") là 1 side dù chưa có slot
  // → mỗi mặt vẫn tách riêng; vùng in sẽ được báo NO_PRINT_AREA để app tự đoán / admin gán
  const ownsColorClip = (g: N) => g.children.some((c) => c.role === 'color' && c.clipBase?.type === 'pixel');
  const insideContainer = (g: N) => [...containers.keys()].some((r) => r !== '' && g.ref.startsWith(r + '/'));
  for (const g of all) {
    if (g.type !== 'group' || containers.has(g.ref) || !ownsColorClip(g) || insideContainer(g)) continue;
    if ([...containers.keys()].some((r) => r !== '' && r.startsWith(g.ref + '/'))) continue; // đã có side con
    containers.set(g.ref, g);
  }
  if (!containers.size && all.some((n) => n.type !== 'group')) containers.set('', null);

  const usedSideKeys = new Set<string>();
  const sideKeyOf = (c: N | null, idx: number): string => {
    const slotTag = slots.find((s) => (containerOf(s)?.ref ?? '') === (c?.ref ?? '') && s.tags.side)?.tags.side;
    const ov = c ? profile?.overrides?.[c.ref]?.side ?? profile?.overrides?.[c.path]?.side : undefined;
    const key = ov || (c?.tags.side ? slug(c.tags.side) : undefined) || (slotTag ? slug(slotTag) : undefined)
      || (c ? aliasLookup(c.norm, sideAliases) : undefined) || (c ? slug(c.clean) : idx === 0 ? 'front' : `side_${idx + 1}`);
    let k = key, i = 2;
    while (usedSideKeys.has(k)) k = `${key}_${i++}`;
    usedSideKeys.add(k);
    return k;
  };

  const containerRefs = [...containers.keys()];
  const inScope = (n: N, cref: string) => {
    if (cref === '') return !containerRefs.some((r) => r !== '' && (n.ref === r || n.ref.startsWith(r + '/')));
    return n.ref.startsWith(cref + '/');
  };

  const sides: SideSpec[] = [];
  const assets: Record<string, AssetInfo> = {};
  const images = new Map<string, RawImage>();
  const colorMap = new Map<string, ColorOption>();

  const addAsset = (n: N, sideKey: string): string => {
    const id = `${sideKey}__${slug(n.clean)}__${n.ref.replace(/\//g, '-')}`;
    const l = n.layer;
    assets[id] = { id, ref: n.ref, left: l.left ?? 0, top: l.top ?? 0, width: (l.right ?? 0) - (l.left ?? 0), height: (l.bottom ?? 0) - (l.top ?? 0) };
    if (l.imageData) images.set(id, l.imageData as RawImage);
    return id;
  };
  const addMask = (n: N, sideKey: string) => {
    const m = n.layer.mask;
    if (!m || m.disabled || m.right === undefined || (m.right ?? 0) <= (m.left ?? 0)) return undefined;
    const id = `${sideKey}__${slug(n.clean)}__${n.ref.replace(/\//g, '-')}__mask`;
    assets[id] = { id, ref: n.ref, left: m.left ?? 0, top: m.top ?? 0, width: (m.right ?? 0) - (m.left ?? 0), height: (m.bottom ?? 0) - (m.top ?? 0) };
    if (m.imageData) {
      // mask grayscale → alpha
      const src = m.imageData as RawImage;
      const data = new Uint8ClampedArray(src.data.length);
      for (let i = 0; i < data.length; i += 4) { data[i] = data[i + 1] = data[i + 2] = 0; data[i + 3] = src.data[i]; }
      images.set(id, { width: src.width, height: src.height, data });
    }
    return { asset: id, defaultVisible: (m.defaultColor ?? 0) >= 128 };
  };
  const effOpacity = (n: N, cref: string) => {
    let o = (n.layer.opacity ?? 1) * (n.type === 'fill' || n.type === 'pixel' ? n.layer.fillOpacity ?? 1 : 1);
    for (let p = n.parent; p && p.ref !== cref; p = p.parent) o *= p.layer.opacity ?? 1;
    return o;
  };
  const hiddenByGroup = (n: N, cref: string) => {
    for (let p = n.parent; p && p.ref !== cref; p = p.parent) if (p.layer.hidden) return true;
    return false;
  };

  containerRefs.forEach((cref, idx) => {
    const c = containers.get(cref) ?? null;
    const key = sideKeyOf(c, idx);
    const scope = all.filter((n) => inScope(n, cref));
    scope.forEach((n) => (n.side = key));

    // group con bị ẩn → bỏ layer bên trong (trừ layer màu)
    for (const n of scope) if (n.type !== 'group' && n.role !== 'color' && hiddenByGroup(n, cref)) set(n, 'ignore', 'nằm trong group ẩn');
    for (const g of scope) {
      if (g.type === 'group' && ((g.layer.blendMode ?? 'pass through') !== 'pass through' || g.layer.mask))
        issue('warn', 'GROUP_FLATTENED', `Group "${g.clean}" có blend/mask riêng – renderer sẽ flatten (có thể lệch màu nhẹ)`, g.ref);
    }

    /* 3a. Chốt base / overlay / static cho layer pixel chưa có role */
    const colors = scope.filter((n) => n.role === 'color');
    const designs = scope.filter((n) => n.role === 'design');
    const firstSlotOrder = Math.min(...designs.map((n) => n.order), ...scope.filter((n) => n.role === 'printArea').map((n) => n.order), Infinity);
    for (const cb of new Set(colors.map((n) => n.clipBase).filter((x): x is N => !!x))) {
      if (cb.role === undefined || cb.role === 'static') set(cb, 'base', 'là clipping base của layer màu');
    }
    let base = scope.find((n) => n.role === 'base');
    if (!base) {
      const area = (n: N) => ((n.layer.right ?? 0) - (n.layer.left ?? 0)) * ((n.layer.bottom ?? 0) - (n.layer.top ?? 0));
      // ảnh sản phẩm thường là cutout có nền trong suốt → loại layer nền phủ kín canvas
      const isBackground = (n: N) => area(n) >= 0.98 * W * H && isOpaque(n.layer.imageData as RawImage | undefined);
      const pool = scope.filter((n) => n.role === undefined && n.order < firstSlotOrder);
      const cand = (pool.filter((n) => !isBackground(n)).length ? pool.filter((n) => !isBackground(n)) : pool).sort((a, b) => area(b) - area(a))[0];
      if (cand) { set(cand, 'base', 'layer ảnh lớn nhất nằm dưới design'); base = cand; }
    }
    // template kiểu "mỗi màu 1 ảnh": ảnh đang hiện mang tên màu cũng là 1 biến thể, không phải base
    const hasImageVariants = colors.some((n) => n.type !== 'fill') && !colors.some((n) => n.type === 'fill');
    if (base && hasImageVariants && base.type === 'pixel' && COLOR_WORDS.some((w) => hasWord(base!.norm, w))) {
      set(base, 'color', 'ảnh màu đang hiện (template dạng mỗi màu 1 ảnh)');
      base = undefined;
    }
    for (const n of scope) {
      if (n.role !== undefined || n.type === 'group') continue;
      const blend = n.layer.blendMode ?? 'normal';
      if (n.order > firstSlotOrder && (blend !== 'normal' || n.clipBase === base)) set(n, 'overlay', `nằm trên design, blend ${blend}`);
      else set(n, 'static', 'layer hiển thị khác');
    }
    const imageVariants = scope.filter((n) => n.role === 'color' && n.type !== 'fill');
    if (!base && !imageVariants.length) issue('error', 'NO_BASE', `Side "${key}": không tìm thấy ảnh sản phẩm (base)`, c?.ref);

    /* 3b. Print areas */
    const areas: PrintArea[] = [];
    const usedAreaKeys = new Set<string>();
    const areaKeyOf = (n: N) => {
      const ov = profile?.overrides?.[n.ref]?.area ?? profile?.overrides?.[n.path]?.area;
      const k0 = ov || (n.tags.design ? slug(n.tags.design) : '') || (n.tags.printarea ? slug(n.tags.printarea) : '') || aliasLookup(n.norm, areaAliases) || 'main';
      let k = k0, i = 2;
      while (usedAreaKeys.has(k)) k = `${k0}_${i++}`;
      usedAreaKeys.add(k);
      return k;
    };
    const sizeFromName = (n: N, physical?: PrintArea['physical']) => {
      const fromTag = n.tags.size ? parsePixels(n.tags.size) : undefined;
      const px = fromTag ?? parsePixels(n.name);
      if (px) return { size: px, guessed: false };
      if (physical) {
        const dpi = n.tags.dpi ? +n.tags.dpi : defaultDpi;
        const f = dpi / UNIT_PER_INCH[physical.unit];
        return { size: { width: Math.round(physical.width * f), height: Math.round(physical.height * f) }, guessed: false };
      }
      return undefined;
    };

    for (const d of designs) {
      const l = d.layer;
      const pl = l.placedLayer;
      if (pl) {
        const quad = quadFromArray(pl.nonAffineTransform ?? pl.transform);
        const dpi = pl.resolution?.value;
        const w = pl.width ?? 0, h = pl.height ?? 0;
        const area: PrintArea = {
          key: areaKeyOf(d), ref: d.ref, quad, designSize: { width: w, height: h }, dpi,
          physical: parsePhysical(d.norm) ?? (dpi ? { width: +(w / dpi).toFixed(2), height: +(h / dpi).toFixed(2), unit: 'in' } : undefined),
          source: 'smartObject',
          clipTo: l.clipping ? d.clipBase?.ref : undefined,
        };
        const warp = pl.warp;
        if (warp?.style && warp.style !== 'none') {
          const mesh = warp.customEnvelopeWarp?.meshPoints;
          if (warp.style === 'custom' && mesh?.length) {
            const cols = warp.deformNumCols ?? warp.uOrder ?? 4, rows = warp.deformNumRows ?? warp.vOrder ?? 4;
            const bw = warp.bounds ? warp.bounds.right.value - warp.bounds.left.value : w;
            const bh = warp.bounds ? warp.bounds.bottom.value - warp.bounds.top.value : h;
            const bx = warp.bounds?.left.value ?? 0, by = warp.bounds?.top.value ?? 0;
            const identity = mesh.every((p, i) => Math.abs(p.x - (bx + (bw * (i % cols)) / (cols - 1))) < 0.5 && Math.abs(p.y - (by + (bh * Math.floor(i / cols)) / (rows - 1))) < 0.5);
            if (!identity) {
              if ((warp.customEnvelopeWarp?.quiltSliceX?.length ?? 0) > 2 || mesh.length !== cols * rows) {
                issue('warn', 'WARP_UNSUPPORTED', `Smart object "${d.clean}" dùng warp nhiều lưới (quilt) – chỉ áp transform 4 góc`, d.ref);
              } else {
                const map = squareToQuad(quad);
                area.warp = { kind: 'bezier', cols, rows, points: mesh.map((p) => map((p.x - bx) / bw, (p.y - by) / bh)) } satisfies MeshWarp;
              }
            }
          } else {
            issue('warn', 'WARP_UNSUPPORTED', `Smart object "${d.clean}" dùng warp preset "${warp.style}" – chỉ áp transform 4 góc`, d.ref);
          }
        }
        if (pl.nonAffineTransform) issue('info', 'PERSPECTIVE', `"${d.clean}" có perspective – renderer dùng homography`, d.ref);
        areas.push(area);
      } else {
        const rect: Rect = alphaBounds(l) ?? [l.left ?? 0, l.top ?? 0, l.right ?? 0, l.bottom ?? 0];
        const physical = parsePhysical(d.norm);
        const s = sizeFromName(d, physical);
        if (!s) issue('warn', 'DESIGN_SIZE_GUESSED', `"${d.clean}": không có kích thước print file (thêm "4200x4800" hoặc "14x16 in" vào tên) → tạm tính ×4 kích thước khung`, d.ref);
        areas.push({
          key: areaKeyOf(d), ref: d.ref, quad: rectToQuad(rect), physical, source: 'placeholder',
          designSize: s?.size ?? { width: Math.round((rect[2] - rect[0]) * 4), height: Math.round((rect[3] - rect[1]) * 4) },
          dpi: physical ? defaultDpi : undefined,
          clipTo: l.clipping ? d.clipBase?.ref : undefined,
        });
      }
    }

    // guide (print area shape) → gắn vào slot design trùng nhất, hoặc tự thành 1 vùng in
    for (const g of scope.filter((n) => n.role === 'printArea')) {
      const l = g.layer;
      let rect: Rect = alphaBounds(l) ?? [l.left ?? 0, l.top ?? 0, l.right ?? 0, l.bottom ?? 0];
      const knots = l.vectorMask?.paths.flatMap((p) => p.knots.map((k) => [k.points[2], k.points[3]] as Pt));
      if (knots?.length) rect = [Math.min(...knots.map((p) => p[0])), Math.min(...knots.map((p) => p[1])), Math.max(...knots.map((p) => p[0])), Math.max(...knots.map((p) => p[1]))];
      rect = rect.map((v) => Math.round(v * 100) / 100) as Rect;
      const best = areas.map((a) => ({ a, s: iou(quadBounds(a.quad), rect) })).sort((x, y) => y.s - x.s)[0];
      const physical = parsePhysical(g.norm);
      if (best && best.s > 0.5 && !best.a.guide) {
        best.a.guide = { ref: g.ref, rect };
        if (physical) {
          if (best.a.physical && (Math.abs(best.a.physical.width - physical.width) > 0.1 || Math.abs(best.a.physical.height - physical.height) > 0.1) && best.a.physical.unit === physical.unit)
            issue('warn', 'SIZE_MISMATCH', `Guide "${g.clean}" ghi ${physical.width}x${physical.height}${physical.unit} nhưng smart object là ${best.a.physical.width}x${best.a.physical.height}${best.a.physical.unit}`, g.ref);
          best.a.physical ??= physical;
        }
      } else {
        const s = sizeFromName(g, physical);
        if (!s) issue('warn', 'DESIGN_SIZE_GUESSED', `Vùng in "${g.clean}" không ghi kích thước → tạm tính ×4 kích thước khung`, g.ref);
        areas.push({
          key: areaKeyOf(g), ref: g.ref, quad: rectToQuad(rect), physical, source: 'guide', guide: { ref: g.ref, rect },
          designSize: s?.size ?? { width: Math.round((rect[2] - rect[0]) * 4), height: Math.round((rect[3] - rect[1]) * 4) },
          dpi: physical ? defaultDpi : undefined,
        });
      }
    }
    if (!areas.length) issue('error', 'NO_PRINT_AREA', `Side "${key}": không có smart object / vùng in nào`, c?.ref);
    for (const a of areas) {
      const q = quadSize(a.quad);
      const r1 = q.width / q.height, r2 = a.designSize.width / a.designSize.height;
      if (Math.abs(r1 / r2 - 1) > 0.02) issue('warn', 'ASPECT_MISMATCH', `Vùng "${a.key}" (${key}): tỉ lệ khung trên mockup ${r1.toFixed(3)} ≠ print file ${r2.toFixed(3)}`, a.ref);
    }

    /* 3c. Render stack + màu */
    const stack: RenderNode[] = [];
    const sideColors: string[] = [];
    let defaultColor: string | undefined;
    const designRefToArea = new Map(areas.map((a) => [a.ref, a.key]));
    for (const n of scope) {
      if (n.role === 'printArea') {
        // vùng in chỉ có guide (không có smart object/placeholder) → design được vẽ tại vị trí guide
        const ga = areas.find((a) => a.source === 'guide' && a.ref === n.ref);
        if (ga) stack.push({ kind: 'design', ref: n.ref, blend: 'normal', opacity: 1, areaKey: ga.key });
        continue;
      }
      if (n.type === 'group' || !n.role || n.role === 'ignore') continue;
      const l = n.layer;
      const blend = l.blendMode ?? 'normal';
      if (!CANVAS_BLENDS.has(blend)) issue('info', 'BLEND_APPROX', `"${n.clean}" blend "${blend}" → canvas không có, sẽ xấp xỉ`, n.ref);
      const common = { ref: n.ref, blend, opacity: effOpacity(n, cref), clipTo: l.clipping ? n.clipBase?.ref : undefined, mask: addMask(n, key) };

      if (n.role === 'color') {
        const ov = profile?.overrides?.[n.ref]?.color ?? profile?.overrides?.[n.path]?.color;
        const name = ov || n.tags.color || n.clean;
        const ck = slug(name);
        let hex: string | undefined;
        if (n.type === 'fill') {
          const f = l.vectorFill;
          if (f?.type !== 'color') { issue('warn', 'FILL_UNSUPPORTED', `Layer màu "${n.clean}" là ${f?.type} fill – chỉ hỗ trợ solid color`, n.ref); continue; }
          hex = toHex(f.color as { r: number; g: number; b: number });
          // fill không clip & không mask → tự clip vào base để không tô cả nền
          const clipTo = common.clipTo ?? (common.mask ? undefined : base?.ref);
          if (!common.clipTo && !common.mask && base) issue('info', 'COLOR_AUTO_CLIP', `"${n.clean}" không clip/mask → tự clip vào "${base.clean}"`, n.ref);
          stack.push({ kind: 'color', ...common, clipTo, colorKey: ck, hex });
        } else {
          hex = averageHex(l.imageData as RawImage | undefined);
          stack.push({ kind: 'image', role: 'base', ...common, asset: addAsset(n, key), colorKey: ck });
        }
        if (!colorMap.has(ck)) colorMap.set(ck, { key: ck, name, hex: hex ?? '#cccccc' });
        sideColors.push(ck);
        if (!l.hidden && !defaultColor) defaultColor = ck;
      } else if (n.role === 'design') {
        const areaKey = designRefToArea.get(n.ref);
        // placeholder pixel/shape thường để mờ cho dễ nhìn → không áp opacity/blend của nó lên design thật
        const placeholder = n.type !== 'smartObject';
        if (areaKey) stack.push({ kind: 'design', ...common, ...(placeholder ? { opacity: 1, blend: 'normal', mask: undefined } : {}), areaKey });
      } else {
        stack.push({ kind: 'image', role: n.role as 'base' | 'overlay' | 'static', ...common, asset: addAsset(n, key) });
      }
    }
    // biến thể ảnh: chỉ 1 ảnh hiện tại 1 thời điểm → mặc định ảnh đầu tiên
    if (!defaultColor && imageVariants.length) defaultColor = slug(imageVariants[0].tags.color || imageVariants[0].clean);
    sides.push({ key, label: c?.clean ?? 'Root', ref: cref, stack, printAreas: areas, colors: sideColors, defaultColor });
  });

  if (!sides.length) issue('error', 'NO_SIDES', 'Không nhận diện được side nào');
  const allColorKeys = [...colorMap.keys()];
  for (const s of sides) {
    const missing = allColorKeys.filter((k) => !s.colors.includes(k));
    if (missing.length && s.colors.length) issue('warn', 'COLOR_MISSING_ON_SIDE', `Side "${s.key}" thiếu màu: ${missing.join(', ')}`);
  }

  const layers: LayerReport[] = all.map((n) => ({
    ref: n.ref, path: n.path, name: n.name, type: n.type,
    role: n.type === 'group' ? 'group' : n.role ?? 'ignore', reason: n.reason, side: n.side,
    hidden: !!n.layer.hidden, blend: n.layer.blendMode ?? 'normal', clipping: !!n.layer.clipping,
  }));

  return {
    spec: {
      version: 1, parser: PARSER_VERSION, profile: profile?.name, fileName: opts.fileName,
      canvas: { width: W, height: H }, sides, colors: [...colorMap.values()], assets, issues, layers,
    },
    images,
  };
}

/** bbox thật của phần có pixel (layer có thể được lưu full-canvas dù nội dung nhỏ) */
function alphaBounds(l: Layer): Rect | undefined {
  const img = l.imageData as RawImage | undefined;
  if (!img || l.vectorMask) return;
  let minX = img.width, minY = img.height, maxX = -1, maxY = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (img.data[(y * img.width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return;
  const ox = l.left ?? 0, oy = l.top ?? 0;
  return [ox + minX, oy + minY, ox + maxX + 1, oy + maxY + 1];
}

function isOpaque(img?: RawImage): boolean {
  if (!img) return false;
  for (let i = 3; i < img.data.length; i += 4 * 97) if (img.data[i] < 250) return false;
  return true;
}

function averageHex(img?: RawImage): string | undefined {
  if (!img) return;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < img.data.length; i += 16) {
    if (img.data[i + 3] < 200) continue;
    r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; n++;
  }
  return n ? toHex({ r: r / n, g: g / n, b: b / n }) : undefined;
}
