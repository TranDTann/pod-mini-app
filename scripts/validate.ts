// Kiểm chứng engine với ảnh do chính Photoshop render (composite lưu trong PSD / raster của layer).
//   npx tsx scripts/validate.ts <outDir> <file.psd> [<file.psd> ...]
import fs from 'node:fs';
import path from 'node:path';
import { compilePsd } from '../src/lib/mockup-engine/compile-node';
import { MockupRenderer, type SlotInput } from '../src/lib/mockup-engine/engine';
import { dirLoader, readImage, writePng } from '../src/lib/mockup-engine/node';
import type { RGBA, SmartNode, SpecNode } from '../src/lib/mockup-engine/types';

function diff(a: RGBA, b: RGBA, rect?: [number, number, number, number]) {
  const [x0, y0, x1, y1] = rect ?? [0, 0, a.width, a.height];
  let s = 0, n = 0, mx = 0; const hist: number[] = [];
  for (let y = Math.max(0, y0); y < Math.min(a.height, y1); y++) for (let x = Math.max(0, x0); x < Math.min(a.width, x1); x++) {
    const o = (y * a.width + x) * 4;
    // so sánh premultiplied (màu × alpha) và alpha
    let d = 0;
    for (let c = 0; c < 4; c++) {
      const va = c < 3 ? (a.data[o + c] * a.data[o + 3]) / 255 : a.data[o + 3];
      const vb = c < 3 ? (b.data[o + c] * b.data[o + 3]) / 255 : b.data[o + 3];
      const e = Math.abs(va - vb); s += e; d = Math.max(d, e);
    }
    n += 4; mx = Math.max(mx, d); hist.push(d);
  }
  hist.sort((p, q) => p - q);
  return { mae: s / Math.max(1, n), p99: hist[Math.floor(hist.length * 0.99)] ?? 0, max: mx };
}

const smartNodes = (ls: SpecNode[]): SmartNode[] => ls.flatMap(l => (l.type === 'smart' ? [l] : l.type === 'group' ? smartNodes(l.children) : []));
const fmt = (d: { mae: number; p99: number; max: number }) => `MAE ${d.mae.toFixed(3)}  p99 ${d.p99.toFixed(1)}  max ${d.max.toFixed(0)}`;

async function main() {
  const [, , outRoot, ...files] = process.argv;
  for (const f of files) {
    const name = path.basename(path.dirname(f)) + '_' + path.basename(f, path.extname(f));
    const out = path.join(outRoot, name);
    fs.rmSync(out, { recursive: true, force: true });
    const spec = await compilePsd(f, out);
    const r = await MockupRenderer.create(spec, dirLoader(out));
    console.log(`\n### ${name}  (${spec.width}×${spec.height})`);
    if (spec.warnings.length) console.log('  cảnh báo: ' + spec.warnings.join(' | '));
    const ref = spec.compositeSrc ? await readImage(path.join(out, spec.compositeSrc)) : null;

    // 1) chỉ kiểm bộ ghép layer: dùng raster smart object do Photoshop lưu
    const t0 = performance.now();
    const a = await r.render({ emptySlot: 'preview' });
    if (ref) console.log(`  [ghép layer, raster SO có sẵn] ${fmt(diff(a, ref))}   (${(performance.now() - t0).toFixed(0)} ms)`);
    await writePng(path.join(out, '_render_preview.png'), a);

    // 2) kiểm cả hình học: dựng lại smart object từ nội dung gốc
    const slots: Record<string, SlotInput> = {};
    for (const s of spec.slots) if (s.contentSrc) slots[s.key] = { content: await readImage(path.join(out, s.contentSrc)) };
    if (Object.keys(slots).length) {
      const t1 = performance.now();
      const b = await r.render({ slots });
      const ms = performance.now() - t1;
      await writePng(path.join(out, '_render_full.png'), b);
      if (ref) console.log(`  [dựng lại SO + ghép]           ${fmt(diff(b, ref))}   (${ms.toFixed(0)} ms)`);
      // so riêng vùng smart object với raster PS (cô lập hình học)
      for (const sn of smartNodes(spec.layers)) {
        if (!sn.preview) continue;
        const only = await MockupRenderer.create({ ...spec, layers: [{ ...sn, mask: undefined, vectorMask: undefined, clipping: false, hidden: false, opacity: 1, fillOpacity: 1, blendMode: 'normal' }] }, dirLoader(out));
        const g = await only.render({ slots });
        const pv = await readImage(path.join(out, sn.preview.src));
        const full: RGBA = { width: spec.width, height: spec.height, data: new Uint8ClampedArray(spec.width * spec.height * 4) };
        for (let y = 0; y < pv.height; y++) for (let x = 0; x < pv.width; x++) {
          const X = x + sn.preview.left, Y = y + sn.preview.top;
          if (X < 0 || Y < 0 || X >= spec.width || Y >= spec.height) continue;
          for (let c = 0; c < 4; c++) full.data[(Y * spec.width + X) * 4 + c] = pv.data[(y * pv.width + x) * 4 + c];
        }
        const rect: [number, number, number, number] = [sn.preview.left - 4, sn.preview.top - 4, sn.preview.left + pv.width + 4, sn.preview.top + pv.height + 4];
        // alpha IoU
        let I = 0, U = 0;
        for (let y = Math.max(0, rect[1]); y < Math.min(spec.height, rect[3]); y++) for (let x = Math.max(0, rect[0]); x < Math.min(spec.width, rect[2]); x++) {
          const o = (y * spec.width + x) * 4 + 3, p = g.data[o] > 127, q = full.data[o] > 127;
          if (p && q) I++; if (p || q) U++;
        }
        console.log(`  [hình học SO "${sn.name}" vs raster lưu trong PSD] ${fmt(diff(g, full, rect))}  alpha-IoU ${(I / Math.max(1, U)).toFixed(4)}`);
        await writePng(path.join(out, `_so_${sn.slot}.png`), g);
      }
    }
  }
}
main();
