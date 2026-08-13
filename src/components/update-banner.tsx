import { useEffect, useState } from "react"
import Icon from "@/components/ui/icon"

declare global {
  interface Window { __swUpdateReady?: boolean }
}

export function UpdateBanner() {
  const [ready, setReady] = useState(false)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    if (window.__swUpdateReady) setReady(true)
    const on = () => setReady(true)
    window.addEventListener("sw-update-ready", on)
    return () => window.removeEventListener("sw-update-ready", on)
  }, [])

  const apply = async () => {
    setApplying(true)
    try {
      const reg = await navigator.serviceWorker?.getRegistration()
      if (reg?.waiting) {
        reg.waiting.postMessage("SKIP_WAITING")
        // Если controllerchange не сработает — перезагружаем принудительно
        setTimeout(() => location.reload(), 1500)
      } else {
        location.reload()
      }
    } catch {
      location.reload()
    }
  }

  if (!ready) return null

  return (
    <div className="fixed bottom-4 left-1/2 z-[300] -translate-x-1/2 px-4 w-full max-w-md">
      <div className="flex items-center gap-3 rounded-xl border border-blue-400/40 bg-background/95 backdrop-blur px-4 py-3 shadow-2xl">
        <Icon name="RefreshCw" size={18} className="shrink-0 text-blue-400" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Доступна новая версия</p>
          <p className="text-xs text-foreground/50">Обновите, чтобы получить последние изменения</p>
        </div>
        <button
          onClick={apply}
          disabled={applying}
          className="shrink-0 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600 transition-colors disabled:opacity-60"
        >
          {applying ? "Обновляю…" : "Обновить"}
        </button>
        <button
          onClick={() => setReady(false)}
          className="shrink-0 text-foreground/30 hover:text-foreground/70 transition-colors"
          title="Позже"
        >
          <Icon name="X" size={16} />
        </button>
      </div>
    </div>
  )
}

export default UpdateBanner
