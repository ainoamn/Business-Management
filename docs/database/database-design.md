# تصميم البيانات الحالي

تم إنشاء مخطط خمس كيانات في `apps/api/prisma/schema.prisma`:

- User: بريد normalized وفريد، hash كلمة مرور واسم وتاريخ soft delete.
- Organization: اسم وslug فريد وlocale وtimezone وcurrency وتاريخ soft delete.
- Membership: علاقة مؤسسة/مستخدم فريدة، دور مستقل وحالة active.
- UserSession: token hash فريد، user، expiry وrevocation؛ لا توجد API جلسات بعد.
- AuditLog: مؤسسة وفاعل ومعرف مورد وإجراء ومعرف طلب؛ append-only لحساب التطبيق.

UUID للمعرفات، timestamptz للدقة الزمنية، foreign keys وقيود وتواريخ وفهارس في migration. لا تُسجل كلمات المرور أو session tokens في audit logs. hash كلمات المرور سيُطبق بواسطة Argon2id في مرحلة الحسابات؛ المخطط وحده ليس مصادقة.

Users وUserSession عالميان للهوية؛ جداول بيانات المؤسسة تحمل organization_id (وفي جدول Organization هو المفتاح id). العضوية مستقلة لكل مؤسسة. فهرس organization_id مع created_at لسجل التدقيق.
