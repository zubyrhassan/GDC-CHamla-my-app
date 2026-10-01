import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { FeeTransaction, FeeType } from "@/lib/sms-types";

export type FeeCharge = {
  id: string;
  student_id: string;
  fee_type_id: string | null;
  amount: number;
  due_date: string;
  notes: string | null;
  created_at: string;
};

export function useFeeTypes() {
  return useQuery({
    queryKey: ["fee_types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fee_types")
        .select("id, name, default_amount, active")
        .order("name");
      if (error) throw error;
      return (data ?? []) as FeeType[];
    },
  });
}

export function useFeeTransactions() {
  return useQuery({
    queryKey: ["fee_transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fee_transactions")
        .select("*")
        .order("payment_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FeeTransaction[];
    },
  });
}

export function useFeeCharges() {
  return useQuery({
    queryKey: ["fee_charges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fee_charges")
        .select("*")
        .order("due_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FeeCharge[];
    },
  });
}

export function sumBy<T>(rows: T[], pick: (row: T) => number) {
  return rows.reduce((total, row) => total + Number(pick(row) || 0), 0);
}

export function toCsv(rows: (string | number)[][]) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? "");
          return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
        })
        .join(","),
    )
    .join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
