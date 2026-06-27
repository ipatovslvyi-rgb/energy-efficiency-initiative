import { useRef, useState, useCallback, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { GrainOverlay } from "@/components/grain-overlay"
import Icon from "@/components/ui/icon"
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
type Orientation = "portrait" | "landscape"

// ── А3 размеры в мм ───────────────────────────────────────────────────────────
const A3_SHORT = 297
const A3_LONG  = 420
// Поля: лево 30мм, верх 20мм, право 10мм, низ 20мм
const MARGIN = { left: 30, top: 20, right: 10, bottom: 20 }

// Пикселей на мм при 96dpi
const PX_PER_MM = 96 / 25.4  // ~3.78

// ── Предустановленные цвета рисования ────────────────────────────────────────
const DRAW_COLORS = [
  "#FFFF00", "#FF0000", "#00CC00", "#00BFFF",
  "#FF8800", "#FF00FF", "#FFFFFF", "#000000",
]

// Цикличная палитра для автоназначения при добавлении новых строк
const AUTO_COLORS = [
  "#FFFF00", "#FF0000", "#00CC00", "#00BFFF",
  "#FF8800", "#FF00FF", "#000000", "#FF69B4",
  "#8A2BE2", "#00CED1", "#DC143C", "#228B22",
]

// ── Основная страница ─────────────────────────────────────────────────────────
export default function RouteMap() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<ActiveTab>("editor")
  const [exporting, setExporting] = useState<"pdf" | "png" | null>(null)
  const [orientation, setOrientation] = useState<Orientation>("landscape")

  // Размеры листа зависят от ориентации
  const A3_W_MM = orientation === "landscape" ? A3_LONG  : A3_SHORT
  const A3_H_MM = orientation === "landscape" ? A3_SHORT : A3_LONG
  const A3_W_PX = Math.round(A3_W_MM * PX_PER_MM)
  const A3_H_PX = Math.round(A3_H_MM * PX_PER_MM)
  const CONTENT_L = Math.round(MARGIN.left   * PX_PER_MM)
  const CONTENT_T = Math.round(MARGIN.top    * PX_PER_MM)
  const CONTENT_R = Math.round(MARGIN.right  * PX_PER_MM)
  const CONTENT_B = Math.round(MARGIN.bottom * PX_PER_MM)

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
  // Храним dataURL сразу при загрузке — избегаем проблем с blob URL при composite
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [rows, setRows] = useState<RouteRow[]>([
    { id: "1", color: "#FFFF00", length: "1,8", time: "2,0" },
    { id: "2", color: "#FF0000", length: "", time: "" },
  ])
  const [devRole, setDevRole] = useState("")
  const [devName, setDevName] = useState("")
  // ID строки, цвет которой синхронизирован с карандашом
  const [activeRowId, setActiveRowId] = useState<string | null>("1")

  // Canvas рисование
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)
  const [drawColor, setDrawColor] = useState("#FFFF00")
  const [drawSize, setDrawSize] = useState(6)
  const [drawTool, setDrawTool] = useState<DrawTool>("pen")
  const [canvasNaturalW, setCanvasNaturalW] = useState(1200)
  const [canvasNaturalH, setCanvasNaturalH] = useState(800)
  // Снимок canvas после каждого мазка — чтобы composite не терял рисунок
  const [canvasSnapshot, setCanvasSnapshot] = useState<string | null>(null)

  // Положение мыши для кружка-курсора
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)
  const [cursorVisible, setCursorVisible] = useState(false)

  const imgContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Ref предпросмотра А3 для экспорта
  const previewRef = useRef<HTMLDivElement>(null)

  // Загрузка изображения — сохраняем как dataURL
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      const img = new Image()
      img.onload = () => {
        setCanvasNaturalW(img.naturalWidth)
        setCanvasNaturalH(img.naturalHeight)
        setImageDataUrl(dataUrl)
        setTimeout(() => {
          const cv = canvasRef.current; if (!cv) return
          cv.width = img.naturalWidth
          cv.height = img.naturalHeight
          cv.getContext("2d")?.clearRect(0, 0, cv.width, cv.height)
        }, 80)
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
  }

  // Инициализация canvas при смене изображения
  useEffect(() => {
    const cv = canvasRef.current; if (!cv || !imageDataUrl) return
    cv.width = canvasNaturalW
    cv.height = canvasNaturalH
  }, [imageDataUrl, canvasNaturalW, canvasNaturalH])

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
    // Обновляем позицию курсора для кружка
    if ("clientX" in e) {
      const container = imgContainerRef.current
      if (container) {
        const rect = container.getBoundingClientRect()
        setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
      }
    }

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

  // Сохраняем снимок canvas после окончания мазка
  const saveSnapshot = () => {
    const cv = canvasRef.current; if (!cv) return
    setCanvasSnapshot(cv.toDataURL("image/png"))
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    const container = imgContainerRef.current
    if (container) {
      const rect = container.getBoundingClientRect()
      setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    }
    draw(e)
  }

  const stopDraw = () => {
    if (isDrawing.current) saveSnapshot()
    isDrawing.current = false
    lastPos.current = null
  }

  const clearCanvas = () => {
    const cv = canvasRef.current; if (!cv) return
    cv.getContext("2d")?.clearRect(0, 0, cv.width, cv.height)
    setCanvasSnapshot(null)
  }

  // Получить итоговое изображение (фото + рисунок поверх) как dataURL
  const getCompositeImageUrl = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      if (!imageDataUrl) { resolve(""); return }

      const img = new Image()
      img.onload = () => {
        const composite = document.createElement("canvas")
        composite.width = img.naturalWidth
        composite.height = img.naturalHeight
        const ctx = composite.getContext("2d")!
        ctx.drawImage(img, 0, 0)
        if (canvasSnapshot) {
          const overlay = new Image()
          overlay.onload = () => {
            ctx.drawImage(overlay, 0, 0)
            resolve(composite.toDataURL("image/png"))
          }
          overlay.src = canvasSnapshot
        } else {
          resolve(composite.toDataURL("image/png"))
        }
      }
      img.src = imageDataUrl
    })
  }, [imageDataUrl, canvasSnapshot])

  // Таблица — при добавлении строки берём следующий цвет из палитры и синхронизируем карандаш
  const addRow = () => {
    setRows(r => {
      const nextColor = AUTO_COLORS[r.length % AUTO_COLORS.length]
      const newId = Date.now().toString()
      setDrawColor(nextColor)
      setDrawTool("pen")
      setActiveRowId(newId)
      return [...r, { id: newId, color: nextColor, length: "", time: "" }]
    })
  }
  const removeRow = (id: string) => setRows(r => r.filter(x => x.id !== id))
  const updateRow = (id: string, field: keyof RouteRow, val: string) => {
    setRows(r => r.map(x => x.id === id ? { ...x, [field]: val } : x))
    if (field === "color") {
      setDrawColor(val)
      setDrawTool("pen")
      setActiveRowId(id)
    }
  }
  // Выбрать строку (переключить карандаш на её цвет)
  const selectRow = (id: string) => {
    const row = rows.find(r => r.id === id)
    if (!row) return
    setDrawColor(row.color)
    setDrawTool("pen")
    setActiveRowId(id)
  }
  // При выборе цвета в палитре карандаша — обновляем активную строку таблицы
  const pickColor = (color: string) => {
    setDrawColor(color)
    setDrawTool("pen")
    if (activeRowId) {
      setRows(r => r.map(x => x.id === activeRowId ? { ...x, color } : x))
    }
  }

  // ── Экспорт PNG ──────────────────────────────────────────────────────────────
  const exportPNG = async () => {
    const el = previewRef.current; if (!el) return
    setExporting("png")
    try {
      // Импортируем html2canvas динамически
      const { default: html2canvas } = await import("html2canvas")
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

  // ── Экспорт PDF А3 — рисуем через canvas напрямую ────────────────────────────
  const exportPDF = async () => {
    const el = previewRef.current; if (!el) return
    setExporting("pdf")
    try {
      const { default: html2canvas } = await import("html2canvas")
      await new Promise(r => setTimeout(r, 300))
      const canvas = await html2canvas(el, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
      })
      const imgData = canvas.toDataURL("image/png")
      const pdfOrientation = orientation === "landscape" ? "landscape" : "portrait"
      const pdf = new jsPDF({
        orientation: pdfOrientation,
        unit: "mm",
        format: "a3",
      })
      pdf.addImage(imgData, "PNG", 0, 0, A3_W_MM, A3_H_MM)
      pdf.save("Маршрутная_карта.pdf")
    } finally { setExporting(null) }
  }

  // Составное изображение для предпросмотра + натуральные размеры для правильных пропорций
  const [compositeUrl, setCompositeUrl] = useState<string | null>(null)
  const [compositeNatW, setCompositeNatW] = useState(0)
  const [compositeNatH, setCompositeNatH] = useState(0)
  useEffect(() => {
    if (activeTab === "preview") {
      getCompositeImageUrl().then(url => {
        if (!url) { setCompositeUrl(null); return }
        setCompositeUrl(url)
        const img = new Image()
        img.onload = () => {
          setCompositeNatW(img.naturalWidth)
          setCompositeNatH(img.naturalHeight)
        }
        img.src = url
      })
    }
  }, [activeTab, getCompositeImageUrl])

  // Масштабирование листа по ширине контейнера
  const previewWrapRef = useRef<HTMLDivElement>(null)
  const [previewScale, setPreviewScale] = useState(1)

  useEffect(() => {
    if (activeTab !== "preview") return
    const calcScale = () => {
      const wrap = previewWrapRef.current
      if (!wrap) return
      const availW = wrap.clientWidth - 32
      const scale = Math.min(1, availW / A3_W_PX)
      setPreviewScale(scale)
    }
    calcScale()
    window.addEventListener("resize", calcScale)
    return () => window.removeEventListener("resize", calcScale)
  }, [activeTab, A3_W_PX])

  // Радиус кружка курсора в px (в координатах контейнера)
  const getCursorRadiusPx = () => {
    if (!canvasRef.current || !imgContainerRef.current) return drawTool === "eraser" ? drawSize * 4 : drawSize / 2
    const cv = canvasRef.current
    const container = imgContainerRef.current
    const scaleX = container.clientWidth / cv.width
    const brushPx = drawTool === "eraser" ? drawSize * 8 : drawSize
    return (brushPx * scaleX) / 2
  }

  const orientLabel = orientation === "landscape" ? "Альбомная (А3)" : "Книжная (А3)"
  const hintText = orientation === "landscape"
    ? "Формат А3 альбомный (420×297мм) · Поля: лево 30мм, верх/низ 20мм, право 10мм"
    : "Формат А3 книжный (297×420мм) · Поля: лево 30мм, верх/низ 20мм, право 10мм"

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
        <div className="flex items-center gap-2">
          {/* Переключатель ориентации */}
          <button
            onClick={() => setOrientation(o => o === "landscape" ? "portrait" : "landscape")}
            title="Переключить ориентацию"
            className="flex items-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-xs text-foreground/60 hover:text-foreground transition-colors"
          >
            <Icon name={orientation === "landscape" ? "RectangleHorizontal" : "RectangleVertical"} size={13} />
            <span className="hidden sm:inline">{orientLabel}</span>
          </button>
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
                    {imageDataUrl ? "Заменить" : "Загрузить карту"}
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </div>

                {/* Панель инструментов */}
                {imageDataUrl && (
                  <div className="flex flex-wrap items-center gap-3 mb-3 p-3 rounded-xl border border-foreground/10 bg-background/30">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {DRAW_COLORS.map(c => (
                        <button key={c} title={c}
                          onClick={() => pickColor(c)}
                          className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${drawColor === c && drawTool === "pen" ? "border-white scale-110" : "border-transparent"}`}
                          style={{ background: c, boxShadow: c === "#FFFFFF" ? "inset 0 0 0 1px rgba(0,0,0,0.2)" : undefined }} />
                      ))}
                      <label title="Свой цвет" className="relative w-6 h-6 rounded-full border-2 border-dashed border-foreground/30 overflow-hidden cursor-pointer hover:border-foreground/60 transition-colors flex items-center justify-center">
                        <Icon name="Palette" size={12} className="text-foreground/50" />
                        <input type="color" value={drawColor} onChange={e => pickColor(e.target.value)}
                          className="absolute inset-0 opacity-0 cursor-pointer" />
                      </label>
                    </div>
                    <div className="w-px h-5 bg-foreground/15" />
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-foreground/40">Толщина</span>
                      <input type="range" min="2" max="30" value={drawSize} onChange={e => setDrawSize(+e.target.value)}
                        className="w-20 accent-blue-400 h-1" />
                      <span className="text-[10px] text-foreground/60 w-5">{drawSize}</span>
                    </div>
                    <div className="w-px h-5 bg-foreground/15" />
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
                <div
                  ref={imgContainerRef}
                  className="relative rounded-lg overflow-hidden border border-foreground/15 bg-foreground/5"
                  onMouseEnter={() => setCursorVisible(true)}
                  onMouseLeave={() => { setCursorVisible(false); stopDraw() }}
                >
                  {imageDataUrl ? (
                    <>
                      <img src={imageDataUrl} alt="Карта" className="block w-full h-auto pointer-events-none select-none" draggable={false} />
                      <canvas ref={canvasRef}
                        className="absolute inset-0 w-full h-full"
                        style={{ cursor: "none", touchAction: "none" }}
                        onMouseDown={startDraw}
                        onMouseMove={handleMouseMove}
                        onMouseUp={stopDraw}
                        onMouseLeave={stopDraw}
                        onTouchStart={e => { e.preventDefault(); startDraw(e) }}
                        onTouchMove={e => { e.preventDefault(); draw(e) }}
                        onTouchEnd={stopDraw}
                      />
                      {/* Кружок-курсор */}
                      {cursorVisible && cursorPos && (
                        <div
                          className="pointer-events-none absolute rounded-full"
                          style={{
                            left: cursorPos.x,
                            top: cursorPos.y,
                            width: getCursorRadiusPx() * 2,
                            height: getCursorRadiusPx() * 2,
                            transform: "translate(-50%, -50%)",
                            border: drawTool === "eraser"
                              ? "2px solid rgba(255,150,0,0.85)"
                              : `2px solid ${drawColor === "#000000" ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.6)"}`,
                            background: drawTool === "eraser"
                              ? "rgba(255,150,0,0.08)"
                              : drawColor + "33",
                            boxShadow: drawTool === "eraser"
                              ? "0 0 0 1px rgba(0,0,0,0.3)"
                              : `0 0 0 1px ${drawColor}88`,
                            zIndex: 10,
                          }}
                        />
                      )}
                      <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1 pointer-events-none">
                        {drawTool === "eraser"
                          ? <span className="text-orange-300 text-[10px]">Ластик · {drawSize * 8}px</span>
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
                  <p className="font-mono text-[10px] text-foreground/40 uppercase tracking-widest">Маршруты</p>
                  <button onClick={addRow}
                    className="flex items-center gap-1 rounded-lg border border-foreground/20 bg-foreground/5 px-2.5 py-1 text-xs text-foreground/60 hover:text-foreground transition-colors">
                    <Icon name="Plus" size={12} />Добавить
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-foreground/40 text-[11px] font-mono uppercase tracking-wider">
                        <th className="text-left pb-2 pl-3 w-8">№</th>
                        <th className="text-left pb-2 w-14">Цвет</th>
                        <th className="text-left pb-2">Протяжённость (км)</th>
                        <th className="text-left pb-2">Время (ч)</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, idx) => (
                        <tr key={row.id}
                          onClick={() => selectRow(row.id)}
                          className={`border-t border-foreground/10 cursor-pointer transition-colors ${activeRowId === row.id ? "bg-foreground/10" : "hover:bg-foreground/5"}`}>
                          <td className="px-3 py-2 text-foreground/50">{idx + 1}</td>
                          <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                            <input type="color" value={row.color} onChange={e => updateRow(row.id, "color", e.target.value)}
                              className="w-10 h-7 rounded cursor-pointer border-0 bg-transparent" />
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
            {/* Лист А3 */}
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
              {/* Рамка */}
              <div style={{
                position: "absolute",
                left: CONTENT_L - 2, top: CONTENT_T - 2,
                right: CONTENT_R - 2, bottom: CONTENT_B - 2,
                border: "1px solid #000",
                pointerEvents: "none",
              }} />

              {/* Строка СОГЛАСОВАНО / УТВЕРЖДАЮ */}
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, flexShrink: 0 }}>
                <div style={{ width: "45%", fontSize: 10, lineHeight: 1.5 }}>
                  <div style={{ fontWeight: "bold", textTransform: "uppercase", fontSize: 10 }}>СОГЛАСОВАНО</div>
                  <div>{agree.role}</div>
                  <div>{agree.org}</div>
                  <div>{agree.name}</div>
                  <div style={{ borderTop: "0.5px solid #555", width: "80%", marginTop: 2, marginBottom: 1 }} />
                  <div>{agree.date}</div>
                </div>
                <div style={{ width: "45%", fontSize: 10, lineHeight: 1.5, textAlign: "right" }}>
                  <div style={{ fontWeight: "bold", textTransform: "uppercase", fontSize: 10 }}>УТВЕРЖДАЮ</div>
                  <div>{approve.role}</div>
                  <div>{approve.org}</div>
                  <div>{approve.name}</div>
                  <div style={{ borderTop: "0.5px solid #555", width: "80%", marginTop: 2, marginBottom: 1, marginLeft: "auto" }} />
                  <div>{approve.date}</div>
                </div>
              </div>

              {/* Заголовок */}
              <div style={{ textAlign: "center", marginBottom: 6, flexShrink: 0 }}>
                {titleLines.map((line, i) => (
                  <div key={i} style={{ fontWeight: i === 0 ? "bold" : "normal", fontSize: i === 0 ? 12 : 11 }}>{line || "\u00A0"}</div>
                ))}
              </div>

              {/* Картинка — занимает всё свободное место, пропорции сохраняются вручную */}
              <div style={{ flex: 1, border: "1px solid #999", marginBottom: 6, overflow: "hidden", minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" }}>
                {compositeUrl ? (() => {
                  // Вычисляем размеры с сохранением пропорций (letterbox внутри контейнера)
                  // Контейнер = ширина листа минус поля, высота = flex 1 (неизвестна до рендера)
                  // Используем width:100%, height:auto — изображение не растягивается по высоте
                  const ratio = compositeNatH > 0 ? compositeNatW / compositeNatH : 4 / 3
                  return (
                    <img
                      src={compositeUrl}
                      alt="Схема маршрута"
                      style={{
                        display: "block",
                        maxWidth: "100%",
                        maxHeight: "100%",
                        width: ratio >= 1 ? "100%" : "auto",
                        height: ratio >= 1 ? "auto" : "100%",
                        objectFit: "unset",
                      }}
                    />
                  )
                })() : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", fontSize: 12 }}>
                    Карта не загружена
                  </div>
                )}
              </div>

              {/* Таблица маршрутов */}
              <div style={{ flexShrink: 0, marginBottom: 6 }}>
                <table style={{ width: "60%", margin: "0 auto", borderCollapse: "collapse", fontSize: 10 }}>
                  <thead>
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", border: "0.5px solid #000", padding: "2px 4px", fontWeight: "normal" }}>
                        Маршрут профилактического обследования
                      </td>
                    </tr>
                    <tr>
                      <td style={{ border: "0.5px solid #000", padding: "2px 6px", width: 24, textAlign: "center" }}>№</td>
                      <td style={{ border: "0.5px solid #000", padding: "2px 6px", width: 60, textAlign: "center" }}>Цвет</td>
                      <td style={{ border: "0.5px solid #000", padding: "2px 6px", textAlign: "center" }}>Протяжённость маршрута (км.)</td>
                      <td style={{ border: "0.5px solid #000", padding: "2px 6px", textAlign: "center" }}>Время обследования (ч.)</td>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={row.id}>
                        <td style={{ border: "0.5px solid #000", padding: "2px 6px", textAlign: "center" }}>{idx + 1}</td>
                        <td style={{ border: "0.5px solid #000", padding: "2px 6px", textAlign: "center" }}>
                          <div style={{ width: 36, height: 10, background: row.color, margin: "0 auto", border: "0.5px solid #bbb" }} />
                        </td>
                        <td style={{ border: "0.5px solid #000", padding: "2px 6px", textAlign: "center" }}>{row.length}</td>
                        <td style={{ border: "0.5px solid #000", padding: "2px 6px", textAlign: "center" }}>{row.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Разработал — три колонки; линия ПОД текстом, не перечёркивает */}
              <div style={{ flexShrink: 0, display: "flex", alignItems: "flex-end", gap: 0, fontSize: 10, marginBottom: 8 }}>
                {/* Должность */}
                <div style={{ flex: "0 0 35%", paddingRight: 12 }}>
                  <div style={{ lineHeight: 1.4, minHeight: 14, paddingBottom: 1 }}>{devRole}</div>
                  <div style={{ borderTop: "0.5px solid #555", marginTop: 1, width: "85%" }} />
                </div>
                {/* Подпись (пустая линия) */}
                <div style={{ flex: "0 0 20%", paddingRight: 12 }}>
                  <div style={{ lineHeight: 1.4, minHeight: 14 }}>&nbsp;</div>
                  <div style={{ borderTop: "0.5px solid #555", marginTop: 1 }} />
                </div>
                {/* ФИО */}
                <div style={{ flex: "0 0 45%" }}>
                  <div style={{ lineHeight: 1.4, minHeight: 14, paddingBottom: 1 }}>{devName}</div>
                  <div style={{ borderTop: "0.5px solid #555", marginTop: 1 }} />
                </div>
              </div>
            </div>

            </div>{/* конец обёртки масштабирования */}

            <p className="text-center text-foreground/30 text-xs mt-4">{hintText}</p>
          </div>
        )}
      </div>
    </div>
  )
}