import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Dot,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AttendanceTrendChart } from "@/components/charts/AttendanceTrendChart";
import { ChartCard, EmptyChart, TooltipBox } from "@/components/charts/primitives";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStudentAttendanceDays } from "@/lib/analytics";
import { useStudentSummary, type SummaryExamRow } from "@/lib/student-summary";

const ALL = "__all__";
const PASS = 40;

/** Attendance + exam performance charts for one student. */
export function StudentCharts({
  studentId,
  exams,
}: {
  studentId: string;
  exams: SummaryExamRow[];
}) {
  const { data: days = [] } = useStudentAttendanceDays(studentId);

  return (
    <div className="no-print space-y-4">
      <AttendanceTrendChart
        days={days}
        title="Attendance trend"
        description="Percentage of lectures attended over the running session. The dashed line marks the 75% requirement."
      />
      <ExamTrendChart exams={exams} />
    </div>
  );
}

export function ExamTrendChart({ exams }: { exams: SummaryExamRow[] }) {
  const subjects = useMemo(
    () => [...new Set(exams.map((e) => e.subject).filter((s): s is string => Boolean(s)))].sort(),
    [exams],
  );
  const [subject, setSubject] = useState<string>(ALL);

  const data = useMemo(
    () =>
      exams
        .filter((e) => (subject === ALL ? true : e.subject === subject))
        .filter((e) => e.percentage !== null)
        .slice()
        .sort((a, b) => a.exam_date.localeCompare(b.exam_date))
        .map((e) => ({
          label: e.subject ? `${e.name} · ${e.subject}` : e.name,
          short: e.name.length > 14 ? `${e.name.slice(0, 13)}…` : e.name,
          date: e.exam_date,
          marks: e.marks,
          total: e.total,
          grade: e.grade,
          percentage: Number((e.percentage ?? 0).toFixed(1)),
        })),
    [exams, subject],
  );

  return (
    <ChartCard
      title="Exam performance"
      description="Percentage obtained in every exam, oldest to newest."
      action={
        subjects.length > 1 ? (
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="All subjects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All subjects</SelectItem>
              {subjects.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null
      }
    >
      {data.length === 0 ? (
        <EmptyChart text="No exam results recorded for this student yet." />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="short"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              width={38}
              unit="%"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<ExamTooltip />} />
            <ReferenceLine
              y={PASS}
              stroke="var(--destructive)"
              strokeDasharray="4 4"
              label={{ value: "Pass 40%", position: "right", fontSize: 10, fill: "var(--destructive)" }}
            />
            <Line
              type="monotone"
              dataKey="percentage"
              stroke="var(--chart-2)"
              strokeWidth={2.5}
              animationDuration={700}
              activeDot={{ r: 6 }}
              dot={(props) => {
                const { cx, cy, payload, index } = props as unknown as {
                  cx: number;
                  cy: number;
                  index: number;
                  payload: { percentage: number };
                };
                return (
                  <Dot
                    key={index}
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill={payload.percentage >= PASS ? "var(--chart-3)" : "var(--destructive)"}
                    stroke="var(--card)"
                    strokeWidth={1.5}
                  />
                );
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

function ExamTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: {
    payload: {
      label: string;
      date: string;
      marks: number;
      total: number;
      grade: string;
      percentage: number;
    };
  }[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <TooltipBox
      title={p.label}
      rows={[
        { label: "Date", value: new Date(`${p.date}T00:00:00`).toLocaleDateString("en-GB") },
        { label: "Marks", value: `${p.marks} / ${p.total}` },
        { label: "Percentage", value: `${p.percentage}%` },
        { label: "Grade", value: p.grade },
      ]}
    />
  );
}

/** Convenience wrapper that loads the student's summary and renders both charts. */
export function StudentStatsSection({ studentId }: { studentId: string }) {
  const { data: summary } = useStudentSummary(studentId);
  return <StudentCharts studentId={studentId} exams={summary?.exams ?? []} />;
}
