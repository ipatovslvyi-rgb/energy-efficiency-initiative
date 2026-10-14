/**
 * Расчёт пожарной нагрузки — мощность пожара
 *
 * Два расчёта:
 *  1. calcMachineFire() — мощность и время пожара самоходной техники (Приложение №1)
 *  2. calcBeltFire()    — мощность пожара конвейерной ленты по времени (Приложение №3)
 *  + calcDeltaT()       — расчётная температура горения (нагрев воздушной струи)
 *
 * Модуль без зависимостей — подключается в любой TS/JS-проект.
 *
 * Пример:
 *   import { calcMachineFire, machineMaterials, MACHINE_PRESETS, calcBeltFire } from "./fire-load-calc"
 *   const r = calcMachineFire(machineMaterials(MACHINE_PRESETS[0]), 39.6)
 *   r.powerMW, r.timeMin, r.deltaT
 *   const b = calcBeltFire({ burnRate: 0.011, density: 1370, width: 0.8, length: 640, thickness: 0.016, flameSpeed: 0.0101, flowM3s: 12 })
 *   b.power30, b.power60, b.rows
 */

// ═══════════════════════════════ ОБЩЕЕ ═══════════════════════════════

/** Плотность воздуха, кг/м³ */
export const AIR_DENSITY = 1.25
/** Удельная теплоёмкость воздуха, Дж/(кг·К) */
export const AIR_HEAT_CAPACITY = 1005

/**
 * Расчётная температура горения (нагрев воздуха)
 * Δt = Q[Вт] / (L[м³/с] × 1,25 × 1005)
 */
export function calcDeltaT(powerMW: number, flowM3s: number): number | null {
  if (!powerMW || !flowM3s || flowM3s <= 0) return null
  return (powerMW * 1_000_000) / (flowM3s * AIR_DENSITY * AIR_HEAT_CAPACITY)
}

