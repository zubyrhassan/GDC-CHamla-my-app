import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { GraduationCap, LogOut } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
              <GraduationCap className="h-5 w-5" />
            </span>
            <div>
              <p className="font-serif text-base leading-tight font-semibold">GDC Chamla</p>
              <p className="text-[11px] tracking-wide text-primary-foreground/70 uppercase">
                Govt. Degree College, Chamla — Buner
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {profile ? (
              <div className="hidden text-right sm:block">
                <p className="text-sm leading-tight font-medium">{profile.full_name || "Staff"}</p>
                <p className="text-[11px] tracking-wide text-primary-foreground/70 uppercase">
                  {profile.role}
                </p>
              </div>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <LogOut className="mr-1.5 h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6">
          <h1 className="font-serif text-2xl font-semibold sm:text-3xl">{title}</h1>
          <div className="crest-rule mt-2 w-24" />
          {subtitle ? <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {children}
      </main>
    </div>
  );
}
