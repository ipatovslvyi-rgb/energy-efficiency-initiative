import { useRef, useState, useCallback, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { GrainOverlay } from "@/components/grain-overlay"
import Icon from "@/components/ui/icon"

// ── Типы ──────────────────────────────────────────────────────────────────────
interface ApprovalBlock {
  role: string
  org: string
  name: string
  date: string
}

interface TitleBlock {
  line1: string
  line2: string
  line3: string
  line4: string
  line5: string
}

interface RouteRow {
  id: string
  color: string
  length: string
  time: string
}

type DrawTool = "pen" | "eraser"

// ── Предустановленные цвета рисования ────────────────────────────────────────
const DRAW_COLORS = [
  "#FFFF00", "#FF0000", "#00FF00", "#00BFFF",
  "#FF8800", "#FF00FF", "#FFFFFF", "#000000",
]

// ── Вспомогательные компоненты ────────────────────────────────────────────────
function EditableText({
  value, onChange, className = "", placeholder = "", multiline = false,
}: {
  value: string; onChange: (v: string) => void
  className?: string; placeholder?: string; multiline?: boolean
}) {
  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className={`bg-transparent border-b border-gray-400 focus:border-blue-500 outline-none resize-none w-full ${className}`}
      />
    )
  }
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`bg-transparent border-b border-gray-400 focus:border-blue-500 outline-none w-full ${className}`}
    />
  )
}

