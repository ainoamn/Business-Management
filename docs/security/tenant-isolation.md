# عزل المؤسسات

حساب التطبيق ليس مالك الجداول، ليس superuser ولا يملك BYPASSRLS. الجداول organizations وmemberships وaudit_logs عليها ENABLE/FORCE ROW LEVEL SECURITY.

`withOrganization(userId, organizationId, operation)` يبدأ معاملة، يتحقق من شكل UUID، ويضبط app.user_id وapp.organization_id باستخدام set_config(..., true) المعلم. يستعلم عن العضوية النشطة قبل استدعاء العملية. لا تستخدم SET SESSION أو إلحاق SQL بمعرف يرسله العميل.

السياسات تفشل إلى عدم الوصول عند غياب السياق. organizations لا تعرض المحذوف soft-delete، memberships تعرض عضوية الفاعل النشطة فقط، audit_logs تقيد المؤسسة والعضوية والفاعل في الكتابة. صلاحية INSERT/UPDATE للمؤسسات غير ممنوحة حالياً.

الاختبارات المقترنة بالتنفيذ: role flags، غياب السياق، مؤسسة خاطئة، UUID مخمن، إعادة استخدام pool، audit cross-tenant write، منع حذف الأثر، عضوية موقوفة. نتائجها الفعلية في testing/test-results.md. هذه ليست بعد تغطية وحدات الأعمال المستقبلية.
