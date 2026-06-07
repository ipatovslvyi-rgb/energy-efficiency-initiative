import { useState } from "react"
import { exportToWord, exportToExcel } from "@/lib/export-utils"
import { VentCalcButton, VentExportButtons } from "./ventilation-ui"

export const SHAFT_TABLE = {
  skip: [
    { area: "до 100",    qn: null,  kn: null  },
    { area: "100–300",   qn: null,  kn: null  },
    { area: "300–500",   qn: 670,   kn: 11.2  },
    { area: "500–1000",  qn: 780,   kn: 13.0  },
    { area: "более 1000",qn: 950,   kn: 15.8  },
  ],
  cage: [
    { area: "до 100",    qn: 90,    kn: 1.5   },
    { area: "100–300",   qn: 190,   kn: 3.2   },
    { area: "300–500",   qn: 380,   kn: 6.3   },
    { area: "500–1000",  qn: 690,   kn: 11.5  },
    { area: "более 1000",qn: 850,   kn: 14.2  },
  ],
}

export function AreaCalculator() {
  const [L, setL] = useState("")
  const [result, setResult] = useState<number | null>(null)
  const [calculated, setCalculated] = useState(false)

  const handleCalculate = () => {
    const lNum = parseFloat(L.replace(",", "."))
    if (!isNaN(lNum) && lNum > 0) {
      const F = (lNum / 3600) * 3
      setResult(F)
      setCalculated(true)
    }
  }

  const handleReset = () => {
    setL("")
    setResult(null)
    setCalculated(false)
  }

  const getExportData = () => ({
    title: "Расчёт площади сечения канала вентиляции",
    formula: "F = (L / 3600) × Vс",
    inputs: [
      { label: "Подача ГВУ (L)", value: L, unit: "м³/ч" },
      { label: "Скорость принудит. проветривания (Vс)", value: "3", unit: "м/с" },
    ],
    results: result !== null ? [
      { label: "Площадь сечения канала (F)", value: result.toFixed(4), unit: "м²" },
      { label: "Площадь сечения канала (F)", value: (result * 10000).toFixed(2), unit: "см²" },
      { label: "Площадь сечения канала (F)", value: (result * 1000000).toFixed(0), unit: "мм²" },
    ] : [],
  })

  return (
    <div className="grid gap-10 md:grid-cols-2 md:gap-16 lg:gap-24">
      <div>
        <div className="mb-6 rounded-xl border border-foreground/10 bg-foreground/5 p-5 backdrop-blur-sm md:p-8">
          <p className="mb-3 font-mono text-xs text-foreground/50 uppercase tracking-widest">Формула</p>
          <p className="font-mono text-2xl text-foreground md:text-3xl">F = (L / 3600) × Vс</p>
        </div>
        <div className="space-y-3 text-sm text-foreground/70 md:text-base">
          <div className="flex items-start gap-3">
            <span className="mt-1 font-mono text-xs text-foreground/40">F</span>
            <span>Площадь сечения канала, м²</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-1 font-mono text-xs text-foreground/40">L</span>
            <span>Максимальная подача ГВУ (из паспорта), м³/ч</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-1 font-mono text-xs text-foreground/40">Vс</span>
            <span>Скорость при принудительном проветривании — <strong className="text-foreground">3 м/с</strong></span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <label className="mb-2 block font-mono text-xs text-foreground/60">Подача ГВУ — L, м³/ч</label>
          <input
            type="number"
            value={L}
            onChange={(e) => { setL(e.target.value); setCalculated(false) }}
            min="0"
            step="any"
            placeholder="Например: 12000"
            className="w-full border-b border-foreground/30 bg-transparent py-2 text-lg text-foreground placeholder:text-foreground/30 focus:border-foreground/60 focus:outline-none md:text-xl"
          />
        </div>

        <VentCalcButton onClick={handleCalculate} disabled={!L || parseFloat(L) <= 0} calculated={calculated} onReset={handleReset} />

        {result !== null && (
          <div className="rounded-xl border border-foreground/20 bg-foreground/5 p-5 backdrop-blur-sm transition-all duration-500 md:p-6">
            <p className="mb-1 font-mono text-xs text-foreground/50 uppercase tracking-widest">Результат</p>
            <p className="font-sans text-4xl font-light text-foreground md:text-5xl">
              {result.toFixed(2)} <span className="text-2xl text-foreground/60">м²</span>
            </p>
            <p className="mt-2 font-mono text-xs text-foreground/50">
              {(result * 10000).toFixed(2)} см² · {(result * 1000000).toFixed(0)} мм²
            </p>
            <VentExportButtons onWord={() => exportToWord(getExportData())} onExcel={() => exportToExcel(getExportData())} />
          </div>
        )}
      </div>
    </div>
  )
}

