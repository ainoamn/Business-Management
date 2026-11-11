import { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { loadBhdIdentity } from '../../lib/identity/bhd-browser';
import {useBhdSdkRevision} from '../../lib/identity/use-bhd-sdk';

const SSO_START = '/api/auth/bhd/start';

function safeReturnTo(path: string) {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) return '/app/dashboard';
  return path.slice(0, 512);
}

async function rebindWithBearer(token: string) {
  const response = await fetch('/api/auth/bhd/rebind', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  return response.ok;
}

/**
 * يزامن جلسة المنتج مع حساب النافذة على الهوية (?au= + Bearer + rebind).
 * ممنوع بعد التبديل الاعتماد على /start وحده دون تذكرة النافذة.
 */
export function BhdSessionBridge({
  localBhdSub,
  signedIn,
}: {
  localBhdSub?: string | null;
  signedIn: boolean;
}) {
  const router = useRouter();
  const sdkRevision=useBhdSdkRevision();
  const busy = useRef(false);

  useEffect(() => {
    if (!router.isReady || busy.current) return;
    let cancelled = false;

    void (async () => {
      const identity = await loadBhdIdentity(2500);
      if (cancelled || !identity) return;

      const au = typeof router.query.au === 'string' ? router.query.au : '';
      const me = await identity.me().catch(() => null);
      if (cancelled || !me) return;

      const token = me.body.token;
      if (token) identity.captureToken(token);

      const remoteSub = me.body.user?.id || null;
      if (au && remoteSub && au !== remoteSub && token) {
        busy.current = true;
        try {
          await identity.switchAccount(au);
          const again = await identity.me();
          const nextToken = again.body.token || token;
          if (nextToken) identity.captureToken(nextToken);
          const rebound = nextToken ? await rebindWithBearer(nextToken) : false;
          if (!rebound) {
            window.location.assign(`${SSO_START}?returnTo=${encodeURIComponent(safeReturnTo(router.asPath.split('?')[0] || '/app/dashboard'))}`);
            return;
          }
          const path = router.asPath.split('?')[0] || '/app/dashboard';
          window.location.assign(`${path}?_bhd=${Date.now()}`);
        } finally {
          busy.current = false;
        }
        return;
      }

      if (!signedIn) return;
      if (!remoteSub) return;
      if (localBhdSub && localBhdSub === remoteSub) return;
      if (!token) {
        if (!localBhdSub) {
          window.location.assign(`${SSO_START}?returnTo=${encodeURIComponent(safeReturnTo(router.asPath.split('?')[0] || '/app/dashboard'))}`);
        }
        return;
      }
      busy.current = true;
      try {
        const rebound = await rebindWithBearer(token);
        if (rebound) {
          const path = router.asPath.split('?')[0] || '/app/dashboard';
          window.location.assign(`${path}?_bhd=${Date.now()}`);
        } else if (!localBhdSub) {
          window.location.assign(`${SSO_START}?returnTo=${encodeURIComponent(safeReturnTo(router.asPath.split('?')[0] || '/app/dashboard'))}`);
        }
      } finally {
        busy.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router.isReady, router.asPath, router.query.au, localBhdSub, signedIn, sdkRevision]);

  return null;
}
