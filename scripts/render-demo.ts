// npx tsx scripts/render-demo.ts <art.png> <outDir>
// Biên dịch 2 PSD (nếu chưa) rồi dựng: mockup áo trắng, mockup áo đen, template.
import fs from 'node:fs';
import path from 'node:path';
import { compilePsd } from '../src/lib/mockup-engine/compile-node';
import { MockupRenderer } from '../src/lib/mockup-engine/engine';
import { dirLoader, readImage, writePng } from '../src/lib/mockup-engine/node';
import type { MockupSpec } from '../src/lib/mockup-engine/types';

async function load(psd: string, dir: string): Promise<MockupSpec> {
  const f = path.join(dir, 'spec.json');
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  return compilePsd(psd, dir);
}

async function main() {
  const [, , artPath, out = 'out'] = process.argv;
  fs.mkdirSync(out, { recursive: true });
  const art = await readImage(artPath);
  const mockDir = 'public/mockups/tshirt-mockup', tplDir = 'public/mockups/tshirt-template';
  const mock = await load(process.env.MOCKUP_PSD ?? 'psd/T-Shirt_Mockup.psd', mockDir);
  const tpl = await load(process.env.TEMPLATE_PSD ?? 'psd/T-Shirt_Template.psd', tplDir);
  const placement = { fit: 'contain' as const, align: 'center' as const };

  const rm = await MockupRenderer.create(mock, dirLoader(mockDir));
  const slot = mock.slots[0].key;
  let t = performance.now();
  await writePng(path.join(out, 'mockup_white.png'), await rm.render({ slots: { [slot]: { art, placement } } }), { background: [255, 255, 255] });
  console.log('mockup (lần đầu, gồm dựng nền):', (performance.now() - t).toFixed(0), 'ms');
  t = performance.now();
  await writePng(path.join(out, 'mockup_white_2.png'), await rm.render({ slots: { [slot]: { art, placement } } }), { background: [255, 255, 255] });
  console.log('mockup (lần 2, nền đã cache):', (performance.now() - t).toFixed(0), 'ms');
  const black = Object.fromEntries([['Áo (bật 1 layer màu để đổi màu áo)/Black', true]]);
  t = performance.now();
  await writePng(path.join(out, 'mockup_black.png'), await rm.render({ slots: { [slot]: { art, placement } }, visibility: black }), { background: [255, 255, 255] });
  console.log('mockup áo đen:', (performance.now() - t).toFixed(0), 'ms');

  const rt = await MockupRenderer.create(tpl, dirLoader(tplDir));
  const front = tpl.slots.find(s => /front/i.test(s.key))!.key;
  t = performance.now();
  await writePng(path.join(out, 'template_front.png'), await rt.render({ slots: { [front]: { art, placement } } }), { background: [255, 255, 255] });
  console.log('template:', (performance.now() - t).toFixed(0), 'ms');
}
main();
