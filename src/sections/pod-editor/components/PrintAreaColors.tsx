import { IcCheck, IcPalette } from '@/components/icons'
import type { PrintAreaColor } from '../types'
import { PanelSection, Tooltip } from './ui'

interface PrintAreaColorsProps {
  colors: PrintAreaColor[]
  selected: string
  onSelect: (name: string) => void
}

/** Perceived luminance — picks a readable check mark on light/dark swatches. */
function isLight({ r, g, b }: PrintAreaColor['rgb']) {
  return 0.299 * r + 0.587 * g + 0.114 * b > 170
}

export default function PrintAreaColors({ colors, selected, onSelect }: PrintAreaColorsProps) {
  if (colors.length === 0) return null

  return (
    <PanelSection
      id="colors"
      icon={<IcPalette className="h-3.5 w-3.5" />}
      title="Colors"
      right={<span className="max-w-[140px] truncate text-[11.5px] font-medium text-ink-muted">{selected}</span>}
    >
      <ColorSwatches colors={colors} selected={selected} onSelect={onSelect} />
    </PanelSection>
  )
}

/** Round swatches for the colors read from a PSD's color fill layers. */
export function ColorSwatches({ colors, selected, onSelect }: PrintAreaColorsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((color) => {
        const isActive = color.name === selected
        return (
          // Tooltip = the color layer's name from the PSD
          <Tooltip key={color.name} label={color.name} description={color.hex.toUpperCase()} side="top">
            <button
              onClick={() => onSelect(color.name)}
              aria-label={color.name}
              aria-pressed={isActive}
              className={`flex h-7 w-7 items-center justify-center rounded-full border border-black/10 transition-all duration-150 ${
                isActive ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : 'hover:scale-110'
              }`}
              style={{ backgroundColor: color.hex }}
            >
              {isActive && (
                <IcCheck className={`h-3.5 w-3.5 ${isLight(color.rgb) ? 'text-ink' : 'text-white'}`} />
              )}
            </button>
          </Tooltip>
        )
      })}
    </div>
  )
}
