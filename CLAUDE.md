## 🚨 CRITICAL MANDATORY INSTRUCTION BEFORE ANY ACTION 🚨
You MUST read `PROJECT_RULES.md` at the very beginning of EVERY session and EVERY prompt before writing any code or planning any implementation.
Never overwrite, simplify, or regress any feature listed in `PROJECT_RULES.md`.
Every proposed change must explicitly confirm that none of the 7 core requirements in `PROJECT_RULES.md` are broken.

---

# School Bus App Project Guidelines

Please refer to `PROJECT_RULES.md` for permanent application specifications, development rules, and the 7 invariant core requirements.

## Core Rules & Commands
1. **Mandatory First Action**: Always check and adhere to `PROJECT_RULES.md`.
2. **Data Source**: All student, guardian, bus stop, schedule, and timetable data is sourced strictly from GAS API (Google Sheets). Never issue queries to Supabase database tables (`supabase.from(...)`).
3. **GAS Endpoint**:
   `https://script.google.com/macros/s/AKfycbxm4XlGSbamPsbQyKmqg5ia5pJ85LPmgX83Sn-RhNV3gdOcwZpvMB2Oju3z41EBk-6omQ/exec`
4. **Deploy Protocol**:
   - `npm run build`
   - `git add .` && `git commit` && `git push origin main`
   - `npx vercel build --yes --prod`
   - `npx vercel deploy --prebuilt --prod`
   - Production domain: `https://school-bus-app-sigma.vercel.app`
5. **Visual Verification Protocol**:
   Always verify in mobile viewport (375px × 812px) using browser agent before finalizing.
