import { areaPath, extent, linePath, linearScale } from "../stats";
import type { Point } from "../types";

interface Props {
  points: Point[];
  width?: number;
  height?: number;
  tone?: "default" | "degraded" | "critical";
  label: string;
}

/** Tiny trend line. The y axis starts at the series minimum, so it shows shape, not magnitude. */
export function Sparkline({ points, width = 120, height = 28, tone = "default", label }: Props) {
  const ext = extent(points);
  if (!ext || points.length < 2) return <svg className="spark" width={width} height={height} role="img" aria-label={`${label}: no data`} />;
  const [lo, hi] = ext;
  const pad = (hi - lo) * 0.1 || 1;
  const s = {
    x: linearScale(points[0]![0], points.at(-1)![0], 1, width - 1),
    y: linearScale(lo - pad, hi + pad, height - 2, 2),
  };
  return (
    <svg className={`spark spark-${tone}`} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <path className="spark-area" d={areaPath(points, s, height)} />
      <path className="spark-line" d={linePath(points, s)} />
    </svg>
  );
}
