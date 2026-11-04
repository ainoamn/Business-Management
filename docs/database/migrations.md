# إدارة المهاجرات

`pnpm db:generate` يولد Prisma Client، و`pnpm db:migrate` يقرأ `.env` ثم يمرر MIGRATION_DATABASE_URL لأمر `prisma migrate deploy` في عملية فرعية فقط. تطبيق NestJS يستخدم DATABASE_URL الأقل صلاحية.

المهاجرة الأولى `202611030001_foundation` تتضمن الجداول والفهارس والقيود والمنح وRLS. إنشاء دور التطبيق يتم في init script عند إنشاء volume جديد. لا تعدّل المهاجرة بعد تطبيقها؛ أضف مهاجرة تالية.

لا تستخدم db push في الإنتاج. راجع SQL والنسخة الاحتياطية وخطة التعافي قبل أي تغيير هدّام. الملفات اليدوية الخاصة بـRLS جزء من migration ويجب الحفاظ عليها عند توليد تغييرات Prisma لاحقة.

التطبيق على قاعدة مدارة يتطلب إنشاء work_app مع NOSUPERUSER وNOBYPASSRLS أولاً بواسطة مسؤول قاعدة البيانات. لا تمنحه عضوية work_migrator.
