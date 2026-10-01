export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      absentee_fines: {
        Row: {
          amount: number
          attendance_record_id: string
          created_at: string
          date: string
          id: string
          lecture_number: number
          session_label: string
          student_id: string
          waive_reason: string | null
          waived_amount: number
          waived_at: string | null
          waived_by: string | null
        }
        Insert: {
          amount?: number
          attendance_record_id: string
          created_at?: string
          date: string
          id?: string
          lecture_number?: number
          session_label?: string
          student_id: string
          waive_reason?: string | null
          waived_amount?: number
          waived_at?: string | null
          waived_by?: string | null
        }
        Update: {
          amount?: number
          attendance_record_id?: string
          created_at?: string
          date?: string
          id?: string
          lecture_number?: number
          session_label?: string
          student_id?: string
          waive_reason?: string | null
          waived_amount?: number
          waived_at?: string | null
          waived_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "absentee_fines_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: true
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absentee_fines_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absentee_fines_waived_by_fkey"
            columns: ["waived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admission_announcements: {
        Row: {
          application_deadline: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          application_deadline?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          application_deadline?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      attendance_records: {
        Row: {
          created_at: string
          date: string
          fine_exempt: boolean
          id: string
          lecture_number: number
          marked_by: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          fine_exempt?: boolean
          id?: string
          lecture_number?: number
          marked_by?: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Update: {
          created_at?: string
          date?: string
          fine_exempt?: boolean
          id?: string
          lecture_number?: number
          marked_by?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      campus_gallery: {
        Row: {
          caption: string | null
          created_at: string
          display_order: number
          id: string
          image_url: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          display_order?: number
          id?: string
          image_url: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      class_timetable: {
        Row: {
          class_id: string
          created_at: string
          created_by: string | null
          day_of_week: number
          end_time: string | null
          id: string
          lecture_number: number
          program_id: string | null
          room: string | null
          start_time: string
          subject: string | null
          teacher_profile_id: string | null
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          created_by?: string | null
          day_of_week: number
          end_time?: string | null
          id?: string
          lecture_number?: number
          program_id?: string | null
          room?: string | null
          start_time: string
          subject?: string | null
          teacher_profile_id?: string | null
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          created_by?: string | null
          day_of_week?: number
          end_time?: string | null
          id?: string
          lecture_number?: number
          program_id?: string | null
          room?: string | null
          start_time?: string
          subject?: string | null
          teacher_profile_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_timetable_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_timetable_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_timetable_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_timetable_teacher_profile_id_fkey"
            columns: ["teacher_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          program_id: string | null
          semester_number: number | null
          session: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          program_id?: string | null
          semester_number?: number | null
          session?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          program_id?: string | null
          semester_number?: number | null
          session?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_results: {
        Row: {
          created_at: string
          exam_id: string
          exam_subject_id: string | null
          id: string
          marks_obtained: number
          recorded_by: string | null
          remarks: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          exam_id: string
          exam_subject_id?: string | null
          id?: string
          marks_obtained?: number
          recorded_by?: string | null
          remarks?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          exam_id?: string
          exam_subject_id?: string | null
          id?: string
          marks_obtained?: number
          recorded_by?: string | null
          remarks?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_results_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_results_exam_subject_id_fkey"
            columns: ["exam_subject_id"]
            isOneToOne: false
            referencedRelation: "exam_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_results_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_subjects: {
        Row: {
          created_at: string
          display_order: number
          exam_id: string
          id: string
          name: string
          total_marks: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          exam_id: string
          id?: string
          name: string
          total_marks?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          exam_id?: string
          id?: string
          name?: string
          total_marks?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_subjects_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          class_id: string | null
          created_at: string
          created_by: string | null
          exam_date: string
          finalized_at: string | null
          finalized_by: string | null
          id: string
          name: string
          program_id: string | null
          subject: string | null
          total_marks: number
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          exam_date?: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          name: string
          program_id?: string | null
          subject?: string | null
          total_marks?: number
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          exam_date?: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          name?: string
          program_id?: string | null
          subject?: string | null
          total_marks?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exams_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_finalized_by_fkey"
            columns: ["finalized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      faculty_members: {
        Row: {
          created_at: string
          department: string | null
          designation: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          photo_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          designation?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          photo_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          designation?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          photo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fee_charges: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          due_date: string
          fee_type_id: string | null
          id: string
          notes: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          due_date?: string
          fee_type_id?: string | null
          id?: string
          notes?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          due_date?: string
          fee_type_id?: string | null
          id?: string
          notes?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_charges_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_charges_fee_type_id_fkey"
            columns: ["fee_type_id"]
            isOneToOne: false
            referencedRelation: "fee_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_charges_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_dues: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          due_date: string
          fee_type_id: string | null
          id: string
          notes: string | null
          session_label: string
          status: Database["public"]["Enums"]["fee_due_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          due_date?: string
          fee_type_id?: string | null
          id?: string
          notes?: string | null
          session_label?: string
          status?: Database["public"]["Enums"]["fee_due_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          due_date?: string
          fee_type_id?: string | null
          id?: string
          notes?: string | null
          session_label?: string
          status?: Database["public"]["Enums"]["fee_due_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_dues_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_dues_fee_type_id_fkey"
            columns: ["fee_type_id"]
            isOneToOne: false
            referencedRelation: "fee_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_dues_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_transactions: {
        Row: {
          amount: number
          created_at: string
          fee_due_id: string | null
          fee_type_id: string | null
          id: string
          notes: string | null
          payment_date: string
          receipt_number: string
          recorded_by: string | null
          student_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          fee_due_id?: string | null
          fee_type_id?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          receipt_number?: string
          recorded_by?: string | null
          student_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          fee_due_id?: string | null
          fee_type_id?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          receipt_number?: string
          recorded_by?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_transactions_fee_due_id_fkey"
            columns: ["fee_due_id"]
            isOneToOne: false
            referencedRelation: "fee_dues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_transactions_fee_type_id_fkey"
            columns: ["fee_type_id"]
            isOneToOne: false
            referencedRelation: "fee_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_transactions_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_transactions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_types: {
        Row: {
          active: boolean
          created_at: string
          default_amount: number
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          default_amount?: number
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          default_amount?: number
          id?: string
          name?: string
        }
        Relationships: []
      }
      fine_waiver_events: {
        Row: {
          amount: number
          created_at: string
          fines_affected: number
          id: string
          performed_by: string | null
          reason: string | null
          session_label: string
          student_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          fines_affected?: number
          id?: string
          performed_by?: string | null
          reason?: string | null
          session_label: string
          student_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          fines_affected?: number
          id?: string
          performed_by?: string | null
          reason?: string | null
          session_label?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fine_waiver_events_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fine_waiver_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      hostel_allotments: {
        Row: {
          admission_date: string
          bed_number: number
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          room_id: string
          status: Database["public"]["Enums"]["hostel_allotment_status"]
          student_id: string
          updated_at: string
          vacate_date: string | null
        }
        Insert: {
          admission_date?: string
          bed_number?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          room_id: string
          status?: Database["public"]["Enums"]["hostel_allotment_status"]
          student_id: string
          updated_at?: string
          vacate_date?: string | null
        }
        Update: {
          admission_date?: string
          bed_number?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          room_id?: string
          status?: Database["public"]["Enums"]["hostel_allotment_status"]
          student_id?: string
          updated_at?: string
          vacate_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hostel_allotments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hostel_allotments_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "hostel_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hostel_allotments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      hostel_fee_transactions: {
        Row: {
          allotment_id: string
          amount: number
          created_at: string
          id: string
          notes: string | null
          payment_date: string
          payment_method: string
          period_month: string
          receipt_number: string
          recorded_by: string | null
          updated_at: string
        }
        Insert: {
          allotment_id: string
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          period_month?: string
          receipt_number?: string
          recorded_by?: string | null
          updated_at?: string
        }
        Update: {
          allotment_id?: string
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          period_month?: string
          receipt_number?: string
          recorded_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hostel_fee_transactions_allotment_id_fkey"
            columns: ["allotment_id"]
            isOneToOne: false
            referencedRelation: "hostel_allotments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hostel_fee_transactions_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hostel_rooms: {
        Row: {
          block: string
          capacity: number
          created_at: string
          floor: string | null
          id: string
          notes: string | null
          room_number: string
          updated_at: string
        }
        Insert: {
          block?: string
          capacity?: number
          created_at?: string
          floor?: string | null
          id?: string
          notes?: string | null
          room_number: string
          updated_at?: string
        }
        Update: {
          block?: string
          capacity?: number
          created_at?: string
          floor?: string | null
          id?: string
          notes?: string | null
          room_number?: string
          updated_at?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          can_add: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          created_at: string
          id: string
          module: string
          role: string
          updated_at: string
        }
        Insert: {
          can_add?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module: string
          role: string
          updated_at?: string
        }
        Update: {
          can_add?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      programs: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          type: Database["public"]["Enums"]["program_type"]
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          type?: Database["public"]["Enums"]["program_type"]
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["program_type"]
        }
        Relationships: []
      }
      session_events: {
        Row: {
          archived_absences: number
          archived_fine_amount: number
          archived_fine_count: number
          created_at: string
          id: string
          new_session_label: string
          previous_session_label: string | null
          start_date: string
          started_by: string | null
        }
        Insert: {
          archived_absences?: number
          archived_fine_amount?: number
          archived_fine_count?: number
          created_at?: string
          id?: string
          new_session_label: string
          previous_session_label?: string | null
          start_date: string
          started_by?: string | null
        }
        Update: {
          archived_absences?: number
          archived_fine_amount?: number
          archived_fine_count?: number
          created_at?: string
          id?: string
          new_session_label?: string
          previous_session_label?: string | null
          start_date?: string
          started_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_events_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      site_banners: {
        Row: {
          created_at: string
          display_order: number
          id: string
          image_url: string
          is_active: boolean
          subtitle: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          image_url: string
          is_active?: boolean
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string
          is_active?: boolean
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          college_name: string
          facebook_page_url: string
          id: string
          logo_url: string | null
          updated_at: string
          whatsapp_default_message: string | null
          whatsapp_number: string | null
        }
        Insert: {
          college_name?: string
          facebook_page_url?: string
          id?: string
          logo_url?: string | null
          updated_at?: string
          whatsapp_default_message?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          college_name?: string
          facebook_page_url?: string
          id?: string
          logo_url?: string | null
          updated_at?: string
          whatsapp_default_message?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      struck_off_events: {
        Row: {
          consecutive_absences_at_time: number | null
          created_at: string
          id: string
          readmission_fee_transaction_id: string | null
          reason: string
          reinstated: boolean
          reinstated_date: string | null
          struck_off_date: string
          student_id: string
        }
        Insert: {
          consecutive_absences_at_time?: number | null
          created_at?: string
          id?: string
          readmission_fee_transaction_id?: string | null
          reason?: string
          reinstated?: boolean
          reinstated_date?: string | null
          struck_off_date?: string
          student_id: string
        }
        Update: {
          consecutive_absences_at_time?: number | null
          created_at?: string
          id?: string
          readmission_fee_transaction_id?: string | null
          reason?: string
          reinstated?: boolean
          reinstated_date?: string | null
          struck_off_date?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "struck_off_events_readmission_fee_transaction_id_fkey"
            columns: ["readmission_fee_transaction_id"]
            isOneToOne: false
            referencedRelation: "fee_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "struck_off_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_portal_accounts: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: string
          login_id: string
          student_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          login_id: string
          student_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          login_id?: string
          student_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_portal_accounts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_portal_accounts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          address: string | null
          admission_date: string | null
          board_registration_number: string | null
          board_registration_status: Database["public"]["Enums"]["board_reg_status"]
          class_id: string | null
          cnic_bform: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          father_contact: string | null
          father_name: string | null
          full_name: string
          gender: string | null
          guardian_contact: string | null
          guardian_name: string | null
          id: string
          photo_url: string | null
          program_id: string | null
          roll_number: string
          section: string | null
          session: string | null
          status: Database["public"]["Enums"]["student_status"]
          student_contact: string | null
        }
        Insert: {
          address?: string | null
          admission_date?: string | null
          board_registration_number?: string | null
          board_registration_status?: Database["public"]["Enums"]["board_reg_status"]
          class_id?: string | null
          cnic_bform?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          father_contact?: string | null
          father_name?: string | null
          full_name: string
          gender?: string | null
          guardian_contact?: string | null
          guardian_name?: string | null
          id?: string
          photo_url?: string | null
          program_id?: string | null
          roll_number: string
          section?: string | null
          session?: string | null
          status?: Database["public"]["Enums"]["student_status"]
          student_contact?: string | null
        }
        Update: {
          address?: string | null
          admission_date?: string | null
          board_registration_number?: string | null
          board_registration_status?: Database["public"]["Enums"]["board_reg_status"]
          class_id?: string | null
          cnic_bform?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          father_contact?: string | null
          father_name?: string | null
          full_name?: string
          gender?: string | null
          guardian_contact?: string | null
          guardian_name?: string | null
          id?: string
          photo_url?: string | null
          program_id?: string | null
          roll_number?: string
          section?: string | null
          session?: string | null
          status?: Database["public"]["Enums"]["student_status"]
          student_contact?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_classes: {
        Row: {
          class_id: string | null
          created_at: string
          id: string
          label: string | null
          profile_id: string
          program_id: string | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          id?: string
          label?: string | null
          profile_id: string
          program_id?: string | null
        }
        Update: {
          class_id?: string | null
          created_at?: string
          id?: string
          label?: string | null
          profile_id?: string
          program_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_classes_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_classes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_classes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permission_overrides: {
        Row: {
          can_add: boolean | null
          can_delete: boolean | null
          can_edit: boolean | null
          can_view: boolean | null
          created_at: string
          id: string
          module: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          can_add?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string
          id?: string
          module: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          can_add?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string
          id?: string
          module?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permission_overrides_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can: { Args: { _action: string; _module: string }; Returns: boolean }
      dashboard_stats: { Args: { _days?: number }; Returns: Json }
      exam_is_open: { Args: { _exam_id: string }; Returns: boolean }
      get_permission: {
        Args: { _action: string; _module: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      portal_student_id: { Args: never; Returns: string }
      refresh_fee_due_status: { Args: { _due_id: string }; Returns: undefined }
      save_attendance: {
        Args: {
          _date: string
          _fine_exempt?: boolean
          _lecture_number?: number
          _status: Database["public"]["Enums"]["attendance_status"]
          _student_ids: string[]
        }
        Returns: undefined
      }
      sync_absentee_fine_due: {
        Args: { _session: string; _student_id: string }
        Returns: undefined
      }
      waive_absentee_fines: {
        Args: {
          _amount: number
          _reason?: string
          _session: string
          _student_ids: string[]
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "teacher"
        | "super_admin"
        | "principal"
        | "coe"
        | "coordinator"
        | "clerk"
      attendance_status: "present" | "absent" | "leave"
      board_reg_status: "not_started" | "submitted" | "confirmed"
      fee_due_status: "unpaid" | "partial" | "paid"
      hostel_allotment_status: "active" | "vacated"
      program_type: "stream" | "ad_program"
      student_status: "active" | "struck_off" | "graduated" | "left"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "teacher",
        "super_admin",
        "principal",
        "coe",
        "coordinator",
        "clerk",
      ],
      attendance_status: ["present", "absent", "leave"],
      board_reg_status: ["not_started", "submitted", "confirmed"],
      fee_due_status: ["unpaid", "partial", "paid"],
      hostel_allotment_status: ["active", "vacated"],
      program_type: ["stream", "ad_program"],
      student_status: ["active", "struck_off", "graduated", "left"],
    },
  },
} as const
