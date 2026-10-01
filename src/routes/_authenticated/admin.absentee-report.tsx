import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BadgeMinus, Download, FileSpreadsheet, Printer } from "lucide-react";
import * as XLSX from "xlsx";

import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/routes/_authenticated/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useWaiveFines } from "@/lib/fine-waivers";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePrograms, useStudents } from "@/components/panels/StudentsPanel";
import { useClasses, classDetail } from "@/lib/classes";
import { fineTotalsByStudent, useAbsenteeFines, useSessionSettings } from "@/lib/absentee-fines";
import { useFeeDues } from "@/lib/fee-dues";
import { useFeeTransactions, useFeeTypes, sumBy } from "@/lib/fees";
import { formatPKR } from "@/lib/sms-types";
import { useModuleGuard } from "@/lib/access";
import { COLLEGE_NAME, COLLEGE_SUBTITLE, PrintFrame, downloadTablePdf, usePrintable } from "@/lib/print";

export const Route = createFileRoute("/_authenticated/admin/absentee-report")({
  component: AbsenteeReportPage,
  head: () => ({
    meta: [
      { title: "Session Absentee Fine Report | GDC Chamla" },
      {
        name: "description",
        content:
          "Session-to-date absence counts and absentee fine totals for every student at Government Degree College Chamla.",
      },
      { property: "og:title", content: "Session Absentee Fine Report | GDC Chamla" },
      {
        property: "og:description",
        content: "Absence counts and fine totals per student for the full academic session.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AbsenteeReportPage() {
  useModuleGuard("attendance");
  const { data: students = [] } = useStudents();
  const { data: programs = [] } = usePrograms();
  const { data: classes = [] } = useClasses();
  const { data: settings } = useSessionSettings();
  const [sessionPick, setSessionPick] = useState<string | null>(null);
  const sessionLabel = sessionPick ?? settings?.sessionLabel ?? "Current session";
  const { data: fines = [] } = useAbsenteeFines(sessionLabel);
  const { data: allFines = [] } = useAbsenteeFines(null);
  const { data: dues = [] } = useFeeDues();
  const { data: transactions = [] } = useFeeTransactions();
  const { data: feeTypes = [] } = useFeeTypes();

  const [programId, setProgramId] = useState("all");
  const [classId, setClassId] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [waiveOpen, setWaiveOpen] = useState(false);
  const [waiveMode, setWaiveMode] = useState<"full" | "partial" | "restore">("full");
  const [waiveAmount, setWaiveAmount] = useState("");
  const [waiveReason, setWaiveReason] = useState("");
  const waive = useWaiveFines();

  const sessionOptions = useMemo(() => {
    const set = new Set(allFines.map((f) => f.session_label));
    if (settings?.sessionLabel) set.add(settings.sessionLabel);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [allFines, settings?.sessionLabel]);

  const absenteeTypeId = feeTypes.find((f) => f.name.toLowerCase() === "absentee fine")?.id ?? null;


  const totals = useMemo(() => fineTotalsByStudent(fines), [fines]);

  const paidByStudent = useMemo(() => {
    const dueIds = new Map(
      dues
        .filter((d) => d.fee_type_id === absenteeTypeId && d.session_label === sessionLabel)
        .map((d) => [d.id, d.student_id] as const),
    );
    const map = new Map<string, number>();
    for (const t of transactions) {
      const studentId = t.fee_due_id ? dueIds.get(t.fee_due_id) : undefined;
      if (!studentId) continue;
      map.set(studentId, (map.get(studentId) ?? 0) + Number(t.amount || 0));
    }
    return map;
  }, [dues, transactions, absenteeTypeId, sessionLabel]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students
      .filter((s) => (programId === "all" ? true : s.program_id === programId))
      .filter((s) => (classId === "all" ? true : s.class_id === classId))
      .filter((s) =>
        q
          ? s.full_name.toLowerCase().includes(q) || s.roll_number.toLowerCase().includes(q)
          : true,
      )
      .map((s) => {
        const t = totals.get(s.id) ?? { absences: 0, accrued: 0, waived: 0 };
        const paid = paidByStudent.get(s.id) ?? 0;
        return {
          student: s,
          absences: t.absences,
          accrued: t.accrued,
          waived: t.waived,
          paid,
          outstanding: Math.max(t.accrued - paid, 0),
        };
      })
      .filter((r) => r.absences > 0)
      .sort((a, b) => b.absences - a.absences || a.student.roll_number.localeCompare(b.student.roll_number));
  }, [students, programId, classId, search, totals, paidByStudent]);

  const selectedRows = rows.filter((r) => selected.includes(r.student.id));
  const allSelected = rows.length > 0 && selectedRows.length === rows.length;
  const toggleAll = () => setSelected(allSelected ? [] : rows.map((r) => r.student.id));
  const toggleOne = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const submitWaiver = () => {
    if (selected.length === 0) {
      toast.error("Select at least one student.");
      return;
    }
    let amount: number | null = null;
    if (waiveMode === "restore") amount = 0;
    else if (waiveMode === "partial") {
      const n = Number(waiveAmount);
      if (!Number.isFinite(n) || n <= 0) {
        toast.error("Enter the amount to waive, in rupees.");
        return;
      }
      amount = n;
    }
    waive.mutate(
      { studentIds: selected, session: sessionLabel, amount, reason: waiveReason.trim() || null },
      {
        onSuccess: () => {
          toast.success(
            waiveMode === "restore"
              ? "Fines restored"
              : `Fines waived for ${selected.length} student(s)`,
          );
          setWaiveOpen(false);
          setSelected([]);
          setWaiveAmount("");
          setWaiveReason("");
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Could not waive the fines"),
      },
    );
  };

  const className = (id: string | null) => classDetail(classes.find((c) => c.id === id));
  const programName = (id: string | null) => programs.find((p) => p.id === id)?.name ?? "—";

  const scope = [
    programId === "all" ? "All programs" : programName(programId),
    classId === "all" ? "All classes" : className(classId),
  ].join(" · ");

  const head = ["Roll no.", "Student", "Program", "Class", "Absences", "Fine accrued", "Paid", "Outstanding"];
  const tableRows = rows.map((r) => [
    r.student.roll_number,
    r.student.full_name,
    programName(r.student.program_id),
    className(r.student.class_id) || "—",
    r.absences,
    r.accrued,
    r.paid,
    r.outstanding,
  ]);

  const { ref: printRef, print } = usePrintable(`Absentee fines ${sessionLabel}`, true);

  function downloadExcel() {
    const sheet = XLSX.utils.aoa_to_sheet([head, ...tableRows]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Absentee fines");
    XLSX.writeFile(book, `absentee-fines-${sessionLabel.replace(/\s+/g, "-").toLowerCase()}.xlsx`);
  }

  return (
    <AppShell
      title="Session absentee fines"
      subtitle="Session-to-date absences and fines for every student. Totals never reset when a new attendance day is marked."
    >
      <AdminNav />

      <div className="no-print grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Session" value={sessionLabel} />
        <Stat label="Students fined" value={String(rows.length)} />
        <Stat label="Total absences" value={String(sumBy(rows, (r) => r.absences))} />
        <Stat label="Fines outstanding" value={formatPKR(sumBy(rows, (r) => r.outstanding))} />
      </div>

      <div className="no-print mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Select value={sessionLabel} onValueChange={setSessionPick}>
          <SelectTrigger>
            <SelectValue placeholder="Session" />
          </SelectTrigger>
          <SelectContent>
            {sessionOptions.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
                {s === settings?.sessionLabel ? " (current)" : " (archived)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={programId}
          onValueChange={(v) => {
            setProgramId(v);
            setClassId("all");
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Program" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All programs</SelectItem>
            {programs.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={classId} onValueChange={setClassId}>
          <SelectTrigger>
            <SelectValue placeholder="Class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All classes</SelectItem>
            {classes
              .filter((c) => programId === "all" || c.program_id === programId || c.program_id == null)
              .map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {classDetail(c)}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or roll number"
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={print} disabled={rows.length === 0}>
            <Printer className="mr-1.5 h-4 w-4" /> Print
          </Button>
          <Button
            variant="outline"
            disabled={rows.length === 0}
            onClick={() =>
              downloadTablePdf({
                title: `Absentee fine report — ${sessionLabel}`,
                subtitles: [scope, settings?.sessionStart ? `Session from ${settings.sessionStart}` : null],
                head,
                rows: tableRows,
                filename: `absentee-fines-${sessionLabel.replace(/\s+/g, "-").toLowerCase()}`,
                landscape: true,
              })
            }
          >
            <Download className="mr-1.5 h-4 w-4" /> PDF
          </Button>
          <Button variant="outline" onClick={downloadExcel} disabled={rows.length === 0}>
            <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Excel
          </Button>
          <Button disabled={selected.length === 0} onClick={() => setWaiveOpen(true)}>
            <BadgeMinus className="mr-1.5 h-4 w-4" /> Waive fines ({selected.length})
          </Button>
        </div>
      </div>

      <div className="no-print mt-4 overflow-x-auto rounded-lg border bg-card shadow-panel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all students"
                />
              </TableHead>
              <TableHead>Roll no.</TableHead>
              <TableHead>Student</TableHead>
              <TableHead className="hidden md:table-cell">Class</TableHead>
              <TableHead className="text-right">Absences</TableHead>
              <TableHead className="text-right">Accrued</TableHead>
              <TableHead className="text-right">Waived</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                  No absences recorded for this session yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.student.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.includes(r.student.id)}
                      onCheckedChange={() => toggleOne(r.student.id)}
                      aria-label={`Select ${r.student.full_name}`}
                    />
                  </TableCell>
                  <TableCell>{r.student.roll_number}</TableCell>
                  <TableCell className="font-medium">{r.student.full_name}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {className(r.student.class_id) || "—"}
                  </TableCell>
                  <TableCell className="text-right">{r.absences}</TableCell>
                  <TableCell className="text-right">{formatPKR(r.accrued)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {r.waived > 0 ? formatPKR(r.waived) : "—"}
                  </TableCell>
                  <TableCell className="text-right">{formatPKR(r.paid)}</TableCell>
                  <TableCell className="text-right font-semibold text-destructive">
                    {formatPKR(r.outstanding)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={waiveOpen} onOpenChange={setWaiveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Waive absentee fines</DialogTitle>
            <DialogDescription>
              {selected.length} student(s) in {sessionLabel}. Absences stay on record — only the
              money owed changes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Waiver</Label>
              <Select value={waiveMode} onValueChange={(v) => setWaiveMode(v as typeof waiveMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Waive the full outstanding fine</SelectItem>
                  <SelectItem value="partial">Waive part of the fine</SelectItem>
                  <SelectItem value="restore">Restore previously waived fines</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {waiveMode === "partial" ? (
              <div className="space-y-1.5">
                <Label>Amount to waive per student (PKR)</Label>
                <Input
                  type="number"
                  min={1}
                  value={waiveAmount}
                  onChange={(e) => setWaiveAmount(e.target.value)}
                  placeholder="e.g. 100"
                />
                <p className="text-xs text-muted-foreground">
                  Applied to the oldest unwaived absences first.
                </p>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Textarea
                value={waiveReason}
                onChange={(e) => setWaiveReason(e.target.value)}
                placeholder="e.g. Medical leave certified by the principal"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setWaiveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitWaiver} disabled={waive.isPending}>
              {waive.isPending ? "Saving…" : waiveMode === "restore" ? "Restore fines" : "Waive fines"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PrintFrame innerRef={printRef} width={1040}>
        <div className="print-header">
          <h2>{COLLEGE_NAME}</h2>
          <p>{COLLEGE_SUBTITLE}</p>
          <p>
            <strong>Absentee fine report — {sessionLabel}</strong>
          </p>
          <p>{scope}</p>
        </div>
        <table>
          <thead>
            <tr>
              {head.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((r, i) => (
              <tr key={i}>
                {r.map((cell, j) => (
                  <td key={j}>{typeof cell === "number" && j >= 5 ? formatPKR(cell) : cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </PrintFrame>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-panel">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-serif text-xl font-semibold">{value}</p>
    </div>
  );
}
