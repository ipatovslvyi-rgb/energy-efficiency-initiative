import { useNavigate } from "react-router-dom"
import { GrainOverlay } from "@/components/grain-overlay"
import { AboutSection } from "@/components/sections/about-section"
import Icon from "@/components/ui/icon"

export default function About() {
  const navigate = useNavigate()

  return (
    <div className="relative min-h-screen text-foreground">
      <GrainOverlay />
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 animated-bg" />
        <div className="absolute inset-0 bg-black/10" />
      </div>

      {/* Шапка */}
      <nav className="sticky top-0 z-40 border-b border-foreground/10 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3 md:px-10">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 rounded-lg border border-foreground/20 px-3 py-1.5 text-sm text-foreground/70 transition-all hover:border-foreground/40 hover:text-foreground"
          >
            <Icon name="ArrowLeft" size={14} />
            Назад
          </button>
          <div>
            <h1 className="font-sans text-base font-medium text-foreground">О нас</h1>
            <p className="font-mono text-xs text-foreground/40">СДС — Служба Депрессионных Съемок</p>
          </div>
        </div>
      </nav>

      {/* Контент */}
      <div className="relative z-10">
        <AboutSection />
      </div>
    </div>
  )
}
