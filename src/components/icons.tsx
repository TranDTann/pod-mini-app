const S = 'currentColor'
const p = { xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24', stroke: S, strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

type IconProps = { className?: string }

export function IcUndo({ className }: IconProps) {
  return <svg {...p} className={className}><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
}
export function IcRedo({ className }: IconProps) {
  return <svg {...p} className={className}><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></svg>
}
export function IcFlipH({ className }: IconProps) {
  return <svg {...p} className={className}><path d="M12 3v18" strokeDasharray="2 2.5" /><path d="M9 6 3 18h6z" /><path d="M15 6l6 12h-6z" fill={S} fillOpacity={0.15} /></svg>
}
export function IcFlipV({ className }: IconProps) {
  return <svg {...p} className={className}><path d="M3 12h18" strokeDasharray="2 2.5" /><path d="M6 9 18 3v6z" /><path d="M6 15l12 6v-6z" fill={S} fillOpacity={0.15} /></svg>
}
export function IcRotate({ className }: IconProps) {
  return <svg {...p} className={className}><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></svg>
}
export function IcDuplicate({ className }: IconProps) {
  return <svg {...p} className={className}><rect x="8" y="8" width="12" height="12" rx="2.5" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /><path d="M14 11v6M11 14h6" /></svg>
}
export function IcDelete({ className }: IconProps) {
  return <svg {...p} className={className}><path d="M4 7h16" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12" /><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" /></svg>
}
export function IcFit({ className }: IconProps) {
  return <svg {...p} className={className}><rect x="3" y="3" width="18" height="18" rx="2.5" strokeOpacity={0.45} /><rect x="7.5" y="7.5" width="9" height="9" rx="1.5" fill={S} fillOpacity={0.15} /></svg>
}
export function IcFill({ className }: IconProps) {
  return <svg {...p} className={className}><path d="M4 9V4h5" /><path d="M20 9V4h-5" /><path d="M4 15v5h5" /><path d="M20 15v5h-5" /><rect x="8" y="8" width="8" height="8" rx="1.5" fill={S} fillOpacity={0.15} /></svg>
}
export function IcFitScreen({ className }: IconProps) {
  return <svg {...p} className={className}><path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" /><path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" /></svg>
}
export function IcPan({ className }: IconProps) {
  return <svg {...p} className={className}><path d="M18 11V6a2 2 0 0 0-4 0" /><path d="M14 10V4a2 2 0 0 0-4 0v6" /><path d="M10 10.5V8a2 2 0 0 0-4 0v8c0 4 3 6 7 6 4.5 0 7-2.5 7-7v-3a2 2 0 0 0-4 0" /></svg>
}
export function IcSelect({ className }: IconProps) {
  return <svg {...p} className={className}><path d="M4.5 3.5 19 10.2l-6.3 1.9-2.4 6.4z" fill={S} fillOpacity={0.15} /></svg>
}
export function IcBringForward({ className }: IconProps) {
  return <svg {...p} className={className}><rect x="3" y="10" width="11" height="11" rx="2" strokeOpacity={0.45} /><rect x="10" y="3" width="11" height="11" rx="2" fill={S} fillOpacity={0.15} /></svg>
}
export function IcSendBackward({ className }: IconProps) {
  return <svg {...p} className={className}><rect x="10" y="3" width="11" height="11" rx="2" strokeOpacity={0.45} /><rect x="3" y="10" width="11" height="11" rx="2" fill={S} fillOpacity={0.15} /></svg>
}
export function IcBringToFront({ className }: IconProps) {
  return <svg {...p} className={className}><path d="M12 15V3" /><path d="m7 8 5-5 5 5" /><path d="M4 21h16" /><path d="M4 17.5h16" strokeOpacity={0.45} /></svg>
}
export function IcSendToBack({ className }: IconProps) {
  return <svg {...p} className={className}><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M4 21h16" /><path d="M4 17.5h16" strokeOpacity={0.45} /></svg>
}
export function IcLock({ className }: IconProps) {
  return <svg {...p} className={className}><rect x="5" y="11" width="14" height="10" rx="2.5" /><path d="M8 11V7.5a4 4 0 0 1 8 0V11" /><path d="M12 15v2" /></svg>
}
export function IcUnlock({ className }: IconProps) {
  return <svg {...p} className={className}><rect x="5" y="11" width="14" height="10" rx="2.5" /><path d="M8 11V7.5a4 4 0 0 1 7.6-1.7" /><path d="M12 15v2" /></svg>
}
export function IcEye({ className }: IconProps) {
  return <svg {...p} className={className}><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" /><circle cx="12" cy="12" r="3" /></svg>
}
export function IcEyeOff({ className }: IconProps) {
  return <svg {...p} className={className}><path d="M10.6 5.1A9 9 0 0 1 12 5c6 0 9.5 7 9.5 7a16 16 0 0 1-2.4 3.3" /><path d="M6.6 6.6C3.9 8.4 2.5 12 2.5 12s3.5 7 9.5 7a9 9 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /><path d="m3 3 18 18" /></svg>
}
export function IcUpload({ className }: IconProps) {
  return <svg {...p} className={className}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5-5 5 5" /><path d="M12 5v12" /></svg>
}
export function IcDownload({ className }: IconProps) {
  return <svg {...p} className={className}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 11 5 5 5-5" /><path d="M12 3v13" /></svg>
}
export function IcImage({ className }: IconProps) {
  return <svg {...p} className={className}><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="1.8" /><path d="m21 15-4.5-4.5L6 21" /></svg>
}
export function IcText({ className }: IconProps) {
  return <svg {...p} className={className}><path d="M5 7V5h14v2" /><path d="M12 5v14" /><path d="M9 19h6" /></svg>
}
export function IcMinus({ className }: IconProps) {
  return <svg {...p} className={className}><path d="M5 12h14" /></svg>
}
export function IcPlus({ className }: IconProps) {
  return <svg {...p} className={className}><path d="M12 5v14" /><path d="M5 12h14" /></svg>
}
export function IcCheck({ className }: IconProps) {
  return <svg {...p} className={className}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
}
export function IcAlert({ className }: IconProps) {
  return <svg {...p} className={className}><circle cx="12" cy="12" r="9" /><path d="M12 8v4.5" /><path d="M12 16h.01" /></svg>
}
export function IcLayers({ className }: IconProps) {
  return <svg {...p} className={className}><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></svg>
}
export function IcSliders({ className }: IconProps) {
  return <svg {...p} className={className}><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></svg>
}
export function IcAlignLeft({ className }: IconProps) {
  return <svg {...p} className={className}><path d="M4 3v18" strokeWidth={1.8} /><rect x="8" y="7" width="10" height="4" rx="1" /><rect x="8" y="14" width="6" height="4" rx="1" /></svg>
}
export function IcAlignCenterH({ className }: IconProps) {
  return <svg {...p} className={className}><path d="M12 3v18" strokeWidth={1.8} /><rect x="6" y="7" width="12" height="4" rx="1" /><rect x="8" y="14" width="8" height="4" rx="1" /></svg>
}
export function IcAlignRight({ className }: IconProps) {
  return <svg {...p} className={className}><path d="M20 3v18" strokeWidth={1.8} /><rect x="6" y="7" width="10" height="4" rx="1" /><rect x="10" y="14" width="6" height="4" rx="1" /></svg>
}
export function IcAlignTop({ className }: IconProps) {
  return <svg {...p} className={className}><path d="M3 4h18" strokeWidth={1.8} /><rect x="7" y="8" width="4" height="10" rx="1" /><rect x="14" y="8" width="4" height="6" rx="1" /></svg>
}
export function IcAlignCenterV({ className }: IconProps) {
  return <svg {...p} className={className}><path d="M3 12h18" strokeWidth={1.8} /><rect x="7" y="6" width="4" height="12" rx="1" /><rect x="14" y="8" width="4" height="8" rx="1" /></svg>
}
export function IcAlignBottom({ className }: IconProps) {
  return <svg {...p} className={className}><path d="M3 20h18" strokeWidth={1.8} /><rect x="7" y="6" width="4" height="10" rx="1" /><rect x="14" y="10" width="4" height="6" rx="1" /></svg>
}
export function IcChevronDown({ className }: IconProps) {
  return <svg {...p} className={className}><path d="M6 9l6 6 6-6" /></svg>
}
export function IcPsd({ className }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="2" y="2" width="20" height="20" rx="5" fill="#001E36" />
      <text x="12" y="15.5" textAnchor="middle" fontSize="8.5" fontWeight="700" fontFamily="system-ui, sans-serif" fill="#31A8FF">Ps</text>
    </svg>
  )
}
export function IcBlank({ className }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="2" width="18" height="20" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 8h8M8 12h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}
/** App mark: a design (sparkle) inside a dashed print area — fits any product, not just apparel */
export function IcLogo({ className }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className={className}>
      <rect width="24" height="24" rx="7" fill="#23a06b" />
      <rect x="5.5" y="5.5" width="13" height="13" rx="2.5" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="2.4 1.9" />
      <path d="M12 8.2c.4 2.1 1.3 3 3.4 3.4-2.1.4-3 1.3-3.4 3.4-.4-2.1-1.3-3-3.4-3.4 2.1-.4 3-1.3 3.4-3.4Z" fill="#ffffff" />
    </svg>
  )
}
export function IcTrashSmall({ className }: IconProps) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill={S} className={className}><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022 1.005 11.36A2.75 2.75 0 0 0 7.76 20h4.48a2.75 2.75 0 0 0 2.742-2.689l1.004-11.36.15.022a.75.75 0 1 0 .228-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5Z" clipRule="evenodd" /></svg>
}
export function IcPalette({ className }: IconProps) {
  return <svg {...p} className={className}><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.9 1.8-1.9 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.7 1.8-1.7H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z" /><circle cx="7.5" cy="11" r="1" fill={S} /><circle cx="10" cy="7" r="1" fill={S} /><circle cx="14.5" cy="7" r="1" fill={S} /></svg>
}
export function IcReset({ className }: IconProps) {
  return <svg {...p} className={className}><path d="M4 12a8 8 0 1 0 2.3-5.7" /><path d="M4 4v5h5" /><circle cx="12" cy="12" r="1.6" fill={S} stroke="none" /></svg>
}
/** Mockup template: a product frame with a dashed print area, over a second sheet (a layered template file) */
export function IcMockup({ className }: IconProps) {
  return (
    <svg {...p} className={className}>
      <path d="M7 3.5h10.5a3 3 0 0 1 3 3V17" />
      <rect x="3.5" y="7" width="13.5" height="13.5" rx="2.5" />
      <rect x="7" y="10.5" width="6.5" height="6.5" rx="0.8" strokeWidth={1.3} strokeDasharray="1.8 1.5" />
    </svg>
  )
}
/** Drag handle: 2 × 3 dots */
export function IcGrip({ className }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      {[9, 15].flatMap((x) => [6, 12, 18].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" />))}
    </svg>
  )
}
/** Transform: a selection box with corner handles (position & size) */
export function IcTransform({ className }: IconProps) {
  return (
    <svg {...p} className={className}>
      <path d="M8 5.5h8M8 18.5h8M5.5 8v8M18.5 8v8" />
      <rect x="3.5" y="3.5" width="4" height="4" rx="1" />
      <rect x="16.5" y="3.5" width="4" height="4" rx="1" />
      <rect x="3.5" y="16.5" width="4" height="4" rx="1" />
      <rect x="16.5" y="16.5" width="4" height="4" rx="1" />
    </svg>
  )
}
/** Element library: circle, square and triangle */
export function IcElements({ className }: IconProps) {
  return (
    <svg {...p} className={className}>
      <circle cx="7.5" cy="7.5" r="4" />
      <rect x="13" y="3.5" width="7.5" height="7.5" rx="1.5" />
      <path d="M7.5 13.5 L12 20.5 H3Z" />
      <path d="M16.75 13 l1.2 2.5 2.75.4-2 1.95.47 2.75-2.42-1.3-2.42 1.3.47-2.75-2-1.95 2.75-.4z" />
    </svg>
  )
}
export function IcSearch({ className }: IconProps) {
  return <svg {...p} className={className}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
}
export function IcChevronRight({ className }: IconProps) {
  return <svg {...p} className={className}><path d="m9 18 6-6-6-6" /></svg>
}
export function IcChevronLeft({ className }: IconProps) {
  return <svg {...p} className={className}><path d="m15 18-6-6 6-6" /></svg>
}
/** Window with a right-hand panel (toggle the inspector sidebar) */
export function IcSidebarRight({ className }: IconProps) {
  return <svg {...p} className={className}><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M14.5 4.5v15" /></svg>
}
export function IcX({ className }: IconProps) {
  return <svg {...p} className={className}><path d="M18 6 6 18M6 6l12 12" /></svg>
}
