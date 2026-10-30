// Định dạng "spec" — bản biên dịch của một file PSD mockup/template, đủ để dựng lại không cần Photoshop.

export type BlendMode =
  | 'pass through' | 'normal' | 'dissolve'
  | 'darken' | 'multiply' | 'color burn' | 'linear burn' | 'darker color'
  | 'lighten' | 'screen' | 'color dodge' | 'linear dodge' | 'lighter color'
  | 'overlay' | 'soft light' | 'hard light' | 'vivid light' | 'linear light' | 'pin light' | 'hard mix'
  | 'difference' | 'exclusion' | 'subtract' | 'divide'
  | 'hue' | 'saturation' | 'color' | 'luminosity';

export type Rect = { left: number; top: number; width: number; height: number };

/** Ảnh RGBA 8-bit, alpha thường (straight). */
export type RGBA = { width: number; height: number; data: Uint8ClampedArray | Uint8Array };

export type RasterMask = Rect & {
  src: string;           // PNG xám
  defaultColor: number;  // 0..255 — giá trị ngoài vùng ảnh mask
  disabled?: boolean;
  density?: number;      // 0..1 (Properties > Density)
  feather?: number;      // px (Properties > Feather)
};

export type PathKnot = { points: number[] };   // [inX,inY, anchorX,anchorY, outX,outY] — px của canvas
export type VectorPath = {
  open: boolean;
  operation: 'combine' | 'subtract' | 'intersect' | 'xor' | 'exclude';
  fillRule: 'even-odd' | 'non-zero';
  knots: PathKnot[];
};
export type VectorMask = {
  paths: VectorPath[];
  invert?: boolean;
  disabled?: boolean;
  fillStartsWithAllPixels?: boolean;
  density?: number;
  feather?: number;
};

type NodeBase = {
  name: string;
  path: string;            // "Group/Sub/Layer" — dùng để bật/tắt hoặc đổi màu lúc render
  hidden: boolean;
  blendMode: BlendMode;
  opacity: number;         // 0..1
  fillOpacity: number;     // 0..1
  clipping: boolean;       // layer này clip vào layer bên dưới
  blendClippedAsGroup: boolean; // "Blend Clipped Layers as Group" (mặc định true)
  mask?: RasterMask;
  vectorMask?: VectorMask;
  /** vector mask đã được chính Photoshop raster hoá (kênh −2, cờ fromVectorData) — ưu tiên hơn tự raster */
  vectorMaskRaster?: RasterMask;
  /** Blend If: src/dst = [Gray, R, G, B], mỗi phần tử [đen0, đen1, trắng0, trắng1] (0..255) */
  blendIf?: { src: number[][]; dst: number[][] };
};

export type PixelNode = NodeBase & { type: 'pixel'; src: string } & Rect; // src rỗng = layer trống (vẫn giữ vì có thể là gốc của clipping)
export type SolidFillNode = NodeBase & { type: 'solid'; color: [number, number, number] };
export type GroupNode = NodeBase & { type: 'group'; children: SpecNode[] };
export type SmartFilter =
  | { type: 'gaussian blur'; radius: number; opacity: number; blendMode: BlendMode }
  | { type: 'adjust'; adjustment: { type: string; [k: string]: unknown }; opacity: number; blendMode: BlendMode };
export type SmartNode = NodeBase & {
  type: 'smart';
  slot: string;                       // khoá slot, vd "Design_Front_4200x4800"
  preview?: { src: string } & Rect;   // raster Photoshop lưu sẵn (dùng khi không truyền ảnh)
  geometry: Geometry;
  filters?: SmartFilter[];            // smart filter (áp SAU khi đã biến đổi hình học, như Photoshop)
};
/** Adjustment layer: tác động lên mọi thứ bên dưới (hoặc lên layer gốc nếu là layer clip). */
export type AdjustNode = NodeBase & { type: 'adjust'; adjustment: { type: string; [k: string]: unknown } };
export type SpecNode = PixelNode | SolidFillNode | GroupNode | SmartNode | AdjustNode;

/**
 * Hình học smart object, đã chuẩn hoá về một dạng duy nhất:
 * lưới Bezier từng mảnh (rows × cols điểm, rows = 3·nY + 1, cols = 3·nX + 1),
 * sliceX/sliceY = ranh giới các mảnh trong toạ độ nội dung (px),
 * quad = 4 góc (TL,TR,BR,BL) trên canvas, bao bbox của toàn bộ điểm lưới.
 * - Không warp       → 1 mảnh, lưới đều 4×4.
 * - Warp custom 4×4  → 1 mảnh.
 * - Split warp (quilt) → nX × nY mảnh.
 */
export type Geometry = {
  contentWidth: number;
  contentHeight: number;
  bounds: [number, number, number, number]; // left, top, right, bottom (không gian nội dung)
  quad: [number, number, number, number, number, number, number, number];
  rows: number;
  cols: number;
  meshX: number[];
  meshY: number[];
  sliceX: number[];
  sliceY: number[];
};

export type SlotInfo = { key: string; name: string; width: number; height: number; dpi: number; contentSrc?: string; layerPaths: string[] };

export type MockupSpec = {
  version: 1;
  source: string;
  width: number;
  height: number;
  layers: SpecNode[];       // dưới → trên
  slots: SlotInfo[];
  warnings: string[];
  compositeSrc?: string;    // ảnh gộp Photoshop lưu trong file (để đối chiếu)
};
