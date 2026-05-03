import { useEffect, useRef, useState } from 'react';
import type { ActionPoint, EnergyType } from '@/types/energeia';
import { computeEnergyProportions } from './EnergyBar';

// Inject keyframes once into document head
const STYLE_ID = 'kinesis-bar-keyframes';
function ensureKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes kinesisFlow {
      0%   { background-position: 0% 50%; }
      50%  { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    @keyframes kinesisShimmer {
      0%   { opacity: 0; }
      20%  { opacity: 0.6; }
      60%  { opacity: 0.2; }
      100% { opacity: 0; }
    }
    @keyframes kinesisFadeNum {
      0%   { opacity: 0; transform: translateY(-3px); }
      100% { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}

interface KinesisBarProps {
  points: ActionPoint[];
  activeEnergyFilter: EnergyType | null;
  onFilterChange: (type: EnergyType | null) => void;
}

// Segment order: Oikonomia → Dynamis → Techne (left to right)
const SEGMENTS: { type: EnergyType; label: string; sublabel: string; color: string }[] = [
  { type: 'oikonomia', label: 'Oikonomia', sublabel: 'The Hearth',    color: '#4f46e5' },
  { type: 'dynamis',   label: 'Dynamis',   sublabel: 'The Spark',     color: '#00e5ff' },
  { type: 'techne',    label: 'Phronesis', sublabel: 'The Executive', color: '#a855f7' },
];

export function KinesisBar({ points, activeEnergyFilter, onFilterChange }: KinesisBarProps) {
  useEffect(() => { ensureKeyframes(); }, []);

  const proportions = computeEnergyProportions(points);

  // Track previous proportions to detect changes and trigger shimmer
  const prevPropsRef = useRef<Record<EnergyType, number>>(proportions);
  const [shimmerType, setShimmerType] = useState<EnergyType | null>(null);

  useEffect(() => {
    const prev = prevPropsRef.current;
    let maxDelta = 0;
    let maxType: EnergyType | null = null;
    for (const { type } of SEGMENTS) {
      const delta = Math.abs(proportions[type] - (prev[type] ?? 0));
      if (delta > maxDelta) { maxDelta = delta; maxType = type; }
    }
    if (maxDelta > 0.01 && maxType) {
      setShimmerType(maxType);
      const t = setTimeout(() => setShimmerType(null), 900);
      prevPropsRef.current = proportions;
      return () => clearTimeout(t);
    }
  }, [proportions.dynamis, proportions.oikonomia, proportions.techne]);

  // Build the smooth liquid gradient from proportions
  // Oikonomia occupies [0, o_pct], Dynamis [o_pct, o_pct+d_pct], Techne [rest]
  const o = proportions.oikonomia * 100;
  const d = proportions.dynamis   * 100;
  const t = proportions.techne    * 100;

  // Gradient: blend zones overlap by ~8% for liquid feel
  const BLEND = 8;
  const liquidGradient = [
    `rgba(79,70,229,0.85) 0%`,
    `rgba(79,70,229,0.85) ${Math.max(0, o - BLEND)}%`,
    `rgba(0,229,255,0.85) ${o}%`,
    `rgba(0,229,255,0.85) ${Math.min(100, o + d - BLEND)}%`,
    `rgba(168,85,247,0.85) ${o + d}%`,
    `rgba(168,85,247,0.85) 100%`,
  ].join(', ');

  // Animated shimmer overlay gradient (200% wide, animated)
  const flowGradient = [
    `rgba(255,255,255,0) 0%`,
    `rgba(255,255,255,0.04) 20%`,
    `rgba(255,255,255,0.10) 40%`,
    `rgba(255,255,255,0.04) 60%`,
    `rgba(255,255,255,0) 80%`,
    `rgba(255,255,255,0) 100%`,
  ].join(', ');

  // Tick marks every 5%
  const ticks = Array.from({ length: 19 }, (_, i) => (i + 1) * 5); // 5,10,...,95

  const isAnyActive = activeEnergyFilter !== null;

  return (
    <div
      className="relative w-full pointer-events-auto"
      style={{
        height: 13,
        opacity: 0.4,
        transition: 'opacity 0.25s ease',
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}
      aria-label="Kinesis energy scale"
    >
      {/* ── Vessel: glass container ── */}
      <div
        className="absolute inset-0 rounded-sm overflow-hidden"
        style={{
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          background: 'rgba(5,5,16,0.4)',
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        {/* Liquid fill layer */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(90deg, ${liquidGradient})`,
            transition: 'background 1.2s cubic-bezier(0.4,0,0.2,1)',
          }}
        />

        {/* Flow animation overlay — streams left to right */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(90deg, ${flowGradient})`,
            backgroundSize: '200% 100%',
            animation: 'kinesisFlow 4s ease-in-out infinite',
          }}
        />

        {/* Shimmer pulse — briefly brightens the dominant-change sector */}
        {shimmerType && (() => {
          const seg = SEGMENTS.find(s => s.type === shimmerType);
          if (!seg) return null;
          const left = shimmerType === 'oikonomia' ? 0 : shimmerType === 'dynamis' ? o : o + d;
          const width = shimmerType === 'oikonomia' ? o : shimmerType === 'dynamis' ? d : t;
          return (
            <div
              className="absolute top-0 bottom-0"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                background: `radial-gradient(ellipse at center, ${seg.color}60 0%, transparent 70%)`,
                animation: 'kinesisShimmer 0.9s ease-out forwards',
              }}
            />
          );
        })()}

        {/* Ruler tick marks — SVG overlay every 5% */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          preserveAspectRatio="none"
        >
          {ticks.map(pct => (
            <line
              key={pct}
              x1={`${pct}%`} y1="0"
              x2={`${pct}%`} y2={pct % 10 === 0 ? '40%' : '25%'}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="0.5"
            />
          ))}
        </svg>

        {/* Clickable segment zones + labels */}
        <div className="absolute inset-0 flex">
          {SEGMENTS.map(({ type, label, sublabel, color }) => {
            const pct = proportions[type] * 100;
            const isActive = activeEnergyFilter === type;
            return (
              <button
                key={type}
                type="button"
                aria-pressed={isActive}
                onClick={() => onFilterChange(isActive ? null : type)}
                className="relative flex items-center justify-center overflow-hidden transition-all duration-500 cursor-pointer"
                style={{
                  width: `${pct}%`,
                  opacity: isAnyActive && !isActive ? 0.45 : 1,
                  boxShadow: isActive ? `inset 0 0 0 1.5px rgba(255,255,255,0.7)` : 'none',
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                }}
              >
                {pct >= 14 && (
                  <span
                    className="flex items-baseline gap-1 select-none"
                    style={{
                      fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
                      fontSize: '8px',
                      letterSpacing: '0.04em',
                      color: 'rgba(255,255,255,0.5)',
                      animation: 'kinesisFadeNum 0.4s ease-out',
                    }}
                    key={Math.round(pct)}
                  >
                    <span style={{ color, opacity: 0.5, fontWeight: 600 }}>{label}</span>
                    <span style={{ opacity: 0.5 }}>{Math.round(pct)}%</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default KinesisBar;
