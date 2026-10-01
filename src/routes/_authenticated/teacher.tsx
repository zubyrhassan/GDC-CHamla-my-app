import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useProfile } from "@/hooks/useProfile";

export const Route = createFileRoute("/_authenticated/teacher")({
  component: TeacherLayout,
});

function TeacherLayout() {
  const navigate = useNavigate();
  const { data: profile, isLoading } = useProfile();

  useEffect(() => {
    if (!isLoading && profile?.role === "admin") {
      navigate({ to: "/admin", replace: true });
    }
  }, [isLoading, profile, navigate]);

  return <Outlet />;
}

const links = [
  { to: "/teacher", label: "Desk", exact: true },
  { to: "/teacher/attendance", label: "Attendance", exact: false },
  { to: "/teacher/exams", label: "Exams", exact: false },
] as const;

export function TeacherNav() {
  return (
    <nav className="no-print -mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
      {links.map((l) => (
        <Link
          key={l.to}
          to={l.to}
          activeOptions={{ exact: l.exact }}
          className="shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/10"
          activeProps={{
            className:
              "shrink-0 rounded-full border border-primary bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground",
          }}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
