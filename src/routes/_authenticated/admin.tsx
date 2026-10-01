import { createFileRoute, Outlet, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";

import { usePermissions, type ModuleKey } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const navigate = useNavigate();
  const { role, isLoading } = usePermissions();

  useEffect(() => {
    // Plain teachers have their own desk; every other role works from here.
    if (!isLoading && role === "teacher") {
      navigate({ to: "/teacher", replace: true });
    }
  }, [isLoading, role, navigate]);

  return <Outlet />;
}

type NavLink = {
  to: string;
  label: string;
  exact: boolean;
  module?: ModuleKey;
  superAdminOnly?: boolean;
};

const links: NavLink[] = [
  { to: "/admin", label: "Dashboard", exact: true },
  { to: "/admin/students", label: "Students", exact: false, module: "students" },
  { to: "/admin/attendance", label: "Attendance", exact: false, module: "attendance" },
  { to: "/admin/timetable", label: "Timetable", exact: false, module: "settings" },
  { to: "/admin/absentee-report", label: "Absentee fines", exact: false, module: "attendance" },

  { to: "/admin/exams", label: "Examinations", exact: false, module: "examinations" },
  { to: "/admin/fees", label: "Fees", exact: false, module: "fees" },
  { to: "/admin/hostel", label: "Hostel", exact: false, module: "hostel" },

  { to: "/admin/struck-off", label: "Struck off", exact: false, module: "struck_off" },
  { to: "/admin/website", label: "Website", exact: false, module: "website" },
  { to: "/admin/settings", label: "Settings", exact: false, module: "settings" },
  { to: "/admin/programs", label: "Programs", exact: false, module: "settings" },
  { to: "/admin/roles", label: "Roles & permissions", exact: false, superAdminOnly: true },
  { to: "/admin/staff", label: "Staff accounts", exact: false, superAdminOnly: true },
];

export function AdminNav() {
  const { can, isSuperAdmin } = usePermissions();
  const visible = links.filter((l) => {
    if (l.superAdminOnly) return isSuperAdmin;
    if (!l.module) return true;
    return can(l.module, "view");
  });

  return (
    <nav className="no-print -mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible">
      {visible.map((l) => (
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
