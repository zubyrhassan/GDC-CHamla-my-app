import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type ExamSubject = {
  id: string;
  exam_id: string;
  name: string;
  total_marks: number;
  display_order: number;
};

const COLUMNS = "id, exam_id, name, total_marks, display_order";

/** Subject papers that make up one session exam. */
export function useExamSubjects(examId: string | null | undefined) {
  return useQuery({
    queryKey: ["exam-subjects", examId],
    enabled: Boolean(examId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_subjects")
        .select(COLUMNS)
        .eq("exam_id", examId!)
        .order("display_order")
        .order("name");
      if (error) throw error;
      return (data ?? []) as ExamSubject[];
    },
  });
}

export function useSaveExamSubject(examId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string; name: string; total_marks: number; display_order?: number }) => {
      const payload = {
        exam_id: examId,
        name: input.name.trim(),
        total_marks: input.total_marks,
        display_order: input.display_order ?? 0,
      };
      if (input.id) {
        const { error } = await supabase.from("exam_subjects").update(payload).eq("id", input.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("exam_subjects").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["exam-subjects", examId] });
      void queryClient.invalidateQueries({ queryKey: ["exam-results", examId] });
    },
  });
}

export function useDeleteExamSubject(examId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("exam_subjects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["exam-subjects", examId] });
      void queryClient.invalidateQueries({ queryKey: ["exam-results", examId] });
    },
  });
}
