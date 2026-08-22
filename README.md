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

## اجرا با Docker

برای حالت نمایشی بدون Supabase:

```bash
docker build -t khanehyar .
docker run --rm -p 3000:3000 khanehyar
```

برای اتصال به Supabase، متغیرهای عمومی هنگام build داخل bundle مرورگر قرار می‌گیرند و ایمیل مجاز هنگام اجرا تعیین می‌شود:

```bash
docker build -t khanehyar \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="https://YOUR_PROJECT.supabase.co" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="YOUR_ANON_KEY" .

docker run --rm -p 3000:3000 \
  -e ALLOWED_EMAIL="you@example.com" \
  khanehyar
```

پس از اجرا، برنامه روی `http://localhost:3000` در دسترس است.
