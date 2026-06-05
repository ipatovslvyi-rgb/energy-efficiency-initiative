import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { GrainOverlay } from "@/components/grain-overlay"
import Icon from "@/components/ui/icon"
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, HeadingLevel,
} from "docx"

// ─── Таблица 1 (Приказ Ростехнадзора №520, Приложение 6, Таблица N1) ──────────
// Температура воздуха ≥ 0°C — ЗВТ без средств противотепловой защиты
const TABLE1: { temp: number; stationary: number; moving: number }[] = [
  { temp: 27, stationary: 210, moving: 158 },
  { temp: 28, stationary: 180, moving: 135 },
  { temp: 29, stationary: 150, moving: 113 },
  { temp: 30, stationary: 120, moving: 90  },
  { temp: 31, stationary: 90,  moving: 68  },
  { temp: 32, stationary: 60,  moving: 45  },
  { temp: 33, stationary: 50,  moving: 38  },
  { temp: 34, stationary: 40,  moving: 30  },
  { temp: 35, stationary: 34,  moving: 26  },
  { temp: 36, stationary: 30,  moving: 23  },
  { temp: 37, stationary: 26,  moving: 20  },
  { temp: 38, stationary: 22,  moving: 17  },
  { temp: 39, stationary: 20,  moving: 15  },
  { temp: 40, stationary: 18,  moving: 14  },
]

// ─── Таблица 2 (Таблица N2) — температура ≤ 0°C ──────────────────────────────
const TABLE2: { label: string; min: number; max: number; stationary: number; moving: number }[] = [
  { label: "от 0 до −5",   min: -5,  max: 0,   stationary: 230, moving: 200 },
  { label: "от −5 до −10", min: -10, max: -5,  stationary: 180, moving: 150 },
  { label: "от −10 до −15",min: -15, max: -10, stationary: 150, moving: 130 },
  { label: "от −15 до −20",min: -20, max: -15, stationary: 120, moving: 100 },
]

function fmt(n: number, d = 1) {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: d, maximumFractionDigits: d })
}

function pad(n: number) {
  return String(Math.floor(n)).padStart(2, "0")
}

function minsToHHMM(mins: number) {
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  return `${pad(h)}:${pad(m)}`
}

/** По температуре возвращает { stationary, moving } или null */
function getLimits(temp: number): { stationary: number; moving: number } | null {
  if (temp > 40 || temp < -20) return null

  if (temp <= 0) {
    const row = TABLE2.find(r => temp > r.min && temp <= r.max)
      ?? (temp === 0 ? TABLE2[0] : null)
    return row ? { stationary: row.stationary, moving: row.moving } : null
  }

  if (temp < 27) return null // нет ограничений по таблице — вернём null (всё разрешено)

  // Интерполяция между строками таблицы 1
  const sorted = [...TABLE1].sort((a, b) => a.temp - b.temp)
  const lower = sorted.filter(r => r.temp <= temp).at(-1)
  const upper = sorted.find(r => r.temp > temp)

  if (!lower) return null
  if (!upper || lower.temp === temp) return { stationary: lower.stationary, moving: lower.moving }

  const frac = (temp - lower.temp) / (upper.temp - lower.temp)
  return {
    stationary: lower.stationary + frac * (upper.stationary - lower.stationary),
    moving:     lower.moving     + frac * (upper.moving     - lower.moving),
  }
}

interface CalcResult {
  entryTime: string
  exitTime: string
  temp: number
  maxTotal: number          // максимальное время пребывания, мин
  tForward: number          // время движения вперёд, мин
  tBack: number             // время движения назад, мин
  tWork: number             // время работы (остаток), мин (для режима «стационарная работа»)
  mode: "moving" | "stationary"
  exitTimeCalc: string      // расчётное время выхода
  warning: boolean
}

