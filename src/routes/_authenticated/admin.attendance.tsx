import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/routes/_authenticated/admin";
import { AttendanceSection } from "@/components/attendance/AttendanceSection";
import { useModuleGuard } from "@/lib/access";

export const Route = createFileRoute("/_authenticated/admin/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance Register — GDC Chamla" },
      {
        name: "description",
        content:
          "Daily attendance marking and monthly attendance register for Government Degree College Chamla, Buner.",
      },
      { property: "og:title", content: "Attendance Register — GDC Chamla" },
      {
        property: "og:description",
        content: "Mark daily attendance and print the monthly register for GDC Chamla.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminAttendancePage,
});

function AdminAttendancePage() {
  const _perms = useModuleGuard("attendance");
  void _perms;
  return (
    <AppShell
      title="Attendance"
      subtitle="Mark the daily register, review the monthly register, and print official attendance sheets."
    >
      <AdminNav />
      <AttendanceSection />
    </AppShell>
  );
}
