import type { ReactNode } from 'react'
import { IcAlignLeft, IcAlignCenterH, IcAlignRight, IcElements, IcSliders, IcText } from '@/components/icons'
import type { ImageStyleProps, ObjectStyleProps, ShapeStyleProps, TextStyleProps } from '../types'
import { LIBRARY_FONTS } from '../elements/library'
import { PanelSection, Slider, SliderField, Tooltip, ValueInput } from './ui'

const FONTS = [
  'Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Verdana',
  'Trebuchet MS', 'Courier New', 'Impact', 'Brush Script MT', 'Comic Sans MS',
  ...LIBRARY_FONTS,
]

const SWATCHES = ['#3b342d', '#ffffff', '#23a06b', '#e9b44c', '#8a9f6e', '#5b8db8', '#9a6fb0', '#d0645a']

// ── Small building blocks ──

function Row({ label, children, value }: { label: string; children: ReactNode; value?: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-[11px] font-medium text-ink-muted">{label}</label>
        {value !== undefined && <span className="text-[11.5px] font-semibold tabular-nums text-ink">{value}</span>}
      </div>
      {children}
    </div>
  )
}


function ToggleChip({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean
  onClick: () => void
  title: string
  children: ReactNode
}) {
  return (
    <Tooltip label={title} side="top">
      <button
        onClick={onClick}
        aria-pressed={active}
        aria-label={title}
        className={`flex h-8 min-w-8 items-center justify-center rounded-[10px] px-2 text-[13px] transition-all duration-150 ${
          active ? 'bg-surface text-accent shadow-soft ring-1 ring-accent-line' : 'text-ink-muted hover:bg-surface hover:text-ink'
        }`}
      >
        {children}
      </button>
    </Tooltip>
  )
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {SWATCHES.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          aria-label={c}
          className={`h-6 w-6 rounded-full border border-black/10 transition-transform hover:scale-110 ${
            value.toLowerCase() === c ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''
          }`}
          style={{ background: c }}
        />
      ))}
      <Tooltip label="Custom color" side="top">
        <label className="relative flex h-6 w-6 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-line-strong bg-[conic-gradient(#d0645a,#e9b44c,#8a9f6e,#5b8db8,#9a6fb0,#d0645a)]">
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </Tooltip>
    </div>
  )
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      className="flex w-full items-center justify-between rounded-[10px] px-1 py-1 text-[12.5px] font-medium text-ink transition-colors hover:bg-surface-2"
    >
      {label}
      <span className={`relative h-[18px] w-8 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-line-strong'}`}>
        <span
          className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-soft transition-all ${checked ? 'left-4' : 'left-0.5'}`}
        />
      </span>
    </button>
  )
}

const GROUP = 'flex items-center gap-0.5 rounded-xl bg-surface-2 p-0.5'

// ── Curve ──

/** Values this close to 0 snap to straight, so it's easy to land on it while dragging. */
const CURVE_SNAP = 4

const clampCurve = (v: number) => {
  const n = Math.max(-100, Math.min(100, Math.round(v)))
  return Math.abs(n) <= CURVE_SNAP ? 0 : n
}

function CurveEnd({ d, active }: { d: string; active: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className={`h-4 w-4 shrink-0 transition-colors ${active ? 'text-accent' : 'text-ink-subtle'}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    >
      <path d={d} />
    </svg>
  )
}

/**
 * One control for one value: a slider from smile (left) through straight (center) to arch
 * (right), plus a number box for exact values. Nothing appears or disappears, so it never jumps.
 * Double-click the slider (or type 0) to straighten.
 */
function CurveControl({ style, onChange }: { style: TextStyleProps; onChange: (patch: Partial<TextStyleProps>) => void }) {
  if (!style.canCurve) {
    return (
      <Row label="Curve">
        <p className="text-[11.5px] text-ink-muted">Curving works on single-line text — remove the line breaks to bend it.</p>
      </Row>
    )
  }
  const set = (v: number) => onChange({ curve: clampCurve(v) })
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor="curve-input" className="text-[11px] font-medium text-ink-muted">
          Curve
        </label>
        <ValueInput id="curve-input" value={style.curve} min={-100} max={100} onChange={set} />
      </div>
      <Tooltip label="Drag left to smile, right to arch" description="Double-click to straighten" side="top" block>
        <div className="flex w-full items-center gap-2" onDoubleClick={() => set(0)}>
          <CurveEnd d="M2.5 5 Q8 13 13.5 5" active={style.curve < 0} />
          <div className="relative min-w-0 flex-1">
            <Slider value={style.curve} min={-100} max={100} centered onChange={set} />
            {/* Center tick = straight */}
            <span className="pointer-events-none absolute left-1/2 top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink-subtle/50" />
          </div>
          <CurveEnd d="M2.5 11 Q8 3 13.5 11" active={style.curve > 0} />
        </div>
      </Tooltip>
    </div>
  )
}

