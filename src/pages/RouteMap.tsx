import { useRef, useState, useCallback, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { GrainOverlay } from "@/components/grain-overlay"
import Icon from "@/components/ui/icon"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"

// ── Типы ──────────────────────────────────────────────────────────────────────
interface ApprovalBlock {
  role: string
  org: string
  name: string
  date: string
}

interface RouteRow {
  id: string
  color: string
  length: string
  time: string
}

type DrawTool = "pen" | "eraser"
type ActiveTab = "editor" | "preview"

// ── А3 размеры в пикселях при 96dpi (для экрана)
// A3 книжная: 297×420mm. При экспорте используем 3x scale → ~150dpi print
const A3_W_MM = 297
const A3_H_MM = 420
// Поля: лево 30мм, верх 20мм, право 10мм, низ 20мм
const MARGIN = { left: 30, top: 20, right: 10, bottom: 20 }

// Пикселей на мм при 96dpi
const PX_PER_MM = 96 / 25.4  // ~3.78

const A3_W_PX = Math.round(A3_W_MM * PX_PER_MM)
const A3_H_PX = Math.round(A3_H_MM * PX_PER_MM)

// ── Предустановленные цвета рисования ────────────────────────────────────────
const DRAW_COLORS = [
  "#FFFF00", "#FF0000", "#00CC00", "#00BFFF",
  "#FF8800", "#FF00FF", "#FFFFFF", "#000000",
]

// ── Основная страница ─────────────────────────────────────────────────────────
export default function RouteMap() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<ActiveTab>("editor")
  const [exporting, setExporting] = useState<"pdf" | "png" | null>(null)

  // Данные документа
  const [agree, setAgree] = useState<ApprovalBlock>({
    role: "Главный инженер",
    org: 'ООО «Организация»',
    name: "А.А. Фамилия",
    date: "«____»__________2025г.",
  })
  const [approve, setApprove] = useState<ApprovalBlock>({
    role: "Заместитель командира отряда",
    org: 'филиала «Копейский ВГСО»',
    name: "Д.В. Фамилия",
    date: "«____»__________2025г.",
  })
  const [titleLines, setTitleLines] = useState([
    "Маршрутная карта",
    "профилактического обследования",
    'ООО «Организация»',
    "карьер",
    "на 2026 г.",
  ])
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [rows, setRows] = useState<RouteRow[]>([
    { id: "1", color: "#FFFF00", length: "1,8", time: "2,0" },
    { id: "2", color: "#FF0000", length: "", time: "" },
  ])
  const [devRole, setDevRole] = useState("")
  const [devName, setDevName] = useState("")
  const [devSignature] = useState("")

  // Canvas рисование
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)
  const [drawColor, setDrawColor] = useState("#FFFF00")
  const [drawSize, setDrawSize] = useState(6)
  const [drawTool, setDrawTool] = useState<DrawTool>("pen")
  const [canvasNaturalW, setCanvasNaturalW] = useState(1200)
  const [canvasNaturalH, setCanvasNaturalH] = useState(800)
  const imgContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Ref предпросмотра А3 для экспорта
  const previewRef = useRef<HTMLDivElement>(null)

  // Загрузка изображения
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      setCanvasNaturalW(img.naturalWidth)
      setCanvasNaturalH(img.naturalHeight)
      setImageUrl(url)
      // Сбросить canvas с задержкой (ждём рендер)
      setTimeout(() => {
        const cv = canvasRef.current; if (!cv) return
        cv.width = img.naturalWidth
        cv.height = img.naturalHeight
        cv.getContext("2d")?.clearRect(0, 0, cv.width, cv.height)
      }, 80)
    }
    img.src = url
  }

  // Инициализация canvas при смене изображения
  useEffect(() => {
    const cv = canvasRef.current; if (!cv || !imageUrl) return
    cv.width = canvasNaturalW
    cv.height = canvasNaturalH
  }, [imageUrl, canvasNaturalW, canvasNaturalH])

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent, cv: HTMLCanvasElement) => {
    const rect = cv.getBoundingClientRect()
    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY
    return {
      x: (clientX - rect.left) * (cv.width / rect.width),
      y: (clientY - rect.top) * (cv.height / rect.height),
    }
  }, [])

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
      ctx.lineWidth = drawSize * 8
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

  // Получить итоговое изображение (фото + рисунок поверх) как dataURL
  const getCompositeImageUrl = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      const cv = canvasRef.current
      if (!imageUrl) { resolve(""); return }

      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        const composite = document.createElement("canvas")
        composite.width = img.naturalWidth
        composite.height = img.naturalHeight
        const ctx = composite.getContext("2d")!
        ctx.drawImage(img, 0, 0)
        if (cv) ctx.drawImage(cv, 0, 0)
        resolve(composite.toDataURL("image/png"))
      }
      img.src = imageUrl
    })
  }, [imageUrl])

  // Таблица
  const addRow = () => setRows(r => [...r, { id: Date.now().toString(), color: "#FF0000", length: "", time: "" }])
  const removeRow = (id: string) => setRows(r => r.filter(x => x.id !== id))
  const updateRow = (id: string, field: keyof RouteRow, val: string) =>
    setRows(r => r.map(x => x.id === id ? { ...x, [field]: val } : x))

  // ── Экспорт PNG ──────────────────────────────────────────────────────────────
  const exportPNG = async () => {
    const el = previewRef.current; if (!el) return
    setExporting("png")
    try {
      await new Promise(r => setTimeout(r, 300))
      const canvas = await html2canvas(el, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
      })
      const link = document.createElement("a")
      link.download = "Маршрутная_карта.png"
      link.href = canvas.toDataURL("image/png")
      link.click()
    } finally { setExporting(null) }
  }

  // ── Экспорт PDF А3 ───────────────────────────────────────────────────────────
  const exportPDF = async () => {
    const el = previewRef.current; if (!el) return
    setExporting("pdf")
    try {
      await new Promise(r => setTimeout(r, 300))
      const canvas = await html2canvas(el, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
      })
      const imgData = canvas.toDataURL("image/png")
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a3",
      })
      pdf.addImage(imgData, "PNG", 0, 0, A3_W_MM, A3_H_MM)
      pdf.save("Маршрутная_карта.pdf")
    } finally { setExporting(null) }
  }

  // Составное изображение для предпросмотра
  const [compositeUrl, setCompositeUrl] = useState<string | null>(null)
  useEffect(() => {
    if (activeTab === "preview") {
      getCompositeImageUrl().then(url => setCompositeUrl(url || null))
    }
  }, [activeTab, getCompositeImageUrl])

  // Поля А3 в px (натуральный размер при 96dpi)
  const CONTENT_L = Math.round(MARGIN.left * PX_PER_MM)
  const CONTENT_T = Math.round(MARGIN.top * PX_PER_MM)
  const CONTENT_R = Math.round(MARGIN.right * PX_PER_MM)
  const CONTENT_B = Math.round(MARGIN.bottom * PX_PER_MM)

  // Масштабирование листа по ширине контейнера
  const previewWrapRef = useRef<HTMLDivElement>(null)
  const [previewScale, setPreviewScale] = useState(1)

  useEffect(() => {
    if (activeTab !== "preview") return
    const calcScale = () => {
      const wrap = previewWrapRef.current
      if (!wrap) return
      const availW = wrap.clientWidth - 32 // 16px padding с каждой стороны
      const scale = Math.min(1, availW / A3_W_PX)
      setPreviewScale(scale)
    }
    calcScale()
    window.addEventListener("resize", calcScale)
    return () => window.removeEventListener("resize", calcScale)
  }, [activeTab])

  return (
    <div className="relative min-h-screen text-foreground">
      <GrainOverlay />
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 animated-bg" />
        <div className="absolute inset-0 bg-black/10" />
      </div>

      {/* Навигация */}
      <nav className="fixed left-0 right-0 top-0 z-[60] flex items-center justify-between px-4 py-3 md:px-6 bg-background/80 backdrop-blur-md border-b border-foreground/10">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-foreground/70 hover:text-foreground transition-colors">
          <Icon name="ArrowLeft" size={18} />
          <span className="font-sans text-sm hidden sm:inline">Назад</span>
        </button>
        <div className="flex flex-col items-center">
          <span className="font-sans text-sm font-semibold">Маршрутная карта</span>
          <span className="font-mono text-[10px] text-foreground/40 uppercase tracking-widest">Проф. служба</span>
        </div>
        {/* Кнопки экспорта (только на вкладке предпросмотра) */}
        <div className="flex items-center gap-2">
          {activeTab === "preview" && (
            <>
              <button
                onClick={exportPNG}
                disabled={!!exporting}
                className="flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
              >
                <Icon name="Image" size={13} />
                {exporting === "png" ? "Сохранение..." : "PNG"}
              </button>
              <button
                onClick={exportPDF}
                disabled={!!exporting}
                className="flex items-center gap-1.5 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                <Icon name="FileDown" size={13} />
                {exporting === "pdf" ? "Сохранение..." : "PDF А3"}
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Вкладки */}
      <div className="pt-16 flex flex-col h-screen overflow-hidden">
        <div className="flex gap-0 border-b border-foreground/10 bg-background/60 shrink-0">
          {(["editor", "preview"] as ActiveTab[]).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-sans transition-colors border-b-2 -mb-px ${activeTab === tab ? "border-primary text-foreground" : "border-transparent text-foreground/50 hover:text-foreground/80"}`}>
              {tab === "editor" ? "Редактор" : "Предпросмотр А3"}
            </button>
          ))}
        </div>

        {/* ═══════════════ РЕДАКТОР ═══════════════ */}
        {activeTab === "editor" && (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 pb-16">

              {/* Согласовано / Утверждаю */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                {/* Согласовано */}
                <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-4">
                  <p className="font-mono text-[10px] text-foreground/40 uppercase tracking-widest mb-3">Согласовано</p>
                  <div className="flex flex-col gap-2">
                    {[
                      { label: "Должность", key: "role" as const, ph: "Главный инженер" },
                      { label: "Организация", key: "org" as const, ph: 'ООО «...»' },
                      { label: "ФИО", key: "name" as const, ph: "А.А. Фамилия" },
                      { label: "Дата", key: "date" as const, ph: "«____»_____2025г." },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="text-[10px] text-foreground/40 font-mono uppercase tracking-wider">{f.label}</label>
                        <input value={agree[f.key]} onChange={e => setAgree(a => ({ ...a, [f.key]: e.target.value }))}
                          placeholder={f.ph}
                          className="w-full bg-transparent border-b border-foreground/20 hover:border-foreground/40 focus:border-primary/60 outline-none text-sm text-foreground placeholder:text-foreground/25 transition-colors" />
                      </div>
                    ))}
                  </div>
                </div>
                {/* Утверждаю */}
                <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-4">
                  <p className="font-mono text-[10px] text-foreground/40 uppercase tracking-widest mb-3">Утверждаю</p>
                  <div className="flex flex-col gap-2">
                    {[
                      { label: "Должность", key: "role" as const, ph: "Зам. командира отряда" },
                      { label: "Организация", key: "org" as const, ph: 'филиала «ВГСО»' },
                      { label: "ФИО", key: "name" as const, ph: "Д.В. Фамилия" },
                      { label: "Дата", key: "date" as const, ph: "«____»_____2025г." },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="text-[10px] text-foreground/40 font-mono uppercase tracking-wider">{f.label}</label>
                        <input value={approve[f.key]} onChange={e => setApprove(a => ({ ...a, [f.key]: e.target.value }))}
                          placeholder={f.ph}
                          className="w-full bg-transparent border-b border-foreground/20 hover:border-foreground/40 focus:border-primary/60 outline-none text-sm text-foreground placeholder:text-foreground/25 transition-colors" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Заголовок */}
              <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-4 mb-6">
                <p className="font-mono text-[10px] text-foreground/40 uppercase tracking-widest mb-3">Наименование документа</p>
                <div className="flex flex-col gap-2 items-center">
                  {titleLines.map((line, i) => (
                    <input key={i} value={line}
                      onChange={e => setTitleLines(l => l.map((x, j) => j === i ? e.target.value : x))}
                      placeholder={`Строка ${i + 1}`}
                      className={`bg-transparent border-b border-foreground/20 hover:border-foreground/40 focus:border-primary/60 outline-none text-center w-full max-w-md placeholder:text-foreground/25 transition-colors ${i === 0 ? "text-base font-bold text-foreground" : "text-sm text-foreground/80"}`}
                    />
                  ))}
                </div>
              </div>

              {/* Карта + рисование */}
              <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-4 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-mono text-[10px] text-foreground/40 uppercase tracking-widest">Схема маршрута</p>
                  <button onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-xs text-foreground/70 hover:text-foreground transition-colors">
                    <Icon name="ImagePlus" size={13} />
                    {imageUrl ? "Заменить" : "Загрузить карту"}
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </div>

                {/* Панель инструментов */}
                {imageUrl && (
                  <div className="flex flex-wrap items-center gap-3 mb-3 p-3 rounded-xl border border-foreground/10 bg-background/30">
                    {/* Цвета */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {DRAW_COLORS.map(c => (
                        <button key={c} title={c}
                          onClick={() => { setDrawColor(c); setDrawTool("pen") }}
                          className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${drawColor === c && drawTool === "pen" ? "border-white scale-110" : "border-transparent"}`}
                          style={{ background: c, boxShadow: c === "#FFFFFF" ? "inset 0 0 0 1px rgba(0,0,0,0.2)" : undefined }} />
                      ))}
                      <label title="Свой цвет" className="relative w-6 h-6 rounded-full border-2 border-dashed border-foreground/30 overflow-hidden cursor-pointer hover:border-foreground/60 transition-colors flex items-center justify-center">
                        <Icon name="Palette" size={12} className="text-foreground/50" />
                        <input type="color" value={drawColor} onChange={e => { setDrawColor(e.target.value); setDrawTool("pen") }}
                          className="absolute inset-0 opacity-0 cursor-pointer" />
                      </label>
                    </div>
                    <div className="w-px h-5 bg-foreground/15" />
                    {/* Толщина */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-foreground/40">Толщина</span>
                      <input type="range" min="2" max="30" value={drawSize} onChange={e => setDrawSize(+e.target.value)}
                        className="w-20 accent-blue-400 h-1" />
                      <span className="text-[10px] text-foreground/60 w-5">{drawSize}</span>
                    </div>
                    <div className="w-px h-5 bg-foreground/15" />
                    {/* Ластик */}
                    <button onClick={() => setDrawTool(t => t === "eraser" ? "pen" : "eraser")}
                      className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition-colors ${drawTool === "eraser" ? "border-orange-400/60 bg-orange-500/15 text-orange-400" : "border-foreground/20 bg-foreground/5 text-foreground/60 hover:text-foreground"}`}>
                      <Icon name="Eraser" size={12} />Ластик
                    </button>
                    <button onClick={clearCanvas}
                      className="flex items-center gap-1 rounded-lg border border-foreground/20 bg-foreground/5 px-2.5 py-1 text-xs text-foreground/60 hover:text-red-400 hover:border-red-400/40 transition-colors ml-auto">
                      <Icon name="Trash2" size={12} />Очистить
                    </button>
                  </div>
                )}

                {/* Canvas область */}
                <div ref={imgContainerRef} className="relative rounded-lg overflow-hidden border border-foreground/15 bg-foreground/5">
                  {imageUrl ? (
                    <>
                      <img src={imageUrl} alt="Карта" className="block w-full h-auto pointer-events-none select-none" draggable={false} />
                      <canvas ref={canvasRef}
                        className="absolute inset-0 w-full h-full"
                        style={{ cursor: drawTool === "eraser" ? "cell" : "crosshair", touchAction: "none" }}
                        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                        onTouchStart={e => { e.preventDefault(); startDraw(e) }}
                        onTouchMove={e => { e.preventDefault(); draw(e) }}
                        onTouchEnd={stopDraw}
                      />
                      <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1 pointer-events-none">
                        {drawTool === "eraser"
                          ? <span className="text-orange-300 text-[10px]">Ластик</span>
                          : (<><div className="w-3 h-3 rounded-full border border-white/40" style={{ background: drawColor }} /><span className="text-white/70 text-[10px]">{drawSize}px</span></>)
                        }
                      </div>
                    </>
                  ) : (
                    <button onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center w-full h-52 gap-3 text-foreground/30 hover:text-foreground/50 transition-colors">
                      <Icon name="Map" size={44} />
                      <span className="text-sm">Загрузить карту или спутниковый снимок</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Таблица маршрутов */}
              <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-4 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-mono text-[10px] text-foreground/40 uppercase tracking-widest">Маршрут профилактического обследования</p>
                  <button onClick={addRow}
                    className="flex items-center gap-1 text-xs text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/10 transition-colors">
                    <Icon name="Plus" size={13} />Добавить строку
                  </button>
                </div>
                <div className="rounded-lg overflow-hidden border border-foreground/15">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-foreground/8 border-b border-foreground/10">
                        <th className="text-left px-3 py-2 text-[10px] font-mono text-foreground/50 uppercase tracking-wider w-10">№</th>
                        <th className="text-left px-3 py-2 text-[10px] font-mono text-foreground/50 uppercase tracking-wider w-28">Цвет</th>
                        <th className="text-left px-3 py-2 text-[10px] font-mono text-foreground/50 uppercase tracking-wider">Протяжённость (км.)</th>
                        <th className="text-left px-3 py-2 text-[10px] font-mono text-foreground/50 uppercase tracking-wider">Время обследования (ч.)</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, idx) => (
                        <tr key={row.id} className="border-b border-foreground/8 hover:bg-foreground/3">
                          <td className="px-3 py-2 text-foreground/50 text-xs">{idx + 1}</td>
                          <td className="px-3 py-2">
                            <label className="relative flex items-center gap-2 cursor-pointer">
                              <div className="w-12 h-6 rounded border-2 border-foreground/20 hover:border-foreground/40 transition-colors" style={{ background: row.color }} />
                              <span className="font-mono text-[9px] text-foreground/40">{row.color.toUpperCase()}</span>
                              <input type="color" value={row.color} onChange={e => updateRow(row.id, "color", e.target.value)}
                                className="absolute inset-0 opacity-0 cursor-pointer w-12" />
                            </label>
                          </td>
                          <td className="px-3 py-2">
                            <input value={row.length} onChange={e => updateRow(row.id, "length", e.target.value)} placeholder="0,0"
                              className="bg-transparent border-b border-foreground/20 hover:border-foreground/40 focus:border-primary/60 outline-none text-sm text-foreground w-24 placeholder:text-foreground/25 transition-colors" />
                          </td>
                          <td className="px-3 py-2">
                            <input value={row.time} onChange={e => updateRow(row.id, "time", e.target.value)} placeholder="0,0"
                              className="bg-transparent border-b border-foreground/20 hover:border-foreground/40 focus:border-primary/60 outline-none text-sm text-foreground w-24 placeholder:text-foreground/25 transition-colors" />
                          </td>
                          <td className="px-2 py-2">
                            {rows.length > 1 && (
                              <button onClick={() => removeRow(row.id)} className="text-foreground/25 hover:text-red-400 transition-colors">
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

              {/* Разработал */}
              <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-4">
                <p className="font-mono text-[10px] text-foreground/40 uppercase tracking-widest mb-3">Разработал</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-foreground/40 font-mono uppercase tracking-wider">Должность</label>
                    <input value={devRole} onChange={e => setDevRole(e.target.value)} placeholder="ПКО, инженер и т.д."
                      className="w-full bg-transparent border-b border-foreground/20 hover:border-foreground/40 focus:border-primary/60 outline-none text-sm text-foreground placeholder:text-foreground/25 transition-colors" />
                  </div>
                  <div>
                    <label className="text-[10px] text-foreground/40 font-mono uppercase tracking-wider">ФИО</label>
                    <input value={devName} onChange={e => setDevName(e.target.value)} placeholder="Фамилия И.О."
                      className="w-full bg-transparent border-b border-foreground/20 hover:border-foreground/40 focus:border-primary/60 outline-none text-sm text-foreground placeholder:text-foreground/25 transition-colors" />
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ═══════════════ ПРЕДПРОСМОТР А3 ═══════════════ */}
        {activeTab === "preview" && (
          <div ref={previewWrapRef} className="flex-1 overflow-auto bg-foreground/10 py-6 px-4">
            {exporting && (
              <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="bg-background border border-foreground/15 rounded-2xl p-8 flex flex-col items-center gap-4">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-foreground/70 text-sm">Подготовка файла…</span>
                </div>
              </div>
            )}

            {/* Обёртка для масштабирования */}
            <div style={{
              width: A3_W_PX,
              transformOrigin: "top center",
              transform: `scale(${previewScale})`,
              marginBottom: previewScale < 1 ? A3_H_PX * (previewScale - 1) : 0,
              marginLeft: "auto",
              marginRight: "auto",
            }}>
            {/* Лист А3 книжный — flex колонка, таблица и подпись внизу */}
            <div
              ref={previewRef}
              className="bg-white shadow-2xl"
              style={{
                width: A3_W_PX,
                height: A3_H_PX,
                fontFamily: "Times New Roman, Times, serif",
                fontSize: 11,
                color: "#000",
                position: "relative",
                boxSizing: "border-box",
                paddingLeft: CONTENT_L,
                paddingTop: CONTENT_T,
                paddingRight: CONTENT_R,
                paddingBottom: CONTENT_B,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Рамка — имитация штампа */}
              <div style={{
                position: "absolute",
                left: CONTENT_L - 2, top: CONTENT_T - 2,
                right: CONTENT_R - 2, bottom: CONTENT_B - 2,
                border: "1px solid #000",
                pointerEvents: "none",
              }} />

              {/* Строка СОГЛАСОВАНО / УТВЕРЖДАЮ */}
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, flexShrink: 0 }}>
                {/* Согласовано */}
                <div style={{ width: "45%", fontSize: 10, lineHeight: 1.5 }}>
                  <div style={{ fontWeight: "bold", textTransform: "uppercase", fontSize: 10 }}>СОГЛАСОВАНО</div>
                  <div>{agree.role}</div>
                  <div>{agree.org}</div>
                  <div>{agree.name}</div>
                  <div style={{ borderBottom: "1px solid #555", width: "80%", marginBottom: 1 }} />
                  <div>{agree.date}</div>
                </div>
                {/* Утверждаю */}
                <div style={{ width: "45%", fontSize: 10, lineHeight: 1.5, textAlign: "right" }}>
                  <div style={{ fontWeight: "bold", textTransform: "uppercase", fontSize: 10 }}>УТВЕРЖДАЮ</div>
                  <div>{approve.role}</div>
                  <div>{approve.org}</div>
                  <div>{approve.name}</div>
                  <div style={{ borderBottom: "1px solid #555", width: "80%", marginBottom: 1, marginLeft: "auto" }} />
                  <div>{approve.date}</div>
                </div>
              </div>

              {/* Заголовок */}
              <div style={{ textAlign: "center", marginBottom: 6, flexShrink: 0 }}>
                {titleLines.map((line, i) => (
                  <div key={i} style={{ fontWeight: i === 0 ? "bold" : "normal", fontSize: i === 0 ? 12 : 11 }}>{line || "\u00A0"}</div>
                ))}
              </div>

              {/* Картинка с рисунком — занимает всё свободное место */}
              <div style={{ flex: 1, border: "1px solid #999", marginBottom: 6, lineHeight: 0, overflow: "hidden", minHeight: 0 }}>
                {compositeUrl ? (
                  <img src={compositeUrl} alt="Схема маршрута"
                    style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", fontSize: 12 }}>
                    Карта не загружена
                  </div>
                )}
              </div>

              {/* Таблица маршрутов — прибита к низу, растёт при добавлении строк */}
              <div style={{ flexShrink: 0, marginBottom: 6 }}>
                <table style={{ width: "60%", margin: "0 auto", borderCollapse: "collapse", fontSize: 10 }}>
                  <thead>
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", border: "1px solid #000", padding: "2px 4px", fontWeight: "normal" }}>
                        Маршрут профилактического обследования
                      </td>
                    </tr>
                    <tr>
                      <td style={{ border: "1px solid #000", padding: "2px 6px", width: 24, textAlign: "center" }}>№</td>
                      <td style={{ border: "1px solid #000", padding: "2px 6px", width: 60, textAlign: "center" }}>Цвет</td>
                      <td style={{ border: "1px solid #000", padding: "2px 6px", textAlign: "center" }}>Протяжённость маршрута (км.)</td>
                      <td style={{ border: "1px solid #000", padding: "2px 6px", textAlign: "center" }}>Время обследования (ч.)</td>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={row.id}>
                        <td style={{ border: "1px solid #000", padding: "2px 6px", textAlign: "center" }}>{idx + 1}</td>
                        <td style={{ border: "1px solid #000", padding: "2px 6px", textAlign: "center" }}>
                          <div style={{ width: 40, height: 12, background: row.color, margin: "0 auto", border: "1px solid #ccc" }} />
                        </td>
                        <td style={{ border: "1px solid #000", padding: "2px 6px", textAlign: "center" }}>{row.length}</td>
                        <td style={{ border: "1px solid #000", padding: "2px 6px", textAlign: "center" }}>{row.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Разработал — прибит к низу, три колонки */}
              <div style={{ flexShrink: 0, display: "flex", alignItems: "flex-end", gap: 0, fontSize: 10 }}>
                {/* Должность + подпись */}
                <div style={{ flex: "0 0 38%", paddingRight: 8 }}>
                  <div style={{ color: "#666", fontSize: 9, marginBottom: 1 }}>должность, подпись</div>
                  <div style={{ borderBottom: "1px solid #555", paddingBottom: 1 }}>{devRole}</div>
                </div>
                {/* Пустая зона для подписи */}
                <div style={{ flex: "0 0 22%", paddingRight: 8 }}>
                  <div style={{ color: "#666", fontSize: 9, marginBottom: 1 }}>&nbsp;</div>
                  <div style={{ borderBottom: "1px solid #555", paddingBottom: 1 }}>{devSignature}&nbsp;</div>
                </div>
                {/* ФИО */}
                <div style={{ flex: "0 0 40%" }}>
                  <div style={{ color: "#666", fontSize: 9, marginBottom: 1 }}>фамилия и инициалы</div>
                  <div style={{ borderBottom: "1px solid #555", paddingBottom: 1 }}>{devName}</div>
                </div>
              </div>
            </div>

            </div>{/* конец обёртки масштабирования */}

            {/* Подсказка под листом */}
            <p className="text-center text-foreground/30 text-xs mt-4">
              Формат А3 книжный (297×420мм) · Поля: лево 30мм, верх/низ 20мм, право 10мм
            </p>
          </div>
        )}
      </div>
    </div>
  )
}