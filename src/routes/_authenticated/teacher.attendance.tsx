import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { AttendanceSection } from "@/components/attendance/AttendanceSection";
import { TeacherNav } from "@/routes/_authenticated/teacher";
import { useModuleGuard } from "@/lib/access";

export const Route = createFileRoute("/_authenticated/teacher/attendance")({
  head: () => ({
    meta: [
      { title: "Mark Attendance — GDC Chamla" },
      {
        name: "description",
        content:
          "Mark today's class attendance and view the monthly register at Government Degree College Chamla, Buner.",
      },
      { property: "og:title", content: "Mark Attendance — GDC Chamla" },
      {
        property: "og:description",
        content: "Daily attendance marking for GDC Chamla teaching staff.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    program: typeof search["program"] === "string" ? (search["program"] as string) : undefined,
    class: typeof search["class"] === "string" ? (search["class"] as string) : undefined,
    lecture: Number(search["lecture"]) > 0 ? Number(search["lecture"]) : undefined,
  }),
  component: TeacherAttendancePage,
});

function TeacherAttendancePage() {
  const _perms = useModuleGuard("attendance");
  void _perms;
  const { program, class: classId, lecture } = Route.useSearch();
  return (
    <AppShell
      title="Attendance"
      subtitle="Mark today's register. Records older than three days are locked and can only be corrected by the administration."
    >
      <TeacherNav />
      <AttendanceSection
        initialProgramId={program}
        initialClassId={classId}
        initialLecture={lecture}
      />
    </AppShell>
  );
}
