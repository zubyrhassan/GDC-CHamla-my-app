import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarCheck, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { classDetail, useClasses } from "@/lib/classes";
import { DAY_NAMES, WORK_DAYS, formatTime, useMyTimetable } from "@/lib/timetable";
import { cn } from "@/lib/utils";

/**
 * "My timetable" — the lectures assigned to the signed-in teacher. Tapping a
 * lecture opens attendance for that class and lecture number straight away.
 */
export function TimetableWidget({ basePath = "/teacher" }: { basePath?: string }) {
  const { data: slots = [], isLoading } = useMyTimetable();
  const { data: classes = [] } = useClasses();
  const today = new Date().getDay();
  const [day, setDay] = useState(today);

  const dayDays = useMemo(() => [0, ...WORK_DAYS].sort((a, b) => a - b), []);
  const visible = slots.filter((s) => s.day_of_week === day);

  return (
    <section className="rounded-lg border bg-card shadow-panel">
      <div className="border-b px-4 py-3">
        <h2 className="font-serif text-base font-semibold">My timetable</h2>
        <p className="text-xs text-muted-foreground">
          Lectures assigned to you — tap one to mark its attendance.
        </p>
      </div>

      <div className="no-print flex gap-1.5 overflow-x-auto border-b px-4 py-2 [scrollbar-width:none]">
        {dayDays.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDay(d)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              d === day
                ? "border-primary bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent/10",
            )}
          >
            {DAY_NAMES[d]?.slice(0, 3)}
            {d === today ? " •" : ""}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">Loading your timetable…</p>
      ) : visible.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          No lectures scheduled for {DAY_NAMES[day]}. The administration sets the timetable.
        </p>
      ) : (
        <ul className="divide-y">
          {visible.map((s) => {
            const cls = classes.find((c) => c.id === s.class_id);
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {s.subject || "Lecture"} · {classDetail(cls) || "Class"}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {formatTime(s.start_time)}
                    {s.end_time ? ` – ${formatTime(s.end_time)}` : ""} · Lecture {s.lecture_number}
                    {s.room ? ` · Room ${s.room}` : ""}
                  </p>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <Link
                    to={`${basePath}/attendance` as "/teacher/attendance"}
                    search={{
                      program: s.program_id ?? cls?.program_id ?? "",
                      class: s.class_id,
                      lecture: s.lecture_number,
                    }}
                  >
                    <CalendarCheck className="mr-1.5 h-4 w-4" /> Attendance
                  </Link>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