export function ResistanceCalculator() {
  const [h, setH] = useState("")
  const [v, setV] = useState("")
  const [S, setS] = useState("")
  const [result, setResult] = useState<number | null>(null)
  const [Q, setQ] = useState<number | null>(null)
  const [calculated, setCalculated] = useState(false)

  const handleCalculate = () => {
    const hNum = parseFloat(h.replace(",", "."))
    const vNum = parseFloat(v.replace(",", "."))
    const sNum = parseFloat(S.replace(",", "."))
    if (!isNaN(hNum) && !isNaN(vNum) && !isNaN(sNum) && vNum > 0 && sNum > 0) {
      const qVal = vNum * sNum
      const rVal = hNum / (qVal * qVal)
      setQ(qVal)
      setResult(rVal)
      setCalculated(true)
    }
  }

  const handleReset = () => {
    setH("")
    setV("")
    setS("")
    setResult(null)
    setQ(null)
    setCalculated(false)
  }

  const getExportData = () => ({
    title: "Расчёт аэродинамического сопротивления выработки",
    formula: "Q = v × S; R = h / Q²",
    inputs: [
      { label: "Депрессия выработки (h)", value: h, unit: "кгс/м²" },
      { label: "Средняя скорость воздуха (v)", value: v, unit: "м/с" },
      { label: "Площадь поперечного сечения (S)", value: S, unit: "м²" },
    ],
    results: result !== null && Q !== null ? [
      { label: "Расход воздуха (Q)", value: Q.toFixed(4), unit: "м³/с" },
      { label: "Аэродинамическое сопротивление (R)", value: result.toFixed(6), unit: "кг·с²/м⁸" },
    ] : [],
  })

  const isReady = h && v && S && parseFloat(v) > 0 && parseFloat(S) > 0

  return (
    <div className="grid gap-10 md:grid-cols-2 md:gap-16 lg:gap-24">
      <div>
        <div className="mb-6 rounded-xl border border-foreground/10 bg-foreground/5 p-5 backdrop-blur-sm md:p-8">
          <p className="mb-3 font-mono text-xs text-foreground/50 uppercase tracking-widest">Формула</p>
          <p className="font-mono text-xl text-foreground md:text-2xl">R = h / Q²</p>
          <p className="mt-2 font-mono text-sm text-foreground/60">Q = v · S</p>
        </div>
        <div className="space-y-3 text-sm text-foreground/70 md:text-base">
          <div className="flex items-start gap-3">
            <span className="mt-1 font-mono text-xs text-foreground/40">R</span>
            <span>Аэродинамическое сопротивление, кг·с²/м⁸</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-1 font-mono text-xs text-foreground/40">h</span>
            <span>Депрессия выработки, кгс/м² (или Па)</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-1 font-mono text-xs text-foreground/40">Q</span>
            <span>Количество воздуха, протекающего по выработке, м³/с</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-1 font-mono text-xs text-foreground/40">v</span>
            <span>Средняя скорость движения воздуха, м/с</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-1 font-mono text-xs text-foreground/40">S</span>
            <span>Площадь поперечного сечения выработки, м²</span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <label className="mb-2 block font-mono text-xs text-foreground/60">Депрессия выработки — h, кгс/м²</label>
          <input
            type="number"
            value={h}
            onChange={(e) => { setH(e.target.value); setCalculated(false) }}
            min="0"
            step="any"
            placeholder="Например: 5.2"
            className="w-full border-b border-foreground/30 bg-transparent py-2 text-lg text-foreground placeholder:text-foreground/30 focus:border-foreground/60 focus:outline-none md:text-xl"
          />
        </div>
        <div>
          <label className="mb-2 block font-mono text-xs text-foreground/60">Средняя скорость воздуха — v, м/с</label>
          <input
            type="number"
            value={v}
            onChange={(e) => { setV(e.target.value); setCalculated(false) }}
            min="0"
            step="any"
            placeholder="Например: 1.5"
            className="w-full border-b border-foreground/30 bg-transparent py-2 text-lg text-foreground placeholder:text-foreground/30 focus:border-foreground/60 focus:outline-none md:text-xl"
          />
        </div>
        <div>
          <label className="mb-2 block font-mono text-xs text-foreground/60">Площадь поперечного сечения — S, м²</label>
          <input
            type="number"
            value={S}
            onChange={(e) => { setS(e.target.value); setCalculated(false) }}
            min="0"
            step="any"
            placeholder="Например: 8.4"
            className="w-full border-b border-foreground/30 bg-transparent py-2 text-lg text-foreground placeholder:text-foreground/30 focus:border-foreground/60 focus:outline-none md:text-xl"
          />
        </div>

        <VentCalcButton onClick={handleCalculate} disabled={!isReady} calculated={calculated} onReset={handleReset} />

        {result !== null && Q !== null && (
          <div className="rounded-xl border border-foreground/20 bg-foreground/5 p-5 backdrop-blur-sm transition-all duration-500 md:p-6">
            <p className="mb-3 font-mono text-xs text-foreground/50 uppercase tracking-widest">Результат</p>
            <div className="mb-3 border-b border-foreground/10 pb-3">
              <p className="font-mono text-xs text-foreground/40 mb-1">Расход воздуха Q</p>
              <p className="font-sans text-2xl font-light text-foreground">
                {Q.toFixed(4)} <span className="text-base text-foreground/60">м³/с</span>
              </p>
            </div>
            <div>
              <p className="font-mono text-xs text-foreground/40 mb-1">Аэродинамическое сопротивление R</p>
              <p className="font-sans text-4xl font-light text-foreground md:text-5xl">
                {result.toFixed(6)} <span className="text-xl text-foreground/60">кг·с²/м⁸</span>
              </p>
            </div>
            <VentExportButtons onWord={() => exportToWord(getExportData())} onExcel={() => exportToExcel(getExportData())} />
          </div>
        )}
      </div>
    </div>
  )
}

