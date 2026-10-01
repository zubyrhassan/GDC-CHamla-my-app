import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { ABSENTEE_FEE_TYPE, useSessionSettings } from "@/lib/absentee-fines";
import { gradeFor } from "@/lib/exams";
import { currentMonthStart, monthStart, monthsInclusive } from "@/lib/hostel";
import type { AttendanceStatus } from "@/lib/sms-types";

export type SummaryExamRow = {
  name: string;
  subject: string | null;
  exam_date: string;
  marks: number;
  total: number;
  percentage: number | null;
  grade: string;
};

export type MoneyBlock = { due: number; paid: number; outstanding: number; status: string };

export type StudentSummary = {
  sessionLabel: string;
  attendance: {
    lectures: number;
    present: number;
    absent: number;
    leave: number;
    percentage: number | null;
  };
  fines: { accrued: number; paid: number; outstanding: number };
  tuition: MoneyBlock;
  hostelFees: MoneyBlock | null;
  exams: SummaryExamRow[];
  struckOff: { date: string; reason: string } | null;
  hostel: { room: string; bed: number; admission_date: string } | null;
};

function statusOf(due: number, paid: number) {
  if (due <= 0) return paid > 0 ? "Paid" : "No dues";
  if (paid <= 0) return "Unpaid";
  return paid >= due ? "Paid" : "Partial";
}

