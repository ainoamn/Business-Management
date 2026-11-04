# متطلبات Staging

بيئة مستقلة عن التطوير والإنتاج، database/Redis/bucket وأسرار ونطاق منفصلون. NODE_ENV=production وDEPLOYMENT_ENV=staging، WEB_ORIGIN وS3_ENDPOINT يستخدمان HTTPS؛ فشل التحقق يوقف الخادم.

الترتيب: تثبيت frozen lockfile → توليد Prisma → check/tests/build → نسخة احتياطية → migrate بحساب المهاجر → تشغيل التطبيق بحساب محدود → health/integration/E2E في بيانات staging المخصصة → قرار الترقية.

Compose الحالي تطويري للخدمات فقط، وليس ملف نشر Staging مكتمل. runtime API مربوط بـ127.0.0.1 ويلزم reverse proxy على المضيف أو تعديل موثق عند إعداد حاويات التطبيقات. لا توجد أسرار أو نطاق نشر فعلي مقدمان.
