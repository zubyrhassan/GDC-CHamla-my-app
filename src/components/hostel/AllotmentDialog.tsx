import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search } from "lucide-react";

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
import { PhotoField } from "@/components/hostel/PhotoField";
import { supabase } from "@/integrations/supabase/client";
import { useStudents } from "@/components/panels/StudentsPanel";
import { useHostelAllotments, useHostelRooms, type HostelAllotment } from "@/lib/hostel";
import type { Student } from "@/lib/sms-types";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Admits an existing student to the hostel. The student record is never
 * duplicated — emergency contact edits made here are written back to it.
 */
export function AllotmentDialog({
  open,
  onOpenChange,
  allotment,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allotment?: HostelAllotment | null;
}) {
  const queryClient = useQueryClient();
  const { data: students = [] } = useStudents();
  const { data: rooms = [] } = useHostelRooms();
  const { data: allotments = [] } = useHostelAllotments();

  const [query, setQuery] = useState("");
  const [studentId, setStudentId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [bed, setBed] = useState("");
  const [admissionDate, setAdmissionDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [contacts, setContacts] = useState({
    photo_url: "",
    father_contact: "",
    guardian_name: "",
    guardian_contact: "",
    student_contact: "",
    address: "",
  });

  const boardedIds = useMemo(
    () =>
      new Set(
        allotments.filter((a) => a.status === "active" && a.id !== allotment?.id).map((a) => a.student_id),
      ),
    [allotments, allotment?.id],
  );

  const student = students.find((s) => s.id === studentId) ?? null;

  useEffect(() => {
    if (!open) return;
    if (allotment) {
      setStudentId(allotment.student_id);
      setRoomId(allotment.room_id);
      setBed(String(allotment.bed_number));
      setAdmissionDate(allotment.admission_date);
      setNotes(allotment.notes ?? "");
    } else {
      setStudentId("");
      setRoomId("");
      setBed("");
      setAdmissionDate(today());
      setNotes("");
      setQuery("");
    }
  }, [open, allotment]);

  useEffect(() => {
    if (!student) return;
    setContacts({
      photo_url: student.photo_url ?? "",
      father_contact: student.father_contact ?? "",
      guardian_name: student.guardian_name ?? "",
      guardian_contact: student.guardian_contact ?? "",
      student_contact: student.student_contact ?? "",
      address: student.address ?? "",
    });
  }, [student?.id]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as Student[];
    return students
      .filter((s) => !boardedIds.has(s.id))
      .filter(
        (s) =>
          s.full_name.toLowerCase().includes(q) ||
          s.roll_number.toLowerCase().includes(q) ||
          (s.father_name ?? "").toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [students, query, boardedIds]);

  const room = rooms.find((r) => r.id === roomId) ?? null;
  const freeBeds = useMemo(() => {
    if (!room) return [] as number[];
    const taken = new Set(
      allotments
        .filter((a) => a.status === "active" && a.room_id === room.id && a.id !== allotment?.id)
        .map((a) => a.bed_number),
    );
    return Array.from({ length: room.capacity }, (_, i) => i + 1).filter((b) => !taken.has(b));
  }, [room, allotments, allotment?.id]);

  const save = useMutation({
    mutationFn: async () => {
      if (!student) throw new Error("Select a student first");
      if (!roomId) throw new Error("Pick a room");
      const bedNumber = Number(bed);
      if (!Number.isFinite(bedNumber) || bedNumber < 1) throw new Error("Pick a bed number");

      const { error: studentError } = await supabase
        .from("students")
        .update({
          photo_url: contacts.photo_url || null,
          father_contact: contacts.father_contact.trim() || null,
          guardian_name: contacts.guardian_name.trim() || null,
          guardian_contact: contacts.guardian_contact.trim() || null,
          student_contact: contacts.student_contact.trim() || null,
          address: contacts.address.trim() || null,
        })
        .eq("id", student.id);
      if (studentError) throw studentError;

      const payload = {
        student_id: student.id,
        room_id: roomId,
        bed_number: bedNumber,
        admission_date: admissionDate || today(),
        notes: notes.trim() || null,
      };

      if (allotment) {
        const { error } = await supabase
          .from("hostel_allotments")
          .update(payload)
          .eq("id", allotment.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("hostel_allotments").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(allotment ? "Allotment updated" : "Student allotted to hostel");
      onOpenChange(false);
      void queryClient.invalidateQueries({ queryKey: ["hostel_allotments"] });
      void queryClient.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (e: Error) =>
      toast.error(
        e.message.includes("hostel_allotments_active_bed_idx")
          ? "That bed is already taken. Pick another bed."
          : e.message.includes("hostel_allotments_active_student_idx")
            ? "This student already has an active hostel allotment."
            : e.message,
      ),
  });

  const setContact = (key: keyof typeof contacts, value: string) =>
    setContacts((c) => ({ ...c, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif">
            {allotment ? "Edit hostel allotment" : "Allot hostel seat"}
          </DialogTitle>
          <DialogDescription>
            Pick a student from the college register, assign a bed and confirm their emergency
            contacts.
          </DialogDescription>
        </DialogHeader>

        {allotment ? null : (
          <div className="space-y-2">
            <Label className="text-xs tracking-wide text-muted-foreground uppercase">
              Search student
            </Label>
            <div className="relative">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Name, roll number or father's name"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {matches.length > 0 ? (
              <ul className="max-h-48 divide-y overflow-y-auto rounded-md border">
                {matches.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-accent/10"
                      onClick={() => {
                        setStudentId(s.id);
                        setQuery("");
                      }}
                    >
                      <span className="font-medium">{s.full_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {s.roll_number}
                        {s.father_name ? ` · s/o ${s.father_name}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}

        {student ? (
          <>
            <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
              <span className="font-medium">{student.full_name}</span>
              <span className="text-muted-foreground"> · {student.roll_number}</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Room *">
                <Select
                  value={roomId}
                  onValueChange={(v) => {
                    setRoomId(v);
                    setBed("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select room" />
                  </SelectTrigger>
                  <SelectContent>
                    {rooms.map((r) => {
                      const taken = allotments.filter(
                        (a) => a.status === "active" && a.room_id === r.id && a.id !== allotment?.id,
                      ).length;
                      return (
                        <SelectItem key={r.id} value={r.id} disabled={taken >= r.capacity}>
                          {r.block ? `${r.block} · ` : ""}Room {r.room_number} ({taken}/{r.capacity})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Bed number *">
                <Select value={bed} onValueChange={setBed} disabled={!room}>
                  <SelectTrigger>
                    <SelectValue placeholder={room ? "Select bed" : "Pick a room first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {freeBeds.map((b) => (
                      <SelectItem key={b} value={String(b)}>
                        Bed {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Hostel admission date *">
                <Input
                  type="date"
                  value={admissionDate}
                  onChange={(e) => setAdmissionDate(e.target.value)}
                />
              </Field>
              <Field label="Notes">
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <p className="text-sm font-medium">Emergency contact details</p>
              <PhotoField
                value={contacts.photo_url}
                rollNumber={student.roll_number}
                name={student.full_name}
                onChange={(path) => setContact("photo_url", path)}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Father's contact">
                  <Input
                    value={contacts.father_contact}
                    onChange={(e) => setContact("father_contact", e.target.value)}
                  />
                </Field>
                <Field label="Guardian name">
                  <Input
                    value={contacts.guardian_name}
                    onChange={(e) => setContact("guardian_name", e.target.value)}
                  />
                </Field>
                <Field label="Guardian contact">
                  <Input
                    value={contacts.guardian_contact}
                    onChange={(e) => setContact("guardian_contact", e.target.value)}
                  />
                </Field>
                <Field label="Student contact">
                  <Input
                    value={contacts.student_contact}
                    onChange={(e) => setContact("student_contact", e.target.value)}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Home address">
                    <Textarea
                      rows={2}
                      value={contacts.address}
                      onChange={(e) => setContact("address", e.target.value)}
                    />
                  </Field>
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Search above and select a student to continue.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={save.isPending || !student || !roomId || !bed}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Saving…" : allotment ? "Save changes" : "Allot seat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
