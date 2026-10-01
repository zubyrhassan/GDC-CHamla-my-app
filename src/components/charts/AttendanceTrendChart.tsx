import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartCard, EmptyChart, GranularityToggle, TooltipBox, useChartHeight } from "@/components/charts/primitives";
import { useIsMobile } from "@/hooks/use-mobile";
import { buildTrend, type DayCount, type Granularity } from "@/lib/analytics";

const THRESHOLD = 75;

/**
 * Attendance percentage over time with a Daily / Weekly / Monthly toggle.
 * Daily uses bars (one per teaching day), the wider buckets use a trend area.
 */
export function AttendanceTrendChart({
  days,
  title,
  description,
  defaultGranularity = "weekly",
}: {
  days: DayCount[];
  title: string;
  description?: string;
  defaultGranularity?: Granularity;
}) {
  const [granularity, setGranularity] = useState<Granularity>(defaultGranularity);
  const isMobile = useIsMobile();
  const height = useChartHeight(260, 210);
  const data = useMemo(() => buildTrend(days, granularity), [days, granularity]);
  const trimmed =
    granularity === "daily" ? data.slice(isMobile ? -14 : -45) : isMobile ? data.slice(-10) : data;

  return (
    <ChartCard
      title={title}
      description={description}
      action={<GranularityToggle value={granularity} onChange={setGranularity} />}
    >
      {trimmed.length === 0 ? (
        <EmptyChart text="No attendance has been marked for this session yet." />
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          {granularity === "daily" ? (
            <BarChart data={trimmed} margin={{ top: 8, right: 14, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: isMobile ? 9 : 11, fill: "var(--muted-foreground)" }}
                interval="preserveStartEnd"
                minTickGap={isMobile ? 18 : 8}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
              />
              <YAxis
                domain={[0, 100]}
                width={isMobile ? 30 : 38}
                tick={{ fontSize: isMobile ? 9 : 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                unit="%"
              />
              <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.4 }} content={<TrendTooltip />} />
              <ReferenceLine
                y={THRESHOLD}
                stroke="var(--destructive)"
                strokeDasharray="4 4"
                label={{ value: "75%", position: "right", fontSize: 10, fill: "var(--destructive)" }}
              />
              <Bar dataKey="percentage" radius={[4, 4, 0, 0]} animationDuration={600}>
                {trimmed.map((d) => (
                  <Cell
                    key={d.key}
                    fill={
                      (d.percentage ?? 0) >= THRESHOLD ? "var(--chart-1)" : "var(--destructive)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <AreaChart data={trimmed} margin={{ top: 8, right: 14, bottom: 4, left: 0 }}>
              <defs>
                <linearGradient id="attendanceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: isMobile ? 9 : 11, fill: "var(--muted-foreground)" }}
                interval="preserveStartEnd"
                minTickGap={isMobile ? 18 : 8}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
              />
              <YAxis
                domain={[0, 100]}
                width={isMobile ? 30 : 38}
                tick={{ fontSize: isMobile ? 9 : 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                unit="%"
              />
              <Tooltip content={<TrendTooltip />} />
              <ReferenceLine
                y={THRESHOLD}
                stroke="var(--destructive)"
                strokeDasharray="4 4"
                label={{ value: "75%", position: "right", fontSize: 10, fill: "var(--destructive)" }}
              />
              <Area
                type="monotone"
                dataKey="percentage"
                stroke="var(--chart-1)"
                strokeWidth={2.5}
                fill="url(#attendanceFill)"
                dot={{ r: 2.5, fill: "var(--chart-1)" }}
                activeDot={{ r: 5 }}
                animationDuration={700}
                connectNulls
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

type TooltipProps = {
  active?: boolean;
  payload?: { payload: ReturnType<typeof buildTrend>[number] }[];
};

function TrendTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <TooltipBox
      title={p.label}
      rows={[
        { label: "Attendance", value: p.percentage === null ? "—" : `${p.percentage}%` },
        { label: "Present", value: String(p.present) },
        { label: "Absent", value: String(p.absent) },
        { label: "Marks counted", value: String(p.counted) },
      ]}
    />
  );
}
