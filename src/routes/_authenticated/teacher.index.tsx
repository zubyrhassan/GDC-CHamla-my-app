import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { StudentsPanel } from "@/components/panels/StudentsPanel";
import { TeacherNav } from "@/routes/_authenticated/teacher";
import { UpcomingExamsWidget } from "@/components/exams/UpcomingExamsWidget";
import { MyClassesWidget } from "@/components/attendance/MyClassesWidget";
import { TimetableWidget } from "@/components/timetable/TimetableWidget";

export const Route = createFileRoute("/_authenticated/teacher/")({
  head: () => ({
    meta: [
      { title: "Teacher Desk — GDC Chamla SMS" },
      {
        name: "description",
        content:
          "Look up student records and mark daily attendance at Government Degree College Chamla, Buner.",
      },
      { property: "og:title", content: "Teacher Desk — GDC Chamla SMS" },
      {
        property: "og:description",
        content: "Student directory and daily attendance for GDC Chamla teaching staff.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeacherDeskPage,
});

function TeacherDeskPage() {
  return (
    <AppShell
      title="Teacher desk"
      subtitle="Look up student records and mark daily attendance. Fee and disciplinary records are restricted to the administration."
    >
      <TeacherNav />
      <div className="mb-6 space-y-6">
        <TimetableWidget />
        <MyClassesWidget />
        <UpcomingExamsWidget />
      </div>
      <StudentsPanel canEdit={false} />
    </AppShell>
  );
}
