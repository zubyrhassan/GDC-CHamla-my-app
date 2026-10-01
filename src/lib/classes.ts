import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type ClassSession = "Spring" | "Fall";

export type ClassRow = {
  id: string;
  name: string;
  active: boolean;
  program_id: string | null;
  semester_number: number | null;
  session: string | null;
};

/** Lookup list of classes: grades for streams, semesters for AD programs. */
export function useClasses() {
  return useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, active, program_id, semester_number, session")
        .order("name");
      if (error) throw error;
      return (data ?? []) as ClassRow[];
    },
  });
}

/** A semester-based class belongs to an associate-degree program. */
export function isSemesterClass(c: Pick<ClassRow, "semester_number">) {
  return c.semester_number != null;
}

/** "Semester 2 (Fall)" for AD classes; plain name for grades. */
export function buildClassName(semester: number, session: ClassSession) {
  return `Semester ${semester} (${session})`;
}

/** Classes belonging to one program (classes without a program are shared/legacy). */
export function classesForProgram(classes: ClassRow[], programId: string | null) {
  if (!programId || programId === "all") return classes.filter((c) => c.program_id == null);
  return classes.filter((c) => c.program_id === programId || c.program_id == null);
}

/**
 * A class may only be used with the program it belongs to.
 * Classes with no program are legacy/shared and accepted anywhere.
 */
export function classMatchesProgram(
  cls: Pick<ClassRow, "program_id"> | null | undefined,
  programId: string | null,
) {
  if (!cls) return true;
  if (cls.program_id == null) return true;
  return cls.program_id === programId;
}

/** Human label for a class, including its semester intake when relevant. */
export function classDetail(c: ClassRow | null | undefined) {
  if (!c) return "";
  if (c.semester_number != null) {
    return `Semester ${c.semester_number}${c.session ? ` (${c.session})` : ""}`;
  }
  return c.name;
}
