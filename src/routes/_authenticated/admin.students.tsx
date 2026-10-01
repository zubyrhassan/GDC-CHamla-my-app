import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileDown, Plus, Printer, Search, Trash2, Upload } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { AdminNav } from "./admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { classesForProgram, useClasses, classMatchesProgram } from "@/lib/classes";
import { BulkImportButton, DownloadTemplateButton } from "@/components/students/BulkImportDialog";
import { ContactLink } from "@/components/ContactLink";
import { StudentPhoto, uploadStudentPhoto } from "@/lib/student-photo";
import { supabase } from "@/integrations/supabase/client";
import { useModuleGuard } from "@/lib/access";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { StudentSummaryButton } from "@/components/students/StudentSummaryReport";
import { PortalAccessCard } from "@/components/students/PortalAccessCard";
import { StudentStatsSection } from "@/components/students/StudentCharts";
import { PrintFrame, downloadTablePdf, usePrintable } from "@/lib/print";
import {
  BOARD_STATUS_LABELS,
  STATUS_LABELS,
  formatPKR,
  type AttendanceStatus,
  type BoardRegStatus,
  type Student,
  type StudentStatus,
} from "@/lib/sms-types";

export const Route = createFileRoute("/_authenticated/admin/students")({
  head: () => ({
    meta: [
      { title: "Student Register — GDC Chamla SMS" },
      {
        name: "description",
        content:
          "Search, admit, edit and print the student register of Government Degree College Chamla, District Buner.",
      },
      { property: "og:title", content: "Student Register — GDC Chamla SMS" },
      {
        property: "og:description",
        content: "Complete student directory with attendance, fees and printable class lists.",
      },
    ],
  }),
  component: StudentsPage,
});

const emptyForm = {
  roll_number: "",
  full_name: "",
  father_name: "",
  father_contact: "",
  guardian_name: "",

  cnic_bform: "",
  date_of_birth: "",
  gender: "",
  photo_url: "",
  student_contact: "",
  guardian_contact: "",
  address: "",
  email: "",
  program_id: "",
  class_id: "",
  session: "",
  section: "",
  status: "active" as StudentStatus,
  admission_date: new Date().toISOString().slice(0, 10),
  board_registration_number: "",
  board_registration_status: "not_started" as BoardRegStatus,
};

type FormState = typeof emptyForm;

