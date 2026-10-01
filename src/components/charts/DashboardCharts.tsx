import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartCard, EmptyChart, TooltipBox, useChartHeight } from "@/components/charts/primitives";
import { useIsMobile } from "@/hooks/use-mobile";
import { mergeFeeMonths, monthLabel, type DashboardStats } from "@/lib/analytics";
import { formatPKR } from "@/lib/sms-types";

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function FeeCollectionChart({ stats }: { stats: DashboardStats }) {
  const isMobile = useIsMobile();
  const height = useChartHeight(260, 210);
  const all = useMemo(
    () => mergeFeeMonths(stats.fees_monthly, stats.dues_monthly),
    [stats.fees_monthly, stats.dues_monthly],
  );
  const data = isMobile ? all.slice(-6) : all;

  return (
    <ChartCard
      title="Fee collection"
      description="Charged versus collected each month over the last year."
    >
      {data.length === 0 ? (
        <EmptyChart text="No fee activity recorded yet." />
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="label"
              minTickGap={isMobile ? 14 : 6}
              tick={{ fontSize: isMobile ? 9 : 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
            />
            <YAxis
              width={isMobile ? 40 : 54}
              tick={{ fontSize: isMobile ? 9 : 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.4 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={String(label)}
                    rows={payload.map((p) => ({
                      label: p.name === "charged" ? "Charged" : "Collected",
                      value: formatPKR(Number(p.value ?? 0)),
                    }))}
                  />
                ) : null
              }
            />
            <Legend
              formatter={(v) => (v === "charged" ? "Charged" : "Collected")}
              wrapperStyle={{ fontSize: isMobile ? 10 : 12 }}
            />
            <Bar dataKey="charged" fill="var(--chart-2)" radius={[4, 4, 0, 0]} animationDuration={650} />
            <Bar dataKey="collected" fill="var(--chart-1)" radius={[4, 4, 0, 0]} animationDuration={800} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function EnrollmentChart({ stats }: { stats: DashboardStats }) {
  const isMobile = useIsMobile();
  const height = useChartHeight(260, 230);
  const [top, rest] = useMemo(() => {
    const sorted = [...stats.enrollment].sort((a, b) => b.students - a.students);
    return [sorted.slice(0, 6), sorted.slice(6)] as const;
  }, [stats.enrollment]);

  const data = useMemo(() => {
    const others = rest.reduce((s, r) => s + r.students, 0);
    return others > 0 ? [...top, { program: "Other programs", students: others }] : top;
  }, [top, rest]);

  const total = data.reduce((s, d) => s + d.students, 0);

  return (
    <ChartCard title="Enrolment by program" description="Active students on the register.">
      {total === 0 ? (
        <EmptyChart text="No active students yet." />
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={data}
              dataKey="students"
              nameKey="program"
              innerRadius={isMobile ? 42 : 55}
              outerRadius={isMobile ? 68 : 92}
              paddingAngle={2}
              animationDuration={700}
            >
              {data.map((d, i) => (
                <Cell key={d.program} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.[0] ? (
                  <TooltipBox
                    title={String(payload[0].name)}
                    rows={[
                      { label: "Students", value: String(payload[0].value) },
                      {
                        label: "Share",
                        value: `${Math.round((Number(payload[0].value) / total) * 100)}%`,
                      },
                    ]}
                  />
                ) : null
              }
            />
            <Legend wrapperStyle={{ fontSize: isMobile ? 10 : 11 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function ExamPerformanceChart({ stats }: { stats: DashboardStats }) {
  const isMobile = useIsMobile();
  const height = useChartHeight(260, 210);
  const all = useMemo(
    () =>
      stats.exam_averages
        .filter((e) => e.average !== null)
        .map((e) => ({
          ...e,
          short: e.exam.length > 14 ? `${e.exam.slice(0, 13)}…` : e.exam,
          average: Number(e.average),
        })),
    [stats.exam_averages],
  );
  const data = isMobile ? all.slice(-8) : all;

  return (
    <ChartCard title="Exam performance" description="Average percentage per exam.">
      {data.length === 0 ? (
        <EmptyChart text="No marks recorded yet." />
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="short"
              minTickGap={isMobile ? 14 : 6}
              tick={{ fontSize: isMobile ? 9 : 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
            />
            <YAxis
              domain={[0, 100]}
              unit="%"
              width={isMobile ? 30 : 38}
              tick={{ fontSize: isMobile ? 9 : 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.4 }}
              content={({ active, payload }) =>
                active && payload?.[0] ? (
                  <TooltipBox
                    title={payload[0].payload.exam}
                    rows={[
                      {
                        label: "Date",
                        value: new Date(
                          `${payload[0].payload.exam_date}T00:00:00`,
                        ).toLocaleDateString("en-GB"),
                      },
                      { label: "Average", value: `${payload[0].payload.average}%` },
                      { label: "Students", value: String(payload[0].payload.students) },
                    ]}
                  />
                ) : null
              }
            />
            <Bar dataKey="average" radius={[4, 4, 0, 0]} animationDuration={700}>
              {data.map((d) => (
                <Cell
                  key={`${d.exam}-${d.exam_date}`}
                  fill={d.average >= 40 ? "var(--chart-3)" : "var(--destructive)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function FineMiniChart({ stats }: { stats: DashboardStats }) {
  const isMobile = useIsMobile();
  const height = useChartHeight(160, 150);
  const data = stats.fines.monthly.map((m) => ({ ...m, label: monthLabel(m.month) }));
  const [hover, setHover] = useState<string | null>(null);

  if (data.length === 0) return null;

  return (
    <ChartCard
      title="Absentee fines"
      description={`${stats.fines.count} fines raised this session · ${formatPKR(stats.fines.accrued)} charged${hover ? ` · ${hover}` : ""}`}
    >
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={data}
          margin={{ top: 8, right: 12, bottom: 4, left: 0 }}
          onMouseLeave={() => setHover(null)}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: isMobile ? 9 : 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
          />
          <YAxis
            width={isMobile ? 38 : 48}
            tick={{ fontSize: isMobile ? 9 : 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.[0]) return null;
              return (
                <TooltipBox
                  title={String(label)}
                  rows={[{ label: "Fines", value: formatPKR(Number(payload[0].value ?? 0)) }]}
                />
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="amount"
            stroke="var(--chart-4)"
            strokeWidth={2.5}
            dot={{ r: 3 }}
            animationDuration={700}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