function calcZVT(entryTime: string, temp: number, mode: "moving" | "stationary"): CalcResult | null {
  const [hh, mm] = entryTime.split(":").map(Number)
  if (isNaN(hh) || isNaN(mm)) return null

  const limits = getLimits(temp)
  if (!limits) return null

  const maxTotal = mode === "moving" ? limits.moving : limits.stationary

  // По п. 12: при движении — 1/3 туда, 2/3 обратно
  // Это значит: tForward + tBack = maxTotal, tForward = maxTotal/3, tBack = 2*maxTotal/3
  let tForward: number
  let tBack: number
  let tWork: number

  if (mode === "moving") {
    tForward = maxTotal / 3
    tBack    = (2 * maxTotal) / 3
    tWork    = 0
  } else {
    // Для стационарной работы просто даём всё время
    tForward = 0
    tBack    = 0
    tWork    = maxTotal
  }

  const entryMins = hh * 60 + mm
  const exitMins  = entryMins + maxTotal
  const exitH = Math.floor(exitMins / 60) % 24
  const exitM = Math.round(exitMins % 60)
  const exitTimeCalc = `${pad(exitH)}:${pad(exitM)}`

  return {
    entryTime,
    exitTime: exitTimeCalc,
    temp,
    maxTotal,
    tForward,
    tBack,
    tWork,
    mode,
    exitTimeCalc,
    warning: temp > 40,
  }
}

