import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GraduationCap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Staff Sign In — GDC Chamla SMS" },
      {
        name: "description",
        content:
          "Secure sign in for administrators and teachers of Government Degree College Chamla, Buner.",
      },
      { property: "og:title", content: "Staff Sign In — GDC Chamla SMS" },
      {
        property: "og:description",
        content: "Secure sign in for GDC Chamla college staff.",
      },
    ],
  }),
  component: AuthPage,
});

async function routeByRole(navigate: ReturnType<typeof useNavigate>) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();
  navigate({ to: data?.role === "admin" ? "/admin" : "/teacher", replace: true });
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) await routeByRole(navigate);
    })();
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    if (mode === "register") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: fullName, phone },
        },
      });
      setLoading(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      if (!data.session) {
        toast.success("Account created. Check your email to confirm, then sign in.");
        setMode("signin");
        return;
      }
      await routeByRole(navigate);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Signed in");
    await routeByRole(navigate);
  }


  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="h-7 w-7" />
          </span>
          <h1 className="mt-4 font-serif text-2xl font-semibold">
            Government Degree College Chamla
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            District Buner, Khyber Pakhtunkhwa — Student Management System
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-panel">
          <h2 className="font-serif text-lg font-semibold">
            {mode === "signin" ? "Staff sign in" : "Register staff account"}
          </h2>
          <div className="crest-rule mt-2 mb-5 w-16" />
          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "register" ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="full_name">Full name</Label>
                  <Input
                    id="full_name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="email">Official email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@gdcchamla.edu.pk"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? "Please wait…"
                : mode === "signin"
                  ? "Sign in"
                  : "Create staff account"}
            </Button>
          </form>
          <button
            type="button"
            className="mt-4 text-sm text-accent underline-offset-4 hover:underline"
            onClick={() => setMode(mode === "signin" ? "register" : "signin")}
          >
            {mode === "signin"
              ? "First time here? Register a staff account"
              : "Already have an account? Sign in"}
          </button>
          <p className="mt-3 text-xs text-muted-foreground">
            The first registered account becomes the college administrator; later accounts are
            created as teachers and can be promoted by an administrator.
          </p>
          <p className="mt-3 text-sm">
            Student or parent?{" "}
            <a href="/portal-login" className="text-accent underline-offset-4 hover:underline">
              Open the student / parent portal
            </a>
          </p>

        </div>

      </div>
    </div>
  );
}
