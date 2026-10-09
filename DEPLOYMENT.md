# راه‌اندازی پایدار روی cPanel

این برنامه برای اجرای Node.js در cPanel/Passenger است. در بخش **Setup Node.js App**، نسخهٔ پشتیبانی‌شدهٔ Node.js را انتخاب کنید، ریشهٔ برنامه را همین پوشه قرار دهید و Startup file را `server.js` بگذارید. سپس `npm ci --omit=dev` را اجرا و برنامه را Restart کنید.

## محدودیت Process هاست (خطای 500 و `EAGAIN`)

هاست اشتراکی تعداد Process **و Thread** هر حساب را محدود می‌کند (در cPanel: Entry Processes / Number of Processes). موتور Prisma و sharp به‌طور پیش‌فرض به تعداد هسته‌های CPU سرور Thread می‌سازند، برای همین:

- موتور Prisma در `prisma/schema.prisma` روی `engineType = "library"` است (داخل همان Process نود؛ Process جداگانه spawn نمی‌شود). بعد از هر تغییر این فایل روی سرور `npx prisma generate` را اجرا کنید.
- `lib/prisma.js` تعداد Thread موتور را ۲ (`TOKIO_WORKER_THREADS`) و اتصال‌های دیتابیس را ۵ (`connection_limit`) می‌گذارد. اگر لازم شد می‌توانید این دو را در Environment variables پنل تغییر دهید.
- اگر موتور Prisma باز هم از کار بیفتد، Worker خودش خارج می‌شود تا Passenger یک Worker سالم بسازد؛ دیگر لازم نیست دستی Restart کنید.

## تصاویر بهینه (sharp)

نسخه‌های کوچک و WebP تصاویر با مسیر `/img/w{width}/uploads/...` توسط `lib/images.js` ساخته و در پوشهٔ `cache/images` (خارج از Git) ذخیره می‌شوند؛ این پوشه باید قابل نوشتن باشد. بستهٔ `sharp` باینری آماده برای Linux x64 دارد و با `npm ci` نصب می‌شود؛ اگر روی هاست لود نشد (لاگ: `sharp unavailable`)، سایت با تصاویر اصلی کار می‌کند ولی سنگین می‌شود — در آن صورت `npm rebuild sharp` را در همان محیط Node اجرا کنید.

## متغیرهای لازم

این مقادیر را در Environment variables پنل ثبت کنید؛ فایل `.env` واقعی را در ZIP یا Git قرار ندهید:

```env
NODE_ENV=production
SITE_URL=https://example.com
DATABASE_URL=mysql://USER:PASSWORD@localhost:3306/DATABASE
SESSION_SECRET=a-long-random-secret-at-least-32-characters
PORT=3000
ADMIN_USERNAME=your-admin-username
ADMIN_PASSWORD=your-strong-admin-password
ADMIN_PROVISION_SECRET=another-long-random-secret
```

`SITE_URL` باید دقیقاً دامنهٔ اصلی HTTPS، بدون `/` انتهایی، باشد. در غیر این صورت canonical، sitemap و لینک‌های اشتراک‌گذاری برای گوگل نادرست می‌شوند.

## اجرای migration ها

روی سرور فقط `npx prisma migrate deploy` را اجرا کنید. هرگز `prisma migrate dev` را روی دیتابیس واقعی اجرا نکنید: جدول `sessions` را خود برنامه می‌سازد و در تاریخچهٔ migration نیست، پس Prisma آن را drift می‌بیند و پیشنهاد **ریست کامل دیتابیس** می‌دهد.

## ساخت حساب مدیر

حساب مدیر فقط از طریق خط فرمان و **یک‌بار** ساخته می‌شود؛ صفحهٔ ورود هرگز حساب جدید نمی‌سازد. پس از تنظیم سه متغیر `ADMIN_USERNAME`، `ADMIN_PASSWORD` و `ADMIN_PROVISION_SECRET` این دستور را اجرا کنید:

```bash
npm run admin:create
```

اگر از قبل حسابی وجود داشته باشد، اسکریپت چیزی نمی‌سازد. پس از ساخت حساب، بهتر است `ADMIN_PASSWORD` را از محیط حذف کنید.

## جدول نشست‌ها

برای جلوگیری از ساخت جدول و اجرای زمان‌بند در هر worker (یکی از دلایل مصرف پردازش و restart شدن Passenger)، جدول زیر را فقط **یک‌بار** در phpMyAdmin اجرا کنید:

```sql
CREATE TABLE IF NOT EXISTS `sessions` (
  `session_id` varchar(128) COLLATE utf8mb4_bin NOT NULL,
  `expires` int(11) unsigned NOT NULL,
  `data` mediumtext COLLATE utf8mb4_bin,
  PRIMARY KEY (`session_id`),
  KEY `sessions_expires_idx` (`expires`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
```

برنامه عمداً زمان‌بندِ پاک‌سازی را داخل خودش اجرا نمی‌کند (`clearExpired: false`) تا در هر worker یک تایمر اضافه نسازد. پس پاک‌سازی باید در خود MySQL انجام شود. اگر Event Scheduler هاست فعال است، این رویداد را **یک‌بار** بسازید:

```sql
CREATE EVENT IF NOT EXISTS `purge_expired_sessions`
  ON SCHEDULE EVERY 1 DAY
  DO DELETE FROM sessions WHERE expires < UNIX_TIMESTAMP();
```

اگر Event Scheduler در دسترس نیست، این دستور را ماهی یک‌بار از phpMyAdmin اجرا کنید:

```sql
DELETE FROM sessions WHERE expires < UNIX_TIMESTAMP();
```

## مواردی که نباید آپلود شوند

- `node_modules/` (cPanel باید وابستگی‌ها را از `package-lock.json` نصب کند)
- `server.zip` و هر ZIP پشتیبان
- `.env`

پس از انتشار، `https://YOUR-DOMAIN/sitemap.xml` و `https://YOUR-DOMAIN/robots.txt` را باز کنید و همان sitemap را در Google Search Console ثبت یا دوباره ارسال کنید.

## آمار بازدید (Google Analytics 4 و Microsoft Clarity)

با ثبت این دو متغیر در Environment variables و Restart برنامه، کد آمار روی همهٔ صفحه‌ها فعال می‌شود (بدون آن‌ها هیچ اسکریپت بیرونی بارگذاری نمی‌شود):

```env
GA_MEASUREMENT_ID=G-XXXXXXXXXX   # از analytics.google.com ← Admin ← Data streams
CLARITY_PROJECT_ID=xxxxxxxxxx    # از clarity.microsoft.com ← Settings ← Overview
```

رویدادهای ثبت‌شده در GA4: `whatsapp_click`، `phone_click`، `email_click`، `consultation_cta`، `visualizer_open`، `generate_lead` (ارسال فرم مشاوره/تماس) و `sign_up` (خبرنامه). در GA4 رویداد `generate_lead` و `whatsapp_click` را به‌عنوان Key event علامت بزنید.

## ویدیوی صفحهٔ اول

اگر فایل `public/media/hero.mp4` (و در صورت تمایل `hero.webm`) روی سرور باشد، پس از Restart در پس‌زمینهٔ بخش اول صفحهٔ اصلی پخش می‌شود (بی‌صدا، تکرارشونده). مشخصات پیشنهادی: افقی ۱۹۲۰×۱۰۸۰، ۸ تا ۱۵ ثانیه، بدون صدا، H.264، حجم کمتر از ۴ مگابایت. مجوز فایل 644 باشد.
