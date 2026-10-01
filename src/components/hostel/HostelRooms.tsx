import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BedDouble, Pencil, Plus, Trash2 } from "lucide-react";

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
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { supabase } from "@/integrations/supabase/client";
import { useHostelAllotments, useHostelRooms, type HostelRoom } from "@/lib/hostel";
import { useStudents } from "@/components/panels/StudentsPanel";

const emptyRoom = { room_number: "", block: "", floor: "", capacity: "1", notes: "" };
type RoomForm = typeof emptyRoom;

export function HostelRooms({
  canAdd,
  canEdit,
  canDelete,
}: {
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: rooms = [], isLoading } = useHostelRooms();
  const { data: allotments = [] } = useHostelAllotments();
  const { data: students = [] } = useStudents();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<HostelRoom | null>(null);
  const [form, setForm] = useState<RoomForm>(emptyRoom);
  const [toDelete, setToDelete] = useState<HostelRoom | null>(null);

  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s] as const)), [students]);

  const occupancy = useMemo(() => {
    const map = new Map<string, typeof allotments>();
    for (const a of allotments) {
      if (a.status !== "active") continue;
      const list = map.get(a.room_id) ?? [];
      list.push(a);
      map.set(a.room_id, list);
    }
    return map;
  }, [allotments]);

  const save = useMutation({
    mutationFn: async (values: RoomForm) => {
      const capacity = Number(values.capacity);
      if (!values.room_number.trim()) throw new Error("Room number is required");
      if (!Number.isFinite(capacity) || capacity < 1) throw new Error("Capacity must be at least 1");
      const payload = {
        room_number: values.room_number.trim(),
        block: values.block.trim(),
        floor: values.floor.trim() || null,
        capacity,
        notes: values.notes.trim() || null,
      };
      if (editing) {
        const filled = (occupancy.get(editing.id) ?? []).length;
        if (capacity < filled)
          throw new Error(`${filled} bed(s) are occupied — capacity cannot be lower than that.`);
        const { error } = await supabase.from("hostel_rooms").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("hostel_rooms").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Room updated" : "Room added");
      setOpen(false);
      setEditing(null);
      setForm(emptyRoom);
      void queryClient.invalidateQueries({ queryKey: ["hostel_rooms"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (room: HostelRoom) => {
      const { error } = await supabase.from("hostel_rooms").delete().eq("id", room.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Room deleted");
      setToDelete(null);
      void queryClient.invalidateQueries({ queryKey: ["hostel_rooms"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() {
    setEditing(null);
    setForm(emptyRoom);
    setOpen(true);
  }

  function openEdit(room: HostelRoom) {
    setEditing(room);
    setForm({
      room_number: room.room_number,
      block: room.block,
      floor: room.floor ?? "",
      capacity: String(room.capacity),
      notes: room.notes ?? "",
    });
    setOpen(true);
  }

  function askDelete(room: HostelRoom) {
    const active = (occupancy.get(room.id) ?? []).length;
    if (active > 0) {
      toast.error(`${active} student(s) are currently allotted here. Vacate them first.`);
      return;
    }
    if (allotments.some((a) => a.room_id === room.id)) {
      toast.error("Past hostel records reference this room, so it cannot be deleted.");
      return;
    }
    setToDelete(room);
  }

  const set = (key: keyof RoomForm, value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="space-y-4">
      {canAdd ? (
        <Button onClick={openNew}>
          <Plus className="mr-1.5 h-4 w-4" /> Add room
        </Button>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading rooms…</p>
      ) : rooms.length === 0 ? (
        <p className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          No hostel rooms yet.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => {
            const active = occupancy.get(room.id) ?? [];
            const full = active.length >= room.capacity;
            return (
              <article key={room.id} className="rounded-lg border bg-card p-4 shadow-panel">
                <header className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-serif text-base font-semibold">
                      Room {room.room_number}
                      {room.block ? ` · ${room.block}` : ""}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {room.floor ? `Floor ${room.floor} · ` : ""}
                      {room.capacity} bed{room.capacity === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Badge variant={full ? "destructive" : "secondary"} className="shrink-0">
                    <BedDouble className="mr-1 h-3.5 w-3.5" />
                    {active.length}/{room.capacity}
                  </Badge>
                </header>

                <ul className="mt-3 space-y-1 text-sm">
                  {active.length === 0 ? (
                    <li className="text-muted-foreground">No boarders allotted.</li>
                  ) : (
                    active
                      .slice()
                      .sort((a, b) => a.bed_number - b.bed_number)
                      .map((a) => {
                        const s = studentById.get(a.student_id);
                        return (
                          <li key={a.id} className="flex gap-2">
                            <span className="w-14 shrink-0 text-xs text-muted-foreground">
                              Bed {a.bed_number}
                            </span>
                            <span className="min-w-0 flex-1 truncate">
                              {s ? `${s.full_name} (${s.roll_number})` : "Unknown student"}
                            </span>
                          </li>
                        );
                      })
                  )}
                </ul>

                {room.notes ? (
                  <p className="mt-3 border-t pt-2 text-xs text-muted-foreground">{room.notes}</p>
                ) : null}

                {canEdit || canDelete ? (
                  <div className="mt-3 flex gap-2">
                    {canEdit ? (
                      <Button variant="outline" size="sm" onClick={() => openEdit(room)}>
                        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                      </Button>
                    ) : null}
                    {canDelete ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => askDelete(room)}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">
              {editing ? "Edit room" : "Add hostel room"}
            </DialogTitle>
            <DialogDescription>Rooms are identified by block and room number.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Room number *">
              <Input
                value={form.room_number}
                onChange={(e) => set("room_number", e.target.value)}
              />
            </Field>
            <Field label="Block / building">
              <Input value={form.block} onChange={(e) => set("block", e.target.value)} />
            </Field>
            <Field label="Floor">
              <Input value={form.floor} onChange={(e) => set("floor", e.target.value)} />
            </Field>
            <Field label="Total beds *">
              <Input
                type="number"
                min={1}
                value={form.capacity}
                onChange={(e) => set("capacity", e.target.value)}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Notes">
                <Textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </Field>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={save.isPending} onClick={() => save.mutate(form)}>
              {save.isPending ? "Saving…" : "Save room"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete room"
        description="This removes the room from the hostel register."
        details={
          toDelete ? (
            <p>
              Room {toDelete.room_number}
              {toDelete.block ? ` · ${toDelete.block}` : ""} has no boarders and no past records.
            </p>
          ) : null
        }
        pending={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete)}
      />
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
