import {
  IcAlignLeft, IcAlignCenterH, IcAlignRight,
  IcAlignTop, IcAlignCenterV, IcAlignBottom, IcTransform,
} from '@/components/icons'
import type { SelectedObjectProps } from '../types'
import { AlignButton, PanelSection, SliderField } from './ui'
import PropInput from './PropInput'

interface PositionPanelProps {
  objectProps: SelectedObjectProps
  onPropChange: (prop: string, value: number) => void
  onAlign: (alignment: string) => void
  /** Position & alignment are measured against the print area instead of the artboard */
  relativeToPrintArea: boolean
}

export default function PositionPanel({
  objectProps,
  onPropChange,
  onAlign,
  relativeToPrintArea,
}: PositionPanelProps) {
  return (
    <PanelSection
      id="position"
      icon={<IcTransform className="h-3.5 w-3.5" />}
      title="Position & size"
      right={
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] font-medium text-ink-muted">
          {relativeToPrintArea ? 'Relative to print area' : 'Relative to canvas'}
        </span>
      }
    >

      <div className="mb-4 flex items-center justify-between gap-2 rounded-2xl bg-surface-2 p-1">
        <div className="flex gap-1">
          <AlignButton onClick={() => onAlign('left')} title={relativeToPrintArea ? 'Align left of print area' : 'Align left'}>
            <IcAlignLeft className="h-4 w-4" />
          </AlignButton>
          <AlignButton onClick={() => onAlign('center-h')} title={relativeToPrintArea ? 'Center in print area (horizontal)' : 'Center horizontally'}>
            <IcAlignCenterH className="h-4 w-4" />
          </AlignButton>
          <AlignButton onClick={() => onAlign('right')} title={relativeToPrintArea ? 'Align right of print area' : 'Align right'}>
            <IcAlignRight className="h-4 w-4" />
          </AlignButton>
        </div>
        <div className="flex gap-1">
          <AlignButton onClick={() => onAlign('top')} title={relativeToPrintArea ? 'Align top of print area' : 'Align top'}>
            <IcAlignTop className="h-4 w-4" />
          </AlignButton>
          <AlignButton onClick={() => onAlign('center-v')} title={relativeToPrintArea ? 'Center in print area (vertical)' : 'Center vertically'}>
            <IcAlignCenterV className="h-4 w-4" />
          </AlignButton>
          <AlignButton onClick={() => onAlign('bottom')} title={relativeToPrintArea ? 'Align bottom of print area' : 'Align bottom'}>
            <IcAlignBottom className="h-4 w-4" />
          </AlignButton>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-3">
        <PropInput label="Width" value={objectProps.widthInch} unit="in" readOnly />
        <PropInput label="Height" value={objectProps.heightInch} unit="in" readOnly />
        <PropInput label="Rotate" value={objectProps.angle} unit="deg" onChange={(v) => onPropChange('angle', v)} />
        <PropInput label="Scale" value={objectProps.scalePercent} unit="%" onChange={(v) => onPropChange('scalePercent', v)} />
        <PropInput label="Left" value={objectProps.leftPercent} unit="%" onChange={(v) => onPropChange('leftPercent', v)} />
        <PropInput label="Top" value={objectProps.topPercent} unit="%" onChange={(v) => onPropChange('topPercent', v)} />
      </div>

      <div className="mt-4">
        <SliderField label="Opacity" value={objectProps.opacity} min={0} max={100} unit="%" onChange={(v) => onPropChange('opacity', v)} />
      </div>
    </PanelSection>
  )
}
