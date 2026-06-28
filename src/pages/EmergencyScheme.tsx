import { useState, useRef, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { GrainOverlay } from "@/components/grain-overlay"
import Icon from "@/components/ui/icon"
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, ImageRun, PageOrientation, convertMillimetersToTwip } from "docx"
import * as XLSX from "xlsx"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"

const ACCIDENT_TYPES = ["Пожар", "Взрыв", "Загазованность", "Обрушение", "Затопление", "Прочее"]
const STORAGE_KEY = "emergency_schemes_v2"

interface LegendItem {
  id: string
  symbol: string
  description: string
  imageUrl?: string
}

interface MarkerPosition {
  legendId: string
  x: number
  y: number
  scale?: number      // 0.5 – 3.0, по умолч. 1.0
  rotation?: number   // градусы 0-359
  instanceId?: string // уникальный id копии (несколько одинаковых УО)
}

interface FormData {
  position: string
  date: string
  time: string
  timezone: string
  objectName: string
  accidentType: string
  accidentDate: string
  accidentTime: string
  accidentLocation: string
  airVolume: string
  sectionArea: string
  phoneCP: string
  co: string
  co2: string
  so2: string
  o2: string
  ch4: string
  nono2: string
  so2_2: string
  temperature: string
  smokeLevel: string
  headRescue: string
  assistantCommander: string
  commanderName: string
}

interface SavedScheme {
  id: string
  createdAt: string
  updatedAt: string
  form: FormData
  legend: LegendItem[]
  imageDataUrl: string | null
  markers?: MarkerPosition[]
}

// SVG-иконки условных обозначений согласно ГОСТ / Приказу Ростехнадзора №520
// Каждая иконка кодируется в data:image/svg+xml;base64 для надёжного рендера без внешних запросов
function svgToDataUrl(svg: string): string {
  return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)))
}

const UO_SVGS: { id: string; description: string; symbol: string; svg: string }[] = [
  {
    id: "otd_na_meste",
    description: "Отделение на месте работ",
    symbol: "5чел",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
      <rect x="4" y="12" width="40" height="24" rx="2" fill="none" stroke="#000" stroke-width="2"/>
      <text x="24" y="28" font-family="Arial" font-size="10" font-weight="bold" text-anchor="middle" fill="#000">5 чел</text>
    </svg>`,
  },
  {
    id: "otd_v_dvizhenii",
    description: "Отделение в движении",
    symbol: "5чел→",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="48" viewBox="0 0 56 48">
      <rect x="4" y="12" width="40" height="24" rx="2" fill="none" stroke="#000" stroke-width="2"/>
      <text x="24" y="28" font-family="Arial" font-size="10" font-weight="bold" text-anchor="middle" fill="#000">5 чел</text>
      <line x1="44" y1="24" x2="54" y2="24" stroke="#000" stroke-width="2"/>
      <polygon points="50,20 54,24 50,28" fill="#000"/>
    </svg>`,
  },
  {
    id: "pb",
    description: "Подземная горноспасательная база (ПБ)",
    symbol: "ПБ",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
      <rect x="4" y="10" width="40" height="28" rx="2" fill="none" stroke="#000" stroke-width="2.5"/>
      <text x="24" y="30" font-family="Arial" font-size="14" font-weight="bold" text-anchor="middle" fill="#000">ПБ</text>
    </svg>`,
  },
  {
    id: "nb",
    description: "Наземная база (НБ)",
    symbol: "НБ",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
      <rect x="4" y="10" width="40" height="28" rx="2" fill="none" stroke="#000" stroke-width="2.5"/>
      <text x="24" y="30" font-family="Arial" font-size="14" font-weight="bold" text-anchor="middle" fill="#000">НБ</text>
    </svg>`,
  },
  {
    id: "post_bezop",
    description: "Пост безопасности",
    symbol: "⚑○",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
      <circle cx="24" cy="30" r="10" fill="none" stroke="#000" stroke-width="2"/>
      <line x1="24" y1="4" x2="24" y2="20" stroke="#000" stroke-width="2"/>
      <polygon points="24,4 36,10 24,16" fill="#000"/>
    </svg>`,
  },
  {
    id: "otbor_prob",
    description: "Место отбора проб",
    symbol: "△4",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
      <polygon points="24,6 44,42 4,42" fill="none" stroke="#000" stroke-width="2"/>
      <text x="24" y="38" font-family="Arial" font-size="12" font-weight="bold" text-anchor="middle" fill="#000">4</text>
    </svg>`,
  },
  {
    id: "pozhar",
    description: "Очаг пожара",
    symbol: "☀",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="9" fill="none" stroke="#cc0000" stroke-width="2"/>
      <line x1="24" y1="4" x2="24" y2="12" stroke="#cc0000" stroke-width="2"/>
      <line x1="24" y1="36" x2="24" y2="44" stroke="#cc0000" stroke-width="2"/>
      <line x1="4" y1="24" x2="12" y2="24" stroke="#cc0000" stroke-width="2"/>
      <line x1="36" y1="24" x2="44" y2="24" stroke="#cc0000" stroke-width="2"/>
      <line x1="9" y1="9" x2="15" y2="15" stroke="#cc0000" stroke-width="2"/>
      <line x1="33" y1="33" x2="39" y2="39" stroke="#cc0000" stroke-width="2"/>
      <line x1="39" y1="9" x2="33" y2="15" stroke="#cc0000" stroke-width="2"/>
      <line x1="9" y1="39" x2="15" y2="33" stroke="#cc0000" stroke-width="2"/>
    </svg>`,
  },
  {
    id: "rasprostranenie_pozh",
    description: "Распространение пожара",
    symbol: "☀***",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="48" viewBox="0 0 64 48">
      <circle cx="14" cy="24" r="8" fill="none" stroke="#cc0000" stroke-width="2"/>
      <line x1="14" y1="6" x2="14" y2="13" stroke="#cc0000" stroke-width="1.5"/>
      <line x1="14" y1="35" x2="14" y2="42" stroke="#cc0000" stroke-width="1.5"/>
      <line x1="2" y1="24" x2="7" y2="24" stroke="#cc0000" stroke-width="1.5"/>
      <line x1="21" y1="24" x2="26" y2="24" stroke="#cc0000" stroke-width="1.5"/>
      <line x1="5" y1="10" x2="10" y2="15" stroke="#cc0000" stroke-width="1.5"/>
      <line x1="18" y1="18" x2="23" y2="13" stroke="#cc0000" stroke-width="1.5"/>
      <circle cx="36" cy="24" r="3" fill="#cc0000"/>
      <circle cx="46" cy="24" r="3" fill="#cc0000"/>
      <circle cx="56" cy="24" r="3" fill="#cc0000"/>
    </svg>`,
  },
  {
    id: "vzryv_mesto",
    description: "Место взрыва",
    symbol: "⊕↕",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="10" fill="none" stroke="#000" stroke-width="2"/>
      <line x1="24" y1="4" x2="24" y2="14" stroke="#000" stroke-width="2" marker-end="url(#arr)"/>
      <line x1="24" y1="44" x2="24" y2="34" stroke="#000" stroke-width="2" marker-end="url(#arr)"/>
      <line x1="4" y1="24" x2="14" y2="24" stroke="#000" stroke-width="2" marker-end="url(#arr)"/>
      <line x1="44" y1="24" x2="34" y2="24" stroke="#000" stroke-width="2" marker-end="url(#arr)"/>
      <defs>
        <marker id="arr" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="#000"/>
        </marker>
      </defs>
    </svg>`,
  },
  {
    id: "narus_krep",
    description: "Горная выработка с нарушенной крепью",
    symbol: "∧∧∧",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32" viewBox="0 0 64 32">
      <polyline points="2,28 12,6 22,28 32,6 42,28 52,6 62,28" fill="none" stroke="#000" stroke-width="2.5" stroke-linejoin="miter"/>
    </svg>`,
  },
  {
    id: "zona_obrus",
    description: "Зона обрушения горных пород",
    symbol: "⬭░",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="40" viewBox="0 0 64 40">
      <ellipse cx="32" cy="22" rx="26" ry="12" fill="none" stroke="#000" stroke-width="2" stroke-dasharray="4,3"/>
      <line x1="8" y1="32" x2="56" y2="32" stroke="#000" stroke-width="2"/>
      <line x1="4" y1="36" x2="60" y2="36" stroke="#000" stroke-width="1" stroke-dasharray="2,2"/>
      <text x="32" y="26" font-family="Arial" font-size="8" text-anchor="middle" fill="#555">· · · · ·</text>
    </svg>`,
  },
  {
    id: "proryv_vody",
    description: "Прорыв воды, рассола",
    symbol: "~↗",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
      <path d="M8,36 C10,28 14,24 18,20 C22,16 24,10 28,8" fill="none" stroke="#0055cc" stroke-width="2.5"/>
      <path d="M16,40 C18,32 22,28 26,24 C30,20 32,14 36,10" fill="none" stroke="#0055cc" stroke-width="2.5"/>
      <polygon points="28,8 36,6 32,14" fill="#0055cc"/>
      <polygon points="36,10 44,8 40,16" fill="#0055cc"/>
    </svg>`,
  },
  {
    id: "proryv_ilovoj",
    description: "Прорыв заиловочной массы и плывунов",
    symbol: "~↘",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
      <path d="M8,10 C12,16 14,22 18,26 C22,30 24,36 28,40" fill="none" stroke="#8B4513" stroke-width="2.5"/>
      <path d="M18,8 C22,14 24,20 28,24 C32,28 34,34 38,38" fill="none" stroke="#8B4513" stroke-width="2.5"/>
      <polygon points="28,40 36,42 30,34" fill="#8B4513"/>
      <polygon points="38,38 46,40 40,32" fill="#8B4513"/>
    </svg>`,
  },
  {
    id: "vybros_gu",
    description: "Место выброса (В) или горного удара (У)",
    symbol: "В/У",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
      <circle cx="24" cy="18" r="10" fill="none" stroke="#000" stroke-width="2"/>
      <text x="24" y="23" font-family="Arial" font-size="11" font-weight="bold" text-anchor="middle" fill="#000">В</text>
      <line x1="14" y1="28" x2="34" y2="28" stroke="#000" stroke-width="2"/>
      <line x1="24" y1="28" x2="24" y2="44" stroke="#000" stroke-width="2"/>
      <polygon points="20,40 24,44 28,40" fill="#000"/>
    </svg>`,
  },
  {
    id: "postr_s_zhizn",
    description: "Место обнаружения пострадавшего с признаками жизни",
    symbol: "○",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="14" fill="none" stroke="#000" stroke-width="2.5"/>
    </svg>`,
  },
  {
    id: "postr_bez_zhizni",
    description: "Место обнаружения пострадавшего без признаков жизни",
    symbol: "⊗",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="14" fill="none" stroke="#000" stroke-width="2.5"/>
      <line x1="14" y1="14" x2="34" y2="34" stroke="#000" stroke-width="2"/>
      <line x1="34" y1="14" x2="14" y2="34" stroke="#000" stroke-width="2"/>
    </svg>`,
  },
]

