import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BedDouble,
  CalendarCheck,
  GraduationCap,
  Receipt,
  UserMinus,
  Wallet,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { AdminNav } from "./admin";
import { AttendanceTrendChart } from "@/components/charts/AttendanceTrendChart";
import {
  EnrollmentChart,
  ExamPerformanceChart,
  FeeCollectionChart,
  FineMiniChart,
} from "@/components/charts/DashboardCharts";
import { CountUp, StatCard } from "@/components/charts/primitives";
import { useDashboardStats } from "@/lib/analytics";
import { formatPKR } from "@/lib/sms-types";
import { usePermissions } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Administration — GDC Chamla SMS" },
      {
        name: "description",
        content:
          "Administrator dashboard with attendance, fee collection, enrolment and exam performance charts for GDC Chamla.",
      },
      { property: "og:title", content: "Administration — GDC Chamla SMS" },
      {
        property: "og:description",
        content: "Live charts for attendance, fees, enrolment and exam results at GDC Chamla.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const { can, isSuperAdmin } = usePermissions();
  const { data: stats, isLoading, error } = useDashboardStats();

  const today = new Date().toISOString().slice(0, 10);
  const todayRow = stats?.attendance_daily.find((d) => d.date === today) ?? null;
  const todayCounted = todayRow ? todayRow.present + todayRow.absent : 0;
  const todayPct = todayCounted ? Math.round((todayRow!.present / todayCounted) * 100) : null;

  const outstanding = stats
    ? Math.max(0, stats.fees_total_charged - stats.fees_total_collected)
    : 0;

  return (
    <AppShell
      title="Administration"
      subtitle={
        stats
          ? `Live picture of ${stats.session_label} at Government Degree College Chamla.`
          : "Key numbers at a glance for Government Degree College Chamla."
      }
    >
      <AdminNav />

      {error ? (
        <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
          Could not load dashboard statistics: {(error as Error).message}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {can("students", "view") ? (
          <Link to="/admin/students" className="block h-full">
            <StatCard
              label="Active students"
              icon={GraduationCap}
              tone="primary"
              value={<CountUp value={stats?.students.active ?? 0} />}
              hint={`${stats?.students.total ?? 0} on the register`}
            />
          </Link>
        ) : null}
        {can("attendance", "view") ? (
          <Link to="/admin/attendance" className="block h-full">
            <StatCard
              label="Attendance today"
              icon={CalendarCheck}
              tone={todayPct !== null && todayPct < 75 ? "destructive" : "success"}
              value={todayPct === null ? "—" : <CountUp value={todayPct} format={(n) => `${n}%`} />}
              hint={
                todayCounted
                  ? `${todayRow?.present ?? 0} of ${todayCounted} present`
                  : "Not marked yet today"
              }
            />
          </Link>
        ) : null}
        {can("fees", "view") ? (
          <Link to="/admin/fees" className="block h-full">
            <StatCard
              label="Outstanding dues"
              icon={Wallet}
              tone="accent"
              value={<CountUp value={outstanding} format={formatPKR} />}
              hint={`${formatPKR(stats?.fees_total_collected ?? 0)} collected to date`}
            />
          </Link>
        ) : null}
        {can("struck_off", "view") ? (
          <Link to="/admin/struck-off" className="block h-full">
            <StatCard
              label="Struck off"
              icon={UserMinus}
              tone="destructive"
              value={<CountUp value={stats?.students.struck_off ?? 0} />}
              hint="Awaiting readmission"
            />
          </Link>
        ) : null}
        {can("hostel", "view") ? (
          <Link to="/admin/hostel" className="block h-full">
            <StatCard
              label="Hostel boarders"
              icon={BedDouble}
              tone="primary"
              value={<CountUp value={stats?.students.hostel ?? 0} />}
              hint="Active seat allotments"
            />
          </Link>
        ) : null}
        {can("fees", "view") ? (
          <Link to="/admin/absentee-report" className="block h-full">
            <StatCard
              label="Absentee fines"
              icon={Receipt}
              tone="accent"
              value={<CountUp value={stats?.fines.accrued ?? 0} format={formatPKR} />}
              hint={`${stats?.fines.count ?? 0} fines this session`}
            />
          </Link>
        ) : null}
      </div>

      {isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading charts…</p>
      ) : stats ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {can("attendance", "view") ? (
            <AttendanceTrendChart
              days={stats.attendance_daily}
              title="College attendance trend"
              description="All students combined. The dashed line marks the 75% requirement."
              defaultGranularity="weekly"
            />
          ) : null}
          {can("fees", "view") ? <FeeCollectionChart stats={stats} /> : null}
          {can("students", "view") ? <EnrollmentChart stats={stats} /> : null}
          {can("examinations", "view") ? <ExamPerformanceChart stats={stats} /> : null}
          {can("fees", "view") ? <FineMiniChart stats={stats} /> : null}
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {can("attendance", "view") ? (
          <QuickLink to="/admin/attendance" title="Mark attendance" text="Day view and monthly register." />
        ) : null}
        {can("fees", "view") ? (
          <QuickLink to="/admin/fees" title="Record a payment" text="Issue an official fee receipt." />
        ) : null}
        {can("examinations", "view") ? (
          <QuickLink
            to="/admin/exams"
            title="Examinations"
            text="Create exams, enter marks, print results."
          />
        ) : null}
        {can("students", "view") ? (
          <QuickLink to="/admin/students" title="Student register" text="Search, admit and edit records." />
        ) : null}
        {can("struck_off", "view") ? (
          <QuickLink to="/admin/struck-off" title="Struck-off register" text="Export the list or readmit." />
        ) : null}
        {can("settings", "view") ? (
          <QuickLink to="/admin/programs" title="Programs" text="Streams and AD programs." />
        ) : null}
        {can("settings", "view") ? (
          <QuickLink to="/admin/settings" title="Settings" text="Rules, fee heads, logo, teacher logins." />
        ) : null}
        {isSuperAdmin ? (
          <QuickLink to="/admin/roles" title="Roles & permissions" text="Set what each role can do." />
        ) : null}
        {isSuperAdmin ? (
          <QuickLink to="/admin/staff" title="Staff accounts" text="Create logins and exceptions." />
        ) : null}
      </div>
    </AppShell>
  );
}

function QuickLink({
  to,
  title,
  text,
}: {
  to:
    | "/admin/attendance"
    | "/admin/exams"
    | "/admin/fees"
    | "/admin/students"
    | "/admin/struck-off"
    | "/admin/programs"
    | "/admin/settings"
    | "/admin/roles"
    | "/admin/staff";
  title: string;
  text: string;
}) {
  return (
    <Link
      to={to}
      className="rounded-lg border bg-card px-4 py-3 shadow-panel transition-colors hover:border-primary/60 hover:bg-accent/5"
    >
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{text}</p>
    </Link>
  );
}
