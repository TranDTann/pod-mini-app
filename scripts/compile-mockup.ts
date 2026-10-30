// npx tsx scripts/compile-mockup.ts <file.psd> <outDir>
import { compilePsd } from '../src/lib/mockup-engine/compile-node';
const [, , file, out] = process.argv;
if (!file || !out) { console.error('usage: tsx scripts/compile-mockup.ts <file.psd> <outDir>'); process.exit(1); }
compilePsd(file, out).then(spec => {
  console.log(`${spec.source}: ${spec.width}×${spec.height}, slots:`, spec.slots.map(s => `${s.key} (${s.width}×${s.height}) → ${s.layerPaths.join(', ')}`));
  if (spec.warnings.length) console.log('Cảnh báo:\n - ' + spec.warnings.join('\n - '));
});