// Конвертируем SVG в data URL при инициализации (один раз)
const LEGEND_IMAGES: { url: string; description: string; symbol: string; svgDataUrl: string }[] =
  UO_SVGS.map(item => ({
    url: svgToDataUrl(item.svg),
    description: item.description,
    symbol: item.symbol,
    svgDataUrl: svgToDataUrl(item.svg),
  }))

const DEFAULT_LEGEND: LegendItem[] = []

function makeDefaultForm(): FormData {
  return {
    position: "",
    date: new Date().toLocaleDateString("ru-RU"),
    time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
    timezone: "мск",
    objectName: "",
    accidentType: "Пожар",
    accidentDate: new Date().toLocaleDateString("ru-RU"),
    accidentTime: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
    accidentLocation: "",
    airVolume: "",
    sectionArea: "",
    phoneCP: "",
    co: "",
    co2: "",
    so2: "",
    o2: "",
    ch4: "",
    nono2: "",
    so2_2: "",
    temperature: "",
    smokeLevel: "",
    headRescue: "",
    assistantCommander: "",
    commanderName: "",
  }
}

function loadSchemes(): SavedScheme[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")
  } catch {
    return []
  }
}

function saveSchemes(schemes: SavedScheme[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(schemes))
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function Field({ label, value, onChange, placeholder = "", wide = false }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; wide?: boolean
}) {
  return (
    <div className={`flex flex-col gap-1 ${wide ? "col-span-2" : ""}`}>
      <label className="text-xs text-foreground/50 font-mono uppercase tracking-wider">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="bg-foreground/5 border border-foreground/15 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary/60 transition-colors" />
    </div>
  )
}

function GasField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-mono text-foreground/70 w-20 shrink-0">{label}</span>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder="0,00%"
        className="w-full bg-foreground/5 border border-foreground/15 rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary/60 transition-colors" />
    </div>
  )
}

