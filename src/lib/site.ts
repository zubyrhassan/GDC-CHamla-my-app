import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const SITE_BUCKET = "site-media";

export type SiteSettings = {
  id: string;
  college_name: string;
  logo_url: string | null;
  whatsapp_number: string | null;
  whatsapp_default_message: string | null;
  facebook_page_url: string;
};

export type Banner = {
  id: string;
  image_url: string;
  title: string | null;
  subtitle: string | null;
  display_order: number;
  is_active: boolean;
};

export type GalleryPhoto = {
  id: string;
  image_url: string;
  caption: string | null;
  display_order: number;
  is_active: boolean;
};

export type FacultyMember = {
  id: string;
  name: string;
  designation: string | null;
  department: string | null;
  photo_url: string | null;
  display_order: number;
  is_active: boolean;
};

export type Announcement = {
  id: string;
  title: string;
  description: string | null;
  application_deadline: string | null;
  is_active: boolean;
  created_at: string;
};

/** Uploads an image into the website media bucket and returns its object path. */
export async function uploadSiteImage(file: File, folder: string) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from(SITE_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return path;
}

/** Signed URL for a stored object path (pass-through for full URLs). */
export function useSiteImage(path: string | null | undefined) {
  return useQuery({
    queryKey: ["site-image", path],
    enabled: Boolean(path),
    staleTime: 45 * 60 * 1000,
    queryFn: async () => {
      if (!path) return null;
      if (path.startsWith("http")) return path;
      const { data, error } = await supabase.storage
        .from(SITE_BUCKET)
        .createSignedUrl(path, 60 * 60);
      if (error) return null;
      return data.signedUrl;
    },
  });
}

export function useSiteSettings() {
  return useQuery({
    queryKey: ["site-settings"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("id, college_name, logo_url, whatsapp_number, whatsapp_default_message, facebook_page_url")
        .eq("id", "main")
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as SiteSettings | null;
    },
  });
}

export function useBanners(activeOnly: boolean) {
  return useQuery({
    queryKey: ["site-banners", activeOnly],
    queryFn: async () => {
      let q = supabase
        .from("site_banners")
        .select("id, image_url, title, subtitle, display_order, is_active")
        .order("display_order")
        .order("created_at");
      if (activeOnly) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Banner[];
    },
  });
}

export function useGallery(activeOnly: boolean) {
  return useQuery({
    queryKey: ["campus-gallery", activeOnly],
    queryFn: async () => {
      let q = supabase
        .from("campus_gallery")
        .select("id, image_url, caption, display_order, is_active")
        .order("display_order")
        .order("created_at");
      if (activeOnly) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as GalleryPhoto[];
    },
  });
}

export function useFaculty(activeOnly: boolean) {
  return useQuery({
    queryKey: ["faculty-members", activeOnly],
    queryFn: async () => {
      let q = supabase
        .from("faculty_members")
        .select("id, name, designation, department, photo_url, display_order, is_active")
        .order("display_order")
        .order("name");
      if (activeOnly) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as FacultyMember[];
    },
  });
}

export function useAnnouncements(activeOnly: boolean) {
  return useQuery({
    queryKey: ["admission-announcements", activeOnly],
    queryFn: async () => {
      let q = supabase
        .from("admission_announcements")
        .select("id, title, description, application_deadline, is_active, created_at")
        .order("created_at", { ascending: false });
      if (activeOnly) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Announcement[];
    },
  });
}

/** wa.me link built from the saved number, or null when none is configured. */
export function whatsappLink(settings: SiteSettings | null | undefined) {
  const raw = settings?.whatsapp_number?.replace(/[^\d]/g, "") ?? "";
  if (!raw) return null;
  const intl = raw.startsWith("0") ? `92${raw.slice(1)}` : raw;
  const msg = settings?.whatsapp_default_message?.trim();
  return `https://wa.me/${intl}${msg ? `?text=${encodeURIComponent(msg)}` : ""}`;
}

export function formatDeadline(date: string | null) {
  if (!date) return null;
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
