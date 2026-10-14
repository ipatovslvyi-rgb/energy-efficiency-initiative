import Icon from "@/components/ui/icon"

export function VentCalcButton({ onClick, disabled, calculated, onReset }: { onClick: () => void; disabled: boolean; calculated: boolean; onReset: () => void }) {
  return (
    <div className="flex gap-3 pt-1">
      <button
        onClick={onClick}
        disabled={disabled}
        className="flex items-center gap-2 rounded-lg bg-foreground px-6 py-3 font-sans text-sm font-medium text-background transition-all hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30"
      >
        <Icon name="Calculator" size={16} />
        Рассчитать
      </button>
      {calculated && (
        <button onClick={onReset}
          className="flex items-center gap-2 rounded-lg border border-foreground/20 px-5 py-3 font-sans text-sm text-foreground/70 transition-all hover:border-foreground/40 hover:text-foreground">
          <Icon name="RotateCcw" size={14} />Сбросить
        </button>
      )}
    </div>
  )
}

export function VentExportButtons({ onWord, onExcel }: { onWord: () => void; onExcel: () => void }) {
  return (
    <div className="flex gap-2 border-t border-foreground/10 pt-4">
      <button onClick={onWord} className="flex items-center gap-2 rounded-lg border border-foreground/20 px-4 py-2 font-mono text-xs text-foreground/70 transition-all hover:border-foreground/40 hover:text-foreground">
        <Icon name="FileText" size={14} />Word
      </button>
      <button onClick={onExcel} className="flex items-center gap-2 rounded-lg border border-foreground/20 px-4 py-2 font-mono text-xs text-foreground/70 transition-all hover:border-foreground/40 hover:text-foreground">
        <Icon name="Sheet" size={14} fallback="Table" />Excel
      </button>
    </div>
  )
}
