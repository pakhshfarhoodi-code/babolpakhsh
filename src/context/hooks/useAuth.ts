import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { UserRole, CurrentUser, Visitor, Supermarket } from '../../types';
import { INITIAL_PROFILES } from '../../data/initialData';
import { supabase, isSupabaseConfigured, getFunctionErrorMessage } from '../../lib/supabase';
import {
  STORAGE_KEYS,
  generateUniqueId,
  toSyntheticEmail,
  normalizeDigits,
  normalizePhone,
  isValidMobile,
  MIN_PASSWORD_LENGTH,
} from '../utils';

interface UseAuthProps {
  visitors: Visitor[];
  setVisitors: React.Dispatch<React.SetStateAction<Visitor[]>>;
  supermarkets: Supermarket[];
  setSupermarkets: React.Dispatch<React.SetStateAction<Supermarket[]>>;
}

const getEitaaInitData = (): string => {
  try {
    return (window as any).Eitaa?.WebApp?.initData || '';
  } catch {
    return '';
  }
};

async function reconcileEitaaSession(): Promise<void> {
  if (!supabase) return;
  const initData = getEitaaInitData();
  if (!initData) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const { data: res, error } = await supabase.functions.invoke('eitaa-login', {
      body: { initData },
    });
    // خطای شبکه یا سرور: وضعیت فعلی را تغییر نده
    if (error) return;

    if (res?.success && res.token_hash && res.profile_id) {
      if (session?.user?.id === res.profile_id) return;
      const { error: otpError } = await supabase.auth.verifyOtp({
        token_hash: res.token_hash,
        type: 'magiclink',
      });
      if (otpError) console.warn('Eitaa verifyOtp failed:', otpError.message);
      return;
    }

    // این حساب ایتا به هیچ فروشگاهی متصل نیست
    if (session?.user) {
      const { data: profRow } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();
      const role = profRow?.role;
      if (role === 'admin' || role === 'visitor' || role === 'warehouse') {
        // نشست کادر حفظ میشود و شناسهی ایتا برای اعلانها ثبت میشود
        supabase.functions
          .invoke('eitaa-contact', { body: { initData } })
          .catch((e) => console.warn('Eitaa contact failed:', e));
        return;
      }
      // تنها در صورتی که نقش قطعاً فروشگاه باشد، نشست حساب دیگر بسته میشود
      if (role === 'supermarket') {
        await supabase.auth.signOut({ scope: 'local' });
      }
    }
  } catch (e) {
    console.warn('Eitaa session reconcile failed:', e);
  }
}

