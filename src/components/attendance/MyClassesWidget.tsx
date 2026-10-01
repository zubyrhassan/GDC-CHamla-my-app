import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { CalendarCheck, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePrograms } from "@/components/panels/StudentsPanel";
import { classDetail, classesForProgram, useClasses } from "@/lib/classes";
import { useMyClasses, useRemoveMyClass, useSaveMyClass } from "@/lib/teacher-classes";

/**
 * "My classes" — each teacher builds their own short list of classes and opens
 * attendance for one with a single tap. Only saved classes are listed here.
 */
export function MyClassesWidget({ basePath = "/teacher" }: { basePath?: string }) {
  const { data: programs = [] } = usePrograms();
  const { data: classes = [] } = useClasses();
  const { data: mine = [], isLoading } = useMyClasses();
  const save = useSaveMyClass();
  const remove = useRemoveMyClass();

  const [open, setOpen] = useState(false);
  const [programId, setProgramId] = useState("");
  const [classId, setClassId] = useState("");

  const options = classesForProgram(classes, programId || null).filter((c) => c.active);

  const add = () => {
    if (!programId || !classId) {
      toast.error("Choose a program and a class.");
      return;
    }
    save.mutate(
      { program_id: programId, class_id: classId },
      {
        onSuccess: () => {
          toast.success("Class saved");
          setOpen(false);
          setClassId("");
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save the class"),
      },
    );
  };

  return (
    <section className="rounded-lg border bg-card shadow-panel">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2 className="font-serif text-base font-semibold">My classes</h2>
          <p className="text-xs text-muted-foreground">
            Saved classes only — tap one to mark its attendance.
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Add class
        </Button>
      </div>

      {isLoading ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">Loading your classes…</p>
      ) : mine.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          No classes saved yet. Add the classes you teach and they will appear here.
        </p>
      ) : (
        <ul className="divide-y">
          {mine.map((m) => {
            const cls = classes.find((c) => c.id === m.class_id);
            const prog = programs.find((p) => p.id === m.program_id);
            return (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{classDetail(cls) || "Class"}</p>
                  <p className="truncate text-xs text-muted-foreground">{prog?.name ?? "—"}</p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link
                    to={`${basePath}/attendance` as "/teacher/attendance"}
                    search={{ program: m.program_id ?? "", class: m.class_id ?? "", lecture: undefined }}
                  >
                    <CalendarCheck className="mr-1.5 h-4 w-4" /> Attendance
                  </Link>
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Remove saved class"
                  onClick={() => remove.mutate(m.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Add a class</DialogTitle>
            <DialogDescription>
              Pick the program, then the grade or semester you teach.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Program</Label>
              <Select
                value={programId}
                onValueChange={(v) => {
                  setProgramId(v);
                  setClassId("");
                }}
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
              <Select value={classId} onValueChange={setClassId} disabled={!programId}>
                <SelectTrigger>
                  <SelectValue placeholder={programId ? "Choose a class" : "Choose a program first"} />
                </SelectTrigger>
                <SelectContent>
                  {options.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {classDetail(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={add} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save class"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