export default function EmergencyScheme() {
  const navigate = useNavigate()
  const [schemes, setSchemes] = useState<SavedScheme[]>(loadSchemes)
  const [activeId, setActiveId] = useState<string | null>(() => loadSchemes()[0]?.id ?? null)
  const [form, setForm] = useState<FormData>(() => loadSchemes()[0]?.form ?? makeDefaultForm())
  const [legend, setLegend] = useState<LegendItem[]>(() => loadSchemes()[0]?.legend ?? DEFAULT_LEGEND)
  const [imageUrl, setImageUrl] = useState<string | null>(() => loadSchemes()[0]?.imageDataUrl ?? null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [activeTab, setActiveTab] = useState<"form" | "preview">("form")
  const [pendingPdfExport, setPendingPdfExport] = useState(false)
  const [pendingPngExport, setPendingPngExport] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [markers, setMarkers] = useState<MarkerPosition[]>(() => loadSchemes()[0]?.markers ?? [])
  const [draggingMarker, setDraggingMarker] = useState<{ instanceId: string; offsetX: number; offsetY: number } | null>(null)
  const [placingLegendId, setPlacingLegendId] = useState<string | null>(null)
  const [editingMarkers, setEditingMarkers] = useState(false)
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)
  const imageContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)

  const set = (field: keyof FormData) => (v: string) => setForm(f => ({ ...f, [field]: v }))

  // Запуск PDF после реального рендера превью + загрузки всех картинок
  useEffect(() => {
    if (!pendingPdfExport || activeTab !== "preview") return
    const el = previewRef.current
    if (!el) return

    const allImgs = Array.from(el.querySelectorAll<HTMLImageElement>("img"))
    const pending = allImgs.filter(img => !img.complete || img.naturalWidth === 0)
    if (pending.length > 0) {
      Promise.all(pending.map(img => new Promise(res => { img.onload = res; img.onerror = res }))).then(() => {
        setPendingPdfExport(false)
        exportToPdf()
      })
    } else {
      setPendingPdfExport(false)
      exportToPdf()
    }
  }, [pendingPdfExport, activeTab])

  // Запуск PNG после рендера превью
  useEffect(() => {
    if (!pendingPngExport || activeTab !== "preview") return
    const el = previewRef.current
    if (!el) return
    const allImgs = Array.from(el.querySelectorAll<HTMLImageElement>("img"))
    const pending = allImgs.filter(img => !img.complete || img.naturalWidth === 0)
    if (pending.length > 0) {
      Promise.all(pending.map(img => new Promise(res => { img.onload = res; img.onerror = res }))).then(() => {
        setPendingPngExport(false)
        exportToPng()
      })
    } else {
      setPendingPngExport(false)
      exportToPng()
    }
  }, [pendingPngExport, activeTab])

  // Автосохранение при изменении формы
  useEffect(() => {
    if (!activeId) return
    const updated = schemes.map(s =>
      s.id === activeId
        ? { ...s, form, legend, imageDataUrl: imageUrl, markers, updatedAt: new Date().toISOString() }
        : s
    )
    setSchemes(updated)
    saveSchemes(updated)
  }, [form, legend, imageUrl, markers])

  const createNew = () => {
    const id = Date.now().toString()
    const now = new Date().toISOString()
    const newScheme: SavedScheme = {
      id,
      createdAt: now,
      updatedAt: now,
      form: makeDefaultForm(),
      legend: DEFAULT_LEGEND,
      imageDataUrl: null,
    }
    const updated = [newScheme, ...schemes]
    setSchemes(updated)
    saveSchemes(updated)
    switchTo(newScheme)
  }

  const switchTo = (scheme: SavedScheme) => {
    setActiveId(scheme.id)
    setForm(scheme.form)
    setLegend(scheme.legend)
    setImageUrl(scheme.imageDataUrl)
    setMarkers(scheme.markers ?? [])
    setImageFile(null)
    setActiveTab("form")
  }

  const duplicateScheme = (s: SavedScheme) => {
    const id = Date.now().toString()
    const now = new Date().toISOString()
    const newPos = s.form.position ? String(Number(s.form.position) + 1 || s.form.position + "_копия") : ""
    const duplicate: SavedScheme = {
      id,
      createdAt: now,
      updatedAt: now,
      form: {
        ...s.form,
        position: newPos,
        date: new Date().toLocaleDateString("ru-RU"),
        time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
        accidentDate: new Date().toLocaleDateString("ru-RU"),
        accidentTime: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      },
      legend: s.legend,
      imageDataUrl: s.imageDataUrl,
    }
    const updated = [duplicate, ...schemes]
    setSchemes(updated)
    saveSchemes(updated)
    switchTo(duplicate)
  }

  const deleteScheme = (id: string) => {
    const updated = schemes.filter(s => s.id !== id)
    setSchemes(updated)
    saveSchemes(updated)
    setDeleteConfirm(null)
    if (activeId === id) {
      if (updated.length > 0) {
        switchTo(updated[0])
      } else {
        setActiveId(null)
        setForm(makeDefaultForm())
        setLegend(DEFAULT_LEGEND)
        setImageUrl(null)
        setMarkers([])
      }
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const dataUrl = await fileToDataUrl(file)
    setImageUrl(dataUrl)
  }

  const getRelativePos = useCallback((clientX: number, clientY: number) => {
    const el = imageContainerRef.current
    if (!el) return { x: 50, y: 50 }
    const rect = el.getBoundingClientRect()
    return {
      x: Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100)),
    }
  }, [])

  const handleImageAreaClick = useCallback((e: React.MouseEvent) => {
    if (!placingLegendId) {
      if (editingMarkers) setSelectedMarkerId(null)
      return
    }
    const pos = getRelativePos(e.clientX, e.clientY)
    const iid = Date.now().toString() + Math.random().toString(36).slice(2)
    setMarkers(m => [...m, { legendId: placingLegendId, x: pos.x, y: pos.y, scale: 1, rotation: 0, instanceId: iid }])
    setPlacingLegendId(null)
  }, [placingLegendId, editingMarkers, getRelativePos])

  const handleMarkerMouseDown = useCallback((e: React.MouseEvent, instanceId: string) => {
    e.stopPropagation()
    setSelectedMarkerId(instanceId)
    const el = imageContainerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const marker = markers.find(m => m.instanceId === instanceId)
    if (!marker) return
    const markerPxX = (marker.x / 100) * rect.width + rect.left
    const markerPxY = (marker.y / 100) * rect.height + rect.top
    setDraggingMarker({ instanceId, offsetX: e.clientX - markerPxX, offsetY: e.clientY - markerPxY })
  }, [markers])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingMarker) return
    const pos = getRelativePos(e.clientX - draggingMarker.offsetX, e.clientY - draggingMarker.offsetY)
    setMarkers(m => m.map(mk => mk.instanceId === draggingMarker.instanceId ? { ...mk, x: pos.x, y: pos.y } : mk))
  }, [draggingMarker, getRelativePos])

  const handleMouseUp = useCallback(() => {
    setDraggingMarker(null)
  }, [])

  const removeMarker = (instanceId: string) => {
    setMarkers(m => m.filter(mk => mk.instanceId !== instanceId))
    setSelectedMarkerId(null)
  }

  const updateMarker = (instanceId: string, patch: Partial<MarkerPosition>) =>
    setMarkers(m => m.map(mk => mk.instanceId === instanceId ? { ...mk, ...patch } : mk))

  const copyMarker = (instanceId: string) => {
    const mk = markers.find(m => m.instanceId === instanceId)
    if (!mk) return
    const newIid = Date.now().toString() + Math.random().toString(36).slice(2)
    setMarkers(m => [...m, { ...mk, instanceId: newIid, x: Math.min(95, mk.x + 4), y: Math.min(95, mk.y + 4) }])
    setSelectedMarkerId(newIid)
  }

  const addLegendItem = () => setLegend(l => [...l, { id: Date.now().toString(), symbol: "", description: "" }])
  const updateLegend = (id: string, field: "symbol" | "description" | "imageUrl", value: string) =>
    setLegend(l => l.map(item => item.id === id ? { ...item, [field]: value } : item))
  const removeLegend = (id: string) => {
    setLegend(l => l.filter(item => item.id !== id))
    setMarkers(m => m.filter(mk => mk.legendId !== id))
  }

  const exportToPng = async () => {
    const el = previewRef.current
    if (!el) return

    const wasEditing = editingMarkers
    setEditingMarkers(false)
    setPlacingLegendId(null)
    await new Promise(r => requestAnimationFrame(r))

    // Загружаем все внешние картинки через fetch → base64, подменяем src
    const imgEls = Array.from(el.querySelectorAll<HTMLImageElement>("img"))
    const origSrcs: [HTMLImageElement, string][] = []
    await Promise.all(imgEls.map(async img => {
      const url = img.src
      if (!url.startsWith("http")) return
      try {
        const res = await fetch(url)
        const blob = await res.blob()
        const b64 = await new Promise<string>(r => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(blob) })
        origSrcs.push([img, url])
        img.src = b64
      } catch { /* оставляем как есть */ }
    }))

    await new Promise(r => requestAnimationFrame(r))
    await new Promise(r => requestAnimationFrame(r))

    const prevWidth = el.style.width
    const prevMinWidth = el.style.minWidth
    el.style.width = "1100px"
    el.style.minWidth = "1100px"
    await new Promise(r => requestAnimationFrame(r))

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: false,
      allowTaint: true,
      backgroundColor: "#ffffff",
      width: 1100,
      height: el.scrollHeight,
    })

    // Восстанавливаем оригинальные src
    el.style.width = prevWidth
    el.style.minWidth = prevMinWidth
    origSrcs.forEach(([img, url]) => { img.src = url })
    if (wasEditing) setEditingMarkers(true)

    const link = document.createElement("a")
    link.download = `Схема_аварийного_участка_поз${form.position || "-"}.png`
    link.href = canvas.toDataURL("image/png")
    link.click()
  }

  const exportToPdf = async () => {
    const el = previewRef.current
    if (!el) return

    // 1. Загружаем все внешние картинки через fetch → base64
    const fetchBase64 = async (url: string): Promise<string | null> => {
      try {
        const res = await fetch(url)
        const blob = await res.blob()
        return await new Promise<string>(r => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(blob) })
      } catch { return null }
    }

    // Собираем все уникальные URL картинок в превью
    const allImgEls = Array.from(el.querySelectorAll<HTMLImageElement>("img"))
    const urlMap: Record<string, string> = {}
    await Promise.all(allImgEls.map(async img => {
      const url = img.getAttribute("src") || ""
      if (url && !urlMap[url]) {
        const b64 = await fetchBase64(url)
        if (b64) urlMap[url] = b64
      }
    }))

    // 2. Заменяем src на base64 прямо в DOM
    allImgEls.forEach(img => {
      const url = img.getAttribute("src") || ""
      if (urlMap[url]) img.setAttribute("src", urlMap[url])
    })

    // Скрываем кнопки маркеров
    const wasEditing = editingMarkers
    setEditingMarkers(false)
    setPlacingLegendId(null)
    await new Promise(r => requestAnimationFrame(r))
    await new Promise(r => requestAnimationFrame(r))

    // 3. Снимаем единый скриншот
    const prevWidth = el.style.width
    const prevMinWidth = el.style.minWidth
    el.style.width = "1100px"
    el.style.minWidth = "1100px"
    await new Promise(r => requestAnimationFrame(r))

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: false,
      allowTaint: true,
      backgroundColor: "#ffffff",
      width: 1100,
      height: el.scrollHeight,
    })

    // 4. Восстанавливаем DOM
    el.style.width = prevWidth
    el.style.minWidth = prevMinWidth
    allImgEls.forEach(img => {
      const b64 = img.getAttribute("src") || ""
      const orig = Object.entries(urlMap).find(([, v]) => v === b64)?.[0]
      if (orig) img.setAttribute("src", orig)
    })
    if (wasEditing) setEditingMarkers(true)

    // 5. Вставляем в PDF
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
    const mL = 20, mT = 15, mR = 10, mB = 15
    const printW = 297 - mL - mR
    const printH = 210 - mT - mB

    const ratio = canvas.width / canvas.height
    let w = printW, h = w / ratio
    if (h > printH) { h = printH; w = h * ratio }

    pdf.addImage(canvas.toDataURL("image/png"), "PNG", mL + (printW - w) / 2, mT + (printH - h) / 2, w, h)

    pdf.setDrawColor(0); pdf.setLineWidth(0.5)
    pdf.rect(mL, mT, printW, printH)
    pdf.setLineWidth(1.2)
    pdf.line(mL, mT, mL, mT + printH)

    pdf.save(`Схема_аварийного_участка_поз${form.position || "-"}.pdf`)
  }

  const renderImageWithMarkers = (): Promise<ArrayBuffer | null> => {
    return new Promise(resolve => {
      if (!imageUrl || markers.length === 0) { resolve(null); return }
      const img = new Image()
      img.onload = async () => {
        const canvas = document.createElement("canvas")
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext("2d")
        if (!ctx) { resolve(null); return }
        ctx.drawImage(img, 0, 0)

        const baseSize = Math.max(24, canvas.width / 30)

        for (const mk of markers) {
          const item = legend.find(l => l.id === mk.legendId)
          if (!item) continue
          const px = (mk.x / 100) * canvas.width
          const py = (mk.y / 100) * canvas.height
          const sc = mk.scale ?? 1
          const rot = ((mk.rotation ?? 0) * Math.PI) / 180
          const sz = baseSize * sc

          ctx.save()
          ctx.translate(px, py)
          ctx.rotate(rot)

          if (item.imageUrl) {
            const iconImg = new Image()
            await new Promise<void>(res => {
              iconImg.onload = () => res()
              iconImg.onerror = () => res()
              iconImg.src = item.imageUrl!
            })
            ctx.drawImage(iconImg, -sz / 2, -sz / 2, sz, sz)
          } else {
            const text = item.symbol
            ctx.font = `bold ${Math.round(sz * 0.6)}px Arial`
            ctx.textBaseline = "middle"
            ctx.textAlign = "center"
            ctx.fillStyle = "#111"
            ctx.fillText(text, 0, 0)
          }
          ctx.restore()
        }

        canvas.toBlob(blob => {
          if (!blob) { resolve(null); return }
          blob.arrayBuffer().then(resolve)
        }, "image/png")
      }
      img.onerror = () => resolve(null)
      img.src = imageUrl
    })
  }

  const exportToExcel = () => {
    const rows: (string | number)[][] = [
      ["СХЕМА АВАРИЙНОГО УЧАСТКА"],
      [`Позиция: ${form.position}`, `Дата: ${form.date}`, `Время: ${form.time} (${form.timezone})`],
      [],
      ["Наименование объекта:", form.objectName],
      ["Вид аварии:", form.accidentType],
      ["Дата и время аварии:", `${form.accidentDate} ${form.accidentTime} (${form.timezone})`],
      ["Место аварии:", form.accidentLocation],
      ["Количество воздуха:", `${form.airVolume} м³/с`],
      ["Сечение аварийной выработки:", `${form.sectionArea} м²`],
      ["Телефон КП:", form.phoneCP],
      [],
      ["СОСТАВ РУДНИЧНОЙ АТМОСФЕРЫ"],
      ["Параметр", "Значение"],
      ["CO", form.co], ["CO2", form.co2], ["SO2", form.so2], ["O2", form.o2],
      ["CH4", form.ch4], ["NO-NO2", form.nono2], ["t°", form.temperature],
      ["Степень задымлённости", form.smokeLevel],
      [],
      ["УСЛОВНЫЕ ОБОЗНАЧЕНИЯ"],
      ...legend.map(l => {
        const mk = markers.find(m => m.legendId === l.id)
        return mk
          ? [l.symbol, l.description, `на схеме (${mk.x.toFixed(0)}%, ${mk.y.toFixed(0)}%)`]
          : [l.symbol, l.description]
      }),
      [],
      ["Руководитель горноспасательных работ:", form.headRescue],
      ["Помощник командира отряда:", form.assistantCommander],
      ["", form.commanderName],
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws["!cols"] = [{ wch: 40 }, { wch: 35 }, { wch: 20 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Схема аварийного участка")
    XLSX.writeFile(wb, `Схема_аварийного_участка_поз${form.position || "—"}.xlsx`)
  }

  const exportToWord = async () => {
    const noBorder = {
      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    }
    const thinBorder = {
      top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    }
    const makeRow = (label: string, value: string) =>
      new TableRow({ children: [
        new TableCell({ borders: noBorder, width: { size: 45, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 20 })] })] }),
        new TableCell({ borders: noBorder, width: { size: 55, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: value, size: 20 })] })] }),
      ]})
    const gasRow = (label: string, value: string) =>
      new TableRow({ children: [
        new TableCell({ borders: thinBorder, width: { size: 30, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: label, size: 18, bold: true })] })] }),
        new TableCell({ borders: thinBorder, width: { size: 70, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: value || "—", size: 18 })] })] }),
      ]})

    const children: (Paragraph | Table)[] = [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `Схема аварийного участка — позиция  ${form.position}     ${form.date}     ${form.time}  (${form.timezone})`, bold: true, size: 26 })],
        spacing: { after: 400 },
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          makeRow("Наименование обслуживаемого объекта:", form.objectName),
          makeRow("Вид аварии:", form.accidentType),
          makeRow("Дата и время аварии:", `${form.accidentDate}  ${form.accidentTime}  (${form.timezone})`),
          makeRow("Место аварии:", form.accidentLocation),
          makeRow("Количество воздуха в аварийной выработке:", `${form.airVolume} м³/с`),
          makeRow("Сечение аварийной выработки:", `${form.sectionArea} м²`),
          makeRow("Телефон КП:", form.phoneCP),
        ],
      }),
      new Paragraph({ spacing: { after: 200 } }),
      new Paragraph({ children: [new TextRun({ text: "Состав рудничной атмосферы:", bold: true, size: 22, underline: {} })], spacing: { before: 200, after: 100 } }),
      new Table({
        width: { size: 60, type: WidthType.PERCENTAGE },
        rows: [
          gasRow("CO", form.co), gasRow("CO2", form.co2), gasRow("SO2", form.so2),
          gasRow("O2", form.o2), gasRow("CH4", form.ch4), gasRow("NO-NO2", form.nono2),
          gasRow("t°", form.temperature), gasRow("Задымлённость", form.smokeLevel),
        ],
      }),
      new Paragraph({ spacing: { after: 300 } }),
    ]

    // Картинка + условные обозначения рядом в одной таблице
    if (imageUrl || legend.length > 0) {
      let imageCell: TableCell
      if (imageUrl) {
        let arrayBuffer: ArrayBuffer
        const compositeBuffer = await renderImageWithMarkers()
        if (compositeBuffer) {
          arrayBuffer = compositeBuffer
        } else if (imageFile) {
          arrayBuffer = await imageFile.arrayBuffer()
        } else {
          const res = await fetch(imageUrl)
          arrayBuffer = await res.arrayBuffer()
        }
        const isJpg = !compositeBuffer && (imageUrl.includes("jpeg") || imageUrl.includes("jpg") || !!imageFile?.type.includes("jpeg"))
        imageCell = new TableCell({
          borders: noBorder,
          width: { size: legend.length > 0 ? 72 : 100, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              children: [new ImageRun({ data: arrayBuffer, transformation: { width: 460, height: 310 }, type: isJpg ? "jpg" : "png" })],
            }),
          ],
        })
      } else {
        imageCell = new TableCell({ borders: noBorder, width: { size: 72, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [] })] })
      }

      const legendRows = await Promise.all(legend.map(async l => {
        let iconRun: ImageRun | TextRun
        if (l.imageUrl) {
          try {
            const res = await fetch(l.imageUrl)
            const ab = await res.arrayBuffer()
            iconRun = new ImageRun({ data: ab, transformation: { width: 18, height: 18 }, type: "png" })
          } catch {
            iconRun = new TextRun({ text: l.symbol || "?", size: 18, bold: true })
          }
        } else {
          iconRun = new TextRun({ text: l.symbol || "?", size: 18, bold: true })
        }
        return new TableRow({ children: [
          new TableCell({ borders: noBorder, width: { size: 15, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [iconRun] })] }),
          new TableCell({ borders: noBorder, width: { size: 85, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: l.description, size: 18 })] })] }),
        ]})
      }))

      const legendCell = new TableCell({
        borders: {
          top: noBorder.top, bottom: noBorder.bottom, right: noBorder.right,
          left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        },
        width: { size: 28, type: WidthType.PERCENTAGE },
        children: legend.length > 0 ? [
          new Paragraph({ children: [new TextRun({ text: "Условные обозначения:", bold: true, size: 20, underline: {} })], spacing: { after: 100 } }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: legendRows }),
        ] : [new Paragraph({ children: [] })],
      })

      children.push(
        new Paragraph({ spacing: { after: 100 } }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [new TableRow({ children: legend.length > 0 ? [imageCell, legendCell] : [imageCell] })],
        }),
        new Paragraph({ spacing: { after: 200 } }),
      )
    }

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [new TableRow({ children: [
          new TableCell({ borders: noBorder, width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: `Руководитель горноспасательных работ:  ${form.headRescue}`, size: 20 })] })] }),
          new TableCell({ borders: noBorder, width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: `Помощник командира отряда  ${form.assistantCommander}  /${form.commanderName}/`, size: 20 })] })] }),
        ]})],
      })
    )

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            size: {
              orientation: PageOrientation.LANDSCAPE,
              width: convertMillimetersToTwip(210),
              height: convertMillimetersToTwip(297),
            },
            margin: {
              left: convertMillimetersToTwip(30),
              top: convertMillimetersToTwip(20),
              right: convertMillimetersToTwip(10),
              bottom: convertMillimetersToTwip(20),
            },
            borders: {
              pageBorderTop: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 0 },
              pageBorderBottom: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 0 },
              pageBorderLeft: { style: BorderStyle.SINGLE, size: 18, color: "000000", space: 0 },
              pageBorderRight: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 0 },
            },
          },
        },
        children,
      }],
    })
    const blob = await Packer.toBlob(doc)
    const url = URL.createObjectURL(new Blob([blob], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `Схема_аварийного_участка_поз${form.position || "—"}.docx`
    a.click()
    URL.revokeObjectURL(url)
  }

  const schemeLabel = (s: SavedScheme) => {
    const pos = s.form.position ? `Поз. ${s.form.position}` : "Без номера"
    const date = s.form.date || new Date(s.createdAt).toLocaleDateString("ru-RU")
    const type = s.form.accidentType || ""
    return { pos, date, type }
  }

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
          <span className="font-sans text-sm font-semibold text-foreground">Схема аварийного участка</span>
          <span className="font-mono text-[10px] text-foreground/40 uppercase tracking-widest">Рудник / Шахта</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportToExcel} className="flex items-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm text-foreground/70 hover:border-foreground/40 hover:text-foreground transition-colors">
            <Icon name="FileSpreadsheet" size={15} />
            <span className="hidden sm:inline">Excel</span>
          </button>
          <button onClick={exportToWord} className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary hover:bg-primary/20 transition-colors">
            <Icon name="FileText" size={15} />
            <span className="hidden sm:inline">Word</span>
          </button>
          <button
            onClick={() => { setActiveTab("preview"); setPendingPdfExport(true) }}
            className="flex items-center gap-1.5 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-400 hover:bg-red-500/20 transition-colors"
          >
            <Icon name="FileDown" size={15} />
            <span className="hidden sm:inline">PDF</span>
          </button>
          <button
            onClick={() => { setActiveTab("preview"); setPendingPngExport(true) }}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400 hover:bg-emerald-500/20 transition-colors"
          >
            <Icon name="Image" size={15} />
            <span className="hidden sm:inline">PNG</span>
          </button>
        </div>
      </nav>

      <div className="pt-16 flex h-screen overflow-hidden">

        {/* Боковая панель — история */}
        <aside className="hidden md:flex flex-col w-56 lg:w-64 shrink-0 border-r border-foreground/10 bg-background/60 overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-foreground/10">
            <span className="font-mono text-[10px] text-foreground/40 uppercase tracking-widest">История</span>
            <button
              onClick={createNew}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              <Icon name="Plus" size={13} />
              Новая
            </button>
          </div>

          {schemes.length === 0 && (
            <div className="flex flex-col items-center justify-center flex-1 gap-2 text-foreground/30 px-4 text-center">
              <Icon name="FileX" size={28} />
              <p className="text-xs">Нет сохранённых схем</p>
              <button onClick={createNew} className="text-xs text-primary hover:text-primary/80 transition-colors mt-1">Создать первую</button>
            </div>
          )}

          <div className="flex flex-col py-1">
            {schemes.map(s => {
              const { pos, date, type } = schemeLabel(s)
              const isActive = s.id === activeId
              return (
                <div key={s.id} className={`group relative flex flex-col gap-0.5 px-4 py-3 cursor-pointer transition-colors border-l-2 ${isActive ? "bg-foreground/8 border-primary" : "border-transparent hover:bg-foreground/5"}`}
                  onClick={() => switchTo(s)}>
                  <span className={`font-sans text-sm font-medium truncate ${isActive ? "text-foreground" : "text-foreground/70"}`}>{pos}</span>
                  <span className="font-mono text-xs text-foreground/40">{date}</span>
                  {type && <span className="text-xs text-accent/80 truncate">{type}</span>}
                  <div className="absolute right-1 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                    <button
                      onClick={e => { e.stopPropagation(); duplicateScheme(s) }}
                      title="Дублировать"
                      className="text-foreground/30 hover:text-primary p-1 rounded transition-colors"
                    >
                      <Icon name="Copy" size={12} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteConfirm(s.id) }}
                      title="Удалить"
                      className="text-foreground/30 hover:text-red-400 p-1 rounded transition-colors"
                    >
                      <Icon name="Trash2" size={12} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </aside>

        {/* Основная область */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {/* Мобильная: кнопка новой + выбор схемы */}
          <div className="flex md:hidden items-center gap-2 px-4 py-2 border-b border-foreground/10 overflow-x-auto">
            <button onClick={createNew} className="flex items-center gap-1 shrink-0 text-xs text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/10 transition-colors">
              <Icon name="Plus" size={12} />
              Новая
            </button>
            {schemes.map(s => {
              const { pos, date } = schemeLabel(s)
              const isActive = s.id === activeId
              return (
                <div key={s.id} className={`shrink-0 flex items-center gap-0.5 rounded-lg border transition-colors ${isActive ? "border-primary bg-primary/10" : "border-foreground/15"}`}>
                  <button onClick={() => switchTo(s)}
                    className={`text-xs px-3 py-1.5 transition-colors ${isActive ? "text-primary" : "text-foreground/60 hover:text-foreground"}`}>
                    {pos || "—"} · {date}
                  </button>
                  <button onClick={e => { e.stopPropagation(); duplicateScheme(s) }} title="Дублировать"
                    className="text-foreground/30 hover:text-primary p-1.5 transition-colors">
                    <Icon name="Copy" size={11} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); setDeleteConfirm(s.id) }} title="Удалить"
                    className="text-foreground/30 hover:text-red-400 p-1.5 pr-2 transition-colors">
                    <Icon name="Trash2" size={11} />
                  </button>
                </div>
              )
            })}
          </div>

          {activeId === null ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-foreground/40">
              <Icon name="FilePlus2" size={48} />
              <p className="text-base">Создайте первую схему</p>
              <button onClick={createNew} className="flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-6 py-3 text-sm text-primary hover:bg-primary/20 transition-colors">
                <Icon name="Plus" size={16} />
                Создать схему
              </button>
            </div>
          ) : (
            <div className={activeTab === "preview" ? "flex flex-col h-full overflow-hidden" : "px-4 pb-10 md:px-6 lg:px-8"}>
              {/* Вкладки */}
              <div className={`flex gap-1 border-b border-foreground/10 shrink-0 ${activeTab === "preview" ? "px-4 md:px-6" : ""} mt-3`}>
                {(["form", "preview"] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`px-5 py-2.5 text-sm font-sans transition-colors border-b-2 -mb-px ${activeTab === tab ? "border-primary text-foreground" : "border-transparent text-foreground/50 hover:text-foreground/80"}`}>
                    {tab === "form" ? "Ввод данных" : "Предпросмотр"}
                  </button>
                ))}
              </div>

              {/* ФОРМА */}
              {activeTab === "form" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 overflow-y-auto flex-1 mt-4">
                  {/* Левая колонка */}
                  <div className="flex flex-col gap-5">
                    <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-5">
                      <p className="font-mono text-xs text-foreground/40 uppercase tracking-widest mb-4">Заголовок документа</p>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Позиция №" value={form.position} onChange={set("position")} placeholder="28" />
                        <Field label="Дата" value={form.date} onChange={set("date")} placeholder="01.01.2026" />
                        <Field label="Время" value={form.time} onChange={set("time")} placeholder="7:15" />
                        <Field label="Часовой пояс" value={form.timezone} onChange={set("timezone")} placeholder="мск" />
                      </div>
                    </div>

                    <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-5">
                      <p className="font-mono text-xs text-foreground/40 uppercase tracking-widest mb-4">Основные сведения</p>
                      <div className="flex flex-col gap-3">
                        <Field label="Наименование объекта" value={form.objectName} onChange={set("objectName")} placeholder="Рудник (месторождение)..." wide />
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-foreground/50 font-mono uppercase tracking-wider">Вид аварии</label>
                          <select value={form.accidentType} onChange={e => set("accidentType")(e.target.value)}
                            className="bg-foreground/5 border border-foreground/15 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60 transition-colors">
                            {ACCIDENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Дата аварии" value={form.accidentDate} onChange={set("accidentDate")} />
                          <Field label="Время аварии" value={form.accidentTime} onChange={set("accidentTime")} />
                        </div>
                        <Field label="Место аварии" value={form.accidentLocation} onChange={set("accidentLocation")} placeholder="насосная гор. +210м." />
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Кол-во воздуха, м³/с" value={form.airVolume} onChange={set("airVolume")} placeholder="4,79" />
                          <Field label="Сечение выработки, м²" value={form.sectionArea} onChange={set("sectionArea")} placeholder="10,0" />
                        </div>
                        <Field label="Телефон КП" value={form.phoneCP} onChange={set("phoneCP")} placeholder="2-100" />
                      </div>
                    </div>

                    <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-5">
                      <p className="font-mono text-xs text-foreground/40 uppercase tracking-widest mb-4">Подписи</p>
                      <div className="flex flex-col gap-3">
                        <Field label="Руководитель горноспасательных работ" value={form.headRescue} onChange={set("headRescue")} placeholder="Фамилия И.О." />
                      </div>
                    </div>
                  </div>

                  {/* Правая колонка */}
                  <div className="flex flex-col gap-5">
                    <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-5">
                      <p className="font-mono text-xs text-foreground/40 uppercase tracking-widest mb-4">Состав рудничной атмосферы</p>
                      <div className="flex flex-col gap-2.5">
                        <GasField label="CO" value={form.co} onChange={set("co")} />
                        <GasField label="CO₂" value={form.co2} onChange={set("co2")} />
                        <GasField label="SO₂" value={form.so2} onChange={set("so2")} />
                        <GasField label="O₂" value={form.o2} onChange={set("o2")} />
                        <GasField label="CH₄" value={form.ch4} onChange={set("ch4")} />
                        <GasField label="NO-NO₂" value={form.nono2} onChange={set("nono2")} />
                        <GasField label="t°" value={form.temperature} onChange={set("temperature")} />
                        <div className="flex flex-col gap-1 mt-1">
                          <label className="text-xs text-foreground/50 font-mono uppercase tracking-wider">Степень задымлённости</label>
                          <input value={form.smokeLevel} onChange={e => set("smokeLevel")(e.target.value)} placeholder="средняя от 5 до 10м"
                            className="bg-foreground/5 border border-foreground/15 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary/60 transition-colors" />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-5">
                      <p className="font-mono text-xs text-foreground/40 uppercase tracking-widest mb-3">Схема (картинка) участка</p>
                      <div onClick={() => fileInputRef.current?.click()}
                        className="relative cursor-pointer rounded-lg border-2 border-dashed border-foreground/20 hover:border-primary/50 transition-colors overflow-hidden">
                        {imageUrl ? (
                          <img src={imageUrl} alt="Схема участка" className="w-full h-48 object-contain bg-white/5" />
                        ) : (
                          <div className="flex flex-col items-center justify-center h-36 gap-2 text-foreground/40">
                            <Icon name="ImagePlus" size={28} />
                            <span className="text-sm">Нажмите для загрузки</span>
                          </div>
                        )}
                      </div>
                      {imageUrl && (
                        <button onClick={() => { setImageUrl(null); setImageFile(null) }}
                          className="mt-2 text-xs text-foreground/40 hover:text-foreground/70 transition-colors flex items-center gap-1">
                          <Icon name="X" size={12} />Удалить
                        </button>
                      )}
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </div>

                    <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-5">
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-mono text-xs text-foreground/40 uppercase tracking-widest">Условные обозначения</p>
                        <button onClick={addLegendItem} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                          <Icon name="Plus" size={13} />Добавить
                        </button>
                      </div>
                      {/* Библиотека иконок УО по ГОСТ */}
                      <div className="mb-3">
                        <p className="text-xs text-foreground/40 mb-2">Быстрое добавление из библиотеки:</p>
                        <div className="flex flex-wrap gap-2">
                          {LEGEND_IMAGES.map(img => {
                            const alreadyAdded = legend.some(l => l.description === img.description)
                            return (
                              <button
                                key={img.url}
                                title={alreadyAdded ? `Убрать: ${img.description}` : img.description}
                                onClick={() => {
                                  if (alreadyAdded) {
                                    const existing = legend.find(l => l.description === img.description)
                                    if (existing) removeLegend(existing.id)
                                  } else {
                                    setLegend(l => [...l, {
                                      id: Date.now().toString(),
                                      symbol: img.symbol,
                                      description: img.description,
                                      imageUrl: img.url,
                                    }])
                                  }
                                }}
                                className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-colors ${
                                  alreadyAdded
                                    ? "border-primary/60 bg-primary/15 hover:bg-red-500/15 hover:border-red-400/50"
                                    : "border-foreground/15 hover:border-primary/50 bg-foreground/5 hover:bg-primary/5"
                                }`}
                              >
                                <div className="relative">
                                  <img src={img.url} alt={img.description} className="w-8 h-8 object-contain" style={{ imageRendering: "crisp-edges" }} />
                                  {alreadyAdded && (
                                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary rounded-full flex items-center justify-center text-background" style={{ fontSize: 8, fontWeight: "bold" }}>✓</span>
                                  )}
                                </div>
                                <span className={`text-[9px] max-w-[56px] text-center leading-tight ${alreadyAdded ? "text-primary/80" : "text-foreground/50"}`}>{img.description}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        {legend.map(item => (
                          <div key={item.id} className="flex items-center gap-2">
                            <div className="w-10 h-10 shrink-0 flex items-center justify-center border border-foreground/15 rounded-lg bg-foreground/5 overflow-hidden">
                              {item.imageUrl
                                ? <img src={item.imageUrl} alt={item.symbol} className="w-8 h-8 object-contain" />
                                : <span className="text-base">{item.symbol || "?"}</span>
                              }
                            </div>
                            <input value={item.description} onChange={e => updateLegend(item.id, "description", e.target.value)} placeholder="Описание"
                              className="flex-1 bg-foreground/5 border border-foreground/15 rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary/60 transition-colors" />
                            <button onClick={() => removeLegend(item.id)} className="text-foreground/30 hover:text-foreground/60 transition-colors shrink-0">
                              <Icon name="Trash2" size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ПРЕДПРОСМОТР */}
              {activeTab === "preview" && (
                <>
                {/* Тулбар предпросмотра */}
                <div className="flex items-center gap-3 px-4 md:px-6 py-2 shrink-0 border-b border-foreground/10 bg-background/60 backdrop-blur-sm overflow-x-auto">
                  <span className="text-xs text-foreground/40 font-mono uppercase tracking-wider shrink-0">Предпросмотр</span>

                  {/* Панель выбранного маркера — в тулбаре */}
                  {selectedMarkerId && (() => {
                    const mk = markers.find(m => (m.instanceId ?? m.legendId) === selectedMarkerId)
                    if (!mk) return null
                    const sc = mk.scale ?? 1
                    const rot = mk.rotation ?? 0
                    const item = legend.find(l => l.id === mk.legendId)
                    return (
                      <div className="flex items-center gap-2 flex-1 min-w-0" onClick={e => e.stopPropagation()}>
                        {/* Иконка выбранного */}
                        <div className="shrink-0 w-7 h-7 flex items-center justify-center border border-blue-400/40 rounded bg-blue-500/10">
                          {item?.imageUrl
                            ? <img src={item.imageUrl} alt="" className="w-5 h-5 object-contain" />
                            : <span className="text-blue-300 text-[10px] font-bold">{item?.symbol}</span>
                          }
                        </div>
                        {/* Размер */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-foreground/40 text-[10px]">Размер</span>
                          <input type="range" min="0.3" max="3" step="0.1" value={sc}
                            onChange={e => updateMarker(selectedMarkerId, { scale: parseFloat(e.target.value) })}
                            className="w-20 accent-blue-400 h-1" />
                          <span className="text-foreground/70 text-[10px] w-6">{sc.toFixed(1)}×</span>
                        </div>
                        {/* Быстрые размеры */}
                        <div className="flex gap-0.5 shrink-0">
                          {[0.5, 1, 1.5, 2].map(s => (
                            <button key={s} onClick={() => updateMarker(selectedMarkerId, { scale: s })}
                              className={`text-[9px] rounded px-1.5 py-0.5 transition-colors ${Math.abs(sc - s) < 0.05 ? "bg-blue-500 text-white" : "bg-foreground/10 text-foreground/50 hover:bg-foreground/20"}`}>{s}×</button>
                          ))}
                        </div>
                        {/* Разделитель */}
                        <div className="w-px h-5 bg-foreground/15 shrink-0" />
                        {/* Поворот */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-foreground/40 text-[10px]">Поворот</span>
                          <input type="range" min="0" max="359" step="5" value={rot}
                            onChange={e => updateMarker(selectedMarkerId, { rotation: parseInt(e.target.value) })}
                            className="w-20 accent-blue-400 h-1" />
                          <span className="text-foreground/70 text-[10px] w-7">{rot}°</span>
                        </div>
                        {/* Быстрые углы */}
                        <div className="flex gap-0.5 shrink-0">
                          {[0, 90, 180, 270].map(a => (
                            <button key={a} onClick={() => updateMarker(selectedMarkerId, { rotation: a })}
                              className={`text-[9px] rounded px-1.5 py-0.5 transition-colors ${rot === a ? "bg-blue-500 text-white" : "bg-foreground/10 text-foreground/50 hover:bg-foreground/20"}`}>{a}°</button>
                          ))}
                        </div>
                        {/* Разделитель */}
                        <div className="w-px h-5 bg-foreground/15 shrink-0" />
                        {/* Копировать / Удалить */}
                        <button onClick={() => copyMarker(selectedMarkerId)}
                          className="flex items-center gap-1 shrink-0 text-[10px] text-foreground/60 hover:text-foreground border border-foreground/15 hover:border-foreground/30 rounded-lg px-2 py-1 transition-colors">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                          Копировать
                        </button>
                        <button onClick={() => removeMarker(selectedMarkerId)}
                          className="flex items-center gap-1 shrink-0 text-[10px] text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 rounded-lg px-2 py-1 transition-colors">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                          Удалить
                        </button>
                        {/* Закрыть */}
                        <button onClick={() => setSelectedMarkerId(null)}
                          className="shrink-0 text-foreground/30 hover:text-foreground/60 transition-colors ml-1">
                          <Icon name="X" size={14} />
                        </button>
                      </div>
                    )
                  })()}

                  {/* Кнопка Готово — всегда справа */}
                  <button
                    onClick={() => { setEditingMarkers(e => !e); setPlacingLegendId(null); setSelectedMarkerId(null) }}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors shrink-0 ml-auto ${editingMarkers ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-400" : "border-foreground/20 bg-foreground/5 text-foreground/60 hover:text-foreground"}`}
                  >
                    <Icon name={editingMarkers ? "Check" : "MapPin"} size={13} />
                    {editingMarkers ? "Готово" : "Разместить маркеры"}
                  </button>
                </div>

                {/* Полноэкранная рабочая область */}
                <div className="flex-1 overflow-hidden flex flex-col">

                  {/* Шапка документа — компактная полоска */}
                  <div ref={previewRef} className="bg-white text-black flex flex-col flex-1 min-h-0 overflow-hidden" style={{ fontFamily: "Times New Roman, serif" }}>
                  <div ref={headerRef} className="px-4 pt-2 pb-1" style={{ borderBottom: "1px solid #ccc" }}>
                    <p className="text-center font-bold" style={{ fontSize: 12 }}>
                      Схема аварийного участка — позиция&nbsp;{form.position || "—"}
                      &nbsp;&nbsp;{form.date}&nbsp;{form.time}&nbsp;({form.timezone})
                    </p>
                    <div className="flex gap-0 mt-0.5" style={{ fontSize: 10 }}>
                      <div style={{ width: "50%", paddingRight: 6 }}>
                        <span className="font-bold">Объект:</span> {form.objectName || "—"} &nbsp;
                        <span className="font-bold">Авария:</span> {form.accidentType} &nbsp;
                        <span className="font-bold">Место:</span> {form.accidentLocation || "—"}
                      </div>
                      <div style={{ width: "50%", borderLeft: "1px solid #ccc", paddingLeft: 6 }}>
                        <span className="font-bold">Дата/время:</span> {form.accidentDate} {form.accidentTime} &nbsp;
                        <span className="font-bold">Q:</span> {form.airVolume || "—"} м³/с &nbsp;
                        <span className="font-bold">S:</span> {form.sectionArea || "—"} м² &nbsp;
                        <span className="font-bold">КП:</span> {form.phoneCP || "—"}
                      </div>
                    </div>
                  </div>

                  {/* Рабочая область: картинка во весь экран + панель УО справа */}
                  <div className="flex flex-1 min-h-0">
                    {/* Картинка схемы — занимает всё место */}
                    <div
                      ref={imageContainerRef}
                      className={`relative bg-gray-100 select-none flex-1 overflow-hidden ${placingLegendId ? "cursor-crosshair" : draggingMarker ? "cursor-grabbing" : ""}`}
                      onClick={handleImageAreaClick}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                    >
                      {imageUrl ? (
                        <img src={imageUrl} alt="Схема" className="block pointer-events-none w-full h-full object-contain" />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                          <span className="text-sm">Загрузите схему участка во вкладке «Ввод данных»</span>
                        </div>
                      )}
                      {placingLegendId && (
                        <div className="absolute inset-0 border-4 border-dashed border-blue-400 pointer-events-none flex items-end justify-center pb-8">
                          <span className="bg-blue-500 text-white text-sm px-4 py-2 rounded-lg shadow-lg">Кликните для размещения УО</span>
                        </div>
                      )}
                      {markers.map(mk => {
                        const item = legend.find(l => l.id === mk.legendId)
                        if (!item) return null
                        const iid = mk.instanceId ?? mk.legendId
                        const sc = mk.scale ?? 1
                        const rot = mk.rotation ?? 0
                        const isSelected = selectedMarkerId === iid
                        return (
                          <div
                            key={iid}
                            className="absolute cursor-grab active:cursor-grabbing"
                            style={{
                              left: `${mk.x}%`, top: `${mk.y}%`,
                              transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${sc})`,
                              zIndex: isSelected ? 30 : 10,
                              transformOrigin: "center",
                            }}
                            onMouseDown={e => handleMarkerMouseDown(e, iid)}
                            onClick={e => { e.stopPropagation(); setSelectedMarkerId(isSelected ? null : iid) }}
                          >
                            {item.imageUrl
                              ? <img src={item.imageUrl} alt={item.symbol} style={{ width: 36, height: 36, objectFit: "contain", display: "block" }} draggable={false} />
                              : <span className="font-bold text-gray-900 drop-shadow" style={{ fontSize: 14, lineHeight: 1 }}>{item.symbol}</span>
                            }
                            {isSelected && (
                              <div className="absolute rounded border-2 border-blue-500 pointer-events-none" style={{ inset: -4 }} />
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Правая панель УО */}
                    {legend.length > 0 && (
                      <div className="bg-white border-l border-gray-200 overflow-y-auto shrink-0" style={{ width: 180, padding: "6px 8px" }}>
                        <p className="font-bold underline mb-2" style={{ fontSize: 10 }}>Условные обозначения:</p>
                        <div className="flex flex-col gap-1">
                          {legend.map(item => {
                            const placedCount = markers.filter(m => m.legendId === item.id).length
                            const isPlacing = placingLegendId === item.id
                            return (
                              <div key={item.id}
                                className={`flex items-center gap-1.5 rounded px-1 py-0.5 cursor-pointer transition-colors ${isPlacing ? "bg-blue-50 ring-1 ring-blue-300" : "hover:bg-gray-50"}`}
                                onClick={() => {
                                  if (!editingMarkers) setEditingMarkers(true)
                                  setPlacingLegendId(isPlacing ? null : item.id)
                                  setSelectedMarkerId(null)
                                }}
                                title={isPlacing ? "Отмена" : "Кликните на схеме для размещения"}
                              >
                                <span className="shrink-0 flex items-center justify-center" style={{ width: 18, height: 18 }}>
                                  {item.imageUrl
                                    ? <img src={item.imageUrl} alt={item.symbol} style={{ width: 16, height: 16, objectFit: "contain" }} />
                                    : <span style={{ fontWeight: "bold", fontSize: 9 }}>{item.symbol}</span>
                                  }
                                </span>
                                <span className="flex-1 leading-tight" style={{ fontSize: 9 }}>{item.description}</span>
                                {placedCount > 0 && (
                                  <span className="shrink-0 text-blue-500 font-bold" style={{ fontSize: 8 }}>×{placedCount}</span>
                                )}
                                {isPlacing && <span className="shrink-0 text-blue-500" style={{ fontSize: 9 }}>✕</span>}
                              </div>
                            )
                          })}
                        </div>
                        <p className="text-gray-400 mt-2 leading-tight" style={{ fontSize: 7 }}>Клик по строке → разместить на схеме</p>
                      </div>
                    )}
                  </div>

                  {/* Подписи */}
                  <div className="bg-white px-4 py-1.5" style={{ fontSize: 10, borderTop: "1px solid #ccc" }}>
                    <span className="font-bold">Руководитель горноспасательных работ:&nbsp;<span className="border-b border-gray-500 inline-block" style={{ minWidth: 150 }}>{form.headRescue}</span></span>
                  </div>
                  </div>
                </div>
                </>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Подтверждение удаления */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-background border border-foreground/15 rounded-2xl p-6 w-80 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <Icon name="Trash2" size={20} className="text-red-400" />
              <span className="font-sans text-base font-semibold text-foreground">Удалить схему?</span>
            </div>
            <p className="text-sm text-foreground/60 mb-5">Это действие нельзя отменить. Все данные позиции будут удалены.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 rounded-lg border border-foreground/20 px-4 py-2 text-sm text-foreground/70 hover:text-foreground transition-colors">Отмена</button>
              <button onClick={() => deleteScheme(deleteConfirm)} className="flex-1 rounded-lg bg-red-500/20 border border-red-500/40 px-4 py-2 text-sm text-red-400 hover:bg-red-500/30 transition-colors">Удалить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}