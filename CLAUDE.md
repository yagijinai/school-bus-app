# School Bus App Project Guidelines

Please refer to `APP_SPEC.md` for permanent application specifications.

## Core Rules
1. **Login Flow**: Top page must start with the 2-choice flow:
   - Choice 1: "Googleアカウントで入る" (Sign in with Google -> Role selection modal: Parent / Driver / Admin)
   - Choice 2: "前と同じGoogleアカウントで入る" (Resume previous session directly)
2. **Data Source**: All student and guardian data is sourced strictly from GAS API (Google Sheets). Never issue queries to Supabase database tables (`supabase.from(...)`).
3. **Fallback Guarantee**: Always guarantee fallback students (佐藤 太郎 & 佐藤 次郎) for `yagijinai@gmail.com`. Never render an "unregistered warning card".
4. **Deploy Command**: Deploy to Vercel production using `npx vercel --prod`.
