import * as XLSX from "xlsx";

/** Column headers of the bulk-admission template, in order. */
export const TEMPLATE_HEADERS = [
  "Full Name",
  "Roll Number",
  "Father's Name",
  "CNIC/B-Form",
  "Student Contact",
  "Guardian Contact",
  "Address",
  "Program",
  "Class",
  "Session",
  "Section",
] as const;

export type TemplateHeader = (typeof TEMPLATE_HEADERS)[number];
export type RawRow = Record<string, string>;

/** Builds and downloads an empty .xlsx template with one example row. */
export function downloadStudentTemplate() {
  const example: Record<string, string> = {
    "Full Name": "Ahmad Khan",
    "Roll Number": "2026-001",
    "Father's Name": "Gul Khan",
    "CNIC/B-Form": "17101-1234567-1",
    "Student Contact": "03001234567",
    "Guardian Contact": "03007654321",
    Address: "Chamla, Buner",
    Program: "Pre-Medical",
    Class: "Grade 11",
    Session: "2026-28",
    Section: "A",
  };
  const sheet = XLSX.utils.json_to_sheet([example], {
    header: TEMPLATE_HEADERS as unknown as string[],
  });
  sheet["!cols"] = TEMPLATE_HEADERS.map(() => ({ wch: 20 }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Students");
  XLSX.writeFile(book, "GDC-Chamla-student-import-template.xlsx");
}

const norm = (v: unknown) => String(v ?? "").trim();

/** Reads an .xlsx/.xls/.csv file into trimmed string rows keyed by header. */
export async function parseStudentFile(file: File): Promise<RawRow[]> {
  const buffer = await file.arrayBuffer();
  const book = XLSX.read(buffer, { type: "array" });
  const first = book.SheetNames[0];
  if (!first) throw new Error("The file has no sheets.");
  const sheet = book.Sheets[first]!;
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return rows.map((r) => {
    const out: RawRow = {};
    for (const [k, v] of Object.entries(r)) out[norm(k).toLowerCase()] = norm(v);
    return out;
  });
}

export function field(row: RawRow, header: TemplateHeader) {
  return row[header.toLowerCase()] ?? "";
}

/** True when every cell in the row is blank. */
export function isBlankRow(row: RawRow) {
  return Object.values(row).every((v) => v === "");
}
