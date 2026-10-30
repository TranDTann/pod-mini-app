import {
  IcUndo, IcRedo, IcFlipH, IcFlipV, IcRotate, IcDuplicate, IcDelete,
  IcFit, IcFill, IcSelect, IcPan, IcBringForward, IcSendBackward,
  IcBringToFront, IcSendToBack, IcReset, IcLock, IcUnlock, IcEye, IcLogo, IcSidebarRight, IcPlus,
} from '@/components/icons'
import type { EditorTool } from '../types'
import { Divider, ToolbarButton, Tooltip } from './ui'
import TemplateMenu from './TemplateMenu'
import ExportMenu from './ExportMenu'

interface EditorToolbarProps {
  templateName: string
  isBlank: boolean
  onSwitchToBlank: () => void
  onUploadPsd: () => void
  onRemoveTemplate: () => void

  activeTool: EditorTool
  onToolChange: (tool: EditorTool) => void

  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void

  hasSelection: boolean
  isLocked: boolean
  onFlipH: () => void
  onFlipV: () => void
  onRotate: () => void
  canReset: boolean
  onReset: () => void
  onFit: () => void
  onFill: () => void
  onDuplicate: () => void
  onBringToFront: () => void
  onBringForward: () => void
  onSendBackward: () => void
  onSendToBack: () => void
  onToggleLock: () => void
  onDelete: () => void

  panelOpen: boolean
  onTogglePanel: () => void
  /** No mockup yet: Preview asks for one first */
  previewNeedsMockup: boolean

  onExport: () => void
  onExportPrintArea: (indexes: number[]) => void
  printAreaNames: string[]
  activeAreaIndex: number
  onPreview: () => void
}

const ICON = 'h-[18px] w-[18px]'

