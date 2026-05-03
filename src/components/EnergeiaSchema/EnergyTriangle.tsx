import { useState, useEffect } from 'react';
import type { ActionPoint, EnergyType, EnergyWeights } from '@/types/energeia';

// Inject pulse keyframes once into the document head
const PULSE_STYLE_ID = 'tri-pulse-keyframes';
function ensurePulseKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(PULSE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PULSE_STYLE_ID;
  style.textContent = `
    @keyframes triPulse {
      0%   { r: 7;  opacity: 0.45; }
      65%  { r: 15; opacity: 0; }
      100% { r: 15; opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

interface EnergyTriangleProps {
  points: ActionPoint[];
  activeEnergyFilter: EnergyType | null;
  onFilterChange: (type: EnergyType | null) => void;
}

// Corner positions in equilateral triangle (normalized 0–1 space):
// Dynamis at top, Oikonomia at bottom-left, Techne at bottom-right
const VERTICES = {
  dynamis:   { x: 0.5,  y: 0.0 },
  oikonomia: { x: 0.0,  y: 1.0 },
  techne:    { x: 1.0,  y: 1.0 },
} as const;

const CORNER_INFO: Record<EnergyType, {
  label: string;
  greek: string;
  vibe: string;
  rl: string;
  description: string;
  color: string;
  // Which side to anchor the info bubble: 'center' | 'left' | 'right'
  anchor: 'center' | 'left' | 'right';
}> = {
  dynamis: {
    label: 'Dynamis',
    greek: 'δύναμις',
    vibe: 'The Spark — Expansion',
    rl: 'Exploration',
    description: 'Potential becoming actual. Activities that grow capability, revenue, or reach.',
    color: '#00e5ff',
    anchor: 'center',
  },
  oikonomia: {
    label: 'Oikonomia',
    greek: 'οἰκονομία',
    vibe: 'The Hearth — Stability',
    rl: 'Exploitation',
    description: 'Household management and stable order. Activities that sustain existing operations.',
    color: '#4f46e5',
    anchor: 'left',
  },
  techne: {
    label: 'Phronesis',
    greek: 'φρόνησις',
    vibe: 'The Executive — Order',
    rl: 'Meta-Policy',
    description: 'Practical wisdom and skilled governance. Activities that change how work is done.',
    color: '#a855f7',
    anchor: 'right',
  },
};

export function weightsToXY(w: EnergyWeights): { x: number; y: number } {
  return {
    x: w.dynamis * VERTICES.dynamis.x + w.oikonomia * VERTICES.oikonomia.x + w.techne * VERTICES.techne.x,
    y: w.dynamis * VERTICES.dynamis.y + w.oikonomia * VERTICES.oikonomia.y + w.techne * VERTICES.techne.y,
  };
}

export function computeAverageWeights(points: ActionPoint[]): EnergyWeights {
  const total = { dynamis: 0, oikonomia: 0, techne: 0 };
  let totalObs = 0;
  for (const p of points) {
    const obs = Math.max(1, p.observation_count);
    if (p.energy_weights) {
      total.dynamis   += p.energy_weights.dynamis   * obs;
      total.oikonomia += p.energy_weights.oikonomia * obs;
      total.techne    += p.energy_weights.techne    * obs;
    } else {
      total.oikonomia += obs;
    }
    totalObs += obs;
  }
  if (totalObs === 0) return { dynamis: 0, oikonomia: 1, techne: 0 };
  return {
    dynamis:   total.dynamis   / totalObs,
    oikonomia: total.oikonomia / totalObs,
    techne:    total.techne    / totalObs,
  };
}

// SVG dimensions — compact triangle
const W = 120;
const H = 110;
// Triangle vertices in SVG pixel space
const TV = {
  dynamis:   { x: W / 2,  y: 10   },
  oikonomia: { x: 6,      y: H - 8 },
  techne:    { x: W - 6,  y: H - 8 },
};
const POLY = `${TV.dynamis.x},${TV.dynamis.y} ${TV.oikonomia.x},${TV.oikonomia.y} ${TV.techne.x},${TV.techne.y}`;

// Map normalized [0,1] barycentric → SVG pixel
function toSvg(nx: number, ny: number) {
  // Interpolate between the three SVG vertices using the same barycentric formula
  // but we need to go from normalized [0,1] space to SVG space.
  // The normalized space has: dynamis=(0.5,0), oikonomia=(0,1), techne=(1,1)
  // We map: x_svg = nx * (techne.x - oikonomia.x) + oikonomia.x  (linear in x)
  //         y_svg = ny * (oikonomia.y - dynamis.y) + dynamis.y    (linear in y)
  // But this is only exact for the equilateral case — use full barycentric instead.
  // w_d = 1 - ny, w_o = (1-nx)*ny, w_t = nx*ny  (for equilateral with these vertices)
  const wd = 1 - ny;
  const wo = (1 - nx) * ny;
  const wt = nx * ny;
  return {
    x: wd * TV.dynamis.x + wo * TV.oikonomia.x + wt * TV.techne.x,
    y: wd * TV.dynamis.y + wo * TV.oikonomia.y + wt * TV.techne.y,
  };
}

export function EnergyTriangle({ points, activeEnergyFilter, onFilterChange }: EnergyTriangleProps) {
  const [hoveredCorner, setHoveredCorner] = useState<EnergyType | null>(null);

  // Inject pulse keyframes on first render
  useEffect(() => { ensurePulseKeyframes(); }, []);

  const avgWeights = points.length > 0 ? computeAverageWeights(points) : { dynamis: 0.33, oikonomia: 0.34, techne: 0.33 };
  const crosshairNorm = weightsToXY(avgWeights);
  const ch = toSvg(crosshairNorm.x, crosshairNorm.y);

  // Active corner: hovered takes priority over filtered
  const activeCorner = hoveredCorner ?? activeEnergyFilter;

  // Hit area radius around each vertex (px)
  const HIT_R = 14;

  return (
    <div
      className="relative select-none"
      style={{
        width: W,
        height: H,
        opacity: 0.4,
        transition: 'opacity 0.25s ease',
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}
      aria-label="Energy triangle"
    >
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        <defs>
          <radialGradient id="tri-grad-d" cx={`${(TV.dynamis.x / W) * 100}%`} cy={`${(TV.dynamis.y / H) * 100}%`} r="90%">
            <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#00e5ff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="tri-grad-o" cx={`${(TV.oikonomia.x / W) * 100}%`} cy={`${(TV.oikonomia.y / H) * 100}%`} r="90%">
            <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="tri-grad-t" cx={`${(TV.techne.x / W) * 100}%`} cy={`${(TV.techne.y / H) * 100}%`} r="90%">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
          </radialGradient>
          <clipPath id="tri-clip">
            <polygon points={POLY} />
          </clipPath>
        </defs>

        {/* Dark base */}
        <polygon points={POLY} fill="#080d1a" />

        {/* Gradient fill — screen blend */}
        <g clipPath="url(#tri-clip)" style={{ mixBlendMode: 'screen' }}>
          <rect width={W} height={H} fill="url(#tri-grad-d)" />
          <rect width={W} height={H} fill="url(#tri-grad-o)" />
          <rect width={W} height={H} fill="url(#tri-grad-t)" />
        </g>

        {/* Border */}
        <polygon points={POLY} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

        {/* Crosshair — global average, glides on data change, pulses continuously */}
        <g
          style={{
            transform: `translate(${ch.x}px, ${ch.y}px)`,
            transition: 'transform 0.9s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <circle cx={0} cy={0} r="4" fill="none" stroke="white" strokeWidth="0.8"
            style={{ animation: 'triPulse 2.4s ease-out infinite' } as React.CSSProperties} />
          <circle cx={0} cy={0} r="4" fill="none" stroke="white" strokeWidth="0.8"
            style={{ animation: 'triPulse 2.4s ease-out 1.2s infinite' } as React.CSSProperties} />
          <circle cx={0} cy={0} r="2.5" fill="white" opacity="0.95" />
          <line x1={-5} y1={0} x2={5} y2={0} stroke="white" strokeWidth="1" opacity="0.55" />
          <line x1={0} y1={-5} x2={0} y2={5} stroke="white" strokeWidth="1" opacity="0.55" />
        </g>

        {/* Vertex hit areas + highlight rings */}
        {(Object.entries(TV) as [EnergyType, { x: number; y: number }][]).map(([type, v]) => {
          const info = CORNER_INFO[type];
          const isActive = activeCorner === type;
          const isFiltered = activeEnergyFilter === type;
          return (
            <g key={type}>
              {/* Highlight ring when active */}
              {isActive && (
                <circle
                  cx={v.x} cy={v.y} r={HIT_R - 4}
                  fill={`${info.color}20`}
                  stroke={info.color}
                  strokeWidth="1.5"
                  strokeOpacity="0.7"
                />
              )}
              {/* Invisible hit area */}
              <circle
                cx={v.x} cy={v.y} r={HIT_R}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredCorner(type)}
                onMouseLeave={() => setHoveredCorner(null)}
                onClick={() => onFilterChange(isFiltered ? null : type)}
              />
            </g>
          );
        })}

        {/* Vertex labels */}
        <text x={TV.dynamis.x} y={TV.dynamis.y - 3} textAnchor="middle" fill="#00e5ff" fontSize="7" fontWeight="700" style={{ pointerEvents: 'none' }}>
          Dynamis
        </text>
        <text x={TV.oikonomia.x + 2} y={TV.oikonomia.y + 8} textAnchor="start" fill="#4f46e5" fontSize="7" fontWeight="700" style={{ pointerEvents: 'none' }}>
          Oikonomia
        </text>
        <text x={TV.techne.x - 2} y={TV.techne.y + 8} textAnchor="end" fill="#a855f7" fontSize="7" fontWeight="700" style={{ pointerEvents: 'none' }}>
          Phronesis
        </text>
      </svg>

      {/* Info bubbles — rendered as DOM overlays anchored to each corner */}
      {(Object.entries(CORNER_INFO) as [EnergyType, typeof CORNER_INFO[EnergyType]][]).map(([type, info]) => {
        if (activeCorner !== type) return null;
        const v = TV[type];
        const isFiltered = activeEnergyFilter === type;

        // Position the bubble relative to the vertex
        let bubbleStyle: React.CSSProperties;
        if (info.anchor === 'center') {
          bubbleStyle = { top: v.y + 8, left: '50%', transform: 'translateX(-50%)' };
        } else if (info.anchor === 'left') {
          bubbleStyle = { bottom: H - v.y + 4, left: v.x + 4 };
        } else {
          bubbleStyle = { bottom: H - v.y + 4, right: W - v.x + 4 };
        }

        return (
          <div
            key={type}
            className="absolute z-20 rounded-lg border px-3 py-2 shadow-2xl text-xs leading-relaxed pointer-events-none"
            style={{
              ...bubbleStyle,
              width: 180,
              borderColor: `${info.color}50`,
              backgroundColor: '#080d1aee',
              backdropFilter: 'blur(8px)',
            }}
          >
            <p className="font-bold text-sm mb-0.5" style={{ color: info.color }}>
              {info.label}
              <span className="ml-1.5 font-normal opacity-60 text-xs">{info.greek}</span>
            </p>
            <p className="text-white/50 text-[10px] mb-1">{info.vibe}</p>
            <p className="text-white/80 text-[11px] leading-snug">{info.description}</p>
            <p className="mt-1.5 text-[10px]">
              <span className="text-white/40">RL: </span>
              <span className="font-semibold" style={{ color: info.color }}>{info.rl}</span>
            </p>
            {isFiltered && (
              <p className="mt-1 text-[10px] text-white/40 italic">Click to clear filter</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default EnergyTriangle;
