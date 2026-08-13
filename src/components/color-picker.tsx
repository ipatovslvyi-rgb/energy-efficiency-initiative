import { useState, useRef, useEffect } from "react"
import Icon from "@/components/ui/icon"

const PRESETS = [
  "#FFFF00", "#FF0000", "#00CC00", "#00BFFF",
  "#FF8800", "#FF00FF", "#000000", "#FFFFFF",
  "#FF69B4", "#8A2BE2", "#00CED1", "#DC143C",
  "#228B22", "#4169E1", "#A0522D", "#808080",
]

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onEsc)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onEsc)
    }
  }, [open])

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title="Выбрать цвет"
        className="w-10 h-7 rounded border border-foreground/25 hover:border-foreground/60 transition-colors"
        style={{ background: value }}
      />
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-[188px] rounded-xl border border-foreground/20 bg-background p-2.5 shadow-2xl">
          <div className="grid grid-cols-4 gap-1.5">
            {PRESETS.map(c => (
              <button
                key={c}
                type="button"
                title={c}
                onClick={() => { onChange(c); setOpen(false) }}
                className={`h-7 w-full rounded border-2 transition-transform hover:scale-110 ${value.toUpperCase() === c ? "border-blue-400" : "border-foreground/15"}`}
                style={{ background: c }}
              />
            ))}
          </div>
          <label className="mt-2 flex items-center gap-2 rounded-lg border border-foreground/15 px-2 py-1.5 cursor-pointer hover:border-foreground/35 transition-colors">
            <Icon name="Palette" size={13} className="text-foreground/50" />
            <span className="text-[11px] text-foreground/60">Свой цвет</span>
            <input
              type="color"
              value={value}
              onChange={e => onChange(e.target.value)}
              className="ml-auto h-5 w-7 cursor-pointer border-0 bg-transparent p-0"
            />
          </label>
        </div>
      )}
    </div>
  )
}

export default ColorPicker
