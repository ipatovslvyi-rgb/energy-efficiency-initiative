export interface Stroke {
  id: string
  color: string
  width: number
  points: { x: number; y: number }[]
}

export type SchemeTool = "select" | "pencil" | "eraser"

const toPath = (s: Stroke) =>
  s.points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ")

export function SchemeDrawLayer({
  strokes,
  tool,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  strokes: Stroke[]
  tool: SchemeTool
  onPointerDown: (e: React.PointerEvent<SVGSVGElement>) => void
  onPointerMove: (e: React.PointerEvent<SVGSVGElement>) => void
  onPointerUp: (e: React.PointerEvent<SVGSVGElement>) => void
}) {
  const active = tool !== "select"
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 20,
        pointerEvents: active ? "auto" : "none",
        cursor: tool === "pencil" ? "crosshair" : tool === "eraser" ? "cell" : "default",
        touchAction: "none",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {strokes.map(s => (
        <path
          key={s.id}
          d={toPath(s)}
          fill="none"
          stroke={s.color}
          strokeWidth={s.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  )
}

export default SchemeDrawLayer