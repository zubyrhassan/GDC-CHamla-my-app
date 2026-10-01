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
import { useClasses } from "@/lib/classes";
import { usePrograms } from "@/components/panels/StudentsPanel";
import {
  downloadStudentTemplate,
  field,
  isBlankRow,
  parseStudentFile,
  TEMPLATE_HEADERS,
} from "@/lib/student-import";

type Failure = { row: number; reason: string };

export function DownloadTemplateButton() {
  return (
    <Button variant="outline" onClick={downloadStudentTemplate}>
      <Download className="mr-1.5 h-4 w-4" /> Excel template
    </Button>
  );
}

/** Bulk admission from a filled-in .xlsx/.xls/.csv template. */
export function BulkImportButton() {
  const queryClient = useQueryClient();
  const { data: programs = [] } = usePrograms();
  const { data: classes = [] } = useClasses();

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
      const rows = (await parseStudentFile(file)).filter((r) => !isBlankRow(r));
      const programByName = new Map(programs.map((p) => [p.name.trim().toLowerCase(), p.id]));
      // Classes belong to a program, so match on program + class name.
      const classByKey = new Map(
        classes.map((c) => [`${c.program_id ?? ""}|${c.name.trim().toLowerCase()}`, c.id]),
      );

      const failures: Failure[] = [];
      const seenRolls = new Set<string>();
      let imported = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!;
        // +2: header row occupies line 1 in the spreadsheet.
        const line = i + 2;

        const full_name = field(row, "Full Name");
        const roll_number = field(row, "Roll Number");
        if (!full_name) {
          failures.push({ row: line, reason: "missing Full Name" });
          continue;
        }
        if (!roll_number) {
          failures.push({ row: line, reason: "missing Roll Number" });
          continue;
        }
        if (seenRolls.has(roll_number.toLowerCase())) {
          failures.push({ row: line, reason: `Roll Number '${roll_number}' repeats in this file` });
          continue;
        }

        const programText = field(row, "Program");
        let program_id: string | null = null;
        if (programText) {
          program_id = programByName.get(programText.toLowerCase()) ?? null;
          if (!program_id) {
            failures.push({
              row: line,
              reason: `Program '${programText}' not found — add it first`,
            });
            continue;
          }
        }

        const classText = field(row, "Class");
        let class_id: string | null = null;
        if (classText) {
          const key = classText.toLowerCase();
          class_id =
            classByKey.get(`${program_id ?? ""}|${key}`) ?? classByKey.get(`|${key}`) ?? null;
          if (!class_id) {
            // Distinguish "class does not exist" from "class belongs to another program".
            const elsewhere = classes.find(
              (c) => c.name.trim().toLowerCase() === key && c.program_id !== program_id,
            );
            const owner = elsewhere
              ? (programs.find((p) => p.id === elsewhere.program_id)?.name ?? "another program")
              : null;
            failures.push({
              row: line,
              reason: owner
                ? `Class '${classText}' belongs to ${owner}, not '${programText || "—"}' — fix the Program or Class column`
                : `Class '${classText}' not found for this program — add it first`,
            });
            continue;
          }
        }

        const { error } = await supabase.from("students").insert({
          full_name,
          roll_number,
          father_name: field(row, "Father's Name") || null,
          cnic_bform: field(row, "CNIC/B-Form") || null,
          student_contact: field(row, "Student Contact") || null,
          guardian_contact: field(row, "Guardian Contact") || null,
          address: field(row, "Address") || null,
          program_id,
          class_id,
          session: field(row, "Session") || null,
          section: field(row, "Section") || null,
        });

        if (error) {
          const duplicate = error.code === "23505";
          failures.push({
            row: line,
            reason: duplicate
              ? `Roll Number '${roll_number}' already exists in the register`
              : error.message,
          });
          continue;
        }
        seenRolls.add(roll_number.toLowerCase());
        imported++;
      }

      setResult({ imported, failures, total: rows.length });
      void queryClient.invalidateQueries({ queryKey: ["students"] });
      if (imported) toast.success(`${imported} student${imported === 1 ? "" : "s"} imported`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <Button variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
        <Upload className="mr-1.5 h-4 w-4" /> {busy ? "Importing…" : "Import from Excel"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      <Dialog open={Boolean(result)} onOpenChange={(o) => !o && setResult(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">Import summary</DialogTitle>
            <DialogDescription>
              {result?.total ?? 0} data row{result?.total === 1 ? "" : "s"} were read from the file.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-3">
            <div className="flex flex-1 items-center gap-2 rounded-lg border bg-card p-3">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <div>
                <p className="font-serif text-lg font-semibold">{result?.imported ?? 0}</p>
                <p className="text-xs text-muted-foreground">Imported</p>
              </div>
            </div>
            <div className="flex flex-1 items-center gap-2 rounded-lg border bg-card p-3">
              <XCircle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-serif text-lg font-semibold">{result?.failures.length ?? 0}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
          </div>

          {result && result.failures.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">
                Rows that need attention
              </p>
              <ul className="space-y-1 rounded-lg border bg-muted/30 p-3 text-sm">
                {result.failures.map((f) => (
                  <li key={f.row}>
                    <strong>Row {f.row}:</strong> {f.reason}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Fix these rows in your file and import it again — already-imported students are not
                duplicated.
              </p>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4" /> Every row was imported successfully.
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

export { TEMPLATE_HEADERS };