export default function EditorToolbar({
  templateName,
  isBlank,
  onSwitchToBlank,
  onUploadPsd,
  onRemoveTemplate,
  activeTool,
  onToolChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  hasSelection,
  isLocked,
  onFlipH,
  onFlipV,
  onRotate,
  canReset,
  onReset,
  onFit,
  onFill,
  onDuplicate,
  onBringToFront,
  onBringForward,
  onSendBackward,
  onSendToBack,
  onToggleLock,
  onDelete,
  panelOpen,
  onTogglePanel,
  previewNeedsMockup,
  onExport,
  onExportPrintArea,
  printAreaNames,
  activeAreaIndex,
  onPreview,
}: EditorToolbarProps) {
  const canEdit = hasSelection && !isLocked

  return (
    <div className="relative z-40 flex h-[60px] shrink-0 items-center gap-1 bg-app px-3.5">
      {/* Left: brand + template + tools */}
      <div className="flex items-center">
        <IcLogo className="mr-2.5 h-8 w-8" />
        <TemplateMenu
          templateName={templateName}
          isBlank={isBlank}
          onSwitchToBlank={onSwitchToBlank}
          onUploadPsd={onUploadPsd}
          onRemoveTemplate={onRemoveTemplate}
        />

        <Divider />

        <div className="flex items-center gap-0.5 rounded-xl bg-hover p-0.5">
          <ToolbarButton active={activeTool === 'select'} onClick={() => onToolChange('select')} title="Select" shortcut="V">
            <IcSelect className={ICON} />
          </ToolbarButton>
          <ToolbarButton active={activeTool === 'pan'} onClick={() => onToolChange('pan')} title="Hand tool" shortcut="H">
            <IcPan className={ICON} />
          </ToolbarButton>
        </div>

        <Divider />

        <ToolbarButton onClick={onUndo} disabled={!canUndo} title="Undo" shortcut="Ctrl Z">
          <IcUndo className={ICON} />
        </ToolbarButton>
        <ToolbarButton onClick={onRedo} disabled={!canRedo} title="Redo" shortcut="Ctrl ⇧ Z">
          <IcRedo className={ICON} />
        </ToolbarButton>
      </div>

      <Divider />

      {/* Object actions — left-aligned next to the tools */}
      <div
        className={`flex min-w-0 items-center rounded-2xl border px-1 py-0.5 transition-all duration-200 ${
          hasSelection ? 'border-line bg-surface shadow-soft' : 'border-transparent'
        }`}
      >
        <ToolbarButton onClick={onFlipH} disabled={!canEdit} title="Flip horizontal" shortcut="⇧ H">
          <IcFlipH className={ICON} />
        </ToolbarButton>
        <ToolbarButton onClick={onFlipV} disabled={!canEdit} title="Flip vertical" shortcut="⇧ V">
          <IcFlipV className={ICON} />
        </ToolbarButton>
        <ToolbarButton onClick={onRotate} disabled={!canEdit} title="Rotate 90°" shortcut="R">
          <IcRotate className={ICON} />
        </ToolbarButton>
        <ToolbarButton onClick={onReset} disabled={!canEdit || !canReset} title="Reset to original" shortcut="⇧ R">
          <IcReset className={ICON} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton onClick={onFit} disabled={!canEdit} title="Fit to print area">
          <IcFit className={ICON} />
        </ToolbarButton>
        <ToolbarButton onClick={onFill} disabled={!canEdit} title="Fill print area">
          <IcFill className={ICON} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton onClick={onBringToFront} disabled={!hasSelection} title="Bring to front" shortcut="Ctrl ⇧ ]">
          <IcBringToFront className={ICON} />
        </ToolbarButton>
        <ToolbarButton onClick={onBringForward} disabled={!hasSelection} title="Bring forward" shortcut="Ctrl ]">
          <IcBringForward className={ICON} />
        </ToolbarButton>
        <ToolbarButton onClick={onSendBackward} disabled={!hasSelection} title="Send backward" shortcut="Ctrl [">
          <IcSendBackward className={ICON} />
        </ToolbarButton>
        <ToolbarButton onClick={onSendToBack} disabled={!hasSelection} title="Send to back" shortcut="Ctrl ⇧ [">
          <IcSendToBack className={ICON} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton onClick={onDuplicate} disabled={!hasSelection} title="Duplicate" shortcut="Ctrl D">
          <IcDuplicate className={ICON} />
        </ToolbarButton>
        <ToolbarButton onClick={onToggleLock} disabled={!hasSelection} active={hasSelection && isLocked} title={isLocked ? 'Unlock' : 'Lock'} shortcut="Ctrl L">
          {isLocked ? <IcLock className={ICON} /> : <IcUnlock className={ICON} />}
        </ToolbarButton>
        <ToolbarButton onClick={onDelete} disabled={!canEdit} danger title="Delete" shortcut="Del">
          <IcDelete className={ICON} />
        </ToolbarButton>
      </div>

      {/* Right: panel toggle, preview, export */}
      <div className="ml-auto" />
      <div className="mr-2">
        <ToolbarButton
          onClick={onTogglePanel}
          active={panelOpen}
          title={panelOpen ? 'Hide side panel' : 'Show side panel'}
          shortcut="Ctrl ."
        >
          <IcSidebarRight className={ICON} />
        </ToolbarButton>
      </div>
      <Tooltip
        label={previewNeedsMockup ? 'Add a mockup to preview' : 'Preview on mockups'}
        description={previewNeedsMockup ? 'Choose a mockup PSD — the preview opens on it' : undefined}
        shortcut="Ctrl P"
      >
        <button
          onClick={onPreview}
          className="mr-2 flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2 text-[13px] font-semibold text-ink transition-all hover:-translate-y-px hover:bg-surface-2 active:scale-95"
        >
          {previewNeedsMockup ? <IcPlus className="h-4 w-4" /> : <IcEye className="h-4 w-4" />}
          Preview
        </button>
      </Tooltip>
      <ExportMenu
        onExportDesign={onExport}
        onExportPrintArea={onExportPrintArea}
        printAreas={printAreaNames}
        activeIndex={activeAreaIndex}
      />
    </div>
  )
}