// ── Основная страница ─────────────────────────────────────────────────────────
export default function RouteMap() {
  const navigate = useNavigate()

  // Блок "Согласовано"
  const [agree, setAgree] = useState<ApprovalBlock>({
    role: "Главный инженер",
    org: 'ООО «Организация»',
    name: "И.О. Фамилия",
    date: "«____»__________2025г.",
  })

  // Блок "Утверждаю"
  const [approve, setApprove] = useState<ApprovalBlock>({
    role: "Заместитель командира отряда",
    org: 'филиала «ВГСО»',
    name: "И.О. Фамилия",
    date: "«____»__________2025г.",
  })

  // Заголовок
  const [title, setTitle] = useState<TitleBlock>({
    line1: "Маршрутная карта",
    line2: "профилактического обследования",
    line3: 'ООО «Организация»',
    line4: "карьер",
    line5: "на 2026 г.",
  })

  // Изображение
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Canvas рисование
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)
  const [drawColor, setDrawColor] = useState("#FFFF00")
  const [drawSize, setDrawSize] = useState(4)
  const [drawTool, setDrawTool] = useState<DrawTool>("pen")
  const [canvasSize, setCanvasSize] = useState({ w: 600, h: 400 })
  const containerRef = useRef<HTMLDivElement>(null)

  // Таблица маршрутов
  const [rows, setRows] = useState<RouteRow[]>([
    { id: "1", color: "#FFFF00", length: "1,8", time: "2,0" },
    { id: "2", color: "#FF0000", length: "", time: "" },
  ])

  // Разработчик
  const [developer, setDeveloper] = useState("")

  // Подгонка canvas под размер контейнера при загрузке изображения
  const syncCanvasToImg = useCallback((img: HTMLImageElement) => {
    const cont = containerRef.current
    if (!cont) return
    const w = cont.clientWidth
    const ratio = img.naturalHeight / img.naturalWidth
    const h = Math.round(w * ratio)
    setCanvasSize({ w, h })
    // небольшой сдвиг — дождёмся рендера
    setTimeout(() => {
      const cv = canvasRef.current
      if (!cv) return
      cv.width = w
      cv.height = h
    }, 50)
  }, [])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setImageUrl(url)
    const img = new Image()
    img.onload = () => syncCanvasToImg(img)
    img.src = url
    // сбросить canvas
    setTimeout(() => {
      const cv = canvasRef.current
      if (cv) { const ctx = cv.getContext("2d"); ctx?.clearRect(0, 0, cv.width, cv.height) }
    }, 100)
  }

  // Ресайз canvas при изменении окна
  useEffect(() => {
    const handle = () => {
      if (!imageUrl || !containerRef.current) return
      const img = new Image(); img.src = imageUrl
      img.onload = () => syncCanvasToImg(img)
    }
    window.addEventListener("resize", handle)
    return () => window.removeEventListener("resize", handle)
  }, [imageUrl, syncCanvasToImg])

  // Получить позицию мыши/тача относительно canvas
  const getPos = (e: React.MouseEvent | React.TouchEvent, cv: HTMLCanvasElement) => {
    const rect = cv.getBoundingClientRect()
    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY
    return {
      x: (clientX - rect.left) * (cv.width / rect.width),
      y: (clientY - rect.top) * (cv.height / rect.height),
    }
  }

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const cv = canvasRef.current; if (!cv) return
    isDrawing.current = true
    lastPos.current = getPos(e, cv)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return
    const cv = canvasRef.current; if (!cv) return
    const ctx = cv.getContext("2d"); if (!ctx) return
    const pos = getPos(e, cv)
    const prev = lastPos.current ?? pos
    ctx.beginPath()
    ctx.moveTo(prev.x, prev.y)
    ctx.lineTo(pos.x, pos.y)
    if (drawTool === "eraser") {
      ctx.globalCompositeOperation = "destination-out"
      ctx.lineWidth = drawSize * 6
    } else {
      ctx.globalCompositeOperation = "source-over"
      ctx.strokeStyle = drawColor
      ctx.lineWidth = drawSize
    }
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.stroke()
    ctx.globalCompositeOperation = "source-over"
    lastPos.current = pos
  }

  const stopDraw = () => { isDrawing.current = false; lastPos.current = null }

  const clearCanvas = () => {
    const cv = canvasRef.current; if (!cv) return
    cv.getContext("2d")?.clearRect(0, 0, cv.width, cv.height)
  }

  // Таблица
  const addRow = () => setRows(r => [...r, { id: Date.now().toString(), color: "#FF0000", length: "", time: "" }])
  const removeRow = (id: string) => setRows(r => r.filter(x => x.id !== id))
  const updateRow = (id: string, field: keyof RouteRow, val: string) =>
    setRows(r => r.map(x => x.id === id ? { ...x, [field]: val } : x))

  // Печать
  const handlePrint = () => window.print()

  return (
    <div className="relative min-h-screen text-foreground">
      <GrainOverlay />
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 animated-bg" />
        <div className="absolute inset-0 bg-black/10" />
      </div>

      {/* Навигация */}
      <nav className="fixed left-0 right-0 top-0 z-[60] flex items-center justify-between px-4 py-3 md:px-6 md:py-4 bg-background/80 backdrop-blur-md border-b border-foreground/10">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-foreground/70 hover:text-foreground transition-colors">
          <Icon name="ArrowLeft" size={18} />
          <span className="font-sans text-sm hidden sm:inline">Назад</span>
        </button>
        <div className="flex flex-col items-center">
          <span className="font-sans text-sm font-semibold text-foreground">Маршрутная карта</span>
          <span className="font-mono text-[10px] text-foreground/40 uppercase tracking-widest">Проф. служба</span>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground/70 hover:text-foreground transition-colors"
        >
          <Icon name="Printer" size={15} />
          <span className="hidden sm:inline">Печать</span>
        </button>
      </nav>

      {/* Редактор */}
      <div className="pt-20 pb-16 px-4 md:px-6 lg:px-8 max-w-4xl mx-auto">

        {/* Карточка документа */}
        <div className="bg-background/60 backdrop-blur-sm border border-foreground/10 rounded-2xl p-6 md:p-8 shadow-2xl">

          {/* ── Верхние блоки: Согласовано / Утверждаю ── */}
          <div className="grid grid-cols-2 gap-6 mb-6 print:grid-cols-2">

            {/* Согласовано */}
            <div className="flex flex-col gap-2">
              <span className="font-sans text-xs font-bold uppercase tracking-widest text-foreground/50 mb-1">Согласовано</span>
              <div className="flex flex-col gap-1.5">
                <div>
                  <label className="text-[10px] text-foreground/40 font-mono uppercase tracking-wider">Должность</label>
                  <EditableText value={agree.role} onChange={v => setAgree(a => ({ ...a, role: v }))} className="text-sm text-foreground" placeholder="Главный инженер" />
                </div>
                <div>
                  <label className="text-[10px] text-foreground/40 font-mono uppercase tracking-wider">Организация</label>
                  <EditableText value={agree.org} onChange={v => setAgree(a => ({ ...a, org: v }))} className="text-sm text-foreground" placeholder='ООО «Организация»' />
                </div>
                <div>
                  <label className="text-[10px] text-foreground/40 font-mono uppercase tracking-wider">ФИО</label>
                  <EditableText value={agree.name} onChange={v => setAgree(a => ({ ...a, name: v }))} className="text-sm text-foreground" placeholder="И.О. Фамилия" />
                </div>
                <div>
                  <label className="text-[10px] text-foreground/40 font-mono uppercase tracking-wider">Дата</label>
                  <EditableText value={agree.date} onChange={v => setAgree(a => ({ ...a, date: v }))} className="text-sm text-foreground" placeholder="«____»__________2025г." />
                </div>
              </div>
            </div>

            {/* Утверждаю */}
            <div className="flex flex-col gap-2">
              <span className="font-sans text-xs font-bold uppercase tracking-widest text-foreground/50 mb-1">Утверждаю</span>
              <div className="flex flex-col gap-1.5">
                <div>
                  <label className="text-[10px] text-foreground/40 font-mono uppercase tracking-wider">Должность</label>
                  <EditableText value={approve.role} onChange={v => setApprove(a => ({ ...a, role: v }))} className="text-sm text-foreground" placeholder="Заместитель командира отряда" />
                </div>
                <div>
                  <label className="text-[10px] text-foreground/40 font-mono uppercase tracking-wider">Организация</label>
                  <EditableText value={approve.org} onChange={v => setApprove(a => ({ ...a, org: v }))} className="text-sm text-foreground" placeholder='филиала «ВГСО»' />
                </div>
                <div>
                  <label className="text-[10px] text-foreground/40 font-mono uppercase tracking-wider">ФИО</label>
                  <EditableText value={approve.name} onChange={v => setApprove(a => ({ ...a, name: v }))} className="text-sm text-foreground" placeholder="И.О. Фамилия" />
                </div>
                <div>
                  <label className="text-[10px] text-foreground/40 font-mono uppercase tracking-wider">Дата</label>
                  <EditableText value={approve.date} onChange={v => setApprove(a => ({ ...a, date: v }))} className="text-sm text-foreground" placeholder="«____»__________2025г." />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-foreground/10 my-4" />

          {/* ── Заголовок документа ── */}
          <div className="flex flex-col items-center gap-1.5 mb-6 text-center">
            <span className="text-[10px] text-foreground/40 font-mono uppercase tracking-widest mb-1">Наименование документа</span>
            {(["line1","line2","line3","line4","line5"] as (keyof TitleBlock)[]).map((k, i) => (
              <input
                key={k}
                value={title[k]}
                onChange={e => setTitle(t => ({ ...t, [k]: e.target.value }))}
                className={`bg-transparent border-b border-foreground/20 hover:border-foreground/40 focus:border-primary/60 outline-none text-center w-full max-w-lg transition-colors ${
                  i === 0 ? "text-lg font-bold text-foreground" : "text-sm text-foreground/80"
                }`}
                placeholder={`Строка ${i + 1}`}
              />
            ))}
          </div>

          <div className="border-t border-foreground/10 my-4" />

          {/* ── Картинка + рисование ── */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-foreground/40 font-mono uppercase tracking-widest">Схема маршрута</span>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-xs text-foreground/70 hover:text-foreground transition-colors"
              >
                <Icon name="ImagePlus" size={13} />
                {imageUrl ? "Заменить" : "Загрузить карту"}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </div>

            {/* Панель инструментов рисования */}
            {imageUrl && (
              <div className="flex flex-wrap items-center gap-3 mb-3 p-3 rounded-xl border border-foreground/10 bg-foreground/5">
                {/* Цвета */}
                <div className="flex items-center gap-1.5">
                  {DRAW_COLORS.map(c => (
                    <button
                      key={c}
                      title={c}
                      onClick={() => { setDrawColor(c); setDrawTool("pen") }}
                      className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${drawColor === c && drawTool === "pen" ? "border-white scale-110" : "border-transparent"}`}
                      style={{ background: c }}
                    />
                  ))}
                  {/* Произвольный цвет */}
                  <label title="Свой цвет" className="relative w-6 h-6 rounded-full border-2 border-dashed border-foreground/30 overflow-hidden cursor-pointer hover:border-foreground/60 transition-colors flex items-center justify-center">
                    <Icon name="Palette" size={12} className="text-foreground/50" />
                    <input type="color" value={drawColor} onChange={e => { setDrawColor(e.target.value); setDrawTool("pen") }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                  </label>
                </div>

                <div className="w-px h-5 bg-foreground/15" />

                {/* Толщина */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-foreground/40">Толщина</span>
                  <input type="range" min="1" max="20" value={drawSize} onChange={e => setDrawSize(+e.target.value)}
                    className="w-20 accent-blue-400 h-1" />
                  <span className="text-[10px] text-foreground/60 w-5">{drawSize}</span>
                </div>

                <div className="w-px h-5 bg-foreground/15" />

                {/* Ластик */}
                <button
                  onClick={() => setDrawTool(t => t === "eraser" ? "pen" : "eraser")}
                  className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                    drawTool === "eraser"
                      ? "border-orange-400/60 bg-orange-500/15 text-orange-400"
                      : "border-foreground/20 bg-foreground/5 text-foreground/60 hover:text-foreground"
                  }`}
                >
                  <Icon name="Eraser" size={12} />
                  Ластик
                </button>

                {/* Очистить */}
                <button
                  onClick={clearCanvas}
                  className="flex items-center gap-1 rounded-lg border border-foreground/20 bg-foreground/5 px-2.5 py-1 text-xs text-foreground/60 hover:text-red-400 hover:border-red-400/40 transition-colors ml-auto"
                >
                  <Icon name="Trash2" size={12} />
                  Очистить рисунок
                </button>
              </div>
            )}

            {/* Область изображения + canvas */}
            <div ref={containerRef} className="relative w-full rounded-xl overflow-hidden border border-foreground/15 bg-foreground/5">
              {imageUrl ? (
                <>
                  <img
                    src={imageUrl}
                    alt="Карта маршрута"
                    className="block w-full h-auto pointer-events-none select-none"
                    draggable={false}
                  />
                  <canvas
                    ref={canvasRef}
                    width={canvasSize.w}
                    height={canvasSize.h}
                    className="absolute inset-0 w-full h-full"
                    style={{ cursor: drawTool === "eraser" ? "cell" : "crosshair", touchAction: "none" }}
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={stopDraw}
                    onMouseLeave={stopDraw}
                    onTouchStart={e => { e.preventDefault(); startDraw(e) }}
                    onTouchMove={e => { e.preventDefault(); draw(e) }}
                    onTouchEnd={stopDraw}
                  />
                  {/* Подсказка цвета */}
                  {drawTool === "pen" && (
                    <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-1.5 pointer-events-none">
                      <div className="w-4 h-4 rounded-full border-2 border-white" style={{ background: drawColor }} />
                      <span className="text-white text-[10px] font-mono">{drawColor.toUpperCase()}</span>
                      <span className="text-white/50 text-[10px]">· {drawSize}px</span>
                    </div>
                  )}
                  {drawTool === "eraser" && (
                    <div className="absolute top-3 left-3 bg-orange-500/80 backdrop-blur-sm rounded-lg px-2.5 py-1.5 pointer-events-none">
                      <span className="text-white text-[10px]">Ластик ({drawSize * 6}px)</span>
                    </div>
                  )}
                </>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center w-full h-60 gap-3 text-foreground/30 hover:text-foreground/50 transition-colors"
                >
                  <Icon name="Map" size={48} />
                  <span className="text-sm">Нажмите для загрузки карты или спутникового снимка</span>
                  <span className="text-xs text-foreground/20">PNG, JPG, любой формат</span>
                </button>
              )}
            </div>
          </div>

          <div className="border-t border-foreground/10 my-4" />

          {/* ── Таблица маршрутов ── */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-foreground/40 font-mono uppercase tracking-widest">Маршрут профилактического обследования</span>
              <button
                onClick={addRow}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/10 transition-colors"
              >
                <Icon name="Plus" size={13} />
                Добавить строку
              </button>
            </div>

            <div className="rounded-xl overflow-hidden border border-foreground/15">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-foreground/8 border-b border-foreground/10">
                    <th className="text-left px-3 py-2.5 text-xs font-mono text-foreground/50 uppercase tracking-wider w-10">№</th>
                    <th className="text-left px-3 py-2.5 text-xs font-mono text-foreground/50 uppercase tracking-wider w-24">Цвет</th>
                    <th className="text-left px-3 py-2.5 text-xs font-mono text-foreground/50 uppercase tracking-wider">Протяжённость (км.)</th>
                    <th className="text-left px-3 py-2.5 text-xs font-mono text-foreground/50 uppercase tracking-wider">Время обследования (ч.)</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={row.id} className="border-b border-foreground/8 hover:bg-foreground/3 transition-colors">
                      <td className="px-3 py-2 text-foreground/50 text-sm">{idx + 1}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <label className="relative cursor-pointer group">
                            <div
                              className="w-12 h-6 rounded border-2 border-foreground/20 group-hover:border-foreground/40 transition-colors"
                              style={{ background: row.color }}
                            />
                            <input
                              type="color"
                              value={row.color}
                              onChange={e => updateRow(row.id, "color", e.target.value)}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            />
                          </label>
                          <span className="font-mono text-[10px] text-foreground/40">{row.color.toUpperCase()}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={row.length}
                          onChange={e => updateRow(row.id, "length", e.target.value)}
                          placeholder="0,0"
                          className="bg-transparent border-b border-foreground/20 hover:border-foreground/40 focus:border-primary/60 outline-none text-sm text-foreground w-24 placeholder:text-foreground/25 transition-colors"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={row.time}
                          onChange={e => updateRow(row.id, "time", e.target.value)}
                          placeholder="0,0"
                          className="bg-transparent border-b border-foreground/20 hover:border-foreground/40 focus:border-primary/60 outline-none text-sm text-foreground w-24 placeholder:text-foreground/25 transition-colors"
                        />
                      </td>
                      <td className="px-2 py-2">
                        {rows.length > 1 && (
                          <button
                            onClick={() => removeRow(row.id)}
                            className="text-foreground/25 hover:text-red-400 transition-colors"
                          >
                            <Icon name="Trash2" size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border-t border-foreground/10 my-4" />

          {/* ── Разработал ── */}
          <div className="flex items-end gap-3">
            <span className="text-sm text-foreground/70 shrink-0">Разработал:</span>
            <input
              value={developer}
              onChange={e => setDeveloper(e.target.value)}
              placeholder="ФИО и подпись"
              className="flex-1 bg-transparent border-b border-foreground/20 hover:border-foreground/40 focus:border-primary/60 outline-none text-sm text-foreground placeholder:text-foreground/25 transition-colors"
            />
          </div>

        </div>
      </div>
    </div>
  )
}
