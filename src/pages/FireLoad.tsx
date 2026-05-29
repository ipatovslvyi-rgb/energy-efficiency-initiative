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

// Справочник подземной горнорудной техники
interface MachinePreset {
  name: string
  type: string
  capacity: string
  rubber: number   // масса резины, кг
  diesel: number   // масса дизтоплива, кг
  oil: number      // масса масла (моторное + гидравлика + трансмиссия), кг
}

const MACHINE_PRESETS: MachinePreset[] = [
  { name: "Sandvik TH315",       type: "Самосвал",         capacity: "15 т",   rubber: 780,  diesel: 260, oil: 160 },
  { name: "Sandvik TH430",       type: "Самосвал",         capacity: "30 т",   rubber: 1200, diesel: 400, oil: 220 },
  { name: "Sandvik TH540",       type: "Самосвал",         capacity: "40 т",   rubber: 1500, diesel: 520, oil: 280 },
  { name: "Sandvik LH203",       type: "ПДМ",              capacity: "2 т",    rubber: 260,  diesel: 100, oil: 70  },
  { name: "Sandvik LH307",       type: "ПДМ",              capacity: "7 т",    rubber: 520,  diesel: 180, oil: 110 },
  { name: "Sandvik LH514",       type: "ПДМ",              capacity: "14 т",   rubber: 900,  diesel: 280, oil: 180 },
  { name: "Epiroc ST7 Scooptram",type: "ПДМ",              capacity: "6,8 т",  rubber: 480,  diesel: 170, oil: 120 },
  { name: "Epiroc ST14 Scooptram",type: "ПДМ",             capacity: "14 т",   rubber: 900,  diesel: 280, oil: 200 },
  { name: "Epiroc MT42",         type: "Самосвал",         capacity: "42 т",   rubber: 1600, diesel: 550, oil: 300 },
  { name: "Caterpillar R1300G",  type: "ПДМ",              capacity: "13 т",   rubber: 850,  diesel: 260, oil: 180 },
  { name: "Caterpillar R1600H",  type: "ПДМ",              capacity: "16 т",   rubber: 950,  diesel: 290, oil: 210 },
  { name: "Caterpillar AD22",    type: "Самосвал",         capacity: "22 т",   rubber: 1000, diesel: 340, oil: 200 },
  { name: "Caterpillar AD45B",   type: "Самосвал",         capacity: "41 т",   rubber: 1500, diesel: 530, oil: 290 },
  { name: "Komatsu WJ-5",        type: "ПДМ",              capacity: "5 т",    rubber: 400,  diesel: 150, oil: 95  },
  { name: "Normet Spraymec",     type: "Набрызг-машина",   capacity: "—",      rubber: 360,  diesel: 140, oil: 90  },
  { name: "Epiroc Boomer T1D",   type: "Буровая установка","capacity": "—",   rubber: 800,  diesel: 290, oil: 240 },
  { name: "Epiroc Boltec LC",    type: "Анкеровщик",       capacity: "—",      rubber: 480,  diesel: 180, oil: 140 },
  { name: "ТН-545",              type: "Самосвал",         capacity: "45 т",   rubber: 1200, diesel: 400, oil: 200 },
  { name: "БелАЗ-7555",         type: "Самосвал карьерный","capacity": "55 т", rubber: 2000, diesel: 700, oil: 400 },
]

let nextId = 4

