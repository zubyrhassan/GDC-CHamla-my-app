import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Plus, Printer, Receipt as ReceiptIcon } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { AdminNav } from "./admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useStudents, usePrograms } from "@/components/panels/StudentsPanel";
import { Receipt, ReceiptActions, type ReceiptData } from "@/components/fees/Receipt";
import { AssignFeeDialog } from "@/components/fees/AssignFeeDialog";
import {
  downloadCsv,
  sumBy,
  toCsv,
  useFeeCharges,
  useFeeTransactions,
  useFeeTypes,
} from "@/lib/fees";
import {
  FEE_DUE_STATUS_LABELS,
  feeDueStatusClass,
  useFeeDues,
  type FeeDueStatus,
} from "@/lib/fee-dues";
import { useClasses, classDetail } from "@/lib/classes";
import { ABSENTEE_FEE_TYPE, useAbsenteeFines, useSessionSettings } from "@/lib/absentee-fines";

import { formatPKR, type Student } from "@/lib/sms-types";
import { useModuleGuard } from "@/lib/access";
import { ScanButton } from "@/components/scan/ScanButton";
import { asDate, asNumber, asText } from "@/lib/photo-scan";


export const Route = createFileRoute("/_authenticated/admin/fees")({
  head: () => ({
    meta: [
      { title: "Fee Collection — GDC Chamla" },
      {
        name: "description",
        content:
          "Record fee payments, issue official receipts and track outstanding dues for students of Government Degree College Chamla.",
      },
      { property: "og:title", content: "Fee Collection — GDC Chamla" },
      {
        property: "og:description",
        content: "Fee dues, receipts and transaction log for GDC Chamla accounts office.",
      },
    ],
  }),
  component: FeesPage,
});

