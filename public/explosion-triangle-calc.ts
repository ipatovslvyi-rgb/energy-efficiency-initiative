/**
 * Расчёт взрываемости рудничной атмосферы — «Треугольник взрываемости»
 *
 * Два метода:
 *  1. calcGasZone()       — оценка смеси одного горючего газа по НПВ / ВПВ / мин. O₂
 *  2. calcVgschTriangle() — метод треугольников взрываемости для смеси CH₄ + CO + H₂
 *                           (Боевой устав ВГСЧ 1996, Приложение 11)
 *
 * Самостоятельный модуль без зависимостей — подключается в любой TS/JS-проект.
 *
 * Пример:
 *   import { calcVgschTriangle, calcGasZone } from "./explosion-triangle-calc"
 *   calcVgschTriangle({ ch4: 8, co: 1, h2: 0.5, o2: 17 }).isExplosive   // true / false
 *   calcGasZone("methane", 7, 19).label                                  // "ВЗРЫВООПАСНАЯ СМЕСЬ"
 */

// ═════════════════════════ 1. ОДИН ГОРЮЧИЙ ГАЗ ═════════════════════════

export interface GasInfo {
  key: string
  name: string
  formula: string
  lel: number
  uel: number
  lol: number
  description: string
}

/** lel — НПВ, %; uel — ВПВ, %; lol — минимальное содержание O₂ для горения, % */
export const GASES: GasInfo[] = [
  { key: "methane", name: "Метан", formula: "CH₄", lel: 5.0, uel: 15.0, lol: 12.0, description: "Основной рудничный газ" },
  { key: "hydrogen", name: "Водород", formula: "H₂", lel: 4.0, uel: 75.0, lol: 5.0, description: "Взрывоопасен в широком диапазоне" },
  { key: "co", name: "Угарный газ", formula: "CO", lel: 12.5, uel: 74.0, lol: 5.5, description: "Токсичен и взрывоопасен" },
  { key: "ethane", name: "Этан", formula: "C₂H₆", lel: 3.0, uel: 12.5, lol: 11.0, description: "Попутный газ в шахтах" },
  { key: "propane", name: "Пропан", formula: "C₃H₈", lel: 2.1, uel: 9.5, lol: 11.5, description: "Тяжелее воздуха, накапливается внизу" },
  { key: "acetylene", name: "Ацетилен", formula: "C₂H₂", lel: 2.5, uel: 80.0, lol: 5.0, description: "Очень широкий диапазон взрываемости" },
]

export type Zone = "explosive" | "lean" | "rich" | "inert"

export function getZone(gasPct: number, o2Pct: number, lel: number, uel: number, lol: number): Zone {
  if (gasPct < lel) return "lean"
  if (gasPct > uel) return "rich"
  if (o2Pct < lol) return "inert"
  return "explosive"
}

export const ZONE_LABELS: Record<Zone, string> = {
  explosive: "ВЗРЫВООПАСНАЯ СМЕСЬ",
  lean: "БЕДНАЯ СМЕСЬ (невзрывоопасная)",
  rich: "БОГАТАЯ СМЕСЬ (невзрывоопасная)",
  inert: "ИНЕРТНАЯ СМЕСЬ (недостаток O₂)",
}

export const ZONE_COLORS: Record<Zone, string> = {
  explosive: "#ef4444",
  lean: "#22c55e",
  rich: "#f59e0b",
  inert: "#6366f1",
}

export function getConclusion(zone: Zone, gasName: string, gasPct: number, o2Pct: number, lel: number, uel: number): string {
  switch (zone) {
    case "explosive":
      return `Смесь ВЗРЫВООПАСНА. Концентрация ${gasName} (${gasPct.toFixed(2)}%) находится в диапазоне взрываемости [${lel}%–${uel}%]. Содержание O₂ (${o2Pct.toFixed(2)}%) достаточно для горения. Необходимо немедленное проветривание и эвакуация.`
    case "lean":
      return `Смесь НЕВЗРЫВООПАСНА — бедная. Концентрация ${gasName} (${gasPct.toFixed(2)}%) ниже нижнего предела взрываемости (НПВ = ${lel}%). При увеличении концентрации смесь станет взрывоопасной.`
    case "rich":
      return `Смесь НЕВЗРЫВООПАСНА — богатая. Концентрация ${gasName} (${gasPct.toFixed(2)}%) превышает верхний предел взрываемости (ВПВ = ${uel}%). При разбавлении воздухом смесь может войти в зону взрываемости — опасность при проветривании.`
    case "inert":
      return `Смесь НЕВЗРЫВООПАСНА — инертная. Содержание O₂ (${o2Pct.toFixed(2)}%) ниже минимального предела поддержания горения. Однако возможно удушье персонала — требуется вентиляция.`
  }
}

