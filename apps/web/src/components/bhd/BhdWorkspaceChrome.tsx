import { useCallback, useEffect, useState } from 'react';
import { BhdAppSwitcher, type BhdSwitcherUser } from './BhdAppSwitcher';
import { loadBhdIdentity } from '../../lib/identity/bhd-browser';
import { DEFAULT_IDENTITY_ISSUER } from '../../lib/identity/issuer';

function toSwitcherUser(input: {
  id?: string;
  name?: string | null;
  email?: string | null;
  username?: string | null;
  picture?: string | null;
}): BhdSwitcherUser {
  return {
    id: input.id,
    name: input.name || input.email || 'BHD',
    email: input.email || '',
    username: input.username,
    picture: input.picture || null,
  };
}

async function rebind(token: string) {
  const response = await fetch('/api/auth/bhd/rebind', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  return response.ok;
}

export function BhdWorkspaceChrome({
  locale = 'ar',
  fallbackEmail,
  fallbackName,
}: {
  locale?: 'ar' | 'en';
  fallbackEmail?: string;
  fallbackName?: string;
}) {
  const [user, setUser] = useState<BhdSwitcherUser | null>(
    fallbackEmail ? { name: fallbackName || fallbackEmail, email: fallbackEmail, picture: null } : null,
  );
  const [accounts, setAccounts] = useState<BhdSwitcherUser[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const identity = await loadBhdIdentity(2500);
      if (cancelled) return;
      if (!identity) {
        setReady(true);
        return;
      }
      try {
        const me = await identity.me();
        if (me.body.token) identity.captureToken(me.body.token);
        if (me.body.user?.email) {
          setUser(toSwitcherUser(me.body.user));
          setAccounts((me.body.accounts || []).map(toSwitcherUser));
        }
      } catch {
        /* keep fallback */
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSwitchAccount = useCallback(async (sub: string) => {
    const identity = await loadBhdIdentity(1200);
    if (!identity) {
      window.location.assign(`${DEFAULT_IDENTITY_ISSUER}/auth/switch?sub=${encodeURIComponent(sub)}`);
      return;
    }
    const switched = await identity.switchAccount(sub);
    const token = switched.body.token;
    if (token) identity.captureToken(token);
    if (token && (await rebind(token))) {
      window.location.assign(`${window.location.pathname}?_bhd=${Date.now()}`);
      return;
    }
    window.location.assign(`/api/auth/bhd/start?returnTo=${encodeURIComponent(window.location.pathname)}`);
  }, []);

  const onAddAccount = useCallback(() => {
    const next = encodeURIComponent(`${window.location.origin}${window.location.pathname}`);
    window.location.assign(`${DEFAULT_IDENTITY_ISSUER}/login?add=1&next=/auth/continue?to=${next}`);
  }, []);

  if (!ready && !user) return null;
  if (!user) return null;

  return (
    <BhdAppSwitcher
      user={user}
      accounts={accounts}
      locale={locale}
      onSignOut={() => {
        window.location.assign('/api/auth/bhd/logout');
      }}
      onSignOutAll={() => {
        window.location.assign('/api/auth/bhd/logout?all=1');
      }}
      onSwitchAccount={onSwitchAccount}
      onAddAccount={onAddAccount}
    />
  );
}