function FeesPage() {
  const perms = useModuleGuard("fees");
  const { data: students = [] } = useStudents();
  const { data: programs = [] } = usePrograms();
  const { data: feeTypes = [] } = useFeeTypes();
  const { data: charges = [] } = useFeeCharges();
  const { data: dues = [] } = useFeeDues();
  const { data: transactions = [] } = useFeeTransactions();

  const [payOpen, setPayOpen] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  const receiptRef = useRef<HTMLDivElement>(null);
  const [historyStudent, setHistoryStudent] = useState<Student | null>(null);

  const studentById = useMemo(
    () => new Map(students.map((s) => [s.id, s] as const)),
    [students],
  );
  const feeTypeName = (id: string | null) =>
    feeTypes.find((f) => f.id === id)?.name ?? "General";
  const programName = (id: string | null) => programs.find((p) => p.id === id)?.name ?? null;

  const balances = useMemo(() => {
    const rows = students
      .filter((s) => s.status === "active" || s.status === "struck_off")
      .map((s) => {
        const charged =
          sumBy(
            charges.filter((c) => c.student_id === s.id),
            (c) => c.amount,
          ) +
          sumBy(
            dues.filter((d) => d.student_id === s.id),
            (d) => d.amount,
          );
        const paid = sumBy(
          transactions.filter((t) => t.student_id === s.id),
          (t) => t.amount,
        );
        return { student: s, charged, paid, balance: charged - paid };
      });
    return rows.sort((a, b) => b.balance - a.balance);
  }, [students, charges, dues, transactions]);


  const pending = balances.filter((b) => b.balance > 0);
  const totalOutstanding = sumBy(pending, (b) => b.balance);
  const totalCollected = sumBy(transactions, (t) => t.amount);

  return (
    <AppShell
      title="Fee collection"
      subtitle="Dues, receipts and the accounts office transaction register."
    >
      <AdminNav />

      <div className="no-print grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Outstanding dues" value={formatPKR(totalOutstanding)} />
        <Stat label="Students with dues" value={String(pending.length)} />
        <Stat label="Total collected" value={formatPKR(totalCollected)} />
        <Stat label="Receipts issued" value={String(transactions.length)} />
      </div>

      {perms.can("fees", "add") ? (
        <div className="no-print mt-4 flex flex-wrap gap-2">
          <Button onClick={() => setPayOpen(true)} disabled={students.length === 0}>
            <ReceiptIcon className="mr-1.5 h-4 w-4" /> Record payment
          </Button>
          <Button
            variant="outline"
            onClick={() => setAssignOpen(true)}
            disabled={students.length === 0}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Assign fee
          </Button>
          <Button
            variant="outline"
            onClick={() => setChargeOpen(true)}
            disabled={students.length === 0}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add fee charge
          </Button>

        </div>
      ) : null}

      {feeTypes.length === 0 ? (
        <p className="no-print mt-4 rounded-md border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
          Add fee heads (Tuition, Admission, Exam, Fine, Readmission…) under Dashboard → Settings
          before recording payments.
        </p>
      ) : null}

      <Tabs defaultValue="dues" className="no-print mt-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="dues">Pending balances</TabsTrigger>
          <TabsTrigger value="assigned">Assigned fees</TabsTrigger>
          <TabsTrigger value="log">Transaction log</TabsTrigger>
        </TabsList>


        <TabsContent value="dues" className="mt-4">
          <div className="overflow-x-auto rounded-lg border bg-card shadow-panel">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead className="hidden sm:table-cell">Roll no.</TableHead>
                  <TableHead className="text-right">Charged</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      No pending balances.
                    </TableCell>
                  </TableRow>
                ) : (
                  pending.map((row) => (
                    <TableRow
                      key={row.student.id}
                      className="cursor-pointer"
                      onClick={() => setHistoryStudent(row.student)}
                    >
                      <TableCell className="font-medium">{row.student.full_name}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {row.student.roll_number}
                      </TableCell>
                      <TableCell className="text-right">{formatPKR(row.charged)}</TableCell>
                      <TableCell className="text-right">{formatPKR(row.paid)}</TableCell>
                      <TableCell className="text-right font-semibold text-destructive">
                        {formatPKR(row.balance)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="assigned" className="mt-4">
          <AssignedFeesTable
            studentById={studentById}
            feeTypeName={feeTypeName}
            onOpenStudent={setHistoryStudent}
          />
        </TabsContent>

        <TabsContent value="log" className="mt-4">
          <TransactionLog
            onOpenReceipt={setReceipt}
            studentById={studentById}
            feeTypeName={feeTypeName}
            programName={programName}
          />
        </TabsContent>
      </Tabs>

      <RecordPaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        onRecorded={setReceipt}
        programName={programName}
      />
      <AddChargeDialog open={chargeOpen} onOpenChange={setChargeOpen} />
      <AssignFeeDialog open={assignOpen} onOpenChange={setAssignOpen} />


      <Dialog
        open={Boolean(historyStudent)}
        onOpenChange={(o) => !o && setHistoryStudent(null)}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif">
              {historyStudent?.full_name} — fee history
            </DialogTitle>
          </DialogHeader>
          {historyStudent ? (
            <StudentHistory studentId={historyStudent.id} feeTypeName={feeTypeName} />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(receipt)} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-serif">Fee receipt</DialogTitle>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-panel">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 font-serif text-2xl font-semibold">{value}</p>
    </div>
  );
}

function RecordPaymentDialog({
  open,
  onOpenChange,
  onRecorded,
  programName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecorded: (receipt: ReceiptData) => void;
  programName: (id: string | null) => string | null;
}) {
  const queryClient = useQueryClient();
  const { data: students = [] } = useStudents();
  const { data: feeTypes = [] } = useFeeTypes();
  const { data: dues = [] } = useFeeDues();
  const [studentId, setStudentId] = useState("");
  const [feeTypeId, setFeeTypeId] = useState("");
  const [dueId, setDueId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const openDues = useMemo(
    () => dues.filter((d) => d.student_id === studentId && d.status !== "paid"),
    [dues, studentId],
  );

  /** Falls back to the student's matching open due for this fee head. */
  const resolvedDueId =
    dueId || openDues.find((d) => d.fee_type_id && d.fee_type_id === feeTypeId)?.id || null;

  const record = useMutation({
    mutationFn: async () => {
      const student = students.find((s) => s.id === studentId);
      if (!student) throw new Error("Select a student");
      if (!(Number(amount) > 0)) throw new Error("Enter an amount greater than zero");
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("fee_transactions")
        .insert({
          student_id: studentId,
          fee_type_id: feeTypeId || null,
          fee_due_id: resolvedDueId,
          amount: Number(amount),
          payment_date: paymentDate,
          notes: notes.trim() || null,
          recorded_by: userData.user?.id ?? null,
        })
        .select("*")
        .single();
      if (error) throw error;

      const receipt: ReceiptData = {
        receipt_number: data.receipt_number,
        student_name: student.full_name,
        roll_number: student.roll_number,
        father_name: student.father_name,
        program: programName(student.program_id),
        fee_type: feeTypes.find((f) => f.id === feeTypeId)?.name ?? "General",
        amount: Number(data.amount),
        payment_date: data.payment_date,
        notes: data.notes,
      };
      return receipt;
    },
    onSuccess: (receipt) => {
      toast.success(`Receipt ${receipt.receipt_number} issued`);
      onOpenChange(false);
      setStudentId("");
      setFeeTypeId("");
      setDueId("");
      setAmount("");
      setNotes("");
      void queryClient.invalidateQueries({ queryKey: ["fee_transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["fee_dues"] });
      void queryClient.invalidateQueries({ queryKey: ["fee_total"] });

      onRecorded(receipt);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** Fills the payment form from a photographed challan or deposit slip. */
  function applyScannedSlip(data: Record<string, unknown>) {
    const f = (data["fields"] ?? data) as Record<string, unknown>;
    const filled: string[] = [];

    const roll = asText(f["roll_number"]).toLowerCase();
    const name = asText(f["student_name"]).toLowerCase();
    const student =
      students.find((s) => s.roll_number.trim().toLowerCase() === roll) ??
      students.find((s) => s.full_name.trim().toLowerCase() === name);
    if (student) {
      setStudentId(student.id);
      filled.push("student");
    }

    const head = asText(f["fee_type"]).toLowerCase();
    if (head) {
      const ft = feeTypes.find(
        (t) => t.name.toLowerCase() === head || t.name.toLowerCase().includes(head),
      );
      if (ft) {
        setFeeTypeId(ft.id);
        filled.push("fee head");
      }
    }

    const amt = asNumber(f["amount"]);
    if (amt > 0) {
      setAmount(String(amt));
      filled.push("amount");
    }
    const date = asDate(f["payment_date"]);
    if (date) {
      setPaymentDate(date);
      filled.push("payment date");
    }
    const remark = asText(f["notes"]);
    if (remark) {
      setNotes(remark);
      filled.push("remarks");
    }

    if (filled.length === 0) {
      toast.error("Nothing could be read from that slip. Try a clearer, well-lit photo.");
      return;
    }
    toast.success(`Read from the slip: ${filled.join(", ")}. Please check before issuing.`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">Record fee payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed bg-muted/40 px-3 py-2.5">
            <p className="text-xs text-muted-foreground">
              Auto-detect from a picture of the challan, bank slip or handwritten receipt.
            </p>
            <ScanButton kind="fee" label="Scan slip" size="sm" onResult={applyScannedSlip} />
          </div>
          <div className="space-y-1.5">
            <Label>Student</Label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select student" />
              </SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.roll_number} — {s.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Fee head</Label>
            <Select
              value={feeTypeId}
              onValueChange={(v) => {
                setFeeTypeId(v);
                const ft = feeTypes.find((f) => f.id === v);
                if (ft && !amount) setAmount(String(ft.default_amount));
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
          {openDues.length > 0 ? (
            <div className="space-y-1.5">
              <Label>Against assigned fee</Label>
              <Select
                value={dueId}
                onValueChange={(v) => {
                  setDueId(v);
                  const due = openDues.find((d) => d.id === v);
                  if (due) {
                    if (due.fee_type_id) setFeeTypeId(due.fee_type_id);
                    setAmount(String(due.amount));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Match automatically by fee head" />
                </SelectTrigger>
                <SelectContent>
                  {openDues.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {feeTypes.find((f) => f.id === d.fee_type_id)?.name ?? "General"} ·{" "}
                      {d.session_label} · {formatPKR(Number(d.amount))} ·{" "}
                      {FEE_DUE_STATUS_LABELS[d.status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={record.isPending || !studentId} onClick={() => record.mutate()}>
            Record & issue receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddChargeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { data: students = [] } = useStudents();
  const { data: feeTypes = [] } = useFeeTypes();
  const [scope, setScope] = useState<"student" | "all_active">("student");
  const [studentId, setStudentId] = useState("");
  const [feeTypeId, setFeeTypeId] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      if (!(Number(amount) > 0)) throw new Error("Enter an amount greater than zero");
      const targets =
        scope === "all_active"
          ? students.filter((s) => s.status === "active").map((s) => s.id)
          : [studentId];
      if (targets.length === 0 || !targets[0]) throw new Error("Select a student");
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("fee_charges").insert(
        targets.map((id) => ({
          student_id: id,
          fee_type_id: feeTypeId || null,
          amount: Number(amount),
          due_date: dueDate,
          notes: notes.trim() || null,
          created_by: userData.user?.id ?? null,
        })),
      );
      if (error) throw error;
      return targets.length;
    },
    onSuccess: (count) => {
      toast.success(`Charge applied to ${count} student${count === 1 ? "" : "s"}`);
      onOpenChange(false);
      setAmount("");
      setNotes("");
      void queryClient.invalidateQueries({ queryKey: ["fee_charges"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">Add fee charge</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Apply to</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="student">One student</SelectItem>
                <SelectItem value="all_active">All active students</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {scope === "student" ? (
            <div className="space-y-1.5">
              <Label>Student</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.roll_number} — {s.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label>Fee head</Label>
            <Select
              value={feeTypeId}
              onValueChange={(v) => {
                setFeeTypeId(v);
                const ft = feeTypes.find((f) => f.id === v);
                if (ft && !amount) setAmount(String(ft.default_amount));
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
              <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Remarks</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={add.isPending} onClick={() => add.mutate()}>
            Add charge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TransactionLog({
  onOpenReceipt,
  studentById,
  feeTypeName,
  programName,
}: {
  onOpenReceipt: (receipt: ReceiptData) => void;
  studentById: Map<string, Student>;
  feeTypeName: (id: string | null) => string;
  programName: (id: string | null) => string | null;
}) {
  const { data: transactions = [], isLoading } = useFeeTransactions();
  const { data: feeTypes = [] } = useFeeTypes();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [feeTypeId, setFeeTypeId] = useState("all");

  const rows = transactions.filter((t) => {
    if (from && t.payment_date < from) return false;
    if (to && t.payment_date > to) return false;
    if (feeTypeId !== "all" && t.fee_type_id !== feeTypeId) return false;
    return true;
  });

  const total = sumBy(rows, (t) => t.amount);

  function exportCsv() {
    const csv = toCsv([
      ["Receipt", "Date", "Roll no.", "Student", "Fee head", "Amount (PKR)", "Remarks"],
      ...rows.map((t) => {
        const s = studentById.get(t.student_id);
        return [
          t.receipt_number,
          t.payment_date,
          s?.roll_number ?? "",
          s?.full_name ?? "",
          feeTypeName(t.fee_type_id),
          Number(t.amount),
          t.notes ?? "",
        ];
      }),
    ]);
    downloadCsv(`gdc-chamla-fees-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4 shadow-panel">
        <div className="space-y-1.5">
          <Label>From</Label>
          <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>To</Label>
          <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Fee head</Label>
          <Select value={feeTypeId} onValueChange={setFeeTypeId}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All fee heads</SelectItem>
              {feeTypes.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" className="ml-auto" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="mr-1.5 h-4 w-4" /> Export CSV
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        {rows.length} receipt{rows.length === 1 ? "" : "s"} · total{" "}
        <strong className="text-foreground">{formatPKR(total)}</strong>
      </p>

      <div className="overflow-x-auto rounded-lg border bg-card shadow-panel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Receipt #</TableHead>
              <TableHead>Student</TableHead>
              <TableHead className="hidden sm:table-cell">Fee head</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="hidden md:table-cell">Date</TableHead>
              <TableHead className="text-right">Receipt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No payments match these filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((t) => {
                const s = studentById.get(t.student_id);
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.receipt_number}</TableCell>
                    <TableCell>
                      {s ? `${s.roll_number} — ${s.full_name}` : "—"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {feeTypeName(t.fee_type_id)}
                    </TableCell>
                    <TableCell className="text-right">{formatPKR(Number(t.amount))}</TableCell>
                    <TableCell className="hidden md:table-cell">{t.payment_date}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          onOpenReceipt({
                            receipt_number: t.receipt_number,
                            student_name: s?.full_name ?? "—",
                            roll_number: s?.roll_number ?? "—",
                            father_name: s?.father_name ?? null,
                            program: programName(s?.program_id ?? null),
                            fee_type: feeTypeName(t.fee_type_id),
                            amount: Number(t.amount),
                            payment_date: t.payment_date,
                            notes: t.notes,
                          })
                        }
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function StudentHistory({
  studentId,
  feeTypeName,
}: {
  studentId: string;
  feeTypeName: (id: string | null) => string;
}) {
  const { data: transactions = [] } = useFeeTransactions();
  const { data: charges = [] } = useFeeCharges();
  const { data: allDues = [] } = useFeeDues();
  const { data: sessionSettings } = useSessionSettings();
  const { data: fines = [] } = useAbsenteeFines(sessionSettings?.sessionLabel);

  const paid = transactions.filter((t) => t.student_id === studentId);
  const due = charges.filter((c) => c.student_id === studentId);
  const dues = allDues.filter((d) => d.student_id === studentId);
  const charged = sumBy(due, (c) => c.amount) + sumBy(dues, (d) => d.amount);
  const balance = charged - sumBy(paid, (t) => t.amount);

  const studentFines = fines.filter((f) => f.student_id === studentId);
  const fineAccrued = sumBy(studentFines, (f) => Number(f.amount));
  const fineDue = dues.find(
    (d) =>
      feeTypeName(d.fee_type_id).toLowerCase() === ABSENTEE_FEE_TYPE.toLowerCase() &&
      d.session_label === sessionSettings?.sessionLabel,
  );
  const finePaid = fineDue
    ? sumBy(
        paid.filter((t) => t.fee_due_id === fineDue.id),
        (t) => Number(t.amount),
      )
    : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Charged" value={formatPKR(charged)} />
        <Stat label="Paid" value={formatPKR(sumBy(paid, (t) => t.amount))} />
        <Stat label="Balance" value={formatPKR(balance)} />
      </div>

      <section>
        <h3 className="mb-2 font-serif text-sm font-semibold">
          Absentee fines — {sessionSettings?.sessionLabel ?? "current session"}
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Absences" value={String(studentFines.length)} />
          <Stat label="Fine accrued" value={formatPKR(fineAccrued)} />
          <Stat label="Fine paid" value={formatPKR(finePaid)} />
          <Stat label="Fine outstanding" value={formatPKR(Math.max(fineAccrued - finePaid, 0))} />
        </div>
      </section>


      <section>
        <h3 className="mb-2 font-serif text-sm font-semibold">Assigned fees</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Session</TableHead>
              <TableHead>Fee head</TableHead>
              <TableHead>Due date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dues.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                  No fees assigned.
                </TableCell>
              </TableRow>
            ) : (
              dues.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{d.session_label}</TableCell>
                  <TableCell>{feeTypeName(d.fee_type_id)}</TableCell>
                  <TableCell>{d.due_date}</TableCell>
                  <TableCell className="text-right">{formatPKR(Number(d.amount))}</TableCell>
                  <TableCell className={`text-right font-medium ${feeDueStatusClass(d.status)}`}>
                    {FEE_DUE_STATUS_LABELS[d.status]}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>


      <section>
        <h3 className="mb-2 font-serif text-sm font-semibold">Charges</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Due date</TableHead>
              <TableHead>Fee head</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {due.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                  No charges recorded.
                </TableCell>
              </TableRow>
            ) : (
              due.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.due_date}</TableCell>
                  <TableCell>{feeTypeName(c.fee_type_id)}</TableCell>
                  <TableCell className="text-right">{formatPKR(Number(c.amount))}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>

      <section>
        <h3 className="mb-2 font-serif text-sm font-semibold">Payments</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Receipt #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Fee head</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paid.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                  No payments yet.
                </TableCell>
              </TableRow>
            ) : (
              paid.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.receipt_number}</TableCell>
                  <TableCell>{t.payment_date}</TableCell>
                  <TableCell>{feeTypeName(t.fee_type_id)}</TableCell>
                  <TableCell className="text-right">{formatPKR(Number(t.amount))}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}

/** College-wide list of assigned fee dues with filters. */
function AssignedFeesTable({
  studentById,
  feeTypeName,
  onOpenStudent,
}: {
  studentById: Map<string, Student>;
  feeTypeName: (id: string | null) => string;
  onOpenStudent: (student: Student) => void;
}) {
  const { data: dues = [] } = useFeeDues();
  const { data: programs = [] } = usePrograms();
  const { data: classes = [] } = useClasses();
  const { data: feeTypes = [] } = useFeeTypes();

  const [feeTypeId, setFeeTypeId] = useState("all");
  const [programId, setProgramId] = useState("all");
  const [classId, setClassId] = useState("all");
  const [status, setStatus] = useState<FeeDueStatus | "all">("all");

  const rows = useMemo(
    () =>
      dues
        .map((d) => ({ due: d, student: studentById.get(d.student_id) ?? null }))
        .filter(({ due, student }) => {
          if (feeTypeId !== "all" && due.fee_type_id !== feeTypeId) return false;
          if (status !== "all" && due.status !== status) return false;
          if (programId !== "all" && student?.program_id !== programId) return false;
          if (classId !== "all" && student?.class_id !== classId) return false;
          return true;
        }),
    [dues, studentById, feeTypeId, status, programId, classId],
  );

  const totalAssigned = sumBy(rows, (r) => Number(r.due.amount));
  const outstanding = sumBy(
    rows.filter((r) => r.due.status !== "paid"),
    (r) => Number(r.due.amount),
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select value={feeTypeId} onValueChange={setFeeTypeId}>
          <SelectTrigger>
            <SelectValue placeholder="Fee head" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All fee heads</SelectItem>
            {feeTypes.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
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
        <Select value={status} onValueChange={(v) => setStatus(v as FeeDueStatus | "all")}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Assigned fees" value={String(rows.length)} />
        <Stat label="Total assigned" value={formatPKR(totalAssigned)} />
        <Stat label="Not fully paid" value={formatPKR(outstanding)} />
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card shadow-panel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead className="hidden sm:table-cell">Roll no.</TableHead>
              <TableHead>Fee head</TableHead>
              <TableHead className="hidden md:table-cell">Session</TableHead>
              <TableHead className="hidden md:table-cell">Due date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No assigned fees match these filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map(({ due, student }) => (
                <TableRow
                  key={due.id}
                  className={student ? "cursor-pointer" : undefined}
                  onClick={() => student && onOpenStudent(student)}
                >
                  <TableCell className="font-medium">{student?.full_name ?? "—"}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {student?.roll_number ?? "—"}
                  </TableCell>
                  <TableCell>{feeTypeName(due.fee_type_id)}</TableCell>
                  <TableCell className="hidden md:table-cell">{due.session_label}</TableCell>
                  <TableCell className="hidden md:table-cell">{due.due_date}</TableCell>
                  <TableCell className="text-right">{formatPKR(Number(due.amount))}</TableCell>
                  <TableCell className={`text-right font-medium ${feeDueStatusClass(due.status)}`}>
                    {FEE_DUE_STATUS_LABELS[due.status]}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
