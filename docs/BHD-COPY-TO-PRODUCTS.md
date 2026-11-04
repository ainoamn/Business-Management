# ماذا يُنسخ من الهوية إلى المنتج (Work Management)

> انسخ الوثائق أولاً، ثم نفّذ القسم 6 من `BHD-IDENTITY-SSO.md` وأمر الوكيل في `BHD-CURSOR-PRODUCT-WIRE.md`.

## وثائق إلزامية داخل `docs/`

| ملف | الغرض |
|---|---|
| `BHD-IDENTITY-SSO.md` | مواصفة `bhd-identity.v1` — مصدر الحقيقة |
| `BHD-CURSOR-PRODUCT-WIRE.md` | أمر جاهز للصقه في Cursor |
| `BHD-ACCOUNT-ISOLATION.md` | عزل النوافذ و`?au=` و`rebind` |
| `BHD-ACCOUNT-SWITCHER.md` | بطاقة الحساب ومشغّل التطبيقات |
| `BHD-APP-SWITCHER.md` | شبكة البرامج |
| `BHD-IDENTITY-RUNTIME.md` | `/api/bhd/runtime` و`bhd-identity.js` |
| `BHD-SESSION-POLICY.md` | مدة الجلسة من الهوية |
| `BHD-PRODUCT-SSO-ADMIN.md` | تسجيل العميل في `/admin#clients` |

## كود المنتج (لا تُنسخ قاعدة الهوية)

- سكربت: `<script src="https://id.bhd-om.com/bhd-identity.js" defer>`
- مسارات الخادم: `/api/auth/bhd/start|callback|logout|rebind`
- عمود: `users.bhd_sub UUID UNIQUE`
- متغيرات: `BHD_IDENTITY_ISSUER` · `BHD_OAUTH_CLIENT_ID` · `BHD_OAUTH_CLIENT_SECRET` · `BHD_OAUTH_REDIRECT_URI`
- كتالوج حي: `GET https://id.bhd-om.com/api/bhd/catalog`

## ممنوع نسخه

- `DATABASE_URL` أو جداول الهوية
- زر Google على واجهة المنتج
- أدوار أدمن من الهوية
- رقم `maxAge` ثابت محلي لجلسة المنتج

## تسجيل العميل (يدوي على الهوية)

في [https://id.bhd-om.com/admin#clients](https://id.bhd-om.com/admin#clients):

- `client_id`: `bhd-work` (أو القيمة المضبوطة في البيئة)
- `redirect_uri`: مطابقة تامة لـ `https://<host>/api/auth/bhd/callback`
- `post_logout_redirect_uri`: أصل المنتج + `/`
