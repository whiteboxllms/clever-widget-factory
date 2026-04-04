import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import { Button } from '@/components/ui/button';

/** Phase indicator band colors */
const PHASE_INDICATOR_COLORS: Record<string, string> = {
  mesophilic_active: '#3b82f640',  // blue
  thermophilic_active: '#f9731640', // orange
  overheat: '#ef444450',            // red
  curing: '#22c55e40',              // green
};

/** Severity colors for rule violation zones */
const SEVERITY_COLORS: Record<string, string> = {
  LOW: '#3b82f630',    // blue
  MEDIUM: '#f59e0b40', // amber
  HIGH: '#ef444440',   // red
};

/** Colors for independent variable lines */
const IV_COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea',
  '#0891b2', '#e11d48', '#65a30d', '#c026d3', '#ea580c',
];

/** A horizontal threshold reference line */
export interface SPCThreshold {
  value: number;
  label: string;
  color?: string;
}

/** A phase indicator band derived from state */
export interface SPCPhaseIndicatorBand {
  startTime: number;
  endTime: number;
  label: string;
}

/** A rule violation zone — time range where a control rule condition is true */
export interface SPCRuleViolation {
  startTime: number;
  endTime: number;
  intent: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  note?: string;
}

/** An independent variable overlay trace */
export interface SPCIndependentVariable {
  key: string;
  label: string;
  values: number[];
  color?: string;
}

/** A phase band for background shading (legacy support) */
export interface SPCPhaseBand {
  startTime: number;
  endTime: number;
  label: string;
  colorIndex: number;
}

/** Props for the generic SPC chart component */
export interface SPCChartProps {
  label: string;
  unit: string;
  timePoints: number[];
  values: number[];
  /** Static target value (green centerline) */
  target?: number;
  /** Dynamic target values computed from target_function (one per timePoint) */
  targetValues?: number[];
  /** USL/LSL spec limits (red dashed lines) */
  specLimits?: { USL: number; LSL: number };
  /** Legacy threshold lines */
  thresholds?: SPCThreshold[];
  /** Phase indicator bands derived from state (background shading) */
  phaseIndicatorBands?: SPCPhaseIndicatorBand[];
  /** Legacy phase bands */
  phaseBands?: SPCPhaseBand[];
  /** Rule violation zones with intent labels */
  ruleViolations?: SPCRuleViolation[];
  independentVariables?: SPCIndependentVariable[];
}

/** Phase band background colors for legacy support */
const PHASE_BAND_COLORS = [
  '#3b82f620', '#22c55e20', '#f9731620',
  '#a855f720', '#06b6d420', '#f43f5e20',
];

