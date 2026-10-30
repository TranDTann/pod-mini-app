'use client';
// Gọi worker từ trình duyệt: render → ImageData / PNG Blob.
import type { MockupSpec } from './types';
import type { WorkerCompileRequest, WorkerRequest } from './worker';

type Result = { width: number; height: number; buffer: ArrayBuffer; warnings: string[] };
let worker: Worker | null = null;
let seq = 0;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each request resolves with its own reply shape
const pending = new Map<number, { res: (r: any) => void; rej: (e: Error) => void }>();

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.error) p.rej(new Error(e.data.error)); else p.res(e.data);
    };
  }
  return worker;
}

export function renderInWorker(req: Omit<WorkerRequest, 'id'>): Promise<Result> {
  const id = ++seq;
  return new Promise((res, rej) => { pending.set(id, { res, rej }); getWorker().postMessage({ ...req, id }); });
}

/** Như renderInWorker nhưng ảnh được mã hoá trong worker, không chiếm luồng UI. */
export function renderImageInWorker(req: Omit<WorkerRequest, 'id' | 'encode'>, format: 'png' | 'jpeg'): Promise<Blob> {
  const id = ++seq;
  return new Promise<{ blob: Blob }>((res, rej) => {
    pending.set(id, { res, rej });
    getWorker().postMessage({ ...req, encode: format, id });
  }).then(r => r.blob);
}

/** Biên dịch PSD upload trong worker; sau đó render bằng renderInWorker({ base: key, ... }). */
export function compileInWorker(req: Omit<WorkerCompileRequest, 'id' | 'compile'>): Promise<{ spec: MockupSpec; thumbnail: string }> {
  const id = ++seq;
  return new Promise((res, rej) => { pending.set(id, { res, rej }); getWorker().postMessage({ ...req, id, compile: true }, [req.buffer]); });
}

/** Giải phóng ảnh của một PSD đã biên dịch. */
export function releaseInWorker(key: string) {
  getWorker().postMessage({ release: key });
}

export async function toPngBlob(r: Result, background?: string): Promise<Blob> {
  const c = new OffscreenCanvas(r.width, r.height);
  const ctx = c.getContext('2d')!;
  if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, r.width, r.height); }
  const tmp = new OffscreenCanvas(r.width, r.height);
  tmp.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(r.buffer), r.width, r.height), 0, 0);
  ctx.drawImage(tmp, 0, 0);
  return c.convertToBlob({ type: 'image/png' });
}
