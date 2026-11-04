# قرارات تقنية

1. pnpm workspaces دون أداة orchestration إضافية؛ أوامر جذرية وترتيب بناء صريح يعملان على Windows وLinux.
2. Next.js 15.5 ضمن سلسلة patch متوافقة، Pages Router كما طُلب. مرجع المسارات: https://nextjs.org/docs/pages/getting-started/installation.
3. NestJS 11 وPrisma 6.19 كسلسلتين متوافقتين مع CommonJS وNode 24، وتثبيت النسخ الدقيقة في pnpm-lock.yaml. أي ترقية رئيسية تحتاج مراجعة واختباراً منفصلين.
4. حساب `work_migrator` يطبق migrations؛ `work_app` محدود ولا يملك BYPASSRLS. حساب المهاجر لا يستخدم داخل الخادم.
5. FORCE RLS على جداول المؤسسة مع سياق transaction-local. لا توجد سياسة إدراج أو تعديل للمؤسسات والعضويات حتى بناء إجراءات العضوية والصلاحيات المراجعة.
6. لا إنشاء لكل الكيانات المستقبلية دفعة واحدة؛ خمس جداول تأسيسية الآن، ثم migrations مترابطة مع كل ميزة واختباراتها.
7. SeaweedFS 4.51 مع S3 وcredentials وbucket من بيئة التشغيل للتطوير. لا تُكشف منافذ إدارته. اختير بعد فشل الوصول لصور MinIO الرسمية المثبتة على Docker Hub وQuay. دليل التشغيل: https://github.com/seaweedfs/seaweedfs/wiki/Quick-Start-with-weed-mini . بيانات admin المحلية ليست نموذج صلاحيات مناسباً للإنتاج؛ استخدم IAM محدوداً خارج التطوير. تنفيذ التخزين نفسه ما زال يحتاج Docker للتحقق العملي.
8. جميع ميزات AI والدفع والبريد غير مفعلة. لا توجد نتائج AI أو روابط تكاملات وهمية.
9. تدقيق الاعتماديات كشف إصدارات انتقالية متأثرة. جرت ترقية Zod إلى 4.6.6+ وتقييد PostCSS 8.5.18+ وdeepmerge-ts 8.0.2+ وmulter 2.5.0+ وjs-yaml 5.4.1+ عبر overrides محددة المصدر. يلزم إعادة تدقيق النسخ المقفلة والبناء وتوليد Prisma؛ override لا يعد دليلاً على توافقه دون هذه الفحوص.
10. التدقيق الشامل كشف تنبيهات أدوات تطوير إضافية؛ اختير Vitest 4.1.12 وESLint 10.14 وminimatch 11.0.1+ بعد التحقق من peer dependencies وNode. أُعيد check/build/audit ونجحت. CI يستخدم lockfile نفسه.
