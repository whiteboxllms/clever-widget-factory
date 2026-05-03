import type { ActionPoint, EnergyType } from '@/types/energeia';

interface EnergyBarProps {
  points: ActionPoint[];
  activeEnergyFilter: EnergyType | null;
  onSegmentClick: (type: EnergyType | null) => void;
}

const ENERGY_TYPE_INFO: Record<EnergyType, { title: string; rl: string; aristotle: string; vibe: string }> = {
  oikonomia: {
    title:     'Oikonomia (οἰκονομία)',
    vibe:      'The Hearth — Stability',
    rl:        'Exploitation',
    aristotle: 'Household management and stable order. Activities that sustain existing operations.',
  },
  dynamis: {
    title:     'Dynamis (δύναμις)',
    vibe:      'The Spark — Expansion',
    rl:        'Exploration',
    aristotle: 'Potential becoming actual. Activities that grow capability, revenue, or reach.',
  },
  techne: {
    title:     'Phronesis (φρόνησις)',
    vibe:      'The Executive — Order',
    rl:        'Meta-Policy',
    aristotle: 'Practical wisdom and skilled governance. Activities that change how work is done.',
  },
};

// Segment order: Oikonomia (Deep Blue) → Dynamis (Cyan) → Phronesis (Purple)
// Metabolic logic: the stable base fuels active energy, which crystallises into order.
export const ENERGY_SEGMENTS: { type: EnergyType; label: string; sublabel: string; bg: string }[] = [
  { type: 'oikonomia', label: 'Oikonomia', sublabel: 'The Hearth',    bg: '#4f46e5' },
  { type: 'dynamis',   label: 'Dynamis',   sublabel: 'The Spark',     bg: '#00e5ff' },
  { type: 'techne',    label: 'Phronesis', sublabel: 'The Executive', bg: '#a855f7' },
];

export function computeEnergyProportions(
  points: ActionPoint[]
): Record<EnergyType, number> {
  const weights: Record<EnergyType, number> = {
    dynamis:   0,
    oikonomia: 0,
    techne:    0,
  };

  const LEGACY_MAP: Record<string, EnergyType> = {
    growth:              'dynamis',
    maintenance:         'oikonomia',
    hexis:               'oikonomia',
    process_improvement: 'techne',
  };

  for (const point of points) {
    const w = Math.max(1, point.observation_count);
    const resolved: EnergyType =
      point.energy_type in weights
        ? point.energy_type
        : (LEGACY_MAP[point.energy_type as string] ?? 'oikonomia');
    weights[resolved] += w;
  }

  const total = weights.dynamis + weights.oikonomia + weights.techne;
  if (total === 0) return { dynamis: 0, oikonomia: 0, techne: 0 };

  return {
    dynamis:   weights.dynamis   / total,
    oikonomia: weights.oikonomia / total,
    techne:    weights.techne    / total,
  };
}

