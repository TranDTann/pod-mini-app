// POST /api/mockup   (multipart: image=<file>, mode=straight|photoshop)  → image/png
// (Node.js runtime là mặc định; cacheComponents không cho khai báo `runtime`)
import { renderMockupServer, type Mode } from '@/lib/mockup/server';

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get('image');
  if (!(file instanceof Blob)) return new Response('missing "image"', { status: 400 });
  const mode = (form.get('mode') as Mode) || 'straight';
  const png = await renderMockupServer(Buffer.from(await file.arrayBuffer()), mode);
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
}
