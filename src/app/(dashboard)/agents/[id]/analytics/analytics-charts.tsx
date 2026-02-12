'use client';

/**
 * Analytics Charts Components
 * Heavy recharts components extracted for lazy loading
 */

import {
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const COLORS = {
  primary: '#9945FF',
  secondary: '#14F195',
  accent: '#F59E0B',
  grid: '#27272A',
};

interface GenerationsChartProps {
  data: Array<{ date: string; generations: number }>;
}

export function GenerationsChart({ data }: GenerationsChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
        No generation data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
        <XAxis
          dataKey="date"
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
        <Line
          type="monotone"
          dataKey="generations"
          stroke={COLORS.primary}
          strokeWidth={2}
          dot={{ fill: COLORS.primary, r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

interface EngagementChartProps {
  data: Array<{ date: string; likes: number; comments: number; shares: number }>;
}

export function EngagementChart({ data }: EngagementChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
        No engagement data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
        <XAxis
          dataKey="date"
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
        <Legend />
        <Area
          type="monotone"
          dataKey="likes"
          stackId="1"
          stroke={COLORS.primary}
          fill={COLORS.primary}
          fillOpacity={0.6}
        />
        <Area
          type="monotone"
          dataKey="comments"
          stackId="1"
          stroke={COLORS.secondary}
          fill={COLORS.secondary}
          fillOpacity={0.6}
        />
        <Area
          type="monotone"
          dataKey="shares"
          stackId="1"
          stroke={COLORS.accent}
          fill={COLORS.accent}
          fillOpacity={0.6}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

interface QualityScoreChartProps {
  data: Array<{ date: string; score: string | number }>;
}

export function QualityScoreChart({ data }: QualityScoreChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
        No quality score data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
        <XAxis
          dataKey="date"
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
        <Line
          type="monotone"
          dataKey="score"
          stroke={COLORS.secondary}
          strokeWidth={2}
          dot={{ fill: COLORS.secondary, r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

interface ContentTypeChartProps {
  data: Array<{ name: string; value: number; color: string }>;
}

export function ContentTypeChart({ data }: ContentTypeChartProps) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={(props: unknown) => {
            const entry = props as { name?: string; percent?: number };
            return entry.percent && entry.name
              ? `${entry.name} ${(entry.percent * 100).toFixed(0)}%`
              : entry.name || '';
          }}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: '#18181B',
            border: '1px solid #27272A',
            borderRadius: '8px',
            color: '#FAFAFA',
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