export function EnergyBar({ points, activeEnergyFilter, onSegmentClick }: EnergyBarProps) {
  if (points.length === 0) return null;

  const proportions = computeEnergyProportions(points);

  const handleSegmentClick = (type: EnergyType) => {
    // Clicking the active segment clears the filter; clicking ⓘ on active also clears
    onSegmentClick(activeEnergyFilter === type ? null : type);
  };

  const activeInfo = activeEnergyFilter ? ENERGY_TYPE_INFO[activeEnergyFilter] : null;
  const activeSeg  = activeEnergyFilter ? ENERGY_SEGMENTS.find(s => s.type === activeEnergyFilter) : null;

  return (
    <div className="mb-3" aria-label="Energy allocation bar">

      {/* Bar — "Metabolic Blending" gradient: colors bleed into each other to represent
           that a task is rarely just one thing.
           Oikonomia (Deep Blue) stabilizes the base → Dynamis (Electric Cyan) is the
           active energy fueled by that base → Phronesis (Royal Purple) is the Order
           emerging from the activity. */}
      {(() => {
        // Build gradient stops from proportions
        const segs = ENERGY_SEGMENTS.map(s => ({
          ...s,
          pct: proportions[s.type] * 100,
        })).filter(s => s.pct > 0);

        // Accumulate stop positions with wide metabolic blending zones.
        // Each boundary bleeds across ~12% of the total bar so the transition
        // feels organic rather than mechanical.
        let cursor = 0;
        const stops: string[] = [];
        const BLEED = 12; // % of total bar width for each color transition zone

        segs.forEach((seg, i) => {
          const start = cursor;
          const end = cursor + seg.pct;

          if (i === 0) {
            // First segment: solid at left edge, then fade toward next color
            stops.push(`${seg.bg} ${start}%`);
            if (segs.length > 1) {
              // Hold solid until bleed zone begins
              stops.push(`${seg.bg} ${Math.max(end - BLEED, start + seg.pct * 0.4)}%`);
            } else {
              stops.push(`${seg.bg} ${end}%`);
            }
          } else if (i === segs.length - 1) {
            // Last segment: blend in from previous, solid at right edge
            stops.push(`${seg.bg} ${Math.min(start + BLEED, end - seg.pct * 0.4)}%`);
            stops.push(`${seg.bg} ${end}%`);
          } else {
            // Middle segment: blend in from left, hold briefly, blend out to right
            const blendInEnd   = Math.min(start + BLEED, start + seg.pct * 0.35);
            const blendOutStart = Math.max(end - BLEED, end - seg.pct * 0.35);
            stops.push(`${seg.bg} ${blendInEnd}%`);
            if (blendOutStart > blendInEnd) {
              stops.push(`${seg.bg} ${blendOutStart}%`);
            }
          }

          cursor = end;
        });

        const gradient = `linear-gradient(to right, ${stops.join(', ')})`;
        const isAnyActive = activeEnergyFilter !== null;

        return (
          <div
            className="relative flex h-8 w-full rounded-md overflow-hidden"
            style={{ background: gradient }}
          >
            {segs.map(({ type, label, sublabel, bg, pct }) => {
              const isActive = activeEnergyFilter === type;
              return (
                <div
                  key={type}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isActive}
                  style={{
                    width: `${pct}%`,
                    cursor: 'pointer',
                    boxShadow: isActive ? `inset 0 0 0 2px rgba(255,255,255,0.85)` : 'none',
                    opacity: isAnyActive && !isActive ? 0.65 : 1,
                  }}
                  className="flex items-center justify-between px-2 overflow-hidden transition-all duration-200"
                  onClick={() => handleSegmentClick(type)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSegmentClick(type)}
                >
                  {pct >= 14 && (
                    <span className="text-white text-[11px] font-semibold truncate select-none flex-1 min-w-0 drop-shadow">
                      {label}
                      <span className="font-normal opacity-80"> · {sublabel}</span>
                      <span className="ml-1">{Math.round(pct)}%</span>
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={`About ${label}`}
                    className="ml-auto flex-shrink-0 w-4 h-4 rounded-full bg-white/25 hover:bg-white/50 text-white text-[9px] font-bold leading-none flex items-center justify-center transition-colors drop-shadow"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSegmentClick(activeEnergyFilter === type ? null : type);
                    }}
                  >
                    i
                  </button>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Info panel — shown below bar when a segment is active */}
      {activeInfo && activeSeg && (
        <div
          className="mt-2 rounded-md border px-3 py-2.5 text-xs leading-relaxed transition-all"
          style={{ borderColor: `${activeSeg.bg}60`, backgroundColor: `${activeSeg.bg}12` }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-0.5">
              <p className="font-semibold" style={{ color: activeSeg.bg }}>
                {activeInfo.title}
                <span className="ml-2 font-normal text-muted-foreground">{activeInfo.vibe}</span>
              </p>
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">RL: </span>
                <span className="font-medium" style={{ color: activeSeg.bg }}>{activeInfo.rl}</span>
                <span className="mx-1.5 opacity-40">·</span>
                {activeInfo.aristotle}
              </p>
            </div>
            <button
              type="button"
              aria-label="Close"
              className="text-muted-foreground hover:text-foreground flex-shrink-0 text-base leading-none"
              onClick={() => onSegmentClick(null)}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default EnergyBar;
