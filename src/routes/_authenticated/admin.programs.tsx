import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { AdminNav } from "./admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { usePrograms, useStudents } from "@/components/panels/StudentsPanel";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { usePermissions } from "@/lib/permissions";
import { buildClassName, isSemesterClass, useClasses, type ClassRow, type ClassSession } from "@/lib/classes";
import { supabase } from "@/integrations/supabase/client";
import type { Program, ProgramType } from "@/lib/sms-types";
import { useModuleGuard } from "@/lib/access";

export const Route = createFileRoute("/_authenticated/admin/programs")({
  head: () => ({
    meta: [
      { title: "Manage Programs — GDC Chamla SMS" },
      {
        name: "description",
        content:
          "Add, rename or retire academic streams and associate degree programs offered at Government Degree College Chamla.",
      },
      { property: "og:title", content: "Manage Programs — GDC Chamla SMS" },
      {
        property: "og:description",
        content: "Maintain the list of streams and AD programs offered at GDC Chamla.",
      },
    ],
  }),
  component: ProgramsPage,
});

const TYPE_LABELS: Record<ProgramType, string> = {
  stream: "Intermediate stream",
  ad_program: "Associate degree",
};

function ProgramsPage() {
  const perms = useModuleGuard("settings");
  const canDelete = perms.can("settings", "delete");
  const queryClient = useQueryClient();
  const { data: programs = [], isLoading } = usePrograms();
  const { data: classes = [] } = useClasses();
  const { data: students = [] } = useStudents();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<ProgramType>("stream");
  const [toDelete, setToDelete] = useState<Program | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["programs"] });

  const save = useMutation({
    mutationFn: async () => {
      const payload = { name: name.trim(), type };
      if (editing) {
        const { error } = await supabase.from("programs").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("programs").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Program updated" : "Program added");
      setOpen(false);
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async (p: Program) => {
      const { error } = await supabase
        .from("programs")
        .update({ active: !p.active })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Program availability updated");
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (p: Program) => {
      const { error } = await supabase.from("programs").delete().eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Program deleted");
      setToDelete(null);
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const programClassCount = (id: string) => classes.filter((c) => c.program_id === id).length;
  const programStudentCount = (id: string) => students.filter((s) => s.program_id === id).length;

  function tryDeleteProgram(p: Program) {
    const cls = programClassCount(p.id);
    const std = programStudentCount(p.id);
    if (std > 0) {
      toast.error(
        `${p.name} has ${std} student${std === 1 ? "" : "s"} — reassign or delete them first.`,
      );
      return;
    }
    if (cls > 0) {
      toast.error(
        `${p.name} has ${cls} class${cls === 1 ? "" : "es"} — delete the classes first.`,
      );
      return;
    }
    setToDelete(p);
  }

  function openNew() {
    setEditing(null);
    setName("");
    setType("stream");
    setOpen(true);
  }

  function openEdit(p: Program) {
    setEditing(p);
    setName(p.name);
    setType(p.type);
    setOpen(true);
  }

  return (
    <AppShell
      title="Manage programs"
      subtitle="Streams and associate degree programs offered by the college. New programs become available in admission forms immediately."
    >
      <AdminNav />

      <div className="mb-4 flex justify-end">
        <Button onClick={openNew}>
          <Plus className="mr-1.5 h-4 w-4" /> Add program
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card shadow-panel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Program</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Offered</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  Loading programs…
                </TableCell>
              </TableRow>
            ) : programs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  No programs yet. Add the first one.
                </TableCell>
              </TableRow>
            ) : (
              programs.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{TYPE_LABELS[p.type]}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={p.active}
                        onCheckedChange={() => toggleActive.mutate(p)}
                        aria-label={`Toggle ${p.name}`}
                      />
                      <span className="text-sm text-muted-foreground">
                        {p.active ? "Open for admission" : "Retired"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                      Edit
                    </Button>
                    {canDelete ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${p.name}`}
                        className="text-destructive hover:text-destructive"
                        onClick={() => tryDeleteProgram(p)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ClassesCard />

      <DeleteConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => {
          if (!o) setToDelete(null);
        }}
        title={`Delete ${toDelete?.name ?? "program"}?`}
        description="This program has no classes or students, so it can be removed safely."
        confirmLabel="Yes, delete program"
        pending={remove.isPending}
        onConfirm={() => {
          if (toDelete) remove.mutate(toDelete);
        }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">
              {editing ? "Edit program" : "Add program"}
            </DialogTitle>
            <DialogDescription>
              Programs added here appear in the admission form without any code change.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs tracking-wide text-muted-foreground uppercase">
                Program name
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. AD Computer Science"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs tracking-wide text-muted-foreground uppercase">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as ProgramType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stream">Intermediate stream</SelectItem>
                  <SelectItem value="ad_program">Associate degree</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!name.trim() || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Saving…" : "Save program"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

/* -------------------------------- Classes -------------------------------- */

function ClassesCard() {
  const queryClient = useQueryClient();
  const { data: classes = [], isLoading } = useClasses();
  const { data: programs = [] } = usePrograms();
  const { data: students = [] } = useStudents();
  const permissions = usePermissions();
  const canDelete = permissions.can("settings", "delete");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClassRow | null>(null);
  const [toDelete, setToDelete] = useState<ClassRow | null>(null);
  const [name, setName] = useState("");
  const [programId, setProgramId] = useState("");
  const [semester, setSemester] = useState("1");
  const [session, setSession] = useState<ClassSession>("Spring");

  const selectedProgram = programs.find((p) => p.id === programId) ?? null;
  const isAd = selectedProgram?.type === "ad_program";
  const finalName = isAd ? buildClassName(Number(semester), session) : name.trim();
  const canSave = Boolean(programId) && Boolean(finalName);

  const programName = (id: string | null) => programs.find((p) => p.id === id)?.name ?? "—";

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["classes"] });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: finalName,
        program_id: programId || null,
        semester_number: isAd ? Number(semester) : null,
        session: isAd ? session : null,
      };
      if (editing) {
        const { error } = await supabase.from("classes").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("classes").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Class updated" : "Class added");
      setOpen(false);
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async (c: ClassRow) => {
      const { error } = await supabase.from("classes").update({ active: !c.active }).eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Class availability updated");
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (c: ClassRow) => {
      const { error } = await supabase.from("classes").delete().eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Class deleted");
      setToDelete(null);
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function tryDeleteClass(c: ClassRow) {
    const count = students.filter((s) => s.class_id === c.id).length;
    if (count > 0) {
      toast.error(
        `${c.name} has ${count} student${count === 1 ? "" : "s"} — reassign or delete them first.`,
      );
      return;
    }
    setToDelete(c);
  }

  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-semibold">Classes</h2>
          <p className="text-sm text-muted-foreground">
            Each class belongs to one program — grades for intermediate streams, semester intakes
            for associate degrees.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setName("");
            setProgramId("");
            setSemester("1");
            setSession("Spring");
            setOpen(true);
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Add class
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card shadow-panel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Class</TableHead>
              <TableHead>Program</TableHead>
              <TableHead>In use</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  Loading classes…
                </TableCell>
              </TableRow>
            ) : classes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  No classes yet. Add the first one.
                </TableCell>
              </TableRow>
            ) : (
              classes.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {programName(c.program_id)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={c.active}
                        onCheckedChange={() => toggleActive.mutate(c)}
                        aria-label={`Toggle ${c.name}`}
                      />
                      <span className="text-sm text-muted-foreground">
                        {c.active ? "Active" : "Retired"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(c);
                        setName(c.name);
                        setProgramId(c.program_id ?? "");
                        setSemester(String(c.semester_number ?? 1));
                        setSession((c.session as ClassSession) ?? "Spring");
                        setOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    {canDelete ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${c.name}`}
                        className="text-destructive hover:text-destructive"
                        onClick={() => tryDeleteClass(c)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">{editing ? "Edit class" : "Add class"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Renaming or moving a class updates it everywhere it is already used."
                : "Classes added here appear in the admission form and attendance filters immediately."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs tracking-wide text-muted-foreground uppercase">
                Program
              </Label>
              <Select
                value={programId}
                onValueChange={(v) => {
                  setProgramId(v);
                  // Switching between a stream and an AD program changes which
                  // fields define the name, so drop values that no longer apply.
                  const next = programs.find((p) => p.id === v);
                  if (next?.type === "ad_program") setName("");
                  else if (editing && isSemesterClass({ semester_number: editing.semester_number })) {
                    setName("");
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select the program this class belongs to" />
                </SelectTrigger>
                <SelectContent>
                  {programs.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · {TYPE_LABELS[p.type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isAd ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs tracking-wide text-muted-foreground uppercase">
                      Semester
                    </Label>
                    <Select value={semester} onValueChange={setSemester}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : "4th"} semester
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs tracking-wide text-muted-foreground uppercase">
                      Intake session
                    </Label>
                    <Select
                      value={session}
                      onValueChange={(v) => setSession(v as ClassSession)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Spring">Spring</SelectItem>
                        <SelectItem value="Fall">Fall</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Class name: <strong className="text-foreground">{finalName}</strong>
                </p>
              </>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs tracking-wide text-muted-foreground uppercase">
                  Class name
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Grade 11"
                  list="grade-suggestions"
                  disabled={!programId}
                />
                <datalist id="grade-suggestions">
                  <option value="Grade 11" />
                  <option value="Grade 12" />
                </datalist>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!canSave || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Saving…" : "Save class"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => {
          if (!o) setToDelete(null);
        }}
        title={`Delete ${toDelete?.name ?? "class"}?`}
        description="No students are assigned to this class, so it can be removed safely."
        confirmLabel="Yes, delete class"
        pending={remove.isPending}
        onConfirm={() => {
          if (toDelete) remove.mutate(toDelete);
        }}
      />
    </section>
  );
}
