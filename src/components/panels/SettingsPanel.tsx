import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { usePrograms, useStudents } from "@/components/panels/StudentsPanel";
import { useFineWaiverEvents, useSessionEvents } from "@/lib/fine-waivers";
import { useStaffProfiles } from "@/lib/timetable";
import { useFeeTypes } from "@/lib/fees";
import { formatPKR, type ProgramType } from "@/lib/sms-types";
import { useCollegeLogo, uploadCollegeLogo } from "@/lib/college-assets";
import type { Profile, Role } from "@/hooks/useProfile";
import { useSessionSettings, useSessionTotals } from "@/lib/absentee-fines";


export function SettingsPanel() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <AttendanceRuleCard />
      <AbsenteeFineCard />
      <div className="lg:col-span-2">
        <SessionDashboardCard />
      </div>
      <div className="lg:col-span-2">
        <NewSessionCard />
      </div>
      <div className="lg:col-span-2">
        <SessionAuditCard />
      </div>


      <CollegeLogoCard />
      <ProgramsCard />
      <FeeTypesCard />
      <div className="lg:col-span-2">
        <StaffCard />
      </div>
    </div>
  );
}

/** Fine per absent lecture, plus the academic session the fines roll up into. */
function AbsenteeFineCard() {
  const queryClient = useQueryClient();
  const { data: settings } = useSessionSettings();
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [start, setStart] = useState("");

  const currentAmount = String(settings?.fineAmount ?? 20);
  const currentLabel = settings?.sessionLabel ?? "";
  const currentStart = settings?.sessionStart ?? "";

  const save = useMutation({
    mutationFn: async () => {
      const n = Number(amount === "" ? currentAmount : amount);
      if (!Number.isFinite(n) || n < 0) throw new Error("Enter a fine amount of zero or more");
      const nextLabel = (label === "" ? currentLabel : label).trim();
      if (!nextLabel) throw new Error("Enter a session name, e.g. 2026 Fall");
      const nextStart = start === "" ? currentStart : start;
      if (!nextStart) throw new Error("Pick the date this session started");

      const now = new Date().toISOString();
      const { error } = await supabase.from("app_settings").upsert(
        [
          { key: "absentee_fine_amount", value: String(n), updated_at: now },
          { key: "current_session_label", value: nextLabel, updated_at: now },
          { key: "session_start_date", value: nextStart, updated_at: now },
        ],
        { onConflict: "key" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Absentee fine settings updated");
      setAmount("");
      setLabel("");
      setStart("");
      void queryClient.invalidateQueries({ queryKey: ["session-settings"] });
      void queryClient.invalidateQueries({ queryKey: ["absentee_fines"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card
      title="Absentee fine"
      description="Every lecture marked Absent raises this fine automatically. Leave is never fined."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Fine per absence (PKR)</Label>
          <Input
            type="number"
            min={0}
            value={amount === "" ? currentAmount : amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Academic session</Label>
          <Input
            value={label === "" ? currentLabel : label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="2026 Fall"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Session started</Label>
          <Input
            type="date"
            value={start === "" ? currentStart : start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
      </div>
      <Button className="mt-3" disabled={save.isPending} onClick={() => save.mutate()}>
        Save
      </Button>
      <p className="mt-3 text-sm text-muted-foreground">
        Fines are billed under the <strong className="text-foreground">Absentee Fine</strong> head in
        Fees and total {formatPKR(Number(currentAmount))} per absent lecture. To close the session and
        start counting again, use <strong className="text-foreground">Start new academic session</strong>{" "}
        below.
      </p>
    </Card>
  );
}

/** Closes the running session and starts a fresh session-to-date total. */
function NewSessionCard() {
  const queryClient = useQueryClient();
  const { data: settings } = useSessionSettings();
  const [label, setLabel] = useState("");
  const [start, setStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [confirmText, setConfirmText] = useState("");

  const currentLabel = settings?.sessionLabel ?? "Current session";




  const startSession = useMutation({
    mutationFn: async () => {
      const nextLabel = label.trim();
      if (!nextLabel) throw new Error("Enter a name for the new session, e.g. 2027 Spring");
      if (nextLabel.toLowerCase() === currentLabel.toLowerCase()) {
        throw new Error("The new session must have a different name from the current one");
      }
      if (!start) throw new Error("Pick the date the new session starts");
      if (confirmText.trim().toUpperCase() !== "START") {
        throw new Error('Type START to confirm');
      }
      const now = new Date().toISOString();
      const { error } = await supabase.from("app_settings").upsert(
        [
          { key: "current_session_label", value: nextLabel, updated_at: now },
          { key: "session_start_date", value: start, updated_at: now },
        ],
        { onConflict: "key" },
      );
      if (error) throw error;

      // Audit trail: who closed which session, when, and what was archived.
      const { data: archived } = await supabase
        .from("absentee_fines")
        .select("amount")
        .eq("session_label", currentLabel);
      const { data: userData } = await supabase.auth.getUser();
      await supabase.from("session_events").insert({
        new_session_label: nextLabel,
        previous_session_label: currentLabel,
        start_date: start,
        archived_fine_count: archived?.length ?? 0,
        archived_absences: archived?.length ?? 0,
        archived_fine_amount: (archived ?? []).reduce((sum, r) => sum + Number(r.amount || 0), 0),
        started_by: userData.user?.id ?? null,
      });
      return nextLabel;
    },
    onSuccess: (nextLabel) => {
      toast.success(`${currentLabel} archived — now recording ${nextLabel}`);
      setLabel("");
      setConfirmText("");
      void queryClient.invalidateQueries({ queryKey: ["session-settings"] });
      void queryClient.invalidateQueries({ queryKey: ["absentee_fines"] });
      void queryClient.invalidateQueries({ queryKey: ["absentee-session-totals"] });
      void queryClient.invalidateQueries({ queryKey: ["fee_dues"] });
      void queryClient.invalidateQueries({ queryKey: ["session_events"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card
      title="Start new academic session"
      description="Archives the running session's absentee fines and resets every session-to-date total and report."
    >
      <div className="rounded-md border bg-muted/40 p-3 text-sm">
        Currently recording <strong>{currentLabel}</strong>
        {settings?.sessionStart ? ` since ${settings.sessionStart}` : ""}.
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>New session name</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="2027 Spring" />
        </div>
        <div className="space-y-1.5">
          <Label>Starts on</Label>
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Type START to confirm</Label>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="START" />
        </div>
      </div>

      <Button
        className="mt-3"
        disabled={startSession.isPending}
        onClick={() => startSession.mutate()}
      >
        Start new session
      </Button>

      <p className="mt-3 text-sm text-muted-foreground">
        Archived fines stay on record with their old session name and any unpaid amounts remain
        payable in Fees. Absences marked before the new start date are never re-fined.
      </p>

    </Card>
  );
}

/** Session-to-date absentee dashboard for the running and archived sessions. */
function SessionDashboardCard() {
  const { data: settings } = useSessionSettings();
  const { data: totals = [], isLoading } = useSessionTotals();
  const currentLabel = settings?.sessionLabel ?? "Current session";
  const current = totals.find((t) => t.session === currentLabel);
  const archived = totals.filter((t) => t.session !== currentLabel);

  return (
    <Card
      title="Session dashboard"
      description="Absentee fine totals for the running session and every archived session."
    >
      <div className="grid gap-3 sm:grid-cols-4">
        <Metric label="Total absences" value={String(current?.absences ?? 0)} />
        <Metric label="Fines raised" value={formatPKR(current?.raised ?? 0)} />
        <Metric label="Paid" value={formatPKR(current?.paid ?? 0)} />
        <Metric
          label="Outstanding"
          value={formatPKR(current?.outstanding ?? 0)}
          tone={(current?.outstanding ?? 0) > 0 ? "alert" : "normal"}
        />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Running session: <strong className="text-foreground">{currentLabel}</strong>
        {settings?.sessionStart ? ` since ${settings.sessionStart}` : ""}. Absences exempted from fine
        while marking attendance are excluded.
      </p>

      {isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading session totals…</p>
      ) : archived.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Archived session</TableHead>
                <TableHead className="text-right">Absences</TableHead>
                <TableHead className="text-right">Raised</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {archived.map((a) => (
                <TableRow key={a.session}>
                  <TableCell className="font-medium">{a.session}</TableCell>
                  <TableCell className="text-right">{a.absences}</TableCell>
                  <TableCell className="text-right">{formatPKR(a.raised)}</TableCell>
                  <TableCell className="text-right">{formatPKR(a.paid)}</TableCell>
                  <TableCell className="text-right">{formatPKR(a.outstanding)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">No archived sessions yet.</p>
      )}
    </Card>
  );
}

/** Audit trail of session starts and of every fine waiver granted. */
function SessionAuditCard() {
  const { data: events = [], isLoading } = useSessionEvents();
  const { data: waivers = [] } = useFineWaiverEvents(null);
  const { data: staff = [] } = useStaffProfiles();
  const { data: students = [] } = useStudents();

  const who = (id: string | null) => staff.find((s) => s.id === id)?.full_name ?? "—";
  const studentName = (id: string) => {
    const s = students.find((x) => x.id === id);
    return s ? `${s.roll_number} · ${s.full_name}` : "—";
  };
  const when = (iso: string) => new Date(iso).toLocaleString();

  return (
    <Card
      title="Audit trail"
      description="Who started each academic session, what was archived, and every absentee fine waiver granted."
    >
      <h3 className="text-sm font-semibold">Session starts</h3>
      {isLoading ? (
        <p className="mt-2 text-sm text-muted-foreground">Loading audit trail…</p>
      ) : events.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          No session has been started from this screen yet.
        </p>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Started</TableHead>
                <TableHead>By</TableHead>
                <TableHead>New session</TableHead>
                <TableHead>Archived session</TableHead>
                <TableHead className="text-right">Fines archived</TableHead>
                <TableHead className="text-right">Amount archived</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap">
                    {when(e.created_at)}
                    <span className="block text-xs text-muted-foreground">
                      starts {e.start_date}
                    </span>
                  </TableCell>
                  <TableCell>{who(e.started_by)}</TableCell>
                  <TableCell className="font-medium">{e.new_session_label}</TableCell>
                  <TableCell>{e.previous_session_label ?? "—"}</TableCell>
                  <TableCell className="text-right">{e.archived_fine_count}</TableCell>
                  <TableCell className="text-right">{formatPKR(e.archived_fine_amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <h3 className="mt-6 text-sm font-semibold">Fine waivers</h3>
      {waivers.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No fines have been waived yet.</p>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Session</TableHead>
                <TableHead className="text-right">Waived</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {waivers.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="whitespace-nowrap">{when(w.created_at)}</TableCell>
                  <TableCell>{who(w.performed_by)}</TableCell>
                  <TableCell>{studentName(w.student_id)}</TableCell>
                  <TableCell>{w.session_label}</TableCell>
                  <TableCell className="text-right">{formatPKR(w.amount)}</TableCell>
                  <TableCell>{w.reason || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="mt-3 text-sm text-muted-foreground">
        Waiving a fine only clears the money owed — the absence itself stays on the student's
        attendance record.
      </p>
    </Card>
  );
}

function Metric({
  label,
  value,
  tone = "normal",
}: {
  label: string;
  value: string;
  tone?: "normal" | "alert";
}) {
  return (
    <div className="rounded-md border bg-muted/40 p-3">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
      <p
        className={
          tone === "alert"
            ? "font-serif text-lg font-semibold text-destructive"
            : "font-serif text-lg font-semibold"
        }
      >
        {value}
      </p>
    </div>
  );
}



export function useAbsenceThreshold() {
  return useQuery({
    queryKey: ["setting", "consecutive_absence_threshold"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "consecutive_absence_threshold")
        .maybeSingle();
      if (error) throw error;
      return Number(data?.value ?? 15);
    },
  });
}

function AttendanceRuleCard() {
  const queryClient = useQueryClient();
  const { data: threshold } = useAbsenceThreshold();
  const [value, setValue] = useState("");

  const current = String(threshold ?? 15);

  const save = useMutation({
    mutationFn: async () => {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1) throw new Error("Enter a whole number of days, 1 or more");
      const { error } = await supabase
        .from("app_settings")
        .upsert(
          { key: "consecutive_absence_threshold", value: String(n), updated_at: new Date().toISOString() },
          { onConflict: "key" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Strike-off rule updated");
      setValue("");
      void queryClient.invalidateQueries({ queryKey: ["setting", "consecutive_absence_threshold"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card
      title="Attendance rule"
      description="A student is struck off automatically once they reach this many consecutive absences."
    >
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label>Consecutive absences allowed</Label>
          <Input
            type="number"
            min={1}
            className="w-36"
            value={value === "" ? current : value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <Button disabled={save.isPending || value === "" || value === current} onClick={() => save.mutate()}>
          Save
        </Button>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Currently set to <strong className="text-foreground">{current}</strong> consecutive absences.
        Struck-off students drop out of the daily attendance list automatically and appear under
        Struck off for readmission.
      </p>
    </Card>
  );
}

function Card({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-5 shadow-panel">
      <h2 className="font-serif text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="crest-rule mt-3 mb-4 w-16" />
      {children}
    </section>
  );
}

function ProgramsCard() {
  const queryClient = useQueryClient();
  const { data: programs = [] } = usePrograms();
  const [name, setName] = useState("");
  const [type, setType] = useState<ProgramType>("stream");

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("programs").insert({ name: name.trim(), type });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Program added");
      setName("");
      void queryClient.invalidateQueries({ queryKey: ["programs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("programs").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["programs"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card title="Programs" description="Streams and associate degree programs offered by the college.">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1 space-y-1.5">
          <Label>Program name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. AD Physics" />
        </div>
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as ProgramType)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stream">Stream</SelectItem>
              <SelectItem value="ad_program">AD program</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button disabled={!name.trim() || add.isPending} onClick={() => add.mutate()}>
          Add
        </Button>
      </div>

      <Table className="mt-4">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Active</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {programs.map((p) => (
            <TableRow key={p.id}>
              <TableCell>{p.name}</TableCell>
              <TableCell>{p.type === "stream" ? "Stream" : "AD program"}</TableCell>
              <TableCell className="text-right">
                <Switch
                  checked={p.active}
                  onCheckedChange={(active) => toggle.mutate({ id: p.id, active })}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function FeeTypesCard() {
  const queryClient = useQueryClient();
  const { data: feeTypes = [] } = useFeeTypes();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("fee_types")
        .insert({ name: name.trim(), default_amount: Number(amount || 0) });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fee head added");
      setName("");
      setAmount("");
      void queryClient.invalidateQueries({ queryKey: ["fee_types"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("fee_types").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["fee_types"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card title="Fee heads" description="Define the fee categories used when recording payments.">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1 space-y-1.5">
          <Label>Fee head</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Admission fee" />
        </div>
        <div className="space-y-1.5">
          <Label>Default amount</Label>
          <Input
            type="number"
            className="w-36"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <Button disabled={!name.trim() || add.isPending} onClick={() => add.mutate()}>
          Add
        </Button>
      </div>

      <Table className="mt-4">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Default</TableHead>
            <TableHead className="text-right">Active</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {feeTypes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                No fee heads defined yet.
              </TableCell>
            </TableRow>
          ) : (
            feeTypes.map((f) => (
              <TableRow key={f.id}>
                <TableCell>{f.name}</TableCell>
                <TableCell>{formatPKR(Number(f.default_amount))}</TableCell>
                <TableCell className="text-right">
                  <Switch
                    checked={f.active}
                    onCheckedChange={(active) => toggle.mutate({ id: f.id, active })}
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}

function StaffCard() {
  const queryClient = useQueryClient();
  const { data: staff = [] } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, phone, created_at")
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const setRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: Role }) => {
      const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role updated");
      void queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card title="Staff accounts" description="Assign administrator or teacher access to college staff.">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="hidden sm:table-cell">Phone</TableHead>
            <TableHead className="text-right">Role</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {staff.map((p) => (
            <TableRow key={p.id}>
              <TableCell>{p.full_name || "Unnamed staff"}</TableCell>
              <TableCell className="hidden sm:table-cell">{p.phone ?? "—"}</TableCell>
              <TableCell className="text-right">
                <Select value={p.role} onValueChange={(v) => setRole.mutate({ id: p.id, role: v as Role })}>
                  <SelectTrigger className="ml-auto w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrator</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function CollegeLogoCard() {
  const queryClient = useQueryClient();
  const { data: logo } = useCollegeLogo();
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      await uploadCollegeLogo(file);
      toast.success("College logo updated");
      await queryClient.invalidateQueries({ queryKey: ["college-logo"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="College logo"
      description="Appears on the letterhead of every printed fee receipt."
    >
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-md border bg-muted text-[10px] text-muted-foreground">
          {logo ? (
            <img src={logo} alt="College logo" className="h-full w-full object-contain" />
          ) : (
            "No logo"
          )}
        </span>
        <div className="space-y-1.5">
          <Label htmlFor="college-logo">Upload logo (PNG or JPG)</Label>
          <Input
            id="college-logo"
            type="file"
            accept="image/*"
            disabled={busy}
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
        </div>
      </div>
    </Card>
  );
}
