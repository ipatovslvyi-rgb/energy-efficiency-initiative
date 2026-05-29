import { useState, useRef } from "react"
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
  { id: "rubber",  name: "Резина",  density: 1200, mass: 1200, burnRate: 0.02,  heatValue: 33.5 },
  { id: "diesel",  name: "Дизель",  density: 830,  mass: 400,  burnRate: 0.043, heatValue: 42.6 },
  { id: "oil",     name: "Масло",   density: 900,  mass: 200,  burnRate: 0.043, heatValue: 41.8 },
]

const PRESET_MATERIALS = [
  { name: "Резина",              density: 1100, burnRate: 0.018, heatValue: 33.5 },
  { name: "Дизельное топливо",   density: 830,  burnRate: 0.043, heatValue: 42.6 },
  { name: "Масло моторное",      density: 900,  burnRate: 0.043, heatValue: 41.8 },
  { name: "Масло трансформаторное", density: 900, burnRate: 0.043, heatValue: 43.1 },
  { name: "Бензин",              density: 700,  burnRate: 0.06,  heatValue: 44.0 },
  { name: "Пластик",             density: 1100, burnRate: 0.015, heatValue: 33.6 },
  { name: "Древесина",           density: 600,  burnRate: 0.039, heatValue: 13.8 },
  { name: "Кабель ПВХ",          density: 1400, burnRate: 0.007, heatValue: 25.0 },
]

function calcResults(materials: Material[]) {
  if (materials.length === 0) return null

  const maxDensity = Math.max(...materials.map(m => m.density))

  let powerSum = 0
  let rateHeatSum = 0

  for (const m of materials) {
    const S = m.mass / maxDensity
    powerSum += (m.mass / maxDensity) * m.burnRate * m.heatValue * 1000
    rateHeatSum += m.burnRate * m.heatValue * 1000
  }

  const powerMW = powerSum / 1000000
  const timeH = powerMW / (rateHeatSum / 1000000)
  const timeMin = timeH * 60
  const flowM3s = rateHeatSum / (1000 * 1.2 * 1.005 * 171.3)

  return {
    powerMW: +powerMW.toFixed(2),
    timeH: +timeH.toFixed(2),
    timeMin: +timeMin.toFixed(1),
    maxDensity,
  }
}

let nextId = 4

