import { useMemo } from "react";
import { FileDown, FileSpreadsheet, Lock, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useStudents } from "@/components/panels/StudentsPanel";
import { downloadTablePdf, usePrintable } from "@/lib/print";
import { exportExamResults, gradeFor, useExamResults, type Exam } from "@/lib/exams";

/** Read-only result sheet for an exam, with print, PDF and Excel outputs. */
export function ResultSheet({ exam, scope }: { exam: Exam; scope: string }) {
  const { data: results = [] } = useExamResults(exam.id);
  const { data: students = [] } = useStudents();
  const sheetPrint = usePrintable(`Result sheet ${exam.name}`);

  const rows = useMemo(() => {
    const byId = new Map(students.map((s) => [s.id, s]));
    return results
      .map((r) => ({ result: r, student: byId.get(r.student_id) }))
      .filter((r) => r.student)
      .sort((a, b) =>
        a.student!.roll_number.localeCompare(b.student!.roll_number, undefined, { numeric: true }),
      );
  }, [results, students]);

  const pdf = () =>
    downloadTablePdf({
      title: `Result Sheet — ${exam.name}${exam.subject ? ` (${exam.subject})` : ""}`,
      subtitles: [`Total ${exam.total_marks}`, scope],
      head: ["Roll No.", "Name", "Marks", "Total", "%", "Grade"],
      rows: rows.map(({ result, student }) => {
        const pct = exam.total_marks ? (result.marks_obtained / exam.total_marks) * 100 : 0;
        return [
          student!.roll_number,
          student!.full_name,
          result.marks_obtained,
          exam.total_marks,
          `${pct.toFixed(1)}%`,
          gradeFor(pct),
        ];
      }),
      filename: `result-sheet-${exam.name.replace(/[^\w-]+/g, "-")}.pdf`,
    });

  return (
    <section ref={sheetPrint.ref} className="print-result-wrap mt-6 rounded-lg border bg-card p-4 shadow-panel">
      <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-serif text-lg">
          {exam.name}
          {exam.subject ? ` — ${exam.subject}` : ""}
          {exam.finalized_at ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" /> Finalized
            </span>
          ) : null}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={rows.length === 0} onClick={sheetPrint.print}>
            <Printer className="mr-1.5 h-4 w-4" /> Print
          </Button>
          <Button variant="outline" size="sm" disabled={rows.length === 0} onClick={pdf}>
            <FileDown className="mr-1.5 h-4 w-4" /> PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={rows.length === 0}
            onClick={() =>
              exportExamResults(
                exam,
                rows.map(({ result, student }) => ({
                  roll_number: student!.roll_number,
                  full_name: student!.full_name,
                  marks: result.marks_obtained,
                })),
                scope,
              )
            }
          >
            <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Excel
          </Button>
        </div>
      </div>


      <div className="print-header print-only hidden">
        <h2>Government Degree College Chamla, District Buner</h2>
        <p>
          Result Sheet — {exam.name}
          {exam.subject ? ` (${exam.subject})` : ""} · Total {exam.total_marks} · {scope}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No marks have been recorded for this exam.</p>
      ) : (
        <Table className="print-table">
          <TableHeader>
            <TableRow>
              <TableHead>Roll No.</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-center">Marks</TableHead>
              <TableHead className="text-center">Total</TableHead>
              <TableHead className="text-center">%</TableHead>
              <TableHead className="text-center">Grade</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ result, student }) => {
              const pct = exam.total_marks ? (result.marks_obtained / exam.total_marks) * 100 : 0;
              return (
                <TableRow key={result.id}>
                  <TableCell>{student!.roll_number}</TableCell>
                  <TableCell>{student!.full_name}</TableCell>
                  <TableCell className="text-center tabular-nums">
                    {result.marks_obtained}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">{exam.total_marks}</TableCell>
                  <TableCell className="text-center tabular-nums">{pct.toFixed(1)}%</TableCell>
                  <TableCell className="text-center font-serif font-semibold">
                    {gradeFor(pct)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
