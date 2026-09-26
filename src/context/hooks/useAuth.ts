import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { UserRole, CurrentUser, Visitor, Supermarket } from '../../types';
import { INITIAL_PROFILES } from '../../data/initialData';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { STORAGE_KEYS, generateUniqueId, toSyntheticEmail } from '../utils';

interface UseAuthProps {
  visitors: Visitor[];
  supermarkets: Supermarket[];
  setSupermarkets: React.Dispatch<React.SetStateAction<Supermarket[]>>;
}

export function useAuth({ visitors, supermarkets, setSupermarkets }: UseAuthProps) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.AUTH_LOGGED_IN);
    return saved !== null ? saved === 'true' : true;
  });

  const [role, setRole] = useState<UserRole>('admin');
  const [selectedVisitorId, setSelectedVisitorId] = useState<string>('vis-1');
  const [selectedSupermarketId, setSelectedSupermarketId] = useState<string>('shop-1');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.AUTH_LOGGED_IN, String(isLoggedIn));
  }, [isLoggedIn]);

  // Auth State Listener: Keep isLoggedIn synced if session expires or logs out
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setIsLoggedIn(false);
        localStorage.setItem(STORAGE_KEYS.AUTH_LOGGED_IN, 'false');
      } else if (event === 'SIGNED_IN' && session) {
        setIsLoggedIn(true);
        localStorage.setItem(STORAGE_KEYS.AUTH_LOGGED_IN, 'true');
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const currentUser: CurrentUser = useMemo(() => {
    if (role === 'admin') {
      return {
        id: 'admin-1',
        name: 'مدیریت مرکزی البرز',
        username: 'admin',
        role: 'admin',
        roleTitle: 'مدیر ارشد',
        phone: '۰۹۱۲۰۰۰۰۰۰۰',
      };
    }
    if (role === 'warehouse') {
      return {
        id: 'wh-1',
        name: 'انباردار سردخانه البرز',
        username: 'warehouse',
        role: 'warehouse',
        roleTitle: 'انباردار سردخانه',
        phone: '۰۹۱۲۱۱۱۰۰۰۰',
      };
    }
    if (role === 'visitor') {
      const v = visitors.find((vis) => vis.id === selectedVisitorId) || visitors[0];
      return {
        id: v?.id || 'vis-1',
        name: v?.name || 'علیرضا رضایی',
        username: v?.username || 'visitor1',
        role: 'visitor',
        roleTitle: `ویزیتور (${v?.region || 'منطقه توزیع'})`,
        phone: v?.phone || '۰۹۱۲۳۴۵۶۷۸۹',
      };
    }
    if (role === 'supermarket') {
      const s = supermarkets.find((sm) => sm.id === selectedSupermarketId) || supermarkets[0];
      return {
        id: s?.id || 'shop-1',
        name: s?.name || 'سوپرمارکت بهاران',
        username: s?.username || 'shop1',
        role: 'supermarket',
        roleTitle: `فروشگاه (${s?.owner || 'مدیریت'})`,
        phone: s?.phone || '۰۹۱۲۱۱۱۱۱۱۱',
      };
    }
    return {
      id: 'admin-1',
      name: 'مدیریت مرکزی البرز',
      username: 'admin',
      role: 'admin',
      roleTitle: 'مدیر ارشد',
      phone: '۰۹۱۲۰۰۰۰۰۰۰',
    };
  }, [role, selectedVisitorId, selectedSupermarketId, visitors, supermarkets]);

  // Local fallback login evaluator
  const localLoginFallback = useCallback(
    (
      cleanUser: string,
      cleanPass: string,
      allowedRoles?: UserRole[]
    ): { success: boolean; message?: string } => {
      // 1. Search in predefined profiles
      const matchedProfile = INITIAL_PROFILES.find((p) => {
        if (allowedRoles && !allowedRoles.includes(p.role)) return false;
        const u = p.username.toLowerCase();
        const phoneDigits = p.phone.replace(/[^0-9]/g, '');
        const inputDigits = cleanUser.replace(/[^0-9]/g, '');
        const isUserMatch = u === cleanUser || (inputDigits.length > 5 && phoneDigits === inputDigits);
        const isPassMatch = (p.password || '123') === cleanPass;
        return isUserMatch && isPassMatch;
      });

      if (matchedProfile) {
        setRole(matchedProfile.role);
        if (matchedProfile.role === 'visitor') {
          setSelectedVisitorId(matchedProfile.id);
        } else if (matchedProfile.role === 'supermarket') {
          setSelectedSupermarketId(matchedProfile.id);
        }
        setIsLoggedIn(true);
        localStorage.setItem(STORAGE_KEYS.AUTH_LOGGED_IN, 'true');
        return { success: true };
      }

      // 2. Search in registered supermarkets
      if (!allowedRoles || allowedRoles.includes('supermarket')) {
        const matchedSm = supermarkets.find((s) => {
          const u = (s.username || s.id).toLowerCase();
          const phoneDigits = s.phone.replace(/[^0-9]/g, '');
          const inputDigits = cleanUser.replace(/[^0-9]/g, '');
          const isUserMatch = u === cleanUser || (inputDigits.length > 5 && phoneDigits === inputDigits);
          const isPassMatch = (s.password || '123') === cleanPass;
          return isUserMatch && isPassMatch;
        });

        if (matchedSm) {
          setRole('supermarket');
          setSelectedSupermarketId(matchedSm.id);
          setIsLoggedIn(true);
          localStorage.setItem(STORAGE_KEYS.AUTH_LOGGED_IN, 'true');
          return { success: true };
        }
      }

      return {
        success: false,
        message: 'نام کاربری یا رمز عبور وارد شده نادرست است.',
      };
    },
    [supermarkets]
  );

  // Supabase Auth SignIn with fallback to local demo credentials
  const loginWithCredentials = useCallback(
    async (
      inputUser: string,
      inputPass: string,
      allowedRoles?: UserRole[]
    ): Promise<{ success: boolean; message?: string }> => {
      const cleanUser = inputUser.trim().toLowerCase();
      const cleanPass = inputPass.trim();

      if (isSupabaseConfigured && supabase) {
        let resolvedUsername = cleanUser;
        const phoneMatchProfile = INITIAL_PROFILES.find((p) => {
          const pDigits = p.phone.replace(/[^0-9]/g, '');
          const inDigits = cleanUser.replace(/[^0-9]/g, '');
          return inDigits.length > 5 && pDigits === inDigits;
        });
        if (phoneMatchProfile) {
          resolvedUsername = phoneMatchProfile.username;
        } else {
          const phoneMatchSm = supermarkets.find((s) => {
            const sDigits = s.phone.replace(/[^0-9]/g, '');
            const inDigits = cleanUser.replace(/[^0-9]/g, '');
            return inDigits.length > 5 && sDigits === inDigits;
          });
          if (phoneMatchSm?.username) {
            resolvedUsername = phoneMatchSm.username;
          }
        }

        const syntheticEmail = toSyntheticEmail(resolvedUsername);

        try {
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: syntheticEmail,
            password: cleanPass,
          });

          if (!authError && authData?.user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', authData.user.id)
              .single();

            if (profile) {
              const userRole = profile.role as UserRole;
              if (allowedRoles && !allowedRoles.includes(userRole)) {
                return { success: false, message: 'شما دسترسی ورود به این بخش را ندارید.' };
              }
              setRole(userRole);
              if (userRole === 'visitor') {
                setSelectedVisitorId(profile.id);
              } else if (userRole === 'supermarket') {
                setSelectedSupermarketId(profile.id);
              }
            } else {
              localLoginFallback(cleanUser, cleanPass, allowedRoles);
            }

            setIsLoggedIn(true);
            localStorage.setItem(STORAGE_KEYS.AUTH_LOGGED_IN, 'true');
            return { success: true };
          }

          const fallbackResult = localLoginFallback(cleanUser, cleanPass, allowedRoles);
          if (fallbackResult.success) {
            return fallbackResult;
          }

          return {
            success: false,
            message: authError?.message?.includes('Invalid login credentials')
              ? 'نام کاربری یا رمز عبور وارد شده نادرست است.'
              : (authError?.message || 'خطا در ورود به حساب کاربری.'),
          };
        } catch (err: unknown) {
          console.warn('Supabase Auth connection error, attempting local fallback:', err);
          return localLoginFallback(cleanUser, cleanPass, allowedRoles);
        }
      }

      return localLoginFallback(cleanUser, cleanPass, allowedRoles);
    },
    [supermarkets, localLoginFallback]
  );

  const login = useCallback(
    (profileId: string) => {
      const profile = INITIAL_PROFILES.find((p) => p.id === profileId);
      if (profile) {
        setRole(profile.role);
        if (profile.role === 'visitor') {
          setSelectedVisitorId(profile.id);
        } else if (profile.role === 'supermarket') {
          setSelectedSupermarketId(profile.id);
        }
      } else {
        const dynamicSm = supermarkets.find((s) => s.id === profileId);
        if (dynamicSm) {
          setRole('supermarket');
          setSelectedSupermarketId(dynamicSm.id);
        }
      }
      setIsLoggedIn(true);
      localStorage.setItem(STORAGE_KEYS.AUTH_LOGGED_IN, 'true');
    },
    [supermarkets]
  );

  const logout = useCallback(() => {
    setIsLoggedIn(false);
    localStorage.setItem(STORAGE_KEYS.AUTH_LOGGED_IN, 'false');
    if (isSupabaseConfigured && supabase) {
      supabase.auth.signOut().catch((e) => console.warn('Supabase signOut error:', e));
    }
  }, []);

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
      const trimmedPhone = data.phone.trim();
      const trimmedAddress = data.address.trim() || 'تهران - منطقه توزیع زنجیره سرد';
      const assignedVisitorId = data.assigned_visitor_id || 'vis-1';
      const trimmedUsername = data.username.trim();
      const trimmedPassword = data.password.trim();

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
        (s) => s.phone.replace(/\s+/g, '') === trimmedPhone.replace(/\s+/g, '')
      );
      if (phoneExists) {
        return { success: false, message: 'این شماره تماس قبلاً برای یک فروشگاه دیگر ثبت شده است.' };
      }

      const usernameExists = supermarkets.some(
        (s) => s.username && s.username.trim().toLowerCase() === trimmedUsername.toLowerCase()
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

        if (signUpError) {
          return {
            success: false,
            message: `خطا در ایجاد حساب کاربری آنلاین: ${signUpError.message}`,
          };
        }

        if (!signUpData.user) {
          return {
            success: false,
            message: 'خطا در احراز هویت سرور: کاربر ایجاد نشد.',
          };
        }

        authUserId = signUpData.user.id;

        const { error: profileError } = await supabase.from('profiles').insert({
          id: authUserId,
          name: trimmedName,
          role: 'supermarket',
          phone: trimmedPhone,
        });

        if (profileError) {
          return {
            success: false,
            message: `خطا در ثبت پروفایل سامانه: ${profileError.message}`,
          };
        }

        const { error: smError } = await supabase.from('supermarkets').insert({
          id: authUserId,
          name: trimmedName,
          owner: trimmedOwner,
          phone: trimmedPhone,
          address: trimmedAddress,
          assigned_visitor_id: assignedVisitorId,
          is_active: true,
        });

        if (smError) {
          return {
            success: false,
            message: `خطا در ثبت اطلاعات فروشگاه در پایگاه داده: ${smError.message}`,
          };
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
      setSelectedSupermarketId(authUserId);
      setRole('supermarket');
      setIsLoggedIn(true);
      localStorage.setItem(STORAGE_KEYS.AUTH_LOGGED_IN, 'true');

      return {
        success: true,
        message: 'حساب کاربری فروشگاه با موفقیت ایجاد شد و وارد شدید.',
        supermarket: newSupermarket,
      };
    },
    [supermarkets, setSupermarkets]
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
