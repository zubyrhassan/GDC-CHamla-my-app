import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/AppShell";
import { TeacherNav } from "@/routes/_authenticated/teacher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePrograms } from "@/components/panels/StudentsPanel";
import { useClasses } from "@/lib/classes";
import { useExams, type Exam } from "@/lib/exams";
import { ResultSheet } from "@/components/exams/ResultSheet";
import { useModuleGuard } from "@/lib/access";

export const Route = createFileRoute("/_authenticated/teacher/exams")({
  head: () => ({
    meta: [
      { title: "Exam Results — GDC Chamla" },
      {
        name: "description",
        content:
          "View examinations and student results at Government Degree College Chamla, Buner. Marks entry is handled by the administration.",
      },
      { property: "og:title", content: "Exam Results — GDC Chamla" },
      {
        property: "og:description",
        content: "Read-only exam and result view for GDC Chamla teaching staff.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeacherExamsPage,
});

function TeacherExamsPage() {
  const _perms = useModuleGuard("examinations");
  void _perms;
  const { data: exams = [], isLoading } = useExams();
  const { data: programs = [] } = usePrograms();
  const { data: classes = [] } = useClasses();
  const [selected, setSelected] = useState<Exam | null>(null);

  const scopeOf = (e: Exam) =>
    [classes.find((c) => c.id === e.class_id)?.name, programs.find((p) => p.id === e.program_id)?.name]
      .filter(Boolean)
      .join(" · ") || "All active students";

  return (
    <AppShell
      title="Examinations"
      subtitle="View exams and results. Only the administration can create exams or enter marks."
    >
      <TeacherNav />

      <div className="overflow-x-auto rounded-lg border bg-card shadow-panel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Exam</TableHead>
              <TableHead className="hidden sm:table-cell">Subject</TableHead>
              <TableHead className="text-center">Total</TableHead>
              <TableHead className="hidden md:table-cell">Date</TableHead>
              <TableHead className="hidden lg:table-cell">Scope</TableHead>
              <TableHead className="text-right">Results</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Loading exams…
                </TableCell>
              </TableRow>
            ) : exams.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No exams have been created yet.
                </TableCell>
              </TableRow>
            ) : (
              exams.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell className="hidden sm:table-cell">{e.subject ?? "—"}</TableCell>
                  <TableCell className="text-center tabular-nums">{e.total_marks}</TableCell>
                  <TableCell className="hidden whitespace-nowrap md:table-cell">
                    {new Date(e.exam_date + "T00:00:00").toLocaleDateString("en-GB")}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <Badge variant="secondary">{scopeOf(e)}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setSelected(e)}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {selected ? <ResultSheet exam={selected} scope={scopeOf(selected)} /> : null}
    </AppShell>
  );
}