export function LeakageCalculator() {
  const [shaftType, setShaftType] = useState<"skip" | "cage">("cage")
  const [areaIdx, setAreaIdx] = useState<number>(0)
  const [h, setH] = useState("")
  const [result, setResult] = useState<{ qzd: number; qnh: number } | null>(null)
  const [calculated, setCalculated] = useState(false)

  const rows = SHAFT_TABLE[shaftType]
  const selected = rows[areaIdx]

  const handleCalculate = () => {
    const hNum = parseFloat(h.replace(",", "."))
    if (isNaN(hNum) || hNum <= 0 || selected.qn === null || selected.kn === null) return
    const qnh = selected.qn + selected.kn * Math.sqrt(hNum)
    const qzd = selected.qn * Math.sqrt(hNum / 200)
    setResult({ qzd: parseFloat(qzd.toFixed(2)), qnh: parseFloat(qnh.toFixed(2)) })
    setCalculated(true)
  }

  const handleReset = () => {
    setH("")
    setResult(null)
    setCalculated(false)
  }

  const getExportData = () => ({
    title: "Нормативные утечки воздуха через надшахтное здание",
    formula: "Q_ут.зд = Q_ут.н × √(h / 200)",
    inputs: [
      { label: "Тип ствола", value: shaftType === "skip" ? "Скиповый" : "Клетевой", unit: "" },
      { label: "Площадь наружных стен", value: rows[areaIdx].area, unit: "м²" },
      { label: "Депрессия участка (h)", value: h, unit: "даПа" },
    ],
    results: result ? [
      { label: "Нормативные утечки Q_ут.зд", value: String(result.qzd), unit: "м³/мин" },
    ] : [],
  })

  const isReady = h && parseFloat(h) > 0 && selected.qn !== null

  return (
    <div className="grid gap-10 md:grid-cols-2 md:gap-16 lg:gap-24">
      <div>
        <div className="mb-6 rounded-xl border border-foreground/10 bg-foreground/5 p-5 backdrop-blur-sm md:p-8">
          <p className="mb-3 font-mono text-xs text-foreground/50 uppercase tracking-widest">Формула</p>
          <p className="font-mono text-xl text-foreground md:text-2xl">Q_ут.зд = Q_ут.н × √(h / 200)</p>
        </div>
        <div className="space-y-3 text-sm text-foreground/70 md:text-base">
          <div className="flex items-start gap-3">
            <span className="mt-1 font-mono text-xs text-foreground/40 shrink-0">Q_ут.зд</span>
            <span>Нормативные утечки через надшахтное здание, м³/мин</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-1 font-mono text-xs text-foreground/40 shrink-0">Q_ут.н</span>
            <span>Нормативные утечки (из таблицы 8.4), м³/мин</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-1 font-mono text-xs text-foreground/40 shrink-0">h</span>
            <span>Потеря депрессии на данном участке, даПа</span>
          </div>
        </div>

        <div className="mt-6">
          <p className="mb-3 font-mono text-xs text-foreground/40 uppercase tracking-widest">Табл. 8.4 — Нормы утечек (м³/мин)</p>
          <div className="overflow-x-auto rounded-lg border border-foreground/10">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-foreground/10 bg-foreground/5">
                  <th className="px-3 py-2 text-left text-foreground/50">Площадь стен, м²</th>
                  <th className="px-3 py-2 text-center text-foreground/50">Скиповый Q_н</th>
                  <th className="px-3 py-2 text-center text-foreground/50">Клетевой Q_н</th>
                </tr>
              </thead>
              <tbody>
                {SHAFT_TABLE.cage.map((row, i) => (
                  <tr key={i} className="border-b border-foreground/5 last:border-0">
                    <td className="px-3 py-2 text-foreground/70">{row.area}</td>
                    <td className="px-3 py-2 text-center text-foreground/50">{SHAFT_TABLE.skip[i].qn ?? "—"}</td>
                    <td className="px-3 py-2 text-center text-foreground/70">{row.qn ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <label className="mb-2 block font-mono text-xs text-foreground/60">Тип ствола</label>
          <div className="flex gap-2">
            {([["cage", "Клетевой"], ["skip", "Скиповый"]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => { setShaftType(key); setCalculated(false); setResult(null) }}
                className={`rounded-lg border px-4 py-2 font-sans text-sm transition-all ${
                  shaftType === key
                    ? "border-foreground bg-foreground text-background"
                    : "border-foreground/20 text-foreground/60 hover:border-foreground/40 hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block font-mono text-xs text-foreground/60">Площадь наружных стен и перекрытий, м²</label>
          <div className="flex flex-col gap-2">
            {rows.map((row, i) => (
              <button
                key={i}
                onClick={() => { setAreaIdx(i); setCalculated(false); setResult(null) }}
                disabled={row.qn === null}
                className={`flex items-center justify-between rounded-lg border px-4 py-2.5 font-sans text-sm transition-all disabled:cursor-not-allowed disabled:opacity-30 ${
                  areaIdx === i && row.qn !== null
                    ? "border-foreground bg-foreground text-background"
                    : "border-foreground/15 text-foreground/60 hover:border-foreground/35 hover:text-foreground"
                }`}
              >
                <span>{row.area}</span>
                {row.qn !== null && (
                  <span className={`font-mono text-xs ${areaIdx === i ? "text-background/60" : "text-foreground/35"}`}>
                    Q_н = {row.qn} м³/мин
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block font-mono text-xs text-foreground/60">Депрессия участка — h, даПа</label>
          <input
            type="number"
            value={h}
            onChange={(e) => { setH(e.target.value); setCalculated(false) }}
            min="0"
            step="any"
            placeholder="Например: 200"
            className="w-full border-b border-foreground/30 bg-transparent py-2 text-lg text-foreground placeholder:text-foreground/30 focus:border-foreground/60 focus:outline-none md:text-xl"
          />
        </div>

        <VentCalcButton onClick={handleCalculate} disabled={!isReady} calculated={calculated} onReset={handleReset} />

        {result !== null && (
          <div className="rounded-xl border border-foreground/20 bg-foreground/5 p-5 backdrop-blur-sm transition-all duration-500 md:p-6">
            <p className="mb-3 font-mono text-xs text-foreground/50 uppercase tracking-widest">Результат</p>
            <div className="mb-3">
              <p className="font-mono text-xs text-foreground/40 mb-1">Нормативные утечки Q_ут.зд</p>
              <p className="font-sans text-4xl font-light text-foreground md:text-5xl">
                {result.qzd} <span className="text-xl text-foreground/60">м³/мин</span>
              </p>
            </div>
            <div className="border-t border-foreground/10 pt-3">
              <p className="font-mono text-xs text-foreground/40 mb-1">В единицах м³/с</p>
              <p className="font-sans text-2xl font-light text-foreground">
                {parseFloat((result.qzd / 60).toFixed(4))} <span className="text-base text-foreground/60">м³/с</span>
              </p>
            </div>
            <VentExportButtons onWord={() => exportToWord(getExportData())} onExcel={() => exportToExcel(getExportData())} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Типы крепи для расчёта удельного сопротивления ────────────────────────
const SUPPORT_TYPES = [
  "арка",
  "арка в конв. выработке",
  "бетон",
  "анкер",
  "арка мет.",
  "дерево",
  "арка К",
] as const
type SupportType = typeof SUPPORT_TYPES[number]

// Формулы удельного сопротивления α по типу крепи и сечению S [м²]
// Источник: Excel-таблица депрессионных съёмок (регрессионные зависимости)
function calcAlpha(support: SupportType, S: number): number {
  if (S <= 0) return 0
  switch (support) {
    case "арка":
    case "арка в конв. выработке":
      return Math.exp(-9.8053 / Math.exp(S) - 2.6883 * Math.log(S))
    case "бетон":
      return Math.exp(0.0019447 * S * S - 2.6884 * Math.log(S) - 1.38572)
    case "анкер":
      return Math.exp(-2.49732 * Math.log(S) - 0.96753)
    case "арка мет.":
      return Math.exp(-2.56606 * Math.log(S) - 1.80092 / S)
    case "дерево":
      return Math.exp(0.00080658 * S * S - 2.63061 * Math.log(S))
    case "арка К":
      return Math.exp(-2.40673 * Math.log(S) - 0.17437)
    default:
      return 0
  }
}

// Периметр эквивалентного сечения (для арки: П ≈ 4.4 * sqrt(S))
// В Excel используется реальный периметр из таблицы — здесь принимаем расчётный
function calcPerimeter(S: number, width: number, height: number): number {
  // Для прямоугольного сечения: П = 2*(ш+в); для арки берём из ширины/высоты
  if (width > 0 && height > 0) return 2 * (width + height)
  return 4.4 * Math.sqrt(S)
}

interface GeoRow {
  id: number
  name: string
  width: string
  height: string
  length: string
  support: SupportType
  correction: string  // поправка (0 = нет)
  // вычисленные
  S: number          // сечение, м²  = ширина * высота (приближение)
  Scorr: number      // скорректированное сечение
  speed: number      // скорость, м/с (если задан расход)
  Q: number          // расход, м³/мин
  alpha: number      // удельное сопротивление, кг/м³
  perimeter: number  // периметр, м
  R_spec: number     // удельное сопр. = (alpha * P) / S³  — на метр длины
  R_geo: number      // геометрическое сопр. = R_spec * L / 100, кМюрг
  R: number          // расчётное = (alpha * P * L / S³) / 100
}

function calcRow(row: Omit<GeoRow, "S"|"Scorr"|"speed"|"Q"|"alpha"|"perimeter"|"R_spec"|"R_geo"|"R">): GeoRow {
  const w = parseFloat(row.width.replace(",",".")) || 0
  const h = parseFloat(row.height.replace(",",".")) || 0
  const L = parseFloat(row.length.replace(",",".")) || 0
  const corr = parseFloat(row.correction.replace(",",".")) || 0

  // Сечение: для арки S ≈ 0.8 * ширина * высота, для прямоугольника = ш * в
  const isArch = row.support.startsWith("арка")
  const S_raw = isArch ? 0.8 * w * h : w * h
  const S = S_raw > 0 ? S_raw : 0.001
  const Scorr = Math.max(S + corr, 0.001)

  const alpha = calcAlpha(row.support, Scorr)
  const perimeter = calcPerimeter(Scorr, w, h)

  // R [кМюрг] = α * P * L / S³  (единицы: кг·с²/м⁸)
  // Из Excel: R = (α * P / S³) / 100 * L  → делим /100 для перевода в кМюрг
  const R_spec = (alpha * perimeter) / Math.pow(Scorr, 3)      // уд. сопр., кг/м
  const R_geo  = (alpha * perimeter * L) / (Math.pow(Scorr, 3) * 100)  // кМюрг (геом.)
  const R      = R_geo  // итоговое (без местных)

  return { ...row, S, Scorr, speed: 0, Q: 0, alpha, perimeter, R_spec, R_geo, R }
}

function fmt4(n: number) { return n.toLocaleString("ru-RU", { minimumFractionDigits: 4, maximumFractionDigits: 4 }) }
function fmt6(n: number) { return n.toLocaleString("ru-RU", { minimumFractionDigits: 6, maximumFractionDigits: 6 }) }
function fmt2(n: number) { return n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

let rowSeq = 1

export function GeometryResistanceCalculator() {
  const [rows, setRows] = useState<(Omit<GeoRow,"S"|"Scorr"|"speed"|"Q"|"alpha"|"perimeter"|"R_spec"|"R_geo"|"R"> & { id: number })[]>([
    { id: rowSeq++, name: "Штрек №1", width: "4.00", height: "4.20", length: "80", support: "анкер", correction: "0.00" },
  ])
  const [calculated, setCalculated] = useState(false)
  const [calcRows, setCalcRows] = useState<GeoRow[]>([])

  const addRow = () => {
    setRows(prev => [...prev, {
      id: rowSeq++,
      name: `Выработка ${prev.length + 1}`,
      width: "4.00", height: "4.20", length: "80",
      support: "анкер", correction: "0.00",
    }])
    setCalculated(false)
  }

  const removeRow = (id: number) => {
    setRows(prev => prev.filter(r => r.id !== id))
    setCalculated(false)
  }

  const updateRow = (id: number, field: string, value: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
    setCalculated(false)
  }

  const handleCalculate = () => {
    const result = rows.map(r => calcRow(r))
    setCalcRows(result)
    setCalculated(true)
  }

  const handleReset = () => {
    setCalcRows([])
    setCalculated(false)
  }

  const totalR = calcRows.reduce((s, r) => s + r.R, 0)

  return (
    <div className="space-y-8">
      {/* Пояснение формул */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-4">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-foreground/40">Удельное сопротивление</p>
          <p className="font-mono text-sm text-foreground">α = f(тип крепи, S)</p>
          <p className="mt-1 font-mono text-[10px] text-foreground/40">регрессионная зависимость от сечения</p>
        </div>
        <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-4">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-foreground/40">Геом. сопротивление</p>
          <p className="font-mono text-sm text-foreground">R_г = α·P·L / S³</p>
          <p className="mt-1 font-mono text-[10px] text-foreground/40">P — периметр, L — длина, S — сечение</p>
        </div>
        <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-4">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-foreground/40">Итог, кМюрг</p>
          <p className="font-mono text-sm text-foreground">R = R_г / 100</p>
          <p className="mt-1 font-mono text-[10px] text-foreground/40">1 кМюрг = 9.81 Н·с²/м⁸</p>
        </div>
      </div>

      {/* Таблица ввода */}
      <div className="overflow-x-auto rounded-xl border border-foreground/15">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-foreground/10 bg-foreground/8">
              <th className="px-3 py-2.5 text-left font-mono text-[10px] uppercase tracking-widest text-foreground/40 min-w-[140px]">Наименование</th>
              <th className="px-3 py-2.5 text-center font-mono text-[10px] uppercase tracking-widest text-foreground/40">Ширина, м</th>
              <th className="px-3 py-2.5 text-center font-mono text-[10px] uppercase tracking-widest text-foreground/40">Высота, м</th>
              <th className="px-3 py-2.5 text-center font-mono text-[10px] uppercase tracking-widest text-foreground/40">Длина, м</th>
              <th className="px-3 py-2.5 text-center font-mono text-[10px] uppercase tracking-widest text-foreground/40 min-w-[160px]">Тип крепи</th>
              <th className="px-3 py-2.5 text-center font-mono text-[10px] uppercase tracking-widest text-foreground/40">Поправка S</th>
              <th className="px-2 py-2.5 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-foreground/5 last:border-0 hover:bg-foreground/3">
                <td className="px-2 py-1.5">
                  <input value={row.name} onChange={e => updateRow(row.id, "name", e.target.value)}
                    className="w-full bg-transparent text-foreground/80 outline-none text-xs" />
                </td>
                <td className="px-2 py-1.5">
                  <input value={row.width} onChange={e => updateRow(row.id, "width", e.target.value)}
                    type="number" step="0.1" min="0"
                    className="w-16 rounded border border-green-500/30 bg-green-500/8 px-1.5 py-0.5 text-center font-mono text-xs text-foreground outline-none focus:border-green-500/50" />
                </td>
                <td className="px-2 py-1.5">
                  <input value={row.height} onChange={e => updateRow(row.id, "height", e.target.value)}
                    type="number" step="0.1" min="0"
                    className="w-16 rounded border border-green-500/30 bg-green-500/8 px-1.5 py-0.5 text-center font-mono text-xs text-foreground outline-none focus:border-green-500/50" />
                </td>
                <td className="px-2 py-1.5">
                  <input value={row.length} onChange={e => updateRow(row.id, "length", e.target.value)}
                    type="number" step="1" min="0"
                    className="w-20 rounded border border-green-500/30 bg-green-500/8 px-1.5 py-0.5 text-center font-mono text-xs text-foreground outline-none focus:border-green-500/50" />
                </td>
                <td className="px-2 py-1.5">
                  <select value={row.support} onChange={e => updateRow(row.id, "support", e.target.value as SupportType)}
                    className="w-full rounded border border-foreground/20 bg-background px-2 py-0.5 font-mono text-xs text-foreground outline-none focus:border-foreground/40">
                    {SUPPORT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <input value={row.correction} onChange={e => updateRow(row.id, "correction", e.target.value)}
                    type="number" step="0.1"
                    className="w-16 rounded border border-foreground/20 bg-transparent px-1.5 py-0.5 text-center font-mono text-xs text-foreground outline-none focus:border-foreground/40" />
                </td>
                <td className="px-2 py-1.5">
                  {rows.length > 1 && (
                    <button onClick={() => removeRow(row.id)}
                      className="text-foreground/20 hover:text-red-400 transition-colors text-base leading-none">×</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-3">
        <button onClick={addRow}
          className="flex items-center gap-2 rounded-lg border border-foreground/20 px-4 py-2 font-mono text-xs text-foreground/60 transition-all hover:border-foreground/40 hover:text-foreground">
          + Добавить выработку
        </button>
        <button onClick={calculated ? handleReset : handleCalculate}
          className={`rounded-lg border px-6 py-2 font-mono text-sm transition-all ${
            calculated
              ? "border-foreground/20 text-foreground/50 hover:border-red-500/40 hover:text-red-400"
              : "border-foreground bg-foreground text-background hover:bg-foreground/90"
          }`}>
          {calculated ? "Сбросить" : "Рассчитать"}
        </button>
      </div>

      {/* Таблица результатов */}
      {calculated && calcRows.length > 0 && (
        <div className="space-y-4">
          <p className="font-mono text-xs uppercase tracking-widest text-foreground/40">Результаты расчёта</p>
          <div className="overflow-x-auto rounded-xl border border-foreground/15">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-foreground/10 bg-foreground/8">
                  <th className="px-3 py-2.5 text-left font-mono text-[10px] uppercase tracking-widest text-foreground/40">Наименование</th>
                  <th className="px-3 py-2.5 text-center font-mono text-[10px] uppercase tracking-widest text-foreground/40">S, м²</th>
                  <th className="px-3 py-2.5 text-center font-mono text-[10px] uppercase tracking-widest text-foreground/40">П, м</th>
                  <th className="px-3 py-2.5 text-center font-mono text-[10px] uppercase tracking-widest text-foreground/40">α·10⁴</th>
                  <th className="px-3 py-2.5 text-center font-mono text-[10px] uppercase tracking-widest text-foreground/40">Уд. сопр., кг/м</th>
                  <th className="px-3 py-2.5 text-center font-mono text-[10px] uppercase tracking-widest text-foreground/40 bg-blue-500/5">R, кМюрг</th>
                </tr>
              </thead>
              <tbody>
                {calcRows.map(r => (
                  <tr key={r.id} className="border-b border-foreground/5 last:border-0 hover:bg-foreground/3">
                    <td className="px-3 py-2 font-sans text-xs text-foreground/80">{r.name}</td>
                    <td className="px-3 py-2 text-center font-mono text-foreground/70">{fmt2(r.Scorr)}</td>
                    <td className="px-3 py-2 text-center font-mono text-foreground/70">{fmt2(r.perimeter)}</td>
                    <td className="px-3 py-2 text-center font-mono text-foreground/70">{(r.alpha * 10000).toFixed(4)}</td>
                    <td className="px-3 py-2 text-center font-mono text-foreground/70">{fmt6(r.R_spec)}</td>
                    <td className="px-3 py-2 text-center font-mono font-bold text-foreground bg-blue-500/5">{fmt6(r.R)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-foreground/20 bg-foreground/8">
                  <td colSpan={5} className="px-3 py-2.5 font-mono text-xs text-foreground/50 text-right">Суммарное сопротивление (последовательное соединение):</td>
                  <td className="px-3 py-2.5 text-center font-mono text-base font-bold text-foreground">{fmt6(totalR)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Визуальная шкала */}
          <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-4">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-foreground/40">Оценка уровня сопротивления</p>
            <div className="space-y-2">
              {calcRows.map(r => {
                const pct = Math.min(r.R / 2.0 * 100, 100)
                const color = r.R < 0.1 ? "bg-green-500/60" : r.R < 1.0 ? "bg-blue-500/60" : r.R < 5.0 ? "bg-amber-500/60" : "bg-red-500/60"
                return (
                  <div key={r.id}>
                    <div className="mb-1 flex justify-between font-mono text-[10px] text-foreground/50">
                      <span>{r.name}</span>
                      <span>{fmt6(r.R)} кМюрг</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-foreground/10">
                      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 flex gap-4 font-mono text-[9px] text-foreground/30">
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-full bg-green-500/60" /> &lt;0.1 малое</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-full bg-blue-500/60" /> 0.1–1.0 среднее</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-full bg-amber-500/60" /> 1.0–5.0 высокое</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-full bg-red-500/60" /> &gt;5.0 очень высокое</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}