import { useState } from "react";
import { FileDown, FileText, Printer } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { COLLEGE_NAME, COLLEGE_SUBTITLE, PrintFrame, usePrintable } from "@/lib/print";
import { useCollegeLogo } from "@/lib/college-assets";
import { useSignedPhoto } from "@/lib/student-photo";
import { usePermissions } from "@/lib/permissions";
import { formatPKR, STATUS_LABELS, type Student } from "@/lib/sms-types";
import { useStudentSummary, type StudentSummary } from "@/lib/student-summary";

type ReportProps = {
  student: Student;
  programName: string;
  classLabel: string;
};

/** Opens the consolidated one-page student report. Requires students → view. */
export function StudentSummaryButton(props: ReportProps) {
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);
  if (!can("students", "view")) return null;

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FileText className="mr-1.5 h-4 w-4" /> Full summary / print report
      </Button>
      {open ? <StudentSummaryDialog {...props} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function StudentSummaryDialog({
  student,
  programName,
  classLabel,
  onClose,
}: ReportProps & { onClose: () => void }) {
  const { data: summary, isLoading } = useStudentSummary(student.id);
  const { data: logo } = useCollegeLogo();
  const { data: photo } = useSignedPhoto(student.photo_url);
  const { ref, print } = usePrintable(`Student summary — ${student.roll_number}`);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-serif">Student summary report</DialogTitle>
          <DialogDescription>
            {student.full_name} · Roll {student.roll_number}
            {summary ? ` · ${summary.sessionLabel}` : ""}
          </DialogDescription>
        </DialogHeader>

        {isLoading || !summary ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Building report…</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-md border bg-white p-4 text-black">
              <ReportSheet
                student={student}
                programName={programName}
                classLabel={classLabel}
                summary={summary}
                logo={logo ?? null}
                photo={photo ?? null}
              />
            </div>

            <PrintFrame innerRef={ref}>
              <ReportSheet
                student={student}
                programName={programName}
                classLabel={classLabel}
                summary={summary}
                logo={logo ?? null}
                photo={photo ?? null}
              />
            </PrintFrame>

            <DialogFooter className="flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => downloadSummaryPdf(student, programName, classLabel, summary)}
              >
                <FileDown className="mr-1.5 h-4 w-4" /> Download PDF
              </Button>
              <Button onClick={print}>
                <Printer className="mr-1.5 h-4 w-4" /> Print report
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

const cellStyle: React.CSSProperties = { border: "1px solid #000", padding: "3pt 5pt" };
const labelStyle: React.CSSProperties = { ...cellStyle, fontWeight: 700, width: "38%" };

function KeyValueTable({ rows }: { rows: [string, string][] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5pt" }}>
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <td style={labelStyle}>{label}</td>
            <td style={cellStyle}>{value || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        margin: "10pt 0 4pt",
        fontSize: "10pt",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        borderBottom: "1px solid #000",
        paddingBottom: "2pt",
      }}
    >
      {children}
    </h3>
  );
}

export function ReportSheet({
  student,
  programName,
  classLabel,
  summary,
  logo,
  photo,
}: ReportProps & { summary: StudentSummary; logo: string | null; photo: string | null }) {
  const a = summary.attendance;

  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif", color: "#000", fontSize: "9.5pt" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10pt",
          borderBottom: "2px solid #000",
          paddingBottom: "6pt",
        }}
      >
        {logo ? (
          <img src={logo} alt="" style={{ height: 54, width: 54, objectFit: "contain" }} />
        ) : (
          <span style={{ width: 54 }} />
        )}
        <div style={{ flex: 1, textAlign: "center" }}>
          <h2 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: "15pt" }}>{COLLEGE_NAME}</h2>
          <p style={{ margin: "2pt 0 0", fontSize: "9pt" }}>{COLLEGE_SUBTITLE}</p>
          <p style={{ margin: "4pt 0 0", fontSize: "9.5pt", fontWeight: 700, letterSpacing: "0.08em" }}>
            STUDENT SUMMARY REPORT · {summary.sessionLabel}
          </p>
        </div>
        <span style={{ width: 54 }} />
      </header>

      <div style={{ display: "flex", gap: "10pt", marginTop: "8pt", alignItems: "flex-start" }}>
        <div style={{ width: 90, height: 108, border: "1px solid #000", overflow: "hidden" }}>
          {photo ? (
            <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ fontSize: "8pt", display: "block", padding: "6pt", textAlign: "center" }}>
              No photo
            </span>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <KeyValueTable
            rows={[
              ["Name", student.full_name],
              ["Roll number", student.roll_number],
              ["Programme", programName],
              ["Class", classLabel],
              ["Father / guardian", [student.father_name, student.guardian_name].filter(Boolean).join(" / ")],
              [
                "Contact",
                [student.father_contact, student.guardian_contact, student.student_contact]
                  .filter(Boolean)
                  .join(" · "),
              ],
              ["Status", STATUS_LABELS[student.status]],
            ]}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: "10pt", marginTop: "4pt" }}>
        <div style={{ flex: 1 }}>
          <SectionTitle>Attendance ({summary.sessionLabel})</SectionTitle>
          <KeyValueTable
            rows={[
              ["Lectures held", String(a.lectures)],
              ["Present", String(a.present)],
              ["Absent", String(a.absent)],
              ["Leave", String(a.leave)],
              ["Percentage", a.percentage === null ? "—" : `${a.percentage}%`],
            ]}
          />

          <SectionTitle>Absentee fines</SectionTitle>
          <KeyValueTable
            rows={[
              ["Accrued", formatPKR(summary.fines.accrued)],
              ["Paid", formatPKR(summary.fines.paid)],
              ["Outstanding", formatPKR(summary.fines.outstanding)],
            ]}
          />
        </div>

        <div style={{ flex: 1 }}>
          <SectionTitle>Tuition &amp; other fees</SectionTitle>
          <KeyValueTable
            rows={[
              ["Assigned dues", formatPKR(summary.tuition.due)],
              ["Paid", formatPKR(summary.tuition.paid)],
              ["Outstanding", formatPKR(summary.tuition.outstanding)],
              ["Status", summary.tuition.status],
            ]}
          />

          <SectionTitle>Hostel</SectionTitle>
          {summary.hostel ? (
            <KeyValueTable
              rows={[
                ["Room / bed", `${summary.hostel.room} · Bed ${summary.hostel.bed}`],
                ["Admitted on", summary.hostel.admission_date],
                ["Hostel dues", formatPKR(summary.hostelFees?.due ?? 0)],
                ["Paid", formatPKR(summary.hostelFees?.paid ?? 0)],
                ["Outstanding", formatPKR(summary.hostelFees?.outstanding ?? 0)],
                ["Status", summary.hostelFees?.status ?? "—"],
              ]}
            />
          ) : (
            <p style={{ margin: "4pt 0", fontSize: "9pt" }}>Not a hostel boarder.</p>
          )}
        </div>
      </div>

      <SectionTitle>Examination record</SectionTitle>
      {summary.exams.length === 0 ? (
        <p style={{ margin: "4pt 0", fontSize: "9pt" }}>No exam marks recorded.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
          <thead>
            <tr>
              {["Exam", "Subject", "Date", "Obtained", "Total", "%", "Grade"].map((h) => (
                <th key={h} style={{ ...cellStyle, background: "#f1efe9", textAlign: "left" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summary.exams.map((e, i) => (
              <tr key={`${e.name}-${i}`}>
                <td style={cellStyle}>{e.name}</td>
                <td style={cellStyle}>{e.subject ?? "—"}</td>
                <td style={cellStyle}>{e.exam_date}</td>
                <td style={cellStyle}>{e.marks}</td>
                <td style={cellStyle}>{e.total}</td>
                <td style={cellStyle}>{e.percentage === null ? "—" : e.percentage.toFixed(1)}</td>
                <td style={cellStyle}>{e.grade}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <SectionTitle>Struck-off status</SectionTitle>
      <p style={{ margin: "4pt 0", fontSize: "9pt" }}>
        {summary.struckOff
          ? `Struck off on ${summary.struckOff.date} — ${summary.struckOff.reason}`
          : `Currently ${STATUS_LABELS[student.status].toLowerCase()} — no active struck-off record.`}
      </p>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "22pt", fontSize: "8.5pt" }}>
        <span>Generated on {new Date().toLocaleDateString("en-GB")}</span>
        <span style={{ borderTop: "1px solid #000", paddingTop: "2pt", width: 150, textAlign: "center" }}>
          Principal / Coordinator
        </span>
      </div>
    </div>
  );
}

export function downloadSummaryPdf(
  student: Student,
  programName: string,
  classLabel: string,
  summary: StudentSummary,
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();

  doc.setFont("times", "bold");
  doc.setFontSize(15);
  doc.text(COLLEGE_NAME, width / 2, 48, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(COLLEGE_SUBTITLE, width / 2, 62, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text(`STUDENT SUMMARY REPORT — ${summary.sessionLabel}`, width / 2, 80, { align: "center" });

  const grid = { fontSize: 8.5, cellPadding: 3, lineColor: [0, 0, 0] as [number, number, number], lineWidth: 0.4 };
  const endY = () =>
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 100;

  autoTable(doc, {
    startY: 92,
    theme: "grid",
    styles: grid,
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 110 }, 2: { fontStyle: "bold", cellWidth: 110 } },
    body: [
      ["Name", student.full_name, "Roll number", student.roll_number],
      ["Programme", programName, "Class", classLabel],
      [
        "Father / guardian",
        [student.father_name, student.guardian_name].filter(Boolean).join(" / ") || "—",
        "Contact",
        [student.father_contact, student.guardian_contact, student.student_contact]
          .filter(Boolean)
          .join(" · ") || "—",
      ],
      ["Status", STATUS_LABELS[student.status], "Session", student.session ?? "—"],
    ],
    margin: { left: 36, right: 36 },
  });

  const a = summary.attendance;
  autoTable(doc, {
    startY: endY() + 12,
    theme: "grid",
    styles: grid,
    headStyles: { fillColor: [31, 61, 43], textColor: [255, 255, 255] },
    head: [["Attendance", "Lectures", "Present", "Absent", "Leave", "Percentage"]],
    body: [
      [
        summary.sessionLabel,
        a.lectures,
        a.present,
        a.absent,
        a.leave,
        a.percentage === null ? "—" : `${a.percentage}%`,
      ],
    ],
    margin: { left: 36, right: 36 },
  });

  const money: (string | number)[][] = [
    [
      "Absentee fines",
      formatPKR(summary.fines.accrued),
      formatPKR(summary.fines.paid),
      formatPKR(summary.fines.outstanding),
      summary.fines.outstanding > 0 ? "Outstanding" : "Clear",
    ],
    [
      "Tuition & other fees",
      formatPKR(summary.tuition.due),
      formatPKR(summary.tuition.paid),
      formatPKR(summary.tuition.outstanding),
      summary.tuition.status,
    ],
  ];
  if (summary.hostelFees) {
    money.push([
      "Hostel fees",
      formatPKR(summary.hostelFees.due),
      formatPKR(summary.hostelFees.paid),
      formatPKR(summary.hostelFees.outstanding),
      summary.hostelFees.status,
    ]);
  }
  autoTable(doc, {
    startY: endY() + 12,
    theme: "grid",
    styles: grid,
    headStyles: { fillColor: [31, 61, 43], textColor: [255, 255, 255] },
    head: [["Fee head", "Due", "Paid", "Outstanding", "Status"]],
    body: money,
    margin: { left: 36, right: 36 },
  });

  autoTable(doc, {
    startY: endY() + 12,
    theme: "grid",
    styles: grid,
    headStyles: { fillColor: [31, 61, 43], textColor: [255, 255, 255] },
    head: [["Exam", "Subject", "Date", "Obtained", "Total", "%", "Grade"]],
    body:
      summary.exams.length === 0
        ? [["No exam marks recorded", "", "", "", "", "", ""]]
        : summary.exams.map((e) => [
            e.name,
            e.subject ?? "—",
            e.exam_date,
            e.marks,
            e.total,
            e.percentage === null ? "—" : e.percentage.toFixed(1),
            e.grade,
          ]),
    margin: { left: 36, right: 36 },
  });

  const hostelLine = summary.hostel
    ? `Hostel: ${summary.hostel.room} · Bed ${summary.hostel.bed} · admitted ${summary.hostel.admission_date}`
    : "Hostel: not a boarder";
  const strikeLine = summary.struckOff
    ? `Struck off on ${summary.struckOff.date} — ${summary.struckOff.reason}`
    : `Currently ${STATUS_LABELS[student.status].toLowerCase()} — no active struck-off record.`;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(hostelLine, 36, endY() + 24);
  doc.text(strikeLine, 36, endY() + 38);
  doc.text(`Generated on ${new Date().toLocaleDateString("en-GB")}`, 36, endY() + 58);

  doc.save(`student-summary-${student.roll_number.replace(/[^\w-]+/g, "-")}.pdf`);
}
