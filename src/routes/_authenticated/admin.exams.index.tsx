import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, Pencil, Plus } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/routes/_authenticated/admin";
import { Badge } from "@/components/ui/badge";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { usePrograms } from "@/components/panels/StudentsPanel";
import { useClasses } from "@/lib/classes";
import { useExams, type Exam } from "@/lib/exams";
import { useModuleGuard } from "@/lib/access";

export const Route = createFileRoute("/_authenticated/admin/exams/")({
  head: () => ({
    meta: [
      { title: "Examinations — GDC Chamla" },
      {
        name: "description",
        content:
          "Create examinations, enter marks and print official result sheets for Government Degree College Chamla, Buner.",
      },
      { property: "og:title", content: "Examinations — GDC Chamla" },
      {
        property: "og:description",
        content: "Exam register, marks entry and printable result sheets for GDC Chamla.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminExamsPage,
});

const emptyForm = {
  name: "",
  subject: "",
  total_marks: "100",
  exam_date: new Date().toISOString().slice(0, 10),
  class_id: "all",
  program_id: "all",
};

function AdminExamsPage() {
  const perms = useModuleGuard("examinations");
  const queryClient = useQueryClient();
  const { data: exams = [], isLoading } = useExams();
  const { data: programs = [] } = usePrograms();
  const { data: classes = [] } = useClasses();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Exam | null>(null);
  const [form, setForm] = useState(emptyForm);
  const set = (k: keyof typeof emptyForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const programName = (id: string | null) => programs.find((p) => p.id === id)?.name;
  const className = (id: string | null) => classes.find((c) => c.id === id)?.name;

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (e: Exam) => {
    setEditing(e);
    setForm({
      name: e.name,
      subject: e.subject ?? "",
      total_marks: String(e.total_marks),
      exam_date: e.exam_date,
      class_id: e.class_id ?? "all",
      program_id: e.program_id ?? "all",
    });
    setOpen(true);
  };

  const create = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        subject: form.subject.trim() || null,
        total_marks: Number(form.total_marks) || 0,
        exam_date: form.exam_date,
        class_id: form.class_id === "all" ? null : form.class_id,
        program_id: form.program_id === "all" ? null : form.program_id,
      };
      if (editing) {
        const { error } = await supabase.from("exams").update(payload).eq("id", editing.id);
        if (error) throw error;
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("exams")
        .insert({ ...payload, created_by: userData.user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editing ? "Exam updated" : "Exam created");
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      void queryClient.invalidateQueries({ queryKey: ["exams"] });
      void queryClient.invalidateQueries({ queryKey: ["exam"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const scopeOf = (classId: string | null, programId: string | null) => {
    const parts = [className(classId), programName(programId)].filter(Boolean);
    return parts.length ? parts.join(" · ") : "All active students";
  };

  return (
    <AppShell
      title="Examinations"
      subtitle="Create exams, record marks and print official result sheets."
    >
      <AdminNav />

      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{exams.length} exam(s) on record.</p>
        {perms.can("examinations", "add") ? (
          <Button onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" /> New exam
          </Button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card shadow-panel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Exam</TableHead>
              <TableHead className="hidden sm:table-cell">Subject</TableHead>
              <TableHead className="text-center">Total marks</TableHead>
              <TableHead className="hidden md:table-cell">Date</TableHead>
              <TableHead className="hidden lg:table-cell">Scope</TableHead>
              <TableHead className="text-right">Marks</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Loading exams…
                </TableCell>
              </TableRow>
            ) : exams.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No exams yet. Create the first one.
                </TableCell>
              </TableRow>
            ) : (
              exams.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-1.5">
                      {e.name}
                      {e.finalized_at ? (
                        <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-label="Finalized" />
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{e.subject ?? "—"}</TableCell>
                  <TableCell className="text-center tabular-nums">{e.total_marks}</TableCell>
                  <TableCell className="hidden md:table-cell whitespace-nowrap">
                    {new Date(e.exam_date + "T00:00:00").toLocaleDateString("en-GB")}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <Badge variant="secondary">{scopeOf(e.class_id, e.program_id)}</Badge>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {perms.can("examinations", "edit") ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Edit ${e.name}`}
                        onClick={() => openEdit(e)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    ) : null}
                    <Button asChild variant="ghost" size="sm">
                      <Link to="/admin/exams/$examId" params={{ examId: e.id }}>
                        {e.finalized_at ? "View results" : "Enter marks"}
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">
              {editing ? "Edit examination" : "New examination"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Changes apply to the result sheet immediately. Reducing total marks does not change marks already recorded."
                : "Leave class and program blank to include every active student."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs tracking-wide text-muted-foreground uppercase">
                Exam name *
              </Label>
              <Input
                value={form.name}
                placeholder="Mid Term"
                onChange={(e) => set("name", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs tracking-wide text-muted-foreground uppercase">
                Subject
              </Label>
              <Input
                value={form.subject}
                placeholder="Physics"
                onChange={(e) => set("subject", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs tracking-wide text-muted-foreground uppercase">
                Total marks *
              </Label>
              <Input
                type="number"
                min={1}
                value={form.total_marks}
                onChange={(e) => set("total_marks", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs tracking-wide text-muted-foreground uppercase">Date</Label>
              <Input
                type="date"
                value={form.exam_date}
                onChange={(e) => set("exam_date", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs tracking-wide text-muted-foreground uppercase">Class</Label>
              <Select value={form.class_id} onValueChange={(v) => set("class_id", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All classes</SelectItem>
                  {classes
                    .filter((c) => c.active)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs tracking-wide text-muted-foreground uppercase">
                Program
              </Label>
              <Select value={form.program_id} onValueChange={(v) => set("program_id", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All programs</SelectItem>
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
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                setEditing(null);
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={create.isPending || !form.name.trim() || Number(form.total_marks) <= 0}
              onClick={() => create.mutate()}
            >
              {create.isPending
                ? "Saving…"
                : editing
                  ? "Save changes"
                  : "Create exam"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
