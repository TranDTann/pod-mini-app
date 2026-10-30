// Bản server (Node) dùng sharp — cho API route hoặc script batch.
import path from 'node:path';
import sharp from 'sharp';
import { MOCKUP, type Fit } from './config';
import { buildUvLut, type UvLut } from './warp';
import { composeMockup, prepareMockup, warpSmartObject, type PreparedMockup, type RGBA } from './render';

export type Mode = 'straight' | 'photoshop';

async function raw(input: string | Buffer): Promise<RGBA> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data };
}

let prepP: Promise<PreparedMockup> | null = null;
let lut: UvLut | null = null;

export function loadMockupServer(dir = path.join(process.cwd(), 'public', 'mockup')) {
  prepP ??= Promise.all([raw(path.join(dir, 'base.png')), raw(path.join(dir, 'effect.png'))])
    .then(([b, e]) => prepareMockup(b, e));
  return prepP;
}

export async function renderMockupServer(art: Buffer, mode: Mode = 'straight', fit: Fit = 'cover'): Promise<Buffer> {
  const prep = await loadMockupServer();
  const { width: rw, height: rh } = MOCKUP.printArea;
  let layer: RGBA;
  if (mode === 'straight') {
    const sharpFit = fit === 'stretch' ? 'fill' : fit; // cover | contain | fill
    layer = await raw(
      await sharp(art).ensureAlpha()
        .resize(rw, rh, { fit: sharpFit, position: 'centre', kernel: 'lanczos3', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png().toBuffer(),
    );
  } else {
    const sw = Math.round(MOCKUP.smartObject.width * 0.5), sh = Math.round(MOCKUP.smartObject.height * 0.5);
    const so = await raw(
      await sharp(art).ensureAlpha()
        .resize(sw, sh, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png().toBuffer(),
    );
    lut ??= buildUvLut(MOCKUP, 96, 2);
    layer = warpSmartObject(so, lut);
  }
  const out = composeMockup(prep, layer);
  return sharp(Buffer.from(out.buffer), { raw: { width: prep.width, height: prep.height, channels: 4 } })
    .removeAlpha().png().toBuffer();
}