export default function FireLoad() {
  const navigate = useNavigate()
  const [machineName, setMachineName] = useState("ТН-545")
  const [materials, setMaterials] = useState<Material[]>(DEFAULT_MATERIALS)
  const [addingPreset, setAddingPreset] = useState(false)

  const results = calcResults(materials)

  function updateMaterial(id: string, field: keyof Material, value: string) {
    setMaterials(prev => prev.map(m => {
      if (m.id !== id) return m
      if (field === "name") return { ...m, name: value }
      const num = parseFloat(value.replace(",", "."))
      return { ...m, [field]: isNaN(num) ? 0 : num }
    }))
  }

  function removeMaterial(id: string) {
    setMaterials(prev => prev.filter(m => m.id !== id))
  }

  function addMaterial() {
    setMaterials(prev => [...prev, {
      id: String(nextId++),
      name: "Новый материал",
      density: 1000,
      mass: 100,
      burnRate: 0.02,
      heatValue: 30,
    }])
  }

  function addPreset(preset: typeof PRESET_MATERIALS[0]) {
    setMaterials(prev => [...prev, {
      id: String(nextId++),
      name: preset.name,
      density: preset.density,
      mass: 0,
      burnRate: preset.burnRate,
      heatValue: preset.heatValue,
    }])
    setAddingPreset(false)
  }

  const maxDensity = materials.length > 0 ? Math.max(...materials.map(m => m.density)) : 0

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <GrainOverlay />

      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-foreground/10 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-4 md:px-12">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 rounded-lg border border-foreground/20 px-3 py-1.5 text-sm text-foreground/70 transition-all hover:border-foreground/40 hover:text-foreground"
          >
            <Icon name="ArrowLeft" size={14} />
            Назад
          </button>
          <div>
            <h1 className="font-sans text-lg font-light tracking-tight text-foreground">
              Пожарная нагрузка
            </h1>
            <p className="font-mono text-xs text-foreground/40">Расчёт мощности пожара техники</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8 md:px-12">

        {/* Результат — главный блок */}
        {results && (
          <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 px-6 py-5">
                <p className="mb-1 font-mono text-xs text-blue-400/70 uppercase tracking-widest">Мощность пожара</p>
                <p className="font-sans text-4xl font-light text-blue-300 tabular-nums">{results.powerMW}</p>
                <p className="mt-1 font-mono text-xs text-blue-400/50">МВт</p>
              </div>
              <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 px-6 py-5">
                <p className="mb-1 font-mono text-xs text-orange-400/70 uppercase tracking-widest">Время горения</p>
                <p className="font-sans text-4xl font-light text-orange-300 tabular-nums">{results.timeH}</p>
                <p className="mt-1 font-mono text-xs text-orange-400/50">часов</p>
              </div>
              <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 px-6 py-5">
                <p className="mb-1 font-mono text-xs text-foreground/40 uppercase tracking-widest">Время горения</p>
                <p className="font-sans text-4xl font-light text-foreground/80 tabular-nums">{results.timeMin}</p>
                <p className="mt-1 font-mono text-xs text-foreground/30">минут</p>
              </div>
              <div className="rounded-2xl border border-foreground/10 bg-foreground/5 px-6 py-5">
                <p className="mb-1 font-mono text-xs text-foreground/40 uppercase tracking-widest">Макс. плотность</p>
                <p className="font-sans text-4xl font-light text-foreground/80 tabular-nums">{results.maxDensity}</p>
                <p className="mt-1 font-mono text-xs text-foreground/30">кг/м³</p>
              </div>
            </div>
            <p className="mt-3 font-mono text-xs text-foreground/30">
              Для расчёта устойчивости вентиляционного режима при возникновении пожара принимаем максимальную величину мощности пожара <span className="text-foreground/60 font-semibold">{results.powerMW} МВт</span>
            </p>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-3">

          {/* Левая колонка — исходные данные */}
          <div className="lg:col-span-2">
            {/* Название техники */}
            <div className="mb-4 flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-foreground/20 bg-foreground/5 px-4 py-2">
                <p className="font-mono text-xs text-foreground/40">Техника:</p>
                <input
                  type="text"
                  value={machineName}
                  onChange={e => setMachineName(e.target.value)}
                  className="bg-transparent font-sans text-sm font-semibold text-foreground outline-none placeholder:text-foreground/30 w-32"
                  placeholder="Название"
                />
              </div>
            </div>

            {/* Таблица материалов */}
            <div className="overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/3">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="border-b border-foreground/10 bg-foreground/5">
                      <th className="px-4 py-3 text-left font-mono text-xs text-foreground/40 uppercase tracking-widest">Материал</th>
                      {materials.map(m => (
                        <th key={m.id} className="px-3 py-3 text-center font-mono text-xs text-foreground/60 uppercase tracking-widest min-w-[110px]">
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="text"
                              value={m.name}
                              onChange={e => updateMaterial(m.id, "name", e.target.value)}
                              className="bg-transparent text-center font-mono text-xs text-foreground/80 outline-none w-20"
                            />
                            <button onClick={() => removeMaterial(m.id)} className="text-foreground/20 hover:text-red-400 transition-colors">
                              <Icon name="X" size={10} />
                            </button>
                          </div>
                        </th>
                      ))}
                      <th className="px-3 py-3 text-left font-mono text-xs text-foreground/40 uppercase tracking-widest w-20">Ед. изм.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Плотность */}
                    <tr className="border-b border-foreground/8">
                      <td className="px-4 py-3 font-sans text-sm italic text-foreground/70">Плотность</td>
                      {materials.map(m => (
                        <td key={m.id} className={`px-3 py-3 text-center ${m.density === maxDensity && materials.length > 1 ? "text-blue-400 font-semibold" : "text-foreground/80 italic"}`}>
                          <input
                            type="text"
                            value={m.density}
                            onChange={e => updateMaterial(m.id, "density", e.target.value)}
                            className="bg-transparent text-center w-full outline-none font-sans text-sm"
                          />
                        </td>
                      ))}
                      <td className="px-3 py-3 font-mono text-xs text-foreground/40">кг/м³</td>
                    </tr>
                    {/* Масса */}
                    <tr className="border-b border-foreground/8 bg-foreground/3">
                      <td className="px-4 py-3 font-sans text-sm font-semibold text-foreground/80">Масса</td>
                      {materials.map(m => (
                        <td key={m.id} className="px-3 py-3 text-center">
                          <input
                            type="text"
                            value={m.mass}
                            onChange={e => updateMaterial(m.id, "mass", e.target.value)}
                            className="bg-transparent text-center w-full outline-none font-sans text-sm font-bold text-foreground/90"
                          />
                        </td>
                      ))}
                      <td className="px-3 py-3 font-mono text-xs text-foreground/40">кг</td>
                    </tr>
                    {/* Скорость выгорания */}
                    <tr className="border-b border-foreground/8">
                      <td className="px-4 py-3 font-sans text-sm italic text-foreground/70">Скорость выгорания</td>
                      {materials.map(m => (
                        <td key={m.id} className="px-3 py-3 text-center italic text-foreground/70">
                          <input
                            type="text"
                            value={m.burnRate}
                            onChange={e => updateMaterial(m.id, "burnRate", e.target.value)}
                            className="bg-transparent text-center w-full outline-none font-sans text-sm"
                          />
                        </td>
                      ))}
                      <td className="px-3 py-3 font-mono text-xs text-foreground/40">кг/(м²·с)</td>
                    </tr>
                    {/* Низшая теплота сгорания */}
                    <tr>
                      <td className="px-4 py-3 font-sans text-sm italic text-foreground/70">Низшая теплота сгорания</td>
                      {materials.map(m => (
                        <td key={m.id} className="px-3 py-3 text-center italic text-foreground/70">
                          <input
                            type="text"
                            value={m.heatValue}
                            onChange={e => updateMaterial(m.id, "heatValue", e.target.value)}
                            className="bg-transparent text-center w-full outline-none font-sans text-sm"
                          />
                        </td>
                      ))}
                      <td className="px-3 py-3 font-mono text-xs text-foreground/40">МДж/кг</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Добавить материал */}
              <div className="border-t border-foreground/10 p-3 flex gap-2">
                <button
                  onClick={addMaterial}
                  className="flex items-center gap-1.5 rounded-lg border border-foreground/20 px-3 py-1.5 font-mono text-xs text-foreground/60 transition-all hover:border-foreground/40 hover:text-foreground"
                >
                  <Icon name="Plus" size={12} />
                  Добавить
                </button>
                <button
                  onClick={() => setAddingPreset(v => !v)}
                  className="flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 font-mono text-xs text-blue-400 transition-all hover:bg-blue-500/20"
                >
                  <Icon name="Library" size={12} />
                  Из справочника
                </button>
              </div>

              {/* Пресеты */}
              {addingPreset && (
                <div className="border-t border-foreground/10 p-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {PRESET_MATERIALS.map(p => (
                    <button
                      key={p.name}
                      onClick={() => addPreset(p)}
                      className="rounded-lg border border-foreground/15 bg-foreground/5 px-3 py-2 text-left text-xs text-foreground/70 transition-all hover:border-foreground/30 hover:text-foreground hover:bg-foreground/10"
                    >
                      <p className="font-sans font-medium leading-tight">{p.name}</p>
                      <p className="mt-0.5 font-mono text-foreground/40">{p.heatValue} МДж/кг</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Правая колонка — методика */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-foreground/10 bg-foreground/3 p-5">
              <p className="mb-3 font-mono text-xs text-foreground/40 uppercase tracking-widest">Формула расчёта</p>
              <div className="space-y-3 font-mono text-xs text-foreground/60">
                <div className="rounded-lg bg-foreground/5 p-3">
                  <p className="text-foreground/40 mb-1">Мощность пожара:</p>
                  <p className="text-foreground/80">Q = Σ(m_i / ρ_max × ψ_i × Q_н_i)</p>
                </div>
                <div className="rounded-lg bg-foreground/5 p-3">
                  <p className="text-foreground/40 mb-1">Время горения:</p>
                  <p className="text-foreground/80">τ = Q / Σ(ψ_i × Q_н_i)</p>
                </div>
                <div className="space-y-1 text-foreground/40 text-[10px]">
                  <p>m_i — масса материала, кг</p>
                  <p>ρ_max — макс. плотность, кг/м³</p>
                  <p>ψ_i — скорость выгорания, кг/(м²·с)</p>
                  <p>Q_н_i — теплота сгорания, МДж/кг</p>
                </div>
              </div>
            </div>

            {results && (
              <div className="rounded-2xl border border-foreground/10 bg-foreground/3 p-5">
                <p className="mb-3 font-mono text-xs text-foreground/40 uppercase tracking-widest">Расчётная таблица</p>
                <div className="space-y-2">
                  {materials.map(m => {
                    const S = (m.mass / maxDensity).toFixed(3)
                    const contrib = ((m.mass / maxDensity) * m.burnRate * m.heatValue * 1000 / 1000000).toFixed(3)
                    return (
                      <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-foreground/8 bg-foreground/5 px-3 py-2">
                        <div>
                          <p className="font-sans text-xs font-medium text-foreground/80">{m.name}</p>
                          <p className="font-mono text-[10px] text-foreground/40">S = {S} м²</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-xs text-foreground/70">{contrib} МВт</p>
                        </div>
                      </div>
                    )
                  })}
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2">
                    <p className="font-sans text-xs font-semibold text-blue-300">Итого</p>
                    <p className="font-mono text-sm font-bold text-blue-300">{results.powerMW} МВт</p>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-foreground/10 bg-foreground/3 p-5">
              <p className="mb-2 font-mono text-xs text-foreground/40 uppercase tracking-widest">Приложение №1</p>
              <p className="font-sans text-xs text-foreground/50 leading-relaxed">
                Расчёт мощности пожара техники выполнен согласно методике определения пожарной нагрузки для горнорудных предприятий.
              </p>
              <p className="mt-2 font-sans text-xs text-foreground/50">
                Техника: <span className="text-foreground/80 font-medium">{machineName || "—"}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
