import { useMemo } from "react";

import { AttendanceTrendChart } from "@/components/charts/AttendanceTrendChart";
import { averagePercentage, useClassAttendanceDays } from "@/lib/analytics";

/**
 * Attendance trend + running average for a whole class roster.
 * Shares the Daily / Weekly / Monthly toggle used elsewhere.
 */
export function ClassAttendanceChart({
  studentIds,
  label,
}: {
  studentIds: string[];
  label?: string | undefined;
}) {
  const { data: days = [], isLoading } = useClassAttendanceDays(studentIds);
  const average = useMemo(() => averagePercentage(days), [days]);

  if (studentIds.length === 0) return null;

  return (
    <div className="no-print relative">
      <AttendanceTrendChart
        days={days}
        title={label ? `Class attendance — ${label}` : "Class attendance"}
        description={
          isLoading
            ? "Loading the class register…"
            : `Average this session: ${average === null ? "—" : `${average}%`} across ${studentIds.length} student${studentIds.length === 1 ? "" : "s"}. The dashed line marks the 75% requirement.`
        }
      />
    </div>
  );
}
