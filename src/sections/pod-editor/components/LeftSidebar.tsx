import { IcElements, IcImage, IcText } from '@/components/icons'
import { SidebarButton } from './ui'

interface LeftSidebarProps {
  onImportImage: () => void
  onAddText: () => void
  elementsOpen: boolean
  onToggleElements: () => void
}

export default function LeftSidebar({ onImportImage, onAddText, elementsOpen, onToggleElements }: LeftSidebarProps) {
  return (
    <div className="flex w-[68px] shrink-0 flex-col items-center gap-1 rounded-2xl border border-line bg-surface pt-2.5 shadow-soft">
      <SidebarButton onClick={onImportImage} label="Image" hint="Upload image" shortcut="I">
        <IcImage className="h-[18px] w-[18px]" />
      </SidebarButton>
      <SidebarButton onClick={onAddText} label="Text" hint="Add text" shortcut="T">
        <IcText className="h-[18px] w-[18px]" />
      </SidebarButton>
      <SidebarButton
        onClick={onToggleElements}
        label="Library"
        hint={elementsOpen ? 'Close library' : 'Shapes, text presets & illustrations'}
        shortcut="E"
        active={elementsOpen}
      >
        <IcElements className="h-[18px] w-[18px]" />
      </SidebarButton>
    </div>
  )
}
