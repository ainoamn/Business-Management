# نشر الواجهة على Vercel

الاستضافة الحالية تنشر تطبيق Next.js في `apps/web` فقط. خادم NestJS وPostgreSQL وRedis وS3 يبقون خارج Vercel.

## إعداد المشروع

- Root Directory: `apps/web`
- Framework: Next.js
- Install: `cd ../.. && pnpm install --frozen-lockfile`
- Build: `cd ../.. && pnpm build:packages && pnpm --filter @work/web build`
- Node.js: 22.x ضمن `>=22.12.0 <25`

محلياً تعيد `next.config.mjs` توجيه `/api/v1` إلى `http://127.0.0.1:4000`. على Vercel لا يوجد هذا التوجيه، فتعرض مسارات الصحة حالة غير جاهزة دون اختلاق اتصال بقاعدة بيانات.

## ربط الخادم لاحقاً

عند وجود خادم API عام عبر HTTPS:

```text
API_ORIGIN=https://api.example.com
WEB_ORIGIN=https://your-vercel-domain
```

`API_ORIGIN` يُضبط في بيئة بناء Vercel لأن إعادة التوجيه تُقرأ أثناء بناء Next.js. يجب أن يسمح الخادم بأصل الواجهة في CORS والكوكيز. لا تضع أسرار قاعدة البيانات في مشروع الواجهة.

بدون `API_ORIGIN` تعمل الصفحة العامة وتبديل اللغة والمظهر. تسجيل الدخول ولوحة المؤسسة ولوحة المنصة تحتاج الخادم وقاعدة البيانات.
