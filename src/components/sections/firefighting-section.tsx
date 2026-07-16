import { useReveal } from "@/hooks/use-reveal"
import { useState } from "react"
import { TabTrunks, TabFlow, TabHoses, TabFlood, TabFoam } from "./firefighting-tabs-1"
import { TabVolume, TabArea, TabResistance, TabFireIndex, TabInertGas, TabPowder, TabPowderReserve } from "./firefighting-tabs-2"

type TabKey = "trunks" | "flow" | "hoses" | "flood" | "foam" | "powder" | "powder-reserve" | "volume" | "area" | "resistance" | "fire-index" | "inert-gas"

const TABS: { key: TabKey; label: string; full: string; short: string }[] = [
  { key: "trunks",         label: "Кол-во стволов",         full: "Количество стволов для тушения пожара",                              short: "Стволы" },
  { key: "flow",           label: "Требуемый расход",        full: "Требуемый расход воды на тушение пожара",                           short: "Расход" },
  { key: "hoses",          label: "Кол-во рукавов",          full: "Количество пожарных рукавов от водоисточника до места пожара",       short: "Рукава" },
  { key: "flood",          label: "Время затопления",        full: "Время затопления горной выработки",                                 short: "Затопл." },
  { key: "foam",           label: "Расход пенообразователя", full: "Требуемый расход раствора пенообразователя",                        short: "Пена" },
  { key: "powder",         label: "Огнетуш. порошок",         full: "Количество огнетушащего порошка для тушения пожара в выработке",   short: "Порошок" },
  { key: "powder-reserve", label: "Запас порошка на участок", full: "Нормативный запас огнетушащего порошка на участок ведения ГСР",    short: "Запас порошка" },
  { key: "volume",         label: "Объём выработки",         full: "Объём горной выработки",                                           short: "Объём" },
  { key: "area",           label: "Площадь пожара",          full: "Площадь пожара в горной выработке",                                short: "Площадь" },
  { key: "resistance",     label: "Сопротивление линии",     full: "Потери напора в рукавной линии",                                   short: "Сопротивл." },
  { key: "fire-index",     label: "Пожарное состояние",      full: "Индексы пожарного состояния атмосферы (Грэхем, Янг)",              short: "Пожар. индекс" },
  { key: "inert-gas",      label: "Инертный газ",            full: "Расчёт подачи инертного газа для тушения пожара",                   short: "Инерт. газ" },
]

const TAB_CONTENT: Record<TabKey, React.FC> = {
  trunks:           TabTrunks,
  flow:             TabFlow,
  hoses:            TabHoses,
  flood:            TabFlood,
  foam:             TabFoam,
  powder:           TabPowder,
  "powder-reserve": TabPowderReserve,
  volume:           TabVolume,
  area:             TabArea,
  resistance:       TabResistance,
  "fire-index":     TabFireIndex,
  "inert-gas":      TabInertGas,
}

export function FirefightingSection({ sectionRef }: { sectionRef?: (el: HTMLElement | null) => void } = {}) {
  const { ref, isVisible } = useReveal(0.3)
  const [activeTab, setActiveTab] = useState<TabKey>("trunks")

  const ActiveContent = TAB_CONTENT[activeTab]

  return (
    <section
      ref={(el) => { ref.current = el; sectionRef?.(el) }}
      className="flex min-h-screen w-full flex-col px-6 py-24 md:px-12 lg:px-16"
    >
      <div className="mx-auto w-full max-w-7xl">
        <div
          className={`mb-10 transition-all duration-700 md:mb-12 ${
            isVisible ? "translate-y-0 opacity-100" : "-translate-y-12 opacity-0"
          }`}
        >
          <h2 className="mb-2 font-sans text-5xl font-light tracking-tight text-foreground md:text-6xl lg:text-7xl">
            Пожаротушение
          </h2>
          <p className="font-mono text-sm text-foreground/60 md:text-base">/ Расчёты для горных выработок</p>
        </div>

        <div
          className={`mb-8 transition-all duration-700 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}
          style={{ transitionDelay: "150ms" }}
        >
          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-lg px-4 py-2.5 font-mono text-xs sm:text-xs transition-all duration-200 min-w-[4.5rem] sm:min-w-0 ${
                  activeTab === tab.key
                    ? "bg-foreground text-background"
                    : "border border-foreground/20 text-foreground/60 hover:border-foreground/40 hover:text-foreground"
                }`}
              >
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.short}</span>
              </button>
            ))}
          </div>
        </div>

        <div
          className={`transition-all duration-700 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}
          style={{ transitionDelay: "300ms" }}
        >
          <div className="mb-8 border-b border-foreground/10 pb-6">
            <p className="font-mono text-xs uppercase tracking-widest text-foreground/40 mb-1">Расчёт</p>
            <h3 className="font-sans text-2xl font-light text-foreground md:text-3xl">
              {TABS.find((t) => t.key === activeTab)?.full}
            </h3>
          </div>
          <ActiveContent />
        </div>
      </div>
    </section>
  )
}