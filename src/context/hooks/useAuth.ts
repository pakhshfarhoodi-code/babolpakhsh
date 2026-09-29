import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { UserRole, CurrentUser, Visitor, Supermarket, Profile } from '../../types';
import { INITIAL_PROFILES } from '../../data/initialData';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { STORAGE_KEYS, generateUniqueId, toSyntheticEmail, normalizeDigits } from '../utils';

interface UseAuthProps {
  visitors: Visitor[];
  setVisitors: React.Dispatch<React.SetStateAction<Visitor[]>>;
  supermarkets: Supermarket[];
  setSupermarkets: React.Dispatch<React.SetStateAction<Supermarket[]>>;
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'مدیر ارشد',
  warehouse: 'انبار و سردخانه',
  visitor: 'ویزیتور',
  supermarket: 'فروشگاه',
};

// Strict password verification (No backdoors, shortcuts, or default fallbacks)
const verifyPassword = (inputPass: string, savedPass: string | undefined | null): boolean => {
  const cleanInput = normalizeDigits(inputPass.trim());
  const cleanSaved = normalizeDigits((savedPass || '').trim());
  if (!cleanSaved) {
    return false;
  }
  return cleanInput === cleanSaved;
};

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

  // Setter wrappers that always sync to localStorage
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

  const setAuthProfile = useCallback((prof: { id: string; name: string; username: string; phone: string } | null) => {
    setAuthenticatedProfile(prof);
    if (prof) {
      localStorage.setItem('alborz_auth_profile', JSON.stringify(prof));
    } else {
      localStorage.removeItem('alborz_auth_profile');
    }
  }, []);

  // Auth State Listener: Sync Supabase session changes safely
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setIsLoggedInState(false);
        localStorage.setItem(STORAGE_KEYS.AUTH_LOGGED_IN, 'false');
        setAuthProfile(null);
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
          (authenticatedProfile?.username && vis.username && vis.username.toLowerCase() === authenticatedProfile.username.toLowerCase()) ||
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
          (authenticatedProfile?.username && sm.username && sm.username.toLowerCase() === authenticatedProfile.username.toLowerCase()) ||
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

  // Unified account resolution & login evaluator
  const loginWithCredentials = useCallback(
    async (
      inputUser: string,
      inputPass: string,
      allowedRoles?: UserRole[]
    ): Promise<{ success: boolean; message?: string }> => {
      const normalizedUser = normalizeDigits(inputUser.trim()).toLowerCase();
      const cleanPass = normalizeDigits(inputPass.trim());
      const rawDigits = normalizedUser.replace(/[^0-9]/g, '');
      const userPrefix = normalizedUser.includes('@') ? normalizedUser.split('@')[0] : normalizedUser;

      // 1. Gather all candidates across local state and localStorage
      interface UnifiedAccount {
        id: string;
        name: string;
        role: UserRole;
        username: string;
        phone: string;
        passwords: string[];
        is_active: boolean;
        assigned_visitor_id?: string;
        region?: string;
        owner?: string;
        address?: string;
      }

      const candidateMap = new Map<string, UnifiedAccount>();

      const addCandidate = (
        id: string,
        name: string,
        role: UserRole,
        username: string,
        phone: string,
        password?: string,
        is_active: boolean = true,
        extra?: Partial<UnifiedAccount>
      ) => {
        if (!id) return;
        const existing = candidateMap.get(id);
        const passList = existing ? [...existing.passwords] : [];
        if (password && password.trim() && !passList.includes(password.trim())) {
          passList.push(password.trim());
        }

        candidateMap.set(id, {
          id,
          name: name || existing?.name || 'کاربر',
          role: role || existing?.role || 'supermarket',
          username: username || existing?.username || '',
          phone: phone || existing?.phone || '',
          passwords: passList,
          is_active: is_active !== undefined ? is_active : (existing?.is_active ?? true),
          assigned_visitor_id: extra?.assigned_visitor_id || existing?.assigned_visitor_id,
          region: extra?.region || existing?.region,
          owner: extra?.owner || existing?.owner,
          address: extra?.address || existing?.address,
        });
      };

      // A. Populate from INITIAL_PROFILES
      INITIAL_PROFILES.forEach((p) => {
        addCandidate(p.id, p.name, p.role, p.username, p.phone, p.password, true);
      });

      // B. Populate from local supermarkets
      supermarkets.forEach((s) => {
        addCandidate(s.id, s.name, 'supermarket', s.username || '', s.phone || '', s.password, s.is_active ?? true, {
          assigned_visitor_id: s.assigned_visitor_id,
          owner: s.owner,
          address: s.address,
        });
      });

      // C. Populate from local visitors
      visitors.forEach((v) => {
        addCandidate(v.id, v.name, 'visitor', v.username || '', v.phone || '', v.password, v.is_active ?? true, {
          region: v.region,
        });
      });

      // D. If Supabase is online, query remote tables to enrich credentials
      if (isSupabaseConfigured && supabase) {
        try {
          const [
            { data: dbProfiles },
            { data: dbSupermarkets },
            { data: dbVisitors },
          ] = await Promise.all([
            supabase.from('profiles').select('*'),
            supabase.from('supermarkets').select('*'),
            supabase.from('visitors').select('*'),
          ]);

          (dbProfiles || []).forEach((p: any) => {
            addCandidate(p.id, p.name, p.role, p.username, p.phone, p.password, p.is_active ?? true);
          });

          (dbSupermarkets || []).forEach((s: any) => {
            addCandidate(s.id, s.name, 'supermarket', s.username || '', s.phone || '', s.password, s.is_active ?? true, {
              assigned_visitor_id: s.assigned_visitor_id,
              owner: s.owner,
              address: s.address,
            });
          });

          (dbVisitors || []).forEach((v: any) => {
            addCandidate(v.id, v.name, 'visitor', v.username || '', v.phone || '', v.password, v.is_active ?? true, {
              region: v.region,
            });
          });
        } catch (dbErr) {
          console.warn('Supabase credential lookup note:', dbErr);
        }
      }

      // 2. Find matching account candidate
      const allAccounts = Array.from(candidateMap.values());

      let matchedAccount = allAccounts.find((acc) => {
        const u = normalizeDigits(acc.username || '').toLowerCase();
        const pPhone = normalizeDigits(acc.phone || '').replace(/[^0-9]/g, '');

        // Username match (exact or prefix)
        if (u && (u === normalizedUser || u === userPrefix)) {
          return true;
        }

        // Exact ID match
        if (acc.id && acc.id.toLowerCase() === normalizedUser) {
          return true;
        }

        // Phone number match (support with or without leading 0 or country code)
        if (rawDigits.length >= 7 && pPhone.length >= 7) {
          if (pPhone === rawDigits) return true;
          if (pPhone.endsWith(rawDigits) || rawDigits.endsWith(pPhone)) return true;
          if (rawDigits.length >= 10 && pPhone.length >= 10) {
            if (rawDigits.slice(-10) === pPhone.slice(-10)) return true;
          }
        }

        return false;
      });

      // If no account found locally, attempt direct Supabase Auth signIn if online
      if (!matchedAccount && isSupabaseConfigured && supabase) {
        try {
          const authEmail = normalizedUser.includes('@')
            ? normalizedUser
            : toSyntheticEmail(normalizedUser);

          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: authEmail,
            password: cleanPass,
          });

          if (!authError && authData?.user) {
            const userMeta = authData.user.user_metadata || {};
            const resolvedRole: UserRole = (userMeta.role && ['admin', 'warehouse', 'visitor', 'supermarket'].includes(userMeta.role))
              ? (userMeta.role as UserRole)
              : (allowedRoles && allowedRoles.length > 0 ? allowedRoles[0] : 'admin');

            matchedAccount = {
              id: authData.user.id,
              name: userMeta.name || (normalizedUser === 'pakhshfarhoodi@gmail.com' ? 'مدیریت ارشد شبکه پخش فرهودی' : 'کاربر سامانه'),
              role: resolvedRole,
              username: normalizedUser,
              phone: userMeta.phone || '',
              passwords: [cleanPass],
              is_active: true,
            };
          }
        } catch {}
      }

      // If no account found at all
      if (!matchedAccount) {
        return {
          success: false,
          message: 'حساب کاربری با این نام کاربری یا شماره همراه یافت نشد. لطفاً در صورت عدم ثبت‌نام، ابتدا حساب جدید ایجاد نمایید.',
        };
      }

      // 3. Verify role match (if caller specified allowedRoles)
      if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(matchedAccount.role)) {
        const roleName = ROLE_LABELS[matchedAccount.role] || matchedAccount.role;
        return {
          success: false,
          message: `این حساب متعلق به «${roleName}» است. لطفاً از زبانه اختصاصی «${roleName}» وارد شوید.`,
        };
      }

      // 4. Check active status
      if (matchedAccount.is_active === false) {
        return {
          success: false,
          message: 'حساب کاربری شما غیرفعال شده است. جهت فعال‌سازی مجدد با پشتیبانی یا مدیریت تماس بگیرید.',
        };
      }

      // 5. Check password against all known passwords for this account
      let passwordMatched = false;
      for (const pass of matchedAccount.passwords) {
        if (verifyPassword(cleanPass, pass)) {
          passwordMatched = true;
          break;
        }
      }

      // If not matched locally, try Supabase Auth signInWithPassword if online
      if (!passwordMatched && isSupabaseConfigured && supabase) {
        try {
          const authEmail = normalizedUser.includes('@')
            ? normalizedUser
            : toSyntheticEmail(matchedAccount.username || normalizedUser);

          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: authEmail,
            password: cleanPass,
          });

          if (!authError && authData?.user) {
            passwordMatched = true;
          }
        } catch {}
      }

      if (!passwordMatched) {
        return {
          success: false,
          message: 'رمز عبور وارد شده نادرست است. لطفاً رمز عبور خود را مجدداً بررسی نمایید.',
        };
      }

      // 6. Login Success! Set state, active profile, and persist to localStorage
      setRole(matchedAccount.role);
      setAuthProfile({
        id: matchedAccount.id,
        name: matchedAccount.name,
        username: matchedAccount.username || matchedAccount.phone || matchedAccount.id,
        phone: matchedAccount.phone,
      });

      if (matchedAccount.role === 'visitor') {
        const fullVis: Visitor = {
          id: matchedAccount.id,
          name: matchedAccount.name,
          phone: matchedAccount.phone,
          region: matchedAccount.region || 'مرکز استان',
          username: matchedAccount.username,
          password: cleanPass,
          is_active: true,
        };
        setVisitors((prev) => {
          const exists = prev.find((v) => v.id === fullVis.id);
          const next = exists
            ? prev.map((v) => (v.id === fullVis.id ? { ...v, ...fullVis } : v))
            : [...prev, fullVis];
          try {
            localStorage.setItem(STORAGE_KEYS.VISITORS, JSON.stringify(next));
          } catch {}
          return next;
        });
        setSelectedVisitorId(matchedAccount.id);
      } else if (matchedAccount.role === 'supermarket') {
        const fullSm: Supermarket = {
          id: matchedAccount.id,
          name: matchedAccount.name,
          owner: matchedAccount.owner || 'مدیریت فروشگاه',
          phone: matchedAccount.phone,
          address: matchedAccount.address || 'تهران',
          assigned_visitor_id: matchedAccount.assigned_visitor_id || 'direct',
          username: matchedAccount.username,
          password: cleanPass,
          is_active: true,
        };
        setSupermarkets((prev) => {
          const exists = prev.find((s) => s.id === fullSm.id);
          const next = exists
            ? prev.map((s) => (s.id === fullSm.id ? { ...s, ...fullSm } : s))
            : [...prev, fullSm];
          try {
            localStorage.setItem(STORAGE_KEYS.SUPERMARKETS, JSON.stringify(next));
          } catch {}
          return next;
        });
        setSelectedSupermarketId(matchedAccount.id);
      }

      setIsLoggedIn(true);
      return { success: true };
    },
    [supermarkets, visitors, setRole, setSelectedVisitorId, setSelectedSupermarketId, setIsLoggedIn, setAuthProfile, setVisitors, setSupermarkets]
  );

  const login = useCallback(
    (profileId: string) => {
      const dynamicSm = supermarkets.find((s) => s.id === profileId);
      if (dynamicSm) {
        setRole('supermarket');
        setAuthProfile({
          id: dynamicSm.id,
          name: dynamicSm.name,
          username: dynamicSm.username || dynamicSm.id,
          phone: dynamicSm.phone,
        });
        setSelectedSupermarketId(dynamicSm.id);
      }
      setIsLoggedIn(true);
    },
    [supermarkets, setRole, setSelectedSupermarketId, setIsLoggedIn, setAuthProfile]
  );

  const logout = useCallback(() => {
    setIsLoggedInState(false);
    localStorage.setItem(STORAGE_KEYS.AUTH_LOGGED_IN, 'false');
    localStorage.removeItem(STORAGE_KEYS.AUTH_ROLE);
    localStorage.removeItem(STORAGE_KEYS.AUTH_VISITOR_ID);
    localStorage.removeItem(STORAGE_KEYS.AUTH_SUPERMARKET_ID);
    localStorage.removeItem('alborz_auth_profile');
    setAuthProfile(null);
    if (isSupabaseConfigured && supabase) {
      supabase.auth.signOut().catch((e) => console.warn('Supabase signOut error:', e));
    }
  }, [setAuthProfile]);

  const registerSupermarket = useCallback(
    async (data: {
      name: string;
      owner: string;
      phone: string;
      address: string;
      assigned_visitor_id: string;
      username: string;
      password: string;
    }): Promise<{ success: boolean; message: string; supermarket?: Supermarket }> => {
      const trimmedName = data.name.trim();
      const trimmedOwner = data.owner.trim() || 'مدیر فروشگاه';
      const trimmedPhone = normalizeDigits(data.phone.trim());
      const trimmedAddress = data.address.trim() || 'تهران - منطقه توزیع زنجیره سرد';
      const assignedVisitorId = data.assigned_visitor_id || 'direct';
      const trimmedUsername = normalizeDigits(data.username.trim());
      const trimmedPassword = normalizeDigits(data.password.trim());

      if (!trimmedName) {
        return { success: false, message: 'لطفاً نام فروشگاه را وارد نمایید.' };
      }
      if (!trimmedPhone) {
        return { success: false, message: 'لطفاً شماره تماس را وارد نمایید.' };
      }
      if (!trimmedUsername) {
        return { success: false, message: 'تعیین نام کاربری جهت ورود به حساب الزامی است.' };
      }
      if (!trimmedPassword) {
        return { success: false, message: 'تعیین رمز عبور جهت ورود به حساب الزامی است.' };
      }
      if (trimmedPassword.length < 3) {
        return { success: false, message: 'رمز عبور باید حداقل ۳ کاراکتر باشد.' };
      }

      const phoneExists = supermarkets.some(
        (s) => normalizeDigits(s.phone).replace(/\s+/g, '') === trimmedPhone.replace(/\s+/g, '')
      );
      if (phoneExists) {
        return { success: false, message: 'این شماره تماس قبلاً برای یک فروشگاه دیگر ثبت شده است.' };
      }

      const usernameExists = supermarkets.some(
        (s) => s.username && normalizeDigits(s.username).toLowerCase() === trimmedUsername.toLowerCase()
      );
      if (usernameExists) {
        return {
          success: false,
          message: 'این نام کاربری قبلاً توسط فروشگاه دیگری ثبت شده است. لطفاً نام کاربری دیگری انتخاب نمایید.',
        };
      }

      let authUserId = generateUniqueId('shop');

      if (isSupabaseConfigured && supabase) {
        const syntheticEmail = toSyntheticEmail(trimmedUsername);

        try {
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: syntheticEmail,
            password: trimmedPassword,
            options: {
              data: {
                name: trimmedName,
                role: 'supermarket',
                username: trimmedUsername,
              },
            },
          });

          if (!signUpError && signUpData?.user) {
            authUserId = signUpData.user.id;
          }
        } catch (authErr) {
          console.warn('Supabase Auth signUp note:', authErr);
        }

        let validVisitorId: string | null = null;
        if (assignedVisitorId && assignedVisitorId !== 'direct') {
          const match = visitors.find((v) => v.id === assignedVisitorId);
          if (match) {
            validVisitorId = match.id;
          }
        }

        const { error: profileError } = await supabase.from('profiles').upsert({
          id: authUserId,
          name: trimmedName,
          role: 'supermarket',
          phone: trimmedPhone,
          username: trimmedUsername,
          password: trimmedPassword,
          is_active: true,
        });

        if (profileError) {
          console.warn('Profile upsert warning:', profileError.message);
        }

        const { error: smError } = await supabase.from('supermarkets').upsert({
          id: authUserId,
          name: trimmedName,
          owner: trimmedOwner,
          phone: trimmedPhone,
          address: trimmedAddress,
          assigned_visitor_id: validVisitorId,
          is_active: true,
          username: trimmedUsername,
          password: trimmedPassword,
        });

        if (smError) {
          console.warn('Supermarket upsert warning:', smError.message);
        }
      }

      const newSupermarket: Supermarket = {
        id: authUserId,
        name: trimmedName,
        owner: trimmedOwner,
        phone: trimmedPhone,
        address: trimmedAddress,
        assigned_visitor_id: assignedVisitorId,
        username: trimmedUsername,
        password: trimmedPassword,
        is_active: true,
        created_at: new Date().toISOString(),
      };

      setSupermarkets((prev) => [newSupermarket, ...prev]);

      return {
        success: true,
        message: 'ثبت‌نام با موفقیت انجام شد. اکنون می‌توانید مستقیماً وارد حساب کاربری خود شوید.',
        supermarket: newSupermarket,
      };
    },
    [supermarkets, visitors, setSupermarkets]
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
    login,
    loginWithCredentials,
    logout,
    registerSupermarket,
  };
}
