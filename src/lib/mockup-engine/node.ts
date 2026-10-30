// Tiện ích Node: đọc/ghi PNG bằng sharp.
import path from 'node:path';
import sharp from 'sharp';
import type { RGBA } from './types';

export async function readImage(file: string | Buffer): Promise<RGBA> {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength) };
}
export const dirLoader = (dir: string) => (src: string) => readImage(path.join(dir, src));
export async function toPng(img: RGBA, opts: { background?: [number, number, number] } = {}) {
  let s = sharp(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength), { raw: { width: img.width, height: img.height, channels: 4 } });
  if (opts.background) s = s.flatten({ background: { r: opts.background[0], g: opts.background[1], b: opts.background[2] } });
  return s.png().toBuffer();
}
export async function writePng(file: string, img: RGBA, opts: { background?: [number, number, number] } = {}) {
  await import('node:fs').then(fs => toPng(img, opts).then(b => fs.writeFileSync(file, b)));
}
