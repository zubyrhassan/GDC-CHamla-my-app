import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useStudents } from "@/components/panels/StudentsPanel";
import type { StruckOffEvent } from "@/lib/sms-types";

export function StruckOffPanel() {
  const queryClient = useQueryClient();
  const { data: students = [] } = useStudents();
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [reason, setReason] = useState("attendance");
  const [absences, setAbsences] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const { data: events = [], isLoading } = useQuery({
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

  const strikeOff = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("struck_off_events").insert({
        student_id: studentId,
        struck_off_date: date,
        reason,
        consecutive_absences_at_time: absences ? Number(absences) : null,
      });
      if (error) throw error;
      const { error: upErr } = await supabase
        .from("students")
        .update({ status: "struck_off" })
        .eq("id", studentId);
      if (upErr) throw upErr;
    },
    onSuccess: () => {
      toast.success("Student struck off");
      setOpen(false);
      setStudentId("");
      setAbsences("");
      void queryClient.invalidateQueries({ queryKey: ["struck_off_events"] });
      void queryClient.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reinstate = useMutation({
    mutationFn: async (ev: StruckOffEvent) => {
      const { error } = await supabase
        .from("struck_off_events")
        .update({ reinstated: true, reinstated_date: new Date().toISOString().slice(0, 10) })
        .eq("id", ev.id);
      if (error) throw error;
      const { error: upErr } = await supabase
        .from("students")
        .update({ status: "active" })
        .eq("id", ev.student_id);
      if (upErr) throw upErr;
    },
    onSuccess: () => {
      toast.success("Student reinstated");
      void queryClient.invalidateQueries({ queryKey: ["struck_off_events"] });
      void queryClient.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const studentLabel = (id: string) => {
    const s = students.find((x) => x.id === id);
    return s ? `${s.roll_number} — ${s.full_name}` : "—";
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Strike off student
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card shadow-panel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="hidden sm:table-cell">Reason</TableHead>
              <TableHead className="hidden md:table-cell">Absences</TableHead>
              <TableHead>State</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : events.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No struck-off records.
                </TableCell>
              </TableRow>
            ) : (
              events.map((ev) => (
                <TableRow key={ev.id}>
                  <TableCell>{studentLabel(ev.student_id)}</TableCell>
                  <TableCell>{ev.struck_off_date}</TableCell>
                  <TableCell className="hidden capitalize sm:table-cell">{ev.reason}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {ev.consecutive_absences_at_time ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={ev.reinstated ? "secondary" : "destructive"}>
                      {ev.reinstated ? `Reinstated ${ev.reinstated_date ?? ""}` : "Struck off"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {ev.reinstated ? null : (
                      <Button size="sm" variant="ghost" onClick={() => reinstate.mutate(ev)}>
                        Reinstate
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Strike off student</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Student</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent>
                  {students
                    .filter((s) => s.status === "active")
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.roll_number} — {s.full_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Reason</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="attendance">Attendance</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Consecutive absences</Label>
                <Input
                  type="number"
                  value={absences}
                  onChange={(e) => setAbsences(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!studentId || strikeOff.isPending} onClick={() => strikeOff.mutate()}>
              {strikeOff.isPending ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
