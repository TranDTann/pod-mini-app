/**
 * Normalized template schema.
 *
 * Mọi file PSD (dù cấu trúc layer khác nhau) đều được parse về đúng 1 schema này.
 * App (upload, preview, tạo print file) CHỈ làm việc với TemplateSpec,
 * không bao giờ đọc trực tiếp layer PSD nữa.
 */

export type Pt = [number, number];
/** 4 góc vùng in trên mockup, thứ tự: TL, TR, BR, BL (đơn vị px của canvas PSD) */
export type Quad = [Pt, Pt, Pt, Pt];
export type Rect = [left: number, top: number, right: number, bottom: number];

export type Role =
  | 'base' //       ảnh sản phẩm (áo) — là "đáy" cho các layer màu clip vào
  | 'color' //      biến thể màu (fill layer clip + multiply…)
  | 'design' //     slot chứa thiết kế của khách (smart object / placeholder)
  | 'printArea' //  khung vùng in (shape/guide) — không render, chỉ lấy toạ độ + kích thước thật
  | 'overlay' //    bóng/nếp/highlight nằm TRÊN design (multiply/screen…)
  | 'static' //     layer hiển thị bình thường khác (nền, móc treo…)
  | 'ignore'; //    guide, watermark, layer ẩn không phải màu…

export type IssueLevel = 'error' | 'warn' | 'info';
export interface Issue {
  level: IssueLevel;
  code: string;
  message: string;
  ref?: string;
}

export interface ColorOption {
  key: string; // slug, dùng làm id
  name: string; // tên hiển thị (lấy từ tên layer)
  hex: string;
}

export interface MeshWarp {
  kind: 'bezier';
  cols: number;
  rows: number;
  /** control points đã quy đổi sang toạ độ mockup */
  points: Pt[];
}

export interface PrintArea {
  key: string; // 'main' | 'chest' | 'pocket' | …
  ref: string; // ref layer design slot (hoặc guide nếu không có slot)
  quad: Quad;
  /** kích thước print file (px) — VD 4200x4800 */
  designSize: { width: number; height: number };
  dpi?: number;
  physical?: { width: number; height: number; unit: 'in' | 'cm' | 'mm' };
  warp?: MeshWarp;
  clipTo?: string;
  guide?: { ref: string; rect: Rect };
  source: 'smartObject' | 'placeholder' | 'guide';
}

interface NodeBase {
  ref: string;
  blend: string; // blend mode gốc của PSD
  opacity: number; // 0..1 (đã nhân fillOpacity nếu có)
  clipTo?: string; // ref của clipping base
  mask?: { asset: string; defaultVisible: boolean }; // layer mask (đã đổi sang alpha)
}
export interface ImageNode extends NodeBase {
  kind: 'image';
  role: 'base' | 'overlay' | 'static';
  asset: string; // id asset (PNG đã tách)
  /** có giá trị = biến thể màu dạng ẢNH (mỗi màu 1 ảnh áo) → chỉ vẽ khi chọn đúng màu */
  colorKey?: string;
}
export interface ColorNode extends NodeBase {
  kind: 'color';
  colorKey: string;
  hex: string;
}
export interface DesignNode extends NodeBase {
  kind: 'design';
  areaKey: string;
}
export type RenderNode = ImageNode | ColorNode | DesignNode;

export interface SideSpec {
  key: string; // 'front' | 'back' | 'left_sleeve' | …
  label: string; // tên gốc
  ref: string; // ref của group chứa side ('' = root)
  /** thứ tự từ dưới lên trên — renderer chỉ việc chạy tuần tự */
  stack: RenderNode[];
  printAreas: PrintArea[];
  colors: string[]; // colorKey có ở side này
  defaultColor?: string;
}

export interface AssetInfo {
  id: string;
  ref: string;
  left: number;
  top: number;
  width: number;
  height: number;
  file?: string; // đường dẫn/URL sau khi upload lên storage
}

export interface LayerReport {
  ref: string;
  path: string;
  name: string;
  type: LayerType;
  role: Role | 'group';
  reason: string;
  side?: string;
  hidden: boolean;
  blend: string;
  clipping: boolean;
}

export type LayerType = 'group' | 'pixel' | 'smartObject' | 'fill' | 'shape' | 'adjustment' | 'text' | 'empty';

export interface TemplateSpec {
  version: 1;
  parser: string;
  profile?: string;
  fileName?: string;
  canvas: { width: number; height: number };
  sides: SideSpec[];
  colors: ColorOption[];
  assets: Record<string, AssetInfo>;
  issues: Issue[];
  /** toàn bộ layer + role đã nhận diện — dùng cho màn hình "mapping" của admin */
  layers: LayerReport[];
}

/**
 * Profile = cách "dạy" parser một dạng template mới mà không phải sửa code.
 * - overrides: gán cứng role/side/area cho layer theo ref ("0/6") hoặc path ("Front side/Design Front …").
 *   Màn hình mapping của admin chỉ cần lưu lại object này cho từng template.
 * - sideAliases / areaAliases: thêm từ khoá nhận diện (đa ngôn ngữ).
 */
export interface TemplateProfile {
  name: string;
  overrides?: Record<string, Partial<{ role: Role; side: string; area: string; color: string }>>;
  sideAliases?: Record<string, string[]>;
  areaAliases?: Record<string, string[]>;
  /** dpi mặc định khi template chỉ ghi kích thước vật lý (VD "12x16 in") */
  defaultDpi?: number;
}
