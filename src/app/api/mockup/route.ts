// POST /api/mockup  multipart: image=<file>, mockup=tshirt-mockup|tshirt-template, fit, align, color=<layer path>
import fs from 'node:fs';
import path from 'node:path';
import { MockupRenderer } from '@/lib/mockup-engine/engine';
import { dirLoader, readImage, toPng } from '@/lib/mockup-engine/node';
import type { Align, Fit } from '@/lib/mockup-engine/raster';
import type { MockupSpec } from '@/lib/mockup-engine/types';

const cache = new Map<string, Promise<MockupRenderer>>();

function renderer(id: string) {
  if (!/^[\w-]+$/.test(id)) throw new Error('bad mockup id');
  let r = cache.get(id);
  if (!r) {
    const dir = path.join(process.cwd(), 'public', 'mockups', id);
    const spec: MockupSpec = JSON.parse(fs.readFileSync(path.join(dir, 'spec.json'), 'utf8'));
    r = MockupRenderer.create(spec, dirLoader(dir));
    cache.set(id, r);
  }
  return r;
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get('image');
  if (!(file instanceof Blob)) return new Response('missing "image"', { status: 400 });
  const r = await renderer(String(form.get('mockup') ?? 'tshirt-mockup'));
  const art = await readImage(Buffer.from(await file.arrayBuffer()));
  const color = form.get('color') ? String(form.get('color')) : undefined;
  const out = await r.render({
    slots: { [String(form.get('slot') ?? r.spec.slots[0].key)]: { art, placement: { fit: (form.get('fit') as Fit) ?? 'contain', align: (form.get('align') as Align) ?? 'center' } } },
    visibility: color ? { [color]: true } : undefined,
  });
  const png = await toPng(out, { background: [255, 255, 255] });
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
}
