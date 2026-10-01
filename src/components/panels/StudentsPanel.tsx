import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";

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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { ContactLink } from "@/components/ContactLink";
import { ScanButton } from "@/components/scan/ScanButton";
import { asDate, asText, localPhone } from "@/lib/photo-scan";
import {
  BOARD_STATUS_LABELS,
  STATUS_LABELS,
  type BoardRegStatus,
  type Program,
  type Student,
  type StudentStatus,
} from "@/lib/sms-types";

export function useStudents() {
  return useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .order("roll_number", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Student[];
    },
  });
}

export function usePrograms() {
  return useQuery({
    queryKey: ["programs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("id, name, type, active")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Program[];
    },
  });
}

const emptyForm = {
  roll_number: "",
  full_name: "",
  father_name: "",
  cnic_bform: "",
  date_of_birth: "",
  gender: "",
  photo_url: "",
  student_contact: "",
  guardian_contact: "",
  address: "",
  email: "",
  program_id: "",
  session: "",
  section: "",
  status: "active" as StudentStatus,
  admission_date: new Date().toISOString().slice(0, 10),
  board_registration_number: "",
  board_registration_status: "not_started" as BoardRegStatus,
};

type FormState = typeof emptyForm;

export function StudentsPanel({ canEdit }: { canEdit: boolean }) {
  const queryClient = useQueryClient();
  const { data: students = [], isLoading } = useStudents();
  const { data: programs = [] } = usePrograms();

  const [query, setQuery] = useState("");
  const [programFilter, setProgramFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const programName = (id: string | null) => programs.find((p) => p.id === id)?.name ?? "—";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      if (programFilter !== "all" && s.program_id !== programFilter) return false;
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (!q) return true;
      return (
        s.full_name.toLowerCase().includes(q) ||
        s.roll_number.toLowerCase().includes(q) ||
        (s.father_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [students, query, programFilter, statusFilter]);

  const save = useMutation({
    mutationFn: async (values: FormState) => {
      const payload = {
        ...values,
        program_id: values.program_id || null,
        date_of_birth: values.date_of_birth || null,
        admission_date: values.admission_date || null,
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
      toast.success(editing ? "Student updated" : "Student admitted");
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      void queryClient.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(s: Student) {
    setEditing(s);
    setForm({
      roll_number: s.roll_number,
      full_name: s.full_name,
      father_name: s.father_name ?? "",
      cnic_bform: s.cnic_bform ?? "",
      date_of_birth: s.date_of_birth ?? "",
      gender: s.gender ?? "",
      photo_url: s.photo_url ?? "",
      student_contact: s.student_contact ?? "",
      guardian_contact: s.guardian_contact ?? "",
      address: s.address ?? "",
      email: s.email ?? "",
      program_id: s.program_id ?? "",
      session: s.session ?? "",
      section: s.section ?? "",
      status: s.status,
      admission_date: s.admission_date ?? "",
      board_registration_number: s.board_registration_number ?? "",
      board_registration_status: s.board_registration_status,
    });
    setOpen(true);
  }

  const set = (key: keyof FormState, value: string) =>
    setForm((f) => ({ ...f, [key]: value }) as FormState);

  /** Fills the admission form from a photographed form / CNIC / B-Form. */
  function applyScannedStudent(data: Record<string, unknown>) {
    const f = (data["fields"] ?? data) as Record<string, unknown>;
    const picked: Partial<FormState> = {};
    const put = (key: keyof FormState, value: string) => {
      if (value) picked[key] = value as never;
    };
    put("roll_number", asText(f["roll_number"]));
    put("full_name", asText(f["full_name"]));
    put("father_name", asText(f["father_name"]));
    put("cnic_bform", asText(f["cnic_bform"]));
    put("date_of_birth", asDate(f["date_of_birth"]));
    const gender = asText(f["gender"]).toLowerCase();
    if (gender === "male" || gender === "female") put("gender", gender);
    put("student_contact", localPhone(f["student_contact"]));
    put("guardian_contact", localPhone(f["guardian_contact"]));
    put("address", asText(f["address"]));
    put("email", asText(f["email"]));
    put("session", asText(f["session"]));
    put("section", asText(f["section"]));

    const count = Object.keys(picked).length;
    if (count === 0) {
      toast.error("Nothing could be read from that picture. Try a clearer, well-lit photo.");
      return;
    }
    setForm((prev) => ({ ...prev, ...picked }));
    toast.success(`${count} field${count === 1 ? "" : "s"} filled from the photo — please check them.`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, roll number or father name"
            className="pl-9"
          />
        </div>
        <Select value={programFilter} onValueChange={setProgramFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Program" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All programs</SelectItem>
            {programs.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        {canEdit ? (
          <Button onClick={openNew}>
            <Plus className="mr-1.5 h-4 w-4" /> New admission
          </Button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card shadow-panel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Roll #</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Father name</TableHead>
              <TableHead className="hidden sm:table-cell">Program</TableHead>
              <TableHead className="hidden lg:table-cell">Session</TableHead>
              <TableHead className="hidden lg:table-cell">Contact</TableHead>
              <TableHead>Status</TableHead>
              {canEdit ? <TableHead className="text-right">Action</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  Loading students…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  No students found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.roll_number}</TableCell>
                  <TableCell>{s.full_name}</TableCell>
                  <TableCell className="hidden md:table-cell">{s.father_name ?? "—"}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {programName(s.program_id)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">{s.session ?? "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <ContactLink
                      value={s.student_contact ?? s.guardian_contact}
                      label={s.student_contact ? "Student contact" : "Guardian contact"}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.status === "active" ? "default" : "secondary"}>
                      {STATUS_LABELS[s.status]}
                    </Badge>
                  </TableCell>
                  {canEdit ? (
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
                        Edit
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif">
              {editing ? "Edit student record" : "New admission"}
            </DialogTitle>
            <DialogDescription>
              Fields marked with * are required for the college register. You can photograph the
              admission form, CNIC or B-Form and let the app fill the details for you.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-dashed bg-muted/40 px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Auto-detect from a picture of the admission form or CNIC / B-Form.
              </p>
              <ScanButton kind="student" label="Scan form" onResult={applyScannedStudent} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Roll number *">
              <Input value={form.roll_number} onChange={(e) => set("roll_number", e.target.value)} />
            </Field>
            <Field label="Full name *">
              <Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
            </Field>
            <Field label="Father name">
              <Input value={form.father_name} onChange={(e) => set("father_name", e.target.value)} />
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
            <Field label="Photo URL">
              <Input value={form.photo_url} onChange={(e) => set("photo_url", e.target.value)} />
            </Field>
            <Field label="Program">
              <Select value={form.program_id} onValueChange={(v) => set("program_id", v)}>
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
            <Button variant="outline" onClick={() => setOpen(false)}>
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
