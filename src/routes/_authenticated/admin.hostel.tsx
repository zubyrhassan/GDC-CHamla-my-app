import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BedDouble, Search, UserPlus } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { AdminNav } from "./admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AllotmentDialog } from "@/components/hostel/AllotmentDialog";
import { HostelRooms } from "@/components/hostel/HostelRooms";
import { HostelStudentCard } from "@/components/hostel/HostelStudentCard";
import { StudentPhoto } from "@/lib/student-photo";
import { useStudents } from "@/components/panels/StudentsPanel";
import { useModuleGuard } from "@/lib/access";
import { formatPKR } from "@/lib/sms-types";
import {
  hostelFeeStatus,
  monthLabel,
  roomLabel,
  useHostelAllotments,
  useHostelFees,
  useHostelMonthlyFee,
  useHostelRooms,
  type HostelAllotment,
} from "@/lib/hostel";

export const Route = createFileRoute("/_authenticated/admin/hostel")({
  head: () => ({
    meta: [
      { title: "Hostel Management — GDC Chamla" },
      {
        name: "description",
        content:
          "Allot hostel rooms and beds, confirm emergency contacts, collect hostel fees and track boarders of Government Degree College Chamla.",
      },
      { property: "og:title", content: "Hostel Management — GDC Chamla" },
      {
        property: "og:description",
        content: "Rooms, bed allotments and hostel fee dues for GDC Chamla boarders.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HostelPage,
});

function HostelPage() {
  const perms = useModuleGuard("hostel");
  const { data: students = [] } = useStudents();
  const { data: rooms = [] } = useHostelRooms();
  const { data: allotments = [] } = useHostelAllotments();
  const { data: payments = [] } = useHostelFees();
  const { data: monthlyFee = 3000 } = useHostelMonthlyFee();

  const [allotOpen, setAllotOpen] = useState(false);
  const [selected, setSelected] = useState<HostelAllotment | null>(null);
  const [query, setQuery] = useState("");
  const [block, setBlock] = useState("all");
  const [roomFilter, setRoomFilter] = useState("all");
  const [dueOnly, setDueOnly] = useState(false);
  const [showVacated, setShowVacated] = useState(false);

  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s] as const)), [students]);
  const roomById = useMemo(() => new Map(rooms.map((r) => [r.id, r] as const)), [rooms]);
  const blocks = useMemo(
    () => Array.from(new Set(rooms.map((r) => r.block).filter(Boolean))).sort(),
    [rooms],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allotments
      .filter((a) => (showVacated ? true : a.status === "active"))
      .map((a) => {
        const student = studentById.get(a.student_id);
        const room = roomById.get(a.room_id);
        return { allotment: a, student, room, fee: hostelFeeStatus(a, payments, monthlyFee) };
      })
      .filter((r) => (block === "all" ? true : r.room?.block === block))
      .filter((r) => (roomFilter === "all" ? true : r.allotment.room_id === roomFilter))
      .filter((r) => (dueOnly ? !r.fee.isPaid : true))
      .filter((r) =>
        q
          ? `${r.student?.full_name ?? ""} ${r.student?.roll_number ?? ""}`.toLowerCase().includes(q)
          : true,
      )
      .sort((a, b) => b.fee.balance - a.fee.balance);
  }, [
    allotments,
    studentById,
    roomById,
    payments,
    monthlyFee,
    block,
    roomFilter,
    dueOnly,
    query,
    showVacated,
  ]);

  const activeCount = allotments.filter((a) => a.status === "active").length;
  const totalBeds = rooms.reduce((sum, r) => sum + r.capacity, 0);
  const outstanding = rows.reduce((sum, r) => sum + r.fee.balance, 0);
  const withDues = rows.filter((r) => !r.fee.isPaid).length;

  const selectedRow = selected
    ? {
        student: studentById.get(selected.student_id),
        room: roomById.get(selected.room_id),
      }
    : null;

  if (!perms.allowed) return null;

  return (
    <AppShell
      title="Hostel"
      subtitle="Rooms, bed allotments, boarder profiles and hostel fee collection."
    >
      <AdminNav />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Boarders" value={String(activeCount)} />
        <Stat label="Beds occupied" value={`${activeCount}/${totalBeds}`} />
        <Stat label="Hostel dues" value={formatPKR(outstanding)} />
        <Stat label="Boarders with dues" value={String(withDues)} />
      </div>

      <Tabs defaultValue="boarders" className="mt-6">
        <TabsList>
          <TabsTrigger value="boarders">Boarders</TabsTrigger>
          <TabsTrigger value="rooms">Rooms</TabsTrigger>
        </TabsList>

        <TabsContent value="boarders" className="mt-4 space-y-4">
          {perms.can("hostel", "add") ? (
            <Button onClick={() => setAllotOpen(true)} disabled={rooms.length === 0}>
              <UserPlus className="mr-1.5 h-4 w-4" /> Allot hostel seat
            </Button>
          ) : null}
          {rooms.length === 0 ? (
            <p className="rounded-md border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
              Add hostel rooms under the Rooms tab before allotting seats.
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs tracking-wide text-muted-foreground uppercase">Search</Label>
              <div className="relative">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Name or roll number"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs tracking-wide text-muted-foreground uppercase">Block</Label>
              <Select
                value={block}
                onValueChange={(v) => {
                  setBlock(v);
                  setRoomFilter("all");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All blocks</SelectItem>
                  {blocks.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs tracking-wide text-muted-foreground uppercase">Room</Label>
              <Select value={roomFilter} onValueChange={setRoomFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All rooms</SelectItem>
                  {rooms
                    .filter((r) => (block === "all" ? true : r.block === block))
                    .map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.block ? `${r.block} · ` : ""}Room {r.room_number}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button
                variant={dueOnly ? "default" : "outline"}
                className="flex-1"
                onClick={() => setDueOnly((v) => !v)}
              >
                Dues only
              </Button>
              <Button
                variant={showVacated ? "default" : "outline"}
                className="flex-1"
                onClick={() => setShowVacated((v) => !v)}
              >
                Past
              </Button>
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
              No boarders match these filters.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map(({ allotment, student, room, fee }) => (
                <li key={allotment.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(allotment)}
                    className="flex w-full gap-3 rounded-lg border bg-card p-3 text-left shadow-panel transition-colors hover:bg-accent/5"
                  >
                    <StudentPhoto
                      path={student?.photo_url ?? null}
                      name={student?.full_name ?? ""}
                      className="h-16 w-14 shrink-0"
                    />
                    <div className="grid min-w-0 flex-1 gap-1">
                      <span className="truncate font-medium">{student?.full_name ?? "Unknown"}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {student?.roll_number ?? "—"}
                      </span>
                      <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <BedDouble className="h-3.5 w-3.5 shrink-0" />
                        {roomLabel(room, allotment.bed_number)}
                      </span>
                      <span className="flex flex-wrap gap-1.5">
                        <Badge variant={fee.isPaid ? "secondary" : "destructive"}>
                          {fee.isPaid
                            ? "Fee clear"
                            : `Due ${formatPKR(fee.balance)} · ${monthLabel(fee.dueFrom!)}`}
                        </Badge>
                        {allotment.status === "vacated" ? (
                          <Badge variant="outline">Vacated</Badge>
                        ) : null}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="rooms" className="mt-4">
          <HostelRooms
            canAdd={perms.can("hostel", "add")}
            canEdit={perms.can("hostel", "edit")}
            canDelete={perms.can("hostel", "delete")}
          />
        </TabsContent>
      </Tabs>

      <AllotmentDialog open={allotOpen} onOpenChange={setAllotOpen} />

      {selected ? (
        <HostelStudentCard
          open={Boolean(selected)}
          onOpenChange={(o) => !o && setSelected(null)}
          allotment={selected}
          student={selectedRow?.student}
          room={selectedRow?.room}
          monthlyFee={monthlyFee}
          canAdd={perms.can("hostel", "add")}
          canEdit={perms.can("hostel", "edit")}
        />
      ) : null}
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-panel">
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 font-serif text-xl font-semibold">{value}</p>
    </div>
  );
}
