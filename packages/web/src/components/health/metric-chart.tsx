'use client';

import dynamic from 'next/dynamic';
import type { MetricSample } from '@bartr/shared';

const AreaChart = dynamic(
  () => import('recharts').then((m) => m.AreaChart),
  { ssr: false },
);
const Area = dynamic(
  () => import('recharts').then((m) => m.Area),
  { ssr: false },
);
const XAxis = dynamic(
  () => import('recharts').then((m) => m.XAxis),
  { ssr: false },
);
const YAxis = dynamic(
  () => import('recharts').then((m) => m.YAxis),
  { ssr: false },
);
const Tooltip = dynamic(
  () => import('recharts').then((m) => m.Tooltip),
  { ssr: false },
);
const ResponsiveContainer = dynamic(
  () => import('recharts').then((m) => m.ResponsiveContainer),
  { ssr: false },
);
const LineChart = dynamic(
  () => import('recharts').then((m) => m.LineChart),
  { ssr: false },
);
const Line = dynamic(
  () => import('recharts').then((m) => m.Line),
  { ssr: false },
);

function isMidnight(ts: number): boolean {
  const d = new Date(ts);
  return d.getUTCHours() === 0 && d.getUTCMinutes() === 0;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  if (isMidnight(ts)) {
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const yy = String(d.getUTCFullYear()).slice(-2);
    return `${mm}-${dd}-${yy}`;
  }
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });
}

/** Build custom ticks that include midnight boundaries so date labels appear on day changes. */
function buildTicks(data: { timestamp: number }[], tickCount = 6): number[] {
  if (data.length === 0) return [];
  const min = data[0].timestamp;
  const max = data[data.length - 1].timestamp;

  // Collect midnight timestamps within the range
  const midnights: number[] = [];
  const startDay = new Date(min);
  startDay.setUTCHours(0, 0, 0, 0);
  let cursor = startDay.getTime();
  // Advance to the first midnight strictly after min
  if (cursor <= min) cursor += 86_400_000;
  while (cursor < max) {
    midnights.push(cursor);
    cursor += 86_400_000;
  }

  // Generate evenly spaced ticks
  const step = (max - min) / (tickCount - 1);
  const regular: number[] = [];
  for (let i = 0; i < tickCount; i++) {
    regular.push(Math.round(min + step * i));
  }

  // Merge: replace the closest regular tick with each midnight
  const ticks = [...regular];
  for (const m of midnights) {
    let closestIdx = 0;
    let closestDist = Infinity;
    for (let i = 0; i < ticks.length; i++) {
      const dist = Math.abs(ticks[i] - m);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }
    ticks[closestIdx] = m;
  }

  return [...new Set(ticks)].sort((a, b) => a - b);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatBytesPerSec(bytes: number): string {
  return `${formatBytes(bytes)}/s`;
}

interface MetricChartProps {
  title: string;
  data: MetricSample[];
  unit?: 'percent' | 'bytes' | 'bytes_per_sec';
  color?: string;
  /** Fixed Y-axis maximum. For percent charts defaults to 100. */
  yMax?: number;
}

export function MetricChart({ title, data, unit = 'percent', color = '#f97316', yMax }: MetricChartProps) {
  const formatValue = (v: number) => {
    if (unit === 'percent') return `${v}%`;
    if (unit === 'bytes') return formatBytes(v);
    return formatBytesPerSec(v);
  };

  const domain: [number, number] | undefined =
    yMax != null ? [0, yMax] : unit === 'percent' ? [0, 100] : undefined;

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <p className="text-sm font-medium mb-3">{title}</p>
      {data.length === 0 ? (
        <p className="text-xs text-neutral-500 h-48 flex items-center justify-center">Waiting for data...</p>
      ) : (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <XAxis
                dataKey="timestamp"
                type="number"
                domain={['dataMin', 'dataMax']}
                scale="time"
                ticks={buildTicks(data)}
                tickFormatter={formatTime}
                tick={{ fill: '#737373', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={domain}
                tickFormatter={(v: number) => formatValue(v)}
                tick={{ fill: '#737373', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={60}
              />
              <Tooltip
                labelFormatter={(ts: number) => new Date(ts).toLocaleString('en-US', { timeZone: 'UTC' })}
                formatter={(v: number) => [formatValue(v), title]}
                contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                fill={color}
                fillOpacity={0.15}
                strokeWidth={1.5}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

interface MultiLineChartProps {
  title: string;
  series: Array<{ name: string; data: MetricSample[]; color: string }>;
  unit?: 'percent' | 'bytes' | 'bytes_per_sec';
  yMax?: number;
}

export function MultiLineChart({ title, series, unit = 'percent', yMax }: MultiLineChartProps) {
  const formatValue = (v: number) => {
    if (unit === 'percent') return `${v}%`;
    if (unit === 'bytes') return formatBytes(v);
    return formatBytesPerSec(v);
  };

  const domain: [number, number] | undefined =
    yMax != null ? [0, yMax] : unit === 'percent' ? [0, 100] : undefined;

  // Merge all series into a single dataset keyed by timestamp
  const merged = new Map<number, Record<string, number>>();
  for (const s of series) {
    for (const sample of s.data) {
      const existing = merged.get(sample.timestamp) ?? { timestamp: sample.timestamp };
      existing[s.name] = sample.value;
      merged.set(sample.timestamp, existing);
    }
  }
  const data = Array.from(merged.values()).sort((a, b) => a.timestamp - b.timestamp);

  const hasData = series.some((s) => s.data.length > 0);

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <p className="text-sm font-medium mb-3">{title}</p>
      {!hasData ? (
        <p className="text-xs text-neutral-500 h-48 flex items-center justify-center">Waiting for data...</p>
      ) : (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis
                dataKey="timestamp"
                type="number"
                domain={['dataMin', 'dataMax']}
                scale="time"
                ticks={buildTicks(data)}
                tickFormatter={formatTime}
                tick={{ fill: '#737373', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={domain}
                tickFormatter={(v: number) => formatValue(v)}
                tick={{ fill: '#737373', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={60}
              />
              <Tooltip
                labelFormatter={(ts: number) => new Date(ts).toLocaleString('en-US', { timeZone: 'UTC' })}
                formatter={(v: number, name: string) => [formatValue(v), name]}
                contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
              />
              {series.map((s) => (
                <Line
                  key={s.name}
                  type="monotone"
                  dataKey={s.name}
                  stroke={s.color}
                  strokeWidth={1.5}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
