import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type TimetableSlot = {
  id: string;
  class_id: string;
  program_id: string | null;
  teacher_profile_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string | null;
  subject: string | null;
  lecture_number: number;
  room: string | null;
};

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const WORK_DAYS = [1, 2, 3, 4, 5, 6];

/** "09:30:00" -> "9:30 AM" */
export function formatTime(value: string | null) {
  if (!value) return "";
  const [h = "0", m = "00"] = value.split(":");
  const hour = Number(h);
  const suffix = hour >= 12 ? "PM" : "AM";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}:${m} ${suffix}`;
}

const SLOT_COLUMNS =
  "id, class_id, program_id, teacher_profile_id, day_of_week, start_time, end_time, subject, lecture_number, room";

/** Full college timetable (readable by every signed-in staff member). */
export function useTimetable() {
  return useQuery({
    queryKey: ["class_timetable"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_timetable")
        .select(SLOT_COLUMNS)
        .order("day_of_week")
        .order("start_time");
      if (error) throw error;
      return (data ?? []) as TimetableSlot[];
    },
  });
}

export function useSaveTimetableSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<TimetableSlot> & { class_id: string; day_of_week: number; start_time: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const payload = {
        class_id: input.class_id,
        program_id: input.program_id ?? null,
        teacher_profile_id: input.teacher_profile_id ?? null,
        day_of_week: input.day_of_week,
        start_time: input.start_time,
        end_time: input.end_time ?? null,
        subject: input.subject ?? null,
        lecture_number: input.lecture_number ?? 1,
        room: input.room ?? null,
      };
      if (input.id) {
        const { error } = await supabase.from("class_timetable").update(payload).eq("id", input.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("class_timetable")
        .insert({ ...payload, created_by: userData.user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["class_timetable"] });
    },
  });
}

export function useDeleteTimetableSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("class_timetable").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["class_timetable"] });
    },
  });
}

/** Timetable rows for the signed-in teacher only. */
export function useMyTimetable() {
  return useQuery({
    queryKey: ["my-timetable"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return [] as TimetableSlot[];
      const { data, error } = await supabase
        .from("class_timetable")
        .select(SLOT_COLUMNS)
        .eq("teacher_profile_id", uid)
        .order("day_of_week")
        .order("start_time");
      if (error) throw error;
      return (data ?? []) as TimetableSlot[];
    },
  });
}

/** Staff profiles that can be given a class or a timetable slot. */
export function useStaffProfiles() {
  return useQuery({
    queryKey: ["staff-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as { id: string; full_name: string; role: string }[];
    },
  });
}

/** Every saved class assignment, across all staff (admin view). */
export function useAllTeacherClasses() {
  return useQuery({
    queryKey: ["teacher_classes", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_classes")
        .select("id, profile_id, program_id, class_id, label, created_at")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Admin action: assign a class to any staff member. */
export function useAssignClassToTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { profile_id: string; program_id: string; class_id: string }) => {
      const { error } = await supabase
        .from("teacher_classes")
        .upsert(input, { onConflict: "profile_id,program_id,class_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["teacher_classes"] });
      void queryClient.invalidateQueries({ queryKey: ["my-classes"] });
    },
  });
}

export function useUnassignClassFromTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("teacher_classes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["teacher_classes"] });
      void queryClient.invalidateQueries({ queryKey: ["my-classes"] });
    },
  });
}
