import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const ASSET_BUCKET = "college-assets";
export const LOGO_SETTING_KEY = "college_logo_url";

/** Returns a signed URL for the uploaded college logo, or null when none is set. */
export function useCollegeLogo() {
  return useQuery({
    queryKey: ["college-logo"],
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", LOGO_SETTING_KEY)
        .maybeSingle();
      if (error) throw error;
      const path = data?.value?.trim();
      if (!path) return null;
      if (path.startsWith("http")) return path;
      const signed = await supabase.storage.from(ASSET_BUCKET).createSignedUrl(path, 60 * 60);
      return signed.data?.signedUrl ?? null;
    },
  });
}

export async function uploadCollegeLogo(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const path = `logo/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(ASSET_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { error: settingError } = await supabase
    .from("app_settings")
    .upsert(
      { key: LOGO_SETTING_KEY, value: path, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (settingError) throw settingError;
  return path;
}
