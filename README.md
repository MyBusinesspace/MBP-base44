# MyBusinessPace (MPB)

CRM محلي مبني على React + Vite، مع API Express و PostgreSQL — يمكن تشغيله **محلياً** أو نشره تجريبياً على **Vercel + Supabase**.

## التشغيل المحلي (الافتراضي)

```bash
npm install
cp .env.example .env   # أو انسخ يدوياً وعدّل DATABASE_URL
npm run db:setup       # مرة واحدة — جداول + بيانات تجريبية
npm start              # API (3001) + الواجهة (5173)
```

- **الواجهة:** http://localhost:5173  
- **API:** http://localhost:3001/health  
- **تسجيل الدخول:** `admin@local.dev` / `admin123` أو Google (إن وُجد في `.env`)

> استخدم `npm start` أو `npm run dev` — لا تشغّل `vite` وحده (لن تُجلب البيانات بدون API).

## نشر تجريبي (Vercel + Supabase)

دليل كامل: **[docs/DEPLOY-VERCEL-SUPABASE.md](docs/DEPLOY-VERCEL-SUPABASE.md)**

**Vercel:**  
1. استورد **`.env.vercel`** في Vercel → Settings → Environment Variables → Import .env  
2. `git push` ثم Redeploy  
3. تحقق: `/api/config/status` → `database_host` = `aws-1-ap-south-1.pooler.supabase.com` و **`auth_api_version`** = `2026-05-22-user-persist-v5` (إن لم يظهر = النشر القديم — `npx vercel deploy --prod` من مجلد المشروع بعد `vercel link --project mbp-base44`)

4. بعد **Google login** → Supabase `ent_user` يجب أن يظهر صف جديد ببريدك (`google-...` أو بريد Gmail)

5. **دعوات المستخدمين بالبريد:** أضف في Vercel `RESEND_API_KEY` + `EMAIL_FROM` (من [resend.com](https://resend.com) بعد التحقق من النطاق) — تحقق: `/api/config/status` → `email_configured: true`

1. أنشئ مشروع Supabase وانسخ `DATABASE_URL` (pooler port 6543)  
2. من جهازك: `npm run db:setup` مع `DATABASE_URL` لـ Supabase  
3. اربط المستودع بـ Vercel واضبط متغيرات البيئة (انظر `.env.example`)  
4. `vercel --prod` أو Deploy من لوحة Vercel  

المحلي يبقى كما هو — فقط تغيّر `DATABASE_URL` و `WEB_URL` حسب البيئة.

## هيكل المشروع

| المجلد | الوظيفة |
|--------|---------|
| `src/` | واجهة React |
| `server/` | API Express + PostgreSQL |
| `api/handler.js` | نقطة دخول Vercel Serverless |
| `entities_del/` | مخططات الكيانات |
| `base44/functions/` | مرجع دوال Base44 القديمة |

## أوامر مفيدة

| الأمر | الوصف |
|-------|--------|
| `npm start` | تشغيل محلي كامل |
| `npm run db:setup` | إنشاء DB + seed |
| `npm run api:stop` | إيقاف API على المنفذ 3001 |
| `npm run vercel:prod` | نشر على Vercel |

## متغيرات البيئة

انظر **[.env.example](.env.example)** — محلي، Supabase، و Vercel.
