import { GrainOverlay } from "@/components/grain-overlay"
import { AboutSection } from "@/components/sections/about-section"
import { VentilationSection } from "@/components/sections/ventilation-section"
import { FirefightingSection } from "@/components/sections/firefighting-section"
import { ReferenceSection } from "@/components/sections/reference-section"
import { MagneticButton } from "@/components/magnetic-button"
import GlobalSearch from "@/components/GlobalSearch"
import { LicenseBanner } from "@/components/license-gate"
import { useRef, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import Icon from "@/components/ui/icon"
import { usePwaInstall } from "@/hooks/use-pwa-install"

const SECTION_IDS = ["hero", "ventilation", "firefighting", "explosion", "reference", "about"]

function SectionDivider({ index, label }: { index: number; label: string }) {
  return (
    <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-12 lg:px-16">
      <div className="flex items-center gap-4">
        <span className="font-mono text-[10px] text-foreground/30 tracking-widest uppercase shrink-0">
          {String(index).padStart(2, "0")} / {label}
        </span>
        <div className="h-px flex-1 bg-gradient-to-r from-foreground/20 to-transparent" />
      </div>
    </div>
  )
}

export default function Index() {
  const navigate = useNavigate()
  const { canInstall, install, isIos, isInStandalone } = usePwaInstall()
  const [iosHintDismissed, setIosHintDismissed] = useState(() => localStorage.getItem("ios_hint_dismissed") === "1")
  const showIosHint = isIos && !isInStandalone && !iosHintDismissed
  const dismissIosHint = () => { localStorage.setItem("ios_hint_dismissed", "1"); setIosHintDismissed(true) }
  const [currentSection, setCurrentSection] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [calcDropdownOpen, setCalcDropdownOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const shaderContainerRef = useRef<HTMLDivElement>(null)
  const scrollThrottleRef = useRef<number>()
  const dropdownCloseTimer = useRef<ReturnType<typeof setTimeout>>()
  const sectionRefs = useRef<(HTMLElement | null)[]>([])

  useEffect(() => {
    setIsLoaded(true)
  }, [])

  const scrollToSection = (index: number) => {
    const el = sectionRefs.current[index]
    if (el) {
      el.scrollIntoView({ behavior: "smooth" })
      setCurrentSection(index)
    }
  }

  useEffect(() => {
    const handleScroll = () => {
      if (scrollThrottleRef.current) return

      scrollThrottleRef.current = requestAnimationFrame(() => {
        const scrollY = window.scrollY + window.innerHeight / 3

        let active = 0
        sectionRefs.current.forEach((el, i) => {
          if (el && el.offsetTop <= scrollY) {
            active = i
          }
        })

        if (active !== currentSection) {
          setCurrentSection(active)
        }

        scrollThrottleRef.current = undefined
      })
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", handleScroll)
      if (scrollThrottleRef.current) {
        cancelAnimationFrame(scrollThrottleRef.current)
      }
    }
  }, [currentSection])

  return (
    <main className="relative w-full bg-background">
      <GrainOverlay />

      <div
        ref={shaderContainerRef}
        className={`fixed inset-0 z-0 transition-opacity duration-700 ${isLoaded ? "opacity-100" : "opacity-0"}`}
        style={{ contain: "strict" }}
      >
        <div className="absolute inset-0 animated-bg" />
        <div className="absolute inset-0 bg-black/10" />
      </div>

      <nav
        className={`fixed left-0 right-0 top-0 z-[60] flex items-center justify-between px-6 py-6 transition-opacity duration-700 md:px-12 bg-background/60 backdrop-blur-md border-b border-foreground/10 ${
          isLoaded ? "opacity-100" : "opacity-0"
        }`}
      >
        <button
          onClick={() => scrollToSection(0)}
          className="flex items-center gap-2 transition-transform hover:scale-105"
        >
          <img src="https://cdn.poehali.dev/projects/9e0b7c43-fecb-4248-943e-e190c3206477/bucket/cdb64365-d7bf-41f9-85c0-39b1dd2dc03f.png" alt="СДС" className="h-10 w-10 object-contain" />
          <div className="flex flex-col items-start leading-tight">
            <span className="font-sans text-xl font-semibold tracking-tight text-foreground">СДС</span>
            <span className="font-sans text-[10px] text-foreground/60 tracking-wide -mt-0.5 whitespace-nowrap">Расчёты для шахт и рудников</span>
          </div>
        </button>

        <div className="hidden items-center gap-8 md:flex">
          {/* Главная */}
          <button
            onClick={() => scrollToSection(0)}
            className={`group relative font-sans text-sm font-medium transition-colors ${
              currentSection === 0 ? "text-foreground" : "text-foreground/80 hover:text-foreground"
            }`}
          >
            Главная
            <span className={`absolute -bottom-1 left-0 h-px bg-foreground transition-all duration-300 ${currentSection === 0 ? "w-full" : "w-0 group-hover:w-full"}`} />
          </button>

          {/* Расчёты — дропдаун */}
          <div
            className="relative"
            onMouseEnter={() => { clearTimeout(dropdownCloseTimer.current); setCalcDropdownOpen(true) }}
            onMouseLeave={() => { dropdownCloseTimer.current = setTimeout(() => setCalcDropdownOpen(false), 150) }}
          >
            <button
              className={`group relative font-sans text-sm font-medium transition-colors flex items-center gap-1 ${
                [1, 2, 3].includes(currentSection) ? "text-foreground" : "text-foreground/80 hover:text-foreground"
              }`}
            >
              Расчёты
              <Icon name="ChevronDown" size={14} className={`transition-transform duration-200 ${calcDropdownOpen ? "rotate-180" : ""}`} />
              <span className={`absolute -bottom-1 left-0 h-px bg-foreground transition-all duration-300 ${[1, 2, 3].includes(currentSection) ? "w-full" : "w-0 group-hover:w-full"}`} />
            </button>
            {calcDropdownOpen && (
              <div className="absolute left-0 top-full z-50" style={{paddingTop: '8px'}}>
                <div className="absolute inset-x-0 top-0 h-2" />

                <div className="rounded-xl border border-foreground/10 bg-background/95 backdrop-blur-md shadow-lg overflow-hidden min-w-[200px]">
                  {[
                    { label: "Вентиляция", index: 1 },
                    { label: "Пожаротушение", index: 2 },
                    { label: "Взрываемость", index: 3 },
                  ].map(({ label, index }) => (
                    <button
                      key={label}
                      onClick={() => { scrollToSection(index); setCalcDropdownOpen(false) }}
                      className={`w-full text-left px-4 py-2.5 font-sans text-sm transition-colors ${
                        currentSection === index ? "bg-foreground/10 text-foreground" : "text-foreground/75 hover:bg-foreground/5 hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                  <div className="mx-3 h-px bg-foreground/10" />
                  <button
                    onClick={() => { navigate("/explosion-triangle"); setCalcDropdownOpen(false) }}
                    className="w-full text-left px-4 py-2.5 font-sans text-sm text-foreground/75 hover:bg-foreground/5 hover:text-foreground transition-colors flex items-center justify-between gap-3"
                  >
                    <span>Треугольник взрываемости</span>
                    <Icon name="ExternalLink" size={12} className="text-foreground/40 shrink-0" />
                  </button>
                  <button
                    onClick={() => { navigate("/emergency-scheme"); setCalcDropdownOpen(false) }}
                    className="w-full text-left px-4 py-2.5 font-sans text-sm text-foreground/75 hover:bg-foreground/5 hover:text-foreground transition-colors flex items-center justify-between gap-3"
                  >
                    <span className="flex items-center gap-2"><Icon name="AlertTriangle" size={12} className="text-accent" />Схема аварии</span>
                    <Icon name="ExternalLink" size={12} className="text-foreground/40 shrink-0" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Справочник */}
          <button
            onClick={() => scrollToSection(4)}
            className={`group relative font-sans text-sm font-medium transition-colors ${
              currentSection === 4 ? "text-foreground" : "text-foreground/80 hover:text-foreground"
            }`}
          >
            Справочник
            <span className={`absolute -bottom-1 left-0 h-px bg-foreground transition-all duration-300 ${currentSection === 4 ? "w-full" : "w-0 group-hover:w-full"}`} />
          </button>

          {/* О нас */}
          <button
            onClick={() => scrollToSection(5)}
            className={`group relative font-sans text-sm font-medium transition-colors ${
              currentSection === 5 ? "text-foreground" : "text-foreground/80 hover:text-foreground"
            }`}
          >
            О нас
            <span className={`absolute -bottom-1 left-0 h-px bg-foreground transition-all duration-300 ${currentSection === 5 ? "w-full" : "w-0 group-hover:w-full"}`} />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:block">
            <LicenseBanner />
          </div>
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-foreground/20 bg-foreground/5 px-3 py-2 text-foreground/60 transition-colors hover:border-foreground/40 hover:text-foreground"
            aria-label="Поиск"
          >
            <Icon name="Search" size={15} />
            <span className="hidden md:inline font-sans text-sm">Поиск</span>
          </button>
          {canInstall && (
            <button
              onClick={install}
              className="hidden md:flex items-center gap-2 rounded-lg border border-foreground/20 px-4 py-2 font-sans text-sm text-foreground/60 hover:border-foreground/40 hover:text-foreground transition-all"
            >
              <Icon name="Download" size={15} />
              Установить
            </button>
          )}
          <MagneticButton variant="secondary" onClick={() => scrollToSection(1)} className="hidden md:flex px-6 py-2.5 text-sm">
            Попробовать
          </MagneticButton>
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="flex items-center justify-center rounded-lg border border-foreground/20 bg-foreground/5 p-2 text-foreground/70 transition-colors hover:border-foreground/40 hover:text-foreground md:hidden"
            aria-label="Меню"
          >
            <Icon name={mobileMenuOpen ? "X" : "Menu"} size={18} />
          </button>
        </div>

        {/* Мобильная полоса лицензии + установка */}
        <div className="absolute left-0 right-0 top-full border-b border-foreground/10 bg-background/80 backdrop-blur-md md:hidden">
          <div className={`px-4 py-2 flex gap-2 ${canInstall ? "flex-col" : ""}`}>
            <LicenseBanner fullWidth />
            {canInstall && (
              <button
                onClick={install}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-foreground/20 px-3 py-1.5 text-xs text-foreground/60 hover:border-foreground/40 hover:text-foreground transition-all"
              >
                <Icon name="Download" size={14} />
                Установить приложение
              </button>
            )}
          </div>
        </div>

        {/* Мобильное меню */}
        {mobileMenuOpen && (
          <div className="absolute left-0 right-0 top-full border-b border-foreground/10 bg-background/95 backdrop-blur-md md:hidden">
            <div className="flex flex-col px-6 py-4 gap-1">
              {[{ label: "Главная", index: 0 }, { label: "Справочник", index: 4 }, { label: "О нас", index: 5 }].map(({ label, index }) => (
                <button
                  key={label}
                  onClick={() => { scrollToSection(index); setMobileMenuOpen(false) }}
                  className={`text-left px-3 py-2.5 rounded-lg font-sans text-sm transition-colors ${
                    currentSection === index
                      ? "bg-foreground/10 text-foreground"
                      : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
              <div className="my-1 h-px bg-foreground/10" />
              <span className="px-3 py-1 font-sans text-[10px] uppercase tracking-widest text-foreground/40">Расчёты</span>
              {[{ label: "Вентиляция", index: 1 }, { label: "Пожаротушение", index: 2 }, { label: "Взрываемость", index: 3 }].map(({ label, index }) => (
                <button
                  key={label}
                  onClick={() => { scrollToSection(index); setMobileMenuOpen(false) }}
                  className={`text-left px-3 py-2.5 rounded-lg font-sans text-sm transition-colors ${
                    currentSection === index
                      ? "bg-foreground/10 text-foreground"
                      : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
              <div className="my-2 h-px bg-foreground/10" />
              <button
                onClick={() => { navigate("/explosion-triangle"); setMobileMenuOpen(false) }}
                className="text-left px-3 py-2.5 rounded-lg font-sans text-sm text-foreground/70 hover:bg-foreground/5 hover:text-foreground transition-colors flex items-center justify-between"
              >
                <span>Треугольник взрываемости</span>
                <Icon name="ExternalLink" size={14} className="text-foreground/40" />
              </button>
              <button
                onClick={() => { navigate("/emergency-scheme"); setMobileMenuOpen(false) }}
                className="text-left px-3 py-2.5 rounded-lg font-sans text-sm text-foreground/70 hover:bg-foreground/5 hover:text-foreground transition-colors flex items-center justify-between"
              >
                <span>Схема аварии</span>
                <Icon name="ExternalLink" size={14} className="text-foreground/40" />
              </button>
              <div className="my-2 h-px bg-foreground/10" />
              <button
                onClick={() => { setMobileMenuOpen(false); setSearchOpen(true) }}
                className="text-left px-3 py-2.5 rounded-lg font-sans text-sm text-foreground/70 hover:bg-foreground/5 hover:text-foreground transition-colors flex items-center gap-2"
              >
                <Icon name="Search" size={14} />
                <span>Поиск</span>
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* iOS подсказка */}
      {showIosHint && (
        <div className="fixed bottom-0 left-0 right-0 z-[70] p-4 md:hidden">
          <div className="relative rounded-2xl border border-foreground/20 bg-background/95 backdrop-blur-md p-4 shadow-2xl">
            <button onClick={dismissIosHint} className="absolute right-3 top-3 text-foreground/40 hover:text-foreground transition-colors">
              <Icon name="X" size={16} />
            </button>
            <div className="flex items-start gap-3">
              <div className="shrink-0 rounded-xl bg-foreground/10 p-2">
                <Icon name="Share" size={20} className="text-foreground/70" />
              </div>
              <div>
                <p className="font-sans text-sm font-medium text-foreground">Установить как приложение</p>
                <p className="mt-1 font-mono text-xs text-foreground/50 leading-relaxed">
                  Нажми <span className="inline-flex items-center gap-0.5 rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-xs text-foreground/70"><Icon name="Share" size={10} /> Поделиться</span>, затем <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-foreground/70">На экран «Домой»</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`relative z-10 transition-opacity duration-700 ${isLoaded ? "opacity-100" : "opacity-0"}`}>
        {/* Hero Section */}
        <section
          id="hero"
          ref={(el) => { sectionRefs.current[0] = el }}
          className="flex min-h-screen w-full flex-col justify-end px-6 pb-16 pt-24 md:px-12 md:pb-24"
        >
          <div className="mx-auto w-full max-w-7xl">
          <div className="flex flex-col gap-12 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-block animate-in fade-in slide-in-from-bottom-4 rounded-full border border-foreground/20 bg-foreground/15 px-4 py-1.5 backdrop-blur-md duration-700">
                <p className="font-mono text-xs text-foreground/90">Инженерное ПО для СДС и ГИО</p>
              </div>
              <h1 className="mb-6 animate-in fade-in slide-in-from-bottom-8 font-sans text-6xl font-light leading-[1.1] tracking-tight text-foreground duration-1000 md:text-7xl lg:text-8xl">
                <span className="text-balance">
                  Расчёты СДС и ГИО
                </span>
              </h1>
              <p className="mb-8 max-w-xl animate-in fade-in slide-in-from-bottom-4 text-lg leading-relaxed text-foreground/90 duration-1000 delay-200 md:text-xl">
                <span className="text-pretty">Профессиональный инструмент для Службы депрессионных съемок и группы инженерного обеспечения ФГУП "ВГСЧ"</span>
              </p>
              <div className="flex animate-in fade-in slide-in-from-bottom-4 flex-col gap-4 duration-1000 delay-300 sm:flex-row sm:items-center">
                <MagneticButton
                  size="lg"
                  variant="primary"
                  onClick={() => scrollToSection(1)}
                >
                  Начать расчет
                </MagneticButton>
                <MagneticButton size="lg" variant="secondary" onClick={() => scrollToSection(4)}>
                  О нас
                </MagneticButton>
              </div>
            </div>

            {/* Панель быстрого доступа к расчётам */}
            <div className="animate-in fade-in slide-in-from-right-8 duration-1000 delay-400 lg:pb-2">
              <p className="mb-3 font-mono text-xs text-foreground/40 uppercase tracking-widest">Расчёты</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
                {[
                  { label: "Схема аварии", href: "/emergency-scheme", icon: "AlertTriangle", available: true },
                  { label: "Вентиляция", href: "#ventilation", icon: "Wind", available: true },
                  { label: "Пожаротушение", href: "#firefighting", icon: "Flame", available: true },
                  { label: "Пожарная нагрузка", href: "/fire-load", icon: "Layers", available: true },
                  { label: "Устойчивость", href: null, icon: "ShieldCheck", available: false },
                  { label: "ЗВТ", href: null, icon: "Zap", available: false },
                  { label: "Треугольник", href: "/explosion-triangle", icon: "Triangle", available: true },
                  { label: "Пакетный расчет", href: null, icon: "Package", available: false },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      if (!item.available) return;
                      if (item.href?.startsWith("/")) {
                        window.location.href = item.href;
                      } else if (item.href?.startsWith("#")) {
                        const idx = item.href === "#ventilation" ? 1 : item.href === "#firefighting" ? 2 : 0;
                        scrollToSection(idx);
                      }
                    }}
                    disabled={!item.available}
                    className={`group relative flex items-center gap-2.5 rounded-xl border px-4 py-3 text-left transition-all duration-200
                      ${item.available
                        ? "border-foreground/20 bg-foreground/8 hover:border-foreground/40 hover:bg-foreground/15 cursor-pointer"
                        : "border-foreground/10 bg-foreground/4 cursor-default opacity-50"
                      }`}
                  >
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-200
                      ${item.available
                        ? "bg-blue-500/20 text-blue-400 group-hover:bg-blue-500/30"
                        : "bg-foreground/8 text-foreground/30"
                      }`}>
                      <Icon name={item.icon} size={14} />
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-sm font-medium leading-tight ${item.available ? "text-foreground/90" : "text-foreground/40"}`}>
                        {item.label}
                      </span>
                      {!item.available && (
                        <span className="font-mono text-[10px] text-foreground/30 leading-tight">в разработке</span>
                      )}
                    </div>
                    {item.available && (
                      <Icon name="ChevronRight" size={12} className="ml-auto text-foreground/30 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground/60" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-in fade-in duration-1000 delay-500">
            <div className="flex items-center gap-2">
              <p className="font-mono text-xs text-foreground/80">Листайте вниз</p>
              <div className="flex h-6 w-6 items-center justify-center rounded-full border border-foreground/20 bg-foreground/15 backdrop-blur-md">
                <div className="h-2 w-2 animate-bounce rounded-full bg-foreground/80" />
              </div>
            </div>
          </div>
        </section>

        <SectionDivider index={1} label="Вентиляция" />
        <VentilationSection sectionRef={(el) => { sectionRefs.current[1] = el }} />
        <SectionDivider index={2} label="Пожаротушение" />
        <FirefightingSection sectionRef={(el) => { sectionRefs.current[2] = el }} />
        <SectionDivider index={3} label="Взрываемость" />
        <section
          id="explosion"
          ref={(el) => { sectionRefs.current[3] = el }}
          className="relative z-10 w-full px-6 py-20 md:px-12 lg:px-16"
        >
          <div className="mx-auto w-full max-w-7xl">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <p className="mb-2 font-mono text-xs text-foreground/40 uppercase tracking-widest">Анализ газовой смеси</p>
              <h2 className="mb-3 font-sans text-4xl font-light tracking-tight text-foreground md:text-5xl">
                Треугольник взрываемости
              </h2>
              <p className="text-foreground/60 text-base leading-relaxed">
                Определение зоны взрываемости по трём параметрам: концентрация газа, O₂ и N₂.
                Диаграмма Гиббса с интерактивным выбором точки состава.
                Поддерживает метан, водород, угарный газ, этан, пропан и ацетилен.
              </p>
            </div>
            <button
              onClick={() => navigate("/explosion-triangle")}
              className="shrink-0 flex items-center gap-3 rounded-xl border border-foreground/20 bg-foreground/5 px-8 py-4 font-sans text-sm font-medium text-foreground transition-all hover:border-foreground/40 hover:bg-foreground/10"
            >
              Открыть расчёт
              <span className="font-mono text-foreground/40">→</span>
            </button>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Метан CH₄",       lel: "5%",   uel: "15%" },
              { label: "Водород H₂",      lel: "4%",   uel: "75%" },
              { label: "Угарный газ CO",  lel: "12.5%",uel: "74%" },
              { label: "Этан C₂H₆",      lel: "3%",   uel: "12.5%" },
            ].map(({ label, lel, uel }) => (
              <div key={label} className="rounded-lg border border-foreground/10 bg-foreground/5 px-4 py-3">
                <p className="font-mono text-xs text-foreground/40 mb-1">{label}</p>
                <p className="font-mono text-xs text-foreground/70">НПВ {lel} · ВПВ {uel}</p>
              </div>
            ))}
          </div>
          </div>
        </section>
        <SectionDivider index={4} label="Справочник" />
        <ReferenceSection sectionRef={(el) => { sectionRefs.current[4] = el }} />
        <SectionDivider index={5} label="О нас" />
        <AboutSection scrollToSection={scrollToSection} sectionRef={(el) => { sectionRefs.current[5] = el }} />
      </div>
      <footer className="relative z-10 border-t border-foreground/10 py-4 text-center">
        <p className="font-sans text-xs text-foreground/40">
          Разработчик: СДС филиала «Копейский ВГСО» С.Г. Ипатов
        </p>
      </footer>
      <style>{`section { scroll-margin-top: 80px; }`}</style>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} scrollToSection={scrollToSection} />
    </main>
  )
}