import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";

import { supabase } from "@/integrations/supabase/client";

export type Exam = {
  id: string;
  name: string;
  subject: string | null;
  total_marks: number;
  exam_date: string;
  class_id: string | null;
  program_id: string | null;
  created_by: string | null;
  created_at: string;
  /** Set when the results are confirmed — marks entry is locked from then on. */
  finalized_at: string | null;
  finalized_by: string | null;
};

export type ExamResult = {
  id: string;
  exam_id: string;
  student_id: string;
  marks_obtained: number;
  remarks: string | null;
  exam_subject_id: string | null;
};

/**
 * Grade cutoffs, highest first. Edit these values (or add bands) to change the
 * grading scale — nothing else in the app hard-codes a grade letter.
 */
export const GRADE_SCALE: { min: number; grade: string }[] = [
  { min: 80, grade: "A+" },
  { min: 70, grade: "A" },
  { min: 60, grade: "B" },
  { min: 50, grade: "C" },
  { min: 40, grade: "D" },
  { min: 0, grade: "F" },
];

export function gradeFor(percentage: number) {
  return GRADE_SCALE.find((b) => percentage >= b.min)?.grade ?? "F";
}

export function useExams() {
  return useQuery({
    queryKey: ["exams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exams")
        .select("*")
        .order("exam_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Exam[];
    },
  });
}

export function useExam(examId: string) {
  return useQuery({
    queryKey: ["exam", examId],
    enabled: Boolean(examId),
    queryFn: async () => {
      const { data, error } = await supabase.from("exams").select("*").eq("id", examId).single();
      if (error) throw error;
      return data as Exam;
    },
  });
}

export function useExamResults(examId: string) {
  return useQuery({
    queryKey: ["exam-results", examId],
    enabled: Boolean(examId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_results")
        .select("id, exam_id, student_id, marks_obtained, remarks, exam_subject_id")
        .eq("exam_id", examId);
      if (error) throw error;
      return (data ?? []) as ExamResult[];
    },
  });
}

export type ResultSheetRow = {
  roll_number: string;
  full_name: string;
  marks: number | null;
};

/** Downloads the open exam's result sheet as a formatted .xlsx workbook. */
export function exportExamResults(
  exam: Pick<Exam, "name" | "subject" | "total_marks" | "exam_date">,
  rows: ResultSheetRow[],
  scope: string,
) {
  const total = exam.total_marks;
  const body = rows.map((r) => {
    const pct = r.marks !== null && total > 0 ? (r.marks / total) * 100 : null;
    return {
      "Roll No.": r.roll_number,
      Name: r.full_name,
      "Marks Obtained": r.marks ?? "",
      Total: total,
      "%": pct === null ? "" : Number(pct.toFixed(1)),
      Grade: pct === null ? "" : gradeFor(pct),
    };
  });

  const sheet = XLSX.utils.aoa_to_sheet([
    ["Government Degree College Chamla, District Buner"],
    [`Result Sheet — ${exam.name}${exam.subject ? ` (${exam.subject})` : ""}`],
    [
      `Date: ${new Date(exam.exam_date + "T00:00:00").toLocaleDateString("en-GB")}`,
      `Total marks: ${total}`,
      `Scope: ${scope}`,
    ],
    [],
  ]);
  XLSX.utils.sheet_add_json(sheet, body, {
    origin: "A5",
    header: ["Roll No.", "Name", "Marks Obtained", "Total", "%", "Grade"],
  });
  sheet["!cols"] = [{ wch: 14 }, { wch: 28 }, { wch: 16 }, { wch: 10 }, { wch: 8 }, { wch: 8 }];

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Results");
  const safe = exam.name.replace(/[^\w\-]+/g, "-");
  XLSX.writeFile(book, `GDC-Chamla-results-${safe}-${exam.exam_date}.xlsx`);
}
