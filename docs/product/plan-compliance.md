# مطابقة الأمر الهندسي مع التنفيذ الفعلي

التاريخ: 2026-11-05. خريطة الصفحات في القسم 13 من الأمر الهندسي مربوطة بالشاشات القائمة، والتقرير في [construction-order-report.md](../operations/construction-order-report.md).

التاريخ السابق: 2026-11-04 (تحديث)

الحكم: **النواة التشغيلية ولوحة المنصة ومساحة العمل والصفحات التسويقية وطبقات الدفع/MFA/القنوات/التكاملات مبنية في الكود.** ما زال التفعيل الإنتاجي للخدمات الخارجية يحتاج مفاتيح واستضافة خادم API وقاعدة بيانات خارج Vercel. لا يُعلَن الامتثال القانوني أو الدفع الحي أو SMS/WhatsApp/Push أو SSO قبل تهيئة المزودين واختبارهم.

المرجع التشغيلي: [PROJECT_STATUS.md](../../PROJECT_STATUS.md).

## ما أصبح موجوداً في الكود

| المطلب | الحالة |
| --- | --- |
| صفحات تسويقية مستقلة | موجودة: `/features` `/solutions` `/industries` `/pricing` `/templates` `/about` `/contact` `/security` `/privacy` `/terms` `/help` |
| دفع إلكتروني + ويب هوك + تجديد فواتير | طبقة `PaymentProvider` و`PROVIDER` channel وويب هوك hosted وواجهة اشتراك المؤسسة. يعمل بعد ضبط `PAYMENT_*`. التجديد التلقائي يفعّل إصدار الفواتير عبر `automaticInvoices`؛ التحصيل يحتاج مزود دفع. |
| MFA (TOTP) | تسجيل وتحدي دخول للمستخدمين ومشرفي المنصة، مع واجهة أمان. يحتاج مفتاح تشفير (محلي تلقائي في التطوير). |
| SMS / WhatsApp / Push | تفضيلات وقنوات ومزوّدات غير مهيأة ترمي أخطاء صريحة. Push يحتاج `VAPID_*` ومكتبة إرسال لاحقاً. |
| تكاملات تقويم/Drive/Teams/SSO | واجهات وإعدادات مؤسسة؛ الاتصال يعيد NOT_CONFIGURED حتى توفير OAuth. |
| ClamAV | خدمة في `compose.yaml`؛ تفعيل عبر `DOCUMENT_SCANNER_MODE=clamav`. |
| اختبارات أداء/استعادة/أمن | `pnpm test:perf` و`pnpm test:restore` وقائمة عزل أمني. |
| مسودات قانونية | `docs/legal/*` وصفحات الخصوصية والشروط والأمان مع إفصاح أنها مسودات. |
| Docker إنتاجي | `apps/*/Dockerfile` و`infrastructure/deployment/compose.production.yaml`. |
| Redis/S3/Docker محلياً | معرّفة في Compose؛ التشغيل يعتمد على Docker Desktop السليم. |

## ما يبقى تشغيلياً خارج هذه الجلسة

- نشر خادم NestJS وPostgreSQL وRedis وS3 في إنتاج حقيقي مربوط بـ`API_ORIGIN`.
- مفاتيح مزود دفع ومزود SMS/WhatsApp وVAPID واختبار sandbox رسمي.
- OAuth للتقويم/Drive/Teams/SSO.
- مراجعة قانونية لـPDPL قبل الإطلاق التجاري.
- اختبار اختراق متخصص واختبار استعادة موثّق على بيئة إنتاج.
