export default function PropInput({
  label,
  value,
  unit,
  readOnly,
  onChange,
}: {
  label: string
  value: number
  unit: string
  readOnly?: boolean
  onChange?: (value: number) => void
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-ink-muted">{label}</label>
      <div
        className={`flex items-center overflow-hidden rounded-[10px] border border-line transition-all duration-150 ${
          readOnly ? 'bg-surface-2' : 'bg-surface focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent-soft'
        }`}
      >
        <input
          type="number"
          value={value}
          readOnly={readOnly}
          onChange={(e) => onChange?.(parseFloat(e.target.value) || 0)}
          step="0.01"
          className={`w-full bg-transparent px-2.5 py-1.5 text-[13px] tabular-nums outline-none ${readOnly ? 'cursor-default text-ink-muted' : 'text-ink'}`}
        />
        <span className="shrink-0 bg-surface-2 px-2 py-1.5 text-[11px] text-ink-subtle">
          {unit}
        </span>
      </div>
    </div>
  )
}
