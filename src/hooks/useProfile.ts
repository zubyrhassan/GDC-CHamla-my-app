import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Role =
  | "super_admin"
  | "admin"
  | "principal"
  | "coe"
  | "coordinator"
  | "clerk"
  | "teacher";

export type Profile = {
  id: string;
  full_name: string;
  role: Role;
  phone: string | null;
  created_at: string;
};

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<Profile | null> => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, phone, created_at")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return (data as Profile | null) ?? null;
    },
  });
}
