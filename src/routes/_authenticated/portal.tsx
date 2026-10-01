import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FileDown, GraduationCap, LogOut, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useClasses } from "@/lib/classes";
import { usePrograms } from "@/components/panels/StudentsPanel";
import { PrintFrame, usePrintable } from "@/lib/print";
import { useMyPortalAccount } from "@/lib/portal";
import { StudentPhoto } from "@/lib/student-photo";
import { formatPKR, STATUS_LABELS, type Student } from "@/lib/sms-types";
import { useStudentSummary } from "@/lib/student-summary";
import { ReportSheet, downloadSummaryPdf } from "@/components/students/StudentSummaryReport";
import { WeeklyTimetable } from "@/components/timetable/WeeklyTimetable";
import { useCollegeLogo } from "@/lib/college-assets";
import { useSignedPhoto } from "@/lib/student-photo";

export const Route = createFileRoute("/_authenticated/portal")({
  head: () => ({
    meta: [
      { title: "My College Record — GDC Chamla" },
      {
        name: "description",
        content:
          "Students and parents view attendance, fee dues, hostel allotment and exam results for Government Degree College Chamla, Buner.",
      },
      { property: "og:title", content: "My College Record — GDC Chamla" },
      {
        property: "og:description",
        content: "Attendance, fees, hostel and exam results in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PortalPage,
});

function useStudentRecord(studentId: string | null | undefined) {
  return useQuery({
    queryKey: ["portal-student", studentId],
    enabled: Boolean(studentId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("id", studentId!)
        .maybeSingle();
      if (error) throw error;
      return (data as Student | null) ?? null;
    },
  });
}

function PortalPage() {
  const navigate = useNavigate();
  const { data: account, isLoading: accountLoading } = useMyPortalAccount();
  const { data: student, isLoading: studentLoading } = useStudentRecord(account?.student_id);
  const { data: summary } = useStudentSummary(account?.student_id);
  const { data: programs = [] } = usePrograms();
  const { data: classes = [] } = useClasses();
  const { data: logo } = useCollegeLogo();
  const { data: photo } = useSignedPhoto(student?.photo_url);
  const { ref, print } = usePrintable(`Student summary — ${student?.roll_number ?? ""}`);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/portal-login", replace: true });
  }

  if (accountLoading || studentLoading) {
    return <CenteredNote>Loading your record…</CenteredNote>;
  }

  if (!account || !student) {
    return (
      <CenteredNote>
        This sign-in is not linked to a student record. Please use the staff sign-in, or contact the
        college office for a student/parent login.
      </CenteredNote>
    );
  }

  const programName = programs.find((p) => p.id === student.program_id)?.name ?? "—";
  const classLabel = classes.find((c) => c.id === student.class_id)?.name ?? "—";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-serif text-lg font-semibold">
              {student.full_name} · {student.roll_number}
            </h1>
            <p className="text-xs text-muted-foreground">
              {account.kind === "parent" ? "Parent view" : "Student view"} · read only ·{" "}
              {summary?.sessionLabel ?? ""}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="mr-1.5 h-4 w-4" /> Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <Card>
          <CardHeader className="flex flex-row items-start gap-3 sm:gap-4">
            <StudentPhoto
              path={student.photo_url}
              name={student.full_name}
              className="h-20 w-16 shrink-0 sm:h-24 sm:w-20"
            />
            <div className="min-w-0">
              <CardTitle className="font-serif text-lg sm:text-xl">{student.full_name}</CardTitle>
              <CardDescription>
                Roll {student.roll_number} · {programName} · {classLabel} ·{" "}
                {STATUS_LABELS[student.status]}
              </CardDescription>
              <p className="mt-1 text-sm text-muted-foreground">
                Father / guardian:{" "}
                {[student.father_name, student.guardian_name].filter(Boolean).join(" / ") || "—"}
              </p>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            <Button variant="outline" onClick={print}>
              <Printer className="mr-1.5 h-4 w-4" /> Print full summary
            </Button>
            <Button
              variant="outline"
              disabled={!summary}
              onClick={() =>
                summary && downloadSummaryPdf(student, programName, classLabel, summary)
              }
            >
              <FileDown className="mr-1.5 h-4 w-4" /> Download PDF
            </Button>
          </CardContent>
        </Card>

        {summary ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <Metric
                label="Attendance"
                value={summary.attendance.percentage === null ? "—" : `${summary.attendance.percentage}%`}
                hint={`${summary.attendance.present} present · ${summary.attendance.absent} absent · ${summary.attendance.leave} leave`}
                alert={summary.attendance.percentage !== null && summary.attendance.percentage < 75}
              />
              <Metric
                label="Fee outstanding"
                value={formatPKR(summary.tuition.outstanding)}
                hint={`${formatPKR(summary.tuition.paid)} paid of ${formatPKR(summary.tuition.due)} · ${summary.tuition.status}`}
                alert={summary.tuition.outstanding > 0}
              />
              <Metric
                label="Absentee fines"
                value={formatPKR(summary.fines.outstanding)}
                hint={`${formatPKR(summary.fines.accrued)} charged · ${formatPKR(summary.fines.paid)} paid`}
                alert={summary.fines.outstanding > 0}
              />
              <Metric
                label="Hostel"
                value={summary.hostel ? `${summary.hostel.room} · Bed ${summary.hostel.bed}` : "Day scholar"}
                hint={
                  summary.hostelFees
                    ? `${formatPKR(summary.hostelFees.outstanding)} outstanding · ${summary.hostelFees.status}`
                    : "No hostel allotment"
                }
                alert={Boolean(summary.hostelFees && summary.hostelFees.outstanding > 0)}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="font-serif text-lg">Examination results</CardTitle>
                <CardDescription>Every paper recorded for this student.</CardDescription>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                {summary.exams.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No marks recorded yet.</p>
                ) : (
                  <>
                    {/* Phone: one readable card per paper */}
                    <ul className="divide-y sm:hidden">
                      {summary.exams.map((e, i) => (
                        <li key={`m-${e.name}-${e.subject ?? ""}-${i}`} className="py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{e.name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {e.subject ?? "—"} · {e.exam_date}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="font-serif text-base font-semibold tabular-nums">
                                {e.marks}/{e.total}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {e.percentage === null ? "—" : `${e.percentage.toFixed(1)}%`} ·{" "}
                                <span className="font-medium text-foreground">{e.grade}</span>
                              </p>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>

                    <div className="hidden overflow-x-auto sm:block">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                            <th className="py-2 pr-3">Exam</th>
                            <th className="py-2 pr-3">Subject</th>
                            <th className="py-2 pr-3">Date</th>
                            <th className="py-2 pr-3 text-right">Marks</th>
                            <th className="py-2 pr-3 text-right">Total</th>
                            <th className="py-2 pr-3 text-right">%</th>
                            <th className="py-2 text-right">Grade</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.exams.map((e, i) => (
                            <tr
                              key={`${e.name}-${e.subject ?? ""}-${i}`}
                              className="border-b last:border-0"
                            >
                              <td className="py-2 pr-3">{e.name}</td>
                              <td className="py-2 pr-3">{e.subject ?? "—"}</td>
                              <td className="py-2 pr-3">{e.exam_date}</td>
                              <td className="py-2 pr-3 text-right">{e.marks}</td>
                              <td className="py-2 pr-3 text-right">{e.total}</td>
                              <td className="py-2 pr-3 text-right">
                                {e.percentage === null ? "—" : e.percentage.toFixed(1)}
                              </td>
                              <td className="py-2 text-right font-medium">{e.grade}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </CardContent>

            </Card>

            {student.class_id ? (
              <WeeklyTimetable
                classId={student.class_id}
                title={`Weekly timetable — ${classLabel}`}
                description="Lecture times and the teacher taking each class."
              />
            ) : null}

            <PrintFrame innerRef={ref}>
              <ReportSheet
                student={student}
                programName={programName}
                classLabel={classLabel}
                summary={summary}
                logo={logo ?? null}
                photo={photo ?? null}
              />
            </PrintFrame>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Loading your summary…</p>
        )}
      </main>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  alert,
}: {
  label: string;
  value: string;
  hint: string;
  alert?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-3 pt-4 sm:p-6">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-[11px]">
          {label}
        </p>
        <p
          className={`font-serif text-lg font-semibold break-words sm:text-2xl ${alert ? "text-destructive" : ""}`}
        >
          {value}
        </p>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground sm:text-xs">{hint}</p>
      </CardContent>
    </Card>
  );
}

function CenteredNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 text-center">
      <p className="max-w-md text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
