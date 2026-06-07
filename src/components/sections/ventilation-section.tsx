import { useReveal } from "@/hooks/use-reveal"
import { useState } from "react"
import { AreaCalculator, ResistanceCalculator, LeakageCalculator, GeometryResistanceCalculator } from "./ventilation-tabs-1"
import { DepressionCalculator, FanReserveCalculator } from "./ventilation-tabs-2"

type TabKey = "area" | "resistance" | "leakage" | "depression" | "fan-reserve" | "geo-resistance"

const TABS: { key: TabKey; label: string; full: string; short: string }[] = [
  { key: "area",           label: "Площадь сечения",            full: "Площадь сечения канала вентиляции",                        short: "Сечение" },
  { key: "resistance",     label: "Аэродин. сопротивление",     full: "Аэродинамическое сопротивление выработки",                 short: "Сопротивл." },
  { key: "geo-resistance", label: "Сопр. по геометрии",         full: "Сопротивление выработки по геометрии и типу крепи",        short: "Сопр. геом." },
  { key: "leakage",        label: "Утечки надшахтного здания",  full: "Нормативные утечки воздуха через надшахтное здание",       short: "Утечки" },
  { key: "depression",     label: "Депрессия шахты",            full: "Расчёт депрессии и количества воздуха в шахте",            short: "Депрессия" },
  { key: "fan-reserve",    label: "Резерв подачи ГВУ",          full: "Резерв подачи вентиляторов главного проветривания (ΔQ)",   short: "Резерв ГВУ" },
]

export function VentilationSection({ sectionRef }: { sectionRef?: (el: HTMLElement | null) => void } = {}) {
  const { ref, isVisible } = useReveal(0.3)
  const [activeTab, setActiveTab] = useState<TabKey>("area")

  const activeTabData = TABS.find((t) => t.key === activeTab)!

  return (
    <section
      ref={(el) => { ref.current = el; sectionRef?.(el) }}
      className="flex min-h-screen w-full items-start px-6 py-24 md:px-12 lg:px-16"
    >
      <div className="mx-auto w-full max-w-7xl">
        <div
          className={`mb-10 transition-all duration-700 md:mb-14 ${
            isVisible ? "translate-y-0 opacity-100" : "-translate-y-12 opacity-0"
          }`}
        >
          <h2 className="mb-2 font-sans text-5xl font-light tracking-tight text-foreground md:text-6xl lg:text-7xl">
            Вентиляция
          </h2>
          <p className="font-mono text-sm text-foreground/60 md:text-base">/ Расчёты для горных выработок</p>
        </div>

        <div
          className={`mb-10 transition-all duration-700 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}
          style={{ transitionDelay: "100ms" }}
        >
          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-lg border px-4 py-2 font-mono text-xs transition-all ${
                  activeTab === tab.key
                    ? "border-foreground bg-foreground text-background"
                    : "border-foreground/20 text-foreground/60 hover:border-foreground/40 hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div
          className={`transition-all duration-700 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}
          style={{ transitionDelay: "200ms" }}
        >
          <div className="mb-8 border-b border-foreground/10 pb-6">
            <p className="font-mono text-xs uppercase tracking-widest text-foreground/40 mb-1">Расчёт</p>
            <h3 className="font-sans text-2xl font-light text-foreground md:text-3xl">
              {activeTabData.full}
            </h3>
          </div>

          {activeTab === "area"           && <AreaCalculator />}
          {activeTab === "resistance"     && <ResistanceCalculator />}
          {activeTab === "geo-resistance" && <GeometryResistanceCalculator />}
          {activeTab === "leakage"        && <LeakageCalculator />}
          {activeTab === "depression"     && <DepressionCalculator />}
          {activeTab === "fan-reserve"    && <FanReserveCalculator />}
        </div>
      </div>
    </section>
  )
}