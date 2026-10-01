# GDC Chamla Admin

Build a student management system for a government college called "GDC Chamla" (Government Degree College Chamla, District Buner, Khyber Pakhtunkhwa, Pakistan). This is a real administrative tool used by college staff and teachers, not a demo.

Set up Supabase as the backend with the following tables:

1. profiles (linked to Supabase auth.users)

   - id, full_name, role (enum: 'admin', 'teacher'), phone, created_at

2. programs (lookup table, so new programs can be added without code changes)

   - id, name (e.g. "Pre-Medical", "Pre-Engineering", "Arts & Humanities", "Neuroscience", "AD Computer Science", "AD Urdu"), type (enum: 'stream' or 'ad_program'), active (boolean)

3. students

   - id, roll_number (unique), full_name, father_name, cnic_bform, date_of_birth, gender, photo_url, student_contact, guardian_contact, address, email, program_id (references programs), session (e.g. "2026-28"), section, status (enum: 'active', 'struck_off', 'graduated', 'left'), admission_date, board_registration_number (nullable, for future use), board_registration_status (enum: 'not_started', 'submitted', 'confirmed', default 'not_started'), created_at

4. attendance_records

   - id, student_id (references students), date, status (enum: 'present', 'absent'), marked_by (references profiles), created_at

   - unique constraint on (student_id, date)

5. fee_types (lookup table — leave empty for now, admin fills it in via the app)

   - id, name, default_amount, active

6. fee_transactions

   - id, student_id (references students), fee_type_id (references fee_types), amount, payment_date, receipt_number (auto-generated, unique, sequential), recorded_by (references profiles), notes, created_at

7. struck_off_events

   - id, student_id, struck_off_date, reason (e.g. 'attendance', 'manual'), consecutive_absences_at_time, reinstated (boolean, default false), reinstated_date, readmission_fee_transaction_id (nullable, references fee_transactions)

Enable Row Level Security on all tables:

- Admins can read/write everything.

- Teachers can read all student basic info (name, roll, photo, program, contact) but CANNOT read or write fee_transactions or struck_off_events.

- Teachers can read/write attendance_records only for students, and only mark attendance (not edit historical records older than 3 days without admin approval).

Set up Supabase Auth with email/password login. Create a simple login screen. After login, route admins to /admin and teachers to /teacher based on their profile role.

Use a clean, professional, mobile-responsive design. Primary color: deep forest green (#1F3D2B). Accent color: warm brass/gold (#B8894A). Background: warm off-white (#FAF7F0). Use a serif font (Lora) for headings and a clean sans-serif (Inter) for body text and data tables. This should feel like official college administrative software — trustworthy and calm, not flashy.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://gdc-chamla-connect.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8dbc483f-f9db-4368-bb43-b37f08c6f5f0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
