import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBlocker } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileDown,
  Lock,
  MoreHorizontal,
  Plus,
  PhoneCall,
  Printer,
  ScanLine,
  Radio,
  Save,
  Star,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BulkAttendanceDialog } from "@/components/attendance/BulkAttendanceDialog";
import { ContactLink } from "@/components/ContactLink";
import { StudentSummaryButton } from "@/components/students/StudentSummaryReport";
import { StudentStatsSection } from "@/components/students/StudentCharts";
import { ClassAttendanceChart } from "@/components/charts/ClassAttendanceChart";
import { supabase } from "@/integrations/supabase/client";
import { usePrograms, useStudents } from "@/components/panels/StudentsPanel";
import { classDetail, classesForProgram, isSemesterClass, useClasses } from "@/lib/classes";
import { downloadCsv, toCsv } from "@/lib/fees";
import { PrintFrame, downloadTablePdf, usePrintable } from "@/lib/print";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StudentAvatar, StudentPhoto } from "@/lib/student-photo";
import { usePermissions } from "@/lib/permissions";
import { useMyClasses, useSaveMyClass } from "@/lib/teacher-classes";
import { cn } from "@/lib/utils";
import { gradeFor } from "@/lib/exams";
import type { AttendanceStatus, Student } from "@/lib/sms-types";

/** Slides the action bar out of the way while scrolling down the roster. */
function useAutoHideBar() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const atBottom = y + window.innerHeight >= document.body.scrollHeight - 24;
      if (atBottom || y < 80) setHidden(false);
      else if (y > last + 8) setHidden(true);
      else if (y < last - 8) setHidden(false);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return hidden;
}

export const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

function shiftDate(dateStr: string, days: number) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysAgo(dateStr: string) {
  const a = new Date(dateStr + "T00:00:00").getTime();
  const b = new Date(todayISO() + "T00:00:00").getTime();
  return Math.round((b - a) / 86400000);
}

function longDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function shortDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}


const byRoll = (a: Student, b: Student) =>
  a.roll_number.localeCompare(b.roll_number, undefined, { numeric: true, sensitivity: "base" });

type Record_ = {
  id: string;
  student_id: string;
  date: string;
  status: AttendanceStatus;
  lecture_number: number;
  fine_exempt: boolean;
};

