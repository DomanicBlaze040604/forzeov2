import { useState, useRef, useEffect, useMemo } from "react";

const CLIENT_COLOR = "#3b82f6";
const COMPETITOR_COLORS = ["#f43f5e", "#a855f7", "#14b8a6", "#f59e0b", "#ec4899"];

interface SOVSeriesItem {
  name: string;
  isClient: boolean;
  domain: string;
  data: (number | null)[];
}

interface SOVLineChartProps {
  labels: string[];
  series: SOVSeriesItem[];
  height?: number;
}

// Catmull-Rom to cubic bezier for ultra-smooth curves
function catmullRomPath(points: { x: number; y: number }[], alpha = 0.5): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;
  if (points.length === 2) return `M${points[0].x},${points[0].y}L${points[1].x},${points[1].y}`;

  const pts = [points[0], ...points, points[points.length - 1]];
  let d = `M${points[0].x},${points[0].y}`;

  for (let i = 1; i < pts.length - 2; i++) {
    const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2];

    const d1 = Math.sqrt(Math.pow(p1.x - p0.x, 2) + Math.pow(p1.y - p0.y, 2));
    const d2 = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    const d3 = Math.sqrt(Math.pow(p3.x - p2.x, 2) + Math.pow(p3.y - p2.y, 2));

    const d1a = Math.pow(d1, alpha), d2a = Math.pow(d2, alpha), d3a = Math.pow(d3, alpha);
    const d1a2 = Math.pow(d1, 2 * alpha), d2a2 = Math.pow(d2, 2 * alpha), d3a2 = Math.pow(d3, 2 * alpha);

    const b1x = (d1a2 * p2.x - d2a2 * p0.x + (2 * d1a2 + 3 * d1a * d2a + d2a2) * p1.x) / (3 * d1a * (d1a + d2a));
    const b1y = (d1a2 * p2.y - d2a2 * p0.y + (2 * d1a2 + 3 * d1a * d2a + d2a2) * p1.y) / (3 * d1a * (d1a + d2a));
    const b2x = (d3a2 * p1.x - d2a2 * p3.x + (2 * d3a2 + 3 * d3a * d2a + d2a2) * p2.x) / (3 * d3a * (d3a + d2a));
    const b2y = (d3a2 * p1.y - d2a2 * p3.y + (2 * d3a2 + 3 * d3a * d2a + d2a2) * p2.y) / (3 * d3a * (d3a + d2a));

    if (isNaN(b1x) || isNaN(b1y)) {
      d += ` L${p2.x},${p2.y}`;
    } else {
      d += ` C${b1x},${b1y} ${b2x},${b2y} ${p2.x},${p2.y}`;
    }
  }
  return d;
}

