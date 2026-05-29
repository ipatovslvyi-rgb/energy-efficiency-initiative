import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { GrainOverlay } from "@/components/grain-overlay"
import Icon from "@/components/ui/icon"

interface Material {
  id: string
  name: string
  density: number
  mass: number
  burnRate: number
  heatValue: number
}

const DEFAULT_MATERIALS: Material[] = [
  { id: "rubber", name: "Резина",  density: 1200, mass: 1200, burnRate: 0.02,  heatValue: 33.5 },
  { id: "diesel", name: "Дизель",  density: 830,  mass: 400,  burnRate: 0.043, heatValue: 42.6 },
  { id: "oil",    name: "Масло",   density: 900,  mass: 200,  burnRate: 0.043, heatValue: 41.8 },
]

const PRESET_MATERIALS = [
  { name: "Резина",                    density: 1200, burnRate: 0.02,  heatValue: 33.5 },
  { name: "Дизельное топливо",         density: 830,  burnRate: 0.043, heatValue: 42.6 },
  { name: "Масло моторное",            density: 900,  burnRate: 0.043, heatValue: 41.8 },
  { name: "Масло трансформаторное",    density: 900,  burnRate: 0.043, heatValue: 43.1 },
  { name: "Бензин",                    density: 700,  burnRate: 0.06,  heatValue: 44.0 },
  { name: "Пластик",                   density: 1100, burnRate: 0.015, heatValue: 33.6 },
  { name: "Древесина",                 density: 600,  burnRate: 0.039, heatValue: 13.8 },
  { name: "Кабель ПВХ",               density: 1400, burnRate: 0.007, heatValue: 25.0 },
]

let nextId = 4