export function useAuth({ visitors, setVisitors, supermarkets, setSupermarkets }: UseAuthProps) {
  // Auth readiness state (true after getSession & profile fetch or immediately if offline/mock)
  const [authReady, setAuthReady] = useState<boolean>(!isSupabaseConfigured);

  // Persisted auth state
  const [isLoggedIn, setIsLoggedInState] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.AUTH_LOGGED_IN);
    return saved !== null ? saved === 'true' : false;
  });

  const [role, setRoleState] = useState<UserRole>(() => {
    const savedRole = localStorage.getItem(STORAGE_KEYS.AUTH_ROLE);
    if (savedRole && ['admin', 'warehouse', 'visitor', 'supermarket'].includes(savedRole)) {
      return savedRole as UserRole;
    }
    return 'supermarket';
  });

  const [selectedVisitorId, setSelectedVisitorIdState] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.AUTH_VISITOR_ID) || visitors[0]?.id || '';
  });

  const [selectedSupermarketId, setSelectedSupermarketIdState] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.AUTH_SUPERMARKET_ID) || supermarkets[0]?.id || '';
  });

  const [authenticatedProfile, setAuthenticatedProfile] = useState<{
    id: string;
    name: string;
    username: string;
    phone: string;
  } | null>(() => {
    try {
      const saved = localStorage.getItem('alborz_auth_profile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Setter wrappers that sync to localStorage
  const setIsLoggedIn = useCallback((val: boolean) => {
    setIsLoggedInState(val);
    localStorage.setItem(STORAGE_KEYS.AUTH_LOGGED_IN, String(val));
  }, []);

  const setRole = useCallback((newRole: UserRole) => {
    setRoleState(newRole);
    localStorage.setItem(STORAGE_KEYS.AUTH_ROLE, newRole);
  }, []);

  const setSelectedVisitorId = useCallback((id: string) => {
    setSelectedVisitorIdState(id);
    localStorage.setItem(STORAGE_KEYS.AUTH_VISITOR_ID, id);
  }, []);

  const setSelectedSupermarketId = useCallback((id: string) => {
    setSelectedSupermarketIdState(id);
    localStorage.setItem(STORAGE_KEYS.AUTH_SUPERMARKET_ID, id);
  }, []);

  const setAuthProfile = useCallback(
    (prof: { id: string; name: string; username: string; phone: string } | null) => {
      setAuthenticatedProfile(prof);
      if (prof) {
        localStorage.setItem('alborz_auth_profile', JSON.stringify(prof));
      } else {
        localStorage.removeItem('alborz_auth_profile');
      }
    },
    []
  );

  // Clean up legacy credential keys from localStorage
  useEffect(() => {
    try {
      localStorage.removeItem('alborz_auth_password');
      localStorage.removeItem('farhoodi_auth_pass');
      localStorage.removeItem('alborz_saved_credentials');
    } catch {}
  }, []);

  // Ref to track last fetched profile user ID to avoid duplicate queries between restoreSession, listener, and login
  const lastProfileFetchedUserIdRef = useRef<string | null>(null);
  const activeProfilePromiseRef = useRef<Promise<{ success: boolean; message?: string }> | null>(null);

  // Single-source helper to fetch and apply profile without duplicate executions
  const syncUserProfile = useCallback(
    (userId: string, allowedRoles?: UserRole[]): Promise<{ success: boolean; message?: string }> => {
      if (!userId || !isSupabaseConfigured || !supabase) {
        return Promise.resolve({ success: false });
      }

      if (lastProfileFetchedUserIdRef.current === userId) {
        return Promise.resolve({ success: true });
      }

      if (activeProfilePromiseRef.current) {
        return activeProfilePromiseRef.current;
      }

      const promise = (async () => {
        try {
          const { data: prof, error: profError } = await supabase
            .from('profiles')
            .select('id, name, role, phone, is_active')
            .eq('id', userId)
            .maybeSingle();

          if (profError || !prof) {
            lastProfileFetchedUserIdRef.current = null;
            await supabase.auth.signOut();
            setIsLoggedInState(false);
            setAuthProfile(null);
            const errDetail = profError?.message ? ` (${profError.message})` : '';
            return {
              success: false,
              message: `پروفایل کاربری یافت نشد.${errDetail}`,
            };
          }

          if (prof.is_active === false) {
            lastProfileFetchedUserIdRef.current = null;
            await supabase.auth.signOut();
            setIsLoggedInState(false);
            setAuthProfile(null);
            return {
              success: false,
              message: 'حساب کاربری شما غیرفعال شده است. لطفاً با مدیریت تماس بگیرید.',
            };
          }

          const userRole = prof.role as UserRole;
          if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
            lastProfileFetchedUserIdRef.current = null;
            await supabase.auth.signOut();
            setIsLoggedInState(false);
            setAuthProfile(null);
            return {
              success: false,
              message: 'دسترسی غیرمجاز برای این بخش.',
            };
          }

          // Valid active profile
          lastProfileFetchedUserIdRef.current = prof.id;
          setIsLoggedInState(true);
          setRoleState(userRole);
          setAuthProfile({
            id: prof.id,
            name: prof.name,
            username: prof.phone || prof.id,
            phone: prof.phone || '',
          });

          if (userRole === 'visitor') {
            setSelectedVisitorIdState(prof.id);
          } else if (userRole === 'supermarket') {
            setSelectedSupermarketIdState(prof.id);
          }

          return { success: true };
        } catch (err: unknown) {
          lastProfileFetchedUserIdRef.current = null;
          console.warn('Profile synchronization note:', err);
          const errMsg = err instanceof Error ? err.message : 'خطای ارتباط با سرور در دریافت پروفایل';
          return { success: false, message: errMsg };
        } finally {
          activeProfilePromiseRef.current = null;
        }
      })();

      activeProfilePromiseRef.current = promise;
      return promise;
    },
    [setAuthProfile]
  );

  // Supabase Session Management:
  // Strictly avoid duplicate queries: profile is fetched once, and onAuthStateChange has NO await
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthReady(true);
      return;
    }

    // 1. Initial session check on mount (restoreSession)
    (async () => {
      try {
        await reconcileEitaaSession();
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session?.user) {
          lastProfileFetchedUserIdRef.current = null;
          setIsLoggedInState(false);
          setAuthProfile(null);
          localStorage.setItem(STORAGE_KEYS.AUTH_LOGGED_IN, 'false');
          localStorage.removeItem(STORAGE_KEYS.AUTH_ROLE);
          localStorage.removeItem(STORAGE_KEYS.AUTH_VISITOR_ID);
          localStorage.removeItem(STORAGE_KEYS.AUTH_SUPERMARKET_ID);
          localStorage.removeItem('alborz_auth_profile');
        } else if (session?.user) {
          if (lastProfileFetchedUserIdRef.current !== session.user.id) {
            await syncUserProfile(session.user.id);
          }
        }
      } catch (err) {
        console.warn('Initial session restore error:', err);
      } finally {
        setAuthReady(true);
      }
    })();

    // 2. Auth State Change Listener (Synchronous callback with NO await inside)
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        lastProfileFetchedUserIdRef.current = null;
        activeProfilePromiseRef.current = null;
        setIsLoggedInState(false);
        localStorage.setItem(STORAGE_KEYS.AUTH_LOGGED_IN, 'false');
        localStorage.removeItem(STORAGE_KEYS.AUTH_ROLE);
        localStorage.removeItem(STORAGE_KEYS.AUTH_VISITOR_ID);
        localStorage.removeItem(STORAGE_KEYS.AUTH_SUPERMARKET_ID);
        localStorage.removeItem('alborz_auth_profile');
        setAuthProfile(null);
      } else if (session?.user) {
        const userId = session.user.id;
        // Do not re-fetch if this user ID is already processed
        if (lastProfileFetchedUserIdRef.current !== userId) {
          // Defer profile fetch outside of auth event loop via setTimeout 0
          setTimeout(() => {
            if (lastProfileFetchedUserIdRef.current !== userId) {
              syncUserProfile(userId);
            }
          }, 0);
        }
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [syncUserProfile, setAuthProfile]);

  const currentUser: CurrentUser = useMemo(() => {
    if (role === 'admin') {
      return {
        id: authenticatedProfile?.id || 'admin-main',
        name: authenticatedProfile?.name || 'مدیریت ارشد سامانه',
        username: authenticatedProfile?.username || 'admin',
        role: 'admin',
        roleTitle: 'مدیر ارشد',
        phone: authenticatedProfile?.phone || '',
      };
    }
    if (role === 'warehouse') {
      return {
        id: authenticatedProfile?.id || 'warehouse-main',
        name: authenticatedProfile?.name || 'انباردار مرکزی',
        username: authenticatedProfile?.username || 'warehouse',
        role: 'warehouse',
        roleTitle: 'انباردار مرکزی',
        phone: authenticatedProfile?.phone || '',
      };
    }
    if (role === 'visitor') {
      const v = visitors.find(
        (vis) =>
          vis.id === selectedVisitorId ||
          (authenticatedProfile?.id && vis.id === authenticatedProfile.id) ||
          (authenticatedProfile?.phone && vis.phone && vis.phone === authenticatedProfile.phone)
      );

      const resolvedId = authenticatedProfile?.id || v?.id || selectedVisitorId || '';
      const resolvedName = authenticatedProfile?.name || v?.name || 'ویزیتور';
      const resolvedUsername = authenticatedProfile?.username || v?.username || 'visitor';
      const resolvedPhone = authenticatedProfile?.phone || v?.phone || '';
      const resolvedRegion = v?.region || 'منطقه توزیع';

      return {
        id: resolvedId,
        name: resolvedName,
        username: resolvedUsername,
        role: 'visitor',
        roleTitle: `ویزیتور (${resolvedRegion})`,
        phone: resolvedPhone,
      };
    }
    if (role === 'supermarket') {
      const s = supermarkets.find(
        (sm) =>
          sm.id === selectedSupermarketId ||
          (authenticatedProfile?.id && sm.id === authenticatedProfile.id) ||
          (authenticatedProfile?.phone && sm.phone && sm.phone === authenticatedProfile.phone)
      );

      const resolvedId = authenticatedProfile?.id || s?.id || selectedSupermarketId || '';
      const resolvedName = authenticatedProfile?.name || s?.name || 'فروشگاه طرف قرارداد';
      const resolvedUsername = authenticatedProfile?.username || s?.username || 'supermarket';
      const resolvedPhone = authenticatedProfile?.phone || s?.phone || '';
      const resolvedOwner = s?.owner || 'مدیریت';

      return {
        id: resolvedId,
        name: resolvedName,
        username: resolvedUsername,
        role: 'supermarket',
        roleTitle: `فروشگاه (${resolvedOwner})`,
        phone: resolvedPhone,
      };
    }
    return {
      id: 'admin-main',
      name: 'مدیریت ارشد سامانه',
      username: 'admin',
      role: 'admin',
      roleTitle: 'مدیر ارشد',
      phone: '',
    };
  }, [role, selectedVisitorId, selectedSupermarketId, visitors, supermarkets, authenticatedProfile]);

  // Unified Mobile-Only Supabase Auth Login
  const loginWithCredentials = useCallback(
    async (
      inputUser: string,
      inputPass: string,
      allowedRoles?: UserRole[]
    ): Promise<{ success: boolean; message?: string }> => {
      // 1. Normalize and validate mobile phone input
      const cleanPhone = normalizePhone(inputUser);
      const cleanPass = normalizeDigits(inputPass.trim());

      if (!isValidMobile(cleanPhone)) {
        return {
          success: false,
          message: 'شماره موبایل معتبر وارد کنید',
        };
      }

      if (!cleanPass) {
        return {
          success: false,
          message: 'لطفاً رمز عبور خود را وارد نمایید.',
        };
      }

      // If Supabase is NOT configured (Offline development only)
      if (!isSupabaseConfigured || !supabase) {
        const candidate = INITIAL_PROFILES.find((p) => normalizePhone(p.phone) === cleanPhone);
        if (!candidate) {
          return { success: false, message: 'شماره یا رمز عبور نادرست است' };
        }
        if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(candidate.role)) {
          return { success: false, message: 'دسترسی غیرمجاز برای این بخش.' };
        }
        setRole(candidate.role);
        setAuthProfile({
          id: candidate.id,
          name: candidate.name,
          username: candidate.username,
          phone: candidate.phone,
        });
        setIsLoggedIn(true);
        return { success: true };
      }

      // 2. Strict Real Supabase Auth: signInWithPassword
      const authEmail = `${cleanPhone}@babolpakhsh.internal`;

      try {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: cleanPass,
        });

        if (authError || !authData?.user) {
          const rawMsg = (authError?.message || '').toLowerCase();
          const errCode = (authError as { code?: string })?.code || '';
          const isInvalidCredentials =
            errCode === 'invalid_credentials' ||
            rawMsg.includes('invalid login credentials') ||
            rawMsg.includes('invalid_credentials') ||
            rawMsg.includes('invalid credentials');

          // Log authentication attempt status as a warning rather than unhandled console.error
          console.warn('[Supabase Auth]: Login attempt failed:', isInvalidCredentials ? 'invalid credentials' : authError?.message);

          let displayMsg: string;
          if (isInvalidCredentials) {
            displayMsg = 'شماره موبایل یا رمز عبور نادرست است.';
          } else {
            const codeOrStatus = errCode || authError?.status;
            const codeSuffix = codeOrStatus ? ` (کد: ${codeOrStatus})` : '';
            displayMsg = `${authError?.message || 'خطا در احراز هویت کاربر'}${codeSuffix}`;
          }

          return {
            success: false,
            message: displayMsg,
          };
        }

        // 3. Read profile through unified single-source syncUserProfile (no duplicate queries)
        const profileResult = await syncUserProfile(authData.user.id, allowedRoles);
        if (!profileResult.success) {
          return {
            success: false,
            message: profileResult.message || 'خطا در دریافت مشخصات کاربر از سرور',
          };
        }

        const eitaaInitDataForLink = getEitaaInitData();
        if (eitaaInitDataForLink && supabase) {
          supabase.functions
            .invoke('eitaa-link', { body: { initData: eitaaInitDataForLink } })
            .catch((e) => console.warn('Eitaa link failed:', e));
          supabase.functions
            .invoke('eitaa-contact', { body: { initData: eitaaInitDataForLink } })
            .catch((e) => console.warn('Eitaa contact failed:', e));
        }

        return { success: true };
      } catch (err: unknown) {
        console.warn('Login request error:', err);
        const errMsg = err instanceof Error ? err.message : 'خطای غیرمنتظره در برقراری ارتباط با سرور';
        return {
          success: false,
          message: errMsg,
        };
      }
    },
    [syncUserProfile]
  );

  const logout = useCallback(() => {
    lastProfileFetchedUserIdRef.current = null;
    activeProfilePromiseRef.current = null;
    setIsLoggedInState(false);
    localStorage.setItem(STORAGE_KEYS.AUTH_LOGGED_IN, 'false');
    localStorage.removeItem(STORAGE_KEYS.AUTH_ROLE);
    localStorage.removeItem(STORAGE_KEYS.AUTH_VISITOR_ID);
    localStorage.removeItem(STORAGE_KEYS.AUTH_SUPERMARKET_ID);
    localStorage.removeItem('alborz_auth_profile');
    setAuthProfile(null);

    // Synchronously replace browser history to root without pushing an extra entry
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname.toLowerCase();
      const base = pathname.startsWith('/babolpakhsh') ? '/babolpakhsh' : '';
      window.history.replaceState({}, '', base ? `${base}/` : '/');
    }

    // Heavy async signOut deferred to next frame so LoginScreen renders immediately
    setTimeout(async () => {
      const eitaaInitDataForUnlink = getEitaaInitData();
      if (eitaaInitDataForUnlink && supabase) {
        try {
          await supabase.functions.invoke('eitaa-link', {
            body: { initData: eitaaInitDataForUnlink, action: 'unlink' },
          });
        } catch (e) {
          console.warn('Eitaa unlink failed:', e);
        }
      }

      if (isSupabaseConfigured && supabase) {
        supabase.auth.signOut().catch((e) => console.warn('Supabase signOut error:', e));
      }
    }, 0);
  }, [setAuthProfile]);

  // Account Creation: registerSupermarket
  // 1. If called by logged-in admin or visitor: invoke create-staff-account with action 'create_store'
  // 2. If called on public login screen: signUp without role in metadata, then call RPC register_my_store
  const registerSupermarket = useCallback(
    async (data: {
      name: string;
      owner?: string;
      phone: string;
      address?: string;
      assigned_visitor_id?: string;
      username?: string;
      password: string;
    }): Promise<{ success: boolean; message: string; supermarket?: Supermarket }> => {
      const trimmedName = data.name.trim();
      const trimmedOwner = (data.owner || '').trim();
      const cleanPhone = normalizePhone(data.phone);
      const trimmedAddress = (data.address || '').trim();
      const assignedVisitorId = data.assigned_visitor_id || 'direct';
      const cleanPassword = normalizeDigits(data.password.trim());

      if (!trimmedName) {
        return { success: false, message: 'لطفاً نام فروشگاه را وارد نمایید.' };
      }
      if (!cleanPhone || !isValidMobile(cleanPhone)) {
        return { success: false, message: 'شماره موبایل معتبر وارد کنید' };
      }
      if (!cleanPassword) {
        return { success: false, message: 'تعیین رمز عبور جهت ورود به حساب الزامی است.' };
      }
      if (cleanPassword.length < MIN_PASSWORD_LENGTH) {
        return { success: false, message: `رمز عبور باید حداقل ${MIN_PASSWORD_LENGTH} کاراکتر باشد.` };
      }

      // Check uniqueness in local state
      const phoneExistsInState =
        supermarkets.some((s) => normalizePhone(s.phone) === cleanPhone) ||
        visitors.some((v) => normalizePhone(v.phone) === cleanPhone);

      if (phoneExistsInState) {
        return { success: false, message: 'این شماره قبلاً ثبت شده است.' };
      }

      // PATH A: Logged-in admin or visitor registering a store
      // Must NOT call supabase.auth.signUp in browser as it would corrupt current session!
      if (isLoggedIn && (role === 'admin' || role === 'visitor')) {
        if (!isSupabaseConfigured || !supabase) {
          const offlineSm: Supermarket = {
            id: generateUniqueId('sm'),
            name: trimmedName,
            owner: trimmedOwner,
            phone: cleanPhone,
            address: trimmedAddress,
            assigned_visitor_id: role === 'visitor' ? (selectedVisitorId || 'direct') : assignedVisitorId,
            is_active: true,
            username: cleanPhone,
            created_at: new Date().toISOString(),
          };
          setSupermarkets((prev) => [offlineSm, ...prev]);
          return { success: true, message: 'فروشگاه با موفقیت ثبت شد.', supermarket: offlineSm };
        }

        try {
          const { data: edgeData, error: edgeError } = await supabase.functions.invoke(
            'create-staff-account',
            {
              body: {
                action: 'create_store',
                name: trimmedName,
                owner: trimmedOwner,
                phone: cleanPhone,
                address: trimmedAddress,
                assigned_visitor_id: assignedVisitorId,
                password: cleanPassword,
              },
            }
          );

          if (edgeError || edgeData?.success === false) {
            const errMsg = edgeData?.error || (await getFunctionErrorMessage(edgeError, 'خطا در ثبت فروشگاه در سرور.'));
            return {
              success: false,
              message: errMsg,
            };
          }

          const newSm: Supermarket = edgeData.supermarket || {
            id: edgeData.userId,
            name: trimmedName,
            owner: trimmedOwner,
            phone: cleanPhone,
            address: trimmedAddress,
            assigned_visitor_id: assignedVisitorId,
            is_active: true,
            username: cleanPhone,
            created_at: new Date().toISOString(),
          };

          setSupermarkets((prev) => [newSm, ...prev]);

          return {
            success: true,
            message: 'فروشگاه جدید با موفقیت ثبت شد.',
            supermarket: newSm,
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'خطای سرور در ثبت فروشگاه';
          return { success: false, message: msg };
        }
      }

      // PATH B: Public self-registration by store owner (on Login screen)
      if (!isSupabaseConfigured || !supabase) {
        const offlineSm: Supermarket = {
          id: generateUniqueId('sm'),
          name: trimmedName,
          owner: trimmedOwner,
          phone: cleanPhone,
          address: trimmedAddress,
          assigned_visitor_id: assignedVisitorId,
          is_active: true,
          username: cleanPhone,
          created_at: new Date().toISOString(),
        };
        setSupermarkets((prev) => [offlineSm, ...prev]);
        return {
          success: true,
          message: 'ثبت‌نام با موفقیت انجام شد. اکنون می‌توانید با شماره همراه خود وارد شوید.',
          supermarket: offlineSm,
        };
      }

      // 1. Check uniqueness in profiles table
      try {
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id, phone')
          .eq('phone', cleanPhone)
          .maybeSingle();

        if (existingProfile) {
          return { success: false, message: 'این شماره قبلاً ثبت شده است.' };
        }
      } catch (checkErr) {
        console.warn('Phone check note:', checkErr);
      }

      // 2. Public signUp without ANY role in user_metadata
      const syntheticEmail = `${cleanPhone}@babolpakhsh.internal`;

      try {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: syntheticEmail,
          password: cleanPassword,
        });

        if (signUpError) {
          const errMsg = (signUpError.message || '').toLowerCase();
          if (errMsg.includes('already') || errMsg.includes('registered') || errMsg.includes('exists')) {
            return { success: false, message: 'این شماره قبلاً ثبت شده است.' };
          }
          return { success: false, message: `خطا در ثبت‌نام: ${signUpError.message}` };
        }

        // If signUp did not provide a session (e.g. email confirmation required or server issue)
        if (!signUpData?.session) {
          return {
            success: false,
            message: 'ثبت‌نام نیاز به تنظیم سرور دارد',
          };
        }

        // 3. Call SECURITY DEFINER RPC register_my_store to create profile & supermarket row
        const { data: rpcData, error: rpcError } = await supabase.rpc('register_my_store', {
          p_name: trimmedName,
          p_owner: trimmedOwner,
          p_address: trimmedAddress,
          p_visitor_id: assignedVisitorId !== 'direct' ? assignedVisitorId : null,
        });

        if (rpcError) {
          await supabase.auth.signOut();
          return {
            success: false,
            message: rpcError.message || 'خطا در ثبت اطلاعات تکمیلی فروشگاه.',
          };
        }

        const newSupermarket: Supermarket = {
          id: rpcData?.id || signUpData.user?.id || generateUniqueId('sm'),
          name: trimmedName,
          owner: trimmedOwner,
          phone: cleanPhone,
          address: trimmedAddress,
          assigned_visitor_id: assignedVisitorId,
          username: cleanPhone,
          is_active: true,
          approval_status: 'pending',
          registration_source: 'self_register',
          created_at: new Date().toISOString(),
        };

        setSupermarkets((prev) => [newSupermarket, ...prev]);

        return {
          success: true,
          message: 'ثبت‌نام با موفقیت انجام شد. اکنون می‌توانید با شماره همراه خود وارد شوید.',
          supermarket: newSupermarket,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'خطای پیش‌بینی نشده در فرآیند ثبت‌نام';
        return { success: false, message: msg };
      }
    },
    [isLoggedIn, role, selectedVisitorId, supermarkets, visitors, setSupermarkets]
  );

  return {
    authReady,
    isLoggedIn,
    setIsLoggedIn,
    role,
    setRole,
    selectedVisitorId,
    setSelectedVisitorId,
    selectedSupermarketId,
    setSelectedSupermarketId,
    currentUser,
    loginWithCredentials,
    logout,
    registerSupermarket,
  };
}