function StudentsPage() {
  const perms = useModuleGuard("students");
  const canDelete = perms.can("students", "delete");
  const colCount = canDelete ? 8 : 7;
  const queryClient = useQueryClient();
  const { data: students = [], isLoading } = useStudents();
  const { data: programs = [] } = usePrograms();
  const { data: classes = [] } = useClasses();

  const [query, setQuery] = useState("");
  const [programFilter, setProgramFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [detail, setDetail] = useState<Student | null>(null);
  const [toDelete, setToDelete] = useState<Student | null>(null);

  const programName = (id: string | null) => programs.find((p) => p.id === id)?.name ?? "—";
  const className = (id: string | null) => classes.find((c) => c.id === id)?.name ?? "—";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      if (programFilter !== "all" && s.program_id !== programFilter) return false;
      if (classFilter !== "all" && s.class_id !== classFilter) return false;
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (!q) return true;
      return s.full_name.toLowerCase().includes(q) || s.roll_number.toLowerCase().includes(q);
    });
  }, [students, query, programFilter, classFilter, statusFilter]);

  const save = useMutation({
    mutationFn: async (values: FormState) => {
      const chosenClass = classes.find((c) => c.id === values.class_id);
      if (chosenClass && !classMatchesProgram(chosenClass, values.program_id || null)) {
        const owner = programs.find((p) => p.id === chosenClass.program_id)?.name ?? "another program";
        throw new Error(
          `Class "${chosenClass.name}" belongs to ${owner}. Pick a class from the selected program.`,
        );
      }
      const payload = {
        ...values,
        program_id: values.program_id || null,
        class_id: values.class_id || null,
        date_of_birth: values.date_of_birth || null,
        admission_date: values.admission_date || null,
        photo_url: values.photo_url || null,
        board_registration_number: values.board_registration_number || null,
      };
      if (editing) {
        const { error } = await supabase.from("students").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("students").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Student record updated" : "Student admitted");
      setFormOpen(false);
      setEditing(null);
      setForm(emptyForm);
      void queryClient.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ student, status }: { student: Student; status: StudentStatus }) => {
      const { error } = await supabase.from("students").update({ status }).eq("id", student.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(
        vars.status === "active" ? "Student reactivated" : `Marked as ${STATUS_LABELS[vars.status]}`,
      );
      setDetail((d) => (d ? { ...d, status: vars.status } : d));
      void queryClient.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (student: Student) => {
      const { error } = await supabase.from("students").delete().eq("id", student.id);
      if (error) throw error;
    },
    onSuccess: (_d, student) => {
      toast.success(`${student.full_name} and all linked records were deleted`);
      setToDelete(null);
      setDetail(null);
      void queryClient.invalidateQueries({ queryKey: ["students"] });
      void queryClient.invalidateQueries({ queryKey: ["attendance"] });
      void queryClient.invalidateQueries({ queryKey: ["fees"] });
      void queryClient.invalidateQueries({ queryKey: ["struck-off"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(s: Student) {
    setEditing(s);
    setForm({
      roll_number: s.roll_number,
      full_name: s.full_name,
      father_name: s.father_name ?? "",
      father_contact: s.father_contact ?? "",
      guardian_name: s.guardian_name ?? "",

      cnic_bform: s.cnic_bform ?? "",
      date_of_birth: s.date_of_birth ?? "",
      gender: s.gender ?? "",
      photo_url: s.photo_url ?? "",
      student_contact: s.student_contact ?? "",
      guardian_contact: s.guardian_contact ?? "",
      address: s.address ?? "",
      email: s.email ?? "",
      program_id: s.program_id ?? "",
      class_id: s.class_id ?? "",
      session: s.session ?? "",
      section: s.section ?? "",
      status: s.status,
      admission_date: s.admission_date ?? "",
      board_registration_number: s.board_registration_number ?? "",
      board_registration_status: s.board_registration_status,
    });
    setFormOpen(true);
  }

  const set = (key: keyof FormState, value: string) =>
    setForm((f) => ({ ...f, [key]: value }) as FormState);

  const chips = [
    { id: "all", name: "All programs" },
    ...programs.map((p) => ({ id: p.id, name: p.name })),
  ];
  const programClasses = classesForProgram(classes, programFilter);
  const classChips = [
    { id: "all", name: "All classes" },
    ...programClasses.map((c) => ({ id: c.id, name: c.name })),
  ];

  const printRows = filtered.map((s) => ({
    name: s.full_name,
    roll: s.roll_number,
    program: programName(s.program_id),
    contact: s.student_contact ?? s.guardian_contact ?? "—",
  }));
  const listPrint = usePrintable("Student list — GDC Chamla");
  const downloadListPdf = () => {
    if (printRows.length === 0) {
      toast.error("There are no students in this selection.");
      return;
    }
    downloadTablePdf({
      title: "Student List",
      subtitles: [`${printRows.length} student${printRows.length === 1 ? "" : "s"}`],
      head: ["#", "Name", "Roll No", "Program", "Contact"],
      rows: printRows.map((r, i) => [i + 1, r.name, r.roll, r.program, r.contact]),
      filename: "gdc-chamla-student-list.pdf",
    });
  };

  return (
    <AppShell
      title="Student register"
      subtitle="Complete directory of admitted students with attendance, fee history and printable class lists."
    >
      <div className="no-print">
        <AdminNav />

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or roll number"
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={listPrint.print}>
            <Printer className="mr-1.5 h-4 w-4" /> Print list
          </Button>
          <Button variant="outline" onClick={downloadListPdf}>
            <FileDown className="mr-1.5 h-4 w-4" /> Download PDF
          </Button>
          {perms.can("students", "add") ? (
            <>
              <DownloadTemplateButton />
              <BulkImportButton />
              <Button onClick={openNew}>
                <Plus className="mr-1.5 h-4 w-4" /> Add student
              </Button>
            </>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setProgramFilter(c.id);
                setClassFilter("all");
              }}
              className={
                programFilter === c.id
                  ? "rounded-full border border-primary bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                  : "rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/10"
              }
            >
              {c.name}
            </button>
          ))}
        </div>

        {programFilter === "all" ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Pick a program above to filter by its classes.
          </p>
        ) : programClasses.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {classChips.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setClassFilter(c.id)}
                className={
                  classFilter === c.id
                    ? "rounded-full border border-accent bg-accent px-3 py-1 text-xs font-medium text-accent-foreground"
                    : "rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/10"
                }
              >
                {c.name}
              </button>
            ))}
          </div>
        ) : null}

        <p className="mt-3 text-sm text-muted-foreground">
          Showing {filtered.length} of {students.length} students.
        </p>

        <div className="mt-3 overflow-x-auto rounded-lg border bg-card shadow-panel">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">Photo</TableHead>
                <TableHead>Student</TableHead>
                <TableHead className="hidden sm:table-cell">Roll #</TableHead>
                <TableHead className="hidden sm:table-cell">Program</TableHead>
                <TableHead className="hidden lg:table-cell">Class</TableHead>
                <TableHead className="hidden md:table-cell">Contact</TableHead>
                <TableHead>Status</TableHead>
                {canDelete ? <TableHead className="w-12 text-right">Delete</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={colCount} className="py-10 text-center text-muted-foreground">
                    Loading students…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colCount} className="py-10 text-center text-muted-foreground">
                    No students match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((s) => (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer"
                    onClick={() => setDetail(s)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setDetail(s);
                    }}
                  >
                    <TableCell>
                      <StudentPhoto path={s.photo_url} name={s.full_name} />
                    </TableCell>
                    <TableCell className="min-w-0 font-medium">
                      <p className="max-w-36 truncate sm:max-w-none">{s.full_name}</p>
                      <p className="mt-0.5 text-xs font-normal text-muted-foreground sm:hidden">
                        Roll {s.roll_number}
                      </p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{s.roll_number}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="secondary">{programName(s.program_id)}</Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{className(s.class_id)}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <ContactLink
                        value={s.student_contact ?? s.guardian_contact}
                        label={s.student_contact ? "Student contact" : "Guardian contact"}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.status === "active" ? "default" : "outline"}>
                        {STATUS_LABELS[s.status]}
                      </Badge>
                    </TableCell>
                    {canDelete ? (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${s.full_name}`}
                          className="text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setToDelete(s);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <PrintFrame innerRef={listPrint.ref}>
        <PrintList rows={printRows} />
      </PrintFrame>

      <StudentDetailDialog
        student={detail}
        programName={detail ? programName(detail.program_id) : ""}
        classLabel={detail ? className(detail.class_id) : ""}
        onClose={() => setDetail(null)}
        onEdit={(s) => {
          setDetail(null);
          openEdit(s);
        }}
        onSetStatus={(s, status) => setStatus.mutate({ student: s, status })}
        statusPending={setStatus.isPending}
        onDelete={canDelete ? (s) => setToDelete(s) : undefined}
      />

      <DeleteConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => {
          if (!o) setToDelete(null);
        }}
        title={`Delete ${toDelete?.full_name ?? "student"}?`}
        description="This permanently removes the student from the college register. It cannot be undone."
        details={
          <>
            <p className="font-medium">Everything linked to this student is deleted too:</p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
              <li>Attendance history in every register and lecture</li>
              <li>Fee charges, payments and issued receipts</li>
              <li>Exam results and marks in all result sheets</li>
              <li>Struck-off and readmission history</li>
            </ul>
          </>
        }
        confirmText={toDelete?.roll_number}
        confirmLabel="Yes, delete student"
        pending={remove.isPending}
        onConfirm={() => {
          if (toDelete) remove.mutate(toDelete);
        }}
      />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif">
              {editing ? "Edit student record" : "New admission"}
            </DialogTitle>
            <DialogDescription>
              Fields marked with * are required for the college register.
            </DialogDescription>
          </DialogHeader>

          <PhotoField
            value={form.photo_url}
            rollNumber={form.roll_number}
            name={form.full_name || "student"}
            onChange={(path) => set("photo_url", path)}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Roll number *">
              <Input
                value={form.roll_number}
                onChange={(e) => set("roll_number", e.target.value)}
              />
            </Field>
            <Field label="Full name *">
              <Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
            </Field>
            <Field label="Father name">
              <Input
                value={form.father_name}
                onChange={(e) => set("father_name", e.target.value)}
              />
            </Field>
            <Field label="Father contact">
              <Input
                value={form.father_contact}
                onChange={(e) => set("father_contact", e.target.value)}
              />
            </Field>
            <Field label="Guardian name">
              <Input
                value={form.guardian_name}
                onChange={(e) => set("guardian_name", e.target.value)}
              />
            </Field>

            <Field label="CNIC / B-Form">
              <Input value={form.cnic_bform} onChange={(e) => set("cnic_bform", e.target.value)} />
            </Field>
            <Field label="Date of birth">
              <Input
                type="date"
                value={form.date_of_birth}
                onChange={(e) => set("date_of_birth", e.target.value)}
              />
            </Field>
            <Field label="Gender">
              <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Student contact">
              <Input
                value={form.student_contact}
                onChange={(e) => set("student_contact", e.target.value)}
              />
            </Field>
            <Field label="Guardian contact">
              <Input
                value={form.guardian_contact}
                onChange={(e) => set("guardian_contact", e.target.value)}
              />
            </Field>
            <Field label="Email">
              <Input value={form.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="Program">
              <Select
                value={form.program_id}
                onValueChange={(v) => {
                  setForm((f) => {
                    const current = classes.find((c) => c.id === f.class_id);
                    return {
                      ...f,
                      program_id: v,
                      // A class belongs to one program — drop it if it no longer matches.
                      class_id: classMatchesProgram(current, v) ? f.class_id : "",
                    };
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select program" />
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
            </Field>
            <Field label="Class">
              <Select value={form.class_id} onValueChange={(v) => set("class_id", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classesForProgram(classes, form.program_id)
                    .filter((c) => c.active)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Session">
              <Input
                value={form.session}
                placeholder="2026-28"
                onChange={(e) => set("session", e.target.value)}
              />
            </Field>
            <Field label="Section">
              <Input value={form.section} onChange={(e) => set("section", e.target.value)} />
            </Field>
            <Field label="Admission date">
              <Input
                type="date"
                value={form.admission_date}
                onChange={(e) => set("admission_date", e.target.value)}
              />
            </Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Board registration #">
              <Input
                value={form.board_registration_number}
                onChange={(e) => set("board_registration_number", e.target.value)}
              />
            </Field>
            <Field label="Board registration status">
              <Select
                value={form.board_registration_status}
                onValueChange={(v) => set("board_registration_status", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(BOARD_STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Address">
                <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
              </Field>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={save.isPending || !form.roll_number.trim() || !form.full_name.trim()}
              onClick={() => save.mutate(form)}
            >
              {save.isPending ? "Saving…" : "Save record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function PhotoField({
  value,
  rollNumber,
  name,
  onChange,
}: {
  value: string;
  rollNumber: string;
  name: string;
  onChange: (path: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const path = await uploadStudentPhoto(file, rollNumber);
      onChange(path);
      toast.success("Photograph uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-4 rounded-lg border bg-muted/30 p-4">
      <StudentPhoto path={value} name={name} className="h-20 w-16" />
      <div>
        <p className="text-sm font-medium">Photograph</p>
        <p className="text-xs text-muted-foreground">
          Passport-size JPG or PNG. Stored securely and visible to college staff only.
        </p>
        <div className="mt-2 flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="mr-1.5 h-4 w-4" />
            {uploading ? "Uploading…" : value ? "Replace photo" : "Upload photo"}
          </Button>
          {value ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
              Remove
            </Button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}

function StudentDetailDialog({
  student,
  programName,
  classLabel,
  onClose,
  onEdit,
  onSetStatus,
  statusPending,
  onDelete,
}: {
  student: Student | null;
  programName: string;
  classLabel: string;
  onClose: () => void;
  onEdit: (s: Student) => void;
  onSetStatus: (s: Student, status: StudentStatus) => void;
  statusPending: boolean;
  onDelete?: ((s: Student) => void) | undefined;
}) {
  const { data: attendance = [] } = useQuery({
    queryKey: ["student-attendance", student?.id],
    enabled: Boolean(student),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("date, status")
        .eq("student_id", student!.id)
        .order("date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as { date: string; status: AttendanceStatus }[];
    },
  });

  const { data: fees = [] } = useQuery({
    queryKey: ["student-fees", student?.id],
    enabled: Boolean(student),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fee_transactions")
        .select("amount, payment_date, receipt_number")
        .eq("student_id", student!.id)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as { amount: number; payment_date: string; receipt_number: string }[];
    },
  });

  const { data: expected = 0 } = useQuery({
    queryKey: ["fee-expected"],
    enabled: Boolean(student),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fee_types")
        .select("default_amount")
        .eq("active", true);
      if (error) throw error;
      return (data ?? []).reduce(
        (sum: number, r: { default_amount: number }) => sum + Number(r.default_amount),
        0,
      );
    },
  });

  if (!student) return null;

  const total = attendance.filter((a) => a.status !== "leave").length;
  const present = attendance.filter((a) => a.status === "present").length;
  const percentage = total ? Math.round((present / total) * 100) : null;
  const paid = fees.reduce((s, f) => s + Number(f.amount), 0);
  const balance = expected - paid;
  const trend = [...attendance].slice(0, 10).reverse();

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif">{student.full_name}</DialogTitle>
          <DialogDescription>
            Roll {student.roll_number} · {programName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-start gap-4">
          <StudentPhoto path={student.photo_url} name={student.full_name} className="h-28 w-24" />
          <div className="grid flex-1 gap-3 sm:grid-cols-3">
            <Metric
              label="Attendance"
              value={percentage === null ? "No records" : `${percentage}%`}
              hint={total ? `${present} of ${total} days present` : undefined}
            />
            <Metric
              label="Fees paid"
              value={formatPKR(paid)}
              hint={`${fees.length} receipt${fees.length === 1 ? "" : "s"}`}
            />
            <Metric
              label="Balance"
              value={expected ? formatPKR(Math.max(balance, 0)) : "—"}
              hint={expected ? `Expected ${formatPKR(expected)}` : "No fee heads defined"}
            />
          </div>
        </div>

        <div>
          <p className="text-xs tracking-wide text-muted-foreground uppercase">
            Last 10 marked days
          </p>
          {trend.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No attendance marked yet.</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {trend.map((d) => (
                <div key={d.date} className="text-center">
                  <div
                    className={
                      d.status === "present"
                        ? "h-8 w-8 rounded bg-primary"
                        : d.status === "leave"
                          ? "h-8 w-8 rounded bg-accent/50"
                          : "h-8 w-8 rounded bg-destructive/80"
                    }
                    title={`${d.date}: ${d.status}`}
                  />
                  <span className="mt-1 block text-[10px] text-muted-foreground">
                    {d.date.slice(5)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Detail label="Father name" value={student.father_name} />
          <div>
            <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
              Father contact
            </p>
            <ContactLink value={student.father_contact} label="Father contact" />
          </div>
          <Detail label="Guardian name" value={student.guardian_name} />
          <Detail label="CNIC / B-Form" value={student.cnic_bform} />
          <Detail label="Date of birth" value={student.date_of_birth} />
          <Detail label="Gender" value={student.gender} />

          <div>
            <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
              Student contact
            </p>
            <ContactLink value={student.student_contact} label="Student contact" />
          </div>
          <div>
            <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
              Guardian contact
            </p>
            <ContactLink value={student.guardian_contact} label="Guardian contact" />
          </div>
          <Detail label="Email" value={student.email} />
          <Detail label="Class" value={classLabel} />
          <Detail label="Session" value={student.session} />
          <Detail label="Section" value={student.section} />
          <Detail label="Admission date" value={student.admission_date} />
          <Detail label="Board registration #" value={student.board_registration_number} />
          <Detail
            label="Board registration"
            value={BOARD_STATUS_LABELS[student.board_registration_status]}
          />
          <Detail label="Status" value={STATUS_LABELS[student.status]} />
          <div className="sm:col-span-2">
            <Detail label="Address" value={student.address} />
          </div>
        </div>

        <StudentStatsSection studentId={student.id} />

        <PortalAccessCard student={student} />

        <DialogFooter className="flex-wrap gap-2">
          <StudentSummaryButton
            student={student}
            programName={programName}
            classLabel={classLabel}
          />
          {student.status === "active" ? (
            <Button
              variant="outline"
              disabled={statusPending}
              onClick={() => onSetStatus(student, "struck_off")}
            >
              Deactivate (strike off)
            </Button>
          ) : (
            <Button
              variant="outline"
              disabled={statusPending}
              onClick={() => onSetStatus(student, "active")}
            >
              Reactivate
            </Button>
          )}
          {onDelete ? (
            <Button variant="destructive" onClick={() => onDelete(student)}>
              <Trash2 className="mr-1.5 h-4 w-4" /> Delete student
            </Button>
          ) : null}
          <Button onClick={() => onEdit(student)}>Edit record</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string | undefined }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-0.5 font-serif text-lg font-semibold">{value}</p>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="text-sm">{value || "—"}</p>
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

function PrintList({
  rows,
}: {
  rows: { name: string; roll: string; program: string; contact: string }[];
}) {
  const printed = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <section>
      <header className="print-header">
        <h2>Government Degree College Chamla</h2>
        <p>District Buner, Khyber Pakhtunkhwa — Student List</p>
        <p>
          {rows.length} student{rows.length === 1 ? "" : "s"} · Printed {printed}
        </p>
      </header>
      <table className="print-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Roll No</th>
            <th>Program</th>
            <th>Contact</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.roll}>
              <td>{i + 1}</td>
              <td>{r.name}</td>
              <td>{r.roll}</td>
              <td>{r.program}</td>
              <td>{r.contact}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
