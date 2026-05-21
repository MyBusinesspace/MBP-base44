# تهيئة جداول MPB على Supabase (مرة واحدة)
# الاستخدام:
#   .\scripts\setup-supabase.ps1 "postgresql://postgres.xxx:PASSWORD@....pooler.supabase.com:6543/postgres"

param(
  [Parameter(Mandatory = $true)]
  [string]$DatabaseUrl
)

$env:DATABASE_URL = $DatabaseUrl
$env:SUPABASE_DB = "true"
$env:SKIP_SCHEMA_ON_BOOT = "true"

Write-Host "Running db:setup against Supabase..." -ForegroundColor Cyan
npm run db:setup

if ($LASTEXITCODE -eq 0) {
  Write-Host "`nDone. Login: admin@local.dev / admin123" -ForegroundColor Green
  Write-Host "Add DATABASE_URL to Vercel Environment Variables." -ForegroundColor Yellow
}