// ── Text ──

function TextStyle({ style, onChange }: { style: TextStyleProps; onChange: (patch: Partial<TextStyleProps>) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[1fr_76px] gap-2">
        <select
          value={style.fontFamily}
          onChange={(e) => onChange({ fontFamily: e.target.value })}
          className="h-8 w-full cursor-pointer rounded-[10px] border border-line bg-surface px-2 text-[13px] text-ink outline-none transition-all focus:border-accent focus:ring-[3px] focus:ring-accent-soft"
          style={{ fontFamily: style.fontFamily }}
        >
          {FONTS.map((f) => (
            <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
          ))}
        </select>
        <div className="flex h-8 items-center overflow-hidden rounded-[10px] border border-line bg-surface focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent-soft">
          <input
            type="number"
            min={6}
            max={400}
            value={style.fontSize}
            onChange={(e) => onChange({ fontSize: Math.max(6, Number(e.target.value) || 6) })}
            className="w-full bg-transparent px-2 text-[13px] tabular-nums text-ink outline-none"
          />
          <span className="px-1.5 text-[11px] text-ink-subtle">px</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className={GROUP}>
          <ToggleChip active={style.bold} onClick={() => onChange({ bold: !style.bold })} title="Bold">
            <span className="font-bold">B</span>
          </ToggleChip>
          <ToggleChip active={style.italic} onClick={() => onChange({ italic: !style.italic })} title="Italic">
            <span className="font-serif italic">I</span>
          </ToggleChip>
          <ToggleChip active={style.underline} onClick={() => onChange({ underline: !style.underline })} title="Underline">
            <span className="underline underline-offset-2">U</span>
          </ToggleChip>
        </div>
        <div className={GROUP}>
          <ToggleChip active={style.textAlign === 'left'} onClick={() => onChange({ textAlign: 'left' })} title="Align text left">
            <IcAlignLeft className="h-4 w-4" />
          </ToggleChip>
          <ToggleChip active={style.textAlign === 'center'} onClick={() => onChange({ textAlign: 'center' })} title="Center text">
            <IcAlignCenterH className="h-4 w-4" />
          </ToggleChip>
          <ToggleChip active={style.textAlign === 'right'} onClick={() => onChange({ textAlign: 'right' })} title="Align text right">
            <IcAlignRight className="h-4 w-4" />
          </ToggleChip>
        </div>
      </div>

      <Row label="Color">
        <ColorPicker value={style.fill} onChange={(fill) => onChange({ fill })} />
      </Row>

      <SliderField label="Letter spacing" value={style.charSpacing} min={-100} max={800} step={10} onChange={(charSpacing) => onChange({ charSpacing })} />
      <CurveControl style={style} onChange={onChange} />
      <SliderField label="Line height" value={style.lineHeight} min={0.6} max={3} step={0.05} onChange={(lineHeight) => onChange({ lineHeight })} />

      <SliderField label="Outline" value={style.strokeWidth} min={0} max={12} step={0.5} unit="px" onChange={(strokeWidth) => onChange({ strokeWidth })}>
        {style.strokeWidth > 0 && (
          <div className="mt-2.5">
            <ColorPicker value={style.stroke} onChange={(stroke) => onChange({ stroke })} />
          </div>
        )}
      </SliderField>

      <Switch label="Drop shadow" checked={style.shadow} onChange={(shadow) => onChange({ shadow })} />
    </div>
  )
}

// ── Image ──

