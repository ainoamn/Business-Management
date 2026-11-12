# ربط Business Management بهوية BHD الحية

> **تاريخ:** 12 نوفمبر 2026  
> **المستودع:** https://github.com/ainoamn/Business-Management  
> **المنتج:** `bhd-work` · https://work.bhd-om.com  
> **الهوية:** https://id.bhd-om.com — **الأيقونات:** `/admin#apps` — **الربط:** `/admin#connect`

## مطبَّق

| البند | المسار |
|---|---|
| سكربت الهوية | `apps/web/src/pages/_app.tsx` → `bhd-identity.js` |
| CSP | `apps/web/next.config.mjs` → `id.bhd-om.com` |
| كتالوج حي | `apps/web/src/lib/bhd/catalog.ts` + `useBhdCatalog` |
| شريط أيقونات الرأس | `BhdProgramsStrip` (`compact`) في marketing shell + foundation |
| فوتر البرامج | `BhdProgramsFooter` في marketing shell؛ شريط كامل فوق فوتر foundation |
| محوّل التطبيقات / الحساب | `BhdAppSwitcher` عبر `BhdWorkspaceChrome` |
| مزامنة جلسة / ?au= | `BhdSessionBridge` |
| OAuth start/callback/rebind | `apps/web/src/pages/api/auth/bhd/[step].ts` (+ بروكسي Nest عند الحاجة) |

## هوية العميل

- `client_id`: `bhd-work`
- `origin`: `https://work.bhd-om.com`
- `redirect_uri`: `https://work.bhd-om.com/api/auth/bhd/callback`
- Issuer: `https://id.bhd-om.com`

## env

```env
BHD_IDENTITY_ISSUER=https://id.bhd-om.com
BHD_OAUTH_CLIENT_ID=bhd-work
BHD_OAUTH_CLIENT_SECRET=
# BHD_OAUTH_REDIRECT_URI=https://work.bhd-om.com/api/auth/bhd/callback
```

## تحقق

1. كتالوج الأيقونات من `GET https://id.bhd-om.com/api/bhd/catalog` يظهر في الرأس والفوتر.
2. `GET /api/auth/bhd/start` يبدأ OIDC لـ `bhd-work`.
3. تبديل حساب → rebind يحدّث ربط المنتج.

## ملاحظة

المصدر الحي للأيقونات: `/admin#apps` عبر `/api/bhd/catalog`.
