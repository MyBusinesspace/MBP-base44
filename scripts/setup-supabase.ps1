# تهيئة جداول MPB على Supabase (مرة واحدة)
# يستخدم اتصال Direct (5432) للـ migrations — Pooler (6543) للتطبيق على Vercel فقط
#
# الاستخدام (pooler أو direct):
#   .\scripts\setup-supabase.ps1 "postgresql://postgres.REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true"
#   .\scripts\setup-supabase.ps1 "postgresql://postgres:PASSWORD@db.REF.supabase.co:5432/postgres"

param(
  [Parameter(Mandatory = $true)]
  [string]$DatabaseUrl
)

Write-Host "Running Supabase setup (migrations via Direct 5432)..." -ForegroundColor Cyan
node server/setup-supabase.js $DatabaseUrl

if ($LASTEXITCODE -eq 0) {
  Write-Host "`nDone. Login: admin@local.dev / admin123" -ForegroundColor Green
  Write-Host "Set POOLER URL in Vercel Environment Variables, then Redeploy." -ForegroundColor Yellow
}
