import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type HostelRoom = {
  id: string;
  room_number: string;
  block: string;
  floor: string | null;
  capacity: number;
  notes: string | null;
  created_at: string;
};

export type HostelAllotmentStatus = "active" | "vacated";

export type HostelAllotment = {
  id: string;
  student_id: string;
  room_id: string;
  bed_number: number;
  admission_date: string;
  vacate_date: string | null;
  status: HostelAllotmentStatus;
  notes: string | null;
  created_at: string;
};

export type HostelFeePayment = {
  id: string;
  allotment_id: string;
  amount: number;
  period_month: string;
  payment_date: string;
  payment_method: string;
  receipt_number: string;
  notes: string | null;
  created_at: string;
};

export const PAYMENT_METHODS = ["cash", "bank", "easypaisa", "jazzcash", "other"] as const;

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank: "Bank deposit",
  easypaisa: "Easypaisa",
  jazzcash: "JazzCash",
  other: "Other",
};

export function useHostelRooms() {
  return useQuery({
    queryKey: ["hostel_rooms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hostel_rooms")
        .select("*")
        .order("block")
        .order("room_number");
      if (error) throw error;
      return (data ?? []) as HostelRoom[];
    },
  });
}

export function useHostelAllotments() {
  return useQuery({
    queryKey: ["hostel_allotments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hostel_allotments")
        .select("*")
        .order("admission_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as HostelAllotment[];
    },
  });
}

export function useHostelFees() {
  return useQuery({
    queryKey: ["hostel_fees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hostel_fee_transactions")
        .select("*")
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as HostelFeePayment[];
    },
  });
}

/** Default monthly hostel charge, kept in app_settings so admins can change it. */
export function useHostelMonthlyFee() {
  return useQuery({
    queryKey: ["app_setting", "hostel_monthly_fee"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "hostel_monthly_fee")
        .maybeSingle();
      if (error) throw error;
      const parsed = Number(data?.value ?? 3000);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 3000;
    },
  });
}

/** First day of the month for a YYYY-MM-DD date string. */
export function monthStart(date: string) {
  return `${date.slice(0, 7)}-01`;
}

export function currentMonthStart() {
  return monthStart(new Date().toISOString().slice(0, 10));
}

export function monthLabel(period: string) {
  const [y, m] = period.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

/** Inclusive count of calendar months between two YYYY-MM-DD dates. */
export function monthsInclusive(from: string, to: string) {
  const [fy, fm] = from.slice(0, 7).split("-").map(Number);
  const [ty, tm] = to.slice(0, 7).split("-").map(Number);
  const count = (ty! - fy!) * 12 + (tm! - fm!) + 1;
  return Math.max(count, 0);
}

/** Add n months to a YYYY-MM-01 period. */
export function addMonths(period: string, n: number) {
  const [y, m] = period.slice(0, 7).split("-").map(Number);
  const date = new Date(y!, m! - 1 + n, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

export type HostelFeeStatus = {
  monthsCharged: number;
  expected: number;
  paid: number;
  balance: number;
  /** Latest month a payment was recorded against. */
  paidThrough: string | null;
  /** Earliest unpaid month, when there is a balance. */
  dueFrom: string | null;
  isPaid: boolean;
};

/**
 * Hostel dues are a flat monthly charge from the admission month up to the
 * current month (or the vacate month for former boarders).
 */
export function hostelFeeStatus(
  allotment: HostelAllotment,
  payments: HostelFeePayment[],
  monthlyFee: number,
): HostelFeeStatus {
  const start = monthStart(allotment.admission_date);
  const end = allotment.vacate_date ? monthStart(allotment.vacate_date) : currentMonthStart();
  const monthsCharged = monthsInclusive(start, end);
  const expected = monthsCharged * monthlyFee;
  const mine = payments.filter((p) => p.allotment_id === allotment.id);
  const paid = mine.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const balance = Math.max(expected - paid, 0);

  const coveredMonths = new Set(mine.map((p) => monthStart(p.period_month)));
  let paidThrough: string | null = null;
  let dueFrom: string | null = null;
  for (let i = 0; i < monthsCharged; i++) {
    const period = addMonths(start, i);
    if (coveredMonths.has(period)) paidThrough = period;
    else if (!dueFrom) dueFrom = period;
  }

  return {
    monthsCharged,
    expected,
    paid,
    balance,
    paidThrough,
    dueFrom: balance > 0 ? (dueFrom ?? end) : null,
    isPaid: balance <= 0,
  };
}

export function roomLabel(room: HostelRoom | undefined, bed?: number | null) {
  if (!room) return "—";
  const base = room.block ? `${room.block} · Room ${room.room_number}` : `Room ${room.room_number}`;
  return bed ? `${base} · Bed ${bed}` : base;
}
