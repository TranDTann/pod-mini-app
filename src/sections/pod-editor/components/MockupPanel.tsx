import { IcPlus, IcMockup, IcX } from '@/components/icons'
import type { MockupPsd } from '../types'
import { PanelSection, Tooltip } from './ui'

interface MockupPanelProps {
  mockups: MockupPsd[]
  onUpload: () => void
  onOpen: (id: number) => void
  onRemove: (id: number) => void
}

/** Mockup PSDs attached to the current template; click one to preview the design on it. */
export default function MockupPanel({ mockups, onUpload, onOpen, onRemove }: MockupPanelProps) {
  return (
    <PanelSection
      id="mockups"
      icon={<IcMockup className="h-3.5 w-3.5" />}
      title="Mockups"
      count={mockups.length}
    >
      <div className="grid grid-cols-3 gap-2">
        {mockups.map((mockup) => (
          <div key={mockup.id} className="group relative">
            <Tooltip label={mockup.name} description="Preview on this mockup" side="top">
              <button
                onClick={() => onOpen(mockup.id)}
                aria-label={`Preview ${mockup.name}`}
                className="block aspect-square w-full overflow-hidden rounded-xl border border-line bg-surface-2 transition-all hover:border-accent-line hover:shadow-soft"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
                <img src={mockup.thumbnailUrl} alt="" className="h-full w-full object-cover" />
              </button>
            </Tooltip>
            <button
              onClick={() => onRemove(mockup.id)}
              aria-label={`Remove ${mockup.name}`}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-line bg-surface text-ink-subtle opacity-0 shadow-soft transition-all hover:text-danger group-hover:opacity-100"
            >
              <IcX className="h-3 w-3" />
            </button>
          </div>
        ))}
        <Tooltip label="Add mockup" description="Upload a mockup PSD" side="top">
          <button
            onClick={onUpload}
            aria-label="Add mockup"
            className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line-strong text-ink-subtle transition-colors hover:border-accent-line hover:bg-accent-soft hover:text-accent"
          >
            <IcPlus className="h-4 w-4" />
            <span className="text-[10px] font-medium">PSD</span>
          </button>
        </Tooltip>
      </div>
    </PanelSection>
  )
}
