# Work Management Platform

منصة إدارة الأعمال — تنفيذ تدريجي وفق طلب المشروع، العربية هي اللغة الأساسية.

## لوحة إدارة المنصة

لوحة فعلية على `/admin` (تحويل إلى `/platform`) لإدارة المشرفين والصلاحيات والباقات والاشتراكات والفواتير والقيود اليدوية والصفحات والإعدادات والجلسات والتدقيق والمراقبة. التفاصيل والحدود في [دليل الإدارة](docs/user-guide/platform-admin.md).

على Windows يمكن تشغيل PostgreSQL مستقلاً عن Docker عبر `pnpm db:local` ثم `pnpm db:migrate`. لتفعيل حساب المالك الذي تختار بياناته: `pnpm platform:bootstrap` في طرفية تفاعلية؛ لا توجد بيانات دخول افتراضية. اختبارات الإدارة: `pnpm test:platform`، و`pnpm test:platform:browser` مع واجهة web شغالة ومنفذ API 4000 متاح للاختبار المعزول.

**الحالة:** لوحة المنصة ومساحة العمل `/app` والصفحات التسويقية وBHD Identity مبنية ومختبرة محلياً. الواجهة منشورة على Vercel؛ الخادم وقاعدة البيانات غير مربوطين بالاستضافة المنشورة بعد. راجع [PROJECT_STATUS.md](PROJECT_STATUS.md) و[سجل نوفمبر](docs/operations/session-history-2026-11.md).

## التشغيل المحلي

متطلبات: Node.js 22.12–24، pnpm 10.14، Docker Desktop مع Linux containers.

```powershell
pnpm install --frozen-lockfile
pnpm setup:env
pnpm db:generate
pnpm infra:up
pnpm db:migrate
pnpm build
pnpm dev
```

افتح http://localhost:3000. صفحة التأسيس تقرأ حالة الخدمات الحقيقية فقط. توثيق الخادم المحلي: http://127.0.0.1:4000/api/docs. لا توجد حسابات افتراضية أو بيانات عملاء أو seed إنتاجي.

`setup:env` ينشئ `.env` بأسرار عشوائية دون الكتابة فوق ملف موجود. بيانات الاتصال في `.env.example` إرشادية وتحتاج إلى توليد. لا تنشر `.env`.

```powershell
pnpm check
pnpm build
pnpm test:integration
pnpm exec playwright install chromium
pnpm test:ui
pnpm test:e2e
```

اختبارات التكامل تتطلب الخدمات وقاعدة البيانات المهاجرة. تستخدم حساب المهاجر لإنشاء وحذف سجلات اختبار تحمل معرفات عشوائية فقط؛ نفذها على قاعدة تطوير/CI معزولة. لا توجهها إلى الإنتاج.

## التنظيم

- `apps/web`: Next.js Pages Router ضمن `src/pages`، React، Tailwind، i18n.
- `apps/api`: NestJS، REST، Prisma، وحدات البنية الأساسية.
- `packages`: أنواع ومخططات ومكونات وإعدادات مشتركة.
- `infrastructure`: Docker وأوامر التشغيل.
- `docs`: المعمارية والخطة والأمن والتشغيل والاختبارات.

حسابات المؤسسات والمهام والمشاريع وبقية وحدات مساحة العمل موجودة في `/app` وتحتاج خادم API وPostgreSQL. واجهة Vercel وحدها لا تشغّل هذه العمليات. راجع [مطابقة الخطة](docs/product/plan-compliance.md) و[نشر Vercel](docs/deployment/vercel.md). لا تستخدم فحوص الجاهزية العامة لنشر معلومات تشغيل حساسة على الإنترنت.