export interface GasZoneResult {
  gas: GasInfo
  gasPct: number
  o2Pct: number
  zone: Zone
  label: string
  color: string
  conclusion: string
  isExplosive: boolean
}

/**
 * @param gas    ключ газа из GASES ("methane", "hydrogen", ...) или свой объект GasInfo
 * @param gasPct концентрация горючего газа, %
 * @param o2Pct  концентрация кислорода, %
 */
export function calcGasZone(gas: string | GasInfo, gasPct: number, o2Pct: number): GasZoneResult | null {
  const g = typeof gas === "string" ? GASES.find(x => x.key === gas) : gas
  if (!g || gasPct < 0 || o2Pct < 0) return null
  const zone = getZone(gasPct, o2Pct, g.lel, g.uel, g.lol)
  return {
    gas: g,
    gasPct,
    o2Pct,
    zone,
    label: ZONE_LABELS[zone],
    color: ZONE_COLORS[zone],
    conclusion: getConclusion(zone, g.name, gasPct, o2Pct, g.lel, g.uel),
    isExplosive: zone === "explosive",
  }
}

// ═════════════════ 2. МЕТОД ТРЕУГОЛЬНИКОВ ВГСЧ (CH₄ + CO + H₂) ═════════════════

export type Point = [number, number] // [C — сумма горючих, %; O₂, %]

/**
 * Вершины треугольников взрываемости (Боевой устав ВГСЧ 1996, Прил. 11).
 * Ключ 1-го уровня — доля CO (P_CO), 2-го — доля метана (P_CH).
 */
// prettier-ignore
export const EXPLOSION_DATA: Record<string, Record<string, Point[]>> = {
  "0.0": {
    "1.0": [[5,20.9],[5,5],[5,5]],
    "0.9": [[5,20.9],[5,5.5],[12,9.5]],
    "0.8": [[5,20.9],[5,4.5],[16,10]],
    "0.7": [[5,20.9],[5,4],[20,10.5]],
    "0.6": [[5,20.9],[5,3.5],[24,11]],
    "0.5": [[5,20.9],[5,3],[27,11.5]],
    "0.4": [[5,20.9],[5,2.5],[29,12]],
    "0.3": [[5,20.9],[5,2],[31,13]],
  },
  "0.1": {
    "0.9": [[5,20.9],[5,5.5],[12,10]],
    "0.8": [[5,20.9],[5,5],[16,10.5]],
    "0.7": [[5,20.9],[5,4.5],[20,11]],
    "0.6": [[5,20.9],[5,4],[24,11.5]],
    "0.5": [[5,20.9],[5,3.5],[27,12]],
    "0.4": [[5,20.9],[5,3],[29,12.5]],
    "0.3": [[5,20.9],[5,2.5],[31,13.5]],
  },
  "0.2": {
    "0.8": [[5,20.9],[5,6],[14,11]],
    "0.7": [[5,20.9],[5,5.5],[18,11.5]],
    "0.6": [[5,20.9],[5,5],[22,12]],
    "0.5": [[5,20.9],[5,4.5],[26,12.5]],
    "0.4": [[5,20.9],[5,4],[29,13]],
    "0.3": [[5,20.9],[5,3.5],[31,13.5]],
  },
  "0.3": {
    "0.7": [[5,20.9],[5,6.5],[16,11.5]],
    "0.6": [[5,20.9],[5,6],[20,12]],
    "0.5": [[5,20.9],[5,5.5],[24,12.5]],
    "0.4": [[5,20.9],[5,5],[27,13]],
    "0.3": [[5,20.9],[5,4.5],[30,14]],
  },
  "0.4": {
    "0.6": [[5,20.9],[5,7],[18,12.5]],
    "0.5": [[5,20.9],[5,6.5],[22,13]],
    "0.4": [[5,20.9],[5,6],[25,13.5]],
    "0.3": [[5,20.9],[5,5.5],[28,14]],
  },
  "0.5": {
    "0.5": [[5,20.9],[5,8],[20,13]],
    "0.4": [[5,20.9],[5,7.5],[23,13.5]],
    "0.3": [[5,20.9],[5,7],[26,14]],
  },
}

