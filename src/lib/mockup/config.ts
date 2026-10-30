// Thông số trích xuất trực tiếp từ T-Shirt_Mockup.psd (layer "Smart Object Image").
// Đã kiểm chứng: dựng lại bằng các số này khớp ảnh Photoshop tự render (sai số trung bình 0.3/255).

/** Thông số smart object của một mockup (trích từ PSD: xem extract.ts / scripts/extract_psd.py). */
export type MockupConfig = {
  canvas: { width: number; height: number };
  smartObject: { width: number; height: number };
  /** nonAffineTransform: TL, TR, BR, BL */
  quad: readonly (readonly [number, number])[];
  /** 16 điểm lưới warp, index = 4*row + col */
  meshX: readonly number[];
  meshY: readonly number[];
  printArea: { x: number; y: number; width: number; height: number };
  effectOpacity: number;
  templatePrintArea?: { x: number; y: number; width: number; height: number };
};

export const MOCKUP: MockupConfig = {
  /** Kích thước canvas mockup */
  canvas: { width: 3000, height: 2000 },

  /** Kích thước nội dung smart object (Design.psd) */
  smartObject: { width: 3613, height: 3061 },

  /**
   * nonAffineTransform: 4 góc (TL, TR, BR, BL) trên canvas mockup.
   * LƯU Ý: tứ giác này bao bounding-box của 16 điểm lưới warp, KHÔNG phải bao khung 3613×3061.
   */
  quad: [
    [735.0, 131.71875],
    [2193.0, 203.71875],
    [2414.377462516426, 1984.277293467094],
    [810.0, 1880.71875],
  ],

  /**
   * warp.customEnvelopeWarp.meshPoints — lưới Bezier 4×4, thứ tự theo hàng (index = 4*row + col),
   * toạ độ pixel trong không gian smart object. Hrzn = x, Vrtc = y.
   */
  meshX: [
    1443.678760361929, 1635.1456912585238, 2408.6666666666665, 3745.1556106633616,
    691.5371751660028, 3303.7883180078456, 1812.9837253504913, 4544.809051456914,
    0.0, 2246.005799648615, 1907.2291511194926, 3613.0,
    0.0, 1204.3333333333333, 2408.6666666666665, 3613.0,
  ],
  meshY: [
    129.05762578482074, 848.0307927944405, 0.0, -233.5076124725677,
    1572.0351497028048, 1592.8206226951197, 55.02916010779066, 1042.84205833943,
    2040.6666666666665, 2139.772967562093, 1293.5695790777381, 2040.6666666666665,
    3061.0, 3061.0, 3061.0, 3061.0,
  ],

  /** Layer mask của layer "Mask" (fill trắng) = vùng in hiển thị. Smart object bị clip vào đây. */
  printArea: { x: 1266, y: 671, width: 558, height: 499 },

  /** Group "Smart Object": blend Linear Burn. Group "Effect": Multiply, fill 179/255 (~70.2%). */
  effectOpacity: 179 / 255,

  /** Vùng in trên file phôi T-Shirt_Template.psd (2000×2000), shape "Print area" mặt trước */
  templatePrintArea: { x: 684, y: 692, width: 642, height: 595 },
};

export type Fit = 'cover' | 'contain' | 'stretch';
