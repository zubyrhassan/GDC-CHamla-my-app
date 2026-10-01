import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { AdminNav } from "./admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsPanel } from "@/components/panels/SettingsPanel";
import { createStaffAccount } from "@/lib/staff.functions";
import { useModuleGuard } from "@/lib/access";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({
    meta: [
      { title: "Settings — GDC Chamla" },
      {
        name: "description",
        content:
          "Configure the strike-off absence threshold, fee heads, college logo and teacher accounts for Government Degree College Chamla.",
      },
      { property: "og:title", content: "Settings — GDC Chamla" },
      {
        property: "og:description",
        content: "College settings: attendance rule, fee heads, logo and staff logins.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const perms = useModuleGuard("settings");
  return (
    <AppShell
      title="Settings"
      subtitle="Attendance rule, fee heads, college logo and staff logins."
    >
      <AdminNav />
      <div className="space-y-6">
        {perms.isSuperAdmin ? <NewTeacherCard /> : null}
        <SettingsPanel />
      </div>
    </AppShell>
  );
}

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function NewTeacherCard() {
  const queryClient = useQueryClient();
  const create = useServerFn(createStaffAccount);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState(randomPassword);
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);

  const submit = useMutation({
    mutationFn: async () =>
      create({
        data: {
          email: email.trim(),
          password,
          full_name: fullName.trim(),
          phone: phone.trim() || undefined,
          role: "teacher" as const,
        },
      }),
    onSuccess: () => {
      toast.success("Teacher account created");
      setIssued({ email: email.trim(), password });
      setFullName("");
      setEmail("");
      setPhone("");
      setPassword(randomPassword());
      void queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-lg border bg-card p-5 shadow-panel">
      <h2 className="font-serif text-lg font-semibold">Add a teacher account</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Create the login here and pass the email and password to the teacher.
      </p>
      <div className="crest-rule mt-3 mb-4 w-16" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="t-name">Full name</Label>
          <Input id="t-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="t-email">Email</Label>
          <Input
            id="t-email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="t-phone">Phone</Label>
          <Input
            id="t-phone"
            inputMode="tel"
            placeholder="03XXXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="t-pass">Temporary password</Label>
          <div className="flex gap-2">
            <Input id="t-pass" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button type="button" variant="outline" onClick={() => setPassword(randomPassword())}>
              New
            </Button>
          </div>
        </div>
      </div>

      <Button
        className="mt-4 w-full sm:w-auto"
        disabled={submit.isPending || !fullName.trim() || !email.trim() || password.length < 8}
        onClick={() => submit.mutate()}
      >
        <UserPlus className="mr-1.5 h-4 w-4" />
        {submit.isPending ? "Creating…" : "Create teacher login"}
      </Button>

      {issued ? (
        <div className="mt-4 rounded-md border border-accent/40 bg-accent/10 p-3 text-sm">
          <p className="font-medium">Credentials to hand over</p>
          <p className="mt-1 break-all">Email: {issued.email}</p>
          <p className="break-all">Password: {issued.password}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Shown once — copy it now and ask the teacher to change it after first login.
          </p>
        </div>
      ) : null}
    </section>
  );
}