function fmt(n: number, digits = 2) {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

// ─── Расчёт конвейерной ленты ────────────────────────────────────────────────
interface BeltInputs {
  burnRate: string     // скорость выгорания, кг/(м²·с)
  density: string      // плотность ленточного полотна, кг/м³
  width: string        // ширина, м
  length: string       // общая длина, м
  thickness: string    // толщина, м
  airSpeed: string     // скорость воздуха, м/с
  flameSpeed: string   // скорость продвижения пламени, м/мин
  flowM3s: string      // расход воздуха, м³/с — для расч. температуры
}

interface BeltRow {
  t: number        // время, мин
  dist: number     // расстояние пламени, м
  area: number     // площадь горения, м²
  massBurned: number
  volBurned: number
  lengthBurned: number
  powerMW: number
}

function calcBelt(inp: BeltInputs): { rows: BeltRow[]; volume: number; mass: number; heatTotal: number; power30: number; power60: number; deltaTmax: number } | null {
  const psi   = parseFloat(inp.burnRate.replace(",", "."))
  const rho   = parseFloat(inp.density.replace(",", "."))
  const w     = parseFloat(inp.width.replace(",", "."))
  const L     = parseFloat(inp.length.replace(",", "."))
  const h     = parseFloat(inp.thickness.replace(",", "."))
  const vFlameMs = parseFloat(inp.flameSpeed.replace(",", "."))  // м/с → переводим в м/мин
  const vFlame   = vFlameMs * 60  // м/мин
  const flow  = parseFloat(inp.flowM3s.replace(",", "."))
  const Q_н   = 33.5   // МДж/кг — НТС резины конвейерной ленты

  if ([psi, rho, w, L, h, vFlame].some(isNaN) || psi <= 0 || rho <= 0 || w <= 0 || L <= 0 || h <= 0 || vFlame <= 0) return null

  // Геометрия всей ленты (2 слоя: верхняя + нижняя ветвь)
  const volume = L * w * h * 2
  const mass   = volume * rho
  const heatTotal = mass * Q_н

  // Временные шаги по скриншоту
  const STEPS = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,45,48,51,54,57,60]

  // k — параметр затухания: отношение скорости выгорания к скорости распространения пламени
  // lb(t) = dist(t) × (1 - exp(-k×t)), где k = psi×60 / (2 × rho × h × 2 × vFlame)
  const k = (psi * 60) / (2 * rho * h * 2 * vFlame)

  const rows: BeltRow[] = STEPS.map(t => {
    // Расстояние пройденное ФРОНТОМ пламени, м
    const dist = Math.min(vFlame * t, L)
    // Длина уже ВЫГОРЕВШЕГО участка (хвост пожара), м
    const lengthBurned = Math.min(dist * (1 - Math.exp(-k * t)), dist)
    // Площадь АКТИВНОГО горения = зона между фронтом и уже сгоревшим × ширина
    const area = Math.max(dist - lengthBurned, 0) * w
    // Масса выгоревшего вещества (оба слоя)
    const massBurned = Math.min(lengthBurned * w * h * 2 * rho, mass)
    const volBurned  = massBurned / rho
    // Мощность пожара [МВт] = psi × S_горения × Q_н
    const powerMW = psi * area * Q_н
    return { t, dist, area, massBurned, volBurned, lengthBurned, powerMW }
  })

  const row30 = rows.find(r => r.t === 30)
  const row60 = rows.find(r => r.t === 60)
  const power30 = row30?.powerMW ?? 0
  const power60 = row60?.powerMW ?? 0
  const powerMax = Math.max(power30, power60)
  const deltaTmax = (!isNaN(flow) && flow > 0) ? powerMax * 1_000_000 / (flow * 1.25 * 1005) : 0

  return { rows, volume, mass, heatTotal, power30, power60, deltaTmax }
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

// Экспорт конвейерной ленты в Word — Приложение №3
async function exportBeltToWord(
  inp: BeltInputs,
  results: NonNullable<ReturnType<typeof calcBelt>>,
  performer: string,
) {
  const thin = { style: BorderStyle.SINGLE, size: 4, color: "999999" }
  const border = { top: thin, bottom: thin, left: thin, right: thin }

  const cell = (text: string, opts: {
    bold?: boolean; italic?: boolean; shade?: boolean; green?: boolean;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    width?: number;
  } = {}) =>
    new TableCell({
      borders: border,
      width: opts.width !== undefined ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
      shading: opts.green
        ? { type: ShadingType.SOLID, color: "C6EFCE", fill: "C6EFCE" }
        : opts.shade
          ? { type: ShadingType.SOLID, color: "DDEBF7", fill: "DDEBF7" }
          : undefined,
      children: [new Paragraph({
        alignment: opts.align ?? AlignmentType.CENTER,
        children: [new TextRun({ text, bold: opts.bold, italics: opts.italic, size: 20 })],
      })],
    })

  const fmtW = (n: number, d = 2) =>
    n.toLocaleString("ru-RU", { minimumFractionDigits: d, maximumFractionDigits: d })

  // Таблица исходных данных
  const inputRows: [string, string][] = [
    ["Скорость выгорания ленточного полотна, кг/(м²·с)", inp.burnRate.replace(".", ",")],
    ["Плотность ленточного полотна, кг/м³",              inp.density.replace(".", ",")],
    ["Ширина ленточного полотна, м",                     inp.width.replace(".", ",")],
    ["Общая длина ленточного полотна, м",                inp.length.replace(".", ",")],
    ["Общая толщина ленточного полотна, м",              inp.thickness.replace(".", ",")],
    ["Скорость воздуха в выработке, м/с",                inp.airSpeed.replace(".", ",")],
    ["Скорость продвижения пламени, м/с",                inp.flameSpeed.replace(".", ",")],
  ]

  const inputTable = new Table({
    width: { size: 65, type: WidthType.PERCENTAGE },
    rows: inputRows.map(([label, val]) =>
      new TableRow({ children: [
        cell(label, { align: AlignmentType.LEFT, width: 75 }),
        cell(val, { green: true, bold: true, width: 25 }),
      ]}),
    ),
  })

  // Таблица справочных характеристик
  const refTable = new Table({
    width: { size: 40, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [cell("Низшая теплота сгорания, МДж/кг", { align: AlignmentType.LEFT }), cell("33,5", { bold: true })] }),
      new TableRow({ children: [cell("Объём, м³", { align: AlignmentType.LEFT }), cell(fmtW(results.volume, 3), { bold: true })] }),
      new TableRow({ children: [cell("Масса, кг", { align: AlignmentType.LEFT }), cell(fmtW(results.mass, 2), { bold: true })] }),
      new TableRow({ children: [cell("Шаг по времени, мин", { align: AlignmentType.LEFT }), cell("60", { bold: true })] }),
      new TableRow({ children: [cell("Суммарная теплота, МДж", { align: AlignmentType.LEFT, bold: true }), cell(fmtW(results.heatTotal, 2), { bold: true })] }),
    ],
  })

  // Заголовки таблицы по времени
  const timeHeaders = ["Время,\nмин", "Расстояние пройденное\nпламенем, м", "Площадь\nгорения, м²", "Масса\nвыгорания, кг", "Объём\nвыгорания", "Выгоревшая\nдлина, м", "Мощность\nМВт"]
  const timeHeaderRow = new TableRow({
    children: timeHeaders.map(h =>
      new TableCell({
        borders: border,
        shading: { type: ShadingType.SOLID, color: "DDEBF7", fill: "DDEBF7" },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: h, bold: true, size: 18 })],
        })],
      }),
    ),
  })

  const timeDataRows = results.rows.map(row => {
    const isRow30 = row.t === 30
    const isRow60 = row.t === 60
    const shade = isRow30 || isRow60
    return new TableRow({
      children: [
        cell(String(row.t), { shade }),
        cell(fmtW(row.dist, 3), { shade }),
        cell(fmtW(row.area, 2), { shade }),
        cell(fmtW(row.massBurned, 2), { shade }),
        cell(fmtW(row.volBurned, 2), { shade }),
        cell(fmtW(row.lengthBurned, 2), { shade }),
        cell(fmtW(row.powerMW, 2), { bold: true, shade }),
      ],
    })
  })

  const timeTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [timeHeaderRow, ...timeDataRows],
  })

  // Таблица температуры
  const flowVal = parseFloat(inp.flowM3s.replace(",", "."))
  const tempTable = new Table({
    width: { size: 40, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [
        cell("Мощность, МВт", { bold: true, shade: true }),
        cell("Расход, м³/с", { bold: true, shade: true }),
        cell("Δt, °C", { bold: true, shade: true }),
      ]}),
      new TableRow({ children: [
        cell(fmtW(results.power60, 2)),
        cell(inp.flowM3s.replace(".", ","), { green: true }),
        cell(fmtW(results.deltaTmax, 1), { bold: true }),
      ]}),
    ],
  })

  const powerMax = Math.max(results.power30, results.power60)

  const children = [
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: "Приложение №3", size: 22 })],
    }),
    new Paragraph({ children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Расчет мощности пожара конвейерной ленты", bold: true, size: 28 })],
      spacing: { after: 400 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Исходные данные для выполнения расчета", bold: true, size: 24 })],
      spacing: { after: 200 },
    }),
    inputTable,
    new Paragraph({ children: [] }),
    refTable,
    new Paragraph({ children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Расчетная температура горения ленты", bold: true, size: 22 })],
      spacing: { after: 100 },
    }),
    tempTable,
    new Paragraph({ children: [] }),
    timeTable,
    new Paragraph({ children: [] }),
    new Paragraph({
      children: [
        new TextRun({ text: "Мощность пожара через 30 минут после возникновения пожара составит   ", size: 22 }),
        new TextRun({ text: fmtW(results.power30, 2), bold: true, size: 24 }),
        new TextRun({ text: "   МВт", size: 22, italics: true }),
      ],
      spacing: { before: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Мощность пожара через 60 минут после возникновения пожара составит   ", size: 22 }),
        new TextRun({ text: fmtW(results.power60, 2), bold: true, size: 24 }),
        new TextRun({ text: "   МВт", size: 22, italics: true }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Для расчета устойчивости вентиляционного режима при возникновении пожара, принимаем максимальную величину мощности пожара   ", size: 22 }),
        new TextRun({ text: fmtW(powerMax, 2), bold: true, size: 24 }),
        new TextRun({ text: "   МВт", size: 22 }),
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
  a.download = "Пожарная_нагрузка_Конвейерная_лента.docx"
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
  const [showMachines, setShowMachines] = useState(false)
  const [machineSearch, setMachineSearch] = useState("")
  const [activeTab, setActiveTab] = useState<"machine" | "belt">("machine")
  const [beltPerformer, setBeltPerformer] = useState("")

  // ── Belt state ──
  const [belt, setBelt] = useState<BeltInputs>({
    burnRate: "0,011",
    density: "1370",
    width: "0,8",
    length: "640",
    thickness: "0,016",
    airSpeed: "0,6",
    flameSpeed: "0,01010",
    flowM3s: "12",
  })
  const beltResults = calcBelt(belt)

  function setBeltField(field: keyof BeltInputs, val: string) {
    setBelt(prev => ({ ...prev, [field]: val }))
  }

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

  function loadMachine(machine: MachinePreset) {
    setMachineName(machine.name)
    setMaterials([
      { id: String(nextId++), name: "Резина",  density: 1200, mass: machine.rubber, burnRate: 0.02,  heatValue: 33.5 },
      { id: String(nextId++), name: "Дизель",  density: 830,  mass: machine.diesel, burnRate: 0.043, heatValue: 42.6 },
      { id: String(nextId++), name: "Масло",   density: 900,  mass: machine.oil,    burnRate: 0.043, heatValue: 41.8 },
    ])
    setShowMachines(false)
    setMachineSearch("")
  }

  const maxDensity = materials.length > 0 ? Math.max(...materials.map(m => m.density)) : 0

  return (
    <div className="relative min-h-screen text-foreground">
      <GrainOverlay />
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 animated-bg" />
        <div className="absolute inset-0 bg-black/10" />
      </div>

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
              <p className="font-mono text-xs text-foreground/40">
                {activeTab === "machine" ? "Расчёт мощности пожара техники" : "Расчёт мощности пожара конвейерной ленты"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Вкладки */}
            <div className="flex rounded-lg border border-foreground/15 bg-foreground/5 p-0.5">
              <button
                onClick={() => setActiveTab("machine")}
                className={`rounded-md px-3 py-1 font-mono text-xs transition-all ${activeTab === "machine" ? "bg-foreground text-background" : "text-foreground/50 hover:text-foreground"}`}
              >
                Техника
              </button>
              <button
                onClick={() => setActiveTab("belt")}
                className={`rounded-md px-3 py-1 font-mono text-xs transition-all ${activeTab === "belt" ? "bg-foreground text-background" : "text-foreground/50 hover:text-foreground"}`}
              >
                Конв. лента
              </button>
            </div>
            {activeTab === "belt" && beltResults && (
              <button
                onClick={() => exportBeltToWord(belt, beltResults, beltPerformer)}
                className="flex items-center gap-1.5 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-1.5 font-mono text-xs text-foreground/70 transition-all hover:border-foreground/40 hover:text-foreground"
              >
                <Icon name="FileText" size={12} />
                Word
              </button>
            )}
            {activeTab === "machine" && (
              <>
                <button
                  onClick={() => setShowPresets(v => !v)}
                  className="flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 font-mono text-xs text-blue-400 transition-all hover:bg-blue-500/20"
                >
                  <Icon name="Plus" size={12} />
                  Добавить материал
                </button>
                <button
                  onClick={() => setShowMachines(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 font-mono text-xs text-amber-400 transition-all hover:bg-amber-500/20"
                >
                  <Icon name="BookOpen" size={12} />
                  Справочник техники
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
              </>
            )}
          </div>
        </div>
      </div>

      {/* ══ Вкладка: Конвейерная лента ══ */}
      {activeTab === "belt" && (
        <div className="mx-auto max-w-5xl px-6 py-8 md:px-10">
          <div className="rounded-2xl border border-foreground/10 bg-foreground/3 px-8 py-8">
            <p className="mb-4 text-right font-sans text-sm text-foreground/50">Приложение №3</p>
            <h2 className="mb-8 text-center font-sans text-xl font-bold text-foreground">
              Расчет мощности пожара конвейерной ленты
            </h2>

            {/* Исходные данные */}
            <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div>
                <p className="mb-4 font-sans text-sm font-bold text-foreground">Исходные данные для выполнения расчета</p>
                <div className="overflow-hidden rounded-xl border border-foreground/15">
                  {([
                    ["Скорость выгорания ленточного полотна, кг/(м²·с)", "burnRate"],
                    ["Плотность ленточного полотна, кг/м³", "density"],
                    ["Ширина ленточного полотна, м", "width"],
                    ["Общая длина ленточного полотна, м", "length"],
                    ["Общая толщина ленточного полотна, м", "thickness"],
                    ["Скорость воздуха в выработке, м/с", "airSpeed"],
                    ["Скорость продвижения пламени, м/мин", "flameSpeed"],
                  ] as [string, keyof BeltInputs][]).map(([label, field]) => (
                    <div key={field} className="flex items-center border-b border-foreground/8 last:border-0">
                      <div className="flex-1 px-4 py-2 font-sans text-sm text-foreground/80">{label}</div>
                      <div className="shrink-0 border-l border-foreground/10">
                        <input
                          value={belt[field]}
                          onChange={e => setBeltField(field, e.target.value)}
                          className="w-28 bg-green-500/10 px-3 py-2 text-center font-mono text-sm text-foreground outline-none focus:bg-green-500/20"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Справочные характеристики */}
                {beltResults && (
                  <div className="mt-4 overflow-hidden rounded-xl border border-foreground/10">
                    {[
                      ["Низшая теплота сгорания, МДж/кг", "33,5"],
                      ["Объём, м³", fmt(beltResults.volume, 3)],
                      ["Масса, кг", fmt(beltResults.mass, 2)],
                      ["Шаг по времени", "60"],
                    ].map(([label, val]) => (
                      <div key={label} className="flex items-center border-b border-foreground/8 last:border-0">
                        <div className="flex-1 px-4 py-2 text-right font-sans text-sm text-foreground/60">{label}</div>
                        <div className="w-32 shrink-0 border-l border-foreground/10 px-4 py-2 text-center font-mono text-sm font-bold text-foreground">{val}</div>
                      </div>
                    ))}
                    <div className="flex items-center border-t border-foreground/10 bg-foreground/3">
                      <div className="flex-1 px-4 py-2 text-right font-sans text-sm text-foreground/60">Суммарная теплота, МДж/кг</div>
                      <div className="w-32 shrink-0 border-l border-foreground/10 px-4 py-2 text-center font-mono text-sm font-bold text-foreground">{fmt(beltResults.heatTotal, 2)}</div>
                    </div>
                  </div>
                )}

                {/* Расход воздуха для температуры */}
                <div className="mt-4 overflow-hidden rounded-xl border border-foreground/10">
                  <div className="flex items-center">
                    <div className="flex-1 px-4 py-2 font-sans text-sm text-foreground/80">Расход воздуха, м³/с</div>
                    <div className="shrink-0 border-l border-foreground/10">
                      <input
                        value={belt.flowM3s}
                        onChange={e => setBeltField("flowM3s", e.target.value)}
                        className="w-28 bg-green-500/10 px-3 py-2 text-center font-mono text-sm text-foreground outline-none focus:bg-green-500/20"
                      />
                    </div>
                  </div>
                </div>

                {/* Справочная таблица материалов */}
                <div className="mt-4 overflow-hidden rounded-xl border border-foreground/10">
                  <div className="grid grid-cols-4 border-b border-foreground/10 bg-foreground/5 px-3 py-1.5 text-center font-mono text-[10px] text-foreground/40 uppercase tracking-wider">
                    <span></span><span>НТС</span><span>Скорость</span><span>Плотность кг/м³</span>
                  </div>
                  {[
                    ["Электрокабель", "25", "0,007", "900"],
                    ["Древесина", "13,8", "0,027", "500"],
                    ["Древесина сосновая", "18,7–20,8", "0,039", "500"],
                    ["Резина", "33,5", "0,011", "1370"],
                  ].map(([name, nts, speed, dens]) => (
                    <div key={name} className="grid grid-cols-4 border-b border-foreground/8 last:border-0 px-3 py-1.5 text-center font-mono text-xs">
                      <span className="text-left text-foreground/70">{name}</span>
                      <span className="text-foreground/70">{nts}</span>
                      <span className="text-foreground/70">{speed}</span>
                      <span className="text-foreground/70">{dens}</span>
                    </div>
                  ))}
                  <div className="px-3 py-1.5 font-mono text-[9px] italic text-foreground/30">Толщина задаётся для суммарной толщины 2х слоёв ленты</div>
                  <div className="px-3 pb-2 font-mono text-[9px] italic text-foreground/30">Скорость выгорания — справочная величина</div>
                </div>
              </div>

              {/* Расчётная температура */}
              {beltResults && (
                <div className="flex flex-col gap-4">
                  <div className="rounded-xl border border-foreground/10 overflow-hidden">
                    <div className="bg-foreground/5 px-4 py-2 text-center font-sans text-sm font-bold text-foreground">
                      Расчётная температура горения ленты
                    </div>
                    <div className="grid grid-cols-3 border-t border-foreground/10">
                      {["Мощность, мВт", "Расход, м³/с", "Δt, °C"].map(h => (
                        <div key={h} className="border-r border-foreground/10 last:border-0 px-3 py-2 text-center font-mono text-xs text-foreground/50">{h}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 border-t border-foreground/10">
                      <div className="border-r border-foreground/10 px-3 py-3 text-center font-mono text-base font-bold text-foreground">
                        {fmt(beltResults.power60, 2)}
                      </div>
                      <div className="border-r border-green-500/30 bg-green-500/10 px-3 py-3 text-center font-mono text-base font-bold text-foreground">
                        <input
                          value={belt.flowM3s}
                          onChange={e => setBeltField("flowM3s", e.target.value)}
                          className="w-full bg-transparent text-center font-mono text-base font-bold text-foreground outline-none"
                        />
                      </div>
                      <div className="px-3 py-3 text-center font-mono text-base font-bold text-foreground">
                        {fmt(beltResults.deltaTmax, 1)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Таблица по времени */}
            {beltResults && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs font-mono">
                  <thead>
                    <tr className="bg-foreground/8">
                      {["Время, мин", "Расстояние пройденное пламенем, м", "Площадь горения, м²", "Масса выгорания, кг", "Объём выгорания", "Выгоревшая длина, м", "Мощность мВт"].map(h => (
                        <th key={h} className="border border-foreground/15 px-2 py-2 text-center font-sans text-[10px] font-semibold text-foreground/70 leading-tight">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {beltResults.rows.map(row => (
                      <tr key={row.t} className={`${row.t === 30 ? "bg-amber-500/10" : row.t === 60 ? "bg-blue-500/10" : "hover:bg-foreground/3"}`}>
                        <td className="border border-foreground/10 px-2 py-1 text-center text-foreground/70">{row.t}</td>
                        <td className="border border-foreground/10 px-2 py-1 text-center text-foreground/80">{fmt(row.dist, 3)}</td>
                        <td className="border border-foreground/10 px-2 py-1 text-center text-foreground/80">{fmt(row.area, 2)}</td>
                        <td className="border border-foreground/10 px-2 py-1 text-center text-foreground/80">{fmt(row.massBurned, 2)}</td>
                        <td className="border border-foreground/10 px-2 py-1 text-center text-foreground/80">{fmt(row.volBurned, 2)}</td>
                        <td className="border border-foreground/10 px-2 py-1 text-center text-foreground/80">{fmt(row.lengthBurned, 2)}</td>
                        <td className="border border-foreground/10 px-2 py-1 text-center font-bold text-foreground">{fmt(row.powerMW, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Итоговые строки */}
            {beltResults && (
              <div className="mt-6 space-y-2">
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                  <span className="font-sans text-sm text-foreground/70">Мощность пожара через 30 минут после возникновения пожара составит</span>
                  <span className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-1 font-mono text-base font-bold text-foreground">{fmt(beltResults.power30, 2)}</span>
                  <span className="font-sans text-sm text-foreground/50">МВт</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3">
                  <span className="font-sans text-sm text-foreground/70">Мощность пожара через 60 минут после возникновения пожара составит</span>
                  <span className="rounded border border-blue-500/40 bg-blue-500/10 px-3 py-1 font-mono text-base font-bold text-foreground">{fmt(beltResults.power60, 2)}</span>
                  <span className="font-sans text-sm text-foreground/50">МВт</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-foreground/10 bg-foreground/3 px-4 py-3">
                  <span className="font-sans text-sm text-foreground/70">Для расчёта устойчивости вентиляционного режима принимаем максимальную величину мощности пожара</span>
                  <span className="ml-auto rounded border border-foreground/30 px-3 py-1 font-mono text-base font-bold text-foreground">{fmt(Math.max(beltResults.power30, beltResults.power60), 2)}</span>
                  <span className="font-sans text-sm text-foreground/50">МВт</span>
                </div>
              </div>
            )}

            {/* Расчет выполнил */}
            <div className="mt-6 flex items-center gap-2">
              <span className="font-sans text-sm text-foreground/70">Расчет выполнил:</span>
              <input
                type="text"
                value={beltPerformer}
                onChange={e => setBeltPerformer(e.target.value)}
                placeholder="________________"
                className="border-b border-foreground/30 bg-transparent px-2 py-0.5 text-sm text-foreground/80 outline-none focus:border-foreground/60 w-48"
              />
            </div>
          </div>
        </div>
      )}

      {/* ══ Вкладка: Техника ══ */}
      {activeTab === "machine" && (
      <>
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

      </>
      )}

      {/* Модальное окно справочника техники */}
      {showMachines && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowMachines(false)} />
          <div className="relative w-full max-w-3xl rounded-2xl border border-foreground/15 bg-background shadow-2xl overflow-hidden">
            {/* Шапка */}
            <div className="flex items-center justify-between border-b border-foreground/10 px-6 py-4">
              <div>
                <h2 className="font-sans text-base font-semibold text-foreground">Справочник горнорудной техники</h2>
                <p className="font-mono text-xs text-foreground/40">Выберите машину — данные заполнятся автоматически</p>
              </div>
              <button onClick={() => setShowMachines(false)} className="text-foreground/40 hover:text-foreground transition-colors">
                <Icon name="X" size={18} />
              </button>
            </div>

            {/* Поиск */}
            <div className="border-b border-foreground/10 px-6 py-3">
              <div className="flex items-center gap-2 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2">
                <Icon name="Search" size={14} className="text-foreground/40 shrink-0" />
                <input
                  type="text"
                  value={machineSearch}
                  onChange={e => setMachineSearch(e.target.value)}
                  placeholder="Поиск по названию или типу..."
                  className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-foreground/30"
                  autoFocus
                />
              </div>
            </div>

            {/* Список машин */}
            <div className="overflow-y-auto max-h-[60vh] p-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {MACHINE_PRESETS
                  .filter(m =>
                    machineSearch === "" ||
                    m.name.toLowerCase().includes(machineSearch.toLowerCase()) ||
                    m.type.toLowerCase().includes(machineSearch.toLowerCase())
                  )
                  .map(machine => (
                    <button
                      key={machine.name}
                      onClick={() => loadMachine(machine)}
                      className="group flex flex-col gap-2 rounded-xl border border-foreground/10 bg-foreground/3 p-4 text-left transition-all hover:border-amber-500/40 hover:bg-amber-500/5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-sans text-sm font-semibold text-foreground/90 group-hover:text-foreground leading-tight">{machine.name}</p>
                          <p className="font-mono text-xs text-foreground/40 mt-0.5">{machine.type}{machine.capacity !== "—" ? ` · ${machine.capacity}` : ""}</p>
                        </div>
                        <Icon name="ChevronRight" size={14} className="mt-0.5 shrink-0 text-foreground/20 group-hover:text-amber-400 transition-colors" />
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        <div className="rounded-lg bg-foreground/5 px-2 py-1.5 text-center">
                          <p className="font-mono text-[10px] text-foreground/30 uppercase">Резина</p>
                          <p className="font-sans text-sm font-bold text-foreground/80">{machine.rubber}</p>
                          <p className="font-mono text-[9px] text-foreground/25">кг</p>
                        </div>
                        <div className="rounded-lg bg-blue-500/8 px-2 py-1.5 text-center">
                          <p className="font-mono text-[10px] text-blue-400/50 uppercase">Дизель</p>
                          <p className="font-sans text-sm font-bold text-blue-300/80">{machine.diesel}</p>
                          <p className="font-mono text-[9px] text-blue-400/30">кг</p>
                        </div>
                        <div className="rounded-lg bg-orange-500/8 px-2 py-1.5 text-center">
                          <p className="font-mono text-[10px] text-orange-400/50 uppercase">Масло</p>
                          <p className="font-sans text-sm font-bold text-orange-300/80">{machine.oil}</p>
                          <p className="font-mono text-[9px] text-orange-400/30">кг</p>
                        </div>
                      </div>
                    </button>
                  ))}
              </div>
              {MACHINE_PRESETS.filter(m =>
                machineSearch === "" ||
                m.name.toLowerCase().includes(machineSearch.toLowerCase()) ||
                m.type.toLowerCase().includes(machineSearch.toLowerCase())
              ).length === 0 && (
                <p className="py-8 text-center font-mono text-sm text-foreground/30">Ничего не найдено</p>
              )}
            </div>

            <div className="border-t border-foreground/10 px-6 py-3">
              <p className="font-mono text-xs text-foreground/30">
                Данные приблизительные. После выбора можно скорректировать значения вручную.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}