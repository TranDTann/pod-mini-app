// Chạy engine trên nhiều file PSD do Photoshop lưu và so với ảnh gộp (composite) của chính Photoshop.
//   npx tsx scripts/validate-suite.ts <tmpDir> <file.psd> [...]
// In mỗi file một dòng: MAE (0..255), p99, max, số pixel lệch > 2, cảnh báo.
import fs from 'node:fs';
import path from 'node:path';
import { compilePsd } from '../src/lib/mockup-engine/compile-node';
import { MockupRenderer, type SlotInput } from '../src/lib/mockup-engine/engine';
import { dirLoader, readImage } from '../src/lib/mockup-engine/node';
import type { RGBA } from '../src/lib/mockup-engine/types';

function cmp(a: RGBA, b: RGBA) {
  // so sau khi ghép lên nền trắng (composite của PSD không có nền trong suốt thì alpha = 255)
  let s = 0, mx = 0, bad = 0; const H: number[] = [];
  const n = a.width * a.height;
  for (let i = 0; i < n; i++) {
    let d = 0;
    for (let c = 0; c < 3; c++) {
      const va = (a.data[i * 4 + c] * a.data[i * 4 + 3] + 255 * (255 - a.data[i * 4 + 3])) / 255;
      const vb = (b.data[i * 4 + c] * b.data[i * 4 + 3] + 255 * (255 - b.data[i * 4 + 3])) / 255;
      const e = Math.abs(va - vb); s += e; if (e > d) d = e;
    }
    if (d > mx) mx = d; if (d > 2) bad++; if (i % 7 === 0) H.push(d);
  }
  H.sort((p, q) => p - q);
  return { mae: s / (3 * n), p99: H[Math.floor(H.length * 0.99)] ?? 0, max: mx, bad: bad / n };
}

async function main() {
  const [, , tmp, ...files] = process.argv;
  const rows: string[] = [];
  for (const f of files) {
    const name = path.relative(process.cwd(), f).replace(/^.*psd_files\//, '').replace(/^.*test\/read\//, 'ag:');
    const out = path.join(tmp, name.replace(/[/:]/g, '_'));
    try {
      fs.rmSync(out, { recursive: true, force: true });
      const spec = await compilePsd(f, out);
      if (!spec.compositeSrc) { rows.push(`${name.padEnd(48)}  (không có composite)  ${spec.warnings.length} cảnh báo`); continue; }
      const ref = await readImage(path.join(out, spec.compositeSrc));
      const r = await MockupRenderer.create(spec, dirLoader(out));
      const a = cmp(await r.render({ emptySlot: 'preview' }), ref);
      let extra = '';
      const slots: Record<string, SlotInput> = {};
      for (const s of spec.slots) if (s.contentSrc) slots[s.key] = { content: await readImage(path.join(out, s.contentSrc)) };
      if (Object.keys(slots).length) {
        const b = cmp(await r.render({ slots }), ref);
        extra = ` | dựng lại SO: MAE ${b.mae.toFixed(3)} p99 ${b.p99.toFixed(1)} max ${b.max.toFixed(0)}`;
      }
      rows.push(`${name.padEnd(48)}  MAE ${a.mae.toFixed(3).padStart(7)}  p99 ${a.p99.toFixed(1).padStart(5)}  max ${a.max.toFixed(0).padStart(3)}  >2: ${(a.bad * 100).toFixed(2).padStart(6)}%${extra}${spec.warnings.length ? `  ⚠ ${spec.warnings.length}: ${spec.warnings.map(w => w.slice(0, 70)).join(' | ')}` : ''}`);
    } catch (e) {
      rows.push(`${name.padEnd(48)}  LỖI: ${String(e).slice(0, 160)}`);
    }
    console.log(rows[rows.length - 1]);
  }
}
main();
