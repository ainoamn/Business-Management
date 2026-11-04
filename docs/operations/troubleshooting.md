# استكشاف الأعطال

إذا فشل Docker engine: نفذ `docker info` و`docker desktop status` واقرأ Docker Desktop diagnostics. في هذه الجلسة ظهر خطأ dockerInference عند بدء backend. لا تعالج ذلك بإعادة ضبط المصنع أو حذف volumes دون مراجعة بيانات المستخدم وموافقته.

يوجد بلاغ من نفس فئة العطل في مستودع Docker الرسمي: https://github.com/docker/desktop-feedback/issues/460. التشابه لا يثبت أن جميع تفاصيله تنطبق على هذا الجهاز. لم تُجر تغييرات على إعدادات Docker العامة أو ملفات sockets أو إعادة تشغيل Windows من هذا المشروع.

إذا رفضت البيئة التشغيل: الرسالة تعرض أسماء المتغيرات الخاطئة؛ شغل setup:env عند عدم وجود ملف ثم أكمل القيم، ولا تطبع `.env` للتشخيص.

إذا Prisma رفض الاتصال: تحقق من الحاوية وport وDATABASE_URL ودور work_app وكلمة المرور الموجودة فعلياً في volume. استخدم حساب المهاجر للمهاجرات فقط.

ready=503: افحص المكون down: database يتطلب الجدول بعد migrate، queue يتطلب Redis والعامل الفعلي، storage يتطلب bucket بعد تهيئة weed mini. غياب الخادم يعرض خطأ صريحاً في الصفحة ولا يتحول إلى نتائج تجريبية.

إذا ظهرت أخطاء shared package declarations: شغل pnpm build:packages أولاً. أوامر check/build تقوم بذلك تلقائياً. بعد clone شغل db:generate قبل فحص الأنواع.
