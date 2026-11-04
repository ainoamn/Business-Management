# ربط Work Management بهوية BHD

## ما نُفّذ في هذا المستودع

- عمود `users.bhd_sub` (UUID UNIQUE) + ترحيل `202611040131_bhd_sub`
- مسارات Nest تحت `/api/v1/auth/bhd/*` مع إعادة كتابة Next إلى `/api/auth/bhd/*`
- جلسة المنتج: كوكي `work_user_session` (منفصلة عن `bhd_id`) ومدتها من `GET /api/bhd/runtime`
- الواجهة: زر دخول BHD، مشغّل التطبيقات، فوتر البرامج من الكتالوج الحي، جسر عزل `?au=` + `rebind`
- CSP يسمح بـ `https://id.bhd-om.com` للسكربت والاتصال والصور

## بيئة الخادم

```env
BHD_IDENTITY_ISSUER=https://id.bhd-om.com
BHD_OAUTH_CLIENT_ID=bhd-work
BHD_OAUTH_CLIENT_SECRET=
BHD_OAUTH_REDIRECT_URI=https://<product-host>/api/auth/bhd/callback
```

## قبل الإنتاج

1. سجّل العميل في `/admin#clients` و`/admin#apps` و`/admin#connect`
2. طبّق الترحيل على قاعدة **المنتج فقط**
3. لا تشارك `DATABASE_URL` مع الهوية

## اختبار التبديل دون تسرّب

1. حسابان على الهوية → بدّل من رأس مساحة العمل → يجب أن تُعاد كتابة كوكي المنتج عبر `rebind`
2. نافذة أخرى تبقى على حسابها (`sessionStorage` + Bearer)
3. تغيير اسم/شعار في `/admin#apps` يظهر في الرأس والفوتر دون قائمة ثابتة محلية
