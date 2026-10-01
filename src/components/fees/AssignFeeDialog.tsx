import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { usePrograms, useStudents } from "@/components/panels/StudentsPanel";
import { useClasses, classDetail } from "@/lib/classes";
import { useFeeTypes } from "@/lib/fees";
import { defaultSessionLabel } from "@/lib/fee-dues";

type Target = "all" | "class" | "student";

/** Assigns one fee head to many students at once, skipping anyone already charged. */
export function AssignFeeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { data: students = [] } = useStudents();
  const { data: programs = [] } = usePrograms();
  const { data: classes = [] } = useClasses();
  const { data: feeTypes = [] } = useFeeTypes();

  const [feeTypeId, setFeeTypeId] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [sessionLabel, setSessionLabel] = useState(defaultSessionLabel());
  const [target, setTarget] = useState<Target>("all");
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState("");

  const activeStudents = useMemo(
    () => students.filter((s) => s.status === "active"),
    [students],
  );

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = activeStudents;
    if (!q) return base.slice(0, 30);
    return base
      .filter(
        (s) =>
          s.full_name.toLowerCase().includes(q) ||
          s.roll_number.toLowerCase().includes(q),
      )
      .slice(0, 30);
  }, [activeStudents, search]);

  const classGroups = useMemo(
    () =>
      programs.map((p) => ({
        program: p,
        items: classes.filter((c) => c.program_id === p.id),
      })),
    [programs, classes],
  );
  const sharedClasses = classes.filter((c) => c.program_id == null);

  const targeted = useMemo(() => {
    if (target === "all") return activeStudents;
    if (target === "class") return activeStudents.filter((s) => s.class_id === classId);
    return activeStudents.filter((s) => s.id === studentId);
  }, [target, activeStudents, classId, studentId]);

  const assign = useMutation({
    mutationFn: async () => {
      if (!feeTypeId) throw new Error("Select a fee head");
      if (!(Number(amount) > 0)) throw new Error("Enter an amount greater than zero");
      if (!sessionLabel.trim()) throw new Error("Enter a session or term label");
      if (target === "class" && !classId) throw new Error("Select a class");
      if (target === "student" && !studentId) throw new Error("Select a student");
      if (targeted.length === 0) throw new Error("No active students match this selection");

      const { data: existing, error: existingError } = await supabase
        .from("fee_dues")
        .select("student_id")
        .eq("fee_type_id", feeTypeId)
        .eq("session_label", sessionLabel.trim());
      if (existingError) throw existingError;

      const already = new Set((existing ?? []).map((r) => r.student_id));
      const fresh = targeted.filter((s) => !already.has(s.id));
      if (fresh.length === 0) {
        return { assigned: 0, skipped: targeted.length };
      }

      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("fee_dues").insert(
        fresh.map((s) => ({
          student_id: s.id,
          fee_type_id: feeTypeId,
          amount: Number(amount),
          due_date: dueDate,
          session_label: sessionLabel.trim(),
          notes: notes.trim() || null,
          created_by: userData.user?.id ?? null,
        })),
      );
      if (error) throw error;
      return { assigned: fresh.length, skipped: targeted.length - fresh.length };
    },
    onSuccess: ({ assigned, skipped }) => {
      toast.success(
        `Assigned to ${assigned} student${assigned === 1 ? "" : "s"}, skipped ${skipped} already charged`,
      );
      void queryClient.invalidateQueries({ queryKey: ["fee_dues"] });
      if (assigned > 0) {
        onOpenChange(false);
        setNotes("");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">Assign fee</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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
              <Input
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Session / term</Label>
            <Input
              value={sessionLabel}
              onChange={(e) => setSessionLabel(e.target.value)}
              placeholder="Fall 2026"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Assign to</Label>
            <Select value={target} onValueChange={(v) => setTarget(v as Target)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All students</SelectItem>
                <SelectItem value="class">Specific class</SelectItem>
                <SelectItem value="student">Single student</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {target === "class" ? (
            <div className="space-y-1.5">
              <Label>Class</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classGroups
                    .filter((g) => g.items.length > 0)
                    .map((g) => (
                      <SelectGroup key={g.program.id}>
                        <SelectLabel>{g.program.name}</SelectLabel>
                        {g.items.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {classDetail(c)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  {sharedClasses.length > 0 ? (
                    <SelectGroup>
                      <SelectLabel>Other classes</SelectLabel>
                      {sharedClasses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ) : null}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {target === "student" ? (
            <div className="space-y-1.5">
              <Label>Student</Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or roll number"
              />
              <div className="max-h-48 overflow-y-auto rounded-md border">
                {matches.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-muted-foreground">No students found.</p>
                ) : (
                  matches.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStudentId(s.id)}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted ${
                        studentId === s.id ? "bg-muted font-medium" : ""
                      }`}
                    >
                      <span>{s.full_name}</span>
                      <span className="text-muted-foreground">{s.roll_number}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label>Remarks</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <p className="text-sm text-muted-foreground">
            {targeted.length} active student{targeted.length === 1 ? "" : "s"} targeted.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={assign.isPending} onClick={() => assign.mutate()}>
            Assign fee
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
