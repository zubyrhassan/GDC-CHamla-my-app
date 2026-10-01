import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useSessionSettings } from "@/lib/absentee-fines";

export type Granularity = "daily" | "weekly" | "monthly";

export const GRANULARITIES: { key: Granularity; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];

export type DayCount = {
  date: string;
  present: number;
  absent: number;
  leave: number;
  total: number;
};

export type TrendPoint = {
  key: string;
  label: string;
  percentage: number | null;
  present: number;
  absent: number;
  counted: number;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseDate(iso: string) {
  return new Date(`${iso}T00:00:00`);
}

/** Monday-based ISO week start for a date string. */
function weekStart(iso: string) {
  const d = parseDate(iso);
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  return d.toISOString().slice(0, 10);
}

function shortDate(iso: string) {
  const d = parseDate(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return `${MONTHS[Number(m) - 1] ?? m} ${String(y).slice(2)}`;
}

/** Bucket per-day attendance counts into a percentage trend at the chosen granularity. */
export function buildTrend(days: DayCount[], granularity: Granularity): TrendPoint[] {
  const buckets = new Map<string, { present: number; absent: number; counted: number }>();

  for (const day of days) {
    const key =
      granularity === "daily"
        ? day.date
        : granularity === "weekly"
          ? weekStart(day.date)
          : day.date.slice(0, 7);
    const bucket = buckets.get(key) ?? { present: 0, absent: 0, counted: 0 };
    bucket.present += day.present;
    bucket.absent += day.absent;
    bucket.counted += day.present + day.absent;
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, b]) => ({
      key,
      label:
        granularity === "monthly"
          ? monthLabel(key)
          : granularity === "weekly"
            ? `w/c ${shortDate(key)}`
            : shortDate(key),
      percentage: b.counted > 0 ? Math.round((b.present / b.counted) * 100) : null,
      present: b.present,
      absent: b.absent,
      counted: b.counted,
    }));
}

/** One student's day-by-day attendance for the running session. */
export function useStudentAttendanceDays(studentId: string | null | undefined) {
  const { data: settings } = useSessionSettings();
  const sessionStart = settings?.sessionStart ?? null;

  return useQuery({
    queryKey: ["student-attendance-days", studentId, sessionStart],
    enabled: Boolean(studentId) && Boolean(settings),
    queryFn: async (): Promise<DayCount[]> => {
      let query = supabase
        .from("attendance_records")
        .select("date, status")
        .eq("student_id", studentId!)
        .order("date");
      if (sessionStart) query = query.gte("date", sessionStart);
      const { data, error } = await query;
      if (error) throw error;

      const map = new Map<string, DayCount>();
      for (const row of (data ?? []) as { date: string; status: string }[]) {
        const day = map.get(row.date) ?? {
          date: row.date,
          present: 0,
          absent: 0,
          leave: 0,
          total: 0,
        };
        if (row.status === "present") day.present += 1;
        else if (row.status === "absent") day.absent += 1;
        else day.leave += 1;
        day.total += 1;
        map.set(row.date, day);
      }
      return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
    },
  });
}

export type DashboardStats = {
  session_label: string;
  attendance_daily: DayCount[];
  fees_monthly: { month: string; collected: number }[];
  dues_monthly: { month: string; charged: number }[];
  fees_total_charged: number;
  fees_total_collected: number;
  enrollment: { program: string; students: number }[];
  students: { total: number; active: number; struck_off: number; hostel: number };
  exam_averages: { exam: string; exam_date: string; average: number | null; students: number }[];
  fines: { accrued: number; count: number; monthly: { month: string; amount: number }[] };
};

/** Pre-aggregated dashboard numbers — computed in the database, not in the browser. */
export function useDashboardStats(days = 180) {
  return useQuery({
    queryKey: ["dashboard-stats", days],
    staleTime: 60_000,
    queryFn: async (): Promise<DashboardStats> => {
      const { data, error } = await supabase.rpc("dashboard_stats", { _days: days });
      if (error) throw error;
      return data as unknown as DashboardStats;
    },
  });
}

/** Merge charged vs collected per month into one chart series. */
export function mergeFeeMonths(
  collected: { month: string; collected: number }[],
  charged: { month: string; charged: number }[],
) {
  const months = new Set([...collected.map((c) => c.month), ...charged.map((c) => c.month)]);
  return [...months]
    .sort()
    .map((month) => ({
      month,
      label: monthLabel(month),
      collected: collected.find((c) => c.month === month)?.collected ?? 0,
      charged: charged.find((c) => c.month === month)?.charged ?? 0,
    }));
}

/** Day-by-day attendance for a whole class roster (running session). */
export function useClassAttendanceDays(studentIds: string[]) {
  const { data: settings } = useSessionSettings();
  const sessionStart = settings?.sessionStart ?? null;
  const ids = [...studentIds].sort();

  return useQuery({
    queryKey: ["class-attendance-days", ids, sessionStart],
    enabled: ids.length > 0 && Boolean(settings),
    staleTime: 30_000,
    queryFn: async (): Promise<DayCount[]> => {
      let query = supabase
        .from("attendance_records")
        .select("date, status")
        .in("student_id", ids)
        .order("date");
      if (sessionStart) query = query.gte("date", sessionStart);
      const { data, error } = await query;
      if (error) throw error;

      const map = new Map<string, DayCount>();
      for (const row of (data ?? []) as { date: string; status: string }[]) {
        const day = map.get(row.date) ?? {
          date: row.date,
          present: 0,
          absent: 0,
          leave: 0,
          total: 0,
        };
        if (row.status === "present") day.present += 1;
        else if (row.status === "absent") day.absent += 1;
        else day.leave += 1;
        day.total += 1;
        map.set(row.date, day);
      }
      return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
    },
  });
}

/** Overall present-percentage across a set of days, leave excluded. */
export function averagePercentage(days: DayCount[]) {
  let present = 0;
  let counted = 0;
  for (const d of days) {
    present += d.present;
    counted += d.present + d.absent;
  }
  return counted > 0 ? Math.round((present / counted) * 100) : null;
}
