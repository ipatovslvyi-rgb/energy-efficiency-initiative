import Icon from "@/components/ui/icon"

export type TextAlignValue = "left" | "center" | "right"

const OPTS = [
  { v: "left" as const, icon: "AlignLeft", title: "По левому краю" },
  { v: "center" as const, icon: "AlignCenter", title: "По центру" },
  { v: "right" as const, icon: "AlignRight", title: "По правому краю" },
]

export function AlignControls({
  value,
  onChange,
  bold,
  onToggleBold,
}: {
  value: TextAlignValue
  onChange: (v: TextAlignValue) => void
  bold?: boolean
  onToggleBold?: () => void
}) {
  return (
    <div className="flex items-center gap-1">
      {OPTS.map(o => (
        <button
          key={o.v}
          type="button"
          title={o.title}
          onClick={() => onChange(o.v)}
          className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-colors ${
            value === o.v
              ? "border-primary/70 bg-primary/15 text-foreground"
              : "border-foreground/20 text-foreground/50 hover:text-foreground"
          }`}
        >
          <Icon name={o.icon} size={14} />
        </button>
      ))}
      {onToggleBold && (
        <button
          type="button"
          title={bold ? "Убрать жирность" : "Сделать жирным"}
          onClick={onToggleBold}
          className={`ml-1 flex h-7 w-7 items-center justify-center rounded-lg border transition-colors ${
            bold
              ? "border-primary/70 bg-primary/15 text-foreground"
              : "border-foreground/20 text-foreground/40 hover:text-foreground"
          }`}
        >
          <Icon name="Bold" size={13} />
        </button>
      )}
    </div>
  )
}

export default AlignControls
