import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GraduationCap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { portalEmail, portalPassword } from "@/lib/portal.functions";

export const Route = createFileRoute("/portal-login")({
  head: () => ({
    meta: [
      { title: "Student & Parent Login — GDC Chamla" },
      {
        name: "description",
        content:
          "Students and parents of Government Degree College Chamla sign in with the roll number login ID to view attendance, fees, hostel and exam results.",
      },
      { property: "og:title", content: "Student & Parent Login — GDC Chamla" },
      {
        property: "og:description",
        content: "Check attendance, dues and exam results for your GDC Chamla student.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PortalLoginPage,
});

function PortalLoginPage() {
  const navigate = useNavigate();
  const [kind, setKind] = useState<"student" | "parent">("student");
  const [loginId, setLoginId] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const { data: account } = await supabase
        .from("student_portal_accounts")
        .select("id")
        .eq("user_id", data.session.user.id)
        .maybeSingle();
      if (account) navigate({ to: "/portal", replace: true });
    })();
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const id = loginId.trim().toLowerCase();
    if (!id || pin.trim().length < 4) {
      toast.error("Enter your login ID and the last 4 digits as your password.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: portalEmail(id, kind),
      password: portalPassword(`${id.slice(0, -4)}${pin.trim()}`),
    });
    setLoading(false);
    if (error) {
      toast.error("Login ID or password is incorrect. Please check with the college office.");
      return;
    }
    toast.success("Signed in");
    navigate({ to: "/portal", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="h-7 w-7" />
          </span>
          <h1 className="mt-4 font-serif text-2xl font-semibold">Student &amp; parent login</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Government Degree College Chamla, District Buner
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
          <Tabs value={kind} onValueChange={(v) => setKind(v as "student" | "parent")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="student">Student</TabsTrigger>
              <TabsTrigger value="parent">Parent</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-1.5">
            <Label htmlFor="login-id">Login ID</Label>
            <Input
              id="login-id"
              inputMode="text"
              placeholder={kind === "parent" ? "p2026503" : "2026503"}
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              autoComplete="username"
            />
            <p className="text-xs text-muted-foreground">
              Registration year followed by the roll number
              {kind === "parent" ? ", with a “p” in front for parents." : ", e.g. 2026503."}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pin">Password</Label>
            <Input
              id="pin"
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="Last 4 digits"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoComplete="current-password"
            />
            <p className="text-xs text-muted-foreground">
              The last 4 digits of the login ID, e.g. 6503 for 2026503.
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            College staff sign in <Link to="/auth" className="underline">here</Link>.
          </p>
        </form>
      </div>
    </div>
  );
}
