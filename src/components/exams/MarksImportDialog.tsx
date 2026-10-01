import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Download, FileSpreadsheet, Upload, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  downloadMarksTemplate,
  isBlankMarksRow,
  parseMarksFile,
} from "@/lib/marks-import";

type Failure = { row: number; reason: string };

export type RosterEntry = {
  id: string;
  roll_number: string;
  full_name: string;
  marks?: number | null;
};

/** Downloads a CSV pre-filled with the exam roster, ready for offline marking. */
export function MarksTemplateButton({
  exam,
  roster,
}: {
  exam: { name: string; total_marks: number; exam_date: string };
  roster: RosterEntry[];
}) {
  return (
    <Button variant="outline" onClick={() => downloadMarksTemplate(exam, roster)}>
      <Download className="mr-1.5 h-4 w-4" /> Marks template
    </Button>
  );
}

/** Bulk marks entry from a filled-in CSV/Excel sheet of roll numbers and scores. */
export function MarksImportButton({
  examId,
  totalMarks,
  roster,
  disabled,
  onImported,
}: {
  examId: string;
  totalMarks: number;
  roster: RosterEntry[];
  disabled?: boolean;
  onImported?: () => void;
}) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    failures: Failure[];
    total: number;
  } | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const rows = (await parseMarksFile(file, totalMarks)).filter((r) => !isBlankMarksRow(r));
      const byRoll = new Map(roster.map((s) => [s.roll_number.trim().toLowerCase(), s]));
      const { data: userData } = await supabase.auth.getUser();
      const recorded_by = userData.user?.id ?? null;

      const failures: Failure[] = [];
      const seen = new Set<string>();
      const payload: {
        exam_id: string;
        student_id: string;
        marks_obtained: number;
        recorded_by: string | null;
      }[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!;
        const line = i + 2; // header occupies line 1

        const key = row.roll_number.toLowerCase();
        if (!key) {
          failures.push({ row: line, reason: "missing Roll No." });
          continue;
        }
        const student = byRoll.get(key);
        if (!student) {
          failures.push({
            row: line,
            reason: `Roll No. '${row.roll_number}' is not in this exam's roster`,
          });
          continue;
        }
        if (seen.has(key)) {
          failures.push({ row: line, reason: `Roll No. '${row.roll_number}' repeats in this file` });
          continue;
        }
        if (row.marks === "") {
          failures.push({ row: line, reason: "missing Marks Obtained" });
          continue;
        }
        const marks = Number(row.marks);
        if (!Number.isFinite(marks)) {
          failures.push({ row: line, reason: `'${row.marks}' is not a number` });
          continue;
        }
        if (marks < 0 || marks > totalMarks) {
          failures.push({ row: line, reason: `${marks} is outside 0–${totalMarks}` });
          continue;
        }

        seen.add(key);
        payload.push({
          exam_id: examId,
          student_id: student.id,
          marks_obtained: marks,
          recorded_by,
        });
      }

      let imported = 0;
      if (payload.length) {
        const { error } = await supabase
          .from("exam_results")
          .upsert(payload, { onConflict: "exam_id,student_id" });
        if (error) {
          failures.push({ row: 0, reason: error.message });
        } else {
          imported = payload.length;
        }
      }

      setResult({ imported, failures, total: rows.length });
      if (imported) onImported?.();
      void queryClient.invalidateQueries({ queryKey: ["exam-results", examId] });
      if (imported) toast.success(`Marks saved for ${imported} student${imported === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <Button
        variant="outline"
        disabled={busy || disabled}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="mr-1.5 h-4 w-4" /> {busy ? "Importing…" : "Import marks"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      <Dialog open={Boolean(result)} onOpenChange={(o) => !o && setResult(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">Marks import summary</DialogTitle>
            <DialogDescription>
              {result?.total ?? 0} data row{result?.total === 1 ? "" : "s"} were read from the file.
              Column names are detected automatically (Roll No./Roll Number/Reg No, Name, Marks
              Obtained/Obtained/Score, Total, %).
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-3">
            <div className="flex flex-1 items-center gap-2 rounded-lg border bg-card p-3">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <div>
                <p className="font-serif text-lg font-semibold">{result?.imported ?? 0}</p>
                <p className="text-xs text-muted-foreground">Saved</p>
              </div>
            </div>
            <div className="flex flex-1 items-center gap-2 rounded-lg border bg-card p-3">
              <XCircle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-serif text-lg font-semibold">{result?.failures.length ?? 0}</p>
                <p className="text-xs text-muted-foreground">Skipped</p>
              </div>
            </div>
          </div>

          {result && result.failures.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">
                Rows that need attention
              </p>
              <ul className="space-y-1 rounded-lg border bg-muted/30 p-3 text-sm">
                {result.failures.map((f, i) => (
                  <li key={`${f.row}-${i}`}>
                    <strong>{f.row ? `Row ${f.row}:` : "Error:"}</strong> {f.reason}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Fix these rows and import the file again — saved marks are simply overwritten.
              </p>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4" /> Every row was saved successfully.
            </p>
          )}

          <DialogFooter>
            <Button onClick={() => setResult(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