function fmt(n: number, digits = 2) {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function calcResults(materials: Material[]) {
  if (materials.length === 0) return null
  const maxDensity = Math.max(...materials.map(m => m.density))

  // Q[МВт] = Σ( m_i/ρ_max * ψ_i[кг/(м²с)] * Q_н_i[МДж/кг] )
  // τ[ч]   = Σ(m_i/ρ_max) / Σ(ψ_i) / 3600
  let powerMW = 0
  let rateHeatSum = 0

  for (const m of materials) {
    const S = m.mass / maxDensity
    powerMW    += S * m.burnRate * m.heatValue
    rateHeatSum += m.burnRate * m.heatValue
  }

  const totalArea     = materials.reduce((s, m) => s + m.mass / maxDensity, 0)
  const totalBurnRate = materials.reduce((s, m) => s + m.burnRate, 0)
  const timeH  = totalBurnRate > 0 ? totalArea / totalBurnRate / 3600 : 0
  const timeMin = timeH * 60

  return { powerMW, timeH, timeMin, maxDensity, rateHeatSum, totalArea }
}

// Расчётная температура горения техники
// Δt = Q[Вт] / (L[м³/с] * 1.25[кг/м³] * 1005[Дж/(кг·К)])
function calcDeltaT(powerMW: number, flowM3s: number) {
  if (!powerMW || !flowM3s) return null
  return powerMW * 1_000_000 / (flowM3s * 1.25 * 1005)
}

// Редактируемая ячейка (зелёная для изменяемых значений)
function EditCell({
  value, onChange, isGreen = false, bold = false, italic = false, unit = ""
}: {
  value: number | string
  onChange: (v: string) => void
  isGreen?: boolean
  bold?: boolean
  italic?: boolean
  unit?: string
}) {
  return (
    <td className={`border border-foreground/25 px-3 py-2 text-center text-sm ${isGreen ? "bg-green-500/15" : ""}`}>
      <input
        type="text"
        value={typeof value === "number" ? String(value).replace(".", ",") : value}
        onChange={e => onChange(e.target.value)}
        className={`w-full bg-transparent text-center outline-none
          ${bold ? "font-bold" : ""}
          ${italic ? "italic" : ""}
          ${isGreen ? "text-foreground" : "text-foreground/80"}
        `}
      />
      {unit && <span className="text-xs text-foreground/40 ml-0.5">{unit}</span>}
    </td>
  )
}

function ReadCell({ children, bold = false, italic = false, className = "" }: {
  children: React.ReactNode; bold?: boolean; italic?: boolean; className?: string
}) {
  return (
    <td className={`border border-foreground/25 px-3 py-2 text-center text-sm text-foreground/80
      ${bold ? "font-bold" : ""} ${italic ? "italic" : ""} ${className}`}>
      {children}
    </td>
  )
}

export default function FireLoad() {
  const navigate = useNavigate()
  const [machineName, setMachineName] = useState("ТН-545")
  const [materials, setMaterials] = useState<Material[]>(DEFAULT_MATERIALS)
  const [flowM3s, setFlowM3s] = useState<string>("39,6")
  const [performer, setPerformer] = useState("")
  const [showPresets, setShowPresets] = useState(false)

  const results = calcResults(materials)
  const flowNum = parseFloat(flowM3s.replace(",", "."))
  const deltaT = results ? calcDeltaT(results.powerMW, flowNum) : null

  function updateMaterial(id: string, field: keyof Material, raw: string) {
    setMaterials(prev => prev.map(m => {
      if (m.id !== id) return m
      if (field === "name") return { ...m, name: raw }
      const num = parseFloat(raw.replace(",", "."))
      return { ...m, [field]: isNaN(num) ? 0 : num }
    }))
  }

  function removeMaterial(id: string) {
    setMaterials(prev => prev.filter(m => m.id !== id))
  }

  function addPreset(p: typeof PRESET_MATERIALS[0]) {
    setMaterials(prev => [...prev, { id: String(nextId++), name: p.name, density: p.density, mass: 0, burnRate: p.burnRate, heatValue: p.heatValue }])
    setShowPresets(false)
  }

  function addCustom() {
    setMaterials(prev => [...prev, { id: String(nextId++), name: "Материал", density: 1000, mass: 0, burnRate: 0.02, heatValue: 30 }])
  }

  const maxDensity = materials.length > 0 ? Math.max(...materials.map(m => m.density)) : 0

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <GrainOverlay />

      {/* Шапка */}
      <div className="sticky top-0 z-40 border-b border-foreground/10 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3 md:px-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 rounded-lg border border-foreground/20 px-3 py-1.5 text-sm text-foreground/70 transition-all hover:border-foreground/40 hover:text-foreground"
            >
              <Icon name="ArrowLeft" size={14} />
              Назад
            </button>
            <div>
              <h1 className="font-sans text-base font-medium text-foreground">Пожарная нагрузка</h1>
              <p className="font-mono text-xs text-foreground/40">Расчёт мощности пожара техники</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPresets(v => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 font-mono text-xs text-blue-400 transition-all hover:bg-blue-500/20"
            >
              <Icon name="Plus" size={12} />
              Добавить материал
            </button>
          </div>
        </div>
      </div>

      {/* Пресеты */}
      {showPresets && (
        <div className="border-b border-foreground/10 bg-background/95 backdrop-blur-md">
          <div className="mx-auto max-w-5xl px-6 py-4 md:px-10">
            <p className="mb-2 font-mono text-xs text-foreground/40 uppercase tracking-widest">Выберите из справочника или добавьте вручную</p>
            <div className="flex flex-wrap gap-2">
              {PRESET_MATERIALS.map(p => (
                <button key={p.name} onClick={() => addPreset(p)}
                  className="rounded-lg border border-foreground/15 bg-foreground/5 px-3 py-1.5 text-left text-xs text-foreground/70 transition-all hover:border-foreground/30 hover:text-foreground">
                  <span className="font-medium">{p.name}</span>
                  <span className="ml-2 text-foreground/40">{p.heatValue} МДж/кг</span>
                </button>
              ))}
              <button onClick={() => { addCustom(); setShowPresets(false) }}
                className="rounded-lg border border-dashed border-foreground/20 px-3 py-1.5 text-xs text-foreground/50 hover:text-foreground transition-all">
                + Свой
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Документ */}
      <div className="mx-auto max-w-5xl px-6 py-8 md:px-10">

        {/* Приложение №1 — шапка документа */}
        <div className="mb-8 rounded-2xl border border-foreground/10 bg-foreground/3 px-8 py-8">
          <p className="mb-6 text-right font-sans text-sm text-foreground/50">Приложение №1</p>
          <h2 className="mb-8 text-center font-sans text-xl font-bold text-foreground">
            Расчет мощности пожара техники
          </h2>

          <p className="mb-4 font-sans text-sm font-bold text-foreground">Исходные данные для выполнения расчета:</p>

          {/* Основная таблица */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm" style={{ minWidth: 520 }}>
              <thead>
                {/* Строка: Техника / название */}
                <tr>
                  <td className="border border-foreground/25 px-3 py-2 text-center font-bold italic text-foreground/80 w-48">
                    Техника
                  </td>
                  <td className="border border-foreground/25 px-3 py-2 text-center italic text-foreground/70" colSpan={materials.length}>
                    <input
                      type="text"
                      value={machineName}
                      onChange={e => setMachineName(e.target.value)}
                      className="w-full bg-transparent text-center italic text-foreground/80 outline-none"
                    />
                  </td>
                  <td className="border border-foreground/25 px-2 py-2 w-24"></td>
                </tr>
                {/* Строка: Материал / названия */}
                <tr className="bg-foreground/5">
                  <td className="border border-foreground/25 px-3 py-2 text-center font-bold text-foreground/80">
                    Материал
                  </td>
                  {materials.map(m => (
                    <td key={m.id} className="border border-foreground/25 px-3 py-2 text-center font-bold text-foreground/80 min-w-[110px]">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="text"
                          value={m.name}
                          onChange={e => updateMaterial(m.id, "name", e.target.value)}
                          className="w-full bg-transparent text-center font-bold text-foreground/80 outline-none"
                        />
                        {materials.length > 1 && (
                          <button onClick={() => removeMaterial(m.id)}
                            className="shrink-0 text-foreground/20 hover:text-red-400 transition-colors">
                            <Icon name="X" size={10} />
                          </button>
                        )}
                      </div>
                    </td>
                  ))}
                  <td className="border border-foreground/25 px-2 py-2 text-center font-bold text-foreground/60 text-xs">
                    Ед. изм.
                  </td>
                </tr>
              </thead>
              <tbody>
                {/* Плотность */}
                <tr>
                  <td className="border border-foreground/25 px-3 py-2 italic text-foreground/70">Плотность</td>
                  {materials.map(m => (
                    <EditCell key={m.id} value={m.density} italic
                      isGreen={false}
                      onChange={v => updateMaterial(m.id, "density", v)} />
                  ))}
                  <td className="border border-foreground/25 px-2 py-2 text-center text-xs italic text-foreground/50">
                    кг/м³
                  </td>
                </tr>
                {/* Масса — зелёная, изменяемая */}
                <tr className="bg-foreground/3">
                  <td className="border border-foreground/25 px-3 py-2 font-bold text-foreground/80">Масса</td>
                  {materials.map(m => (
                    <EditCell key={m.id} value={m.mass} bold isGreen
                      onChange={v => updateMaterial(m.id, "mass", v)} />
                  ))}
                  <td className="border border-foreground/25 px-2 py-2 text-center text-xs italic text-foreground/50">кг</td>
                </tr>
                {/* Скорость выгорания */}
                <tr>
                  <td className="border border-foreground/25 px-3 py-2 text-foreground/70">Скорость выгорания</td>
                  {materials.map(m => (
                    <EditCell key={m.id} value={m.burnRate}
                      onChange={v => updateMaterial(m.id, "burnRate", v)} />
                  ))}
                  <td className="border border-foreground/25 px-2 py-2 text-center text-xs italic text-foreground/50">
                    кг/(м²·с)
                  </td>
                </tr>
                {/* Низшая теплота */}
                <tr className="bg-foreground/3">
                  <td className="border border-foreground/25 px-3 py-2 text-foreground/70">Низшая теплота сгорания</td>
                  {materials.map(m => (
                    <EditCell key={m.id} value={m.heatValue}
                      onChange={v => updateMaterial(m.id, "heatValue", v)} />
                  ))}
                  <td className="border border-foreground/25 px-2 py-2 text-center text-xs italic text-foreground/50">МДж/кг</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Результаты справа — как в Excel */}
          {results && (
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-8">
              <div className="flex items-center gap-3">
                <span className="font-sans text-sm text-foreground/70">Мощность:</span>
                <div className="rounded border-2 border-foreground/40 bg-foreground/5 px-4 py-1.5 min-w-[80px] text-center">
                  <span className="font-bold italic text-foreground text-lg">
                    {fmt(results.powerMW)}
                  </span>
                </div>
                <span className="italic text-sm text-foreground/60">МВт</span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-sans text-sm text-foreground/70">Время:</span>
                <div className="rounded border-2 border-foreground/40 bg-foreground/5 px-4 py-1.5 min-w-[80px] text-center">
                  <span className="font-bold italic text-foreground text-lg">
                    {fmt(results.timeH)}
                  </span>
                </div>
                <span className="italic text-sm text-foreground/60">Часов</span>
                <span className="text-sm text-foreground/40">или</span>
                <div className="rounded border-2 border-foreground/40 bg-foreground/5 px-4 py-1.5 min-w-[80px] text-center">
                  <span className="font-bold italic text-foreground text-lg">
                    {fmt(results.timeMin, 1)}
                  </span>
                </div>
                <span className="italic text-sm text-foreground/60">мин</span>
              </div>
            </div>
          )}

          {/* Расчётная температура горения */}
          {results && (
            <div className="mt-8">
              <p className="mb-3 text-center font-sans text-sm font-bold text-foreground/80">
                Расчетная температура горения техники
              </p>
              <table className="border-collapse text-sm">
                <thead>
                  <tr className="bg-green-500/15">
                    <td className="border border-foreground/25 px-4 py-2 text-center font-bold text-foreground/80">
                      Мощность, мВт
                    </td>
                    <td className="border border-foreground/25 px-4 py-2 text-center font-bold text-foreground/80">
                      Расход,<br />м³/с
                    </td>
                    <td className="border border-foreground/25 px-4 py-2 text-center font-bold text-foreground/80">
                      Δt, °C
                    </td>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <ReadCell>{fmt(results.powerMW)}</ReadCell>
                    <td className="border border-foreground/25 px-3 py-2 text-center bg-green-500/15">
                      <input
                        type="text"
                        value={flowM3s}
                        onChange={e => setFlowM3s(e.target.value)}
                        className="w-20 bg-transparent text-center text-sm text-foreground/80 outline-none"
                        placeholder="0"
                      />
                    </td>
                    <ReadCell bold>
                      {deltaT !== null ? fmt(deltaT, 1) : "—"}
                    </ReadCell>
                  </tr>
                </tbody>
              </table>
              <p className="mt-1 font-mono text-[10px] text-foreground/30">
                Δt = Q·10⁶ / (L · 1,25 · 1005), где L — расход воздуха в выработке, м³/с
              </p>
            </div>
          )}

          {/* Вывод */}
          {results && (
            <div className="mt-6">
              <p className="font-sans text-sm text-foreground/70 leading-relaxed">
                Для расчета устойчивости вентиляционного режима при возникновении пожара, принимаем максимальную величину мощности пожара{" "}
                <span className="inline-flex items-center gap-1">
                  <span className="rounded border border-foreground/30 bg-foreground/8 px-2 py-0.5 font-bold text-foreground">
                    {fmt(results.powerMW)}
                  </span>
                  {" "}МВт
                </span>
              </p>
              <div className="mt-4 flex items-center gap-2">
                <span className="font-sans text-sm text-foreground/70">Расчет выполнил:</span>
                <input
                  type="text"
                  value={performer}
                  onChange={e => setPerformer(e.target.value)}
                  placeholder="________________"
                  className="border-b border-foreground/30 bg-transparent px-2 py-0.5 text-sm text-foreground/80 outline-none focus:border-foreground/60 w-48"
                />
              </div>
            </div>
          )}
        </div>

        {/* Легенда */}
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-foreground/8 bg-foreground/3 px-4 py-3">
          <Icon name="Info" size={14} className="mt-0.5 shrink-0 text-foreground/30" />
          <p className="font-mono text-xs text-foreground/40 leading-relaxed">
            <span className="inline-block h-3 w-4 rounded-sm bg-green-500/30 border border-green-500/40 mr-1 align-middle" />
            Зелёные ячейки — изменяемые величины. Все остальные значения рассчитываются автоматически при изменении данных.
          </p>
        </div>
      </div>
    </div>
  )
}