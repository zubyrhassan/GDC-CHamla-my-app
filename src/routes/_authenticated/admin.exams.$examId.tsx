import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, FileDown, FileSpreadsheet, Lock, LockOpen, Printer } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/routes/_authenticated/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { usePrograms, useStudents } from "@/components/panels/StudentsPanel";
import { useClasses } from "@/lib/classes";
import { exportExamResults, gradeFor, useExam, useExamResults } from "@/lib/exams";
import { useExamSubjects } from "@/lib/exam-subjects";
import { ExamPapersCard } from "@/components/exams/ExamPapersCard";
import { cn } from "@/lib/utils";
import { downloadTablePdf, usePrintable } from "@/lib/print";
import type { Student } from "@/lib/sms-types";
import { useModuleGuard } from "@/lib/access";
import { Badge } from "@/components/ui/badge";
import {
  MarksImportButton,
  MarksTemplateButton,
} from "@/components/exams/MarksImportDialog";
import { MarksScanButton } from "@/components/exams/MarksScanButton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/admin/exams/$examId")({
  head: () => ({
    meta: [
      { title: "Marks Entry — GDC Chamla" },
      {
        name: "description",
        content:
          "Enter examination marks student by student and print the official result sheet for Government Degree College Chamla, Buner.",
      },
      { property: "og:title", content: "Marks Entry — GDC Chamla" },
      {
        property: "og:description",
        content: "Record exam marks and print result sheets for GDC Chamla.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MarksEntryPage,
});

const byRoll = (a: Student, b: Student) =>
  a.roll_number.localeCompare(b.roll_number, undefined, { numeric: true, sensitivity: "base" });

function MarksEntryPage() {
  const perms = useModuleGuard("examinations");
  const { examId } = Route.useParams();
  const queryClient = useQueryClient();

  const { data: exam, isLoading: examLoading } = useExam(examId);
  const { data: results = [] } = useExamResults(examId);
  const { data: papers = [] } = useExamSubjects(examId);
  const [paperId, setPaperId] = useState<string | null>(null);
  const { data: students = [] } = useStudents();
  const { data: programs = [] } = usePrograms();
  const { data: classes = [] } = useClasses();

  /** Local draft values so typing stays smooth while saves happen in the background. */
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  /** Set after a bulk import so freshly uploaded marks replace the on-screen drafts. */
  const forceSync = useRef(false);

  const paperResults = useMemo(
    () => results.filter((r) => (r.exam_subject_id ?? null) === paperId),
    [results, paperId],
  );

  useEffect(() => {
    const map: Record<string, string> = {};
    for (const r of paperResults) map[r.student_id] = String(r.marks_obtained);
    setDraft(map);
    forceSync.current = false;
  }, [paperResults, paperId]);

  useEffect(() => {
    const pendingTimers = timers.current;
    return () => {
      for (const t of Object.values(pendingTimers)) clearTimeout(t);
    };
  }, []);

  const roster = useMemo(() => {
    if (!exam) return [];
    return students
      .filter(
        (s) =>
          s.status === "active" &&
          (!exam.class_id || s.class_id === exam.class_id) &&
          (!exam.program_id || s.program_id === exam.program_id),
      )
      .sort(byRoll);
  }, [students, exam]);

  const activePaper = papers.find((p) => p.id === paperId) ?? null;
  const total = activePaper?.total_marks ?? exam?.total_marks ?? 0;
  const finalized = Boolean(exam?.finalized_at);
  /** Finalized results stay visible but can no longer be edited. */
  const canEditMarks = perms.can("examinations", "edit") && !finalized;

  const finalize = useMutation({
    mutationFn: async (lock: boolean) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("exams")
        .update(
          lock
            ? { finalized_at: new Date().toISOString(), finalized_by: userData.user?.id ?? null }
            : { finalized_at: null, finalized_by: null },
        )
        .eq("id", examId);
      if (error) throw error;
      return lock;
    },
    onSuccess: (lock) => {
      toast.success(lock ? "Results finalized — marks entry is locked" : "Exam unlocked for edits");
      void queryClient.invalidateQueries({ queryKey: ["exam", examId] });
      void queryClient.invalidateQueries({ queryKey: ["exams"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** Debounced auto-save — no explicit save button anywhere on this screen. */
  const queueSave = (studentId: string, raw: string) => {
    setDraft((d) => ({ ...d, [studentId]: raw }));
    const existing = timers.current[studentId];
    if (existing) clearTimeout(existing);
    if (raw.trim() === "") return;
    const marks = Number(raw);
    if (!Number.isFinite(marks) || marks < 0 || marks > total) return;

    timers.current[studentId] = setTimeout(async () => {
      setSaving((s) => ({ ...s, [studentId]: true }));
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("exam_results").upsert(
        {
          exam_id: examId,
          student_id: studentId,
          marks_obtained: marks,
          exam_subject_id: paperId,
          recorded_by: userData.user?.id ?? null,
        },
        { onConflict: "exam_id,student_id,exam_subject_id" },
      );
      setSaving((s) => ({ ...s, [studentId]: false }));
      if (error) toast.error(error.message);
      else void queryClient.invalidateQueries({ queryKey: ["exam-results", examId] });
    }, 600);
  };

  const rows = roster.map((s) => {
    const raw = draft[s.id] ?? "";
    const marks = raw.trim() === "" ? null : Number(raw);
    const valid = marks !== null && Number.isFinite(marks) && marks >= 0 && marks <= total;
    const pct = valid && total > 0 ? (marks / total) * 100 : null;
    return { student: s, raw, marks, valid, pct };
  });

  const scope = exam
    ? [
        classes.find((c) => c.id === exam.class_id)?.name,
        programs.find((p) => p.id === exam.program_id)?.name,
      ]
        .filter(Boolean)
        .join(" · ") || "All active students"
    : "";
  const sheetPrint = usePrintable(`Result sheet ${exam?.name ?? ""}`);

  const downloadSheetPdf = () => {
    if (!exam || rows.length === 0) {
      toast.error("There are no results to export yet.");
      return;
    }
    downloadTablePdf({
      title: `Result Sheet — ${exam.name}${exam.subject ? ` (${exam.subject})` : ""}`,
      subtitles: [
        `Total ${exam.total_marks} · ${new Date(exam.exam_date + "T00:00:00").toLocaleDateString("en-GB")}`,
        scope,
      ],
      head: ["Roll No.", "Name", "Marks obtained", "Total", "%", "Grade"],
      rows: rows.map(({ student, raw, pct }) => [
        student.roll_number,
        student.full_name,
        raw || "—",
        exam.total_marks,
        pct === null ? "—" : `${pct.toFixed(1)}%`,
        pct === null ? "—" : gradeFor(pct),
      ]),
      filename: `result-sheet-${exam.name.replace(/[^\w-]+/g, "-")}.pdf`,
    });
  };


  if (examLoading || !exam) {
    return (
      <AppShell title="Marks entry" subtitle="Loading examination…">
        <AdminNav />
      </AppShell>
    );
  }

  return (
    <AppShell
      title={exam.name}
      subtitle={`${exam.subject ? exam.subject + " · " : ""}Total ${exam.total_marks} marks · ${new Date(
        exam.exam_date + "T00:00:00",
      ).toLocaleDateString("en-GB")} · ${scope}`}
    >
      <AdminNav />

      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/exams">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> All exams
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {finalized ? (
            <Badge variant="secondary" className="gap-1">
              <Lock className="h-3 w-3" /> Finalized{" "}
              {new Date(exam?.finalized_at ?? "").toLocaleDateString("en-GB")}
            </Badge>
          ) : null}
          <Button
            variant="outline"
            onClick={() =>
              exam &&
              exportExamResults(
                exam,
                rows.map((r) => ({
                  roll_number: r.student.roll_number,
                  full_name: r.student.full_name,
                  marks: r.valid ? r.marks : null,
                })),
                scope,
              )
            }
          >
            <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Export to Excel
          </Button>
          {canEditMarks ? (
            <>
              <MarksTemplateButton
                exam={exam}
                roster={rows.map((r) => ({
                  id: r.student.id,
                  roll_number: r.student.roll_number,
                  full_name: r.student.full_name,
                  marks: r.valid ? r.marks : null,
                }))}
              />
              <MarksImportButton
                examId={examId}
                totalMarks={total}
                roster={rows.map((r) => ({
                  id: r.student.id,
                  roll_number: r.student.roll_number,
                  full_name: r.student.full_name,
                }))}
                onImported={() => {
                  forceSync.current = true;
                }}
              />
              <MarksScanButton
                examId={examId}
                totalMarks={total}
                roster={rows.map((r) => ({
                  id: r.student.id,
                  roll_number: r.student.roll_number,
                  full_name: r.student.full_name,
                }))}
                onImported={() => {
                  forceSync.current = true;
                }}
              />
            </>
          ) : null}
          <Button variant="outline" onClick={sheetPrint.print}>
            <Printer className="mr-1.5 h-4 w-4" /> Print result sheet
          </Button>
          <Button variant="outline" onClick={downloadSheetPdf}>
            <FileDown className="mr-1.5 h-4 w-4" /> Download PDF
          </Button>
          {perms.can("examinations", "edit") ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant={finalized ? "outline" : "default"} disabled={finalize.isPending}>
                  {finalized ? (
                    <>
                      <LockOpen className="mr-1.5 h-4 w-4" /> Unlock
                    </>
                  ) : (
                    <>
                      <Lock className="mr-1.5 h-4 w-4" /> Finalize
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-serif">
                    {finalized ? "Unlock this exam?" : "Finalize these results?"}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {finalized
                      ? "Marks entry will be reopened for this exam. Finalize it again once corrections are done."
                      : "Marks entry will be locked for everyone. Results stay viewable, printable and exportable. An administrator can unlock the exam later if a correction is needed."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => finalize.mutate(!finalized)}>
                    {finalized ? "Unlock" : "Finalize results"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </div>
      </div>

      {finalized ? (
        <p className="no-print mb-4 flex items-center gap-2 rounded-md border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
          <Lock className="h-4 w-4 shrink-0" />
          These results are finalized. Marks can no longer be edited, but the sheet remains viewable
          and printable.
        </p>
      ) : null}

      <ExamPapersCard
        examId={examId}
        papers={papers}
        canEdit={canEditMarks}
        activePaperId={paperId}
        onSelect={setPaperId}
      />

      <div
        ref={sheetPrint.ref}
        className="print-result-wrap overflow-x-auto rounded-lg border bg-card shadow-panel"
      >
        <div className="print-header print-only hidden">
          <h2>Government Degree College Chamla, District Buner</h2>
          <p>
            Result Sheet — {exam.name}
            {activePaper ? ` (${activePaper.name})` : exam.subject ? ` (${exam.subject})` : ""} ·
            Total {total} ·{" "}
            {new Date(exam.exam_date + "T00:00:00").toLocaleDateString("en-GB")} · {scope}
          </p>
        </div>

        <table className="print-table w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-3 py-2 text-left font-medium">Roll No.</th>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-center font-medium">Marks obtained</th>
              <th className="px-3 py-2 text-center font-medium">Total</th>
              <th className="px-3 py-2 text-center font-medium">%</th>
              <th className="px-3 py-2 text-center font-medium">Grade</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-muted-foreground">
                  No active students match this exam's scope.
                </td>
              </tr>
            ) : (
              rows.map(({ student, raw, valid, pct }) => (
                <tr key={student.id} className="border-b last:border-0">
                  <td className="px-3 py-2 whitespace-nowrap">{student.roll_number}</td>
                  <td className="px-3 py-2">{student.full_name}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={canEditMarks ? "print-only hidden" : "block"}>
                      {raw || "—"}
                    </span>
                    {canEditMarks ? (
                    <Input
                      type="number"
                      min={0}
                      max={total}
                      step="any"
                      inputMode="decimal"
                      value={raw}
                      aria-label={`Marks for ${student.full_name}`}
                      aria-invalid={raw.trim() !== "" && !valid}
                      onChange={(e) => queueSave(student.id, e.target.value)}
                      className={cn(
                        "no-print mx-auto h-9 w-24 text-center",
                        raw.trim() !== "" && !valid ? "border-destructive" : "",
                      )}
                    />
                    ) : null}
                    {raw.trim() !== "" && !valid ? (
                      <span className="no-print mt-1 block text-[10px] text-destructive">
                        0–{total} only
                      </span>
                    ) : saving[student.id] ? (
                      <span className="no-print mt-1 block text-[10px] text-muted-foreground">
                        Saving…
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums">{total}</td>
                  <td className="px-3 py-2 text-center tabular-nums">
                    {pct === null ? "—" : `${pct.toFixed(1)}%`}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-center font-serif font-semibold",
                      pct !== null && pct < 40 ? "text-destructive" : "",
                    )}
                  >
                    {pct === null ? "—" : gradeFor(pct)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
