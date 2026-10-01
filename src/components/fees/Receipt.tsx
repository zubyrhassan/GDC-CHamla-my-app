import type { RefObject } from "react";
import { useReactToPrint } from "react-to-print";
import { FileDown, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { downloadReceiptPdf } from "@/lib/print";
import { useCollegeLogo } from "@/lib/college-assets";
import { formatPKR } from "@/lib/sms-types";

export type ReceiptData = {
  receipt_number: string;
  student_name: string;
  roll_number: string;
  father_name?: string | null;
  program?: string | null;
  fee_type: string;
  amount: number;
  payment_date: string;
  notes?: string | null;
};

/** Official college fee receipt. Rendered on screen and, via #receipt-print-area, on paper. */
export function Receipt({ data }: { data: ReceiptData }) {
  const { data: logo } = useCollegeLogo();

  return (
    <article className="receipt-sheet mx-auto w-full max-w-[520px] border border-primary/30 bg-card p-6 text-foreground">
      <header className="flex items-start gap-4 border-b border-primary/30 pb-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-primary/30 bg-muted text-[9px] leading-tight text-muted-foreground">
          {logo ? (
            <img src={logo} alt="College logo" className="h-full w-full object-contain" />
          ) : (
            <span className="px-1 text-center">College logo</span>
          )}
        </span>
        <div className="min-w-0 flex-1 text-center">
          <h2 className="font-serif text-base leading-tight font-semibold">
            Government Degree College Chamla
          </h2>
          <p className="text-xs">District Buner, Khyber Pakhtunkhwa</p>
          <p className="mt-2 inline-block border border-primary/40 px-3 py-0.5 text-[11px] tracking-widest uppercase">
            Fee Receipt
          </p>
        </div>
        <span className="w-16 shrink-0" />
      </header>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <Row label="Receipt no." value={data.receipt_number} strong />
        <Row label="Date" value={data.payment_date} />
        <Row label="Student" value={data.student_name} />
        <Row label="Roll no." value={data.roll_number} />
        {data.father_name ? <Row label="Father's name" value={data.father_name} /> : null}
        {data.program ? <Row label="Program" value={data.program} /> : null}
        <Row label="Fee head" value={data.fee_type} />
        <Row label="Amount" value={formatPKR(Number(data.amount))} strong />
      </dl>

      {data.notes ? (
        <p className="mt-3 border-t border-dashed border-primary/30 pt-2 text-xs">
          <span className="text-muted-foreground">Remarks: </span>
          {data.notes}
        </p>
      ) : null}

      <p className="mt-4 border-y border-primary/30 py-2 text-center text-sm">
        Received with thanks the sum of <strong>{formatPKR(Number(data.amount))}</strong>.
      </p>

      <div className="mt-10 flex justify-end">
        <div className="w-52 border-t border-foreground pt-1 text-center text-xs">
          Accounts Officer
        </div>
      </div>
    </article>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className={strong ? "font-semibold" : ""}>{value}</dd>
    </div>
  );
}

/** Print/download actions for an on-screen receipt. Pass the ref to a wrapper around <Receipt />. */
export function ReceiptActions({ data, printRef }: { data: ReceiptData; printRef: RefObject<HTMLDivElement | null> }) {
  const print = useReactToPrint({
    contentRef: printRef as RefObject<HTMLDivElement>,
    documentTitle: `Receipt ${data.receipt_number}`,
    pageStyle: `@page { size: A4; margin: 14mm; } body { background:#fff; color:#000; }`,
  });

  return (
    <>
      <Button variant="outline" onClick={() => downloadReceiptPdf(data)}>
        <FileDown className="mr-1.5 h-4 w-4" /> Download PDF
      </Button>
      <Button onClick={print}>
        <Printer className="mr-1.5 h-4 w-4" /> Print receipt
      </Button>
    </>
  );
}