/** Форматирование числа по-русски: 1234,56 */
export function fmt(n: number, digits = 2): string {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/** "0,011" → 0.011 */
export function parseNum(v: string | number): number {
  if (typeof v === "number") return v
  const n = parseFloat(v.replace(",", "."))
  return isNaN(n) ? 0 : n
}

// ═════════════════════════ 1. ПОЖАР ТЕХНИКИ ═════════════════════════

export interface Material {
  name: string
  density: number   // плотность, кг/м³
  mass: number      // масса, кг
  burnRate: number  // массовая скорость выгорания ψ, кг/(м²·с)
  heatValue: number // низшая теплота сгорания Qн, МДж/кг
}

/** Справочник горючих материалов */
export const PRESET_MATERIALS: Omit<Material, "mass">[] = [
  { name: "Резина", density: 1200, burnRate: 0.02, heatValue: 33.5 },
  { name: "Дизельное топливо", density: 830, burnRate: 0.043, heatValue: 42.6 },
  { name: "Масло моторное", density: 900, burnRate: 0.043, heatValue: 41.8 },
  { name: "Масло трансформаторное", density: 900, burnRate: 0.043, heatValue: 43.1 },
  { name: "Бензин", density: 700, burnRate: 0.06, heatValue: 44.0 },
  { name: "Пластик", density: 1100, burnRate: 0.015, heatValue: 33.6 },
  { name: "Древесина", density: 600, burnRate: 0.039, heatValue: 13.8 },
  { name: "Кабель ПВХ", density: 1400, burnRate: 0.007, heatValue: 25.0 },
]

export interface MachinePreset {
  name: string
  type: string
  capacity: string
  rubber: number // масса резины, кг
  diesel: number // масса дизтоплива, кг
  oil: number    // масса масел (моторное + гидравлика + трансмиссия), кг
}

/** Справочник подземной горнорудной техники */
export const MACHINE_PRESETS: MachinePreset[] = [
  { name: "Sandvik TH315", type: "Самосвал", capacity: "15 т", rubber: 780, diesel: 260, oil: 160 },
  { name: "Sandvik TH430", type: "Самосвал", capacity: "30 т", rubber: 1200, diesel: 400, oil: 220 },
  { name: "Sandvik TH540", type: "Самосвал", capacity: "40 т", rubber: 1500, diesel: 520, oil: 280 },
  { name: "Sandvik LH203", type: "ПДМ", capacity: "2 т", rubber: 260, diesel: 100, oil: 70 },
  { name: "Sandvik LH307", type: "ПДМ", capacity: "7 т", rubber: 520, diesel: 180, oil: 110 },
  { name: "Sandvik LH514", type: "ПДМ", capacity: "14 т", rubber: 900, diesel: 280, oil: 180 },
  { name: "Epiroc ST7 Scooptram", type: "ПДМ", capacity: "6,8 т", rubber: 480, diesel: 170, oil: 120 },
  { name: "Epiroc ST14 Scooptram", type: "ПДМ", capacity: "14 т", rubber: 900, diesel: 280, oil: 200 },
  { name: "Epiroc MT42", type: "Самосвал", capacity: "42 т", rubber: 1600, diesel: 550, oil: 300 },
  { name: "Caterpillar R1300G", type: "ПДМ", capacity: "13 т", rubber: 850, diesel: 260, oil: 180 },
  { name: "Caterpillar R1600H", type: "ПДМ", capacity: "16 т", rubber: 950, diesel: 290, oil: 210 },
  { name: "Caterpillar AD22", type: "Самосвал", capacity: "22 т", rubber: 1000, diesel: 340, oil: 200 },
  { name: "Caterpillar AD45B", type: "Самосвал", capacity: "41 т", rubber: 1500, diesel: 530, oil: 290 },
  { name: "Komatsu WJ-5", type: "ПДМ", capacity: "5 т", rubber: 400, diesel: 150, oil: 95 },
  { name: "Normet Spraymec", type: "Набрызг-машина", capacity: "—", rubber: 360, diesel: 140, oil: 90 },
  { name: "Epiroc Boomer T1D", type: "Буровая установка", capacity: "—", rubber: 800, diesel: 290, oil: 240 },
  { name: "Epiroc Boltec LC", type: "Анкеровщик", capacity: "—", rubber: 480, diesel: 180, oil: 140 },
  { name: "ТН-545", type: "Самосвал", capacity: "45 т", rubber: 1200, diesel: 400, oil: 200 },
  { name: "БелАЗ-7555", type: "Самосвал карьерный", capacity: "55 т", rubber: 2000, diesel: 700, oil: 400 },
]

/** Состав горючих материалов машины из справочника (резина + дизель + масло) */
export function machineMaterials(m: MachinePreset): Material[] {
  return [
    { name: "Резина", density: 1200, mass: m.rubber, burnRate: 0.02, heatValue: 33.5 },
    { name: "Дизель", density: 830, mass: m.diesel, burnRate: 0.043, heatValue: 42.6 },
    { name: "Масло", density: 900, mass: m.oil, burnRate: 0.043, heatValue: 41.8 },
  ]
}

export interface MaterialCalc {
  name: string
  S: number  // объём, м³ (m / ρmax)
  Ro: number // поверхность горения, м²
  N: number  // запас энергии, МДж
  T1: number // время выгорания, ч
  W1: number // мощность горения материала, МВт
}

export interface MachineFireResult {
  powerMW: number     // мощность пожара, МВт
  timeH: number       // время горения, ч
  timeMin: number     // время горения, мин
  maxDensity: number  // ρmax, кг/м³
  totalMass: number   // Σm, кг
  totalEnergy: number // ΣN, МДж
  totalArea: number   // ΣS, м³
  rateHeatSum: number // Σ(ψ·Qн)
  maxT1: number       // максимальное время выгорания, ч
  items: MaterialCalc[]
  flowM3s: number
  deltaT: number | null // расчётная температура, °C
}

/**
 * Мощность пожара техники.
 *   S_i  = m_i / ρmax
 *   r_i  = (3·S_i / 4π)^(1/3)
 *   Ro_i = 4π·r_i
 *   N_i  = m_i · Qн_i
 *   T1_i = m_i / (Ro_i · ψ_i) / 3600          [ч]
 *   Q    = ΣN_i / max(T1_i) / 3600            [МВт]
 *   τ    = ΣN_i / Q / 3600                     [ч]
 *
 * @param materials горючие материалы машины
 * @param flowM3s   расход воздуха в выработке, м³/с (для Δt)
 */
export function calcMachineFire(materials: Material[], flowM3s = 0): MachineFireResult | null {
  if (materials.length === 0) return null
  const maxDensity = Math.max(...materials.map(m => m.density))
  if (maxDensity <= 0) return null

  const items: MaterialCalc[] = materials.map(m => {
    const S = m.mass / maxDensity
    const r = Math.pow((S * 3) / (4 * Math.PI), 1 / 3)
    const Ro = r * 4 * Math.PI
    const N = m.mass * m.heatValue
    const T1 = Ro > 0 && m.burnRate > 0 ? m.mass / (Ro * m.burnRate) / 3600 : 0
    const W1 = T1 > 0 ? N / 3600 / T1 : 0
    return { name: m.name, S, Ro, N, T1, W1 }
  })

  const maxT1 = Math.max(...items.map(it => it.T1))
  const totalEnergy = items.reduce((s, it) => s + it.N, 0)
  const powerMW = maxT1 > 0 ? totalEnergy / maxT1 / 3600 : 0
  const timeH = powerMW > 0 ? totalEnergy / powerMW / 3600 : 0

  return {
    powerMW,
    timeH,
    timeMin: timeH * 60,
    maxDensity,
    totalMass: materials.reduce((s, m) => s + m.mass, 0),
    totalEnergy,
    totalArea: items.reduce((s, it) => s + it.S, 0),
    rateHeatSum: materials.reduce((s, m) => s + m.burnRate * m.heatValue, 0),
    maxT1,
    items,
    flowM3s,
    deltaT: calcDeltaT(powerMW, flowM3s),
  }
}

/** Текстовый отчёт «Приложение №1 — Расчёт мощности пожара техники» */
export function machineFireReport(machineName: string, materials: Material[], r: MachineFireResult, performer = ""): string {
  const lines = [
    "Приложение №1",
    "РАСЧЁТ МОЩНОСТИ ПОЖАРА ТЕХНИКИ",
    `Техника: ${machineName}`,
    "",
    "Исходные данные:",
    "Материал | ρ, кг/м³ | m, кг | ψ, кг/(м²·с) | Qн, МДж/кг",
    ...materials.map(m => `${m.name} | ${m.density} | ${m.mass} | ${m.burnRate} | ${m.heatValue}`),
    "",
    `Мощность: ${fmt(r.powerMW)} МВт`,
    `Время: ${fmt(r.timeH)} ч  или  ${fmt(r.timeMin, 1)} мин`,
    "",
    "Расчётная температура горения техники:",
    `Мощность ${fmt(r.powerMW)} МВт; расход ${fmt(r.flowM3s, 1)} м³/с; Δt = ${r.deltaT !== null ? fmt(r.deltaT, 1) : "—"} °C`,
    "",
    `Для расчёта устойчивости вентиляционного режима при возникновении пожара принимаем максимальную величину мощности пожара ${fmt(r.powerMW)} МВт.`,
    "",
    `Расчёт выполнил: ${performer || "________________"}`,
  ]
  return lines.join("\n")
}

// ═══════════════════════ 2. ПОЖАР КОНВЕЙЕРНОЙ ЛЕНТЫ ═══════════════════════

/** НТС резины конвейерной ленты, МДж/кг */
export const BELT_HEAT_VALUE = 33.5

/** Временные шаги таблицы, мин */
export const BELT_TIME_STEPS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
  31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 45, 48, 51, 54, 57, 60,
]

