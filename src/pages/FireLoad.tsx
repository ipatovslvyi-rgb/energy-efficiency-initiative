import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { GrainOverlay } from "@/components/grain-overlay"
import Icon from "@/components/ui/icon"
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, HeadingLevel, ShadingType,
} from "docx"

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

function calcResults(materials: Material[], flowM3s: number) {
  if (materials.length === 0) return null
  const maxDensity = Math.max(...materials.map(m => m.density))

  // Точная цепочка формул Excel (лист "Техника"):
  // S_i  = m_i / ρ_max                        [м³ — объём]
  // r_i  = (S_i * 3 / (4π))^(1/3)             [м — радиус шара]
  // Ro_i = r_i * 4π                            [м² — поверхность шара]
  // N_i  = m_i * Q_н_i                         [МДж — запас энергии]
  // T1_i = m_i / (Ro_i * ψ_i) / 3600          [ч — время выгорания]
  //        Проверка: 1200/(7.796*0.02)/3600 = 2.138 ✓
  // W1_i = N_i / 3600 / T1_i = Ro_i*ψ_i*Q_н_i [МВт]
  //
  // Q[МВт] = Σ(N_i) / МАКС(T1_i) / 3600       Проверка: 65600/2.138/3600=8.52 ✓
  // τ[ч]   = Σ(m_i) / МАКС(T1_i) / 3600       Проверка: 1800/2.138/3600=0.234... нет
  //          τ из Excel: та же формула с AA=m → 1800/2.138/3600=0.234 ≠ 2.14
  //          Значит для времени Y другой: T1_time_i = m_i/(Ro_i*ψ_i*Q_н_i)/60
  //          T1_time_резина = 1200/(7.796*0.02*33.5)/60 = 1200/5.223/60 = 3.832 — нет
  //          Используем: τ = sumN / Q / 3600 (из энергетического баланса)

  const items = materials.map(m => {
    const S  = m.mass / maxDensity
    const r  = Math.pow((S * 3) / (4 * Math.PI), 1 / 3)
    const Ro = r * 4 * Math.PI
    const N  = m.mass * m.heatValue
    const T1 = m.mass / (Ro * m.burnRate) / 3600
    const W1 = T1 > 0 ? N / 3600 / T1 : 0
    return { S, Ro, N, T1, W1 }
  })

  const maxT1 = Math.max(...items.map(it => it.T1))
  const sumN  = items.reduce((s, it) => s + it.N, 0)

  const powerMW = maxT1 > 0 ? sumN / maxT1 / 3600 : 0
  // τ[ч] = sumN / powerMW / 3600 (суммарная энергия / мощность)
  const sumM  = materials.reduce((s, m) => s + m.mass, 0)
  const timeH = powerMW > 0 ? sumN / powerMW / 3600 : 0
  const timeMin = timeH * 60

  const totalArea   = items.reduce((s, it) => s + it.S, 0)
  const rateHeatSum = materials.reduce((s, m) => s + m.burnRate * m.heatValue, 0)

  return { powerMW, timeH, timeMin, maxDensity, rateHeatSum, totalArea, items, maxT1 }
}

// Расчётная температура горения техники
// Δt = Q[Вт] / (L[м³/с] * 1.25[кг/м³] * 1005[Дж/(кг·К)])
function calcDeltaT(powerMW: number, flowM3s: number) {
  if (!powerMW || !flowM3s) return null
  return powerMW * 1_000_000 / (flowM3s * 1.25 * 1005)
}

