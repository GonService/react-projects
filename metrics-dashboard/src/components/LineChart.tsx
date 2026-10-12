import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { areaPath, extent, formatDateTime, formatTime, linePath, linearScale, nearestIndex, niceTicks, timeTicks } from "../stats";
import type { Series } from "../types";

export interface ChartSeries {
  series: Series;
  label: string;
  /** CSS custom property name holding the colour, e.g. "--c1". */
  color: string;
  area?: boolean;
}

interface Props {
  title: string;
  subtitle?: string;
  lines: ChartSeries[];
  format: (v: number | null) => string;
  tickFormat?: (v: number) => string;
  threshold?: { value: number; label: string };
  /** Minimum top of the y axis, e.g. 100 for percentages that should keep context. */
  minMax?: number;
  height?: number;
}

const M = { top: 12, right: 14, bottom: 26, left: 48 };

/**
 * Hand-drawn SVG line/area chart with a hover and keyboard crosshair. Focus the chart and use
 * the arrow keys (Home/End jump to the edges) to read exact values.
 */
export function LineChart({ title, subtitle, lines, format, tickFormat = (v) => String(v), threshold, minMax = 0, height = 220 }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [cursor, setCursor] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setWidth(Math.max(260, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const base = lines[0]?.series.points ?? [];
  const start = base[0]?.[0] ?? 0;
  const end = base.at(-1)?.[0] ?? 1;
  const maxData = Math.max(...lines.map((l) => extent(l.series.points)?.[1] ?? 0));
  const top = Math.max(minMax, threshold ? threshold.value * 1.15 : 0, maxData * 1.05);
  const yTicks = niceTicks(top, height < 200 ? 3 : 4);
  const yMax = yTicks.at(-1)!;
  const innerW = width - M.left - M.right;
  const innerH = height - M.top - M.bottom;
  const s = { x: linearScale(start, end, M.left, M.left + innerW), y: linearScale(0, yMax, M.top + innerH, M.top) };
  const xTicks = timeTicks(start, end, Math.max(2, Math.floor(innerW / 90)));

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = start + ((e.clientX - rect.left - M.left) / innerW) * (end - start);
    setCursor(nearestIndex(base, t));
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const last = base.length - 1;
    const step = e.shiftKey ? 10 : 1;
    const moves: Record<string, number> = {
      ArrowLeft: Math.max(0, (cursor ?? last + 1) - step),
      ArrowRight: Math.min(last, (cursor ?? -1) + step),
      Home: 0,
      End: last,
    };
    if (e.key in moves) {
      e.preventDefault();
      setCursor(moves[e.key]!);
    } else if (e.key === "Escape") setCursor(null);
  };

  const cursorT = cursor !== null ? base[cursor]?.[0] : undefined;
  const tooltipLeft = cursorT !== undefined ? s.x(cursorT) : 0;
  const latestText = lines.map((l) => `${l.label} ${format(l.series.points.at(-1)?.[1] ?? null)}`).join(", ");

  return (
    <figure className="chart">
      <figcaption>
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {lines.length > 1 && (
          <ul className="legend">
            {lines.map((l) => (
              <li key={l.label} style={{ ["--swatch" as string]: `var(${l.color})` }}>{l.label}</li>
            ))}
          </ul>
        )}
      </figcaption>
      <div className="chart-body" ref={wrap}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          tabIndex={0}
          role="img"
          aria-label={`${title}. Latest: ${latestText}. Use the arrow keys to read values.`}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setCursor(null)}
          onKeyDown={onKeyDown}
          onBlur={() => setCursor(null)}
        >
          {yTicks.map((v) => (
            <g key={v}>
              <line className="grid" x1={M.left} x2={M.left + innerW} y1={s.y(v)} y2={s.y(v)} />
              <text className="tick" x={M.left - 8} y={s.y(v)} dy="0.32em" textAnchor="end">{tickFormat(v)}</text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t} className="tick" x={s.x(t)} y={height - 8} textAnchor="middle">{formatTime(t, end - start)}</text>
          ))}
          {threshold && (
            <g className="threshold">
              <line x1={M.left} x2={M.left + innerW} y1={s.y(threshold.value)} y2={s.y(threshold.value)} />
              <text x={M.left + innerW - 4} y={s.y(threshold.value) - 5} textAnchor="end">{threshold.label}</text>
            </g>
          )}
          {lines.map((l) => (
            <g key={l.label} style={{ ["--stroke" as string]: `var(${l.color})` }}>
              {l.area && <path className="area" d={areaPath(l.series.points, s, M.top + innerH)} />}
              <path className="line" d={linePath(l.series.points, s)} />
            </g>
          ))}
          {cursorT !== undefined && (
            <g className="cursor">
              <line x1={s.x(cursorT)} x2={s.x(cursorT)} y1={M.top} y2={M.top + innerH} />
              {lines.map((l) => {
                const v = l.series.points[cursor!]?.[1];
                return v == null ? null : <circle key={l.label} cx={s.x(cursorT)} cy={s.y(v)} r={3.5} style={{ fill: `var(${l.color})` }} />;
              })}
            </g>
          )}
        </svg>
        {cursorT !== undefined && (
          <div className={`tooltip${tooltipLeft > width * 0.6 ? " left" : ""}`} style={{ left: tooltipLeft }} role="status">
            <p className="tooltip-time">{formatDateTime(cursorT)}</p>
            {lines.map((l) => (
              <p key={l.label} style={{ ["--swatch" as string]: `var(${l.color})` }}>
                <span>{l.label}</span>
                <strong>{format(l.series.points[cursor!]?.[1] ?? null)}</strong>
              </p>
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}