export function SOVLineChart({ labels, series, height = 240 }: SOVLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(700);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [animProgress, setAnimProgress] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setWidth(w);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Animate on mount
  useEffect(() => {
    let frame: number;
    const start = performance.now();
    const duration = 800;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      setAnimProgress(t < 1 ? t * t * (3 - 2 * t) : 1); // smoothstep
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [labels.length, series.length]);

  // Compute average SOV values for summary badges (matches KPI card aggregate)
  const avgValues = useMemo(() => {
    return series.map(s => {
      const valid = s.data.filter((v): v is number => v !== null);
      if (valid.length === 0) return 0;
      return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
    });
  }, [series]);

  // Sort: competitors behind, client on top (must be before early return)
  const sortedSeries = useMemo(() =>
    [...series.map((s, i) => ({ ...s, origIdx: i }))].sort((a, b) => (a.isClient ? 1 : 0) - (b.isClient ? 1 : 0)),
    [series]
  );

  const isEmpty = labels.length === 0 || series.length === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center text-gray-300 gap-3" style={{ height }}>
        <svg className="h-16 w-16 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 13l4-4 4 4 4-8 4 4" />
          <path strokeLinecap="round" strokeWidth={1} d="M3 17h18" />
        </svg>
        <span className="text-sm text-gray-400">Run audits to see SOV trends</span>
      </div>
    );
  }

  const pad = { top: 16, right: 20, bottom: 32, left: 44 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  // Dynamic Y-axis: auto-scale to max data value
  const allVals = series.flatMap(s => s.data.filter((v): v is number => v !== null));
  const rawMax = allVals.length > 0 ? Math.max(...allVals) : 100;
  const yMax = Math.min(100, Math.ceil(rawMax / 10) * 10 + 10);

  const xStep = labels.length > 1 ? chartW / (labels.length - 1) : chartW / 2;
  const getX = (i: number) => labels.length > 1 ? pad.left + i * xStep : pad.left + chartW / 2;
  const getY = (v: number) => pad.top + chartH - (v / yMax) * chartH;

  // Y-axis gridlines (dynamic based on yMax)
  const gridCount = 5;
  const gridLines = Array.from({ length: gridCount + 1 }, (_, i) => Math.round((yMax / gridCount) * i));

  const getColor = (_s: { isClient: boolean }, idx: number) =>
    _s.isClient ? CLIENT_COLOR : COMPETITOR_COLORS[(idx - 1) % COMPETITOR_COLORS.length] || "#9ca3af";

  // Collect non-null points into one continuous segment (skip gaps, don't break)
  const buildPathSegments = (data: (number | null)[]) => {
    const points: { x: number; y: number; idx: number }[] = [];
    data.forEach((v, i) => {
      if (v !== null) points.push({ x: getX(i), y: getY(v), idx: i });
    });
    return points.length > 0 ? [points] : [];
  };

  const buildFillPath = (points: { x: number; y: number }[]) => {
    if (points.length < 2) return "";
    const linePath = catmullRomPath(points);
    const bottom = pad.top + chartH;
    return `${linePath} L${points[points.length - 1].x},${bottom} L${points[0].x},${bottom} Z`;
  };

  const colWidth = labels.length > 1 ? chartW / labels.length : chartW;

  // Find peak point for client brand
  const clientSeries = series.find(s => s.isClient);
  const clientPeakIdx = clientSeries ? clientSeries.data.reduce<number>((best, v, i) =>
    v !== null && (clientSeries.data[best] === null || v > (clientSeries.data[best] ?? 0)) ? i : best, 0
  ) : -1;

  return (
    <div ref={containerRef} className="relative w-full" style={{ minHeight: height + 48 }}>
      {/* Summary badges row */}
      <div className="flex flex-wrap gap-2 mb-3">
        {series.map((s, si) => {
          const color = getColor(s, si);
          const val = avgValues[si];
          return (
            <div
              key={si}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all"
              style={{
                borderColor: s.isClient ? `${color}40` : "#e5e7eb",
                backgroundColor: s.isClient ? `${color}08` : "#fafafa",
              }}
            >
              <img
                src={`https://www.google.com/s2/favicons?domain=${s.domain}&sz=20`}
                alt=""
                className="h-5 w-5 rounded"
                onError={(e) => {
                  const el = e.target as HTMLImageElement;
                  el.style.display = "none";
                }}
              />
              <div className="flex flex-col">
                <span className="text-[11px] text-gray-500 leading-tight truncate max-w-[100px]">{s.name}</span>
                <span className="text-sm font-bold leading-tight" style={{ color }}>{val}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart area */}
      <div className="select-none" style={{ height }}>
        <svg width={width} height={height}>
          <defs>
            {/* Gradient fills */}
            {series.map((s, si) => {
              const color = getColor(s, si);
              return (
                <linearGradient key={`g-${si}`} id={`sov-g-${si}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={s.isClient ? 0.25 : 0.1} />
                  <stop offset="80%" stopColor={color} stopOpacity={0.02} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              );
            })}
            {/* Glow filter for client line */}
            <filter id="sov-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Drop shadow for tooltip dot */}
            <filter id="sov-dot-shadow">
              <feDropShadow dx="0" dy="1" stdDeviation="3" floodColor="#000" floodOpacity="0.15" />
            </filter>
          </defs>

          {/* Background subtle gradient */}
          <rect x={pad.left} y={pad.top} width={chartW} height={chartH} rx={8} fill="url(#sov-bg-gradient)" />
          <linearGradient id="sov-bg-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f8fafc" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>

          {/* Y gridlines - dashed, subtle */}
          {gridLines.map(v => (
            <g key={v}>
              <line
                x1={pad.left} y1={getY(v)}
                x2={pad.left + chartW} y2={getY(v)}
                stroke="#e5e7eb" strokeWidth={0.7}
                strokeDasharray={v === 0 ? "0" : "4 6"}
                opacity={v === 0 ? 0.6 : 0.4}
              />
              <text x={pad.left - 10} y={getY(v) + 4} textAnchor="end" fontSize={11} fill="#b0b8c4" fontFamily="system-ui">{v}%</text>
            </g>
          ))}

          {/* X-axis labels */}
          {labels.map((label, i) => {
            const step = labels.length <= 14 ? 1 : Math.ceil(labels.length / 7);
            if (i % step !== 0 && i !== labels.length - 1) return null;
            return (
              <text key={i} x={getX(i)} y={height - 10} textAnchor="middle" fontSize={11} fill="#b0b8c4" fontFamily="system-ui">{label}</text>
            );
          })}

          {/* Hover column */}
          {hoveredIdx !== null && (
            <line
              x1={getX(hoveredIdx)} y1={pad.top}
              x2={getX(hoveredIdx)} y2={pad.top + chartH}
              stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" opacity={0.5}
            />
          )}

          {/* Area fills with clip for animation */}
          <clipPath id="sov-anim-clip">
            <rect x={pad.left} y={pad.top} width={chartW * animProgress} height={chartH + pad.bottom} />
          </clipPath>

          <g clipPath="url(#sov-anim-clip)">
            {/* Gradient fills for ALL series */}
            {sortedSeries.map(s => {
              const si = s.origIdx;
              const segments = buildPathSegments(s.data);
              return segments.map((seg, segIdx) => {
                const fillD = buildFillPath(seg);
                if (!fillD) return null;
                return <path key={`fill-${si}-${segIdx}`} d={fillD} fill={`url(#sov-g-${si})`} />;
              });
            })}

            {/* Lines */}
            {sortedSeries.map(s => {
              const si = s.origIdx;
              const color = getColor(s, si);
              const segments = buildPathSegments(s.data);
              return segments.map((seg, segIdx) => (
                <g key={`line-${si}-${segIdx}`}>
                  {/* Glow shadow for client */}
                  {s.isClient && (
                    <path
                      d={catmullRomPath(seg)}
                      fill="none"
                      stroke={color}
                      strokeWidth={8}
                      opacity={0.12}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  )}
                  <path
                    d={catmullRomPath(seg)}
                    fill="none"
                    stroke={color}
                    strokeWidth={s.isClient ? 3 : 2}
                    opacity={s.isClient ? 1 : 0.55}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </g>
              ));
            })}
          </g>

          {/* Data points - only show on hover or for latest/peak */}
          {sortedSeries.map(s => {
            const si = s.origIdx;
            const color = getColor(s, si);
            return s.data.map((v, pi) => {
              if (v === null) return null;
              const isHov = hoveredIdx === pi;
              const isLast = pi === s.data.length - 1;
              const isPeak = s.isClient && pi === clientPeakIdx;
              const show = isHov || isLast || isPeak;
              if (!show && animProgress >= 1) return null;
              const visible = (pi / (labels.length || 1)) <= animProgress;
              if (!visible) return null;

              return (
                <g key={`dot-${si}-${pi}`}>
                  {/* Outer glow ring on hover */}
                  {isHov && (
                    <circle
                      cx={getX(pi)} cy={getY(v)}
                      r={12}
                      fill={color}
                      opacity={0.1}
                    />
                  )}
                  <circle
                    cx={getX(pi)} cy={getY(v)}
                    r={isHov ? 6 : 4}
                    fill="white"
                    stroke={color}
                    strokeWidth={isHov ? 3 : 2.5}
                    filter={isHov ? "url(#sov-dot-shadow)" : undefined}
                    className="transition-all duration-200"
                  />
                </g>
              );
            });
          })}

          {/* Peak label for client brand */}
          {clientSeries && clientPeakIdx >= 0 && clientSeries.data[clientPeakIdx] !== null && animProgress >= 1 && (
            <g>
              <rect
                x={getX(clientPeakIdx) - 20}
                y={getY(clientSeries.data[clientPeakIdx]!) - 28}
                width={40} height={20} rx={10}
                fill={CLIENT_COLOR}
              />
              <text
                x={getX(clientPeakIdx)}
                y={getY(clientSeries.data[clientPeakIdx]!) - 14}
                textAnchor="middle" fontSize={11} fontWeight={700} fill="white" fontFamily="system-ui"
              >
                {clientSeries.data[clientPeakIdx]}%
              </text>
            </g>
          )}

          {/* Invisible hover areas */}
          {labels.map((_, i) => (
            <rect
              key={`hov-${i}`}
              x={getX(i) - colWidth / 2} y={pad.top}
              width={colWidth} height={chartH}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          ))}
        </svg>
      </div>

      {/* Floating tooltip */}
      {hoveredIdx !== null && (
        <div
          className="absolute z-30 pointer-events-none"
          style={{
            left: Math.min(Math.max(getX(hoveredIdx) - 90, 8), width - 200),
            top: pad.top + 4,
          }}
        >
          <div className="bg-white/95 backdrop-blur-sm border border-gray-200/80 rounded-2xl shadow-2xl px-4 py-3 min-w-[180px]">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">{labels[hoveredIdx]}</div>
            <div className="space-y-2">
              {series
                .map((s, si) => ({ s, si, v: s.data[hoveredIdx] }))
                .filter(item => item.v !== null && item.v !== undefined)
                .sort((a, b) => (b.v as number) - (a.v as number))
                .map(({ s, si, v }) => {
                  const color = getColor(s, si);
                  return (
                    <div key={si} className="flex items-center gap-2.5">
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${s.domain}&sz=16`}
                        alt=""
                        className="h-4 w-4 rounded-sm flex-shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                      <span className="text-xs text-gray-600 flex-1 truncate">{s.name}</span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${v}%`, backgroundColor: color }} />
                        </div>
                        <span className="text-xs font-bold w-8 text-right" style={{ color }}>{v}%</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { CLIENT_COLOR, COMPETITOR_COLORS };
