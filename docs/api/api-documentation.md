# API المتاحة فعلياً

## إدارة المنصة

- POST /api/v1/platform/auth/login: دخول مع Origin وحد محاولات وCookie HttpOnly.
- GET /api/v1/platform/auth/me: هوية وصلاحيات وCSRF دون passwordHash أو tokenHash.
- POST /api/v1/platform/auth/logout وauth/password: خروج أو تغيير كلمة المرور وإبطال الجلسات.
- GET /api/v1/platform/overview وmonitoring وsettings وsecurity/sessions، وPATCH settings، وPOST security/sessions/:id/revoke.
- GET/POST /api/v1/platform/resources/:resource وPATCH resources/:resource/:id وفق عمليات المورد وصلاحياته. الموارد organizations/users/accounts/roles/plans/subscriptions/invoices/ledger/pages/audit. ledger وaudit غير قابلين للتعديل والحذف. إنشاء المؤسسة متاح لمشرف organizations.manage مع name/slug/ownerEmail لحساب مستخدم موجود وموثّق وفعال. لا يُنشأ مستخدم أو اشتراك مدفوع ضمن هذا المسار. إنشاء حساب المستخدم يتم عبر التسجيل والتحقق من البريد.
- GET /api/v1/public/site وpublic/pages/:slug: منشور فقط، 503 للصيانة و404 للمسودة/الأرشفة/تعطيل الصفحات.

كل كتابة بعد الدخول تحتاج Origin وX-CSRF-Token. القوائم تدعم page/pageSize/search بحد أقصى 100. المبالغ decimal string حتى 3 منازل OMR. حالة PAID تعكس تسوية دفعات موثقة؛ يحدد نوع القناة ومرجعها إن كانت يدوية أو من مزود دفع. القيد اليدوي لا يثبت تحصيلًا مصرفيًا. راجع architecture/billing.md للتحقق من Webhook والتسوية.

## البنية الأساسية

- `GET /api/v1/health/live`: 200 مع status=alive إذا كان خادم NestJS يعمل.
- `GET /api/v1/health/ready`: 200 إذا نجحت قاعدة البيانات المهاجرة وRedis وBullMQ round trip وفحص S3 bucket. 503 مع checks عند فشل أي منها.
- `/api/docs` و`/api/docs-json`: Swagger في development فقط.

تعرض readiness أسماء المكونات وحالتها والتوقيت فقط. لا تحتوي معلومات مستخدمين أو أسماء مؤسسات أو أسرار أو رسائل مزود الخدمة. الفحص cached لخمس ثوانٍ. مصادقة إدارة المنصة ومصادقة مستخدمي المؤسسات متاحتان على خادم API عند تشغيله؛ نشر Vercel من دون `API_ORIGIN` يعيد حالة غير جاهزة ولا ينفذ عمليات المؤسسة.


## ملفات الموظفين وإعدادات المؤسسة

ضمن /api/v1/work/organizations/:organizationId:

- GET/PATCH members/:id/profile، وGET members/:id/profile/avatar-options، وGET members/:id/avatar. الهاتف والصورة للخدمة الذاتية، وتعيين المدير يتطلب members.manage على مستوى المؤسسة. الإصدار يحمي التعديلات المتزامنة.
- GET/PATCH branding وGET branding/options وGET branding/logo. الموافقة على مشاركة الصورة مطلوبة قبل نشر إصدار جديد. الصورة النهائية داخلية، مع تحقق جديد من الجلسة والمصدر، ولا تعيد بيانات المستند الأصلي.
- GET/POST settings/holidays، وPATCH settings/holidays/:id، وPOST settings/holidays/:id/archive مع version وrestore. تؤثر الفترات الفعالة في القدرة فقط، دون تعديل ساعات الوقت المسجلة.
- PATCH settings يقبل taskCategories وprojectCategories اختياريًا؛ الإغفال يحفظ القيم الحالية.
- GET execution/metrics يطبق نطاق المشاهد وحدود اليوم بحسب timezone المؤسسة وتصنيفات الحالات المخصصة. الحالات النهائية لا تدخل في المفتوح أو المتأخر، وفئة APPROVAL تحدد عدد انتظار الاعتماد.

## عمليات إدارة المنصة

- GET /api/v1/platform/operations/storage: استهلاك وحجوزات التخزين وأعداد الملفات دون محتواها؛ storage.read.
- GET /api/v1/platform/operations/errors: أنماط المسارات وأرقام الطلبات وتصنيفات الأعطال دون أجسام الطلبات؛ monitoring.read.
- GET /api/v1/platform/operations/integrations: أعداد حالات التكاملات دون إعداداتها المشفرة أو هويات العملاء؛ settings.read. الحالة المحفوظة لا تعد اختبار اتصال حي.
- GET /api/v1/platform/operations/flags وPATCH flags/:key: قراءة وتغيير مفاتيح الميزات بفحص الإصدار وسبب إلزامي وسجل تغييرات غير قابل للتعديل؛ settings.read/manage.
- POST /api/v1/platform/resources/organizations: إنشاء مؤسسة لمالك موثّق موجود، مع عضوية المالك والإعدادات والتدقيق في معاملة واحدة. الاسم والمعرف والبريد تتحقق في الخادم وقاعدة البيانات.
- الدعم: /api/v1/work/organizations/:organizationId/support و/api/v1/platform/support. يقتصر وصول العميل على بلاغاته أو صلاحية مشرف مؤسسته، ووصول المنصة على support.read/manage مع تدقيق الوصول. راجع architecture/support.md للردود والحالات ومنع التكرار.

## أرشيف الإشعارات

GET /api/v1/work/organizations/:organizationId/notifications يقبل view=active أو archived. POST notifications/:id/archive يقبل restore:boolean. العملية شخصية للمتلقي ومحمية بالجلسة وCSRF، وآمنة عند تكرارها. غير المقروء وتعليم الكل كمقروء يقتصران على الإشعارات الحالية؛ الاستعادة تحافظ على حالة القراءة السابقة. تتضمن أحداث SSE العدد الكلي الحالي لتحديث القوائم عبر الأجهزة. راجع architecture/notification-archives.md.

Browser push API and session-bound device lifecycle: [browser-push.md](../architecture/browser-push.md). These endpoints expose public VAPID configuration and redacted device metadata; encrypted endpoint credentials are never returned. Provider acceptance, server display claims and user read state are distinct.

Organization file policy: `GET/PATCH work/organizations/:organizationId/settings/file-policy`, requiring global `organization.manage`. Strict PATCH body `{version,maxFileBytes,allowedExtensions}`; null follows the server maximum, and stale versions return 409. Existing accepted files remain readable. See [file-policy-and-retention.md](../architecture/file-policy-and-retention.md).

Mobile notifications: `GET notification-phone`, `POST notification-phone/start`, `POST notification-phone/check`, `POST notification-phone/consent`, `DELETE notification-phone`, `GET notification-phone/deliveries`, under the organization work API. Writes require the current verified session and CSRF. OTP proof is session-bound; persistent channel consent is separate. See [mobile-notifications.md](../architecture/mobile-notifications.md).
