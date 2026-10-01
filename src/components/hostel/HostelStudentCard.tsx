import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LogOut, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ContactLink } from "@/components/ContactLink";
import { Receipt, ReceiptActions, type ReceiptData } from "@/components/fees/Receipt";
import { StudentPhoto } from "@/lib/student-photo";
import { supabase } from "@/integrations/supabase/client";
import { formatPKR, type Student } from "@/lib/sms-types";
import {
  addMonths,
  hostelFeeStatus,
  monthLabel,
  monthStart,
  currentMonthStart,
  roomLabel,
  useHostelFees,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  type HostelAllotment,
  type HostelRoom,
} from "@/lib/hostel";

const today = () => new Date().toISOString().slice(0, 10);

/** Everything about one boarder's hostel stay: bed, dues, contacts, payments. */
export function HostelStudentCard({
  open,
  onOpenChange,
  allotment,
  student,
  room,
  monthlyFee,
  canAdd,
  canEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allotment: HostelAllotment;
  student: Student | undefined;
  room: HostelRoom | undefined;
  monthlyFee: number;
  canAdd: boolean;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: payments = [] } = useHostelFees();
  const printRef = useRef<HTMLDivElement>(null);

  const mine = useMemo(
    () => payments.filter((p) => p.allotment_id === allotment.id),
    [payments, allotment.id],
  );
  const status = hostelFeeStatus(allotment, payments, monthlyFee);

  const [payOpen, setPayOpen] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [amount, setAmount] = useState(String(monthlyFee));
  const [period, setPeriod] = useState(status.dueFrom ?? currentMonthStart());
  const [paymentDate, setPaymentDate] = useState(today());
  const [method, setMethod] = useState<string>("cash");
  const [notes, setNotes] = useState("");

  const periodOptions = useMemo(() => {
    const start = monthStart(allotment.admission_date);
    const total = Math.max(status.monthsCharged, 1);
    return Array.from({ length: total + 2 }, (_, i) => addMonths(start, i));
  }, [allotment.admission_date, status.monthsCharged]);

  const record = useMutation({
    mutationFn: async () => {
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) throw new Error("Enter a valid amount");
      const { data, error } = await supabase
        .from("hostel_fee_transactions")
        .insert({
          allotment_id: allotment.id,
          amount: value,
          period_month: period,
          payment_date: paymentDate || today(),
          payment_method: method,
          notes: notes.trim() || null,
        })
        .select("receipt_number, amount, payment_date, period_month, payment_method, notes")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Payment recorded · ${data.receipt_number}`);
      setPayOpen(false);
      setNotes("");
      setReceipt({
        receipt_number: data.receipt_number,
        student_name: student?.full_name ?? "—",
        roll_number: student?.roll_number ?? "—",
        father_name: student?.father_name ?? null,
        program: `Hostel · ${roomLabel(room, allotment.bed_number)}`,
        fee_type: `Hostel fee — ${monthLabel(String(data.period_month))}`,
        amount: Number(data.amount),
        payment_date: String(data.payment_date),
        notes: [PAYMENT_METHOD_LABELS[data.payment_method] ?? data.payment_method, data.notes]
          .filter(Boolean)
          .join(" · "),
      });
      void queryClient.invalidateQueries({ queryKey: ["hostel_fees"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const vacate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("hostel_allotments")
        .update({ status: "vacated", vacate_date: today() })
        .eq("id", allotment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bed vacated — hostel fee history is kept");
      void queryClient.invalidateQueries({ queryKey: ["hostel_allotments"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-serif">{student?.full_name ?? "Boarder"}</DialogTitle>
            <DialogDescription>
              {student?.roll_number ?? "—"} · {roomLabel(room, allotment.bed_number)}
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-4">
            <StudentPhoto
              path={student?.photo_url ?? null}
              name={student?.full_name ?? ""}
              className="h-28 w-24 shrink-0"
            />
            <div className="min-w-0 flex-1 space-y-2 text-sm">
              <Badge variant={allotment.status === "active" ? "secondary" : "outline"}>
                {allotment.status === "active" ? "Resident" : `Vacated ${allotment.vacate_date}`}
              </Badge>
              <p className="text-muted-foreground">
                Hostel admission: <span className="text-foreground">{allotment.admission_date}</span>
              </p>
              <Badge variant={status.isPaid ? "secondary" : "destructive"}>
                {status.isPaid
                  ? `Paid up to ${status.paidThrough ? monthLabel(status.paidThrough) : "date"}`
                  : `Due ${formatPKR(status.balance)} from ${monthLabel(status.dueFrom!)}`}
              </Badge>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                Father's contact
              </p>
              <ContactLink value={student?.father_contact ?? null} label="Father's contact" />
            </div>
            <div>
              <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                Guardian contact
              </p>
              <ContactLink value={student?.guardian_contact ?? null} label="Guardian contact" />
            </div>
            <div>
              <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                Student contact
              </p>
              <ContactLink value={student?.student_contact ?? null} label="Student contact" />
            </div>
            <Detail label="Guardian name" value={student?.guardian_name ?? null} />
            <Detail label="Father's name" value={student?.father_name ?? null} />
            <div className="sm:col-span-2">
              <Detail label="Emergency address" value={student?.address ?? null} />
            </div>
            <Detail label="Monthly hostel fee" value={formatPKR(monthlyFee)} />
            <Detail
              label="Charged / paid"
              value={`${formatPKR(status.expected)} / ${formatPKR(status.paid)}`}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Hostel fee payments</p>
            {mine.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hostel payments recorded yet.</p>
            ) : (
              <ul className="divide-y rounded-md border text-sm">
                {mine.map((p) => (
                  <li key={p.id} className="grid gap-0.5 px-3 py-2">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{monthLabel(monthStart(p.period_month))}</span>
                      <span>{formatPKR(Number(p.amount))}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {p.receipt_number} · {p.payment_date} ·{" "}
                      {PAYMENT_METHOD_LABELS[p.payment_method] ?? p.payment_method}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <DialogFooter className="flex-wrap gap-2">
            {canAdd ? (
              <Button
                onClick={() => {
                  setAmount(String(monthlyFee));
                  setPeriod(status.dueFrom ?? currentMonthStart());
                  setPaymentDate(today());
                  setPayOpen(true);
                }}
              >
                <Plus className="mr-1.5 h-4 w-4" /> Record hostel fee
              </Button>
            ) : null}
            {canEdit && allotment.status === "active" ? (
              <Button
                variant="outline"
                disabled={vacate.isPending}
                onClick={() => vacate.mutate()}
              >
                <LogOut className="mr-1.5 h-4 w-4" />
                {vacate.isPending ? "Vacating…" : "Mark vacated"}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Record hostel fee</DialogTitle>
            <DialogDescription>
              {student?.full_name} · {roomLabel(room, allotment.bed_number)}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Month covered *">
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions.map((p) => (
                    <SelectItem key={p} value={p}>
                      {monthLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Amount (PKR) *">
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" />
            </Field>
            <Field label="Payment date *">
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </Field>
            <Field label="Method">
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {PAYMENT_METHOD_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Remarks">
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>
              Cancel
            </Button>
            <Button disabled={record.isPending} onClick={() => record.mutate()}>
              {record.isPending ? "Saving…" : "Save payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(receipt)} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-serif">Hostel fee receipt</DialogTitle>
            <DialogDescription>Print or download this receipt for the boarder.</DialogDescription>
          </DialogHeader>
          {receipt ? (
            <>
              <div ref={printRef}>
                <Receipt data={receipt} />
              </div>
              <DialogFooter className="flex-wrap gap-2">
                <ReceiptActions data={receipt} printRef={printRef} />
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="text-sm break-words">{value || "—"}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs tracking-wide text-muted-foreground uppercase">{label}</Label>
      {children}
    </div>
  );
}
