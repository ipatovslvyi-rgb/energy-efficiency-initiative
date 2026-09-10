import { useRef, useState, useCallback, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { GrainOverlay } from "@/components/grain-overlay"
import Icon from "@/components/ui/icon"
import jsPDF from "jspdf"
import { ImageCropper } from "@/components/image-cropper"
import ColorPicker from "@/components/color-picker"
import AlignControls from "@/components/align-controls"

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

type TextAlign = "left" | "center" | "right"

interface TextStyleState {
  font: string
  header: number     // СОГЛАСОВАНО / УТВЕРЖДАЮ
  titleMain: number  // Маршрутная карта (первая строка)
  titleSub: number   // остальные строки заголовка
  table: number      // таблица маршрутов
  sign: number       // блок подписи «Разработал»
  titleAlign: TextAlign   // выравнивание заголовка
  titleBold: boolean[]    // жирность каждой строки заголовка
  agreeAlign: TextAlign   // выравнивание блока СОГЛАСОВАНО
  approveAlign: TextAlign // выравнивание блока УТВЕРЖДАЮ
  agreeBold: boolean      // жирность слова СОГЛАСОВАНО
  approveBold: boolean    // жирность слова УТВЕРЖДАЮ
}

const DEFAULT_TEXT_STYLE: TextStyleState = {
  font: "Times New Roman",
  header: 10,
  titleMain: 12,
  titleSub: 11,
  table: 10,
  sign: 10,
  titleAlign: "center",
  titleBold: [true, false, false, false, false],
  agreeAlign: "left",
  approveAlign: "right",
  agreeBold: true,
  approveBold: true,
}

// Шрифты, доступные для документа
const DOC_FONTS = [
  { value: "Times New Roman", label: "Times New Roman", css: '"Times New Roman", Times, serif' },
  { value: "Arial", label: "Arial", css: 'Arial, Helvetica, sans-serif' },
  { value: "Calibri", label: "Calibri", css: 'Calibri, Candara, sans-serif' },
  { value: "Georgia", label: "Georgia", css: 'Georgia, serif' },
  { value: "Verdana", label: "Verdana", css: 'Verdana, Geneva, sans-serif' },
  { value: "Courier New", label: "Courier New", css: '"Courier New", Courier, monospace' },
] as const

const fontCss = (name: string) =>
  DOC_FONTS.find(f => f.value === name)?.css ?? '"Times New Roman", Times, serif'

type DrawTool = "pen" | "eraser" | "pan"
type ActiveTab = "editor" | "preview"
type Orientation = "portrait" | "landscape"

// ── А3 размеры в мм ───────────────────────────────────────────────────────────
const A3_SHORT = 297
const A3_LONG  = 420
// Поля: лево 30мм, верх 20мм, право 10мм, низ 20мм
const MARGIN = { left: 30, top: 20, right: 10, bottom: 20 }

// Пикселей на мм при 96dpi
const PX_PER_MM = 96 / 25.4  // ~3.78

// Форматы бумаги для печати (мм)
const PAPER = {
  a3: { short: 297,  long: 420,  label: "А3" },
  a2: { short: 420,  long: 594,  label: "А2" },
  a1: { short: 594,  long: 841,  label: "А1" },
  a0: { short: 841,  long: 1189, label: "А0" },
} as const
type PaperSize = keyof typeof PAPER

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
  // Формат печати и разрешение экспорта
  const [paperSize, setPaperSize] = useState<PaperSize>("a3")
  const [exportDpi, setExportDpi] = useState(300)

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

  // Настройки оформления текстовых блоков документа
  const [textStyle, setTextStyle] = useState<TextStyleState>(DEFAULT_TEXT_STYLE)
  const setTS = (k: keyof TextStyleState, v: string | number | boolean | boolean[]) =>
    setTextStyle(s => ({ ...s, [k]: v }))

  // Жирность конкретной строки заголовка
  const isBold = (i: number) => textStyle.titleBold?.[i] ?? (i === 0)
  const toggleBold = (i: number) =>
    setTextStyle(s => {
      const arr = titleLines.map((_, j) => s.titleBold?.[j] ?? (j === 0))
      arr[i] = !arr[i]
      return { ...s, titleBold: arr }
    })
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
  // История штрихов для отмены / возврата
  const undoStack = useRef<string[]>([])
  const redoStack = useRef<string[]>([])
  const [historyTick, setHistoryTick] = useState(0)

  // Положение мыши для кружка-курсора
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)
  const [cursorVisible, setCursorVisible] = useState(false)

  const imgContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Загрузка PDF и обрезка изображения
  const [pdfLoading, setPdfLoading] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [pdfThumbs, setPdfThumbs] = useState<string[]>([])
  const [pdfPickerOpen, setPdfPickerOpen] = useState(false)

  // Документ: имя файла и признак несохранённых изменений
  const [docName, setDocName] = useState("Маршрутная_карта")
  const [dirty, setDirty] = useState(false)
  const docInputRef = useRef<HTMLInputElement>(null)
  const pdfDocRef = useRef<{ numPages: number; getPage: (n: number) => Promise<any> } | null>(null)

  // Ref предпросмотра А3 для экспорта
  const previewRef = useRef<HTMLDivElement>(null)

  // Применение нового изображения (общая логика)
  const applyImage = useCallback((dataUrl: string) => {
    const img = new Image()
    img.onload = () => {
      setCanvasNaturalW(img.naturalWidth)
      setCanvasNaturalH(img.naturalHeight)
      setImageDataUrl(dataUrl)
      setCanvasSnapshot(null)
      undoStack.current = []
      redoStack.current = []
      setHistoryTick(t => t + 1)
      setTimeout(() => {
        const cv = canvasRef.current; if (!cv) return
        cv.width = img.naturalWidth
        cv.height = img.naturalHeight
        cv.getContext("2d")?.clearRect(0, 0, cv.width, cv.height)
      }, 80)
    }
    img.src = dataUrl
  }, [])

  // Рендер конкретной страницы открытого PDF в изображение
  const renderPdfPage = useCallback(async (pageNum: number, scale?: number): Promise<string> => {
    const pdf = pdfDocRef.current
    if (!pdf) return ""
    const page = await pdf.getPage(pageNum)
    let s = scale
    if (s === undefined) {
      // Автоподбор: целимся в ~4500px по длинной стороне (хватает на А0 при 300dpi)
      const base = page.getViewport({ scale: 1 })
      const longSide = Math.max(base.width, base.height)
      s = Math.min(8, Math.max(2.5, 4500 / longSide))
    }
    const viewport = page.getViewport({ scale: s })
    const cv = document.createElement("canvas")
    cv.width = viewport.width
    cv.height = viewport.height
    const ctx = cv.getContext("2d")!
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, cv.width, cv.height)
    await page.render({ canvasContext: ctx, viewport }).promise
    return cv.toDataURL("image/png")
  }, [])

  // Загрузка изображения или PDF — сохраняем как dataURL
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      setPdfLoading(true)
      try {
        const pdfjs = await import("pdfjs-dist")
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()
        const buf = await file.arrayBuffer()
        const pdf = await pdfjs.getDocument({ data: buf }).promise
        pdfDocRef.current = pdf

        if (pdf.numPages === 1) {
          applyImage(await renderPdfPage(1))
        } else {
          // Готовим превью всех страниц для выбора
          const thumbs: string[] = []
          for (let i = 1; i <= pdf.numPages; i++) {
            thumbs.push(await renderPdfPage(i, 0.5))
          }
          setPdfThumbs(thumbs)
          setPdfPickerOpen(true)
        }
      } catch {
        alert("Не удалось прочитать PDF. Попробуйте другой файл или загрузите изображение.")
      } finally {
        setPdfLoading(false)
      }
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => applyImage(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  // Выбор страницы из многостраничного PDF
  const choosePdfPage = async (pageNum: number) => {
    setPdfLoading(true)
    try {
      applyImage(await renderPdfPage(pageNum))
      setPdfPickerOpen(false)
      setPdfThumbs([])
    } finally {
      setPdfLoading(false)
    }
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
    // Запоминаем состояние ДО штриха — для отмены
    undoStack.current.push(cv.toDataURL("image/png"))
    if (undoStack.current.length > 40) undoStack.current.shift()
    redoStack.current = []
    setHistoryTick(t => t + 1)
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
    undoStack.current.push(cv.toDataURL("image/png"))
    redoStack.current = []
    setHistoryTick(t => t + 1)
    cv.getContext("2d")?.clearRect(0, 0, cv.width, cv.height)
    setCanvasSnapshot(null)
  }

  // Восстановить canvas из снимка
  const restoreCanvas = (dataUrl: string | null) => {
    const cv = canvasRef.current; if (!cv) return
    const ctx = cv.getContext("2d"); if (!ctx) return
    ctx.clearRect(0, 0, cv.width, cv.height)
    if (!dataUrl) { setCanvasSnapshot(null); return }
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0)
      setCanvasSnapshot(cv.toDataURL("image/png"))
    }
    img.src = dataUrl
  }

  const undoStroke = () => {
    const cv = canvasRef.current; if (!cv) return
    const prev = undoStack.current.pop()
    if (prev === undefined) return
    redoStack.current.push(cv.toDataURL("image/png"))
    setHistoryTick(t => t + 1)
    restoreCanvas(prev)
  }

  const redoStroke = () => {
    const cv = canvasRef.current; if (!cv) return
    const next = redoStack.current.pop()
    if (next === undefined) return
    undoStack.current.push(cv.toDataURL("image/png"))
    setHistoryTick(t => t + 1)
    restoreCanvas(next)
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
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = "high"
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

  // ── Рендер документа напрямую через Canvas API (без html2canvas) ─────────────
  // targetMM — реальный размер печати по длинной стороне (420 = А3, 1189 = А0)
  const renderDocumentCanvas = useCallback(async (targetLongMM = A3_LONG, dpi = 300): Promise<HTMLCanvasElement> => {
    // Сколько пикселей нужно на длинную сторону при заданном DPI
    const neededLongPx = (targetLongMM / 25.4) * dpi
    const baseLongPx = Math.max(A3_W_PX, A3_H_PX)
    let SCALE = neededLongPx / baseLongPx

    // Ограничения браузера: сторона ≤ 16384px, всего ≤ ~250 млн пикселей
    const maxSide = 16384
    SCALE = Math.min(SCALE, maxSide / Math.max(A3_W_PX, A3_H_PX))
    const maxPixels = 250_000_000
    if (A3_W_PX * A3_H_PX * SCALE * SCALE > maxPixels) {
      SCALE = Math.sqrt(maxPixels / (A3_W_PX * A3_H_PX))
    }

    const W = Math.round(A3_W_PX * SCALE)
    const H = Math.round(A3_H_PX * SCALE)
    const s = SCALE

    const ML = CONTENT_L * s
    const MT = CONTENT_T * s
    const MR = CONTENT_R * s
    const MB = CONTENT_B * s
    const innerW = W - ML - MR

    const cv = document.createElement("canvas")
    cv.width = W
    cv.height = H
    const ctx = cv.getContext("2d", { alpha: false })!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = "high"

    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, W, H)

    let curY = MT
    const fontSize = (n: number) => n * s
    const FF = fontCss(textStyle.font)

    // ── СОГЛАСОВАНО / УТВЕРЖДАЮ ──
    const hFs = textStyle.header
    const lh = hFs * 1.45 * s  // высота строки зависит от кегля
    const headerH = lh * 7
    const sigW = innerW * 0.15 // длина линии для живой подписи
    const gap = 6 * s
    const sigY = curY + 3.9 * lh   // линия подписи
    const nameY = curY + 3.35 * lh // ФИО на уровне линии
    const dateY = curY + 5.0 * lh  // дата под подписью

    ctx.textBaseline = "top"
    ctx.fillStyle = "#000"

    const colW = innerW * 0.45              // ширина колонки шапки
    const aAlign = textStyle.agreeAlign ?? "left"
    const pAlign = textStyle.approveAlign ?? "right"

    // Рисуем один блок шапки с произвольным выравниванием внутри своей колонки
    const drawHeaderBlock = (
      x0: number, w: number, align: TextAlign, bold: boolean,
      caption: string, b: ApprovalBlock
    ) => {
      // Опорная точка текста внутри колонки
      const ax = align === "left" ? x0 : align === "right" ? x0 + w : x0 + w / 2
      ctx.textAlign = align

      ctx.font = `${bold ? "bold " : ""}${fontSize(hFs)}px ${FF}`
      ctx.fillText(caption, ax, curY)
      ctx.font = `${fontSize(hFs)}px ${FF}`
      ctx.fillText(b.role, ax, curY + lh)
      ctx.fillText(b.org, ax, curY + 2 * lh)
      ctx.fillText(b.date, ax, dateY)

      // Линия подписи + ФИО: линия слева, фамилия справа от неё
      const nw = ctx.measureText(b.name).width
      const groupW = sigW + gap + nw
      const gx = align === "left" ? x0 : align === "right" ? x0 + w - groupW : x0 + (w - groupW) / 2

      ctx.strokeStyle = "#555"; ctx.lineWidth = 0.5 * s
      ctx.beginPath(); ctx.moveTo(gx, sigY); ctx.lineTo(gx + sigW, sigY); ctx.stroke()

      ctx.textAlign = "left"
      ctx.fillText(b.name, gx + sigW + gap, nameY)
    }

    drawHeaderBlock(ML, colW, aAlign, textStyle.agreeBold ?? true, "СОГЛАСОВАНО", agree)
    drawHeaderBlock(ML + innerW - colW, colW, pAlign, textStyle.approveBold ?? true, "УТВЕРЖДАЮ", approve)

    ctx.textAlign = "left"
    curY += headerH

    // ── ЗАГОЛОВОК ──
    const titleLh = Math.max(textStyle.titleMain, textStyle.titleSub) * 1.25 * s
    const tAlign = textStyle.titleAlign ?? "center"
    const tX = tAlign === "left" ? ML : tAlign === "right" ? ML + innerW : ML + innerW / 2
    titleLines.forEach((line, i) => {
      if (!line) return
      const bold = (textStyle.titleBold?.[i] ?? (i === 0)) ? "bold " : ""
      const fs = i === 0 ? textStyle.titleMain : textStyle.titleSub
      ctx.font = `${bold}${fontSize(fs)}px ${FF}`
      ctx.fillStyle = "#000"; ctx.textAlign = tAlign
      ctx.fillText(line, tX, curY + i * titleLh)
    })
    ctx.textAlign = "left"
    curY += titleLines.length * titleLh + 8 * s

    // ── КАРТИНКА ──
    const tableRowH = textStyle.table * 1.5 * s
    const tableH = (3 + rows.length) * tableRowH + 6 * s
    const signH = textStyle.sign * 2.8 * s
    const imgAreaH = H - curY - MB - tableH - signH - 8 * s

    ctx.strokeStyle = "#999"; ctx.lineWidth = 1 * s
    ctx.strokeRect(ML, curY, innerW, imgAreaH)

    if (compositeUrl && compositeNatW > 0) {
      const natImg = new Image()
      await new Promise<void>(res => { natImg.onload = () => res(); natImg.src = compositeUrl })
      const ir = compositeNatW / compositeNatH
      const br = innerW / imgAreaH
      let dw: number, dh: number, dx: number, dy: number
      if (ir > br) { dw = innerW; dh = innerW / ir; dx = 0; dy = (imgAreaH - dh) / 2 }
      else { dh = imgAreaH; dw = imgAreaH * ir; dx = (innerW - dw) / 2; dy = 0 }
      ctx.drawImage(natImg, ML + dx, curY + dy, dw, dh)
    } else {
      ctx.fillStyle = "#aaa"; ctx.font = `${fontSize(11)}px ${FF}`; ctx.textAlign = "center"
      ctx.fillText("Карта не загружена", ML + innerW / 2, curY + imgAreaH / 2)
      ctx.textAlign = "left"
    }
    curY += imgAreaH + 6 * s

    // ── ТАБЛИЦА ──
    const tableW = innerW * 0.62
    const tableX = ML + (innerW - tableW) / 2
    const cols = [tableW * 0.07, tableW * 0.12, tableW * 0.46, tableW * 0.35]
    const colX = [tableX, tableX + cols[0], tableX + cols[0] + cols[1], tableX + cols[0] + cols[1] + cols[2]]
    ctx.strokeStyle = "#000"; ctx.lineWidth = 0.5 * s
    ctx.font = `${fontSize(textStyle.table)}px ${FF}`; ctx.fillStyle = "#000"

    const drawCell = (x: number, y: number, w: number, h: number, text: string, align: "left"|"center"|"right" = "center") => {
      ctx.strokeRect(x, y, w, h); ctx.textAlign = align
      const tx = align === "center" ? x + w / 2 : align === "right" ? x + w - 3 * s : x + 3 * s
      ctx.fillText(text, tx, y + h / 2 - textStyle.table * 0.55 * s, w - 4 * s); ctx.textAlign = "left"
    }

    drawCell(tableX, curY, tableW, tableRowH, "Маршрут профилактического обследования"); curY += tableRowH
    drawCell(colX[0], curY, cols[0], tableRowH, "№")
    drawCell(colX[1], curY, cols[1], tableRowH, "Цвет")
    drawCell(colX[2], curY, cols[2], tableRowH, "Протяжённость маршрута (км.)")
    drawCell(colX[3], curY, cols[3], tableRowH, "Время обследования (ч.)"); curY += tableRowH

    rows.forEach((row, idx) => {
      drawCell(colX[0], curY, cols[0], tableRowH, String(idx + 1))
      ctx.strokeRect(colX[1], curY, cols[1], tableRowH)
      const sw = 28 * s, sh = 8 * s, sx = colX[1] + (cols[1] - sw) / 2, sy = curY + (tableRowH - sh) / 2
      ctx.fillStyle = row.color; ctx.fillRect(sx, sy, sw, sh)
      ctx.strokeStyle = "#bbb"; ctx.lineWidth = 0.5 * s; ctx.strokeRect(sx, sy, sw, sh)
      ctx.strokeStyle = "#000"; ctx.fillStyle = "#000"
      drawCell(colX[2], curY, cols[2], tableRowH, row.length)
      drawCell(colX[3], curY, cols[3], tableRowH, row.time); curY += tableRowH
    })
    curY += 4 * s

    // ── РАЗРАБОТАЛ ──
    // Текст пишем НАД линией с отступом, чтобы подчёркивание не резало буквы
    const sFs = textStyle.sign
    ctx.font = `${fontSize(sFs)}px ${FF}`; ctx.fillStyle = "#000"
    ctx.textBaseline = "alphabetic"
    const c1w = innerW * 0.35, c2w = innerW * 0.20
    const lineY = curY + sFs * 1.6 * s     // уровень линий
    const textY = lineY - sFs * 0.35 * s   // базовая линия текста выше линии

    ctx.fillText(devRole, ML, textY)
    ctx.fillText(devName, ML + c1w + c2w + 4 * s, textY)

    ctx.strokeStyle = "#555"; ctx.lineWidth = 0.5 * s
    const line = (x1: number, x2: number) => {
      ctx.beginPath(); ctx.moveTo(x1, lineY); ctx.lineTo(x2, lineY); ctx.stroke()
    }
    line(ML, ML + c1w * 0.85)
    line(ML + c1w, ML + c1w + c2w)
    line(ML + c1w + c2w, ML + innerW)
    ctx.textBaseline = "top"

    return cv
  }, [
    A3_W_PX, A3_H_PX, CONTENT_L, CONTENT_T, CONTENT_R, CONTENT_B,
    agree, approve, titleLines, compositeUrl, compositeNatW, compositeNatH,
    rows, devRole, devName, textStyle,
  ])

  // Помечаем документ изменённым при правках
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    setDirty(true)
  }, [agree, approve, titleLines, rows, devRole, devName, textStyle, imageDataUrl, canvasSnapshot, orientation])

  // Предупреждение о несохранённых изменениях
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  // ── Сохранение / открытие документа в формате .rmap ──────────────────────────
  const buildDocument = useCallback(() => ({
    format: "route-map",
    version: 1,
    savedAt: new Date().toISOString(),
    orientation,
    paperSize,
    exportDpi,
    agree,
    approve,
    titleLines,
    rows,
    devRole,
    devName,
    textStyle,
    imageDataUrl,
    canvasSnapshot,
    canvasNaturalW,
    canvasNaturalH,
  }), [orientation, paperSize, exportDpi, agree, approve, titleLines, rows, devRole, devName, textStyle, imageDataUrl, canvasSnapshot, canvasNaturalW, canvasNaturalH])

  const writeFile = (name: string) => {
    const blob = new Blob([JSON.stringify(buildDocument())], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.download = name.endsWith(".rmap") ? name : `${name}.rmap`
    link.href = url
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setDocName(link.download.replace(/\.rmap$/, ""))
    setDirty(false)
  }

  const saveDocument = () => writeFile(docName || "Маршрутная_карта")

  const saveDocumentAs = () => {
    const name = prompt("Название документа:", docName || "Маршрутная_карта")
    if (name && name.trim()) writeFile(name.trim())
  }

  const openDocument = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const d = JSON.parse(ev.target?.result as string)
        if (d.format !== "route-map") throw new Error("bad format")
        setOrientation(d.orientation ?? "landscape")
        setPaperSize(d.paperSize ?? "a3")
        setExportDpi(d.exportDpi ?? 300)
        setAgree(d.agree)
        setApprove(d.approve)
        setTitleLines(d.titleLines ?? [])
        setRows(d.rows ?? [])
        setDevRole(d.devRole ?? "")
        setDevName(d.devName ?? "")
        setTextStyle({ ...DEFAULT_TEXT_STYLE, ...(d.textStyle ?? {}) })
        setCanvasNaturalW(d.canvasNaturalW ?? 1200)
        setCanvasNaturalH(d.canvasNaturalH ?? 800)
        setImageDataUrl(d.imageDataUrl ?? null)
        setCanvasSnapshot(d.canvasSnapshot ?? null)
        setDocName(file.name.replace(/\.rmap$/i, ""))
        setDirty(false)
        undoStack.current = []
        redoStack.current = []
        setHistoryTick(t => t + 1)
        setActiveTab("editor")

        // Восстанавливаем рисунок на canvas
        setTimeout(() => {
          const cv = canvasRef.current
          if (!cv) return
          cv.width = d.canvasNaturalW ?? 1200
          cv.height = d.canvasNaturalH ?? 800
          const ctx = cv.getContext("2d")
          ctx?.clearRect(0, 0, cv.width, cv.height)
          if (d.canvasSnapshot) {
            const img = new Image()
            img.onload = () => ctx?.drawImage(img, 0, 0)
            img.src = d.canvasSnapshot
          }
        }, 120)
      } catch {
        alert("Не удалось открыть файл. Выберите документ формата .rmap")
      }
    }
    reader.readAsText(file)
  }

  // Горячие клавиши: Ctrl+S — сохранить, Ctrl+Shift+S — сохранить как, Ctrl+O — открыть
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      const k = e.key.toLowerCase()
      const tag = (e.target as HTMLElement)?.tagName
      if (k === "s") { e.preventDefault(); e.shiftKey ? saveDocumentAs() : saveDocument() }
      if (k === "o") { e.preventDefault(); docInputRef.current?.click() }
      if (tag === "INPUT" || tag === "TEXTAREA") return
      if (k === "z" && !e.shiftKey) { e.preventDefault(); undoStroke() }
      if (k === "y" || (k === "z" && e.shiftKey)) { e.preventDefault(); redoStroke() }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  // ── Экспорт PNG ──────────────────────────────────────────────────────────────
  const exportPNG = async () => {
    setExporting("png")
    try {
      const fmt = PAPER[paperSize]
      const canvas = await renderDocumentCanvas(fmt.long, exportDpi)
      const link = document.createElement("a")
      link.download = `${docName}_${paperSize.toUpperCase()}_${exportDpi}dpi.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
    } finally { setExporting(null) }
  }

  // ── Экспорт PDF в выбранном формате ──────────────────────────────────────────
  const exportPDF = async () => {
    setExporting("pdf")
    try {
      const fmt = PAPER[paperSize]
      const canvas = await renderDocumentCanvas(fmt.long, exportDpi)
      // PNG без потерь — не мылит тонкие линии и мелкий текст, в отличие от JPEG
      const imgData = canvas.toDataURL("image/png")
      const pdfOrientation = orientation === "landscape" ? "landscape" : "portrait"
      const wMM = orientation === "landscape" ? fmt.long : fmt.short
      const hMM = orientation === "landscape" ? fmt.short : fmt.long
      const pdf = new jsPDF({
        orientation: pdfOrientation,
        unit: "mm",
        format: [wMM, hMM],
        compress: true,
      })
      pdf.addImage(imgData, "PNG", 0, 0, wMM, hMM, undefined, "NONE")
      pdf.save(`${docName}_${paperSize.toUpperCase()}.pdf`)
    } finally { setExporting(null) }
  }

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
          <span className="font-sans text-sm font-semibold">
            {docName}{dirty && <span className="text-amber-400" title="Есть несохранённые изменения"> •</span>}
          </span>
          <span className="font-mono text-[10px] text-foreground/40 uppercase tracking-widest">Проф. служба</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Открыть / Сохранить / Сохранить как */}
          <button
            onClick={() => docInputRef.current?.click()}
            title="Открыть документ (.rmap)"
            className="flex items-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-xs text-foreground/60 hover:text-foreground transition-colors"
          >
            <Icon name="FolderOpen" size={13} />
            <span className="hidden md:inline">Открыть</span>
          </button>
          <input ref={docInputRef} type="file" accept=".rmap,application/json" onChange={openDocument} className="hidden" />
          <button
            onClick={saveDocument}
            title="Сохранить документ"
            className="flex items-center gap-1.5 rounded-lg border border-blue-400/40 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-300 hover:bg-blue-500/20 transition-colors"
          >
            <Icon name="Save" size={13} />
            <span className="hidden md:inline">Сохранить</span>
          </button>
          <button
            onClick={saveDocumentAs}
            title="Сохранить как…"
            className="flex items-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-xs text-foreground/60 hover:text-foreground transition-colors"
          >
            <Icon name="FilePlus" size={13} />
            <span className="hidden lg:inline">Сохранить как</span>
          </button>
          <div className="w-px h-5 bg-foreground/15 mx-0.5" />
          {/* Переключатель ориентации */}
          <button
            onClick={() => setOrientation(o => o === "landscape" ? "portrait" : "landscape")}
            title="Переключить ориентацию"
            className="flex items-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-xs text-foreground/60 hover:text-foreground transition-colors"
          >
            <Icon name={orientation === "landscape" ? "RectangleHorizontal" : "RectangleVertical"} size={13} />
            <span className="hidden sm:inline">{orientLabel}</span>
          </button>
          {/* Формат печати */}
          <select
            value={paperSize}
            onChange={e => setPaperSize(e.target.value as PaperSize)}
            title="Формат бумаги для печати"
            className="rounded-lg border border-foreground/20 bg-background px-2 py-1.5 text-xs text-foreground/70 hover:text-foreground transition-colors cursor-pointer"
          >
            {(Object.keys(PAPER) as PaperSize[]).map(k => (
              <option key={k} value={k}>{PAPER[k].label}</option>
            ))}
          </select>
          <select
            value={exportDpi}
            onChange={e => setExportDpi(+e.target.value)}
            title="Разрешение печати"
            className="rounded-lg border border-foreground/20 bg-background px-2 py-1.5 text-xs text-foreground/70 hover:text-foreground transition-colors cursor-pointer"
          >
            <option value={150}>150 dpi</option>
            <option value={200}>200 dpi</option>
            <option value={300}>300 dpi</option>
            <option value={400}>400 dpi</option>
          </select>
          <button
            onClick={exportPNG}
            disabled={!!exporting}
            title="Экспорт в PNG"
            className="flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
          >
            <Icon name="Image" size={13} />
            <span className="hidden sm:inline">{exporting === "png" ? "Сохранение..." : "PNG"}</span>
          </button>
          <button
            onClick={exportPDF}
            disabled={!!exporting}
            title={`Экспорт в PDF ${PAPER[paperSize].label}`}
            className="flex items-center gap-1.5 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
          >
            <Icon name="FileDown" size={13} />
            <span className="hidden sm:inline">{exporting === "pdf" ? "Сохранение..." : `PDF ${PAPER[paperSize].label}`}</span>
          </button>
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
                  <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                    <p className="font-mono text-[10px] text-foreground/40 uppercase tracking-widest">Согласовано</p>
                    <AlignControls
                      value={textStyle.agreeAlign ?? "left"}
                      onChange={v => setTS("agreeAlign", v)}
                      bold={textStyle.agreeBold ?? true}
                      onToggleBold={() => setTS("agreeBold", !(textStyle.agreeBold ?? true))}
                    />
                  </div>
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
                  <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                    <p className="font-mono text-[10px] text-foreground/40 uppercase tracking-widest">Утверждаю</p>
                    <AlignControls
                      value={textStyle.approveAlign ?? "right"}
                      onChange={v => setTS("approveAlign", v)}
                      bold={textStyle.approveBold ?? true}
                      onToggleBold={() => setTS("approveBold", !(textStyle.approveBold ?? true))}
                    />
                  </div>
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
                <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                  <p className="font-mono text-[10px] text-foreground/40 uppercase tracking-widest">Наименование документа</p>
                  <AlignControls
                    value={textStyle.titleAlign ?? "center"}
                    onChange={v => setTS("titleAlign", v)}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  {titleLines.map((line, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <button
                        title={isBold(i) ? "Убрать жирность" : "Сделать жирным"}
                        onClick={() => toggleBold(i)}
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors ${isBold(i) ? "border-primary/70 bg-primary/15 text-foreground" : "border-foreground/20 text-foreground/40 hover:text-foreground"}`}>
                        <Icon name="Bold" size={13} />
                      </button>
                      <input value={line}
                        onChange={e => setTitleLines(l => l.map((x, j) => j === i ? e.target.value : x))}
                        placeholder={`Строка ${i + 1}`}
                        style={{
                          textAlign: textStyle.titleAlign ?? "center",
                          fontWeight: isBold(i) ? 700 : 400,
                        }}
                        className={`flex-1 bg-transparent border-b border-foreground/20 hover:border-foreground/40 focus:border-primary/60 outline-none placeholder:text-foreground/25 transition-colors ${i === 0 ? "text-base text-foreground" : "text-sm text-foreground/80"}`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Оформление текста документа */}
              <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-4 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-mono text-[10px] text-foreground/40 uppercase tracking-widest">Оформление текста</p>
                  <button
                    onClick={() => setTextStyle(DEFAULT_TEXT_STYLE)}
                    className="flex items-center gap-1 rounded-lg border border-foreground/20 bg-foreground/5 px-2.5 py-1 text-xs text-foreground/60 hover:text-foreground transition-colors">
                    <Icon name="RotateCcw" size={12} />По умолчанию
                  </button>
                </div>

                <div className="mb-4">
                  <label className="text-[10px] text-foreground/40 font-mono uppercase tracking-wider">Шрифт документа</label>
                  <select
                    value={textStyle.font}
                    onChange={e => setTS("font", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60 transition-colors cursor-pointer">
                    {DOC_FONTS.map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                  {([
                    { key: "header" as const, label: "Согласовано / Утверждаю" },
                    { key: "titleMain" as const, label: "Маршрутная карта (заголовок)" },
                    { key: "titleSub" as const, label: "Подзаголовки" },
                    { key: "table" as const, label: "Таблица маршрутов" },
                    { key: "sign" as const, label: "Блок подписи" },
                  ]).map(f => (
                    <div key={f.key} className="flex items-center gap-3">
                      <span className="flex-1 text-xs text-foreground/60">{f.label}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setTS(f.key, Math.max(6, textStyle[f.key] - 1))}
                          className="w-6 h-6 rounded border border-foreground/20 text-foreground/60 hover:text-foreground hover:border-foreground/40 transition-colors">−</button>
                        <input
                          type="number" min={6} max={40}
                          value={textStyle[f.key]}
                          onChange={e => setTS(f.key, Math.min(40, Math.max(6, Number(e.target.value) || 6)))}
                          className="w-12 rounded border border-foreground/20 bg-background px-1 py-0.5 text-center text-xs text-foreground outline-none focus:border-primary/60 transition-colors" />
                        <button
                          onClick={() => setTS(f.key, Math.min(40, textStyle[f.key] + 1))}
                          className="w-6 h-6 rounded border border-foreground/20 text-foreground/60 hover:text-foreground hover:border-foreground/40 transition-colors">+</button>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="mt-3 font-mono text-[10px] text-foreground/35">
                  Размер указан в пунктах — как в Word. Изменения сразу видны в предпросмотре.
                </p>
              </div>

              {/* Карта + рисование */}
              <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-4 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-mono text-[10px] text-foreground/40 uppercase tracking-widest">Схема маршрута</p>
                  <div className="flex items-center gap-2">
                    {imageDataUrl && (
                      <button onClick={() => setCropSrc(imageDataUrl)}
                        className="flex items-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-xs text-foreground/70 hover:text-foreground transition-colors">
                        <Icon name="Crop" size={13} />
                        Обрезать
                      </button>
                    )}
                    <button onClick={() => fileInputRef.current?.click()} disabled={pdfLoading}
                      className="flex items-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-1.5 text-xs text-foreground/70 hover:text-foreground transition-colors disabled:opacity-40">
                      <Icon name={pdfLoading ? "Loader" : "ImagePlus"} size={13} />
                      {pdfLoading ? "Обработка PDF…" : imageDataUrl ? "Заменить" : "Загрузить карту / PDF"}
                    </button>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*,application/pdf,.pdf" onChange={handleImageUpload} className="hidden" />
                </div>

                {/* Оценка качества исходной схемы под выбранный формат */}
                {imageDataUrl && (() => {
                  const fmt = PAPER[paperSize]
                  // Ширина области схемы на печати в мм
                  const printW = (orientation === "landscape" ? fmt.long : fmt.short) - MARGIN.left - MARGIN.right
                  const realDpi = Math.round(canvasNaturalW / (printW / 25.4))
                  const ok = realDpi >= 250, mid = realDpi >= 150
                  return (
                    <div className={`mb-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${ok ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300" : mid ? "border-amber-400/30 bg-amber-500/10 text-amber-300" : "border-red-400/30 bg-red-500/10 text-red-300"}`}>
                      <Icon name={ok ? "CircleCheck" : "TriangleAlert"} size={14} className="mt-0.5 shrink-0" />
                      <span>
                        Схема: {canvasNaturalW}×{canvasNaturalH} px — это ≈{realDpi} dpi при печати на {fmt.label}.{" "}
                        {ok
                          ? "Качество отличное."
                          : mid
                            ? "Приемлемо, но для чёткой печати загрузите схему в большем разрешении (лучше исходный PDF)."
                            : `Слишком мало. Для ${fmt.label} нужна схема шириной от ${Math.round((printW / 25.4) * 250)} px — загрузите исходный PDF или скан покрупнее.`}
                      </span>
                    </div>
                  )
                })()}

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
                    <button onClick={undoStroke} disabled={undoStack.current.length === 0} data-h={historyTick}
                      title="Отменить последний штрих (Ctrl+Z)"
                      className="flex items-center gap-1 rounded-lg border border-foreground/20 bg-foreground/5 px-2.5 py-1 text-xs text-foreground/60 hover:text-foreground transition-colors disabled:opacity-30 disabled:hover:text-foreground/60">
                      <Icon name="Undo2" size={12} />Отменить
                    </button>
                    <button onClick={redoStroke} disabled={redoStack.current.length === 0}
                      title="Вернуть отменённое (Ctrl+Y)"
                      className="flex items-center gap-1 rounded-lg border border-foreground/20 bg-foreground/5 px-2.5 py-1 text-xs text-foreground/60 hover:text-foreground transition-colors disabled:opacity-30 disabled:hover:text-foreground/60">
                      <Icon name="Redo2" size={12} />Вернуть
                    </button>
                    <div className="w-px h-5 bg-foreground/15" />
                    <button onClick={() => setDrawTool(t => t === "eraser" ? "pen" : "eraser")}
                      className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition-colors ${drawTool === "eraser" ? "border-orange-400/60 bg-orange-500/15 text-orange-400" : "border-foreground/20 bg-foreground/5 text-foreground/60 hover:text-foreground"}`}>
                      <Icon name="Eraser" size={12} />Ластик
                    </button>
                    <button onClick={() => setDrawTool(t => t === "pan" ? "pen" : "pan")}
                      title="Режим прокрутки — можно листать страницу пальцем, не рисуя"
                      className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition-colors ${drawTool === "pan" ? "border-blue-400/60 bg-blue-500/15 text-blue-300" : "border-foreground/20 bg-foreground/5 text-foreground/60 hover:text-foreground"}`}>
                      <Icon name="Hand" size={12} />Прокрутка
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
                        style={{
                          cursor: drawTool === "pan" ? "grab" : "none",
                          touchAction: drawTool === "pan" ? "auto" : "none",
                          pointerEvents: drawTool === "pan" ? "none" : "auto",
                        }}
                        onMouseDown={startDraw}
                        onMouseMove={handleMouseMove}
                        onMouseUp={stopDraw}
                        onMouseLeave={stopDraw}
                        onTouchStart={e => { if (drawTool === "pan") return; e.preventDefault(); startDraw(e) }}
                        onTouchMove={e => { if (drawTool === "pan") return; e.preventDefault(); draw(e) }}
                        onTouchEnd={stopDraw}
                      />
                      {/* Кружок-курсор */}
                      {cursorVisible && cursorPos && drawTool !== "pan" && (
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
                    <button onClick={() => fileInputRef.current?.click()} disabled={pdfLoading}
                      className="flex flex-col items-center justify-center w-full h-52 gap-3 text-foreground/30 hover:text-foreground/50 transition-colors disabled:opacity-40">
                      <Icon name={pdfLoading ? "Loader" : "Map"} size={44} />
                      <span className="text-sm">{pdfLoading ? "Обработка PDF…" : "Загрузить карту, снимок или PDF"}</span>
                      {!pdfLoading && <span className="text-[11px] text-foreground/25">PNG · JPG · PDF</span>}
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
                            <ColorPicker value={row.color} onChange={c => updateRow(row.id, "color", c)} />
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
                fontFamily: fontCss(textStyle.font),
                fontSize: textStyle.titleSub,
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
              {/* Строка СОГЛАСОВАНО / УТВЕРЖДАЮ */}
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, flexShrink: 0 }}>
                {([
                  { b: agree, caption: "СОГЛАСОВАНО", align: textStyle.agreeAlign ?? "left", bold: textStyle.agreeBold ?? true },
                  { b: approve, caption: "УТВЕРЖДАЮ", align: textStyle.approveAlign ?? "right", bold: textStyle.approveBold ?? true },
                ]).map((blk, k) => (
                  <div key={k} style={{ width: "45%", fontSize: textStyle.header, lineHeight: 1.5, textAlign: blk.align }}>
                    <div style={{ fontWeight: blk.bold ? "bold" : "normal", textTransform: "uppercase", fontSize: textStyle.header }}>{blk.caption}</div>
                    <div>{blk.b.role}</div>
                    <div>{blk.b.org}</div>
                    <div style={{
                      display: "flex", alignItems: "flex-end", gap: 6, marginTop: 8,
                      justifyContent: blk.align === "left" ? "flex-start" : blk.align === "right" ? "flex-end" : "center",
                    }}>
                      <div style={{ borderBottom: "0.5px solid #555", width: 90, height: 12, flexShrink: 0 }} />
                      <div style={{ lineHeight: 1.2, whiteSpace: "nowrap" }}>{blk.b.name}</div>
                    </div>
                    <div style={{ marginTop: 4 }}>{blk.b.date}</div>
                  </div>
                ))}
              </div>

              {/* Заголовок */}
              <div style={{ textAlign: textStyle.titleAlign ?? "center", marginBottom: 6, flexShrink: 0 }}>
                {titleLines.map((line, i) => (
                  <div key={i} style={{
                    fontWeight: isBold(i) ? "bold" : "normal",
                    fontSize: i === 0 ? textStyle.titleMain : textStyle.titleSub,
                    lineHeight: 1.25,
                  }}>{line || "\u00A0"}</div>
                ))}
              </div>

              {/* Картинка — img с contain через явные max размеры, без objectFit */}
              <div style={{ flex: 1, minHeight: 0, border: "1px solid #999", marginBottom: 6, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                {compositeUrl ? (
                  <img
                    src={compositeUrl}
                    alt="Схема маршрута"
                    style={{
                      display: "block",
                      maxWidth: "100%",
                      maxHeight: "100%",
                    }}
                  />
                ) : (
                  <div style={{ color: "#aaa", fontSize: 12 }}>
                    Карта не загружена
                  </div>
                )}
              </div>

              {/* Таблица маршрутов */}
              <div style={{ flexShrink: 0, marginBottom: 6 }}>
                <table style={{ width: "60%", margin: "0 auto", borderCollapse: "collapse", fontSize: textStyle.table }}>
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

              {/* Разработал — текст над линией, подчёркивание не задевает буквы */}
              <div style={{ flexShrink: 0, display: "flex", alignItems: "flex-end", gap: 0, fontSize: textStyle.sign, marginBottom: 8 }}>
                {/* Должность */}
                <div style={{ flex: "0 0 35%", paddingRight: 12 }}>
                  <div style={{ lineHeight: 1.3, minHeight: textStyle.sign * 1.3, paddingBottom: 4, whiteSpace: "nowrap", overflow: "hidden" }}>{devRole}</div>
                  <div style={{ borderTop: "0.5px solid #555", width: "85%" }} />
                </div>
                {/* Подпись (пустая линия) */}
                <div style={{ flex: "0 0 20%", paddingRight: 12 }}>
                  <div style={{ lineHeight: 1.3, minHeight: textStyle.sign * 1.3, paddingBottom: 4 }}>&nbsp;</div>
                  <div style={{ borderTop: "0.5px solid #555" }} />
                </div>
                {/* ФИО */}
                <div style={{ flex: "0 0 45%" }}>
                  <div style={{ lineHeight: 1.3, minHeight: textStyle.sign * 1.3, paddingBottom: 4, paddingLeft: 4, whiteSpace: "nowrap", overflow: "hidden" }}>{devName}</div>
                  <div style={{ borderTop: "0.5px solid #555" }} />
                </div>
              </div>
            </div>

            </div>{/* конец обёртки масштабирования */}

            <p className="text-center text-foreground/30 text-xs mt-4">{hintText}</p>
          </div>
        )}
      </div>

      {/* Выбор страницы PDF */}
      {pdfPickerOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-foreground/15 bg-background p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Icon name="Files" size={18} className="text-foreground/70" />
                <span className="font-sans text-base font-medium text-foreground">
                  Выберите страницу — всего {pdfThumbs.length}
                </span>
              </div>
              <button onClick={() => { setPdfPickerOpen(false); setPdfThumbs([]) }}
                className="text-foreground/40 hover:text-foreground transition-colors">
                <Icon name="X" size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[65vh] overflow-y-auto pr-1">
              {pdfThumbs.map((thumb, i) => (
                <button key={i} onClick={() => choosePdfPage(i + 1)} disabled={pdfLoading}
                  className="group relative rounded-lg border border-foreground/15 bg-white overflow-hidden hover:border-primary/70 transition-colors disabled:opacity-40">
                  <img src={thumb} alt={`Страница ${i + 1}`} className="block w-full h-auto" />
                  <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white">
                    {i + 1}
                  </span>
                  <span className="absolute inset-0 hidden group-hover:flex items-center justify-center bg-primary/20">
                    <span className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background">Выбрать</span>
                  </span>
                </button>
              ))}
            </div>

            <p className="mt-4 font-mono text-[11px] text-foreground/40 text-center">
              Нажмите на нужную страницу — она станет схемой маршрута
            </p>
          </div>
        </div>
      )}

      {cropSrc && (
        <ImageCropper
          src={cropSrc}
          onCancel={() => setCropSrc(null)}
          onApply={(dataUrl) => { applyImage(dataUrl); setCropSrc(null) }}
        />
      )}
    </div>
  )
}