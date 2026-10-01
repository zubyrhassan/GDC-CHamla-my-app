import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, FileText, ImageUp, Loader2, ScanLine, X, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { classDetail, classesForProgram, type ClassRow } from "@/lib/classes";
import { usePermissions } from "@/lib/permissions";
import { fileToDataUrl, pdfToDataUrl } from "@/lib/photo-scan";
import { extractFromPhoto } from "@/lib/vision.functions";
import type { AttendanceStatus, Program, Student } from "@/lib/sms-types";

const MAX_FILES = 10;
const MAX_PDF_BYTES = 8 * 1024 * 1024;

type RegisterRow = { roll: string; name: string; marks: string[] };
type Matched = { student: Student; status: AttendanceStatus | "" };

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  leave: "Leave",
};

/** "BA-007", "ba 007" and "7" should all find the same roll number. */
const normRoll = (v: string) =>
  v
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/^0+(?=\d)/, "");

const normName = (v: string) => v.toLowerCase().replace(/[^a-z]/g, "");

function toStatus(mark: string | undefined): AttendanceStatus | "" {
  const m = (mark ?? "").trim().toUpperCase();
  if (m === "P" || m === "PRESENT" || m === "✓" || m === "✔") return "present";
  if (m === "A" || m === "ABSENT" || m === "X" || m === "✗") return "absent";
  if (m === "L" || m === "LEAVE") return "leave";
  return "";
}

function isPdf(file: File) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function ageInDays(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const target = new Date(y!, m! - 1, d!);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today.getTime() - target.getTime()) / 86_400_000);
}

/** Picks the register column that matches the chosen date, else the first one. */
function guessColumn(columns: string[], date: string): number {
  const [y, m, d] = date.split("-");
  const day = Number(d);
  const idx = columns.findIndex((c) => {
    const raw = c.trim();
    if (!raw) return false;
    if (raw === date) return true;
    const parts = raw.split(/[/\-.]/).map((p) => p.trim());
    if (parts.length >= 2) {
      const [a, b] = parts.map(Number);
      return (
        (a === day && b === Number(m)) ||
        (b === day && a === Number(m)) ||
        (a === Number(y) && b === Number(m) && Number(parts[2]) === day)
      );
    }
    return Number(raw) === day;
  });
  return idx === -1 ? 0 : idx;
}

/**
 * Bulk attendance from a scanned register: the teacher chooses the class, drops
 * in a PDF or photos of the register, and the AI reads the roll numbers and
 * marks. Nothing is saved until the teacher reviews the result.
 */
