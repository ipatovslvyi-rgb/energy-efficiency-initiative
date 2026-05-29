import { GrainOverlay } from "@/components/grain-overlay"
import { FirefightingSection } from "@/components/sections/firefighting-section"
import { useNavigate } from "react-router-dom"
import Icon from "@/components/ui/icon"

export default function Firefighting() {
  const navigate = useNavigate()

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <GrainOverlay />
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 animated-bg" />
        <div className="absolute inset-0 bg-black/10" />
      </div>

      <div className="sticky top-0 z-40 border-b border-foreground/10 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3 md:px-12">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 rounded-lg border border-foreground/20 px-3 py-1.5 text-sm text-foreground/70 transition-all hover:border-foreground/40 hover:text-foreground"
            >
              <Icon name="ArrowLeft" size={14} />
              Главная
            </button>
            <span className="text-foreground/20">/</span>
            <span className="font-sans text-sm font-medium text-foreground">Пожаротушение</span>
          </div>
        </div>
      </div>

      <div className="relative z-10">
        <FirefightingSection />
      </div>
    </div>
  )
}