import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export type ChartPoint = {
  /** Position auf der Zeitachse (Tage, darf Bruchteile haben) */
  t: number;
  value: number;
  dateLabel: string;
  valueLabel: string;
};

type Props = {
  points: ChartPoint[];
  /** sichtbarer Zeitraum [von, bis] in derselben Einheit wie `t` */
  domain: [number, number];
  formatTick: (value: number) => string;
  startLabel: string;
  endLabel: string;
  ariaLabel: string;
  height?: number;
};

const PAD = { left: 40, right: 14, top: 14, bottom: 24 };

function niceStep(raw: number) {
  const exp = 10 ** Math.floor(Math.log10(raw));
  const f = raw / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp;
}

/** 2–4 runde Hilfslinien über dem Wertebereich */
function yScaleTicks(min: number, max: number): number[] {
  let lo = min;
  let hi = max;
  if (hi - lo < 1e-9) {
    const pad = Math.abs(lo) * 0.02 || 1;
    lo -= pad;
    hi += pad;
  }
  const step = niceStep((hi - lo) / 2);
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Number(v.toFixed(6)));
  return ticks;
}

/**
 * Ein ruhiger Linienchart (eigenes SVG, keine Bibliothek): 2px-Linie in Orange, leichte Fläche,
 * wenige Achsenbeschriftungen, Endpunkt hervorgehoben. Antippen/Zeigen/Pfeiltasten zeigen den Wert.
 */
export function LineChart({ points, domain, formatTick, startLabel, endLabel, ariaLabel, height = 184 }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const ticks = yScaleTicks(Math.min(...points.map((p) => p.value)), Math.max(...points.map((p) => p.value)));
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const [d0, d1] = domain[1] - domain[0] < 1e-9 ? [domain[0] - 1, domain[1] + 1] : domain;
  const plotW = Math.max(10, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const X = (t: number) => PAD.left + ((t - d0) / (d1 - d0)) * plotW;
  const Y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${X(p.t).toFixed(1)} ${Y(p.value).toFixed(1)}`).join("");
  const bottom = PAD.top + plotH;
  const area =
    points.length > 1
      ? `${line}L${X(points[points.length - 1].t).toFixed(1)} ${bottom}L${X(points[0].t).toFixed(1)} ${bottom}Z`
      : "";

  const nearest = (clientX: number) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect || points.length === 0) return null;
    const x = clientX - rect.left;
    let best = 0;
    for (let i = 1; i < points.length; i += 1) {
      if (Math.abs(X(points[i].t) - x) < Math.abs(X(points[best].t) - x)) best = i;
    }
    return best;
  };

  const onPointer = (e: PointerEvent) => setActive(nearest(e.clientX));
  const onKey = (e: KeyboardEvent) => {
    if (points.length === 0) return;
    const current = active ?? points.length - 1;
    if (e.key === "ArrowLeft") setActive(Math.max(0, current - 1));
    else if (e.key === "ArrowRight") setActive(Math.min(points.length - 1, current + 1));
    else if (e.key === "Escape") setActive(null);
    else return;
    e.preventDefault();
  };

  const shown = active !== null ? points[active] : undefined;
  const last = points[points.length - 1];
  const showDots = points.length <= 40;
  const tooltipLeft = shown ? Math.min(Math.max(X(shown.t), 70), Math.max(70, width - 70)) : 0;

  return (
    <div
      ref={box}
      className="relative select-none outline-none focus-visible:ring-2 focus-visible:ring-accent-light/60 rounded-xl"
      style={{ height, touchAction: "pan-y" }}
      tabIndex={0}
      role="group"
      aria-label={ariaLabel}
      onKeyDown={onKey}
      onFocus={() => setActive((a) => a ?? points.length - 1)}
      onBlur={() => setActive(null)}
    >
      {width > 0 && (
        <svg
          width={width}
          height={height}
          aria-hidden
          onPointerDown={onPointer}
          onPointerMove={onPointer}
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") setActive(null);
          }}
        >
          <defs>
            <linearGradient id="body-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.16" />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Hilfslinien (Haarlinie, zurückhaltend) */}
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={PAD.left + plotW} y1={Y(tick)} y2={Y(tick)} stroke="var(--color-line)" strokeWidth="1" />
              <text x={PAD.left - 8} y={Y(tick) + 4} textAnchor="end" fontSize="11" fill="var(--color-subtle)" className="tabular">
                {formatTick(tick)}
              </text>
            </g>
          ))}
          <text x={PAD.left} y={height - 6} fontSize="11" fill="var(--color-subtle)">
            {startLabel}
          </text>
          <text x={PAD.left + plotW} y={height - 6} fontSize="11" textAnchor="end" fill="var(--color-subtle)">
            {endLabel}
          </text>

          {area && <path d={area} fill="url(#body-area)" />}
          {points.length > 1 && (
            <path d={line} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          )}
          {showDots &&
            points.slice(0, -1).map((p) => (
              <circle key={`${p.t}-${p.value}`} cx={X(p.t)} cy={Y(p.value)} r="2.5" fill="var(--color-accent)" />
            ))}
          {last && <circle cx={X(last.t)} cy={Y(last.value)} r="5" fill="var(--color-accent)" stroke="var(--color-card)" strokeWidth="2" />}

          {shown && (
            <g>
              <line x1={X(shown.t)} x2={X(shown.t)} y1={PAD.top} y2={bottom} stroke="var(--color-muted)" strokeWidth="1" />
              <circle cx={X(shown.t)} cy={Y(shown.value)} r="5.5" fill="var(--color-accent)" stroke="var(--color-card)" strokeWidth="2" />
            </g>
          )}
        </svg>
      )}
      {shown && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 -translate-y-2 rounded-xl border border-line bg-elevated px-3 py-1.5 text-center shadow-lg"
          style={{ left: tooltipLeft }}
          aria-live="polite"
        >
          <p className="whitespace-nowrap text-sm font-black">{shown.valueLabel}</p>
          <p className="whitespace-nowrap text-[11px] font-semibold text-muted">{shown.dateLabel}</p>
        </div>
      )}
    </div>
  );
}
