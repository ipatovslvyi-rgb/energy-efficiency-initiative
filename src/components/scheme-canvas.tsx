import { forwardRef } from "react"

/**
 * Обёртка области схемы.
 * Символы и рисунки позиционируются относительно САМОЙ картинки,
 * а не контейнера — иначе при разных пропорциях редактора и превью
 * они смещаются относительно изображения.
 */
export const SchemeCanvas = forwardRef<HTMLDivElement, {
  imageUrl: string
  children?: React.ReactNode
  onClick?: (e: React.MouseEvent) => void
  onMouseMove?: (e: React.MouseEvent) => void
  onMouseUp?: (e: React.MouseEvent) => void
  onMouseLeave?: (e: React.MouseEvent) => void
  className?: string
}>(({ imageUrl, children, onClick, onMouseMove, onMouseUp, onMouseLeave, className }, ref) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    }}
  >
    <div
      ref={ref}
      className={className}
      style={{
        position: "relative",
        display: "inline-block",
        maxWidth: "100%",
        maxHeight: "100%",
        lineHeight: 0,
      }}
      onClick={onClick}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    >
      <img
        src={imageUrl}
        alt="Схема"
        draggable={false}
        className="pointer-events-none"
        style={{
          display: "block",
          maxWidth: "100%",
          maxHeight: "100%",
          width: "auto",
          height: "auto",
        }}
      />
      {children}
    </div>
  </div>
))

SchemeCanvas.displayName = "SchemeCanvas"

export default SchemeCanvas