/** Everything the one-page student report needs, read from existing tables. */
export function useStudentSummary(studentId: string | null | undefined) {
  const { data: settings } = useSessionSettings();
  const sessionLabel = settings?.sessionLabel ?? "Current session";
  const sessionStart = settings?.sessionStart ?? null;

  return useQuery({
    queryKey: ["student-summary", studentId, sessionLabel, sessionStart],
    enabled: Boolean(studentId) && Boolean(settings),
    queryFn: async (): Promise<StudentSummary> => {
      const id = studentId!;

      let attendanceQuery = supabase
        .from("attendance_records")
        .select("status, date")
        .eq("student_id", id);
      if (sessionStart) attendanceQuery = attendanceQuery.gte("date", sessionStart);

      const [attRes, finesRes, duesRes, txRes, examRes, strikeRes, allotRes] = await Promise.all([
        attendanceQuery,
        supabase
          .from("absentee_fines")
          .select("amount, waived_amount")
          .eq("student_id", id)
          .eq("session_label", sessionLabel),
        supabase.from("fee_dues").select("id, amount, fee_type_id, fee_types(name)").eq("student_id", id),
        supabase.from("fee_transactions").select("amount, fee_due_id, fee_type_id").eq("student_id", id),
        supabase
          .from("exam_results")
          .select("marks_obtained, exams(name, subject, total_marks, exam_date), exam_subjects(name, total_marks)")
          .eq("student_id", id),
        supabase
          .from("struck_off_events")
          .select("struck_off_date, reason, reinstated")
          .eq("student_id", id)
          .order("struck_off_date", { ascending: false })
          .limit(1),
        supabase
          .from("hostel_allotments")
          .select("id, bed_number, admission_date, status, hostel_rooms(room_number, block)")
          .eq("student_id", id)
          .eq("status", "active")
          .limit(1),
      ]);

      for (const res of [attRes, finesRes, duesRes, txRes, examRes, strikeRes, allotRes]) {
        if (res.error) throw res.error;
      }

      const records = (attRes.data ?? []) as { status: AttendanceStatus }[];
      const present = records.filter((r) => r.status === "present").length;
      const absent = records.filter((r) => r.status === "absent").length;
      const leave = records.filter((r) => r.status === "leave").length;
      const counted = present + absent;

      const fineAccrued = (finesRes.data ?? []).reduce(
        (s, f) => s + Math.max(Number(f.amount || 0) - Number(f.waived_amount || 0), 0),
        0,
      );

      type DueRow = { id: string; amount: number; fee_types: { name: string } | null };
      const dues = (duesRes.data ?? []) as unknown as DueRow[];
      const payments = (txRes.data ?? []) as { amount: number; fee_due_id: string | null }[];

      const isFine = (name?: string | null) =>
        (name ?? "").toLowerCase() === ABSENTEE_FEE_TYPE.toLowerCase();
      const fineDueIds = new Set(dues.filter((d) => isFine(d.fee_types?.name)).map((d) => d.id));

      const tuitionDue = dues
        .filter((d) => !fineDueIds.has(d.id))
        .reduce((s, d) => s + Number(d.amount || 0), 0);
      let tuitionPaid = 0;
      let finePaid = 0;
      for (const p of payments) {
        if (p.fee_due_id && fineDueIds.has(p.fee_due_id)) finePaid += Number(p.amount || 0);
        else tuitionPaid += Number(p.amount || 0);
      }

      type ExamRow = {
        marks_obtained: number;
        exams: { name: string; subject: string | null; total_marks: number; exam_date: string } | null;
        exam_subjects: { name: string; total_marks: number } | null;
      };
      const exams: SummaryExamRow[] = ((examRes.data ?? []) as unknown as ExamRow[])
        .filter((r) => r.exams)
        .map((r) => {
          const exam = r.exams!;
          const paper = r.exam_subjects;
          const total = Number(paper?.total_marks ?? exam.total_marks ?? 0);
          const marks = Number(r.marks_obtained || 0);
          const pct = total > 0 ? (marks / total) * 100 : null;
          return {
            name: exam.name,
            subject: paper?.name ?? exam.subject,
            exam_date: exam.exam_date,
            marks,
            total,
            percentage: pct,
            grade: pct === null ? "—" : gradeFor(pct),
          };
        })
        .sort((a, b) => b.exam_date.localeCompare(a.exam_date));

      const strike = (strikeRes.data ?? [])[0] as
        | { struck_off_date: string; reason: string; reinstated: boolean }
        | undefined;

      type AllotRow = {
        id: string;
        bed_number: number;
        admission_date: string;
        hostel_rooms: { room_number: string; block: string } | null;
      };
      const allot = ((allotRes.data ?? []) as unknown as AllotRow[])[0];

      let hostelFees: MoneyBlock | null = null;
      if (allot) {
        const [hfRes, feeRes] = await Promise.all([
          supabase.from("hostel_fee_transactions").select("amount").eq("allotment_id", allot.id),
          supabase.from("app_settings").select("value").eq("key", "hostel_monthly_fee").maybeSingle(),
        ]);
        if (hfRes.error) throw hfRes.error;
        if (feeRes.error) throw feeRes.error;
        const monthly = Number(feeRes.data?.value ?? 3000) || 3000;
        const due = monthsInclusive(monthStart(allot.admission_date), currentMonthStart()) * monthly;
        const paid = (hfRes.data ?? []).reduce((s, r) => s + Number(r.amount || 0), 0);
        hostelFees = {
          due,
          paid,
          outstanding: Math.max(due - paid, 0),
          status: statusOf(due, paid),
        };
      }

      return {
        sessionLabel,
        attendance: {
          lectures: records.length,
          present,
          absent,
          leave,
          percentage: counted ? Math.round((present / counted) * 100) : null,
        },
        fines: {
          accrued: fineAccrued,
          paid: finePaid,
          outstanding: Math.max(fineAccrued - finePaid, 0),
        },
        tuition: {
          due: tuitionDue,
          paid: tuitionPaid,
          outstanding: Math.max(tuitionDue - tuitionPaid, 0),
          status: statusOf(tuitionDue, tuitionPaid),
        },
        hostelFees,
        exams,
        struckOff:
          strike && !strike.reinstated
            ? { date: strike.struck_off_date, reason: strike.reason }
            : null,
        hostel: allot
          ? {
              room: [allot.hostel_rooms?.block, allot.hostel_rooms?.room_number]
                .filter(Boolean)
                .join("-"),
              bed: allot.bed_number,
              admission_date: allot.admission_date,
            }
          : null,
      };
    },
  });
}