const IMAGE_PRESETS: { label: string; patch: Partial<ImageStyleProps> }[] = [
  { label: 'Original', patch: { brightness: 0, contrast: 0, saturation: 0, blur: 0, grayscale: false, sepia: false, invert: false } },
  { label: 'Vivid', patch: { brightness: 5, contrast: 20, saturation: 40, grayscale: false, sepia: false, invert: false } },
  { label: 'Warm', patch: { brightness: 5, contrast: 5, saturation: 10, grayscale: false, sepia: true, invert: false } },
  { label: 'Mono', patch: { brightness: 0, contrast: 15, saturation: 0, grayscale: true, sepia: false, invert: false } },
  { label: 'Fade', patch: { brightness: 12, contrast: -25, saturation: -30, grayscale: false, sepia: false, invert: false } },
]

function ImageStyle({ style, onChange }: { style: ImageStyleProps; onChange: (patch: Partial<ImageStyleProps>) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <Row label="Presets">
        <div className="flex flex-wrap gap-1.5">
          {IMAGE_PRESETS.map((p) => {
            // Active when every value of the preset matches the current style
            const isActive = (Object.keys(p.patch) as (keyof ImageStyleProps)[]).every((k) => style[k] === p.patch[k])
            return (
              <button
                key={p.label}
                onClick={() => onChange(p.patch)}
                aria-pressed={isActive}
                className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-all ${
                  isActive
                    ? 'border-accent bg-accent text-white shadow-accent'
                    : 'border-line bg-surface text-ink-muted hover:border-accent-line hover:bg-accent-soft hover:text-accent'
                }`}
              >
                {p.label}
              </button>
            )
          })}
        </div>
      </Row>

      <SliderField label="Brightness" value={style.brightness} min={-100} max={100} centered={true} onChange={(brightness) => onChange({ brightness })} />
      <SliderField label="Contrast" value={style.contrast} min={-100} max={100} centered={true} onChange={(contrast) => onChange({ contrast })} />
      <SliderField label="Saturation" value={style.saturation} min={-100} max={100} centered={true} onChange={(saturation) => onChange({ saturation })} />
      <SliderField label="Blur" value={style.blur} min={0} max={100} centered={false} onChange={(blur) => onChange({ blur })} />

      <div className="flex flex-col gap-0.5">
        <Switch label="Grayscale" checked={style.grayscale} onChange={(grayscale) => onChange({ grayscale })} />
        <Switch label="Sepia" checked={style.sepia} onChange={(sepia) => onChange({ sepia })} />
        <Switch label="Invert" checked={style.invert} onChange={(invert) => onChange({ invert })} />
        <Switch label="Drop shadow" checked={style.shadow} onChange={(shadow) => onChange({ shadow })} />
      </div>
    </div>
  )
}

// ── Panel ──

// ── Shape ──

function ShapeStyle({ style, onChange }: { style: ShapeStyleProps; onChange: (patch: Partial<ShapeStyleProps>) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <Row label="Fill">
        <ColorPicker value={style.fill} onChange={(fill) => onChange({ fill })} />
      </Row>
      <Switch label="Drop shadow" checked={style.shadow} onChange={(shadow) => onChange({ shadow })} />
    </div>
  )
}

// ── Panel ──

const TITLES: Record<ObjectStyleProps['kind'], string> = {
  text: 'Text style',
  image: 'Image adjustments',
  shape: 'Shape style',
}

export default function StylePanel({
  style,
  onTextChange,
  onImageChange,
  onShapeChange,
}: {
  style: ObjectStyleProps
  onTextChange: (patch: Partial<TextStyleProps>) => void
  onImageChange: (patch: Partial<ImageStyleProps>) => void
  onShapeChange: (patch: Partial<ShapeStyleProps>) => void
}) {
  return (
    <PanelSection
      id="style"
      icon={
        style.kind === 'text' ? (
          <IcText className="h-3.5 w-3.5" />
        ) : style.kind === 'shape' ? (
          <IcElements className="h-3.5 w-3.5" />
        ) : (
          <IcSliders className="h-3.5 w-3.5" />
        )
      }
      title={TITLES[style.kind]}
    >
      {style.kind === 'text' ? (
        <TextStyle style={style} onChange={onTextChange} />
      ) : style.kind === 'shape' ? (
        <ShapeStyle style={style} onChange={onShapeChange} />
      ) : (
        <ImageStyle style={style} onChange={onImageChange} />
      )}
    </PanelSection>
  )
}