export function BulkAttendanceDialog({
  open,
  onOpenChange,
  students,
  programs,
  classes,
  defaultProgramId,
  defaultClassId,
  defaultDate,
  defaultLecture,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: Student[];
  programs: Program[];
  classes: ClassRow[];
  defaultProgramId: string;
  defaultClassId: string;
  defaultDate: string;
  defaultLecture: number;
}) {
  const queryClient = useQueryClient();
  const perms = usePermissions();
  const extract = useServerFn(extractFromPhoto);
  const inputRef = useRef<HTMLInputElement>(null);

  const [programId, setProgramId] = useState(defaultProgramId);
  const [classId, setClassId] = useState(defaultClassId);
  const [date, setDate] = useState(defaultDate);
  const [lecture, setLecture] = useState(defaultLecture);
  const [files, setFiles] = useState<File[]>([]);

  const [columns, setColumns] = useState<string[] | null>(null);
  const [rows, setRows] = useState<RegisterRow[]>([]);
  const [columnIdx, setColumnIdx] = useState(0);
  const [overrides, setOverrides] = useState<Record<string, AttendanceStatus | "">>({});
  const [restAbsent, setRestAbsent] = useState(false);

  const programClasses = classesForProgram(classes, programId);
  const ready = programId !== "all" && classId !== "all";

  const roster = useMemo(
    () =>
      students
        .filter(
          (s) => s.status === "active" && s.program_id === programId && s.class_id === classId,
        )
        .sort((a, b) =>
          a.roll_number.localeCompare(b.roll_number, undefined, {
            numeric: true,
            sensitivity: "base",
          }),
        ),
    [students, programId, classId],
  );

  const age = ageInDays(date);
  const canMark = perms.can("attendance", "add") || perms.can("attendance", "edit");
  const locked = !canMark || age < 0 || (!perms.isSuperAdmin && age > 3);

  const reset = () => {
    setFiles([]);
    setColumns(null);
    setRows([]);
    setOverrides({});
    setColumnIdx(0);
    setRestAbsent(false);
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!isPdf(f) && !f.type.startsWith("image/")) {
        toast.error(`${f.name} is not a PDF or a picture.`);
        continue;
      }
      if (isPdf(f) && f.size > MAX_PDF_BYTES) {
        toast.error(`${f.name} is larger than 8 MB. Split it or upload pictures instead.`);
        continue;
      }
      if (next.length >= MAX_FILES) {
        toast.error(`At most ${MAX_FILES} files at a time.`);
        break;
      }
      next.push(f);
    }
    setFiles(next);
  };

  const read = useMutation({
    mutationFn: async () => {
      const hint = [
        `The register is for the class "${classLabel()}". The expected date is ${date}.`,
        "Class roster (roll number - name), use it to correct unclear handwriting:",
        ...roster.map((s) => `${s.roll_number} - ${s.full_name}`),
      ]
        .join("\n")
        .slice(0, 11_900);

      let allColumns: string[] | null = null;
      const all: RegisterRow[] = [];
      for (const file of files) {
        const image = isPdf(file) ? await pdfToDataUrl(file) : await fileToDataUrl(file);
        const res = await extract({ data: { image, kind: "attendance", hint } });
        const json = JSON.parse(res.json) as {
          columns?: unknown;
          rows?: { roll_number?: unknown; name?: unknown; marks?: unknown }[];
        };
        const cols = Array.isArray(json.columns) ? json.columns.map((c) => String(c ?? "")) : [""];
        if (!allColumns) allColumns = cols;
        for (const r of Array.isArray(json.rows) ? json.rows : []) {
          const marks = Array.isArray(r.marks) ? r.marks.map((m) => String(m ?? "")) : [];
          // A later page with different headers is realigned by position.
          all.push({
            roll: String(r.roll_number ?? "").trim(),
            name: String(r.name ?? "").trim(),
            marks,
          });
        }
      }
      return { columns: allColumns ?? [""], rows: all };
    },
    onSuccess: ({ columns: cols, rows: parsed }) => {
      if (parsed.length === 0) {
        toast.error(
          "No students could be read. Try a straighter, sharper picture or a clearer PDF.",
        );
        return;
      }
      setColumns(cols);
      setRows(parsed);
      setColumnIdx(guessColumn(cols, date));
      setOverrides({});
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "The register could not be read."),
  });

  function classLabel() {
    const c = classes.find((x) => x.id === classId);
    const p = programs.find((x) => x.id === programId);
    return `${p?.name ?? ""} ${c ? classDetail(c) : ""}`.trim();
  }

  /** Register rows matched to the roster, one per student. */
  const { matched, unmatched, missing } = useMemo(() => {
    const byRoll = new Map(roster.map((s) => [normRoll(s.roll_number), s]));
    const byName = new Map(roster.map((s) => [normName(s.full_name), s]));
    const ok = new Map<string, Matched>();
    const bad: { label: string; reason: string }[] = [];

    for (const r of rows) {
      const student =
        (r.roll ? byRoll.get(normRoll(r.roll)) : undefined) ??
        (r.name ? byName.get(normName(r.name)) : undefined);
      const label = r.roll || r.name || "Unreadable row";
      if (!student) {
        bad.push({ label, reason: "not in this class" });
        continue;
      }
      if (ok.has(student.id)) {
        bad.push({ label, reason: "repeated in the register" });
        continue;
      }
      ok.set(student.id, { student, status: toStatus(r.marks[columnIdx]) });
    }
    const absentFromSheet = roster.filter((s) => !ok.has(s.id));
    return { matched: [...ok.values()], unmatched: bad, missing: absentFromSheet };
  }, [rows, roster, columnIdx]);

  const finalStatus = (m: Matched): AttendanceStatus | "" => overrides[m.student.id] ?? m.status;

  const toSave = useMemo(() => {
    const list: { id: string; status: AttendanceStatus }[] = [];
    for (const m of matched) {
      const s = finalStatus(m);
      if (s) list.push({ id: m.student.id, status: s });
    }
    if (restAbsent) {
      for (const s of missing) list.push({ id: s.id, status: "absent" });
      for (const m of matched)
        if (!finalStatus(m)) list.push({ id: m.student.id, status: "absent" });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched, overrides, restAbsent, missing]);

  const save = useMutation({
    mutationFn: async () => {
      const groups = new Map<AttendanceStatus, string[]>();
      for (const s of toSave) groups.set(s.status, [...(groups.get(s.status) ?? []), s.id]);
      for (const [status, ids] of groups) {
        const { error } = await supabase.rpc("save_attendance", {
          _student_ids: ids,
          _date: date,
          _status: status,
          _lecture_number: lecture,
          _fine_exempt: false,
        });
        if (error) throw error;
      }
      return toSave.length;
    },
    onError: (e: Error) => toast.error(e.message),
    onSuccess: async (count) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["attendance-range"] }),
        queryClient.invalidateQueries({ queryKey: ["attendance-totals"] }),
        queryClient.invalidateQueries({ queryKey: ["absentee_fines"] }),
        queryClient.invalidateQueries({ queryKey: ["fee_dues"] }),
      ]);
      toast.success(
        `Attendance saved for ${date}, Lecture ${lecture} — ${count} student${count === 1 ? "" : "s"} recorded`,
      );
      reset();
      onOpenChange(false);
    },
  });

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, leave: 0 };
    for (const s of toSave) c[s.status]++;
    return c;
  }, [toSave]);

  const reviewing = columns !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif">Bulk attendance from a register</DialogTitle>
          <DialogDescription>
            Choose the class, then upload a PDF or photos of the attendance register. The roll
            numbers and marks are read automatically; you review them before anything is saved.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs tracking-wide text-muted-foreground uppercase">Program</Label>
            <Select
              value={programId}
              disabled={reviewing}
              onValueChange={(v) => {
                setProgramId(v);
                setClassId("all");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a program" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" disabled>
                  Choose a program
                </SelectItem>
                {programs.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs tracking-wide text-muted-foreground uppercase">Class</Label>
            <Select
              value={classId}
              disabled={reviewing || programId === "all"}
              onValueChange={setClassId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" disabled>
                  Choose a class
                </SelectItem>
                {programClasses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {classDetail(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs tracking-wide text-muted-foreground uppercase">Date</Label>
            <Input
              type="date"
              value={date}
              disabled={reviewing}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs tracking-wide text-muted-foreground uppercase">Lecture</Label>
            <Input
              type="number"
              min={1}
              value={lecture}
              disabled={reviewing}
              onChange={(e) => setLecture(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
        </div>

        {!canMark ? (
          <p className="text-sm text-destructive">You do not have permission to mark attendance.</p>
        ) : locked ? (
          <p className="text-sm text-destructive">
            This date is locked. Attendance can be entered for today and the previous three days.
          </p>
        ) : null}

        {!reviewing ? (
          <div className="space-y-3">
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={!ready || locked}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (ready && !locked) addFiles(e.dataTransfer.files);
              }}
              className="flex w-full flex-col items-center gap-2 rounded-md border-2 border-dashed px-4 py-8 text-sm text-muted-foreground transition hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ImageUp className="h-6 w-6" />
              <span>
                {ready
                  ? "Tap to choose a PDF or photos of the register (or drop them here)"
                  : "Choose the program and class first"}
              </span>
              <span className="text-xs">Up to {MAX_FILES} files. PDFs up to 8 MB.</span>
            </button>

            {files.length ? (
              <ul className="space-y-1 text-sm">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-2">
                    {isPdf(f) ? <FileText className="h-4 w-4" /> : <ImageUp className="h-4 w-4" />}
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}

            <p className="text-xs text-muted-foreground">
              {ready
                ? `${roster.length} active student${roster.length === 1 ? "" : "s"} in this class.`
                : null}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {columns && columns.length > 1 ? (
              <div className="space-y-1.5">
                <Label className="text-xs tracking-wide text-muted-foreground uppercase">
                  Register column to import
                </Label>
                <Select value={String(columnIdx)} onValueChange={(v) => setColumnIdx(Number(v))}>
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((c, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {c || `Column ${i + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <p className="text-sm text-muted-foreground">
              Present <strong className="text-foreground">{counts.present}</strong> · Absent{" "}
              <strong className="text-foreground">{counts.absent}</strong> · Leave{" "}
              <strong className="text-foreground">{counts.leave}</strong> · Not in register{" "}
              <strong className="text-foreground">{missing.length}</strong>
            </p>

            <div className="max-h-72 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Roll no.</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-36">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matched.map((m) => (
                    <TableRow key={m.student.id}>
                      <TableCell>{m.student.roll_number}</TableCell>
                      <TableCell>{m.student.full_name}</TableCell>
                      <TableCell>
                        <Select
                          value={finalStatus(m) || "none"}
                          onValueChange={(v) =>
                            setOverrides((o) => ({
                              ...o,
                              [m.student.id]: v === "none" ? "" : (v as AttendanceStatus),
                            }))
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Skip</SelectItem>
                            {(Object.keys(STATUS_LABEL) as AttendanceStatus[]).map((s) => (
                              <SelectItem key={s} value={s}>
                                {STATUS_LABEL[s]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {unmatched.length ? (
              <ul className="space-y-1 text-sm">
                {unmatched.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-muted-foreground">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <span>
                      {r.label} — {r.reason}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            {missing.length ? (
              <div className="space-y-2 rounded-md border p-3 text-sm">
                <p className="text-muted-foreground">
                  Not found in the register:{" "}
                  {missing
                    .slice(0, 12)
                    .map((s) => s.roll_number)
                    .join(", ")}
                  {missing.length > 12 ? ` and ${missing.length - 12} more` : ""}
                </p>
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={restAbsent}
                    onCheckedChange={(v) => setRestAbsent(v === true)}
                  />
                  Mark these and any blank cells as absent
                </label>
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter>
          {reviewing ? (
            <Button variant="outline" onClick={reset}>
              Start over
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
          {reviewing ? (
            <Button
              disabled={locked || save.isPending || toSave.length === 0}
              onClick={() => save.mutate()}
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              {save.isPending
                ? "Saving…"
                : `Save ${toSave.length} mark${toSave.length === 1 ? "" : "s"}`}
            </Button>
          ) : (
            <Button
              disabled={!ready || locked || files.length === 0 || read.isPending}
              onClick={() => read.mutate()}
            >
              {read.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <ScanLine className="mr-1.5 h-4 w-4" />
              )}
              {read.isPending ? "Reading register…" : "Read register"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
