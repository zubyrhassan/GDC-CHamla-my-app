import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type TeacherClass = {
  id: string;
  profile_id: string;
  program_id: string | null;
  class_id: string | null;
  label: string | null;
  created_at: string;
};

/** Classes the signed-in staff member has saved as "my classes". */
export function useMyClasses() {
  return useQuery({
    queryKey: ["my-classes"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return [] as TeacherClass[];
      const { data, error } = await supabase
        .from("teacher_classes")
        .select("id, profile_id, program_id, class_id, label, created_at")
        .eq("profile_id", uid)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as TeacherClass[];
    },
  });
}

/** Saves a class to "my classes"; duplicates are ignored by the database. */
export function useSaveMyClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { program_id: string; class_id: string; label?: string | null }) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("You are signed out.");
      const { error } = await supabase.from("teacher_classes").upsert(
        {
          profile_id: uid,
          program_id: input.program_id,
          class_id: input.class_id,
          label: input.label ?? null,
        },
        { onConflict: "profile_id,program_id,class_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-classes"] }),
  });
}

export function useRemoveMyClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("teacher_classes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-classes"] }),
  });
}
