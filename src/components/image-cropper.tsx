import { useRef, useState, useEffect, useCallback } from "react"
import Icon from "@/components/ui/icon"

type Handle = "nw" | "ne" | "sw" | "se" | "move" | null

export function ImageCropper({ src, onApply, onCancel }: { src: string; onApply: (dataUrl: string) => void; onCancel: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [box, setBox] = useState({ x: 10, y: 10, w: 80, h: 80 })
  const [natural, setNatural] = useState({ w: 0, h: 0 })
  const drag = useRef<{ handle: Handle; startX: number; startY: number; box: typeof box } | null>(null)

  const onImgLoad = () => {
    const img = imgRef.current
    if (!img) return
    setNatural({ w: img.naturalWidth, h: img.naturalHeight })
    setBox({ x: 5, y: 5, w: 90, h: 90 })
  }

  const pointerPct = useCallback((e: MouseEvent | React.MouseEvent) => {
    const wrap = wrapRef.current
    if (!wrap) return { x: 0, y: 0 }
    const r = wrap.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 }
  }, [])

  const startDrag = (handle: Handle) => (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const p = pointerPct(e)
    drag.current = { handle, startX: p.x, startY: p.y, box: { ...box } }
  }

  useEffect(() => {
    const move = (e: MouseEvent) => {
      const d = drag.current
      if (!d) return
      const p = pointerPct(e)
      const dx = p.x - d.startX
      const dy = p.y - d.startY
      const b = d.box
      const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

      if (d.handle === "move") {
        setBox({ ...b, x: clamp(b.x + dx, 0, 100 - b.w), y: clamp(b.y + dy, 0, 100 - b.h) })
      } else if (d.handle === "se") {
        setBox({ ...b, w: clamp(b.w + dx, 5, 100 - b.x), h: clamp(b.h + dy, 5, 100 - b.y) })
      } else if (d.handle === "sw") {
        const nx = clamp(b.x + dx, 0, b.x + b.w - 5)
        setBox({ ...b, x: nx, w: b.w + (b.x - nx), h: clamp(b.h + dy, 5, 100 - b.y) })
      } else if (d.handle === "ne") {
        const ny = clamp(b.y + dy, 0, b.y + b.h - 5)
        setBox({ ...b, y: ny, h: b.h + (b.y - ny), w: clamp(b.w + dx, 5, 100 - b.x) })
      } else if (d.handle === "nw") {
        const nx = clamp(b.x + dx, 0, b.x + b.w - 5)
        const ny = clamp(b.y + dy, 0, b.y + b.h - 5)
        setBox({ x: nx, y: ny, w: b.w + (b.x - nx), h: b.h + (b.y - ny) })
      }
    }
    const up = () => { drag.current = null }
    window.addEventListener("mousemove", move)
    window.addEventListener("mouseup", up)
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up) }
  }, [pointerPct])

  const apply = () => {
    if (!natural.w || !natural.h) return
    const sx = (box.x / 100) * natural.w
    const sy = (box.y / 100) * natural.h
    const sw = (box.w / 100) * natural.w
    const sh = (box.h / 100) * natural.h
    const cv = document.createElement("canvas")
    cv.width = Math.round(sw)
    cv.height = Math.round(sh)
    const ctx = cv.getContext("2d")!
    const img = imgRef.current!
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cv.width, cv.height)
    onApply(cv.toDataURL("image/png"))
  }

  const H = "absolute w-3 h-3 bg-white border border-black/40 rounded-sm"

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl rounded-2xl border border-foreground/15 bg-background p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Icon name="Crop" size={18} className="text-foreground/70" />
            <span className="font-sans text-base font-medium text-foreground">Обрезка изображения</span>
          </div>
          <button onClick={onCancel} className="text-foreground/40 hover:text-foreground transition-colors">
            <Icon name="X" size={20} />
          </button>
        </div>

        <div ref={wrapRef} className="relative select-none overflow-hidden rounded-lg border border-foreground/15 bg-black/40 max-h-[65vh] flex items-center justify-center">
          <img ref={imgRef} src={src} alt="" onLoad={onImgLoad} draggable={false}
            className="block max-h-[65vh] w-auto max-w-full pointer-events-none" />
          <div className="absolute inset-0">
            <div className="absolute bg-black/55" style={{ left: 0, top: 0, right: 0, height: `${box.y}%` }} />
            <div className="absolute bg-black/55" style={{ left: 0, top: `${box.y + box.h}%`, right: 0, bottom: 0 }} />
            <div className="absolute bg-black/55" style={{ left: 0, top: `${box.y}%`, width: `${box.x}%`, height: `${box.h}%` }} />
            <div className="absolute bg-black/55" style={{ left: `${box.x + box.w}%`, top: `${box.y}%`, right: 0, height: `${box.h}%` }} />
            <div
              onMouseDown={startDrag("move")}
              className="absolute border-2 border-white/90 cursor-move"
              style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` }}
            >
              <div onMouseDown={startDrag("nw")} className={`${H} -left-1.5 -top-1.5 cursor-nwse-resize`} />
              <div onMouseDown={startDrag("ne")} className={`${H} -right-1.5 -top-1.5 cursor-nesw-resize`} />
              <div onMouseDown={startDrag("sw")} className={`${H} -left-1.5 -bottom-1.5 cursor-nesw-resize`} />
              <div onMouseDown={startDrag("se")} className={`${H} -right-1.5 -bottom-1.5 cursor-nwse-resize`} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 mt-4">
          <p className="font-mono text-[11px] text-foreground/40">
            Область: {Math.round((box.w / 100) * natural.w)} × {Math.round((box.h / 100) * natural.h)} px
          </p>
          <div className="flex gap-2">
            <button onClick={() => setBox({ x: 0, y: 0, w: 100, h: 100 })}
              className="flex items-center gap-1.5 rounded-lg border border-foreground/20 px-3 py-2 text-sm text-foreground/70 hover:text-foreground transition-colors">
              <Icon name="Maximize" size={14} />Сбросить
            </button>
            <button onClick={onCancel}
              className="rounded-lg border border-foreground/20 px-4 py-2 text-sm text-foreground/70 hover:text-foreground transition-colors">
              Отмена
            </button>
            <button onClick={apply}
              className="flex items-center gap-1.5 rounded-lg bg-foreground px-5 py-2 text-sm font-medium text-background hover:opacity-80 transition-all">
              <Icon name="Check" size={14} />Применить
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ImageCropper