/** Точка внутри треугольника (включая границы) */
export function isPointInTriangle(px: number, py: number, tri: Point[]): boolean {
  const [A, B, C] = tri
  const sign = (p1: Point, p2: Point, p3: Point) =>
    (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])
  const d1 = sign([px, py], A, B)
  const d2 = sign([px, py], B, C)
  const d3 = sign([px, py], C, A)
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0
  return !(hasNeg && hasPos)
}

/** Ближайший табличный треугольник по долям CO и CH₄ */
export function getNearestTriangle(pco: number, pch: number): { tri: Point[]; pcoKey: string; pchKey: string } | null {
  const pcoKey = Object.keys(EXPLOSION_DATA)
    .map(Number)
    .sort((a, b) => Math.abs(a - pco) - Math.abs(b - pco))[0]
    .toFixed(1)
  const pchKey = Object.keys(EXPLOSION_DATA[pcoKey])
    .map(Number)
    .sort((a, b) => Math.abs(a - pch) - Math.abs(b - pch))[0]
    .toFixed(1)
  const tri = EXPLOSION_DATA[pcoKey]?.[pchKey]
  return tri ? { tri, pcoKey, pchKey } : null
}

export interface VgschInput {
  ch4: number // %
  co: number  // %
  h2: number  // %
  o2: number  // %
}

export interface VgschResult {
  C: number     // сумма горючих, %
  pch: number   // доля CH₄
  pco: number   // доля CO
  ph: number    // доля H₂
  o2: number
  isExplosive: boolean
  tri: Point[]  // вершины применённого треугольника [C, O₂]
  pcoKey: string
  pchKey: string
  conclusion: string
}

/**
 * Метод:  C = CH₄ + CO + H₂;  P_CH = CH₄/C;  P_CO = CO/C;  P_H = H₂/C
 * По P_CO и P_CH выбирается треугольник, затем проверяется попадание точки (C; O₂).
 * Возвращает null, если горючих газов нет (C = 0).
 */
export function calcVgschTriangle({ ch4, co, h2, o2 }: VgschInput): VgschResult | null {
  const C = (ch4 || 0) + (co || 0) + (h2 || 0)
  if (C <= 0) return null

  const pch = ch4 / C
  const pco = co / C
  const ph = h2 / C

  const found = getNearestTriangle(pco, pch)
  if (!found) return null

  const isExplosive = isPointInTriangle(C, o2, found.tri)
  const r3 = (n: number) => Math.round(n * 1000) / 1000

  return {
    C: r3(C),
    pch: r3(pch),
    pco: r3(pco),
    ph: r3(ph),
    o2,
    isExplosive,
    tri: found.tri,
    pcoKey: found.pcoKey,
    pchKey: found.pchKey,
    conclusion: isExplosive
      ? `Смесь ВЗРЫВООПАСНА: точка (C = ${r3(C)}%; O₂ = ${o2}%) находится внутри треугольника взрываемости (P_CO = ${found.pcoKey}, P_CH = ${found.pchKey}).`
      : `Смесь НЕВЗРЫВООПАСНА: точка (C = ${r3(C)}%; O₂ = ${o2}%) находится вне треугольника взрываемости (P_CO = ${found.pcoKey}, P_CH = ${found.pchKey}).`,
  }
}

/** Текстовый отчёт по методу ВГСЧ — для печати, буфера обмена или мессенджера */
export function vgschReport(input: VgschInput, r: VgschResult): string {
  return [
    "РАСЧЁТ ВЗРЫВАЕМОСТИ РУДНИЧНОЙ АТМОСФЕРЫ",
    "Метод треугольников взрываемости (Боевой устав ВГСЧ, Прил. 11)",
    "",
    `CH₄ = ${input.ch4}%   CO = ${input.co}%   H₂ = ${input.h2}%   O₂ = ${input.o2}%`,
    "",
    `C = CH₄ + CO + H₂ = ${r.C}%`,
    `P_CH = ${r.pch}   P_CO = ${r.pco}   P_H = ${r.ph}`,
    `Применён треугольник: P_CO = ${r.pcoKey}, P_CH = ${r.pchKey}`,
    `Вершины (C; O₂): ${r.tri.map(([c, o]) => `(${c}; ${o})`).join(", ")}`,
    "",
    r.conclusion,
  ].join("\n")
}

export default calcVgschTriangle
