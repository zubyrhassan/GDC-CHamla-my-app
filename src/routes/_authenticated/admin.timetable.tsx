import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, UserPlus } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/routes/_authenticated/admin";
import { Button } from "@/components/ui/button";
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
import { usePrograms } from "@/components/panels/StudentsPanel";
import { DayPicker, daySummary } from "@/components/timetable/DayPicker";
import { classDetail, classesForProgram, useClasses } from "@/lib/classes";
import { useModuleGuard } from "@/lib/access";
import {
  DAY_NAMES,
  WORK_DAYS,
  formatTime,
  useAllTeacherClasses,
  useAssignClassToTeacher,
  useDeleteTimetableSlot,
  useSaveTimetableSlot,
  useStaffProfiles,
  useTimetable,
  useUnassignClassFromTeacher,
  type TimetableSlot,
} from "@/lib/timetable";

export const Route = createFileRoute("/_authenticated/admin/timetable")({
  component: TimetablePage,
  head: () => ({
    meta: [
      { title: "Class Timetable & Teacher Assignment | GDC Chamla" },
      {
        name: "description",
        content:
          "Build the weekly class timetable and assign classes to teachers at Government Degree College Chamla, Buner.",
      },
      { property: "og:title", content: "Class Timetable & Teacher Assignment | GDC Chamla" },
      {
        property: "og:description",
        content: "Weekly lecture schedule and per-teacher class assignments for GDC Chamla.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type SlotDraft = {
  /** Existing slot ids this draft replaces (one per previously selected day). */
  ids: string[];
  program_id: string;
  class_id: string;
  teacher_profile_id: string;
  days: number[];
  start_time: string;
  end_time: string;
  subject: string;
  lecture_number: string;
  room: string;
};

const emptyDraft: SlotDraft = {
  ids: [],
  program_id: "",
  class_id: "",
  teacher_profile_id: "",
  days: [],
  start_time: "08:00",
  end_time: "",
  subject: "",
  lecture_number: "1",
  room: "",
};

/** Slots that are the same weekly lecture on different days. */
function groupKey(s: TimetableSlot) {
  return [
    s.class_id,
    s.program_id ?? "",
    s.teacher_profile_id ?? "",
    s.start_time,
    s.end_time ?? "",
    s.subject ?? "",
    s.lecture_number,
    s.room ?? "",
  ].join("|");
}

function TimetablePage() {
  useModuleGuard("settings");

  return (
    <AppShell
      title="Timetable & teacher assignment"
      subtitle="Build the weekly lecture schedule and give each teacher the classes they teach. Teachers see both on their desk."
    >
      <AdminNav />
      <div className="space-y-6">
        <TimetableCard />
        <AssignmentCard />
      </div>
    </AppShell>
  );
}

function TimetableCard() {
  const { data: programs = [] } = usePrograms();
  const { data: classes = [] } = useClasses();
  const { data: staff = [] } = useStaffProfiles();
  const { data: slots = [], isLoading } = useTimetable();
  const save = useSaveTimetableSlot();
  const remove = useDeleteTimetableSlot();

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SlotDraft>(emptyDraft);
  const [dayFilter, setDayFilter] = useState("all");

  const set = (patch: Partial<SlotDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const classOptions = classesForProgram(classes, draft.program_id || null).filter((c) => c.active);
  const className = (id: string) => classDetail(classes.find((c) => c.id === id)) || "—";
  const staffName = (id: string | null) =>
    staff.find((s) => s.id === id)?.full_name ?? (id ? "Unknown staff" : "Unassigned");

  /** One row per weekly lecture, with every day it runs on. */
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; sample: TimetableSlot; slots: TimetableSlot[] }>();
    for (const s of slots) {
      const key = groupKey(s);
      const g = map.get(key) ?? { key, sample: s, slots: [] };
      g.slots.push(s);
      map.set(key, g);
    }
    const all = [...map.values()].map((g) => ({
      ...g,
      days: g.slots.map((s) => s.day_of_week).sort((a, b) => a - b),
    }));
    return dayFilter === "all"
      ? all
      : all.filter((g) => g.days.includes(Number(dayFilter)));
  }, [slots, dayFilter]);

  const openNew = () => {
    setDraft(emptyDraft);
    setOpen(true);
  };

  const openEdit = (group: { slots: TimetableSlot[]; days: number[]; sample: TimetableSlot }) => {
    const slot = group.sample;
    setDraft({
      ids: group.slots.map((s) => s.id),
      program_id: slot.program_id ?? "",
      class_id: slot.class_id,
      teacher_profile_id: slot.teacher_profile_id ?? "",
      days: group.days,
      start_time: slot.start_time.slice(0, 5),
      end_time: slot.end_time ? slot.end_time.slice(0, 5) : "",
      subject: slot.subject ?? "",
      lecture_number: String(slot.lecture_number),
      room: slot.room ?? "",
    });
    setOpen(true);
  };

  const removeGroup = (ids: string[]) => {
    void Promise.all(ids.map((id) => remove.mutateAsync(id)))
      .then(() => toast.success(ids.length === 1 ? "Slot removed" : "Slots removed"))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not remove the slot"));
  };

  const submit = () => {
    if (!draft.class_id) {
      toast.error("Choose the class this lecture belongs to.");
      return;
    }
    if (draft.days.length === 0) {
      toast.error("Select at least one day.");
      return;
    }
    if (!draft.start_time) {
      toast.error("Set a start time.");
      return;
    }
    const base = {
      class_id: draft.class_id,
      program_id: draft.program_id || null,
      teacher_profile_id: draft.teacher_profile_id || null,
      start_time: draft.start_time,
      end_time: draft.end_time || null,
      subject: draft.subject.trim() || null,
      lecture_number: Number(draft.lecture_number) || 1,
      room: draft.room.trim() || null,
    };
    const editing = draft.ids.length > 0;
    void (async () => {
      try {
        // Rewrite the whole weekly pattern so removed days disappear too.
        for (const id of draft.ids) await remove.mutateAsync(id);
        for (const day of draft.days) await save.mutateAsync({ ...base, day_of_week: day });
        toast.success(
          `${editing ? "Lecture updated" : "Lecture added"} — ${daySummary(draft.days)}`,
        );
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save the slot");
      }
    })();
  };

  return (
    <section className="rounded-lg border bg-card shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2 className="font-serif text-lg font-semibold">Weekly timetable</h2>
          <p className="text-sm text-muted-foreground">
            Every lecture with its day, time, class, teacher and room.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dayFilter} onValueChange={setDayFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Day" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All days</SelectItem>
              {WORK_DAYS.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {DAY_NAMES[d]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openNew}>
            <Plus className="mr-1.5 h-4 w-4" /> Add slot
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Days</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Teacher</TableHead>
              <TableHead className="hidden md:table-cell">Lecture</TableHead>
              <TableHead className="hidden md:table-cell">Room</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  Loading timetable…
                </TableCell>
              </TableRow>
            ) : groups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  No lectures scheduled yet.
                </TableCell>
              </TableRow>
            ) : (
              groups.map((g) => {
                const s = g.sample;
                return (
                  <TableRow key={g.key}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {daySummary(g.days)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatTime(s.start_time)}
                      {s.end_time ? ` – ${formatTime(s.end_time)}` : ""}
                    </TableCell>
                    <TableCell className="font-medium">{className(s.class_id)}</TableCell>
                    <TableCell>{s.subject || "—"}</TableCell>
                    <TableCell>{staffName(s.teacher_profile_id)}</TableCell>
                    <TableCell className="hidden md:table-cell">{s.lecture_number}</TableCell>
                    <TableCell className="hidden md:table-cell">{s.room || "—"}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Edit slot"
                        onClick={() => openEdit(g)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Delete slot"
                        onClick={() => removeGroup(g.slots.map((x) => x.id))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">
              {draft.ids.length ? "Edit timetable slot" : "Add timetable slot"}
            </DialogTitle>
            <DialogDescription>
              The assigned teacher sees this lecture on their desk and can open its attendance
              directly.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Program</Label>
              <Select
                value={draft.program_id}
                onValueChange={(v) => set({ program_id: v, class_id: "" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a program" />
                </SelectTrigger>
                <SelectContent>
                  {programs
                    .filter((p) => p.active)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Class</Label>
              <Select
                value={draft.class_id}
                onValueChange={(v) => set({ class_id: v })}
                disabled={!draft.program_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={draft.program_id ? "Choose a class" : "Program first"} />
                </SelectTrigger>
                <SelectContent>
                  {classOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {classDetail(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Teacher</Label>
              <Select
                value={draft.teacher_profile_id}
                onValueChange={(v) => set({ teacher_profile_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a teacher" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name || "Unnamed"} · {s.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Days of the week</Label>
              <DayPicker value={draft.days} onChange={(days) => set({ days })} />
              <p className="text-xs text-muted-foreground">{daySummary(draft.days)}</p>
            </div>
            <div className="space-y-1.5">
              <Label>Starts</Label>
              <Input
                type="time"
                value={draft.start_time}
                onChange={(e) => set({ start_time: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ends</Label>
              <Input
                type="time"
                value={draft.end_time}
                onChange={(e) => set({ end_time: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input
                value={draft.subject}
                onChange={(e) => set({ subject: e.target.value })}
                placeholder="e.g. English"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Lecture number</Label>
              <Input
                type="number"
                min={1}
                value={draft.lecture_number}
                onChange={(e) => set({ lecture_number: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Room</Label>
              <Input value={draft.room} onChange={(e) => set({ room: e.target.value })} placeholder="Room 4" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save slot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function AssignmentCard() {
  const { data: programs = [] } = usePrograms();
  const { data: classes = [] } = useClasses();
  const { data: staff = [] } = useStaffProfiles();
  const { data: assignments = [], isLoading } = useAllTeacherClasses();
  const assign = useAssignClassToTeacher();
  const unassign = useUnassignClassFromTeacher();

  const [profileId, setProfileId] = useState("");
  const [programId, setProgramId] = useState("");
  const [classId, setClassId] = useState("");

  const classOptions = classesForProgram(classes, programId || null).filter((c) => c.active);
  const className = (id: string | null) => classDetail(classes.find((c) => c.id === id)) || "—";
  const programName = (id: string | null) => programs.find((p) => p.id === id)?.name ?? "—";
  const staffName = (id: string) => staff.find((s) => s.id === id)?.full_name ?? "Unknown staff";

  const submit = () => {
    if (!profileId || !programId || !classId) {
      toast.error("Choose a teacher, a program and a class.");
      return;
    }
    assign.mutate(
      { profile_id: profileId, program_id: programId, class_id: classId },
      {
        onSuccess: () => {
          toast.success("Class assigned");
          setClassId("");
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Could not assign the class"),
      },
    );
  };

  return (
    <section className="rounded-lg border bg-card shadow-panel">
      <div className="border-b px-4 py-3">
        <h2 className="font-serif text-lg font-semibold">Assign classes to teachers</h2>
        <p className="text-sm text-muted-foreground">
          An assigned class appears under "My classes" on the teacher's desk, ready for attendance.
        </p>
      </div>

      <div className="grid gap-3 border-b p-4 sm:grid-cols-4">
        <Select value={profileId} onValueChange={setProfileId}>
          <SelectTrigger>
            <SelectValue placeholder="Teacher" />
          </SelectTrigger>
          <SelectContent>
            {staff.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.full_name || "Unnamed"} · {s.role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={programId}
          onValueChange={(v) => {
            setProgramId(v);
            setClassId("");
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Program" />
          </SelectTrigger>
          <SelectContent>
            {programs
              .filter((p) => p.active)
              .map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select value={classId} onValueChange={setClassId} disabled={!programId}>
          <SelectTrigger>
            <SelectValue placeholder={programId ? "Class" : "Program first"} />
          </SelectTrigger>
          <SelectContent>
            {classOptions.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {classDetail(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={submit} disabled={assign.isPending}>
          <UserPlus className="mr-1.5 h-4 w-4" /> Assign class
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Teacher</TableHead>
              <TableHead>Program</TableHead>
              <TableHead>Class</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  Loading assignments…
                </TableCell>
              </TableRow>
            ) : assignments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  No classes assigned yet.
                </TableCell>
              </TableRow>
            ) : (
              assignments.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{staffName(a.profile_id)}</TableCell>
                  <TableCell>{programName(a.program_id)}</TableCell>
                  <TableCell>{className(a.class_id)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Remove assignment"
                      onClick={() =>
                        unassign.mutate(a.id, {
                          onSuccess: () => toast.success("Assignment removed"),
                          onError: (e) =>
                            toast.error(e instanceof Error ? e.message : "Could not remove"),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
