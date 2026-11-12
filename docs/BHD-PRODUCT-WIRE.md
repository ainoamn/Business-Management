# ربط Business Management بهوية BHD الحية

> **تاريخ:** 12 نوفمبر 2026  
> **المستودع:** https://github.com/ainoamn/Business-Management  
> **المنتج:** `bhd-work` · https://work.bhd-om.com  
> **الهوية:** https://id.bhd-om.com

## مطبَّق

| البند | المسار |
|---|---|
| سكربت الهوية | `apps/web/src/pages/_app.tsx` → `bhd-identity.js` |
| كتالوج حي | `apps/web/src/lib/bhd/catalog.ts` + `useBhdCatalog` |
| شريط أيقونات الرأس | `BhdProgramsStrip` في `marketing/shell.tsx` |
| فوتر البرامج | `BhdProgramsFooter` في `marketing/shell.tsx` |
| محوّل التطبيقات / الحساب | `BhdAppSwitcher` عبر `BhdWorkspaceChrome` |
| مزامنة جلسة / ?au= | `BhdSessionBridge` |
| OAuth start/callback/rebind | `apps/web/src/pages/api/auth/bhd/[step].ts` (+ بروكسي Nest عند الحاجة) |

## هوية العميل

- `client_id`: `bhd-work`
- `redirect_uri`: `https://work.bhd-om.com/api/auth/bhd/callback`
- أصول Vercel مسجّلة أيضاً على الهوية الأم

## env

- `BHD_IDENTITY_ISSUER=https://id.bhd-om.com`
- `BHD_OAUTH_CLIENT_ID=bhd-work`
- `BHD_OAUTH_CLIENT_SECRET` عند اللزوم
- سر جلسة المنتج حسب إعداد Nest/API

## ملاحظة

المصدر الحي للأيقونات والفوتر: `GET https://id.bhd-om.com/api/bhd/catalog` — يضم كل مستودعات لقطة GitHub (Legal / Cars / Hikaya / Ain / Boilerplate / AHHHA وغيرها).