/** Live attendance rows for a date range, kept fresh with a realtime subscription. */
function useAttendanceRange(from: string, to: string) {
  const queryClient = useQueryClient();
  const key = ["attendance-range", from, to] as const;

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("id, student_id, date, status, lecture_number, fine_exempt")
        .gte("date", from)
        .lte("date", to);
      if (error) throw error;
      return (data ?? []) as Record_[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`attendance-${from}-${to}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_records" },
        () => {
          void queryClient.invalidateQueries({ queryKey: key });
          void queryClient.invalidateQueries({ queryKey: ["attendance-totals"] });
          void queryClient.invalidateQueries({ queryKey: ["students"] });
          void queryClient.invalidateQueries({ queryKey: ["absentee_fines"] });
        },

      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, queryClient]);

  return query;
}

/** Present/absent tallies per student across the whole record, leave excluded. */
function useAttendanceTotals() {
  return useQuery({
    queryKey: ["attendance-totals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("student_id, status");
      if (error) throw error;
      const totals: Record<string, { present: number; counted: number }> = {};
      for (const r of (data ?? []) as { student_id: string; status: AttendanceStatus }[]) {
        if (r.status === "leave") continue;
        const t = (totals[r.student_id] ??= { present: 0, counted: 0 });
        t.counted++;
        if (r.status === "present") t.present++;
      }
      return totals;
    },
  });
}

export function AttendanceSection({
  initialProgramId,
  initialClassId,
  initialLecture,
}: {
  /** Preselect a program/class, e.g. when opened from a saved class. */
  initialProgramId?: string | undefined;
  initialClassId?: string | undefined;
  /** Preselect the lecture number, e.g. when opened from the timetable. */
  initialLecture?: number | undefined;
}) {
  const [tab, setTab] = useState("day");

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList className="no-print">
        <TabsTrigger value="day">Day view</TabsTrigger>
        <TabsTrigger value="register">Monthly register</TabsTrigger>
      </TabsList>
      <TabsContent value="day">
        <DayView
          initialProgramId={initialProgramId}
          initialClassId={initialClassId}
          initialLecture={initialLecture}
        />
      </TabsContent>
      <TabsContent value="register">
        <RegisterView />
      </TabsContent>
    </Tabs>
  );
}

/* ------------------------------- Day view -------------------------------- */

function DayView({
  initialProgramId,
  initialClassId,
  initialLecture,
}: {
  initialProgramId?: string | undefined;
  initialClassId?: string | undefined;
  initialLecture?: number | undefined;
}) {
  const queryClient = useQueryClient();
  const perms = usePermissions();
  const { data: students = [] } = useStudents();
  const { data: programs = [] } = usePrograms();
  const { data: classes = [] } = useClasses();
  const { data: totals = {} } = useAttendanceTotals();
  const saveMyClass = useSaveMyClass();
  const { data: myClasses = [] } = useMyClasses();

  const [date, setDate] = useState(todayISO);
  const [programId, setProgramId] = useState(initialProgramId ?? "all");
  const [classId, setClassId] = useState(initialClassId ?? "all");
  const [lecture, setLecture] = useState(initialLecture ?? 1);
  const barHidden = useAutoHideBar();
  /** Local, unsaved marks. Nothing is written to the database until "Save attendance". */
  const [draft, setDraft] = useState<
    Record<string, { status: AttendanceStatus; fineExempt: boolean }>
  >({});
  const [detailStudent, setDetailStudent] = useState<Student | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [confirmedClassId, setConfirmedClassId] = useState<string | null>(null);
  const alreadySaved = myClasses.some(
    (m) => m.program_id === programId && m.class_id === classId,
  );

  const programClasses = classesForProgram(classes, programId);
  const selectedClass = classes.find((c) => c.id === classId) ?? null;
  const selectedProgram = programs.find((p) => p.id === programId) ?? null;
  /** Semester intakes repeat across sessions — make the teacher confirm the batch. */
  const awaitingConfirm = Boolean(
    selectedClass && isSemesterClass(selectedClass) && confirmedClassId !== selectedClass.id,
  );

  const age = daysAgo(date);
  /** No marking rights means the register is view-only, regardless of the date. */
  const canMark = perms.can("attendance", "add") || perms.can("attendance", "edit");
  const locked = age < 0 || (!perms.isSuperAdmin && age > 3) || !canMark;

  const { data: records = [], isLoading } = useAttendanceRange(date, date);


  /** Lecture numbers that already have marks on this date. */
  const takenLectures = useMemo(() => {
    const set = new Set<number>();
    for (const r of records) set.add(r.lecture_number);
    return [...set].sort((a, b) => a - b);
  }, [records]);

  const lectureOptions = useMemo(() => {
    const set = new Set<number>([1, ...takenLectures, lecture]);
    return [...set].sort((a, b) => a - b);
  }, [takenLectures, lecture]);

  /** Marks already stored in the database for this date + lecture. */
  const saved = useMemo(() => {
    const m: Record<string, { status: AttendanceStatus; fineExempt: boolean }> = {};
    for (const r of records) {
      if (r.lecture_number === lecture)
        m[r.student_id] = { status: r.status, fineExempt: Boolean(r.fine_exempt) };
    }
    return m;
  }, [records, lecture]);

  const marks = useMemo(() => {
    const m: Record<string, AttendanceStatus> = {};
    for (const [id, v] of Object.entries(saved)) m[id] = v.status;
    for (const [id, v] of Object.entries(draft)) m[id] = v.status;
    return m;
  }, [saved, draft]);

  /** Absences flagged as exempt from the automatic absentee fine. */
  const exemptions = useMemo(() => {
    const m: Record<string, boolean> = {};
    for (const [id, v] of Object.entries(saved)) m[id] = v.fineExempt;
    for (const [id, v] of Object.entries(draft)) m[id] = v.fineExempt;
    return m;
  }, [saved, draft]);

  /** Draft entries that actually differ from what is stored. */
  const dirtyIds = useMemo(
    () =>
      Object.keys(draft).filter((id) => {
        const s = saved[id];
        const d = draft[id]!;
        return !s || s.status !== d.status || s.fineExempt !== d.fineExempt;
      }),
    [draft, saved],
  );
  const hasUnsaved = dirtyIds.length > 0;

  useEffect(() => {
    setDraft({});
    setLecture(1);
  }, [date]);

  /** Any change of program, class, date or lecture requires a fresh confirmation. */
  useEffect(() => {
    setConfirmedClassId(null);
  }, [programId, classId, date, lecture]);

  useEffect(() => {
    setDraft({});
  }, [lecture]);

  /** Warn before the browser unloads the page with unsaved marks. */
  useEffect(() => {
    if (!hasUnsaved) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "You have unsaved attendance — leave anyway?";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsaved]);

  /** Confirm before navigating within the app with unsaved marks. */
  useBlocker({
    shouldBlockFn: () =>
      hasUnsaved && !window.confirm("You have unsaved attendance — leave anyway?"),
    enableBeforeUnload: false,
  });


  const roster = useMemo(
    () =>
      awaitingConfirm
        ? []
        : students
            .filter(
              (s) =>
                s.status === "active" &&
                (programId === "all" || s.program_id === programId) &&
                (classId === "all" || s.class_id === classId),
            )
            .sort(byRoll),
    [students, programId, classId, awaitingConfirm],
  );

  /** Local-only mark. Nothing is written until the teacher presses "Save attendance". */
  const setMark = (ids: string[], status: AttendanceStatus, fineExempt?: boolean) => {
    if (ids.length === 0) return;
    setDraft((d) => {
      const next = { ...d };
      for (const id of ids) {
        next[id] = {
          status,
          fineExempt:
            status === "absent"
              ? (fineExempt ?? next[id]?.fineExempt ?? saved[id]?.fineExempt ?? false)
              : false,
        };
      }
      return next;
    });
  };

  /** Writes every unsaved mark for this lecture in one batch. */
  const saveAll = useMutation({
    mutationFn: async () => {
      const groups = new Map<string, { status: AttendanceStatus; fineExempt: boolean; ids: string[] }>();
      for (const id of dirtyIds) {
        const d = draft[id]!;
        const key = `${d.status}|${d.fineExempt}`;
        const g = groups.get(key) ?? { status: d.status, fineExempt: d.fineExempt, ids: [] };
        g.ids.push(id);
        groups.set(key, g);
      }
      for (const g of groups.values()) {
        const { error } = await supabase.rpc("save_attendance", {
          _student_ids: g.ids,
          _date: date,
          _status: g.status,
          _lecture_number: lecture,
          _fine_exempt: g.fineExempt,
        });
        if (error) throw error;
      }
      return dirtyIds.length;
    },
    onError: (e: Error) => toast.error(e.message),
    onSuccess: async (count) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["attendance-range", date, date] }),
        queryClient.invalidateQueries({ queryKey: ["attendance-totals"] }),
        queryClient.invalidateQueries({ queryKey: ["absentee_fines"] }),
        queryClient.invalidateQueries({ queryKey: ["fee_dues"] }),
      ]);
      setDraft({});
      toast.success(
        `Attendance saved for Lecture ${lecture} — ${count} student${count === 1 ? "" : "s"} recorded`,
      );
    },
  });

  const summary = useMemo(() => {
    let present = 0;
    let absent = 0;
    let leave = 0;
    for (const s of roster) {
      if (marks[s.id] === "present") present++;
      else if (marks[s.id] === "absent") absent++;
      else if (marks[s.id] === "leave") leave++;
    }
    return { present, absent, leave, unmarked: roster.length - present - absent - leave };
  }, [roster, marks]);

  const programLabel = selectedProgram?.name ?? "All programs";
  const classLabel = selectedClass ? classDetail(selectedClass) : "All classes";

  const statusLabel = (s: AttendanceStatus | undefined) =>
    s === "present" ? "Present" : s === "absent" ? "Absent" : s === "leave" ? "Leave" : "Unmarked";

  const exportCsv = () => {
    if (roster.length === 0) {
      toast.error("There is nothing to export in this selection.");
      return;
    }
    const rows: (string | number)[][] = [
      ["Government Degree College Chamla, Buner"],
      ["Attendance roster", longDate(date), `Lecture ${lecture}`],
      ["Program", programLabel, "Class", classLabel],
      [],
      ["Roll No", "Name", "Program", "Class", "Session", "Status", "Overall %"],
      ...roster.map((s) => {
        const t = totals[s.id];
        return [
          s.roll_number,
          s.full_name,
          programs.find((p) => p.id === s.program_id)?.name ?? "",
          classes.find((c) => c.id === s.class_id)?.name ?? "",
          s.session ?? "",
          statusLabel(marks[s.id]),
          t && t.counted > 0 ? `${Math.round((t.present / t.counted) * 100)}%` : "—",
        ];
      }),
    ];
    downloadCsv(`attendance-${date}-lecture-${lecture}.csv`, toCsv(rows));
  };

  const absentees = useMemo(
    () => roster.filter((s) => marks[s.id] === "absent"),
    [roster, marks],
  );

  const rosterPrint = usePrintable(`Attendance ${date} lecture ${lecture}`);
  const absentPrint = usePrintable(`Absentees ${date} lecture ${lecture}`);
  const absentTitle = `Absentees — ${shortDate(date)}, Lecture ${lecture}`;

  const printSheet = (mode: "roster" | "absent") => {
    if (mode === "absent") {
      if (absentees.length === 0) {
        toast.error("No absentees for this lecture.");
        return;
      }
      absentPrint.print();
      return;
    }
    if (roster.length === 0) {
      toast.error("There is nothing to print in this selection.");
      return;
    }
    rosterPrint.print();
  };

  const rosterPdf = () => {
    if (roster.length === 0) {
      toast.error("There is nothing to export in this selection.");
      return;
    }
    downloadTablePdf({
      title: `Attendance Roster — ${shortDate(date)}, Lecture ${lecture}`,
      subtitles: [`${programLabel} · ${classLabel}`],
      head: ["Roll No", "Name", "Program", "Class", "Status", "Overall %"],
      rows: roster.map((s) => {
        const t = totals[s.id];
        return [
          s.roll_number,
          s.full_name,
          programs.find((p) => p.id === s.program_id)?.name ?? "",
          classes.find((c) => c.id === s.class_id)?.name ?? "",
          statusLabel(marks[s.id]),
          t && t.counted > 0 ? `${Math.round((t.present / t.counted) * 100)}%` : "—",
        ];
      }),
      filename: `attendance-${date}-lecture-${lecture}.pdf`,
    });
  };

  const absentPdf = () => {
    if (absentees.length === 0) {
      toast.error("No absentees for this lecture.");
      return;
    }
    downloadTablePdf({
      title: absentTitle,
      subtitles: [
        `${programLabel} · ${classLabel}`,
        `${absentees.length} absent of ${roster.length}`,
      ],
      head: ["Roll No", "Name", "Program", "Class", "Guardian contact"],
      rows: absentees.map((s) => [
        s.roll_number,
        s.full_name,
        programs.find((p) => p.id === s.program_id)?.name ?? "—",
        classes.find((c) => c.id === s.class_id)?.name ?? "—",
        s.guardian_contact ?? "—",
      ]),
      filename: `absentees-${date}-lecture-${lecture}.pdf`,
    });
  };


  const startNewLecture = () => {
    const next = (takenLectures.length ? Math.max(...takenLectures) : 0) + 1;
    setLecture(next);
    toast.success(`Lecture ${next} started`);
  };

  return (
    <div className="space-y-4 pb-36 sm:pb-28">
      <div className="no-print flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4 shadow-panel">
        <div className="space-y-1.5">
          <Label className="text-xs tracking-wide text-muted-foreground uppercase">Date</Label>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous day"
              onClick={() => setDate((d) => shiftDate(d, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value || todayISO())}
              className="w-40"
            />
            <Button
              variant="outline"
              size="icon"
              aria-label="Next day"
              disabled={age <= 0}
              onClick={() => setDate((d) => shiftDate(d, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs tracking-wide text-muted-foreground uppercase">Lecture</Label>
          <div className="flex items-center gap-1">
            <Select value={String(lecture)} onValueChange={(v) => setLecture(Number(v))}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {lectureOptions.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    Lecture {n}
                    {takenLectures.includes(n) ? "" : " (new)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" disabled={locked} onClick={startNewLecture}>
              <Plus className="h-4 w-4" /> New
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs tracking-wide text-muted-foreground uppercase">Program</Label>
          <Select
            value={programId}
            onValueChange={(v) => {
              setProgramId(v);
              setClassId("all");
              setConfirmedClassId(null);
            }}
          >
            <SelectTrigger className="w-52">
              <SelectValue />
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
        </div>
      </div>

      {programId === "all" ? (
        <p className="no-print text-xs text-muted-foreground">
          Choose a program above to pick one of its classes.
        </p>
      ) : programClasses.length > 0 ? (
        <ClassChips
          classes={programClasses}
          value={classId}
          onChange={(id) => {
            setClassId(id);
            setConfirmedClassId(null);
          }}
        />
      ) : null}

      <p className="text-sm text-muted-foreground">
        {longDate(date)} · Lecture {lecture} ·{" "}
        {age === 0 ? "today" : `${age} day${age === 1 ? "" : "s"} ago`}
      </p>

      {!canMark ? (
        <p className="no-print flex items-center gap-2 rounded-md border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
          <Lock className="h-4 w-4 shrink-0" />
          You can view this register but not mark attendance.
        </p>
      ) : null}

      {locked && canMark ? (
        <p className="no-print flex items-center gap-2 rounded-md border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
          <Lock className="h-4 w-4 shrink-0" />
          This register is older than three days and is locked. Please contact the administrator to
          correct it.
        </p>
      ) : null}

      <div className="sticky top-0 z-30 -mx-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-y bg-background/95 px-4 py-2 text-sm text-muted-foreground backdrop-blur sm:static sm:mx-0 sm:gap-4 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
        <span className="text-xs sm:text-sm">
          Present: <strong className="text-foreground">{summary.present}</strong>
        </span>
        <span className="text-xs sm:text-sm">
          Absent: <strong className="text-foreground">{summary.absent}</strong>
        </span>
        <span className="text-xs sm:text-sm">
          Leave: <strong className="text-foreground">{summary.leave}</strong>
        </span>
        <span className="text-xs sm:text-sm">
          Unmarked: <strong className="text-foreground">{summary.unmarked}</strong>
        </span>
        <span className="flex items-center gap-1.5 text-xs">
          <Radio className="h-3.5 w-3.5 text-accent" /> Live
          <span className="hidden sm:inline"> — updates as colleagues mark</span>
        </span>
      </div>


      {!awaitingConfirm && roster.length > 0 ? (
        <ClassAttendanceChart
          studentIds={roster.map((s) => s.id)}
          label={classLabel === "All classes" ? programLabel : classLabel}
        />
      ) : null}

      <div className="no-print divide-y rounded-lg border bg-card shadow-panel">

        {awaitingConfirm ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Confirm the semester batch to load the student list.
          </p>
        ) : isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading register…</p>
        ) : roster.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            No active students in this selection.
          </p>
        ) : (
          roster.map((s) => (
            <StudentRow
              key={s.id}
              student={s}
              status={marks[s.id]}
              fineExempt={Boolean(exemptions[s.id])}
              locked={locked || saveAll.isPending}
              unsaved={dirtyIds.includes(s.id)}
              overall={totals[s.id]}
              onMark={(status) => setMark([s.id], status)}
              onToggleExempt={() => setMark([s.id], "absent", !exemptions[s.id])}
              onOpen={() => setDetailStudent(s)}
            />
          ))
        )}
      </div>

      {absentees.length > 0 ? (
        <div className="no-print rounded-lg border bg-card shadow-panel">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
            <h3 className="font-serif text-base font-semibold">{absentTitle}</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => printSheet("absent")}>
                <Printer className="mr-1.5 h-4 w-4" /> Print
              </Button>
              <Button variant="outline" size="sm" onClick={absentPdf}>
                <FileDown className="mr-1.5 h-4 w-4" /> PDF
              </Button>
            </div>
          </div>
          <ul className="divide-y">

            {absentees.map((s) => (
              <li
                key={s.id}
                className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.roll_number}
                    {s.father_name ? ` · s/o ${s.father_name}` : ""}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setDetailStudent(s)}>
                  View details
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="no-print rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground shadow-panel">
          No absentees for this lecture.
        </p>
      )}

      <div
        className={cn(
          "no-print fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 px-3 py-2.5 shadow-[0_-2px_12px_hsl(var(--foreground)/0.08)] backdrop-blur transition-transform duration-200",
          barHidden ? "translate-y-[130%]" : "translate-y-0",
        )}
      >
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-2">
          {hasUnsaved ? (
            <span className="rounded-full border border-accent bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent-foreground">
              Unsaved changes ({dirtyIds.length})
            </span>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none"
            disabled={locked || roster.length === 0 || saveAll.isPending}
            onClick={() => setMark(roster.map((s) => s.id), "present")}
          >
            Mark all present
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none"
            disabled={locked || roster.length === 0 || saveAll.isPending}
            onClick={() =>
              setMark(
                roster.filter((s) => !marks[s.id]).map((s) => s.id),
                "absent",
              )
            }
          >
            Rest absent
          </Button>
          <Button
            size="sm"
            className={cn("flex-1 sm:flex-none", hasUnsaved && "animate-pulse")}
            disabled={locked || !hasUnsaved || saveAll.isPending}
            onClick={() => saveAll.mutate()}
          >
            <Save className="mr-1.5 h-4 w-4" />
            {saveAll.isPending ? "Saving…" : `Save attendance${hasUnsaved ? ` (${dirtyIds.length})` : ""}`}
          </Button>


          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="shrink-0">
                <MoreHorizontal className="mr-1.5 h-4 w-4" /> More
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-60">
              <DropdownMenuItem disabled={!canMark} onSelect={() => setBulkOpen(true)}>
                <ScanLine className="mr-2 h-4 w-4" /> Bulk upload (PDF / photo)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Print &amp; export</DropdownMenuLabel>
              <DropdownMenuItem disabled={roster.length === 0} onSelect={() => printSheet("roster")}>
                <Printer className="mr-2 h-4 w-4" /> Print register
              </DropdownMenuItem>
              <DropdownMenuItem disabled={roster.length === 0} onSelect={() => rosterPdf()}>
                <FileDown className="mr-2 h-4 w-4" /> Register PDF
              </DropdownMenuItem>
              <DropdownMenuItem disabled={roster.length === 0} onSelect={() => exportCsv()}>
                <Download className="mr-2 h-4 w-4" /> Roster CSV
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Absentees ({absentees.length})</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => printSheet("absent")}>
                <PhoneCall className="mr-2 h-4 w-4" /> Print absentee list
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => absentPdf()}>
                <FileDown className="mr-2 h-4 w-4" /> Absentees PDF
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={
                  programId === "all" || classId === "all" || alreadySaved || saveMyClass.isPending
                }
                onSelect={() =>
                  saveMyClass.mutate(
                    { program_id: programId, class_id: classId },
                    {
                      onSuccess: () => toast.success("Saved to my classes"),
                      onError: (e) =>
                        toast.error(e instanceof Error ? e.message : "Could not save"),
                    },
                  )
                }
              >
                <Star className={cn("mr-2 h-4 w-4", alreadySaved && "fill-current")} />
                {alreadySaved ? "Saved class" : "Save class"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {bulkOpen ? (
        <BulkAttendanceDialog
          open
          onOpenChange={setBulkOpen}
          students={students}
          programs={programs}
          classes={classes}
          defaultProgramId={programId}
          defaultClassId={classId}
          defaultDate={date}
          defaultLecture={lecture}
        />
      ) : null}

      <PrintFrame innerRef={rosterPrint.ref}>
        <div className="print-header">
          <h2>Government Degree College Chamla, Buner</h2>
          <p>
            Attendance Roster — {longDate(date)} · Lecture {lecture}
          </p>
          <p>
            {programLabel} · {classLabel}
          </p>
        </div>
        <table className="print-table">
          <thead>
            <tr>
              <th>Roll No</th>
              <th>Name</th>
              <th>Program</th>
              <th>Class</th>
              <th>Status</th>
              <th>Overall %</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((s) => {
              const t = totals[s.id];
              return (
                <tr key={s.id}>
                  <td>{s.roll_number}</td>
                  <td>{s.full_name}</td>
                  <td>{programs.find((p) => p.id === s.program_id)?.name ?? ""}</td>
                  <td>{classes.find((c) => c.id === s.class_id)?.name ?? ""}</td>
                  <td>{statusLabel(marks[s.id])}</td>
                  <td>
                    {t && t.counted > 0 ? `${Math.round((t.present / t.counted) * 100)}%` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </PrintFrame>

      <PrintFrame innerRef={absentPrint.ref}>
        <div className="print-header">
          <h2>Government Degree College Chamla, Buner</h2>
          <p>{absentTitle}</p>
          <p>
            {programLabel} · {classLabel} · {absentees.length} absent of {roster.length}
          </p>
        </div>
        {absentees.length === 0 ? (
          <p style={{ textAlign: "center" }}>No absentees for this lecture.</p>
        ) : (
          <table className="print-table">
            <thead>
              <tr>
                <th>Roll No</th>
                <th>Name</th>
                <th>Program</th>
                <th>Class</th>
                <th>Guardian contact</th>
              </tr>
            </thead>
            <tbody>
              {absentees.map((s) => (
                <tr key={s.id}>
                  <td>{s.roll_number}</td>
                  <td>{s.full_name}</td>
                  <td>{programs.find((p) => p.id === s.program_id)?.name ?? "—"}</td>
                  <td>{classes.find((c) => c.id === s.class_id)?.name ?? "—"}</td>
                  <td>{s.guardian_contact ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PrintFrame>


      <AlertDialog
        open={awaitingConfirm}
        onOpenChange={(o) => {
          if (!o) setClassId("all");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Confirm the class</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to take attendance for {selectedProgram?.name ?? "this program"} —
              Semester {selectedClass?.semester_number} ({selectedClass?.session}). Is this correct?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setClassId("all")}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => setConfirmedClassId(selectedClass?.id ?? null)}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TeacherStudentDetail
        student={detailStudent}
        programName={
          detailStudent
            ? programs.find((program) => program.id === detailStudent.program_id)?.name ?? "—"
            : ""
        }
        className={
          detailStudent
            ? classes.find((classItem) => classItem.id === detailStudent.class_id)?.name ?? "—"
            : ""
        }
        overall={detailStudent ? totals[detailStudent.id] : undefined}
        onClose={() => setDetailStudent(null)}
      />
    </div>
  );
}

function ClassChips({
  classes,
  value,
  onChange,
}: {
  classes: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const chips = [{ id: "all", name: "All classes" }, ...classes];
  return (
    <div className="no-print flex flex-wrap gap-2">
      {chips.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onChange(c.id)}
          className={
            value === c.id
              ? "rounded-full border border-primary bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
              : "rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/10"
          }
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}

const MARK_BUTTONS: { status: AttendanceStatus; letter: string; label: string; on: string }[] = [
  {
    status: "present",
    letter: "P",
    label: "Present",
    on: "border-primary bg-primary text-primary-foreground",
  },
  {
    status: "absent",
    letter: "A",
    label: "Absent",
    on: "border-destructive bg-destructive text-destructive-foreground",
  },
  { status: "leave", letter: "L", label: "Leave", on: "border-accent bg-accent text-accent-foreground" },
];

function StudentRow({
  student,
  status,
  fineExempt,
  locked,
  unsaved = false,
  overall,
  onMark,
  onToggleExempt,
  onOpen,
}: {
  student: Student;
  status: AttendanceStatus | undefined;
  fineExempt: boolean;
  locked: boolean;
  unsaved?: boolean;
  overall?: { present: number; counted: number } | undefined;
  onMark: (status: AttendanceStatus) => void;
  onToggleExempt: () => void;
  onOpen: () => void;
}) {
  const pct = overall && overall.counted ? Math.round((overall.present / overall.counted) * 100) : null;

  return (
    <div className={cn("px-3 py-3 sm:px-4", unsaved && "border-l-2 border-l-accent bg-accent/5")}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">

        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
          <StudentAvatar
            path={student.photo_url}
            name={student.full_name}
            className="h-10 w-10 shrink-0"
          />
          <div className="min-w-0">
            <Button
              type="button"
              variant="link"
              className="h-auto max-w-full justify-start truncate p-0 text-left text-sm font-medium"
              onClick={onOpen}
            >
              {student.full_name}
            </Button>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">Roll {student.roll_number}</p>
            {student.section ? (
              <p className="truncate text-xs text-muted-foreground">Section {student.section}</p>
            ) : null}
          </div>
          <div className="w-14 shrink-0 border-l pl-2 text-right">
            <p
              className={cn(
                "font-serif text-sm font-semibold tabular-nums",
                pct === null
                  ? "text-muted-foreground"
                  : pct < 75
                    ? "text-destructive"
                    : "text-foreground",
              )}
            >
              {pct === null ? "—" : `${pct}%`}
            </p>
            <p className="text-[10px] tracking-wide text-muted-foreground uppercase">Overall</p>
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-1.5">
          {MARK_BUTTONS.map((b) => (
            <button
              key={b.status}
              type="button"
              disabled={locked}
              aria-label={`${b.label} — ${student.full_name}`}
              aria-pressed={status === b.status}
              onClick={() => onMark(b.status)}
              className={cn(
                "h-11 flex-1 rounded-md border font-serif text-lg font-bold transition-colors disabled:opacity-40 sm:w-11 sm:flex-none",
                status === b.status ? b.on : "bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {b.letter}
            </button>
          ))}
        </div>
      </div>

      {status === "absent" ? (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            disabled={locked}
            aria-pressed={fineExempt}
            onClick={onToggleExempt}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40",
              fineExempt
                ? "border-accent bg-accent/15 text-accent-foreground"
                : "bg-background text-muted-foreground hover:bg-muted",
            )}
          >
            {fineExempt ? "Fine waived — tap to charge" : "Exempt from fine"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

type StudentResult = {
  id: string;
  marks_obtained: number;
  remarks: string | null;
  exams: {
    name: string;
    subject: string | null;
    total_marks: number;
    exam_date: string;
  } | null;
};

function TeacherStudentDetail({
  student,
  programName,
  className,
  overall,
  onClose,
}: {
  student: Student | null;
  programName: string;
  className: string;
  overall?: { present: number; counted: number } | undefined;
  onClose: () => void;
}) {
  const studentId = student?.id;
  const { data: results = [], isLoading } = useQuery({
    queryKey: ["teacher-student-results", studentId],
    enabled: Boolean(studentId),
    queryFn: async () => {
      if (!studentId) return [];
      const { data, error } = await supabase
        .from("exam_results")
        .select("id, marks_obtained, remarks, exams(name, subject, total_marks, exam_date)")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as StudentResult[];
    },
  });

  if (!student) return null;
  const percentage = overall?.counted
    ? Math.round((overall.present / overall.counted) * 100)
    : null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif">{student.full_name}</DialogTitle>
          <DialogDescription>
            Roll {student.roll_number} · {programName} · {className}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <StudentPhoto path={student.photo_url} name={student.full_name} className="h-28 w-24" />
          <div className="grid min-w-0 flex-1 gap-3 xs:grid-cols-2">
            <DetailItem label="Attendance" value={percentage === null ? "No records" : `${percentage}%`} />
            <DetailItem label="Status" value={student.status.replace("_", " ")} />
            <DetailItem label="Father's name" value={student.father_name} />
            <DetailItem label="Session / section" value={[student.session, student.section].filter(Boolean).join(" · ")} />
          </div>
        </div>

        <div className="grid gap-3 border-y py-4 xs:grid-cols-2">
          <div className="min-w-0">
            <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Student phone</p>
            <ContactLink value={student.student_contact} label="Student phone" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Guardian phone</p>
            <ContactLink value={student.guardian_contact} label="Guardian phone" />
          </div>
          <DetailItem label="Email" value={student.email} />
          <DetailItem label="Address" value={student.address} />
        </div>

        <section>
          <h3 className="font-serif text-base font-semibold">Exam results</h3>
          {isLoading ? (
            <p className="mt-2 text-sm text-muted-foreground">Loading results…</p>
          ) : results.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No exam marks recorded yet.</p>
          ) : (
            <div className="mt-2 divide-y rounded-md border">
              {results.map((result) => {
                const exam = result.exams;
                const pct = exam && exam.total_marks > 0
                  ? (Number(result.marks_obtained) / Number(exam.total_marks)) * 100
                  : null;
                return (
                  <div key={result.id} className="grid gap-2 px-3 py-3 xs:grid-cols-[minmax(0,1fr)_auto] xs:items-center">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{exam?.name ?? "Exam"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[exam?.subject, exam?.exam_date].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="text-left xs:text-right">
                      <p className="font-medium tabular-nums">
                        {result.marks_obtained} / {exam?.total_marks ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {pct === null ? "—" : `${pct.toFixed(1)}% · ${gradeFor(pct)}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <StudentStatsSection studentId={student.id} />

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <StudentSummaryButton
            student={student}
            programName={programName}
            classLabel={className}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="break-words text-sm capitalize">{value || "—"}</p>
    </div>
  );
}

