import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash";

const schema = z.object({
  /** Full data URL of the photo or PDF, e.g. "data:image/jpeg;base64,…". */
  image: z.string().min(32),
  kind: z.enum(["student", "marks", "fee", "attendance"]),
  /** Extra context, e.g. total marks of the exam or the class roster. */
  hint: z.string().max(12000).optional(),
});

const ATTENDANCE_PROMPT = `Read this student attendance register (a photograph or a PDF) from a Pakistani college and return every student row.
Return JSON exactly like:
{"columns":["01","02","03"],"rows":[{"roll_number":"","name":"","marks":["P","A","L"]}]}
Rules:
- "columns" lists the date headers of the register exactly as written (e.g. "12", "12/10", "2025-10-12"). If the sheet is a plain list with one tick/mark per student and no date header, use a single column [""].
- Each row's "marks" has one entry per column, in the same order: "P" for present (tick, P, ✓), "A" for absent (cross, A, X, blank-struck), "L" for leave (L), or "" when the cell is empty or unreadable.
- Roll numbers are the main identifier; copy them exactly as written. Use "" for an unreadable roll number or name.
- Skip header rows, totals, percentages and signature rows. Never invent students or marks.`;

const INSTRUCTIONS: Record<z.infer<typeof schema>["kind"], string> = {
  student: `Read this admission form / CNIC / B-Form / student ID photograph from a Pakistani college and return the student's details.
Return JSON exactly like:
{"fields":{"roll_number":"","full_name":"","father_name":"","cnic_bform":"","date_of_birth":"YYYY-MM-DD","gender":"male|female","student_contact":"","guardian_contact":"","address":"","email":"","session":"","section":""}}
Rules: use "" for anything not clearly visible. Never invent data. Keep Pakistani phone numbers in local 03XXXXXXXXX form. CNIC/B-Form as 00000-0000000-0. Dates as YYYY-MM-DD.`,
  marks: `Read this handwritten or printed award list / mark sheet from a Pakistani college and return every student row.
Return JSON exactly like:
{"rows":[{"roll_number":"","name":"","marks":0}]}
Rules: "marks" is the marks obtained as a number. Skip totals, averages and header rows. If a row has a percentage instead of marks, convert it using the exam total given in the context. Use "" when a roll number or name is unreadable.`,
  fee: `Read this fee challan / bank deposit slip / handwritten fee receipt from a Pakistani college and return the payment details.
Return JSON exactly like:
{"fields":{"roll_number":"","student_name":"","amount":0,"payment_date":"YYYY-MM-DD","fee_type":"","notes":""}}
Rules: "amount" is the rupee amount paid as a plain number without commas or "Rs". Use "" or 0 when a value is not clearly visible. Never invent data.`,
  attendance: ATTENDANCE_PROMPT,
};

/** Extracts the first JSON object found in a model reply. */
function parseJson(text: string): Record<string, unknown> {
  const cleaned = text
    .replace(/```json/gi, "```")
    .split("```")
    .join("\n");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start)
    throw new Error("The photo could not be read. Try again with a clearer, well-lit picture.");
  return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
}

/**
 * Reads a photographed document (admission form, award list, fee slip) and
 * returns structured fields the clerk can review before saving.
 */
export const extractFromPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI reading is not configured for this college portal yet.");

    const prompt = data.hint
      ? `${INSTRUCTIONS[data.kind]}\n\nContext: ${data.hint}`
      : INSTRUCTIONS[data.kind];

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content: "You read scanned college paperwork and reply with JSON only. No commentary.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              data.image.startsWith("data:application/pdf")
                ? { type: "file", file: { filename: "register.pdf", file_data: data.image } }
                : { type: "image_url", image_url: { url: data.image } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429)
        throw new Error("Too many scans at once. Wait a moment and try again.");
      if (res.status === 402)
        throw new Error(
          "AI credits for this workspace are exhausted. Ask the administrator to top up.",
        );
      if (res.status === 403)
        throw new Error("AI reading is blocked for this workspace by an administrator.");
      throw new Error(`Could not read the document (${res.status}). ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = json.choices?.[0]?.message?.content ?? "";
    // Serialized as a string: the shape differs per document kind.
    return { json: JSON.stringify(parseJson(text)) };
  });
