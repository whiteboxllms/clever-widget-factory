import { useMemo, useState, useEffect, useCallback } from 'react';
import type { SkillProfile } from '@/hooks/useSkillProfile';
import type { CapabilityProfile } from '@/hooks/useCapability';

const BLOOM_LABELS = ['', 'Remember', 'Understand', 'Apply', 'Analyze', 'Create'];
const MAX_LEVEL = 5;
const RING_COUNT = 5;

export interface SkillRadialChartProps {
  skillProfile: SkillProfile;
  capabilityProfiles: CapabilityProfile[];
  organizationProfile?: CapabilityProfile;
  onAxisClick?: (axisKey: string) => void;
}

interface AxisData {
  key: string;
  label: string;
  requirement: number;
  capability: number;
}

/** Convert polar (angle in radians, radius 0-1) to SVG x,y. */
function polarToXY(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

/** Build a polygon path string from an array of values (0-MAX_LEVEL) at equal angles. */
function polygonPath(
  cx: number,
  cy: number,
  maxR: number,
  values: number[],
  count: number
): string {
  const points = values.map((val, i) => {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2; // start from top
    const r = (val / MAX_LEVEL) * maxR;
    const { x, y } = polarToXY(cx, cy, r, angle);
    return `${x},${y}`;
  });
  return `M ${points.join(' L ')} Z`;
}

/**
 * Radial radar chart with overlaid labels.
 * Spokes = skill axes, rings = Bloom's levels (1-5).
 * Current capability = filled blue polygon.
 * Required level = dashed red polygon.
 * Labels are placed just inside the outermost ring to save space.
 */
export function SkillRadialChart({
  skillProfile,
  capabilityProfiles,
  organizationProfile,
  onAxisClick,
}: SkillRadialChartProps) {
  const [animProgress, setAnimProgress] = useState(0);
  const [hoveredAxis, setHoveredAxis] = useState<string | null>(null);

  // Animate on mount
  useEffect(() => {
    setAnimProgress(0);
    const timeout = setTimeout(() => {
      let start: number | null = null;
      const duration = 900;

      function step(ts: number) {
        if (!start) start = ts;
        const t = Math.min((ts - start) / duration, 1);
        // ease-out cubic
        setAnimProgress(1 - Math.pow(1 - t, 3));
        if (t < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }, 80);
    return () => clearTimeout(timeout);
  }, [skillProfile, capabilityProfiles]);

  const axes = useMemo((): AxisData[] => {
    const primary = capabilityProfiles[0];
    return skillProfile.axes.map((sa) => {
      const cap = primary?.axes.find((a) => a.key === sa.key);
      return {
        key: sa.key,
        label: sa.label,
        requirement: sa.required_level,
        capability: cap?.level ?? 0,
      };
    });
  }, [skillProfile, capabilityProfiles]);

  const count = axes.length;

  if (!count) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No skill axes defined
      </div>
    );
  }

  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 16; // labels go inside, so minimal padding

  // Animated values
  const animatedCapabilities = axes.map((a) => a.capability * animProgress);

  // Polygon paths
  const requirementPath = polygonPath(cx, cy, maxR, axes.map((a) => a.requirement), count);
  const capabilityPath = polygonPath(cx, cy, maxR, animatedCapabilities, count);

  // Compute label positions — placed inside, on the outermost ring
  const labelRadius = maxR - 12;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
      >
        {/* Concentric rings */}
        {Array.from({ length: RING_COUNT }, (_, i) => {
          const ringLevel = i + 1;
          const r = (ringLevel / MAX_LEVEL) * maxR;
          return (
            <circle
              key={ringLevel}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth={1}
            />
          );
        })}

        {/* Bloom's level labels on the right spoke (small, subtle) */}
        {Array.from({ length: RING_COUNT }, (_, i) => {
          const ringLevel = i + 1;
          const r = (ringLevel / MAX_LEVEL) * maxR;
          return (
            <text
              key={`bloom-${ringLevel}`}
              x={cx + 6}
              y={cy - r + 4}
              fontSize={8}
              className="fill-muted-foreground/50"
              textAnchor="start"
            >
              {BLOOM_LABELS[ringLevel]}
            </text>
          );
        })}

        {/* Spoke lines */}
        {axes.map((_, i) => {
          const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
          const { x, y } = polarToXY(cx, cy, maxR, angle);
          return (
            <line
              key={`spoke-${i}`}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="#e5e7eb"
              strokeWidth={1}
            />
          );
        })}

        {/* Required polygon — dashed red */}
        <path
          d={requirementPath}
          fill="none"
          stroke="#ef4444"
          strokeWidth={2}
          strokeDasharray="8 4"
          opacity={0.7}
        />

        {/* Capability polygon — filled blue */}
        <path
          d={capabilityPath}
          fill="#3b82f6"
          fillOpacity={0.2}
          stroke="#3b82f6"
          strokeWidth={2.5}
        />

        {/* Capability dots at vertices */}
        {axes.map((axis, i) => {
          const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
          const r = (animatedCapabilities[i] / MAX_LEVEL) * maxR;
          const { x, y } = polarToXY(cx, cy, r, angle);
          const isHovered = hoveredAxis === axis.key;
          return (
            <circle
              key={`dot-${axis.key}`}
              cx={x}
              cy={y}
              r={isHovered ? 5 : 3.5}
              fill="#3b82f6"
              stroke="white"
              strokeWidth={1.5}
              className="transition-all duration-150"
            />
          );
        })}

        {/* Axis labels — overlaid inside, near the outer ring */}
        {axes.map((axis, i) => {
          const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
          const { x, y } = polarToXY(cx, cy, labelRadius, angle);
          const isHovered = hoveredAxis === axis.key;

          // Determine text anchor based on position
          const normalizedAngle = ((angle + Math.PI / 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
          let anchor: 'start' | 'middle' | 'end' = 'middle';
          if (normalizedAngle > 0.3 && normalizedAngle < Math.PI - 0.3) anchor = 'start';
          else if (normalizedAngle > Math.PI + 0.3 && normalizedAngle < Math.PI * 2 - 0.3) anchor = 'end';

          // Truncate long labels
          const maxLen = 14;
          const displayLabel = axis.label.length > maxLen
            ? axis.label.substring(0, maxLen - 1) + '…'
            : axis.label;

          return (
            <g
              key={`label-${axis.key}`}
              onClick={() => onAxisClick?.(axis.key)}
              onMouseEnter={() => setHoveredAxis(axis.key)}
              onMouseLeave={() => setHoveredAxis(null)}
              style={{ cursor: onAxisClick ? 'pointer' : 'default' }}
              role="button"
              tabIndex={0}
              aria-label={`${axis.label}: Level ${Math.round(axis.capability)}, Required: ${axis.requirement}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onAxisClick?.(axis.key);
                }
              }}
            >
              <title>{axis.label} — Level {Math.round(axis.capability)} / {axis.requirement}</title>
              <text
                x={x}
                y={y}
                textAnchor={anchor}
                dominantBaseline="central"
                fontSize={9}
                fontWeight={isHovered ? 600 : 400}
                className={isHovered ? 'fill-foreground' : 'fill-muted-foreground/70'}
              >
                {displayLabel}
              </text>
            </g>
          );
        })}

        {/* Hover tooltip in center */}
        {hoveredAxis && (() => {
          const axis = axes.find((a) => a.key === hoveredAxis);
          if (!axis) return null;
          const bloomLabel = BLOOM_LABELS[Math.round(Math.max(0, Math.min(MAX_LEVEL, axis.capability)))] || '';
          return (
            <>
              <text x={cx} y={cy - 8} textAnchor="middle" fontSize={16} fontWeight={600} className="fill-foreground">
                {Math.round(axis.capability)} / {axis.requirement}
              </text>
              <text x={cx} y={cy + 10} textAnchor="middle" fontSize={10} className="fill-muted-foreground">
                {bloomLabel}
              </text>
            </>
          );
        })()}
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5 bg-blue-500 rounded" />
          Current
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5 border-t-2 border-dashed border-red-400" />
          Required
        </span>
      </div>
      <div className="text-center text-xs text-muted-foreground">
        Click axis labels to see evidence
      </div>
    </div>
  );
}
