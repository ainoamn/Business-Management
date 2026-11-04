# Backlog وخطة المراحل

كل epic ينفذ على دفعات صغيرة: اعتماديات → schema/migration → service/authorization → API → UI → اختبارات → توثيق. لا يبدأ epic تابع قبل استقرار أساسه.

## 0 — الفحص والتخطيط
قصة: كمالك مشروع أحتاج تقريراً عن المستودع وخطة يمكن متابعتها. قبول: فحص الملفات والأدوات، حفظ المصدر والخطة والقرارات والحالة. نُفذت كتابة هذه الوثائق.

## 1 — التأسيس
قصة: كمطور أشغل تطبيقين وخدمات البيانات بأمر موثق. مهام: workspaces وNext Pages وNest وPrisma/PostgreSQL وRedis/BullMQ وS3 وDocker وvalidation وCI واختبارات. قبول: install/check/build/migrate وready حقيقي واختبارات عزل وبناء وواجهة ناجحة. لا يعد هذا epic مكتملًا قبل نجاح الخدمات.

## 2 — تجربة المستخدم الأساسية
قصة: كمستخدم عربي أستخدم واجهة متجاوبة واضحة. مهام: design system كامل، shell، login/register متصلان بحد أدنى موثق للمصادقة، i18n/theme وتفضيلات. قبول: لا أزرار شكلية، navigation وkeyboard وRTL/LTR وهاتف. تتداخل آليات المصادقة اللازمة مع epic 3 قبل قبول هذا epic.

## 3 — الهوية والمؤسسات والصلاحيات
قصة: كمالك أسجل وأدعو موظفاً وأحدد نطاقه. مهام: Argon2id وcookie sessions وCSRF وrate limits وemail verification/reset وMFA وإبطال الأجهزة؛ invitations وRole/Permission ونطاقات وفروع وإدارات وفرق. قبول: رحلات المستخدم ورفض cross-tenant وprivilege escalation وexpired sessions على الخادم والمتصفح. إعداد بريد موثوق مطلوب للتحقق والاستعادة.

## 4 — المشاريع والمهام (قلب MVP)
قصة: كمدير أسند عملاً وأراجعه حتى الإغلاق. مهام: projects/members/phases وtasks/subtasks/comments/checklist/dependencies/history والتعيين والحالات والمراجعة والاعتماد وKanban/Calendar/Gantt. قبول: دورة كاملة محفوظة مع صلاحيات وتواريخ وعلاقات ومؤشرات حقيقية.

## 5 — الاجتماعات والملفات والوقت
قصة: أحول قراراً إلى مهمة وأربط مستنداً ووقتاً بالمشروع. مهام: minutes/decisions وprivate documents/versioning/scanning/signed download وtimers/timesheets. قبول: محاولات الملف المخمن والرفع الخطر وتسجيل وقت مستخدم آخر مرفوضة.

## 6 — الأتمتة والإشعارات
قصة: أتلقى تذكيراً أو طلب اعتماد دون تنفيذ مكرر. مهام: transactional outbox وworkers وidempotency وpreferences وnotification center ومحرر trigger/condition/action وسجل فشل. قبول: retries لا تكرر الأثر، وحدود وصلاحيات للإجراءات الحساسة.

## 7 — AI
قصة: أحصل على ملخص وخطة قابلة للمراجعة. مهام: provider port وusage/credits ledger وpermissions-aware retrieval وprompts/audit وdraft confirmation. قبول: لا بيانات خارج النطاق ولا تنفيذ تغيير دون موافقة؛ مفتاح وخدمة حقيقية واختبار تكلفة لازم قبل التفعيل.

## 8 — المالية
قصة: أتابع ميزانية ومصروفات واعتمادات مشروع. مهام: Decimal amounts وcurrency/rates/provenance وapproval separation وتقارير. قبول: دقة OMR وتزامن الاعتماد ومنع تعديل غير مصرح، دون ادعاء بناء محاسبة عامة.

## 9 — الاشتراكات
قصة: أختار خطة ذات حدود مفروضة في الخادم. مهام: plans/entitlements/seats/storage/AI وinvoices وprovider port وwebhook signatures/replay protection. قبول: sandbox رسمي وwebhook مكرر آمن ولا مفاتيح أو بطاقات في المتصفح.

## 10 — إدارة المنصة
قصة: أدير الهوية التجارية والباقات والعملاء دون وصول غير مراقب لمحتواهم. قبول: هوية وأدوار منصة منفصلة وsupport grants مؤقتة وسجل تدقيق لكل وصول استثنائي.

## 11 — الأمان والأداء
مهام: OWASP review وsecurity tests وload baseline وpool/index profiling وmonitoring وbackup restore. قبول: نتائج فعلية موثقة، معالجة العيوب الحرجة، دون اختلاق أرقام أو امتثال.

## 12 — الإطلاق
مهام: بيئات معزولة وsecrets وDNS/HTTPS وبريد وتخزين ومراقبة وrelease/rollback/runbooks وتدريب. قبول: staging ثم restore drill وE2E نهائي ومراجعة قانونية متخصصة. لا نشر تجاري قبل تحقق هذه الشروط.
