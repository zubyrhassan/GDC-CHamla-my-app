import { useRef, type ReactNode, type RefObject } from "react";
import { useReactToPrint } from "react-to-print";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const COLLEGE_NAME = "Government Degree College Chamla";
export const COLLEGE_SUBTITLE = "District Buner, Khyber Pakhtunkhwa";

const basePageStyle = (landscape: boolean) => `
  @page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: 12mm; }
  html, body { background: #fff !important; color: #000 !important; margin: 0; padding: 0;
    font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .print-frame { position: static !important; left: auto !important; top: auto !important; width: auto !important; }
  .print-header { margin-bottom: 12pt; text-align: center; }
  .print-header h2 { margin: 0; font-family: Georgia, serif; font-size: 16pt; }
  .print-header p { margin: 3pt 0 0; font-size: 9pt; }
  table { width: 100%; border-collapse: collapse; font-size: ${landscape ? "7pt" : "9.5pt"}; }
  th, td { border: 1px solid #000; padding: ${landscape ? "2pt 2pt" : "4pt 5pt"}; text-align: left; }
  th { font-weight: 700; background: #f1efe9; }
  tr { break-inside: avoid; }
  .no-print { display: none !important; }
  .print-only { display: block !important; }
`;

/**
 * Print helper built on react-to-print: the ref must point at a real, rendered
 * element (use <PrintFrame> to keep it off-screen but rendered).
 */
export function usePrintable(documentTitle: string, landscape = false) {
  const ref = useRef<HTMLDivElement>(null);
  const print = useReactToPrint({
    contentRef: ref as RefObject<HTMLDivElement>,
    documentTitle,
    pageStyle: basePageStyle(landscape),
  });
  return { ref, print };
}

/** Renders printable markup off-screen (but fully laid out) so react-to-print can clone it. */
export function PrintFrame({
  innerRef,
  children,
  width = 780,
}: {
  innerRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
  width?: number;
}) {
  return (
    <div aria-hidden style={{ position: "fixed", left: -20000, top: 0, width, pointerEvents: "none" }}>
      <div ref={innerRef} className="print-frame" style={{ width, background: "#fff", color: "#000" }}>
        {children}
      </div>
    </div>
  );
}

export type PdfTableOptions = {
  title: string;
  subtitles?: (string | null | undefined)[];
  head: string[];
  rows: (string | number)[][];
  filename: string;
  landscape?: boolean;
};

/** Client-side PDF download — no print dialog, works identically on phone and desktop. */
export function downloadTablePdf({
  title,
  subtitles = [],
  head,
  rows,
  filename,
  landscape = false,
}: PdfTableOptions) {
  const doc = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  let y = 46;

  doc.setFont("times", "bold");
  doc.setFontSize(15);
  doc.text(COLLEGE_NAME, width / 2, y, { align: "center" });
  y += 15;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(COLLEGE_SUBTITLE, width / 2, y, { align: "center" });
  y += 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(title, width / 2, y, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const line of subtitles.filter(Boolean) as string[]) {
    y += 13;
    doc.text(line, width / 2, y, { align: "center" });
  }

  autoTable(doc, {
    startY: y + 14,
    head: [head],
    body: rows.map((r) => r.map((c) => (c === null || c === undefined ? "" : String(c)))),
    styles: { fontSize: landscape ? 7 : 8.5, cellPadding: 3, lineColor: [0, 0, 0], lineWidth: 0.4 },
    headStyles: { fillColor: [31, 61, 43], textColor: [255, 255, 255], fontStyle: "bold" },
    margin: { left: 32, right: 32 },
  });

  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

/** Single fee/readmission receipt as a downloadable PDF. */
export function downloadReceiptPdf(data: {
  receipt_number: string;
  student_name: string;
  roll_number: string;
  father_name?: string | null;
  program?: string | null;
  fee_type: string;
  amount: number | string;
  payment_date: string;
  notes?: string | null;
}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();

  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.text(COLLEGE_NAME, width / 2, 60, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(COLLEGE_SUBTITLE, width / 2, 76, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("FEE RECEIPT", width / 2, 98, { align: "center" });

  const amount = `PKR ${Number(data.amount).toLocaleString("en-PK")}`;
  const rows: string[][] = [
    ["Receipt no.", data.receipt_number],
    ["Date", data.payment_date],
    ["Student", data.student_name],
    ["Roll no.", data.roll_number],
    ...(data.father_name ? [["Father's name", data.father_name]] : []),
    ...(data.program ? [["Program", data.program]] : []),
    ["Fee head", data.fee_type],
    ["Amount", amount],
    ...(data.notes ? [["Remarks", data.notes]] : []),
  ];

  autoTable(doc, {
    startY: 118,
    body: rows,
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 6, lineColor: [0, 0, 0], lineWidth: 0.4 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 150 } },
    margin: { left: 60, right: 60 },
  });

  const endY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 300;
  doc.setFontSize(10);
  doc.text(`Received with thanks the sum of ${amount}.`, width / 2, endY + 30, { align: "center" });
  doc.text("____________________", width - 90, endY + 90, { align: "center" });
  doc.setFontSize(9);
  doc.text("Accounts Officer", width - 90, endY + 104, { align: "center" });

  doc.save(`receipt-${data.receipt_number}.pdf`);
}