/* ---------------------------- Monthly register ---------------------------- */

function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y!, m! - 1, 1));
  const last = new Date(Date.UTC(y!, m!, 0));
  return {
    from: first.toISOString().slice(0, 10),
    to: last.toISOString().slice(0, 10),
    days: last.getUTCDate(),
  };
}

function RegisterView() {
  const { data: students = [] } = useStudents();
  const { data: programs = [] } = usePrograms();
  const { data: classes = [] } = useClasses();
  const [month, setMonth] = useState(() => todayISO().slice(0, 7));
  const [programId, setProgramId] = useState("all");
  const [classId, setClassId] = useState("all");

  const { from, to, days } = monthBounds(month);
  const { data: records = [] } = useAttendanceRange(from, to);

  const roster = useMemo(
    () =>
      students
        .filter(
          (s) =>
            s.status !== "left" &&
            (programId === "all" || s.program_id === programId) &&
            (classId === "all" || s.class_id === classId),
        )
        .sort(byRoll),
    [students, programId, classId],
  );

  /** The register represents one mark per day, so only Lecture 1 counts. */
  const lookup = useMemo(() => {
    const m = new Map<string, AttendanceStatus>();
    for (const r of records) {
      if (r.lecture_number !== 1) continue;
      m.set(`${r.student_id}|${r.date}`, r.status);
    }
    return m;
  }, [records]);

  const dayNumbers = Array.from({ length: days }, (_, i) => i + 1);
  const cell = (studentId: string, day: number) =>
    lookup.get(`${studentId}|${month}-${String(day).padStart(2, "0")}`);

  const programName =
    programId === "all"
      ? "All programs"
      : (programs.find((p) => p.id === programId)?.name ?? "All programs");
  const monthLabel = new Date(from + "T00:00:00").toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
  const registerPrint = usePrintable(`Monthly attendance ${monthLabel}`, true);

  const registerRows = () =>
    roster.map((s) => {
      const ms = dayNumbers.map((d) => cell(s.id, d));
      return [
        s.roll_number,
        s.full_name,
        ...ms.map((m) => (m === "present" ? "P" : m === "absent" ? "A" : m === "leave" ? "L" : "")),
        String(ms.filter((m) => m === "present").length),
        String(ms.filter((m) => m === "absent").length),
        String(ms.filter((m) => m === "leave").length),
      ];
    });

  const registerPdf = () => {
    if (roster.length === 0) {
      toast.error("There is nothing to export in this selection.");
      return;
    }
    downloadTablePdf({
      title: `Monthly Attendance Register — ${monthLabel}`,
      subtitles: [programName],
      head: ["Roll #", "Name", ...dayNumbers.map(String), "P", "A", "L"],
      rows: registerRows(),
      filename: `attendance-register-${month}.pdf`,
      landscape: true,
    });
  };

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4 shadow-panel">
        <div className="space-y-1.5">
          <Label className="text-xs tracking-wide text-muted-foreground uppercase">Month</Label>
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value || todayISO().slice(0, 7))}
            className="w-44"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs tracking-wide text-muted-foreground uppercase">Program</Label>
          <Select
            value={programId}
            onValueChange={(v) => {
              setProgramId(v);
              setClassId("all");
            }}
          >
            <SelectTrigger className="w-52">
              <SelectValue />
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
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:ml-auto sm:flex sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            className="sm:h-10"
            disabled={roster.length === 0}
            onClick={registerPrint.print}
          >
            <Printer className="mr-1.5 h-4 w-4" /> Print
            <span className="hidden sm:ml-1 sm:inline">register</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="sm:h-10"
            disabled={roster.length === 0}
            onClick={registerPdf}
          >
            <FileDown className="mr-1.5 h-4 w-4" /> PDF
          </Button>
        </div>

      </div>

      {programId === "all" ? (
        <p className="no-print text-xs text-muted-foreground">
          Choose a program above to pick one of its classes.
        </p>
      ) : classesForProgram(classes, programId).length > 0 ? (
        <ClassChips
          classes={classesForProgram(classes, programId)}
          value={classId}
          onChange={setClassId}
        />
      ) : null}

      <p className="no-print text-xs text-muted-foreground sm:hidden">
        Swipe the register sideways to see every date. Roll numbers stay pinned.
      </p>

      <div
        ref={registerPrint.ref}
        className="print-register-wrap overflow-x-auto rounded-lg border bg-card shadow-panel"
      >
        <div className="print-header print-only hidden">

          <h2>Government Degree College Chamla, Buner</h2>
          <p>
            Monthly Attendance Register — {monthLabel} · {programName}
          </p>
        </div>
        <table className="print-table w-full border-collapse text-xs">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="sticky left-0 z-10 bg-muted/40 px-2 py-2 text-left font-medium">
                Roll #
              </th>
              <th className="hidden px-2 py-2 text-left font-medium sm:table-cell print:table-cell">
                Name
              </th>
              {dayNumbers.map((d) => (
                <th key={d} className="w-6 px-1 py-2 text-center font-medium">
                  {d}
                </th>
              ))}
              <th className="px-2 py-2 text-center font-medium">P</th>
              <th className="px-2 py-2 text-center font-medium">A</th>
              <th className="px-2 py-2 text-center font-medium">L</th>
            </tr>
          </thead>
          <tbody>
            {roster.length === 0 ? (
              <tr>
                <td colSpan={days + 5} className="py-10 text-center text-muted-foreground">
                  No students in this selection.
                </td>
              </tr>
            ) : (
              roster.map((s) => {
                const marks = dayNumbers.map((d) => cell(s.id, d));
                const p = marks.filter((m) => m === "present").length;
                const a = marks.filter((m) => m === "absent").length;
                const l = marks.filter((m) => m === "leave").length;
                return (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="sticky left-0 z-10 bg-card px-2 py-1.5 whitespace-nowrap">
                      {s.roll_number}
                    </td>
                    <td className="hidden px-2 py-1.5 whitespace-nowrap sm:table-cell print:table-cell">
                      {s.full_name}
                    </td>
                    {marks.map((m, i) => (
                      <td
                        key={i}
                        className={
                          "px-1 py-1.5 text-center " +
                          (m === "absent" ? "text-destructive" : "text-foreground")
                        }
                      >
                        {m === "present" ? "✓" : m === "absent" ? "✗" : m === "leave" ? "L" : ""}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-center font-medium">{p}</td>
                    <td className="px-2 py-1.5 text-center font-medium">{a}</td>
                    <td className="px-2 py-1.5 text-center font-medium">{l}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
