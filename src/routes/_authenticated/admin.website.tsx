import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { AdminNav } from "./admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { ImageUploadField } from "@/components/site/ImageUploadField";
import { SiteImage } from "@/components/site/SiteImage";
import { supabase } from "@/integrations/supabase/client";
import { useModuleGuard } from "@/lib/access";
import {
  formatDeadline,
  useAnnouncements,
  useBanners,
  useFaculty,
  useGallery,
  useSiteSettings,
} from "@/lib/site";

export const Route = createFileRoute("/_authenticated/admin/website")({
  head: () => ({
    meta: [
      { title: "Website manager — GDC Chamla SMS" },
      {
        name: "description",
        content:
          "Manage the public GDC Chamla website: banners, campus gallery, faculty, admission announcements and contact settings.",
      },
      { property: "og:title", content: "Website manager — GDC Chamla SMS" },
      {
        property: "og:description",
        content: "Update the public college website content without touching code.",
      },
    ],
  }),
  component: WebsitePage,
});

function WebsitePage() {
  useModuleGuard("website");

  return (
    <AppShell title="Website">
      <AdminNav />
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold">Public website</h1>
        <p className="text-sm text-muted-foreground">
          Everything visitors see on the college homepage is managed here.
        </p>
      </div>

      <Tabs defaultValue="settings">
        <TabsList className="mb-4 flex w-full flex-wrap justify-start">
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="banners">Banners</TabsTrigger>
          <TabsTrigger value="gallery">Campus gallery</TabsTrigger>
          <TabsTrigger value="faculty">Faculty</TabsTrigger>
          <TabsTrigger value="admissions">Admissions</TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <SettingsTab />
        </TabsContent>
        <TabsContent value="banners">
          <BannersTab />
        </TabsContent>
        <TabsContent value="gallery">
          <GalleryTab />
        </TabsContent>
        <TabsContent value="faculty">
          <FacultyTab />
        </TabsContent>
        <TabsContent value="admissions">
          <AdmissionsTab />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-panel">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/* ---------------- Settings ---------------- */

function SettingsTab() {
  const queryClient = useQueryClient();
  const { data: settings } = useSiteSettings();
  const [name, setName] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [whatsapp, setWhatsapp] = useState("");
  const [message, setMessage] = useState("");
  const [facebook, setFacebook] = useState("");

  useEffect(() => {
    if (!settings) return;
    setName(settings.college_name ?? "");
    setLogo(settings.logo_url);
    setWhatsapp(settings.whatsapp_number ?? "");
    setMessage(settings.whatsapp_default_message ?? "");
    setFacebook(settings.facebook_page_url ?? "");
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("site_settings")
        .update({
          college_name: name.trim(),
          logo_url: logo,
          whatsapp_number: whatsapp.trim() || null,
          whatsapp_default_message: message.trim() || null,
          facebook_page_url: facebook.trim() || "https://www.facebook.com/gdcchamlabuner",
        })
        .eq("id", "main");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Website settings saved");
      void queryClient.invalidateQueries({ queryKey: ["site-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Section title="Branding & contact">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <ImageUploadField
            value={logo}
            folder="logo"
            label="College logo"
            previewClassName="h-20 w-20 rounded-full border"
            onChange={setLogo}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="college-name">College name</Label>
          <Input id="college-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wa">WhatsApp number</Label>
          <Input
            id="wa"
            value={whatsapp}
            placeholder="03001234567"
            onChange={(e) => setWhatsapp(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Leave empty to hide the floating WhatsApp button.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fb">Facebook page URL</Label>
          <Input id="fb" value={facebook} onChange={(e) => setFacebook(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wa-msg">WhatsApp default message</Label>
          <Input
            id="wa-msg"
            value={message}
            placeholder="Assalam-o-Alaikum, I need information about admissions."
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
      </div>
      <Button className="mt-5" disabled={save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? "Saving…" : "Save settings"}
      </Button>
    </Section>
  );
}

/* ---------------- shared helpers ---------------- */

type OrderedRow = { id: string; display_order: number; is_active: boolean };

function useRowActions(table: "site_banners" | "campus_gallery" | "faculty_members", keys: string[]) {
  const queryClient = useQueryClient();
  const refresh = () => keys.forEach((k) => void queryClient.invalidateQueries({ queryKey: [k] }));

  const toggle = useMutation({
    mutationFn: async (row: OrderedRow) => {
      const { error } = await supabase.from(table).update({ is_active: !row.is_active }).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const move = useMutation({
    mutationFn: async ({ rows, index, dir }: { rows: OrderedRow[]; index: number; dir: -1 | 1 }) => {
      const target = index + dir;
      if (target < 0 || target >= rows.length) return;
      const a = rows[index];
      const b = rows[target];
      if (!a || !b) return;
      const first = await supabase.from(table).update({ display_order: target }).eq("id", a.id);
      if (first.error) throw first.error;
      const second = await supabase.from(table).update({ display_order: index }).eq("id", b.id);
      if (second.error) throw second.error;
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  return { toggle, remove, move, refresh };
}

function RowControls({
  rows,
  index,
  row,
  onEdit,
  onDelete,
  actions,
}: {
  rows: OrderedRow[];
  index: number;
  row: OrderedRow;
  onEdit: () => void;
  onDelete: () => void;
  actions: ReturnType<typeof useRowActions>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label="Move up"
        disabled={index === 0}
        onClick={() => actions.move.mutate({ rows, index, dir: -1 })}
      >
        <ArrowUp className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label="Move down"
        disabled={index === rows.length - 1}
        onClick={() => actions.move.mutate({ rows, index, dir: 1 })}
      >
        <ArrowDown className="h-4 w-4" />
      </Button>
      <Switch
        checked={row.is_active}
        aria-label="Active"
        onCheckedChange={() => actions.toggle.mutate(row)}
      />
      <Button type="button" size="icon" variant="ghost" aria-label="Edit" onClick={onEdit}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button type="button" size="icon" variant="ghost" aria-label="Delete" onClick={onDelete}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

/* ---------------- Banners ---------------- */

function BannersTab() {
  const { data: banners = [] } = useBanners(false);
  const actions = useRowActions("site_banners", ["site-banners"]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);

  function openNew() {
    setEditingId(null);
    setImage(null);
    setTitle("");
    setSubtitle("");
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!image) throw new Error("Upload a banner image first");
      const payload = {
        image_url: image,
        title: title.trim() || null,
        subtitle: subtitle.trim() || null,
      };
      if (editingId) {
        const { error } = await supabase.from("site_banners").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("site_banners")
          .insert({ ...payload, display_order: banners.length });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Banner updated" : "Banner added");
      setOpen(false);
      actions.refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Section
      title="Homepage banners"
      action={
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1.5 h-4 w-4" /> Add banner
        </Button>
      }
    >
      {banners.length === 0 ? (
        <p className="text-sm text-muted-foreground">No banners yet — the homepage uses a default image.</p>
      ) : (
        <ul className="space-y-3">
          {banners.map((b, i) => (
            <li key={b.id} className="flex flex-wrap items-center gap-4 rounded-lg border p-3">
              <SiteImage path={b.image_url} alt={b.title ?? "Banner"} className="h-16 w-28 rounded-md" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{b.title ?? "Untitled banner"}</p>
                <p className="truncate text-sm text-muted-foreground">{b.subtitle ?? "—"}</p>
              </div>
              {!b.is_active ? <Badge variant="secondary">Hidden</Badge> : null}
              <RowControls
                rows={banners}
                index={i}
                row={b}
                actions={actions}
                onEdit={() => {
                  setEditingId(b.id);
                  setImage(b.image_url);
                  setTitle(b.title ?? "");
                  setSubtitle(b.subtitle ?? "");
                  setOpen(true);
                }}
                onDelete={() => setToDelete(b.id)}
              />
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit banner" : "Add banner"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <ImageUploadField
              value={image}
              folder="banners"
              label="Banner image"
              previewClassName="h-20 w-32 rounded-md border"
              onChange={setImage}
            />
            <div className="space-y-1.5">
              <Label htmlFor="banner-title">Title</Label>
              <Input id="banner-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="banner-sub">Subtitle</Label>
              <Input id="banner-sub" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={save.isPending} onClick={() => save.mutate()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={toDelete != null}
        onOpenChange={(v) => !v && setToDelete(null)}
        title="Delete banner"
        description="This banner will be removed from the homepage."
        onConfirm={() => {
          if (toDelete) actions.remove.mutate(toDelete);
          setToDelete(null);
        }}
      />
    </Section>
  );
}

/* ---------------- Gallery ---------------- */

function GalleryTab() {
  const { data: photos = [] } = useGallery(false);
  const actions = useRowActions("campus_gallery", ["campus-gallery"]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      if (!image) throw new Error("Upload a photo first");
      const payload = { image_url: image, caption: caption.trim() || null };
      if (editingId) {
        const { error } = await supabase.from("campus_gallery").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("campus_gallery")
          .insert({ ...payload, display_order: photos.length });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Photo updated" : "Photo added");
      setOpen(false);
      actions.refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Section
      title="Campus gallery"
      action={
        <Button
          size="sm"
          onClick={() => {
            setEditingId(null);
            setImage(null);
            setCaption("");
            setOpen(true);
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Add photo
        </Button>
      }
    >
      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No campus photos yet.</p>
      ) : (
        <ul className="space-y-3">
          {photos.map((p, i) => (
            <li key={p.id} className="flex flex-wrap items-center gap-4 rounded-lg border p-3">
              <SiteImage path={p.image_url} alt={p.caption ?? "Campus"} className="h-16 w-24 rounded-md" />
              <p className="min-w-0 flex-1 truncate text-sm">{p.caption ?? "No caption"}</p>
              {!p.is_active ? <Badge variant="secondary">Hidden</Badge> : null}
              <RowControls
                rows={photos}
                index={i}
                row={p}
                actions={actions}
                onEdit={() => {
                  setEditingId(p.id);
                  setImage(p.image_url);
                  setCaption(p.caption ?? "");
                  setOpen(true);
                }}
                onDelete={() => setToDelete(p.id)}
              />
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit photo" : "Add photo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <ImageUploadField value={image} folder="gallery" label="Photo" onChange={setImage} />
            <div className="space-y-1.5">
              <Label htmlFor="caption">Caption</Label>
              <Input id="caption" value={caption} onChange={(e) => setCaption(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={save.isPending} onClick={() => save.mutate()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={toDelete != null}
        onOpenChange={(v) => !v && setToDelete(null)}
        title="Delete photo"
        description="This photo will be removed from the campus gallery."
        onConfirm={() => {
          if (toDelete) actions.remove.mutate(toDelete);
          setToDelete(null);
        }}
      />
    </Section>
  );
}

/* ---------------- Faculty ---------------- */

function FacultyTab() {
  const { data: members = [] } = useFaculty(false);
  const actions = useRowActions("faculty_members", ["faculty-members"]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [department, setDepartment] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name is required");
      const payload = {
        name: name.trim(),
        designation: designation.trim() || null,
        department: department.trim() || null,
        photo_url: photo,
      };
      if (editingId) {
        const { error } = await supabase.from("faculty_members").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("faculty_members")
          .insert({ ...payload, display_order: members.length });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Faculty member updated" : "Faculty member added");
      setOpen(false);
      actions.refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Section
      title="Faculty members"
      action={
        <Button
          size="sm"
          onClick={() => {
            setEditingId(null);
            setPhoto(null);
            setName("");
            setDesignation("");
            setDepartment("");
            setOpen(true);
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Add member
        </Button>
      }
    >
      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">No faculty members added yet.</p>
      ) : (
        <ul className="space-y-3">
          {members.map((m, i) => (
            <li key={m.id} className="flex flex-wrap items-center gap-4 rounded-lg border p-3">
              <SiteImage path={m.photo_url} alt={m.name} className="h-16 w-14 rounded-md" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{m.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {[m.designation, m.department].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              {!m.is_active ? <Badge variant="secondary">Hidden</Badge> : null}
              <RowControls
                rows={members}
                index={i}
                row={m}
                actions={actions}
                onEdit={() => {
                  setEditingId(m.id);
                  setPhoto(m.photo_url);
                  setName(m.name);
                  setDesignation(m.designation ?? "");
                  setDepartment(m.department ?? "");
                  setOpen(true);
                }}
                onDelete={() => setToDelete(m.id)}
              />
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit faculty member" : "Add faculty member"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <ImageUploadField
              value={photo}
              folder="faculty"
              label="Photograph"
              previewClassName="h-24 w-20 rounded-md border"
              onChange={setPhoto}
            />
            <div className="space-y-1.5">
              <Label htmlFor="f-name">Name</Label>
              <Input id="f-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="f-desig">Designation / subject</Label>
                <Input
                  id="f-desig"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="Lecturer in Physics"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-dept">Department</Label>
                <Input id="f-dept" value={department} onChange={(e) => setDepartment(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={save.isPending} onClick={() => save.mutate()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={toDelete != null}
        onOpenChange={(v) => !v && setToDelete(null)}
        title="Delete faculty member"
        description="This member will be removed from the public faculty section."
        onConfirm={() => {
          if (toDelete) actions.remove.mutate(toDelete);
          setToDelete(null);
        }}
      />
    </Section>
  );
}

/* ---------------- Admissions ---------------- */

function AdmissionsTab() {
  const queryClient = useQueryClient();
  const { data: items = [] } = useAnnouncements(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admission-announcements"] });

  const save = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Title is required");
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        application_deadline: deadline || null,
      };
      if (editingId) {
        const { error } = await supabase
          .from("admission_announcements")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("admission_announcements").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Announcement updated" : "Announcement added");
      setOpen(false);
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (row: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("admission_announcements")
        .update({ is_active: !row.is_active })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => void refresh(),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("admission_announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Section
      title="Admission announcements"
      action={
        <Button
          size="sm"
          onClick={() => {
            setEditingId(null);
            setTitle("");
            setDescription("");
            setDeadline("");
            setOpen(true);
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Add announcement
        </Button>
      }
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No announcements — the admissions section stays hidden on the homepage.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((a) => (
            <li key={a.id} className="flex flex-wrap items-start gap-4 rounded-lg border p-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{a.title}</p>
                {a.description ? (
                  <p className="text-sm whitespace-pre-line text-muted-foreground">{a.description}</p>
                ) : null}
                {a.application_deadline ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Deadline: {formatDeadline(a.application_deadline)}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-1.5">
                <Switch
                  checked={a.is_active}
                  aria-label="Active"
                  onCheckedChange={() => toggle.mutate(a)}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Edit"
                  onClick={() => {
                    setEditingId(a.id);
                    setTitle(a.title);
                    setDescription(a.description ?? "");
                    setDeadline(a.application_deadline ?? "");
                    setOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => setToDelete(a.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit announcement" : "Add announcement"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="a-title">Title</Label>
              <Input id="a-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-desc">Description</Label>
              <Textarea
                id="a-desc"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-deadline">Application deadline</Label>
              <Input
                id="a-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={save.isPending} onClick={() => save.mutate()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={toDelete != null}
        onOpenChange={(v) => !v && setToDelete(null)}
        title="Delete announcement"
        description="This announcement will be removed."
        onConfirm={() => {
          if (toDelete) remove.mutate(toDelete);
          setToDelete(null);
        }}
      />
    </Section>
  );
}
