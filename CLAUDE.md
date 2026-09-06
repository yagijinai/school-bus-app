# School Bus App Project Guidelines

Please refer to `APP_SPEC.md` for permanent application specifications.

## Core Rules
1. **Login Flow**: Top page must start with the 2-choice flow:
   - Choice 1: "Googleアカウントで入る" (Sign in with Google -> Role selection modal: Parent / Driver / Admin)
   - Choice 2: "前と同じGoogleアカウントで入る" (Resume previous session directly)
2. **Data Source**: All student and guardian data is sourced strictly from GAS API (Google Sheets). Never issue queries to Supabase database tables (`supabase.from(...)`).
3. **Fallback Guarantee**: Always guarantee fallback students (佐藤 太郎 & 佐藤 次郎) for `yagijinai@gmail.com`. Never render an "unregistered warning card".
4. **Deploy Command**: Deploy to Vercel production using `npx vercel --prod`.
5. **Operation Schedule Columns (運行予定カレンダー)**:
   - A: ID (row - 1 numeric sequence)
   - B: Date (`YYYY/MM/DD` format)
   - C: Student Name
   - D: Morning Status (`乗る` or `""`)
   - E: Afternoon Status (`乗らない` only when not riding, `""` when riding)
   - F~H: Afternoon Trip 1~3 (trip departure time e.g. `15:30` or `""`)
   - I: Note (`""` if empty)
   - J: Updated At (`YYYY/MM/DD HH:mm:ss`)
   - K: Parent Email
