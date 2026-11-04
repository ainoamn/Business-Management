# API المتاحة فعلياً

## إدارة المنصة

- POST /api/v1/platform/auth/login: دخول مع Origin وحد محاولات وCookie HttpOnly.
- GET /api/v1/platform/auth/me: هوية وصلاحيات وCSRF دون passwordHash أو tokenHash.
- POST /api/v1/platform/auth/logout وauth/password: خروج أو تغيير كلمة المرور وإبطال الجلسات.
- GET /api/v1/platform/overview وmonitoring وsettings وsecurity/sessions، وPATCH settings، وPOST security/sessions/:id/revoke.
- GET/POST /api/v1/platform/resources/:resource وPATCH resources/:resource/:id وفق عمليات المورد وصلاحياته. الموارد organizations/users/accounts/roles/plans/subscriptions/invoices/ledger/pages/audit. ledger وaudit غير قابلين للتعديل والحذف. إنشاء المؤسسات ومستخدميها يتبع مرحلة التسجيل وليس متاحاً هنا بعد.
- GET /api/v1/public/site وpublic/pages/:slug: منشور فقط، 503 للصيانة و404 للمسودة/الأرشفة/تعطيل الصفحات.

كل كتابة بعد الدخول تحتاج Origin وX-CSRF-Token. القوائم تدعم page/pageSize/search بحد أقصى 100. المبالغ decimal string حتى 3 منازل OMR. حالة فاتورة PAID تعني تسديداً بقيود يدوية ولا تدل على تحصيل من مزود دفع.

## البنية الأساسية

- `GET /api/v1/health/live`: 200 مع status=alive إذا كان خادم NestJS يعمل.
- `GET /api/v1/health/ready`: 200 إذا نجحت قاعدة البيانات المهاجرة وRedis وBullMQ round trip وفحص S3 bucket. 503 مع checks عند فشل أي منها.
- `/api/docs` و`/api/docs-json`: Swagger في development فقط.

تعرض readiness أسماء المكونات وحالتها والتوقيت فقط. لا تحتوي معلومات مستخدمين أو أسماء مؤسسات أو أسرار أو رسائل مزود الخدمة. الفحص cached لخمس ثوانٍ. مصادقة إدارة المنصة ومصادقة مستخدمي المؤسسات متاحتان على خادم API عند تشغيله؛ نشر Vercel من دون `API_ORIGIN` يعيد حالة غير جاهزة ولا ينفذ عمليات المؤسسة.
