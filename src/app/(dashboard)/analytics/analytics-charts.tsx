'use client';

/**
 * Platform Analytics Charts Components
 * Heavy recharts components extracted for lazy loading
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const COLORS = {
  primary: '#9945FF',
  secondary: '#14F195',
  grid: '#27272A',
};

interface PlatformBarChartProps {
  data: Array<{ platform: string; posts: number; color: string }>;
}

export function PlatformBarChart({ data }: PlatformBarChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        No platform data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
        <XAxis
          dataKey="platform"
          stroke="#A1A1AA"
          fontSize={12}
          tickLine={false}
        />
        <YAxis stroke="#A1A1AA" fontSize={12} tickLine={false} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#18181B',
            border: '1px solid #27272A',
            borderRadius: '8px',
            color: '#FAFAFA',
          }}
        />
        <Bar dataKey="posts" fill={COLORS.primary} radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface EngagementRateChartProps {
  data: Array<{ platform: string; rate: number }>;
}

export function EngagementRateChart({ data }: EngagementRateChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
        <XAxis
          dataKey="platform"
          stroke="#A1A1AA"
          fontSize={12}
          tickLine={false}
        />
        <YAxis stroke="#A1A1AA" fontSize={12} tickLine={false} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#18181B',
            border: '1px solid #27272A',
            borderRadius: '8px',
            color: '#FAFAFA',
          }}
        />
        <Bar dataKey="rate" fill={COLORS.secondary} radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
