import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { KeyRound, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePermissions } from "@/lib/permissions";
import { defaultLoginId, usePortalAccounts, type PortalKind } from "@/lib/portal";
import { createPortalAccount, deletePortalAccount } from "@/lib/portal.functions";
import type { Student } from "@/lib/sms-types";

/** Staff panel: issue or reset the student's and parent's portal logins. */
export function PortalAccessCard({ student }: { student: Student }) {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const { data: accounts = [] } = usePortalAccounts(student.id);
  const create = useServerFn(createPortalAccount);
  const remove = useServerFn(deletePortalAccount);

  const [studentId, setStudentId] = useState(() => defaultLoginId(student, "student"));
  const [parentId, setParentId] = useState(() => defaultLoginId(student, "parent"));
  const [issued, setIssued] = useState<{ login: string; password: string } | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["portal-accounts", student.id] });

  const issue = useMutation({
    mutationFn: async (input: { kind: PortalKind; login_id: string }) =>
      create({ data: { student_id: student.id, kind: input.kind, login_id: input.login_id } }),
    onSuccess: (res) => {
      setIssued({ login: res.login_id, password: res.password });
      toast.success(res.reset ? "Password reset" : "Portal login created");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const drop = useMutation({
    mutationFn: async (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Portal login removed");
      setIssued(null);
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!can("students", "view")) return null;
  const canIssue = can("students", "add");

  const rows: { kind: PortalKind; label: string; value: string; set: (v: string) => void }[] = [
    { kind: "student", label: "Student login ID", value: studentId, set: setStudentId },
    { kind: "parent", label: "Parent login ID", value: parentId, set: setParentId },
  ];

  return (
    <section className="rounded-md border p-4">
      <h3 className="flex items-center gap-2 font-serif text-base font-semibold">
        <KeyRound className="h-4 w-4" /> Student &amp; parent portal logins
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Login ID is the registration year plus the roll number (parents get a “p” in front). The
        password is always the last 4 digits of the login ID.
      </p>

      <div className="mt-3 space-y-3">
        {rows.map((row) => {
          const existing = accounts.find((a) => a.kind === row.kind);
          return (
            <div key={row.kind} className="flex flex-wrap items-end gap-2">
              <div className="min-w-[10rem] flex-1 space-y-1">
                <Label className="text-xs">{row.label}</Label>
                <Input
                  value={existing?.login_id ?? row.value}
                  onChange={(e) => row.set(e.target.value)}
                  disabled={Boolean(existing) || !canIssue}
                />
              </div>
              {canIssue ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={issue.isPending}
                  onClick={() =>
                    issue.mutate({ kind: row.kind, login_id: existing?.login_id ?? row.value })
                  }
                >
                  {existing ? "Reset password" : "Create login"}
                </Button>
              ) : null}
              {existing && can("students", "delete") ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={drop.isPending}
                  onClick={() => drop.mutate(existing.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>

      {issued ? (
        <p className="mt-3 rounded-md bg-muted p-2 text-xs">
          Share these credentials: login <strong>{issued.login}</strong>, password{" "}
          <strong>{issued.password}</strong> — sign in at <strong>/portal-login</strong>.
        </p>
      ) : null}
    </section>
  );
}
