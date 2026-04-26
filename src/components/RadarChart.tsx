import { useMemo } from 'react';
import {
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  Tooltip,
} from 'recharts';
import type { SkillProfile } from '@/hooks/useSkillProfile';
import type { CapabilityProfile } from '@/hooks/useCapability';

const COLOR_PALETTE = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

const GAP_THRESHOLD = 1;
const MAX_LABEL_LENGTH = 18;

export interface SkillRadarChartProps {
  skillProfile: SkillProfile;
  capabilityProfiles: CapabilityProfile[];
  organizationProfile?: CapabilityProfile;
  onAxisClick?: (axisKey: string) => void;
}

interface RadarDataPoint {
  axis: string;
  axisKey: string;
  fullLabel: string;
  requirement: number;
  hasGap: boolean;
  [key: string]: string | number | boolean;
}

function detectGap(requirement: number, capability: number, threshold = GAP_THRESHOLD): boolean {
  return (requirement - capability) > threshold;
}

function getPersonColor(profile: CapabilityProfile, index: number): string {
  const enriched = profile as CapabilityProfile & { favorite_color?: string | null };
  if (enriched.favorite_color) {
    return enriched.favorite_color;
  }
  return COLOR_PALETTE[index % COLOR_PALETTE.length];
}

function personDataKey(profile: CapabilityProfile, index: number): string {
  return profile.user_name || `Person ${index + 1}`;
}

/** Truncate a label to MAX_LABEL_LENGTH chars */
function truncateLabel(label: string): string {
  if (label.length <= MAX_LABEL_LENGTH) return label;
  return label.substring(0, MAX_LABEL_LENGTH - 1) + '…';
}

export function transformRadarData(
  skillProfile: SkillProfile,
  capabilityProfiles: CapabilityProfile[],
  organizationProfile?: CapabilityProfile
): RadarDataPoint[] {
  return skillProfile.axes.map((skillAxis) => {
    const point: RadarDataPoint = {
      axis: truncateLabel(skillAxis.label),
      axisKey: skillAxis.key,
      fullLabel: skillAxis.label,
      requirement: skillAxis.required_level,
      hasGap: false,
    };

    capabilityProfiles.forEach((cp, idx) => {
      const capAxis = cp.axes.find((a) => a.key === skillAxis.key);
      const level = capAxis?.level ?? 0;
      point[personDataKey(cp, idx)] = level;

      if (detectGap(skillAxis.required_level, level)) {
        point.hasGap = true;
      }
    });

    if (organizationProfile) {
      const orgAxis = organizationProfile.axes.find((a) => a.key === skillAxis.key);
      point.organization = orgAxis?.level ?? 0;

      if (detectGap(skillAxis.required_level, orgAxis?.level ?? 0)) {
        point.hasGap = true;
      }
    }

    return point;
  });
}

/**
 * Custom axis tick — truncated label, red + bold for gaps, clickable.
 * Wraps long labels into two lines.
 */
function AxisTick(props: {
  x: number;
  y: number;
  payload: { value: string; index: number };
  data: RadarDataPoint[];
  onAxisClick?: (axisKey: string) => void;
}) {
  const { x, y, payload, data, onAxisClick } = props;
  const dataPoint = data[payload.index];
  const hasGap = dataPoint?.hasGap ?? false;
  const isClickable = !!onAxisClick;
  const label = payload.value;
  const gapMarker = hasGap ? ' ⚠' : '';

  // Determine text-anchor based on position relative to center
  // Left side labels anchor end, right side anchor start, top/bottom anchor middle
  const cx = 230; // approximate center x for 460 width chart
  const dx = x - cx;
  let anchor: 'start' | 'middle' | 'end' = 'middle';
  if (dx < -30) anchor = 'end';
  else if (dx > 30) anchor = 'start';

  return (
    <g
      onClick={() => {
        if (onAxisClick && dataPoint) {
          onAxisClick(dataPoint.axisKey);
        }
      }}
      style={{ cursor: isClickable ? 'pointer' : 'default' }}
    >
      <title>{dataPoint?.fullLabel || label}</title>
      <text
        x={x}
        y={y}
        textAnchor={anchor}
        dominantBaseline="central"
        fontSize={10}
        fill={hasGap ? '#dc2626' : '#6b7280'}
        fontWeight={hasGap ? 600 : 400}
      >
        {label}{gapMarker}
      </text>
    </g>
  );
}

export function SkillRadarChart({
  skillProfile,
  capabilityProfiles,
  organizationProfile,
  onAxisClick,
}: SkillRadarChartProps) {
  const data = useMemo(
    () => transformRadarData(skillProfile, capabilityProfiles, organizationProfile),
    [skillProfile, capabilityProfiles, organizationProfile]
  );

  const personSeries = useMemo(
    () =>
      capabilityProfiles.map((cp, idx) => ({
        name: personDataKey(cp, idx),
        dataKey: personDataKey(cp, idx),
        color: getPersonColor(cp, idx),
      })),
    [capabilityProfiles]
  );

  const gapData = useMemo(() => {
    return data.map((point) => ({
      ...point,
      gapIndicator: point.hasGap ? point.requirement : 0,
    }));
  }, [data]);

  if (!skillProfile.axes.length) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No skill axes defined
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex justify-center overflow-hidden">
        <RechartsRadarChart
          width={460}
          height={380}
          data={gapData}
          margin={{ top: 30, right: 80, bottom: 30, left: 80 }}
        >
          <PolarGrid />
          <PolarAngleAxis
            dataKey="axis"
            tick={(tickProps: any) => (
              <AxisTick {...tickProps} data={data} onAxisClick={onAxisClick} />
            )}
          />
          <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 9 }} tickCount={6} />

          <Radar
            name="Gap"
            dataKey="gapIndicator"
            stroke="transparent"
            fill="#ef4444"
            fillOpacity={0.15}
            isAnimationActive={false}
            legendType="none"
          />

          <Radar
            name="Requirements"
            dataKey="requirement"
            stroke="#6b7280"
            fill="#6b7280"
            fillOpacity={0.05}
            strokeWidth={2}
            strokeDasharray="6 3"
          />

          {personSeries.map((series) => (
            <Radar
              key={series.dataKey}
              name={series.name}
              dataKey={series.dataKey}
              stroke={series.color}
              fill={series.color}
              fillOpacity={0.1}
              strokeWidth={2}
            />
          ))}

          {organizationProfile && (
            <Radar
              name="Organization"
              dataKey="organization"
              stroke="#a855f7"
              fill="#a855f7"
              fillOpacity={0.05}
              strokeWidth={2}
              strokeDasharray="2 3"
            />
          )}

          <Tooltip
            formatter={(value: number, name: string) => {
              const bloomLabels = ['No exposure', 'Remember', 'Understand', 'Apply', 'Analyze', 'Create'];
              const level = Math.round(value);
              const label = bloomLabels[level] || `Level ${level}`;
              return [`${level} — ${label}`, name];
            }}
            labelFormatter={(label: string) => {
              const point = data.find((d) => d.axis === label);
              return point?.fullLabel || label;
            }}
          />

          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          />
        </RechartsRadarChart>
      </div>
      <div className="text-center text-xs text-muted-foreground mt-1">
        Hover for details · Tap an axis for details · ⚠ = gap &gt; 1 level
      </div>
    </div>
  );
}
