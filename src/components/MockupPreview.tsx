'use client';
import { useEffect, useMemo, useState } from 'react';
import { renderInWorker, toPngBlob } from '@/lib/mockup-engine/browser';
import { effectiveDpi, type Align, type Fit } from '@/lib/mockup-engine/raster';
import type { MockupSpec, SpecNode } from '@/lib/mockup-engine/types';

const BASES = [
  { id: '/mockups/tshirt-mockup', label: 'Mockup (ảnh thật)' },
  { id: '/mockups/tshirt-template', label: 'Template (phôi)' },
];

// các layer Solid Color đang ẩn = biến thể màu có thể bật
const colorVariants = (ls: SpecNode[]): string[] =>
  ls.flatMap(l => (l.type === 'group' ? colorVariants(l.children) : l.type === 'solid' && l.hidden ? [l.path] : []));

export default function MockupPreview() {
  const [base, setBase] = useState(BASES[0].id);
  const [spec, setSpec] = useState<MockupSpec | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [artSize, setArtSize] = useState<[number, number] | null>(null);
  const [fit, setFit] = useState<Fit>('contain');
  const [align, setAlign] = useState<Align>('center');
  const [color, setColor] = useState('');
  const [url, setUrl] = useState<string | null>(null);
  // Lần render đã xong / lỗi gắn với bộ tham số của nó; đang dựng khi chưa khớp bộ hiện tại
  const [done, setDone] = useState<unknown[] | null>(null);
  const [failure, setFailure] = useState<{ deps: unknown[]; message: string } | null>(null);

  useEffect(() => { fetch(`${base}/spec.json`).then(r => r.json()).then(setSpec); }, [base]);
  useEffect(() => {
    if (!file) return;
    createImageBitmap(file).then(b => { setArtSize([b.width, b.height]); b.close(); });
  }, [file]);

  useEffect(() => {
    if (!spec) return;
    let alive = true, made: string | null = null;
    const deps = [spec, base, file, fit, align, color];
    const t0 = performance.now();
    renderInWorker({
      base, art: file ?? undefined, placement: { fit, align },
      options: { visibility: color ? { [color]: true } : undefined },
    })
      .then(r => toPngBlob(r, '#ffffff'))
      .then(b => { if (!alive) return; made = URL.createObjectURL(b); setUrl(made); console.log('render', Math.round(performance.now() - t0), 'ms'); })
      .catch(e => alive && setFailure({ deps, message: String(e) }))
      .finally(() => alive && setDone(deps));
    return () => { alive = false; if (made) URL.revokeObjectURL(made); };
  }, [spec, base, file, fit, align, color]);

  const same = (a: unknown[] | null | undefined) => !!a && [spec, base, file, fit, align, color].every((v, i) => v === a[i]);
  const busy = !!spec && !same(done);
  const err = same(failure?.deps) ? failure!.message : '';
  const slot = spec?.slots[0];
  const dpi = useMemo(() => (slot && artSize ? effectiveDpi(artSize[0], artSize[1], slot.width, slot.height, slot.dpi, { fit, align }) : null), [slot, artSize, fit, align]);
  const variants = spec ? colorVariants(spec.layers) : [];

  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 1000 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select value={base} onChange={e => { setBase(e.target.value); setColor(''); }}>{BASES.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}</select>
        <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        <select value={fit} onChange={e => setFit(e.target.value as Fit)}>
          <option value="contain">Vừa khung (contain)</option><option value="cover">Phủ kín (cover)</option>
          <option value="stretch">Kéo giãn</option><option value="none">Giữ kích thước gốc</option>
        </select>
        <select value={align} onChange={e => setAlign(e.target.value as Align)}>
          <option value="center">Giữa</option><option value="top">Trên</option><option value="bottom">Dưới</option>
        </select>
        {variants.length > 0 && (
          <select value={color} onChange={e => setColor(e.target.value)}>
            <option value="">Màu gốc</option>
            {variants.map(v => <option key={v} value={v}>{v.split('/').pop()}</option>)}
          </select>
        )}
      </div>
      {slot && <small>Vùng in: {slot.width}×{slot.height}px @ {slot.dpi} DPI = {(slot.width / slot.dpi).toFixed(1)}×{(slot.height / slot.dpi).toFixed(1)} in{dpi !== null && <> · ảnh của bạn in ra ≈ <b style={{ color: dpi < 150 ? 'crimson' : 'inherit' }}>{Math.round(dpi)} DPI</b></>}</small>}
      {spec?.warnings.length ? <details><summary>{spec.warnings.length} cảnh báo khi biên dịch PSD</summary><ul>{spec.warnings.map(w => <li key={w}>{w}</li>)}</ul></details> : null}
      {busy && <p>Đang dựng…</p>}
      {err && <p style={{ color: 'crimson' }}>{err}</p>}
      {url && (<>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Mockup" style={{ width: '100%', height: 'auto' }} />
        <a href={url} download="mockup.png">Tải PNG</a>
      </>)}
    </div>
  );
}
