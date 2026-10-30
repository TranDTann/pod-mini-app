'use client';
import { useEffect, useState } from 'react';
import { renderMockup, type Mode } from '@/lib/mockup/browser';

export default function MockupPreview() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<Mode>('straight');
  const [url, setUrl] = useState<string | null>(null);
  // Lần render đã xong cho (file, mode) nào — đang dựng khi chưa khớp
  const [doneFor, setDoneFor] = useState<{ file: File; mode: Mode } | null>(null);
  const busy = !!file && (doneFor?.file !== file || doneFor.mode !== mode);

  useEffect(() => {
    if (!file) return;
    let alive = true;
    let made: string | null = null;
    renderMockup(file, mode)
      .then(blob => {
        if (!alive) return;
        made = URL.createObjectURL(blob);
        setUrl(made);
      })
      .finally(() => alive && setDoneFor({ file, mode }));
    return () => { alive = false; if (made) URL.revokeObjectURL(made); };
  }, [file, mode]);

  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 960 }}>
      <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] ?? null)} />
      <label>
        <select value={mode} onChange={e => setMode(e.target.value as Mode)}>
          <option value="straight">Thẳng, phủ kín vùng in (khuyên dùng)</option>
          <option value="photoshop">Giống Photoshop (giữ warp của PSD)</option>
        </select>
      </label>
      {busy && <p>Đang dựng mockup…</p>}
      {url && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Mockup" style={{ width: '100%', height: 'auto' }} />
          <a href={url} download="mockup.png">Tải PNG</a>
        </>
      )}
    </div>
  );
}
