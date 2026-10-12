/**
 * Расчёт времени пребывания в зоне высоких температур (ЗВТ)
 * Основание: Приказ Ростехнадзора от 11.12.2020 №520, Приложение 6
 *
 * Самостоятельный модуль без зависимостей — подключается в любой TS/JS-проект.
 *
 * Пример:
 *   import { calcZVT } from "./zvt-calc"
 *   const r = calcZVT("10:30", 32, "moving")
 *   // r.maxTotal = 45, r.tForward = 15, r.tBack = 30, r.exitTime = "11:15"
 */

export type ZvtMode = "moving" | "stationary"

export interface ZvtLimits {
  stationary: number
  moving: number
}

export interface ZvtResult {
  entryTime: string
  exitTime: string
  temp: number
  mode: ZvtMode
  maxTotal: number
  tForward: number
  tBack: number
  tWork: number
  limits: ZvtLimits
}

export type ZvtError =
  | { error: "forbidden"; message: string }
  | { error: "out_of_range"; message: string }
  | { error: "no_limit"; message: string }
  | { error: "bad_time"; message: string }

// Таблица N1: температура выше 0 °C, мин
export const ZVT_TABLE1: { temp: number; stationary: number; moving: number }[] = [
  { temp: 27, stationary: 210, moving: 158 },
  { temp: 28, stationary: 180, moving: 135 },
  { temp: 29, stationary: 150, moving: 113 },
  { temp: 30, stationary: 120, moving: 90 },
  { temp: 31, stationary: 90, moving: 68 },
  { temp: 32, stationary: 60, moving: 45 },
  { temp: 33, stationary: 50, moving: 38 },
  { temp: 34, stationary: 40, moving: 30 },
  { temp: 35, stationary: 34, moving: 26 },
  { temp: 36, stationary: 30, moving: 23 },
  { temp: 37, stationary: 26, moving: 20 },
  { temp: 38, stationary: 22, moving: 17 },
  { temp: 39, stationary: 20, moving: 15 },
  { temp: 40, stationary: 18, moving: 14 },
]

// Таблица N2: температура 0 °C и ниже, мин
export const ZVT_TABLE2: { label: string; min: number; max: number; stationary: number; moving: number }[] = [
  { label: "от 0 до −5", min: -5, max: 0, stationary: 230, moving: 200 },
  { label: "от −5 до −10", min: -10, max: -5, stationary: 180, moving: 150 },
  { label: "от −10 до −15", min: -15, max: -10, stationary: 150, moving: 130 },
  { label: "от −15 до −20", min: -20, max: -15, stationary: 120, moving: 100 },
]

const pad = (n: number) => String(Math.floor(n)).padStart(2, "0")

export function minsToHHMM(mins: number): string {
  const total = Math.round(mins)
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
}

export function addMinutes(time: string, mins: number): string | null {
  const [hh, mm] = time.split(":").map(Number)
  if (isNaN(hh) || isNaN(mm)) return null
  const total = Math.round(hh * 60 + mm + mins)
  return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`
}

/**
 * Допустимое время пребывания по температуре.
 * Между строками таблицы N1 — линейная интерполяция.
 * null — температура вне таблиц (ниже 27 °C и выше 0 °C ограничений нет; выше 40 °C или ниже −20 °C — нет данных).
 */
export function getZvtLimits(temp: number): ZvtLimits | null {
  if (temp > 40 || temp < -20) return null

  if (temp <= 0) {
    const row = ZVT_TABLE2.find(r => temp > r.min && temp <= r.max) ?? (temp === -20 ? ZVT_TABLE2[3] : null)
    return row ? { stationary: row.stationary, moving: row.moving } : null
  }

  if (temp < 27) return null

  const lower = [...ZVT_TABLE1].reverse().find(r => r.temp <= temp)
  const upper = ZVT_TABLE1.find(r => r.temp > temp)
  if (!lower) return null
  if (!upper || lower.temp === temp) return { stationary: lower.stationary, moving: lower.moving }

  const k = (temp - lower.temp) / (upper.temp - lower.temp)
  return {
    stationary: lower.stationary + k * (upper.stationary - lower.stationary),
    moving: lower.moving + k * (upper.moving - lower.moving),
  }
}

/**
 * Основной расчёт.
 * @param entryTime время входа "ЧЧ:ММ"
 * @param temp      температура воздуха в ЗВТ, °C
 * @param mode      "moving" — передвижение по выработкам, "stationary" — работа на одном месте
 *
 * При передвижении (п. 12): 1/3 времени — движение вперёд, 2/3 — обратный путь.
 * Выше 40 °C работы без средств противотепловой защиты запрещены (п. 13).
 */
export function calcZVT(entryTime: string, temp: number, mode: ZvtMode): ZvtResult | ZvtError {
  if (temp > 40) return { error: "forbidden", message: "При температуре выше 40 °C работы запрещены (п. 13)" }
  if (temp < -20) return { error: "out_of_range", message: "Температура ниже −20 °C вне нормативных таблиц" }

  const limits = getZvtLimits(temp)
  if (!limits) return { error: "no_limit", message: "При температуре от 0 до 27 °C ограничение не нормируется" }

  const maxTotal = mode === "moving" ? limits.moving : limits.stationary
  const exitTime = addMinutes(entryTime, maxTotal)
  if (!exitTime) return { error: "bad_time", message: "Время входа должно быть в формате ЧЧ:ММ" }

  return {
    entryTime,
    exitTime,
    temp,
    mode,
    maxTotal,
    tForward: mode === "moving" ? maxTotal / 3 : 0,
    tBack: mode === "moving" ? (2 * maxTotal) / 3 : 0,
    tWork: mode === "stationary" ? maxTotal : 0,
    limits,
  }
}

export const isZvtError = (r: ZvtResult | ZvtError): r is ZvtError => "error" in r

/**
 * Время, когда отделение должно повернуть назад (только для режима "moving").
 */
export function turnBackTime(r: ZvtResult): string | null {
  return r.mode === "moving" ? addMinutes(r.entryTime, r.tForward) : null
}

/**
 * Текстовый отчёт — удобно для печати, буфера обмена или мессенджера.
 */
export function zvtReport(r: ZvtResult, object = "", performer = ""): string {
  const lines = [
    "РАСЧЁТ ВРЕМЕНИ ПРЕБЫВАНИЯ В ЗВТ",
    "Приказ Ростехнадзора от 11.12.2020 №520, Приложение 6",
    "",
    object ? `Объект: ${object}` : null,
    `Температура: ${r.temp} °C`,
    `Режим: ${r.mode === "moving" ? "передвижение по горным выработкам" : "работа на одном месте"}`,
    `Время входа: ${r.entryTime}`,
    "",
    `Максимальное время пребывания: ${Math.round(r.maxTotal)} мин (${minsToHHMM(r.maxTotal)})`,
    ...(r.mode === "moving"
      ? [
          `Движение вперёд (1/3): ${Math.round(r.tForward)} мин — поворот назад в ${turnBackTime(r)}`,
          `Обратный путь (2/3): ${Math.round(r.tBack)} мин`,
        ]
      : [`Работа на месте: ${Math.round(r.tWork)} мин`]),
    `Расчётное время выхода: ${r.exitTime}`,
    performer ? `\nРасчёт выполнил: ${performer}` : null,
  ]
  return lines.filter(l => l !== null).join("\n")
}

export default calcZVT
