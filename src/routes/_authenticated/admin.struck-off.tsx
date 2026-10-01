import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileDown, UserCheck } from "lucide-react";
import * as XLSX from "xlsx";

import { downloadTablePdf } from "@/lib/print";

import { AppShell } from "@/components/AppShell";
import { AdminNav } from "./admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useStudents, usePrograms } from "@/components/panels/StudentsPanel";
import { ContactLink } from "@/components/ContactLink";
import { Receipt, ReceiptActions, type ReceiptData } from "@/components/fees/Receipt";
import { useFeeTypes } from "@/lib/fees";
import { formatPKR, type Student, type StruckOffEvent } from "@/lib/sms-types";
import { useModuleGuard } from "@/lib/access";

export const Route = createFileRoute("/_authenticated/admin/struck-off")({
  head: () => ({
    meta: [
      { title: "Struck-off Register — GDC Chamla" },
      {
        name: "description",
        content:
          "Register of struck-off students at Government Degree College Chamla with attendance at strike-off, Excel export and readmission against a readmission fee receipt.",
      },
      { property: "og:title", content: "Struck-off Register — GDC Chamla" },
      {
        property: "og:description",
        content: "Struck-off students, Excel export and readmission processing for GDC Chamla.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StruckOffPage,
});

type Row = {
  student: Student;
  event: StruckOffEvent | null;
  program: string;
  attendancePct: number | null;
  daysSince: number | null;
};

function daysBetween(from: string) {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

function StruckOffPage() {
  const perms = useModuleGuard("struck_off");
  const { data: students = [] } = useStudents();
  const { data: programs = [] } = usePrograms();
  const [readmit, setReadmit] = useState<Row | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  const struck = useMemo(
    () => students.filter((s) => s.status === "struck_off"),
    [students],
  );

  const { data: events = [] } = useQuery({
    queryKey: ["struck_off_events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("struck_off_events")
        .select("*")
        .order("struck_off_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as StruckOffEvent[];
    },
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("student_id, date, status");
      if (error) throw error;
      return (data ?? []) as { student_id: string; date: string; status: string }[];
    },
  });

  const rows: Row[] = useMemo(() => {
    return struck.map((student) => {
      const event =
        events.find((e) => e.student_id === student.id && !e.reinstated) ?? null;
      const cutoff = event?.struck_off_date ?? null;
      const marks = attendance.filter(
        (a) => a.student_id === student.id && (!cutoff || a.date <= cutoff),
      );
      const present = marks.filter((a) => a.status === "present").length;
      return {
        student,
        event,
        program: programs.find((p) => p.id === student.program_id)?.name ?? "—",
        attendancePct: marks.length ? Math.round((present / marks.length) * 100) : null,
        daysSince: cutoff ? daysBetween(cutoff) : null,
      };
    });
  }, [struck, events, attendance, programs]);

  const downloadXlsx = () => {
    if (rows.length === 0) {
      toast.error("Nothing to export");
      return;
    }
    const sheet = XLSX.utils.json_to_sheet(
      rows.map((r) => ({
        Name: r.student.full_name,
        "Roll No": r.student.roll_number,
        Program: r.program,
        "Struck-off Date": r.event?.struck_off_date ?? "",
        "Attendance %": r.attendancePct === null ? "" : r.attendancePct,
      })),
    );
    sheet["!cols"] = [{ wch: 26 }, { wch: 14 }, { wch: 24 }, { wch: 16 }, { wch: 13 }];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Struck off");
    XLSX.writeFile(book, `gdc-chamla-struck-off-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const downloadPdf = () => {
    if (rows.length === 0) {
      toast.error("Nothing to export");
      return;
    }
    downloadTablePdf({
      title: "Struck-off Register",
      subtitles: [`${rows.length} student${rows.length === 1 ? "" : "s"} currently struck off`],
      head: ["Name", "Roll No", "Program", "Struck-off date", "Attendance %"],
      rows: rows.map((r) => [
        r.student.full_name,
        r.student.roll_number,
        r.program,
        r.event?.struck_off_date ?? "—",
        r.attendancePct === null ? "—" : `${r.attendancePct}%`,
      ]),
      filename: `gdc-chamla-struck-off-${new Date().toISOString().slice(0, 10)}.pdf`,
    });
  };

  return (
    <AppShell
      title="Struck-off register"
      subtitle="Students removed from the rolls, with readmission against a readmission fee receipt."
    >
      <AdminNav />

      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {rows.length} student{rows.length === 1 ? "" : "s"} currently struck off.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadXlsx}>
            <Download className="mr-1.5 h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" onClick={downloadPdf}>
            <FileDown className="mr-1.5 h-4 w-4" /> Download PDF
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card shadow-panel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead className="hidden sm:table-cell">Roll no.</TableHead>
              <TableHead className="hidden md:table-cell">Program</TableHead>
              <TableHead className="hidden lg:table-cell">Contact</TableHead>
              <TableHead className="text-right">Attendance at strike-off</TableHead>
              <TableHead className="text-right">Days since</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No struck-off students.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.student.id}>
                  <TableCell className="font-medium">{r.student.full_name}</TableCell>
                  <TableCell className="hidden sm:table-cell">{r.student.roll_number}</TableCell>
                  <TableCell className="hidden md:table-cell">{r.program}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <ContactLink
                      value={r.student.student_contact ?? r.student.guardian_contact}
                      label={
                        r.student.student_contact ? "Student contact" : "Guardian contact"
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {r.attendancePct === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <Badge variant={r.attendancePct < 50 ? "destructive" : "secondary"}>
                        {r.attendancePct}%
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{r.daysSince ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {perms.can("struck_off", "edit") ? (
                      <Button size="sm" variant="ghost" onClick={() => setReadmit(r)}>
                        <UserCheck className="mr-1.5 h-4 w-4" /> Readmit
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ReadmitDialog
        row={readmit}
        onOpenChange={(o) => !o && setReadmit(null)}
        onRecorded={(r) => {
          setReadmit(null);
          setReceipt(r);
        }}
      />

      <Dialog open={Boolean(receipt)} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-serif">Readmission receipt</DialogTitle>
          </DialogHeader>
          {receipt ? (
            <div ref={receiptRef}>
              <Receipt data={receipt} />
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceipt(null)}>
              Close
            </Button>
            {receipt ? <ReceiptActions data={receipt} printRef={receiptRef} /> : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function ReadmitDialog({
  row,
  onOpenChange,
  onRecorded,
}: {
  row: Row | null;
  onOpenChange: (open: boolean) => void;
  onRecorded: (receipt: ReceiptData) => void;
}) {
  const queryClient = useQueryClient();
  const { data: feeTypes = [] } = useFeeTypes();
  const { data: programs = [] } = usePrograms();

  const readmissionType = feeTypes.find(
    (f) => f.active && /readmission/i.test(f.name),
  );
  const [feeTypeId, setFeeTypeId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [seeded, setSeeded] = useState<string | null>(null);

  // Pre-fill the flow with the readmission fee head when the dialog opens for a student.
  if (row && seeded !== row.student.id) {
    setSeeded(row.student.id);
    setFeeTypeId(readmissionType?.id ?? "");
    setAmount(readmissionType ? String(readmissionType.default_amount) : "");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setNotes(`Readmission after strike-off dated ${row.event?.struck_off_date ?? "—"}`);
  }

  const submit = useMutation({
    mutationFn: async () => {
      if (!row) throw new Error("No student selected");
      if (!(Number(amount) > 0)) throw new Error("Enter an amount greater than zero");
      const { data: userData } = await supabase.auth.getUser();

      const { data: tx, error } = await supabase
        .from("fee_transactions")
        .insert({
          student_id: row.student.id,
          fee_type_id: feeTypeId || null,
          amount: Number(amount),
          payment_date: paymentDate,
          notes: notes.trim() || null,
          recorded_by: userData.user?.id ?? null,
        })
        .select("*")
        .single();
      if (error) throw error;

      const { error: stuErr } = await supabase
        .from("students")
        .update({ status: "active" })
        .eq("id", row.student.id);
      if (stuErr) throw stuErr;

      const today = new Date().toISOString().slice(0, 10);
      const { error: evErr } = await supabase
        .from("struck_off_events")
        .update({
          reinstated: true,
          reinstated_date: today,
          readmission_fee_transaction_id: tx.id,
        })
        .eq("student_id", row.student.id)
        .eq("reinstated", false);
      if (evErr) throw evErr;

      return {
        receipt_number: tx.receipt_number,
        student_name: row.student.full_name,
        roll_number: row.student.roll_number,
        father_name: row.student.father_name,
        program: programs.find((p) => p.id === row.student.program_id)?.name ?? null,
        fee_type: feeTypes.find((f) => f.id === feeTypeId)?.name ?? "Readmission Fee",
        amount: Number(tx.amount),
        payment_date: tx.payment_date,
        notes: tx.notes,
      } satisfies ReceiptData;
    },
    onSuccess: (receipt) => {
      toast.success(`Student readmitted — receipt ${receipt.receipt_number}`);
      void queryClient.invalidateQueries({ queryKey: ["students"] });
      void queryClient.invalidateQueries({ queryKey: ["struck_off_events"] });
      void queryClient.invalidateQueries({ queryKey: ["fee_transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["fee_total"] });
      onRecorded(receipt);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={Boolean(row)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">
            Readmit {row?.student.full_name ?? ""}
          </DialogTitle>
        </DialogHeader>

        {!readmissionType ? (
          <p className="rounded-md border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
            No active fee head named “Readmission Fee” exists yet. Add it under Dashboard →
            Settings, or pick another head below.
          </p>
        ) : null}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Fee head</Label>
            <Select
              value={feeTypeId}
              onValueChange={(v) => {
                setFeeTypeId(v);
                const ft = feeTypes.find((f) => f.id === v);
                if (ft) setAmount(String(ft.default_amount));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select fee head" />
              </SelectTrigger>
              <SelectContent>
                {feeTypes
                  .filter((f) => f.active)
                  .map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Amount (PKR)</Label>
              <Input
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Payment date</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Remarks</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <p className="text-xs text-muted-foreground">
            Recording {amount ? formatPKR(Number(amount)) : "the payment"} issues a receipt,
            restores the student to active and reinstates the strike-off record — they reappear in
            the daily attendance list from the next attendance date.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={submit.isPending} onClick={() => submit.mutate()}>
            {submit.isPending ? "Processing…" : "Record payment & readmit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
