import Icon from "@/components/ui/icon"
import { exportToWord, exportToExcel, ExportData } from "@/lib/export-utils"

export function NumInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="mb-2 block font-mono text-xs text-foreground/60">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min="0"
        step="any"
        placeholder={placeholder ?? "0"}
        className="w-full border-b border-foreground/30 bg-transparent py-2 text-lg text-foreground placeholder:text-foreground/30 focus:border-foreground/60 focus:outline-none md:text-xl"
      />
    </div>
  )
}

export function ResultRow({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <p className="font-mono text-xs text-foreground/50">{label}</p>
      <p className="font-sans text-3xl font-light text-foreground md:text-4xl">
        {value} <span className="text-xl text-foreground/60">{unit}</span>
      </p>
    </div>
  )
}

export function ExportButtons({ data }: { data: ExportData }) {
  return (
    <div className="flex gap-2 border-t border-foreground/10 pt-4 mt-2">
      <button
        onClick={() => exportToWord(data)}
        className="flex items-center gap-2 rounded-lg border border-foreground/20 px-4 py-2 font-mono text-xs text-foreground/70 transition-all hover:border-foreground/40 hover:text-foreground"
      >
        <Icon name="FileText" size={14} />
        Word
      </button>
      <button
        onClick={() => exportToExcel(data)}
        className="flex items-center gap-2 rounded-lg border border-foreground/20 px-4 py-2 font-mono text-xs text-foreground/70 transition-all hover:border-foreground/40 hover:text-foreground"
      >
        <Icon name="Table" size={14} />
        Excel
      </button>
    </div>
  )
}

export function CalcButtons({ onCalc, onReset, disabled, showReset }: { onCalc: () => void; onReset: () => void; disabled: boolean; showReset: boolean }) {
  return (
    <div className="flex gap-3 pt-2">
      <button
        onClick={onCalc}
        disabled={disabled}
        className="flex items-center gap-2 rounded-lg bg-foreground px-6 py-3 font-sans text-sm font-medium text-background transition-all hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30"
      >
        <Icon name="Calculator" size={16} />
        Рассчитать
      </button>
      {showReset && (
        <button
          onClick={onReset}
          className="flex items-center gap-2 rounded-lg border border-foreground/20 px-5 py-3 font-sans text-sm text-foreground/70 transition-all hover:border-foreground/40 hover:text-foreground"
        >
          <Icon name="RotateCcw" size={14} />
          Сбросить
        </button>
      )}
    </div>
  )
}

export function ResultBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-foreground/20 bg-foreground/5 p-5 backdrop-blur-sm transition-all duration-500 md:p-6">
      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-foreground/50">Результат</p>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

export function FormulaBox({ formula, params }: { formula: string; params: { sym: string; desc: string }[] }) {
  return (
    <div>
      <div className="mb-6 rounded-xl border border-foreground/10 bg-foreground/5 p-5 backdrop-blur-sm md:p-8">
        <p className="mb-3 font-mono text-xs uppercase tracking-widest text-foreground/50">Формула</p>
        <p className="font-mono text-xl text-foreground md:text-2xl">{formula}</p>
      </div>
      <div className="space-y-3 text-sm text-foreground/70 md:text-base">
        {params.map(({ sym, desc }) => (
          <div key={sym} className="flex items-start gap-3">
            <span className="mt-1 min-w-[2.5rem] font-mono text-xs text-foreground/40">{sym}</span>
            <span>{desc}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
