# عزل حسابات ونوافذ BHD — إلزامي لكل منتج

> **المصدر المعتمد:** `docs/BHD-IDENTITY-SSO.md` + `docs/BHD-CURSOR-PRODUCT-WIRE.md`  
> **الهوية:** `https://id.bhd-om.com`  
> **التاريخ:** 4 نوفمبر 2026

كوكي الهوية `bhd_id` مشتركة بين نوافذ نفس المتصفح. عزل البيانات يتم برمز النافذة في `sessionStorage` و`Authorization: Bearer`، ثم **إعادة ربط جلسة المنتج** عبر `POST /api/auth/bhd/rebind`.

---

## قواعد لا تُكسر

1. كل نافذة تستخدم رمزها عبر `BhdIdentity` (Bearer في `sessionStorage`).
2. عند تبديل الحساب في المنتج:
   1. `POST https://id.bhd-om.com/api/auth/switch` مع Bearer النافذة → احفظ `token`
   2. `POST /api/auth/bhd/rebind` بالـ Bearer (يعيد كتابة كوكي جلسة المنتج)
   3. أعد التحميل مع `?_bhd=timestamp` وأخفِ الواجهة فوراً
3. ممنوع بعد تبديل Bearer: استدعاء `/api/auth/bhd/start` مباشرة بلا تذكرة النافذة.
4. إن اختلف `/api/.../me` المحلي عن `BhdIdentity.me()` → `rebind` بالـ Bearer فوراً (لا `start` أعمى).
5. دعم `?au=<bhd_sub>`: إن اختلف الحساب الظاهر في النافذة عن `au` → `switchAccount(au)` ثم `rebind`.
6. ممنوع `BroadcastChannel` لمزامنة الحساب بين النوافذ.
7. ممنوع إبقاء بيانات المستخدم السابق في الذاكرة أو في كوكي المنتج بعد التبديل.

---

## مسارات المنتج

| المسار | الدور |
|---|---|
| `GET /api/auth/bhd/start` | بدء OIDC + PKCE |
| `GET /api/auth/bhd/callback` | ربط `bhd_sub` + كوكي جلسة المنتج بمدة `runtime.session.maxAgeSec` |
| `POST /api/auth/bhd/rebind` | عزل النافذة بعد التبديل (Bearer إلزامي) |
| `GET /api/auth/bhd/logout` | مسح جلسة المنتج ثم `end-session` على الهوية |

---

## اختبار قبول سريع

1. حسابان في القائمة → التبديل يفرّغ الصفحة ثم يعرض بيانات الحساب الجديد فقط.
2. نافذة ثانية بحساب آخر لا تتأثر بتبديل الأولى.
3. فتح المنتج مع `?au=` لحساب مختلف يعيد الربط لذلك الحساب في هذه النافذة فقط.