// Экспорт в Word — документ "Приложение №1"
async function exportFireLoadToWord(
  machineName: string,
  materials: Material[],
  results: NonNullable<ReturnType<typeof calcResults>>,
  flowM3s: number,
  deltaT: number | null,
  performer: string,
) {
  const thin = { style: BorderStyle.SINGLE, size: 4, color: "999999" }
  const border = { top: thin, bottom: thin, left: thin, right: thin }

  const cell = (text: string, opts: {
    bold?: boolean; italic?: boolean; shade?: boolean;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    width?: number;
  } = {}) =>
    new TableCell({
      borders: border,
      width: opts.width !== undefined ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
      shading: opts.shade ? { type: ShadingType.SOLID, color: "C6EFCE", fill: "C6EFCE" } : undefined,
      children: [new Paragraph({
        alignment: opts.align ?? AlignmentType.CENTER,
        children: [new TextRun({
          text,
          bold: opts.bold,
          italics: opts.italic,
          size: 22,
        })],
      })],
    })

  // Заголовочные строки таблицы
  const headerRows = [
    new TableRow({ children: [
      cell("Техника", { bold: true, italic: true, width: 30 }),
      new TableCell({
        borders: border,
        columnSpan: materials.length,
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: machineName, italics: true, size: 22 })] })],
      }),
      cell("Ед. изм.", { bold: true, width: 15 }),
    ]}),
    new TableRow({ children: [
      cell("Материал", { bold: true }),
      ...materials.map(m => cell(m.name, { bold: true })),
      cell("", {}),
    ]}),
  ]

  const dataRows = [
    new TableRow({ children: [
      cell("Плотность", { italic: true, align: AlignmentType.LEFT }),
      ...materials.map(m => cell(String(m.density), { italic: true, shade: false })),
      cell("кг/м³", { italic: true }),
    ]}),
    new TableRow({ children: [
      cell("Масса", { bold: true, align: AlignmentType.LEFT }),
      ...materials.map(m => cell(String(m.mass), { bold: true, shade: true })),
      cell("кг", {}),
    ]}),
    new TableRow({ children: [
      cell("Скорость выгорания", { align: AlignmentType.LEFT }),
      ...materials.map(m => cell(String(m.burnRate), {})),
      cell("кг/(м²·с)", { italic: true }),
    ]}),
    new TableRow({ children: [
      cell("Низшая теплота сгорания", { align: AlignmentType.LEFT }),
      ...materials.map(m => cell(String(m.heatValue), {})),
      cell("МДж/кг", { italic: true }),
    ]}),
  ]

  const children = [
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: "Приложение №1", size: 22 })],
    }),
    new Paragraph({ children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Расчет мощности пожара техники", bold: true, size: 28 })],
      spacing: { after: 300 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Исходные данные для выполнения расчета:", bold: true, size: 24 })],
      spacing: { after: 200 },
    }),
    new Table({
      width: { size: 60, type: WidthType.PERCENTAGE },
      rows: [...headerRows, ...dataRows],
    }),
    new Paragraph({ children: [] }),
    // Результаты
    new Paragraph({
      children: [
        new TextRun({ text: "Мощность: ", size: 24 }),
        new TextRun({ text: fmt(results.powerMW), bold: true, size: 28 }),
        new TextRun({ text: "  МВт", size: 24, italics: true }),
      ],
      spacing: { before: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Время: ", size: 24 }),
        new TextRun({ text: fmt(results.timeH), bold: true, size: 28 }),
        new TextRun({ text: "  Часов   или   ", size: 24, italics: true }),
        new TextRun({ text: fmt(results.timeMin, 1), bold: true, size: 28 }),
        new TextRun({ text: "  мин", size: 24, italics: true }),
      ],
      spacing: { after: 300 },
    }),
    // Таблица температуры
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Расчетная температура горения техники", bold: true, size: 22 })],
      spacing: { after: 100 },
    }),
    new Table({
      width: { size: 40, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [
          cell("Мощность, мВт", { bold: true, shade: true }),
          cell("Расход, м³/с", { bold: true, shade: true }),
          cell("Δt, °C", { bold: true, shade: true }),
        ]}),
        new TableRow({ children: [
          cell(fmt(results.powerMW)),
          cell(fmt(flowM3s, 1), { shade: true }),
          cell(deltaT !== null ? fmt(deltaT, 1) : "—", { bold: true }),
        ]}),
      ],
    }),
    new Paragraph({ children: [] }),
    new Paragraph({
      children: [
        new TextRun({ text: "Для расчета устойчивости вентиляционного режима при возникновении пожара, принимаем максимальную величину мощности пожара  ", size: 22 }),
        new TextRun({ text: fmt(results.powerMW), bold: true, size: 22 }),
        new TextRun({ text: "  МВт", size: 22 }),
      ],
      spacing: { before: 200, after: 300 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Расчет выполнил: ", size: 22 }),
        new TextRun({ text: performer || "________________", size: 22 }),
      ],
    }),
  ]

  const doc = new Document({ sections: [{ children }] })
  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `Пожарная_нагрузка_${machineName}.docx`
  a.click()
  URL.revokeObjectURL(url)
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

  const flowNum = parseFloat(flowM3s.replace(",", "."))
  const results = calcResults(materials, isNaN(flowNum) ? 0 : flowNum)
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
            {results && (
              <button
                onClick={() => exportFireLoadToWord(machineName, materials, results, flowNum, deltaT, performer)}
                className="flex items-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-1.5 font-mono text-xs text-foreground/70 transition-all hover:border-foreground/40 hover:text-foreground"
              >
                <Icon name="FileText" size={12} />
                Word
              </button>
            )}
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