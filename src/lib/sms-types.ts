export type ProgramType = "stream" | "ad_program";
export type StudentStatus = "active" | "struck_off" | "graduated" | "left";
export type BoardRegStatus = "not_started" | "submitted" | "confirmed";
export type AttendanceStatus = "present" | "absent" | "leave";

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  leave: "Leave",
};

export type Program = {
  id: string;
  name: string;
  type: ProgramType;
  active: boolean;
};

export type Student = {
  id: string;
  roll_number: string;
  full_name: string;
  father_name: string | null;
  father_contact: string | null;
  guardian_name: string | null;
  cnic_bform: string | null;
  date_of_birth: string | null;
  gender: string | null;
  photo_url: string | null;
  student_contact: string | null;
  guardian_contact: string | null;
  address: string | null;

  email: string | null;
  program_id: string | null;
  class_id: string | null;
  session: string | null;
  section: string | null;
  status: StudentStatus;
  admission_date: string | null;
  board_registration_number: string | null;
  board_registration_status: BoardRegStatus;
  created_at: string;
};

export type FeeType = {
  id: string;
  name: string;
  default_amount: number;
  active: boolean;
};

export type FeeTransaction = {
  id: string;
  student_id: string;
  fee_type_id: string | null;
  fee_due_id: string | null;
  amount: number;
  payment_date: string;
  receipt_number: string;
  recorded_by: string | null;
  notes: string | null;
  created_at: string;
};


export type StruckOffEvent = {
  id: string;
  student_id: string;
  struck_off_date: string;
  reason: string;
  consecutive_absences_at_time: number | null;
  reinstated: boolean;
  reinstated_date: string | null;
  readmission_fee_transaction_id: string | null;
};

export const STATUS_LABELS: Record<StudentStatus, string> = {
  active: "Active",
  struck_off: "Struck off",
  graduated: "Graduated",
  left: "Left",
};

export const BOARD_STATUS_LABELS: Record<BoardRegStatus, string> = {
  not_started: "Not started",
  submitted: "Submitted",
  confirmed: "Confirmed",
};

export function formatPKR(amount: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(amount);
}