async function exportToWord(result: CalcResult, performer: string, object: string) {
  const thin = { style: BorderStyle.SINGLE, size: 4, color: "AAAAAA" }
  const border = { top: thin, bottom: thin, left: thin, right: thin }

  const cell = (text: string, opts: { bold?: boolean; shade?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; width?: number } = {}) =>
    new TableCell({
      borders: border,
      width: opts.width !== undefined ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
      shading: opts.shade ? { fill: "FFF2CC" } : undefined,
      children: [new Paragraph({
        alignment: opts.align ?? AlignmentType.LEFT,
        children: [new TextRun({ text, bold: opts.bold, size: 22 })],
      })],
    })

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: "Приложение к плану ликвидации аварии", size: 20, italics: true })],
        }),
        new Paragraph({ children: [] }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: "РАСЧЁТ ВРЕМЕНИ ПРЕБЫВАНИЯ В ЗВТ", bold: true, size: 28 })],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [new TextRun({ text: `Объект: ${object}`, size: 22 })],
          spacing: { after: 100 },
        }),
        new Paragraph({
          children: [new TextRun({ text: `Нормативный документ: Приказ Ростехнадзора от 11.12.2020 №520, Приложение 6`, size: 22, italics: true })],
          spacing: { after: 300 },
        }),

        // Таблица исходных данных
        new Table({
          width: { size: 70, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ children: [
              cell("Параметр", { bold: true, width: 55 }),
              cell("Значение", { bold: true, width: 45 }),
            ]}),
            new TableRow({ children: [
              cell("Температура воздуха в ЗВТ"),
              cell(`${result.temp} °C`, { shade: true }),
            ]}),
            new TableRow({ children: [
              cell("Режим работы"),
              cell(result.mode === "moving" ? "Передвижение по горным выработкам" : "Работа или пребывание на одном месте", { shade: true }),
            ]}),
            new TableRow({ children: [
              cell("Время входа в ЗВТ"),
              cell(result.entryTime, { shade: true }),
            ]}),
          ],
        }),
        new Paragraph({ children: [] }),

        // Результаты
        new Paragraph({
          children: [new TextRun({ text: "Результаты расчёта", bold: true, size: 26 })],
          spacing: { before: 200, after: 150 },
        }),
        new Table({
          width: { size: 70, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ children: [
              cell("Показатель", { bold: true, width: 65 }),
              cell("Значение", { bold: true, width: 35 }),
            ]}),
            new TableRow({ children: [
              cell("Максимальное время непрерывного пребывания"),
              cell(`${fmt(result.maxTotal, 0)} мин (${minsToHHMM(result.maxTotal)})`),
            ]}),
            ...(result.mode === "moving" ? [
              new TableRow({ children: [
                cell("Время движения вперёд (1/3 от максимума)"),
                cell(`${fmt(result.tForward, 0)} мин (${minsToHHMM(result.tForward)})`),
              ]}),
              new TableRow({ children: [
                cell("Время движения назад (2/3 от максимума)"),
                cell(`${fmt(result.tBack, 0)} мин (${minsToHHMM(result.tBack)})`),
              ]}),
            ] : [
              new TableRow({ children: [
                cell("Время работы на месте"),
                cell(`${fmt(result.tWork, 0)} мин (${minsToHHMM(result.tWork)})`),
              ]}),
            ]),
            new TableRow({ children: [
              cell("Расчётное время выхода из ЗВТ", { bold: true }),
              cell(result.exitTimeCalc, { bold: true, shade: true }),
            ]}),
          ],
        }),
        new Paragraph({ children: [] }),
        new Paragraph({
          children: [new TextRun({ text: "Основание: п. 11–12 Приказа Ростехнадзора от 11.12.2020 №520.", size: 20, italics: true })],
          spacing: { before: 200, after: 100 },
        }),
        new Paragraph({
          children: [new TextRun({ text: "При передвижении: 1/3 времени — движение вперёд, 2/3 — движение назад (п. 12).", size: 20, italics: true })],
          spacing: { after: 400 },
        }),
        new Paragraph({
          children: [new TextRun({ text: `Расчёт выполнил: ${performer}`, size: 22 })],
          spacing: { before: 600 },
        }),
      ],
    }],
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `ЗВТ_расчёт_${result.entryTime.replace(":", "-")}.docx`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Zvt() {
  const navigate = useNavigate()

  const [temp, setTemp] = useState("32")
  const [entryTime, setEntryTime] = useState(() => {
    const now = new Date()
    return `${pad(now.getHours())}:${pad(now.getMinutes())}`
  })
  const [mode, setMode] = useState<"moving" | "stationary">("moving")
  const [performer, setPerformer] = useState("")
  const [object, setObject] = useState("")
  const [activeTab, setActiveTab] = useState<"calc" | "table1" | "table2">("calc")

  const tempNum = parseFloat(temp.replace(",", "."))
  const result  = !isNaN(tempNum) ? calcZVT(entryTime, tempNum, mode) : null
  const limits  = !isNaN(tempNum) ? getLimits(tempNum) : null

  // Предупреждение: выше 40°C запрещено (п.13)
  const forbidden = tempNum > 40

  return (
    <div className="relative flex h-screen flex-col overflow-hidden text-foreground">
      <GrainOverlay />
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 animated-bg" />
        <div className="absolute inset-0 bg-black/10" />
      </div>

      {/* Шапка */}
      <nav className="shrink-0 border-b border-foreground/10 bg-background/90 backdrop-blur-md z-40">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 rounded-lg border border-foreground/20 px-3 py-1.5 text-sm text-foreground/70 transition-all hover:border-foreground/40 hover:text-foreground"
            >
              <Icon name="ArrowLeft" size={14} />
              Главная
            </button>
            <span className="text-foreground/20">/</span>
            <span className="font-sans text-sm font-medium text-foreground">ЗВТ</span>
            <span className="hidden font-mono text-xs text-foreground/40 sm:block">— Зона высоких температур</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Вкладки перенесены в шапку */}
            <div className="flex gap-1.5">
              {([
                { key: "calc",   label: "Расчёт",    icon: "Calculator" },
                { key: "table1", label: "Табл. 1",   icon: "Table"  },
                { key: "table2", label: "Табл. 2",   icon: "Table"  },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-sans text-xs transition-all ${
                    activeTab === tab.key
                      ? "border-foreground bg-foreground text-background"
                      : "border-foreground/20 text-foreground/60 hover:border-foreground/40 hover:text-foreground"
                  }`}
                >
                  <Icon name={tab.icon} size={11} />
                  {tab.label}
                </button>
              ))}
            </div>
            <span className="font-mono text-[10px] text-foreground/30 hidden md:block">
              Приказ №520 · Прил. 6
            </span>
          </div>
        </div>
      </nav>

      {/* Тело — вся оставшаяся высота */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="mx-auto flex w-full max-w-6xl flex-1 overflow-hidden px-4 py-4 md:px-8">

        {/* ══════════════ РАСЧЁТ ══════════════ */}
        {activeTab === "calc" && (
          <div className="flex w-full gap-4 overflow-hidden">

            {/* Левая колонка — ввод */}
            <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-foreground/40 shrink-0">
                Исходные данные
              </p>

              {/* Объект */}
              <div className="shrink-0 rounded-xl border border-foreground/15 bg-foreground/5 px-3 py-2">
                <label className="mb-1 block font-mono text-[10px] text-foreground/50">Объект / место работ</label>
                <input
                  type="text"
                  value={object}
                  onChange={e => setObject(e.target.value)}
                  placeholder="Уклон №3, горизонт −240 м"
                  className="w-full bg-transparent font-sans text-sm text-foreground placeholder:text-foreground/25 outline-none"
                />
              </div>

              {/* Температура */}
              <div className="shrink-0 rounded-xl border border-foreground/15 bg-foreground/5 px-3 py-2.5">
                <label className="mb-2 block font-mono text-[10px] text-foreground/50">
                  Температура воздуха в ЗВТ, °C
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={temp}
                    onChange={e => setTemp(e.target.value)}
                    step="1"
                    className={`w-20 rounded-lg border px-2 py-1.5 text-center font-mono text-xl font-bold outline-none transition-colors ${
                      forbidden
                        ? "border-red-500/60 bg-red-500/10 text-red-400"
                        : "border-green-500/40 bg-green-500/10 text-foreground focus:border-green-500/60"
                    }`}
                  />
                  <span className="font-mono text-base text-foreground/50">°C</span>
                  {forbidden && (
                    <span className="flex items-center gap-1 rounded-lg bg-red-500/15 px-2 py-1 font-mono text-xs text-red-400">
                      <Icon name="AlertTriangle" size={11} />
                      Запрещено (п.13)
                    </span>
                  )}
                  {!forbidden && limits && (
                    <span className="font-mono text-[10px] text-foreground/40">
                      {limits.moving} / {limits.stationary} мин
                    </span>
                  )}
                  {!forbidden && !limits && !isNaN(tempNum) && tempNum < 27 && (
                    <span className="font-mono text-[10px] text-green-400/70">ниже ЗВТ</span>
                  )}
                </div>
                <div className="mt-2">
                  <input
                    type="range"
                    min={-20}
                    max={45}
                    step={1}
                    value={isNaN(tempNum) ? 32 : Math.min(45, Math.max(-20, tempNum))}
                    onChange={e => setTemp(e.target.value)}
                    className="w-full accent-blue-400"
                  />
                  <div className="mt-0.5 flex justify-between font-mono text-[9px] text-foreground/25">
                    <span>−20</span><span>0</span><span>27</span><span>40</span><span>45°C</span>
                  </div>
                </div>
              </div>

              {/* Режим */}
              <div className="shrink-0 rounded-xl border border-foreground/15 bg-foreground/5 px-3 py-2.5">
                <label className="mb-2 block font-mono text-[10px] text-foreground/50">Режим работы</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMode("moving")}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 font-sans text-xs transition-all ${
                      mode === "moving"
                        ? "border-blue-500/60 bg-blue-500/15 text-blue-300"
                        : "border-foreground/20 text-foreground/60 hover:border-foreground/40"
                    }`}
                  >
                    <Icon name="MoveHorizontal" size={12} />
                    Передвижение
                  </button>
                  <button
                    onClick={() => setMode("stationary")}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 font-sans text-xs transition-all ${
                      mode === "stationary"
                        ? "border-blue-500/60 bg-blue-500/15 text-blue-300"
                        : "border-foreground/20 text-foreground/60 hover:border-foreground/40"
                    }`}
                  >
                    <Icon name="MapPin" size={12} />
                    На месте
                  </button>
                </div>
                {mode === "moving" && (
                  <p className="mt-1.5 font-mono text-[9px] text-foreground/35">
                    По п. 12: 1/3 — вперёд, 2/3 — назад
                  </p>
                )}
              </div>

              {/* Время входа + Исполнитель — в одну строку */}
              <div className="shrink-0 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-foreground/15 bg-foreground/5 px-3 py-2.5">
                  <label className="mb-1.5 block font-mono text-[10px] text-foreground/50">Время входа</label>
                  <input
                    type="time"
                    value={entryTime}
                    onChange={e => setEntryTime(e.target.value)}
                    className="rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-1.5 font-mono text-lg font-bold text-foreground outline-none focus:border-green-500/60 w-full"
                  />
                </div>
                <div className="rounded-xl border border-foreground/15 bg-foreground/5 px-3 py-2.5">
                  <label className="mb-1.5 block font-mono text-[10px] text-foreground/50">Расчёт выполнил</label>
                  <input
                    type="text"
                    value={performer}
                    onChange={e => setPerformer(e.target.value)}
                    placeholder="Ф.И.О., должность"
                    className="w-full bg-transparent font-sans text-sm text-foreground placeholder:text-foreground/25 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Правая колонка — результат */}
            <div className="flex w-72 shrink-0 flex-col gap-3 overflow-y-auto">
              <p className="font-mono text-[10px] uppercase tracking-widest text-foreground/40 shrink-0">
                Результат
              </p>

              {forbidden ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5">
                  <div className="mb-2 flex items-center gap-2 text-red-400">
                    <Icon name="AlertTriangle" size={18} />
                    <span className="font-sans font-bold">Запрещено</span>
                  </div>
                  <p className="font-mono text-xs text-red-400/80 leading-relaxed">
                    По п. 13 Приказа №520 ведение горноспасательных работ при температуре выше 40°C без средств противотепловой индивидуальной защиты запрещено.
                  </p>
                </div>
              ) : !limits && !isNaN(tempNum) && tempNum < 27 ? (
                <div className="rounded-xl border border-green-500/20 bg-green-500/8 p-5">
                  <div className="flex items-center gap-2 text-green-400 mb-2">
                    <Icon name="CheckCircle" size={16} />
                    <span className="font-sans font-bold text-sm">Ниже порога ЗВТ</span>
                  </div>
                  <p className="font-mono text-xs text-foreground/50 leading-relaxed">
                    Температура {tempNum}°C — ограничения по ЗВТ не применяются (Таблица 1 начинается с 27°C).
                  </p>
                </div>
              ) : result ? (
                <>
                  {/* Время выхода — главная карточка */}
                  <div className="shrink-0 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-center">
                    <p className="mb-0.5 font-mono text-[10px] uppercase tracking-widest text-foreground/40">
                      Расчётное время выхода
                    </p>
                    <p className="font-sans text-4xl font-bold tracking-tight text-foreground">
                      {result.exitTimeCalc}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-foreground/40">
                      вход {result.entryTime} + {fmt(result.maxTotal, 0)} мин
                    </p>
                  </div>

                  {/* Максимальное время */}
                  <div className="shrink-0 rounded-xl border border-foreground/15 bg-foreground/5 px-4 py-2.5 text-center">
                    <p className="mb-0.5 font-mono text-[10px] uppercase tracking-widest text-foreground/40">
                      Макс. время пребывания
                    </p>
                    <p className="font-sans text-2xl font-bold text-foreground">
                      {fmt(result.maxTotal, 0)} <span className="text-sm font-normal text-foreground/50">мин</span>
                    </p>
                    <p className="font-mono text-[10px] text-foreground/40">{minsToHHMM(result.maxTotal)}</p>
                  </div>

                  {/* Разбивка движения */}
                  {mode === "moving" && (
                    <div className="shrink-0 rounded-xl border border-foreground/15 bg-foreground/5 px-4 py-2.5">
                      <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-foreground/40">
                        Распределение времени
                      </p>
                      <div className="flex h-4 overflow-hidden rounded-full mb-2">
                        <div className="flex items-center justify-center bg-blue-500/60 text-[9px] font-mono text-white" style={{ width: "33.33%" }}>1/3</div>
                        <div className="flex items-center justify-center bg-blue-400/30 text-[9px] font-mono text-foreground/60" style={{ width: "66.67%" }}>2/3</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="rounded-lg bg-blue-500/10 px-2 py-1.5">
                          <p className="font-mono text-[9px] text-foreground/40">Вперёд</p>
                          <p className="font-sans text-base font-bold text-foreground">{fmt(result.tForward, 0)}<span className="text-xs font-normal text-foreground/50"> мин</span></p>
                          <p className="font-mono text-[9px] text-foreground/40">{minsToHHMM(result.tForward)}</p>
                        </div>
                        <div className="rounded-lg bg-foreground/5 px-2 py-1.5">
                          <p className="font-mono text-[9px] text-foreground/40">Назад</p>
                          <p className="font-sans text-base font-bold text-foreground">{fmt(result.tBack, 0)}<span className="text-xs font-normal text-foreground/50"> мин</span></p>
                          <p className="font-mono text-[9px] text-foreground/40">{minsToHHMM(result.tBack)}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Временная шкала */}
                  <div className="shrink-0 rounded-xl border border-foreground/15 bg-foreground/5 px-4 py-2.5">
                    <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-foreground/40">Временна́я шкала</p>
                    <div className="relative">
                      <div className="h-1.5 w-full rounded-full bg-foreground/10">
                        {mode === "moving" && (
                          <>
                            <div className="absolute left-0 top-0 h-1.5 rounded-full bg-blue-500/70" style={{ width: "33.33%" }} />
                            <div className="absolute top-0 h-1.5 rounded-r-full bg-blue-400/40" style={{ left: "33.33%", width: "66.67%" }} />
                          </>
                        )}
                        {mode === "stationary" && <div className="h-1.5 w-full rounded-full bg-blue-500/50" />}
                      </div>
                      <div className="mt-1.5 flex justify-between font-mono text-[10px] text-foreground/40">
                        <span>{result.entryTime}</span>
                        {mode === "moving" && (
                          <span className="text-blue-400/70">
                            {(() => {
                              const [hh2, mm2] = entryTime.split(":").map(Number)
                              const fwdMins = (hh2 * 60 + mm2) + result.tForward
                              return `${pad(Math.floor(fwdMins / 60) % 24)}:${pad(Math.round(fwdMins % 60))}`
                            })()}
                          </span>
                        )}
                        <span className="text-red-400/70">{result.exitTimeCalc}</span>
                      </div>
                      {mode === "moving" && (
                        <div className="flex justify-between font-mono text-[9px] text-foreground/25">
                          <span>вход</span><span>поворот</span><span>выход</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Экспорт */}
                  <button
                    onClick={() => exportToWord(result, performer, object)}
                    className="shrink-0 flex w-full items-center justify-center gap-2 rounded-xl border border-foreground/20 bg-foreground/8 py-2.5 font-sans text-sm text-foreground/80 transition-all hover:border-foreground/40 hover:text-foreground"
                  >
                    <Icon name="Download" size={14} />
                    Экспорт в Word
                  </button>

                  {/* Нормативная база */}
                  <div className="shrink-0 rounded-xl border border-foreground/10 bg-foreground/3 px-3 py-2">
                    <p className="font-mono text-[10px] text-foreground/40 leading-relaxed">
                      Приказ Ростехнадзора №520, Прил. 6,
                      {tempNum >= 0 ? " Табл. №1" : " Табл. №2"}.
                      {mode === "moving" && " П. 12: 1/3 — вперёд, 2/3 — назад."}
                    </p>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-foreground/10 bg-foreground/3 p-6 text-center">
                  <p className="font-mono text-sm text-foreground/30">Введите температуру для расчёта</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════ ТАБЛИЦА 1 ══════════════ */}
        {activeTab === "table1" && (
          <div className="flex w-full flex-col rounded-xl border border-foreground/15 overflow-hidden">
            <div className="shrink-0 bg-foreground/8 px-5 py-3 border-b border-foreground/10">
              <h3 className="font-sans text-sm font-semibold text-foreground">Таблица №1</h3>
              <p className="font-mono text-xs text-foreground/45 mt-0.5">
                Максимальное время непрерывного пребывания в ЗВТ (температура ≥ 27°C), минут
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-foreground/10 bg-foreground/5">
                  <th className="px-5 py-3 text-left font-mono text-xs text-foreground/40 uppercase tracking-widest">
                    Темп., °C
                  </th>
                  <th className="px-5 py-3 text-center font-mono text-xs text-foreground/40 uppercase tracking-widest">
                    На одном месте, мин
                  </th>
                  <th className="px-5 py-3 text-center font-mono text-xs text-foreground/40 uppercase tracking-widest">
                    При передвижении, мин
                  </th>
                </tr>
              </thead>
              <tbody>
                {TABLE1.map(row => {
                  const isActive = !isNaN(tempNum) && Math.floor(tempNum) === row.temp
                  return (
                    <tr
                      key={row.temp}
                      className={`border-b border-foreground/5 last:border-0 transition-colors ${
                        isActive ? "bg-blue-500/15" : "hover:bg-foreground/5"
                      }`}
                    >
                      <td className={`px-5 py-3 font-mono font-bold ${isActive ? "text-blue-300" : "text-foreground"}`}>
                        {row.temp}°C
                        {isActive && <span className="ml-2 text-[10px] text-blue-400/70">← текущая</span>}
                      </td>
                      <td className="px-5 py-3 text-center font-mono text-foreground/80">{row.stationary}</td>
                      <td className="px-5 py-3 text-center font-mono text-foreground/80">{row.moving}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
            <div className="shrink-0 border-t border-foreground/10 px-5 py-2 bg-foreground/3">
              <p className="font-mono text-[10px] text-foreground/35">
                Источник: Приказ №520, Прил. 6, Табл. №1. При t &gt; 40°C — запрещено (п. 13).
              </p>
            </div>
          </div>
        )}

        {/* ══════════════ ТАБЛИЦА 2 ══════════════ */}
        {activeTab === "table2" && (
          <div className="flex w-full flex-col rounded-xl border border-foreground/15 overflow-hidden">
            <div className="shrink-0 bg-foreground/8 px-5 py-3 border-b border-foreground/10">
              <h3 className="font-sans text-sm font-semibold text-foreground">Таблица №2</h3>
              <p className="font-mono text-xs text-foreground/45 mt-0.5">
                Максимальное время непрерывного пребывания в ЗВТ (температура ≤ 0°C), минут
              </p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-foreground/10 bg-foreground/5">
                  <th className="px-5 py-3 text-left font-mono text-xs text-foreground/40 uppercase tracking-widest">
                    Темп., °C
                  </th>
                  <th className="px-5 py-3 text-center font-mono text-xs text-foreground/40 uppercase tracking-widest">
                    На одном месте, мин
                  </th>
                  <th className="px-5 py-3 text-center font-mono text-xs text-foreground/40 uppercase tracking-widest">
                    При передвижении, мин
                  </th>
                </tr>
              </thead>
              <tbody>
                {TABLE2.map(row => {
                  const isActive = !isNaN(tempNum) && tempNum > row.min && tempNum <= row.max
                  return (
                    <tr
                      key={row.label}
                      className={`border-b border-foreground/5 last:border-0 transition-colors ${
                        isActive ? "bg-blue-500/15" : "hover:bg-foreground/5"
                      }`}
                    >
                      <td className={`px-5 py-3 font-mono font-bold ${isActive ? "text-blue-300" : "text-foreground"}`}>
                        {row.label}
                        {isActive && <span className="ml-2 text-[10px] text-blue-400/70">← текущая</span>}
                      </td>
                      <td className="px-5 py-3 text-center font-mono text-foreground/80">{row.stationary}</td>
                      <td className="px-5 py-3 text-center font-mono text-foreground/80">{row.moving}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="shrink-0 border-t border-foreground/10 px-5 py-2 bg-foreground/3">
              <p className="font-mono text-[10px] text-foreground/35">
                Источник: Приказ №520, Прил. 6, Табл. №2. При t &lt; −20°C — запрещено (п. 19).
              </p>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}