import { useMemo, useState } from "react";
import { CalendarDays, GraduationCap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResultSheet } from "@/components/exams/ResultSheet";
import { usePrograms } from "@/components/panels/StudentsPanel";
import { classesForProgram, useClasses } from "@/lib/classes";
import { useExams, type Exam } from "@/lib/exams";

const todayISO = () => new Date().toISOString().slice(0, 10);

/** Remembers the teacher's own class so the widget opens on their students. */
const STORE_KEY = "gdc.teacher.scope";

function loadScope() {
  if (typeof window === "undefined") return { programId: "all", classId: "all" };
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as { programId: string; classId: string };
  } catch {
    /* ignore malformed storage */
  }
  return { programId: "all", classId: "all" };
}

/**
 * Teacher dashboard widget: upcoming exams for the chosen program/class plus
 * a read-only view of the most recent result sheet.
 */
export function UpcomingExamsWidget() {
  const { data: exams = [] } = useExams();
  const { data: programs = [] } = usePrograms();
  const { data: classes = [] } = useClasses();

  const [scope, setScope] = useState(loadScope);
  const [openExam, setOpenExam] = useState<Exam | null>(null);

  const persist = (next: { programId: string; classId: string }) => {
    setScope(next);
    setOpenExam(null);
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(next));
    } catch {
      /* storage may be unavailable */
    }
  };

  /** An exam applies when it is unrestricted or matches the teacher's scope. */
  const inScope = (e: Exam) =>
    (!e.program_id || scope.programId === "all" || e.program_id === scope.programId) &&
    (!e.class_id || scope.classId === "all" || e.class_id === scope.classId);

  const today = todayISO();
  const mine = useMemo(() => exams.filter(inScope), [exams, scope]);
  const upcoming = mine
    .filter((e) => e.exam_date >= today)
    .sort((a, b) => a.exam_date.localeCompare(b.exam_date))
    .slice(0, 5);
  const latest = mine.filter((e) => e.exam_date < today)[0] ?? null;

  const scopeLabel = (e: Exam) =>
    [
      classes.find((c) => c.id === e.class_id)?.name,
      programs.find((p) => p.id === e.program_id)?.name,
    ]
      .filter(Boolean)
      .join(" · ") || "All active students";

  return (
    <section className="no-print rounded-lg border bg-card p-4 shadow-panel">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-serif text-lg">
          <CalendarDays className="h-4 w-4 text-accent" /> Upcoming examinations
        </h2>
        <div className="flex flex-wrap gap-2">
          <Select
            value={scope.programId}
            onValueChange={(v) => persist({ programId: v, classId: "all" })}
          >
            <SelectTrigger className="w-44">
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
          <Select
            value={scope.classId}
            onValueChange={(v) => persist({ ...scope, classId: v })}
            disabled={scope.programId === "all"}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All classes</SelectItem>
              {classesForProgram(classes, scope.programId).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {upcoming.length === 0 ? (
        <p className="text-sm text-muted-foreground">No exams are scheduled for this selection.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {upcoming.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <span className="font-medium">{e.name}</span>
              {e.subject ? <span className="text-muted-foreground">{e.subject}</span> : null}
              <Badge variant="secondary" className="text-[11px]">
                {scopeLabel(e)}
              </Badge>
              <span className="ml-auto whitespace-nowrap text-muted-foreground">
                {new Date(e.exam_date + "T00:00:00").toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}{" "}
                · {e.total_marks} marks
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!latest}
          onClick={() => setOpenExam(openExam ? null : latest)}
        >
          <GraduationCap className="mr-1.5 h-4 w-4" />
          {openExam ? "Hide results" : "Open latest results"}
        </Button>
        {latest ? (
          <span className="text-xs text-muted-foreground">
            Latest: {latest.name} ·{" "}
            {new Date(latest.exam_date + "T00:00:00").toLocaleDateString("en-GB")}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">No past exams for this selection.</span>
        )}
      </div>

      {openExam ? <ResultSheet exam={openExam} scope={scopeLabel(openExam)} /> : null}
    </section>
  );
}
