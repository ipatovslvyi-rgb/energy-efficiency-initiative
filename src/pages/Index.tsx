import { GrainOverlay } from "@/components/grain-overlay"
import { MagneticButton } from "@/components/magnetic-button"
import GlobalSearch from "@/components/GlobalSearch"
import { LicenseBanner } from "@/components/license-gate"
import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import Icon from "@/components/ui/icon"
import { usePwaInstall } from "@/hooks/use-pwa-install"

export default function Index() {
  const navigate = useNavigate()
  const { isIos, isInStandalone } = usePwaInstall()
  const [iosHintDismissed, setIosHintDismissed] = useState(() => localStorage.getItem("ios_hint_dismissed") === "1")
  const showIosHint = isIos && !isInStandalone && !iosHintDismissed
  const dismissIosHint = () => { localStorage.setItem("ios_hint_dismissed", "1"); setIosHintDismissed(true) }
  const [isLoaded, setIsLoaded] = useState(false)
  const [calcDropdownOpen, setCalcDropdownOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const shaderContainerRef = useRef<HTMLDivElement>(null)
  const dropdownCloseTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    setIsLoaded(true)
  }, [])

  const CALCS = [
    { label: "Схема аварии",      href: "/emergency-scheme",   icon: "AlertTriangle", available: true },
    { label: "Вентиляция",        href: "/ventilation",         icon: "Wind",          available: false },
    { label: "Пожаротушение",     href: "/firefighting",        icon: "Flame",         available: false },
    { label: "Пожарная нагрузка", href: "/fire-load",           icon: "Layers",        available: true },
    { label: "Устойчивость",      href: null,                   icon: "ShieldCheck",   available: false },
    { label: "ЗВТ",               href: null,                   icon: "Zap",           available: false },
    { label: "Треугольник",       href: "/explosion-triangle",  icon: "Triangle",      available: true },
    { label: "Пакетный расчет",   href: null,                   icon: "Package",       available: false },
  ]

  return (
    <main className="relative w-full h-screen overflow-hidden bg-background text-foreground">
      <GrainOverlay />

      {/* Фоновый градиент */}
      <div
        ref={shaderContainerRef}
        className={`fixed inset-0 z-0 transition-opacity duration-700 ${isLoaded ? "opacity-100" : "opacity-0"}`}
        style={{ contain: "strict" }}
      >
        <div className="absolute inset-0 animated-bg" />
        <div className="absolute inset-0 bg-black/10" />
      </div>

      {/* Навигация */}
      <nav className={`fixed left-0 right-0 top-0 z-[60] flex items-center justify-between px-6 py-5 transition-opacity duration-700 md:px-12 bg-background/60 backdrop-blur-md border-b border-foreground/10 ${isLoaded ? "opacity-100" : "opacity-0"}`}>
        {/* Лого */}
        <button onClick={() => {}} className="flex items-center gap-2 transition-transform hover:scale-105">
          <img src="https://cdn.poehali.dev/projects/9e0b7c43-fecb-4248-943e-e190c3206477/bucket/cdb64365-d7bf-41f9-85c0-39b1dd2dc03f.png" alt="СДС" className="h-10 w-10 object-contain" />
          <div className="flex flex-col items-start leading-tight">
            <span className="font-sans text-xl font-semibold tracking-tight text-foreground">СДС</span>
            <span className="font-sans text-[10px] text-foreground/60 tracking-wide -mt-0.5 whitespace-nowrap">Расчёты для шахт и рудников</span>
          </div>
        </button>

        {/* Десктоп-меню */}
        <div className="hidden items-center gap-8 md:flex">
          <button className="group relative font-sans text-sm font-medium text-foreground">
            Главная
            <span className="absolute -bottom-1 left-0 h-px w-full bg-foreground" />
          </button>

          {/* Расчёты дропдаун */}
          <div
            className="relative"
            onMouseEnter={() => { clearTimeout(dropdownCloseTimer.current); setCalcDropdownOpen(true) }}
            onMouseLeave={() => { dropdownCloseTimer.current = setTimeout(() => setCalcDropdownOpen(false), 150) }}
          >
            <button className="group relative font-sans text-sm font-medium text-foreground/80 hover:text-foreground transition-colors flex items-center gap-1">
              Расчёты
              <Icon name="ChevronDown" size={14} className={`transition-transform duration-200 ${calcDropdownOpen ? "rotate-180" : ""}`} />
            </button>
            {calcDropdownOpen && (
              <div className="absolute left-0 top-full z-50" style={{ paddingTop: "8px" }}>
                <div className="rounded-xl border border-foreground/10 bg-background/95 backdrop-blur-md shadow-lg overflow-hidden min-w-[220px]">
                  {[
                    { label: "Схема аварии",      href: "/emergency-scheme",  icon: "AlertTriangle" },
                    { label: "Пожарная нагрузка", href: "/fire-load",         icon: "Layers" },
                    { label: "Треугольник взрываемости", href: "/explosion-triangle", icon: "Triangle" },
                  ].map(({ label, href, icon }) => (
                    <button
                      key={label}
                      onClick={() => { navigate(href); setCalcDropdownOpen(false) }}
                      className="w-full text-left px-4 py-2.5 font-sans text-sm text-foreground/75 hover:bg-foreground/5 hover:text-foreground transition-colors flex items-center gap-2.5"
                    >
                      <Icon name={icon} size={13} className="text-blue-400/70 shrink-0" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button className="font-sans text-sm font-medium text-foreground/80 hover:text-foreground transition-colors">Справочник</button>
          <button className="font-sans text-sm font-medium text-foreground/80 hover:text-foreground transition-colors">О нас</button>
        </div>

        {/* Правая часть */}
        <div className="hidden items-center gap-3 md:flex">
          <LicenseBanner />
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-foreground/20 px-3 py-1.5 font-sans text-sm text-foreground/70 transition-all hover:border-foreground/40 hover:text-foreground"
          >
            <Icon name="Search" size={14} />
            Поиск
          </button>
          <button
            onClick={() => navigate("/emergency-scheme")}
            className="rounded-lg bg-foreground px-4 py-1.5 font-sans text-sm font-medium text-background transition-all hover:bg-foreground/90"
          >
            Попробовать
          </button>
        </div>

        {/* Мобильный бургер */}
        <button
          onClick={() => setMobileMenuOpen(v => !v)}
          className="md:hidden rounded-lg border border-foreground/20 p-2 text-foreground/70"
        >
          <Icon name={mobileMenuOpen ? "X" : "Menu"} size={18} />
        </button>
      </nav>

      {/* Мобильное меню */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-md pt-20 px-6 pb-6 md:hidden">
          <div className="flex flex-col gap-1">
            {[
              { label: "Главная", action: () => setMobileMenuOpen(false) },
              { label: "Схема аварии", action: () => { navigate("/emergency-scheme"); setMobileMenuOpen(false) } },
              { label: "Пожарная нагрузка", action: () => { navigate("/fire-load"); setMobileMenuOpen(false) } },
              { label: "Треугольник взрываемости", action: () => { navigate("/explosion-triangle"); setMobileMenuOpen(false) } },
            ].map(({ label, action }) => (
              <button
                key={label}
                onClick={action}
                className="text-left px-3 py-3 rounded-xl font-sans text-base text-foreground/80 hover:bg-foreground/5 hover:text-foreground transition-colors"
              >
                {label}
              </button>
            ))}
            <div className="my-2 h-px bg-foreground/10" />
            <button
              onClick={() => { setMobileMenuOpen(false); setSearchOpen(true) }}
              className="text-left px-3 py-3 rounded-xl font-sans text-base text-foreground/80 hover:bg-foreground/5 hover:text-foreground transition-colors flex items-center gap-2"
            >
              <Icon name="Search" size={16} />
              Поиск
            </button>
          </div>
          <div className="mt-auto">
            <LicenseBanner />
          </div>
        </div>
      )}

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

      {/* Hero — занимает весь экран */}
      <div className={`relative z-10 flex h-full flex-col justify-center px-6 pt-20 pb-10 md:px-12 transition-opacity duration-700 ${isLoaded ? "opacity-100" : "opacity-0"}`}>
        <div className="mx-auto w-full max-w-7xl">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between lg:gap-16">

            {/* Левая часть */}
            <div className="max-w-2xl shrink-0">
              <div className="mb-5 inline-block animate-in fade-in slide-in-from-bottom-4 rounded-full border border-foreground/20 bg-foreground/15 px-4 py-1.5 backdrop-blur-md duration-700">
                <p className="font-mono text-xs text-foreground/90">Инженерное ПО для СДС и ГИО</p>
              </div>
              <h1 className="mb-5 animate-in fade-in slide-in-from-bottom-8 font-sans text-5xl font-light leading-[1.1] tracking-tight text-foreground duration-1000 md:text-6xl lg:text-[5.5rem]">
                <span className="text-balance">Расчёты СДС и ГИО</span>
              </h1>
              <p className="mb-8 max-w-xl animate-in fade-in slide-in-from-bottom-4 text-base leading-relaxed text-foreground/75 duration-1000 delay-200 md:text-lg">
                <span className="text-pretty">Профессиональный инструмент для Службы депрессионных съемок и группы инженерного обеспечения ФГУП "ВГСЧ"</span>
              </p>
              <div className="flex animate-in fade-in slide-in-from-bottom-4 flex-col gap-3 duration-1000 delay-300 sm:flex-row sm:items-center">
                <MagneticButton size="lg" variant="primary" onClick={() => navigate("/emergency-scheme")}>
                  Начать расчет
                </MagneticButton>
                <MagneticButton size="lg" variant="secondary" onClick={() => setSearchOpen(true)}>
                  О нас
                </MagneticButton>
              </div>
            </div>

            {/* Правая часть — панель расчётов */}
            <div className="animate-in fade-in slide-in-from-right-8 duration-1000 delay-400 w-full lg:max-w-md">
              <p className="mb-3 font-mono text-xs text-foreground/40 uppercase tracking-widest">Расчёты</p>
              <div className="grid grid-cols-2 gap-2">
                {CALCS.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => { if (item.available && item.href) navigate(item.href) }}
                    disabled={!item.available}
                    className={`group relative flex items-center gap-2.5 rounded-xl border px-4 py-3 text-left transition-all duration-200
                      ${item.available
                        ? "border-foreground/20 bg-foreground/8 hover:border-foreground/40 hover:bg-foreground/15 cursor-pointer"
                        : "border-foreground/8 bg-foreground/3 cursor-default opacity-40"
                      }`}
                  >
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-200
                      ${item.available
                        ? "bg-blue-500/20 text-blue-400 group-hover:bg-blue-500/30"
                        : "bg-foreground/8 text-foreground/25"
                      }`}>
                      <Icon name={item.icon} size={14} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className={`text-sm font-medium leading-tight ${item.available ? "text-foreground/90" : "text-foreground/35"}`}>
                        {item.label}
                      </span>
                      {!item.available && (
                        <span className="font-mono text-[10px] text-foreground/25 leading-tight">в разработке</span>
                      )}
                    </div>
                    {item.available && (
                      <Icon name="ChevronRight" size={12} className="ml-auto shrink-0 text-foreground/25 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground/60" />
                    )}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Футер */}
      <div className="absolute bottom-0 left-0 right-0 z-10 border-t border-foreground/8 py-3 text-center">
        <p className="font-sans text-xs text-foreground/30">
          Разработчик: СДС филиала «Копейский ВГСО» С.Г. Ипатов
        </p>
      </div>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} scrollToSection={() => {}} />
    </main>
  )
}
