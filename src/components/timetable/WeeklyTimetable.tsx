import { useMemo } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useClasses } from "@/lib/classes";
import { DAY_NAMES, WORK_DAYS, formatTime, useStaffProfiles, useTimetable } from "@/lib/timetable";
import { cn } from "@/lib/utils";

/**
 * Weekly grid of a class's lectures — day by day, with the teacher assigned to
 * each slot. Pass a classId to show one class, or omit it to show every class.
 */
export function WeeklyTimetable({
  classId,
  title = "Weekly timetable",
  description,
}: {
  classId?: string | null;
  title?: string;
  description?: string;
}) {
  const { data: slots = [], isLoading } = useTimetable();
  const { data: classes = [] } = useClasses();
  const { data: staff = [] } = useStaffProfiles();

  const teacherName = (id: string | null) =>
    staff.find((s) => s.id === id)?.full_name ?? (id ? "Assigned staff" : "Not assigned");

  const shown = useMemo(
    () => (classId ? slots.filter((s) => s.class_id === classId) : slots),
    [slots, classId],
  );

  const classIds = useMemo(() => {
    if (classId) return [classId];
    return [...new Set(shown.map((s) => s.class_id))];
  }, [shown, classId]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Loading timetable…</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-lg">{title}</CardTitle>
        <CardDescription>
          {description ?? "Each class's week at a glance, with the teacher taking every lecture."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {classIds.length === 0 ? (
          <p className="text-sm text-muted-foreground">No lectures have been scheduled yet.</p>
        ) : (
          classIds.map((cid) => {
            const rows = shown.filter((s) => s.class_id === cid);
            const label = classes.find((c) => c.id === cid)?.name ?? "Class";
            return (
              <section key={cid} className="space-y-2">
                {classId ? null : <h3 className="font-serif text-base font-semibold">{label}</h3>}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {WORK_DAYS.map((day) => {
                    const daySlots = rows
                      .filter((s) => s.day_of_week === day)
                      .sort((a, b) => a.start_time.localeCompare(b.start_time));
                    return (
                      <div
                        key={day}
                        className={cn(
                          "rounded-md border p-3",
                          daySlots.length === 0 ? "bg-muted/40" : "bg-card",
                        )}
                      >
                        <p className="mb-2 text-[11px] font-semibold tracking-wide uppercase text-muted-foreground">
                          {DAY_NAMES[day]}
                        </p>
                        {daySlots.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No lectures</p>
                        ) : (
                          <ul className="space-y-2">
                            {daySlots.map((s) => (
                              <li key={s.id} className="border-l-2 border-primary/50 pl-2">
                                <p className="text-sm font-medium">
                                  {s.subject || `Lecture ${s.lecture_number}`}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatTime(s.start_time)}
                                  {s.end_time ? ` – ${formatTime(s.end_time)}` : ""}
                                  {s.room ? ` · Room ${s.room}` : ""}
                                </p>
                                <p className="text-xs">{teacherName(s.teacher_profile_id)}</p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
