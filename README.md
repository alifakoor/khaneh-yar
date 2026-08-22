# خانه‌یار مشهد

وب‌اپ شخصی فارسی برای ثبت، امتیازدهی و مقایسه گزینه‌های خرید خانه.

## اجرا

```bash
npm install
npm run dev
```

بدون متغیر محیطی، برنامه در حالت نمایشی با داده نمونه و `localStorage` اجرا می‌شود. برای استفاده آنلاین، یک پروژه Supabase بسازید، فایل `supabase/migrations/001_initial.sql` را در SQL Editor اجرا کنید، کاربر شخصی را در Authentication ایجاد کنید و مقادیر `.env.example` را در `.env.local` و Vercel قرار دهید. مقدار `ALLOWED_EMAIL` باید دقیقاً ایمیل همان کاربر باشد. ثبت‌نام عمومی را در تنظیمات Supabase خاموش نگه دارید.

## کنترل کیفیت

```bash
npm test
npm run build
```
