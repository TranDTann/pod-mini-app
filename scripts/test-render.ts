// npx tsx scripts/test-render.ts <ảnh-thiết-kế.png> [outDir]
import fs from 'node:fs';
import path from 'node:path';
import { renderMockupServer } from '../src/lib/mockup/server';
import { controlPointsOnCanvas, makeForwardMap } from '../src/lib/mockup/warp';

const [, , artPath, outDir = 'out'] = process.argv;
if (!artPath) { console.error('usage: tsx scripts/test-render.ts <art.png> [outDir]'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });

const { cx, cy } = controlPointsOnCanvas();
console.log('control points on canvas:', Array.from(cx, (x, i) => [x.toFixed(2), cy[i].toFixed(2)]));
const fwd = makeForwardMap();
console.log('Q(0,0)=', fwd(0, 0), ' Q(1,1)=', fwd(1, 1), ' Q(0.5,0.5)=', fwd(0.5, 0.5));

async function main() {
  const art = fs.readFileSync(artPath);
  for (const mode of ['straight', 'photoshop'] as const) {
    const t = performance.now();
    const png = await renderMockupServer(art, mode);
    fs.writeFileSync(path.join(outDir, `mockup_${mode}.png`), png);
    console.log(mode, `${(performance.now() - t).toFixed(0)} ms`);
  }
}
main();