export interface BeltInputs {
  burnRate: number   // массовая скорость выгорания ψ, кг/(м²·с)
  density: number    // плотность ленточного полотна, кг/м³
  width: number      // ширина ленты, м
  length: number     // общая длина конвейера, м
  thickness: number  // толщина ленты, м
  flameSpeed: number // скорость продвижения пламени, м/с
  flowM3s: number    // расход воздуха, м³/с (для Δt)
  airSpeed?: number  // скорость воздуха, м/с (справочно, в расчёте не участвует)
}

export const BELT_DEFAULTS: BeltInputs = {
  burnRate: 0.011,
  density: 1370,
  width: 0.8,
  length: 640,
  thickness: 0.016,
  flameSpeed: 0.0101,
  flowM3s: 12,
  airSpeed: 0.6,
}

export interface BeltRow {
  t: number            // время, мин
  dist: number         // расстояние, пройденное фронтом пламени, м
  area: number         // площадь активного горения, м²
  massBurned: number   // масса выгоревшего, кг
  volBurned: number    // объём выгоревшего, м³
  lengthBurned: number // длина выгоревшего участка, м
  powerMW: number      // мощность пожара, МВт
}

export interface BeltFireResult {
  rows: BeltRow[]
  volume: number     // объём ленты (2 ветви), м³
  mass: number       // масса ленты, кг
  heatTotal: number  // запас энергии, МДж
  power30: number    // мощность через 30 мин, МВт
  power60: number    // мощность через 60 мин, МВт
  powerMax: number   // принимаемая мощность, МВт
  deltaTmax: number  // расчётная температура при powerMax, °C
}

