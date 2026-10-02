import React, { useState, useEffect, useMemo, useCallback } from 'react';
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

export function useAuth({ visitors, setVisitors, supermarkets, setSupermarkets }: UseAuthProps) {
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

  // Supabase Session Management:
  // On load, getSession() then fetch explicit profile columns from profiles with id = auth.uid()
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const restoreSession = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.user) {
          setIsLoggedInState(false);
          setAuthProfile(null);
          return;
        }

        // Fetch profile with explicit columns: id, name, role, phone, is_active
        const { data: prof, error: profError } = await supabase
          .from('profiles')
          .select('id, name, role, phone, is_active')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profError || !prof) {
          await supabase.auth.signOut();
          setIsLoggedInState(false);
          setAuthProfile(null);
          return;
        }

        if (prof.is_active === false) {
          await supabase.auth.signOut();
          setIsLoggedInState(false);
          setAuthProfile(null);
          return;
        }

        // Valid session & active profile restored
        const userRole = prof.role as UserRole;
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
      } catch (err) {
        console.warn('Session restoration note:', err);
      }
    };

    restoreSession();

    // Listen to Auth State Changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setIsLoggedInState(false);
        localStorage.setItem(STORAGE_KEYS.AUTH_LOGGED_IN, 'false');
        localStorage.removeItem(STORAGE_KEYS.AUTH_ROLE);
        localStorage.removeItem(STORAGE_KEYS.AUTH_VISITOR_ID);
        localStorage.removeItem(STORAGE_KEYS.AUTH_SUPERMARKET_ID);
        localStorage.removeItem('alborz_auth_profile');
        setAuthProfile(null);
      } else if (event === 'SIGNED_IN' && session?.user) {
        // Fetch profile explicitly
        const { data: prof } = await supabase
          .from('profiles')
          .select('id, name, role, phone, is_active')
          .eq('id', session.user.id)
          .maybeSingle();

        if (prof && prof.is_active !== false) {
          const userRole = prof.role as UserRole;
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
        }
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [setAuthProfile]);

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
          // Generic failure message per requirement (do not reveal which was wrong)
          return {
            success: false,
            message: 'شماره یا رمز عبور نادرست است',
          };
        }

        // 3. Read profile with explicit columns ONLY: id, name, role, phone, is_active
        const { data: profile, error: profError } = await supabase
          .from('profiles')
          .select('id, name, role, phone, is_active')
          .eq('id', authData.user.id)
          .maybeSingle();

        if (profError || !profile) {
          await supabase.auth.signOut();
          return {
            success: false,
            message: 'پروفایل کاربری یافت نشد.',
          };
        }

        // Role MUST come strictly from profiles table, NEVER user_metadata
        const userRole = profile.role as UserRole;

        // Check if account is active
        if (profile.is_active === false) {
          await supabase.auth.signOut();
          return {
            success: false,
            message: 'حساب کاربری شما غیرفعال شده است. لطفاً با مدیریت تماس بگیرید.',
          };
        }

        // Check allowedRoles for the active login tab
        if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
          await supabase.auth.signOut();
          return {
            success: false,
            message: 'دسترسی غیرمجاز برای این بخش.',
          };
        }

        // Login success! Set session state and persisted profile
        setRole(userRole);
        setAuthProfile({
          id: profile.id,
          name: profile.name,
          username: profile.phone || profile.id,
          phone: profile.phone || cleanPhone,
        });

        if (userRole === 'visitor') {
          setSelectedVisitorId(profile.id);
        } else if (userRole === 'supermarket') {
          setSelectedSupermarketId(profile.id);
        }

        setIsLoggedIn(true);
        return { success: true };
      } catch (err: unknown) {
        console.warn('Login request error:', err);
        return {
          success: false,
          message: 'شماره یا رمز عبور نادرست است',
        };
      }
    },
    [setRole, setSelectedVisitorId, setSelectedSupermarketId, setIsLoggedIn, setAuthProfile]
  );

  const logout = useCallback(async () => {
    setIsLoggedInState(false);
    localStorage.setItem(STORAGE_KEYS.AUTH_LOGGED_IN, 'false');
    localStorage.removeItem(STORAGE_KEYS.AUTH_ROLE);
    localStorage.removeItem(STORAGE_KEYS.AUTH_VISITOR_ID);
    localStorage.removeItem(STORAGE_KEYS.AUTH_SUPERMARKET_ID);
    localStorage.removeItem('alborz_auth_profile');
    setAuthProfile(null);
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('Supabase signOut error:', e);
      }
    }
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
