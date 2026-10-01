import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { ScanButton } from "@/components/scan/ScanButton";
import { asNumber, asText } from "@/lib/photo-scan";
import type { RosterEntry } from "@/components/exams/MarksImportDialog";

type Matched = { student: RosterEntry; marks: number };
type Rejected = { roll: string; name: string; reason: string };

/**
 * Reads a photographed award list and, after the examiner reviews the matched
 * rows, saves the marks against this exam.
 */
export function MarksScanButton({
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
  const [open, setOpen] = useState(false);
  const [matched, setMatched] = useState<Matched[]>([]);
  const [rejected, setRejected] = useState<Rejected[]>([]);
  const [saving, setSaving] = useState(false);

  const handleResult = (data: Record<string, unknown>) => {
    const rows = Array.isArray(data["rows"]) ? (data["rows"] as Record<string, unknown>[]) : [];
    const byRoll = new Map(roster.map((s) => [s.roll_number.trim().toLowerCase(), s]));
    const byName = new Map(roster.map((s) => [s.full_name.trim().toLowerCase(), s]));

    const ok: Matched[] = [];
    const bad: Rejected[] = [];
    const seen = new Set<string>();

    for (const row of rows) {
      const roll = asText(row["roll_number"]);
      const name = asText(row["name"]);
      const student = byRoll.get(roll.toLowerCase()) ?? byName.get(name.toLowerCase());
      if (!student) {
        bad.push({ roll, name, reason: "not in this exam's roster" });
        continue;
      }
      if (seen.has(student.id)) {
        bad.push({ roll, name, reason: "repeated in the picture" });
        continue;
      }
      const marks = asNumber(row["marks"]);
      if (marks < 0 || marks > totalMarks) {
        bad.push({ roll, name, reason: `${marks} is outside 0–${totalMarks}` });
        continue;
      }
      seen.add(student.id);
      ok.push({ student, marks });
    }

    if (ok.length === 0 && bad.length === 0) {
      toast.error("No marks could be read from that picture. Try a straighter, sharper photo.");
      return;
    }
    setMatched(ok);
    setRejected(bad);
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("exam_results").upsert(
        matched.map((m) => ({
          exam_id: examId,
          student_id: m.student.id,
          marks_obtained: m.marks,
          recorded_by: userData.user?.id ?? null,
        })),
        { onConflict: "exam_id,student_id" },
      );
      if (error) throw error;
      onImported?.();
      void queryClient.invalidateQueries({ queryKey: ["exam-results", examId] });
      toast.success(`Marks saved for ${matched.length} student${matched.length === 1 ? "" : "s"}`);
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ScanButton
        kind="marks"
        label="Scan award list"
        {...(disabled === undefined ? {} : { disabled })}
        hint={`The exam is out of ${totalMarks} marks.`}
        onResult={handleResult}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">Check the marks read from the photo</DialogTitle>
            <DialogDescription>
              Nothing is saved until you confirm. Correct any wrong figure afterwards on the marks
              sheet.
            </DialogDescription>
          </DialogHeader>

          {matched.length ? (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Roll no.</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Marks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matched.map((m) => (
                    <TableRow key={m.student.id}>
                      <TableCell>{m.student.roll_number}</TableCell>
                      <TableCell>{m.student.full_name}</TableCell>
                      <TableCell className="text-right font-medium">
                        {m.marks} / {totalMarks}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No rows could be matched to the roster.</p>
          )}

          {rejected.length ? (
            <ul className="space-y-1 text-sm">
              {rejected.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-muted-foreground">
                  <XCircle className="mt-0.5 h-4 w-4 text-destructive" />
                  <span>
                    {r.roll || r.name || "Unreadable row"} — {r.reason}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={saving || matched.length === 0} onClick={save}>
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              {saving ? "Saving…" : `Save ${matched.length} mark${matched.length === 1 ? "" : "s"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
