import * as XLSX from "xlsx";

/** Column headers of the marks-import template, in order. */
export const MARKS_TEMPLATE_HEADERS = ["Roll No.", "Name", "Marks Obtained"] as const;

export type MarksRow = { roll_number: string; name: string; marks: string };

const norm = (v: unknown) => String(v ?? "").trim();

/** Builds and downloads a marks template pre-filled with the exam roster. */
export function downloadMarksTemplate(
  exam: { name: string; total_marks: number; exam_date: string },
  roster: { roll_number: string; full_name: string; marks?: number | null }[],
) {
  const body = roster.map((s) => ({
    "Roll No.": s.roll_number,
    Name: s.full_name,
    "Marks Obtained": s.marks ?? "",
  }));
  const sheet = XLSX.utils.json_to_sheet(body, {
    header: MARKS_TEMPLATE_HEADERS as unknown as string[],
  });
  sheet["!cols"] = [{ wch: 16 }, { wch: 28 }, { wch: 16 }];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Marks");
  const safe = exam.name.replace(/[^\w\-]+/g, "-");
  XLSX.writeFile(book, `GDC-Chamla-marks-template-${safe}-${exam.exam_date}.csv`, {
    bookType: "csv",
  });
}

/** Squashes a header cell to a comparable key: lowercase, no punctuation/spaces. */
const headerKey = (v: unknown) =>
  String(v ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, "");

/** Header aliases accepted for each field, matched against {@link headerKey}. */
const ALIASES = {
  roll: ["rollno", "rollnumber", "roll", "rollnum", "regno", "registrationno", "rno", "srrollno"],
  name: ["name", "fullname", "studentname", "student"],
  obtained: [
    "marksobtained",
    "obtainedmarks",
    "obtained",
    "marks",
    "score",
    "scored",
    "gotmarks",
    "result",
  ],
  total: ["totalmarks", "total", "maxmarks", "max", "outof", "fullmarks"],
  percent: ["%", "percent", "percentage", "percentagemarks", "marks%", "%age"],
} as const;

const pick = (keyed: Record<string, string>, field: keyof typeof ALIASES) => {
  for (const alias of ALIASES[field]) {
    const hit = keyed[alias];
    if (hit !== undefined && hit !== "") return hit;
  }
  // Fall back to a partial match, e.g. "Marks Obtained (Theory)".
  for (const alias of ALIASES[field]) {
    for (const [k, v] of Object.entries(keyed)) {
      if (v !== "" && k.includes(alias)) return v;
    }
  }
  return "";
};

const toNumber = (v: string) => {
  const n = Number(v.replace(/[%\s,]/g, ""));
  return Number.isFinite(n) ? n : null;
};

/**
 * Reads a .csv/.xlsx/.xls marks file into trimmed rows.
 *
 * Column names are auto-detected, so alternate template versions work: any of
 * Roll No./Roll Number/Reg No, Name/Student Name, Marks Obtained/Obtained/Score,
 * Total/Max Marks and %/Percentage. When a row has no obtained marks but does
 * carry a percentage, marks are derived from that percentage and the total
 * (row total, else the exam total passed in).
 */
export async function parseMarksFile(file: File, examTotal?: number): Promise<MarksRow[]> {
  const buffer = await file.arrayBuffer();
  const book = XLSX.read(buffer, { type: "array" });
  const first = book.SheetNames[0];
  if (!first) throw new Error("The file has no sheets.");
  const sheet = book.Sheets[first]!;
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  return raw.map((r) => {
    const keyed: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) keyed[headerKey(k)] = norm(v);

    let marks = pick(keyed, "obtained");
    if (!marks) {
      const pct = toNumber(pick(keyed, "percent"));
      const total = toNumber(pick(keyed, "total")) ?? examTotal ?? null;
      if (pct !== null && total !== null && total > 0) {
        marks = String(Math.round(((pct / 100) * total + Number.EPSILON) * 100) / 100);
      }
    }

    return {
      roll_number: pick(keyed, "roll"),
      name: pick(keyed, "name"),
      marks,
    };
  });
}

export function isBlankMarksRow(row: MarksRow) {
  return !row.roll_number && !row.name && !row.marks;
}