export function SPCChart({
  label,
  unit,
  timePoints,
  values,
  target,
  targetValues,
  specLimits,
  thresholds,
  phaseIndicatorBands,
  phaseBands,
  ruleViolations,
  independentVariables,
}: SPCChartProps) {
  const [showIVs, setShowIVs] = useState(false);

  const hasIVs = independentVariables != null && independentVariables.length > 0;

  const chartData = useMemo(() => {
    return timePoints.map((t, i) => {
      const point: Record<string, number> = { time: t, value: values[i] };
      if (targetValues) {
        point.targetLine = targetValues[i];
      }
      if (hasIVs && showIVs) {
        for (const iv of independentVariables!) {
          point[iv.key] = iv.values[i];
        }
      }
      return point;
    });
  }, [timePoints, values, targetValues, independentVariables, hasIVs, showIVs]);

  // Compute unique phase labels for the key
  const uniquePhases = useMemo(() => {
    if (!phaseIndicatorBands || phaseIndicatorBands.length === 0) return [];
    const seen = new Set<string>();
    return phaseIndicatorBands.filter((b) => {
      if (seen.has(b.label)) return false;
      seen.add(b.label);
      return true;
    });
  }, [phaseIndicatorBands]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">
            {label} ({unit})
          </h3>
          {uniquePhases.length > 0 && (
            <div className="flex items-center gap-3">
              {uniquePhases.map((p) => (
                <div key={p.label} className="flex items-center gap-1">
                  <div
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: PHASE_INDICATOR_COLORS[p.label] ?? '#94a3b830' }}
                  />
                  <span className="text-xs text-muted-foreground">{p.label.replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {hasIVs && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowIVs((prev) => !prev)}
          >
            {showIVs ? 'Hide Independent Variables' : 'Show Independent Variables'}
          </Button>
        )}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <XAxis
            dataKey="time"
            label={{ value: 'Time (days)', position: 'insideBottom', offset: -5 }}
            tickFormatter={(v: number) => v.toFixed(1)}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            scale="linear"
            domain={['auto', 'auto']}
            tickFormatter={(v: number) => v.toFixed(1)}
            label={{ value: unit, angle: 90, position: 'insideRight', offset: 10 }}
          />
          {showIVs && hasIVs && (
            <YAxis
              yAxisId="left"
              orientation="left"
              scale="log"
              domain={[0.001, 'auto']}
              allowDataOverflow
              tickFormatter={(v: number) => v.toFixed(2)}
            />
          )}

          {/* Phase indicator bands (derived from state) */}
          {phaseIndicatorBands?.map((band, i) => (
            <ReferenceArea
              key={`phase-ind-${i}`}
              x1={band.startTime}
              x2={band.endTime}
              yAxisId="right"
              fill={PHASE_INDICATOR_COLORS[band.label] ?? '#94a3b810'}
              fillOpacity={1}
            />
          ))}

          {/* Legacy phase bands */}
          {phaseBands?.map((band, i) => (
            <ReferenceArea
              key={`phase-band-${i}`}
              x1={band.startTime}
              x2={band.endTime}
              yAxisId="right"
              fill={PHASE_BAND_COLORS[band.colorIndex % PHASE_BAND_COLORS.length]}
              fillOpacity={1}
              label={
                i === 0 || phaseBands[i - 1]?.label !== band.label
                  ? { value: band.label, position: 'insideTopLeft', fontSize: 10, fill: '#6b7280' }
                  : undefined
              }
            />
          ))}

          {/* Rule violation zones */}
          {ruleViolations?.map((v, i) => (
            <ReferenceArea
              key={`violation-${i}`}
              x1={v.startTime}
              x2={v.endTime}
              yAxisId="right"
              fill={SEVERITY_COLORS[v.severity] ?? '#f59e0b30'}
              fillOpacity={1}
              label={{
                value: v.intent.replace(/_/g, ' '),
                position: 'insideTop',
                fontSize: 8,
                fill: v.severity === 'HIGH' ? '#dc2626' : v.severity === 'MEDIUM' ? '#d97706' : '#2563eb',
              }}
            />
          ))}

          {/* Spec limits — red dashed */}
          {specLimits && (
            <>
              <ReferenceLine
                y={specLimits.USL}
                yAxisId="right"
                stroke="#dc2626"
                strokeDasharray="6 3"
                strokeWidth={1.5}
                label={{ value: `USL: ${specLimits.USL}`, position: 'insideTopRight', fontSize: 10, fill: '#dc2626' }}
              />
              <ReferenceLine
                y={specLimits.LSL}
                yAxisId="right"
                stroke="#dc2626"
                strokeDasharray="6 3"
                strokeWidth={1.5}
                label={{ value: `LSL: ${specLimits.LSL}`, position: 'insideBottomRight', fontSize: 10, fill: '#dc2626' }}
              />
            </>
          )}

          {/* Static target — green centerline */}
          {target != null && (
            <ReferenceLine
              y={target}
              yAxisId="right"
              stroke="#16a34a"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{ value: `Target: ${target}`, position: 'insideTopRight', fontSize: 10, fill: '#16a34a' }}
            />
          )}

          {/* Legacy threshold lines */}
          {thresholds?.map((threshold, i) => (
            <ReferenceLine
              key={`threshold-${i}`}
              y={threshold.value}
              yAxisId="right"
              stroke={threshold.color ?? '#9ca3af'}
              strokeDasharray="6 3"
              strokeWidth={1.5}
              label={{ value: threshold.label, position: 'insideTopRight', fontSize: 10, fill: threshold.color ?? '#6b7280' }}
            />
          ))}

          <Tooltip
            labelFormatter={(v: number) => `Day ${Number(v).toFixed(2)}`}
            formatter={(val: number | undefined, name?: string) => {
              if (val == null) return '';
              if (name === 'targetLine') return [val.toFixed(4), 'Target'];
              return val.toFixed(4);
            }}
          />

          {showIVs && hasIVs && <Legend />}

          {/* Main controlled variable line */}
          <Line
            type="monotone"
            dataKey="value"
            name={`${label} (${unit})`}
            yAxisId="right"
            stroke="#2563eb"
            dot={false}
            strokeWidth={2}
          />

          {/* Dynamic target function line — green, thin, dotted */}
          {targetValues && (
            <Line
              type="monotone"
              dataKey="targetLine"
              name="Target"
              yAxisId="right"
              stroke="#16a34a"
              dot={false}
              strokeWidth={1}
              strokeDasharray="3 3"
              strokeOpacity={0.7}
            />
          )}

          {/* Independent variable lines */}
          {showIVs &&
            hasIVs &&
            independentVariables!.map((iv, idx) => (
              <Line
                key={iv.key}
                type="monotone"
                dataKey={iv.key}
                name={iv.label}
                yAxisId="left"
                stroke={iv.color ?? IV_COLORS[idx % IV_COLORS.length]}
                dot={false}
                strokeWidth={1.5}
                strokeOpacity={0.6}
              />
            ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
