# معمارية النظام

Modular Monolith داخل NestJS وواجهة Next.js منفصلة باستخدام Pages Router. PostgreSQL مصدر البيانات المعتمد؛ Redis للتخزين المؤقت وBullMQ؛ S3-compatible لتخزين الملفات الخاص. جميع المواعيد المخزنة UTC، وإعداد المؤسسة الافتراضي Asia/Muscat وOMR وar.

المسار: Browser → Next.js → `/api/v1` reverse proxy → NestJS → Prisma → PostgreSQL. الخدمات الخلفية تتصل بـRedis وS3 دون كشف بيانات الاتصال للمتصفح. صفحة التأسيس لا تطلب أي بيانات مؤسسات.

الحزم المشتركة: shared-types للعقود، shared-schemas للتحقق، ui للمكونات، config لإعدادات TypeScript. لا يوجد منطق أعمال داخل صفحات Next.js.

حدود الوحدة المستقبلية: identity، organizations، authorization، projects، tasks، documents، meetings، time، workflows، notifications، AI، finance، billing، platform. تتواصل الوحدات من خلال خدمات وعقود وأحداث موثقة، وليس باستيراد مخازن بيانات وحدات أخرى عشوائياً.

تم تنفيذ infrastructure وhealth وdatabase ووحدة platform للإدارة والمصادقة والفوترة اليدوية والصفحات والإعدادات. وحدات الأعمال التنظيمية ما تزال لاحقة. فصل خدمات مستقلة يعتمد على قياسات الحمل وحدود المعاملات، ولا يلزم تطبيق microservices الآن.