/**
 * Мощность пожара конвейерной ленты во времени.
 *   V     = L·w·h·2 (верхняя + нижняя ветвь),  M = V·ρ,  E = M·Qн
 *   vп    = flameSpeed·60                       [м/мин]
 *   k     = ψ·60 / (2·ρ·h·2·vп)
 *   dist  = min(vп·t, L)
 *   lb    = dist·(1 − e^(−k·t))
 *   S     = (dist − lb)·w
 *   Q(t)  = ψ·S·Qн                              [МВт]
 */
export function calcBeltFire(inp: BeltInputs): BeltFireResult | null {
  const { burnRate: psi, density: rho, width: w, length: L, thickness: h, flowM3s: flow } = inp
  const vFlame = inp.flameSpeed * 60
  const Qn = BELT_HEAT_VALUE

  if ([psi, rho, w, L, h, vFlame].some(v => isNaN(v) || v <= 0)) return null

  const volume = L * w * h * 2
  const mass = volume * rho
  const heatTotal = mass * Qn
  const k = (psi * 60) / (2 * rho * h * 2 * vFlame)

  const rows: BeltRow[] = BELT_TIME_STEPS.map(t => {
    const dist = Math.min(vFlame * t, L)
    const lengthBurned = Math.min(dist * (1 - Math.exp(-k * t)), dist)
    const area = Math.max(dist - lengthBurned, 0) * w
    const massBurned = Math.min(lengthBurned * w * h * 2 * rho, mass)
    const volBurned = massBurned / rho
    const powerMW = psi * area * Qn
    return { t, dist, area, massBurned, volBurned, lengthBurned, powerMW }
  })

  const power30 = rows.find(r => r.t === 30)?.powerMW ?? 0
  const power60 = rows.find(r => r.t === 60)?.powerMW ?? 0
  const powerMax = Math.max(power30, power60)
  const deltaTmax = calcDeltaT(powerMax, flow) ?? 0

  return { rows, volume, mass, heatTotal, power30, power60, powerMax, deltaTmax }
}

/** Текстовый отчёт «Приложение №3 — Расчёт мощности пожара конвейерной ленты» */
export function beltFireReport(inp: BeltInputs, r: BeltFireResult, performer = ""): string {
  const lines = [
    "Приложение №3",
    "РАСЧЁТ МОЩНОСТИ ПОЖАРА КОНВЕЙЕРНОЙ ЛЕНТЫ",
    "",
    "Исходные данные:",
    `Скорость выгорания ψ: ${inp.burnRate} кг/(м²·с)`,
    `Плотность ленты: ${inp.density} кг/м³`,
    `Ширина: ${inp.width} м;  длина: ${inp.length} м;  толщина: ${inp.thickness} м`,
    `Скорость продвижения пламени: ${inp.flameSpeed} м/с`,
    inp.airSpeed !== undefined ? `Скорость воздуха: ${inp.airSpeed} м/с` : "",
    `Расход воздуха: ${inp.flowM3s} м³/с`,
    "",
    `Объём ленты: ${fmt(r.volume, 3)} м³;  масса: ${fmt(r.mass, 1)} кг;  запас энергии: ${fmt(r.heatTotal, 0)} МДж`,
    "",
    "t, мин | Расстояние, м | S горения, м² | Масса выгор., кг | Объём выгор., м³ | Длина выгор., м | Q, МВт",
    ...r.rows.map(x =>
      [x.t, fmt(x.dist), fmt(x.area), fmt(x.massBurned), fmt(x.volBurned, 3), fmt(x.lengthBurned), fmt(x.powerMW)].join(" | "),
    ),
    "",
    `Мощность пожара через 30 минут после возникновения пожара составит ${fmt(r.power30)} МВт`,
    `Мощность пожара через 60 минут после возникновения пожара составит ${fmt(r.power60)} МВт`,
    "",
    "Расчётная температура горения ленты:",
    `Мощность ${fmt(r.powerMax)} МВт; расход ${fmt(inp.flowM3s, 1)} м³/с; Δt = ${fmt(r.deltaTmax, 1)} °C`,
    "",
    `Для расчёта устойчивости вентиляционного режима при возникновении пожара принимаем максимальную величину мощности пожара ${fmt(r.powerMax)} МВт.`,
    "",
    `Расчёт выполнил: ${performer || "________________"}`,
  ]
  return lines.filter(l => l !== null).join("\n")
}

export default calcMachineFire
