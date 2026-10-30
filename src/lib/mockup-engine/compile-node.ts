// Biên dịch PSD → spec.json + PNG trong một thư mục (Node, 1 lần cho mỗi mockup/template).
//   npx tsx scripts/compile-mockup.ts T-Shirt_Mockup.psd public/mockups/tshirt
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { readPsd } from 'ag-psd';
import { compilePsdData } from './compile';
import type { MockupSpec } from './types';

async function decodeLinked(data: Uint8Array, name: string): Promise<{ width: number; height: number; data: Uint8ClampedArray } | null> {
  if (/\.(psd|psb)$/i.test(name) || (data[0] === 0x38 && data[1] === 0x42 && data[2] === 0x50 && data[3] === 0x53)) {
    const p = readPsd(Buffer.from(data), { useImageData: true, skipThumbnail: true });
    if (p.imageData && !isUniform(p.imageData.data as Uint8ClampedArray)) {
      return { width: p.width, height: p.height, data: p.imageData.data as Uint8ClampedArray };
    }
    // composite không có (Maximize Compatibility tắt) → dựng lại bằng chính engine (biên dịch file lồng bên trong)
    const os = await import('node:os');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'so-'));
    try {
      const f = path.join(tmp, /\.psb$/i.test(name) ? 'c.psb' : 'c.psd');
      fs.writeFileSync(f, data);
      const spec = await compilePsd(f, path.join(tmp, 'out'));
      const { MockupRenderer } = await import('./engine');
      const { dirLoader } = await import('./node');
      const r = await MockupRenderer.create(spec, dirLoader(path.join(tmp, 'out')));
      const img = await r.render({ emptySlot: 'preview' });
      return { width: img.width, height: img.height, data: img.data as Uint8ClampedArray };
    } catch { return null; } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  }
  try {
    const { data: d, info } = await sharp(Buffer.from(data)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return { width: info.width, height: info.height, data: new Uint8ClampedArray(d.buffer, d.byteOffset, d.byteLength) };
  } catch { return null; }
}
function isUniform(d: Uint8ClampedArray) {
  // composite không được lưu (Maximize Compatibility tắt) → ảnh một màu
  for (let i = 4; i < d.length; i += 4 * 31) if (d[i] !== d[0] || d[i + 1] !== d[1] || d[i + 2] !== d[2] || d[i + 3] !== d[3]) return false;
  return true;
}

export async function compilePsd(file: string, outDir: string): Promise<MockupSpec> {
  fs.mkdirSync(outDir, { recursive: true });
  const spec = await compilePsdData(fs.readFileSync(file), path.basename(file), {
    decodeLinked,
    async save(src, img, gray) {
      const out = path.join(outDir, src);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      let s = sharp(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength), { raw: { width: img.width, height: img.height, channels: 4 } });
      if (gray) s = s.extractChannel(0);
      await s.png({ compressionLevel: 9 }).toFile(out);
    },
  });
  fs.writeFileSync(path.join(outDir, 'spec.json'), JSON.stringify(spec));
  return spec;
}
