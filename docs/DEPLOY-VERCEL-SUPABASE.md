# نشر تجريبي على Vercel + Supabase (مع الإبقاء على المحلي)

يمكنك تشغيل المشروع **محلياً** كما هو، أو نشر نسخة تجريبية على **Vercel** مع قاعدة **Supabase** — نفس الكود، متغيرات بيئة مختلفة.

## البنية

| البيئة | الواجهة | API | قاعدة البيانات |
|--------|---------|-----|----------------|
| **محلي** | Vite `:5173` | Express `:3001` | PostgreSQL محلي |
| **Vercel** | `dist/` ثابت | Serverless `api/handler.js` | Supabase PostgreSQL |

---

## 1) إعداد Supabase

1. أنشئ مشروعاً على [supabase.com](https://supabase.com)
2. **Project Settings → Database → Connection string**
3. اختر **URI** مع **Transaction pooler** (منفذ **6543**)
4. انسخ الرابط واستبدل `[YOUR-PASSWORD]`

مثال (**انسخ Transaction pooler من Dashboard** — لا تستخدم `db.xxx` على Vercel، IPv6 فقط):

```env
DATABASE_URL=postgresql://postgres.PROJECT_REF:YOUR_PASSWORD@aws-1-ap-south-1.pooler.supabase.com:6543/postgres
SUPABASE_REGION=ap-south-1
SUPABASE_POOLER_PREFIX=aws-1
SUPABASE_DB=true
SKIP_SCHEMA_ON_BOOT=true
```

> `db.PROJECT_REF.supabase.co` يعمل محلياً للـ migrations لكن **يفشل على Vercel** (`ENOTFOUND`) لأن المضيف IPv6 فقط.

### تهيئة الجداول (مرة واحدة من جهازك)

على جهازك (PowerShell)، مع رابط Supabase:

```powershell
# يقبل رابط Pooler أو Direct — السكربت يستخدم Direct (5432) تلقائياً للـ migrations
.\scripts\setup-supabase.ps1 "postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres"

# أو:
.\scripts\setup-supabase.ps1 "postgresql://postgres:PASSWORD@db.aevwxwintewlcgxwvkrc.supabase.co:5432/postgres"
```

> **مهم:** لا تستخدم `npm run db:setup` مع Supabase — يحاول إنشاء قاعدة `mpb_crm` محلياً. استخدم `db:setup:supabase` أو السكربت أعلاه.

هذا ينشئ الجداول ويضيف `admin@local.dev` / `admin123`.

---

## 2) نشر على Vercel

### أ) عبر CLI

```bash
npm i -g vercel
vercel login
vercel link
vercel env pull .env.vercel.local   # اختياري
vercel --prod
```

### ب) عبر GitHub

1. ارفع المشروع إلى GitHub
2. [vercel.com/new](https://vercel.com/new) → Import المستودع
3. Framework: **Other** (يُستخدم `vercel.json`)
4. Build Command: `npm run build`
5. Output: `dist`

### متغيرات البيئة في Vercel (Settings → Environment Variables)

> **مهم:** لا تستخدم بادئة `VITE_` إلا لـ `VITE_APP_ID` (للبناء فقط). باقي الأسرار **بدون** `VITE_` لأنها للخادم (Serverless).

فعّل كل متغير لـ **Production** و **Preview** (و Development إن رغبت).

| المتغير | القيمة | ملاحظة |
|---------|--------|--------|
| `DATABASE_URL` | **pooler** `aws-1-ap-south-1.pooler.supabase.com:6543` — ليس `db.xxx` | مطلوب |
| `SUPABASE_REGION` | `ap-south-1` | مطلوب إذا كان `DATABASE_URL` لا يزال `db.xxx` |
| `SUPABASE_POOLER_PREFIX` | `aws-1` | مع المنطقة أعلاه |
| `SUPABASE_DB` | `true` | مطلوب لـ SSL |
| `SKIP_SCHEMA_ON_BOOT` | `true` | يمنع تشغيل migrations عند الإقلاع فقط — **لا يغيّر** رابط الاتصال (ابقَ على pooler 6543) |
| `VITE_APP_ID` | `mpb-local` | للواجهة عند البناء |
| `JWT_SECRET` | سلسلة عشوائية طويلة | مطلوب |
| `AUTH_REQUIRED` | `true` | |
| `WEB_URL` | `https://your-app.vercel.app` | بدون `/` في النهاية و**بدون** `=` في البداية (خطأ شائع: `=https://...`) |
| `GOOGLE_OAUTH_CLIENT_ID` | من Google Console | للخادم — **بدون** VITE_ |
| `VITE_GOOGLE_OAUTH_CLIENT_ID` | **نفس قيمة** Client ID أعلاه | للواجهة عند **البناء** (يظهر زر Google) |
| `GOOGLE_OAUTH_CLIENT_SECRET` | من Google Console | **بدون** VITE_ |
| `GOOGLE_OAUTH_CALLBACK_URL` | `https://your-app.vercel.app/api/auth/google/callback` | |
| `GOOGLE_PLACES_API_KEY` | اختياري | |
| `DAILY_API_KEY` | اختياري | |

بعد إضافة المتغيرات: **Redeploy** (Deployments → ⋮ → Redeploy) — التغييرات لا تُطبَّق على نشر قديم.

### خطأ `getaddrinfo ENOTFOUND db.xxx`

`DATABASE_URL` غير صحيح في Vercel. انسخ **Connection string → URI** من Supabase (Transaction pooler, port **6543**) واستبدل كلمة المرور الحقيقية — لا تترك `[YOUR-PASSWORD]` في النص.

### خطأ `getaddrinfo ENOTFOUND db.xxx.supabase.co` على Vercel

`db.PROJECT_REF.supabase.co` **IPv6 فقط** — Vercel لا يتصل به. استخدم **Pooler** من Dashboard (مضيف `aws-*-REGION.pooler.supabase.com`).

> إذا كان `DATABASE_URL` صحيحاً (pooler) وما زال الخطأ يظهر: تأكد أن آخر كود مُرفوع — إصدار قديم كان يحوّل الاتصال إلى `db.xxx` عندما `SKIP_SCHEMA_ON_BOOT=true`.

**في Vercel أضف:**
```env
DATABASE_URL=postgresql://postgres.aevwxwintewlcgxwvkrc:PASSWORD@aws-1-ap-south-1.pooler.supabase.com:6543/postgres
SUPABASE_REGION=ap-south-1
SUPABASE_POOLER_PREFIX=aws-1
```
(المنطقة من Supabase → Database → Connection string — لمشروعك `ap-south-1` و `aws-1`، وليس `eu-central-1`.)

### خطأ `Tenant or user not found`

منطقة أو بادئة pooler خاطئة. انسخ الرابط **كاملاً** من Dashboard — لا تخمّن `aws-0-eu-central-1`.

| الاستخدام | الرابط |
|-----------|--------|
| محلي + migrations (Direct) | `postgresql://postgres:PASSWORD@db.aevwxwintewlcgxwvkrc.supabase.co:5432/postgres` |
| Vercel (Transaction pooler) | `postgresql://postgres.aevwxwintewlcgxwvkrc:PASSWORD@aws-1-ap-south-1.pooler.supabase.com:6543/postgres` |

### خطأ `500 FUNCTION_INVOCATION_FAILED`

1. تأكد أن آخر كود مُرفوع إلى GitHub (إصلاح `api/index.js` + `uploads`)
2. **Redeploy** بعد تغيير Environment Variables
3. راجع **Logs → Functions** في Vercel لرسالة الخطأ الدقيقة

### التحقق من المتغيرات

افتح: `https://your-app.vercel.app/api/config/status`

يجب أن ترى:
- `env_database_host`: `aws-1-ap-south-1.pooler.supabase.com` (وليس `db.xxx`)
- `database_host`: نفس pooler
- `database_warning`: `null`

إذا `env_database_host` = `db.aevwxwintewlcgxwvkrc.supabase.co` → غيّر `DATABASE_URL` في Vercel ثم **Redeploy**.

يجب أن ترى `"google_oauth": true` و `"database": "configured"`.

**Google OAuth:** أضف في Google Console redirect URI للإنتاج:
```
https://your-app.vercel.app/api/auth/google/callback
```

---

## 3) التشغيل المحلي (بدون تغيير)

```bash
npm install
# انسخ .env.example إلى .env وعدّل DATABASE_URL للمحلي
npm run db:setup    # مرة واحدة
npm start           # API + Vite معاً
```

- الواجهة: http://localhost:5173  
- API: http://localhost:3001  

للتجربة مع Supabase **محلياً** (اختياري):

```powershell
$env:DATABASE_URL="postgresql://...supabase...6543/postgres"
$env:SUPABASE_DB="true"
npm start
```

---

## 4) التحقق بعد النشر

- `https://your-app.vercel.app/health` → `{ "ok": true }`
- `https://your-app.vercel.app/api/config/status`
- تسجيل الدخول: Email أو Google

---

## قيود النشر التجريبي

- **رفع الملفات** (`/uploads`) على Vercel مؤقت — يُفضّل لاحقاً Supabase Storage
- أول طلب بعد الخمول (cold start) قد يكون أبطأ
- نفّذ `db:setup` على Supabase من جهازك، لا تعتمد على تشغيل الـ schema تلقائياً على Vercel

---

## أوامر مفيدة

| الأمر | الوصف |
|-------|--------|
| `npm start` | محلي: API + واجهة |
| `npm run dev:web` | Vite فقط (يحتاج API منفصل) |
| `npm run db:setup` | إنشاء الجداول + seed |
| `vercel` | نشر تجريبي |
| `vercel --prod` | نشر إنتاج |
