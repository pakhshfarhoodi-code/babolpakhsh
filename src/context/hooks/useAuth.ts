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
    return saved !== null ? saved === 'true' : false;
  });

  const [role, setRole] = useState<UserRole>('admin');
  const [selectedVisitorId, setSelectedVisitorId] = useState<string>(() => visitors[0]?.id || '');
  const [selectedSupermarketId, setSelectedSupermarketId] = useState<string>(() => supermarkets[0]?.id || '');

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
        name: 'مدیریت مرکزی فرهودی (بارفروش)',
        username: 'admin',
        role: 'admin',
        roleTitle: 'مدیر ارشد',
        phone: '۰۹۱۲۰۰۰۰۰۰۰',
      };
    }
    if (role === 'warehouse') {
      return {
        id: 'wh-1',
        name: 'انباردار مرکزی فرهودی',
        username: 'warehouse',
        role: 'warehouse',
        roleTitle: 'انباردار مرکزی',
        phone: '۰۹۱۲۱۱۱۰۰۰۰',
      };
    }
    if (role === 'visitor') {
      const v = visitors.find((vis) => vis.id === selectedVisitorId) || visitors[0];
      return {
        id: v?.id || '',
        name: v?.name || 'ویزیتور',
        username: v?.username || 'visitor',
        role: 'visitor',
        roleTitle: `ویزیتور (${v?.region || 'منطقه توزیع'})`,
        phone: v?.phone || '',
      };
    }
    if (role === 'supermarket') {
      const s = supermarkets.find((sm) => sm.id === selectedSupermarketId) || supermarkets[0];
      return {
        id: s?.id || '',
        name: s?.name || 'فروشگاه طرف قرارداد',
        username: s?.username || 'supermarket',
        role: 'supermarket',
        roleTitle: `فروشگاه (${s?.owner || 'مدیریت'})`,
        phone: s?.phone || '',
      };
    }
    return {
      id: 'admin-1',
      name: 'مدیریت مرکزی فرهودی (بارفروش)',
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
      const userPrefix = cleanUser.includes('@') ? cleanUser.split('@')[0] : cleanUser;

      // 1. Search in predefined profiles
      const matchedProfile = INITIAL_PROFILES.find((p) => {
        if (allowedRoles && !allowedRoles.includes(p.role)) return false;
        const u = p.username.toLowerCase();
        const phoneDigits = p.phone.replace(/[^0-9]/g, '');
        const inputDigits = cleanUser.replace(/[^0-9]/g, '');
        const isUserMatch =
          u === cleanUser ||
          u === userPrefix ||
          (inputDigits.length > 5 && phoneDigits === inputDigits);
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

      // 2. Search in registered visitors
      if (!allowedRoles || allowedRoles.includes('visitor')) {
        const matchedVis = visitors.find((v) => {
          const u = (v.username || v.id).toLowerCase();
          const phoneDigits = v.phone.replace(/[^0-9]/g, '');
          const inputDigits = cleanUser.replace(/[^0-9]/g, '');
          const isUserMatch =
            u === cleanUser ||
            u === userPrefix ||
            (inputDigits.length > 5 && phoneDigits === inputDigits);
          const targetPass = v.password || '123';
          const isPassMatch = targetPass === cleanPass || (cleanPass === '123456' && (!v.password || v.password === '123456'));
          return isUserMatch && isPassMatch;
        });

        if (matchedVis) {
          setRole('visitor');
          setSelectedVisitorId(matchedVis.id);
          setIsLoggedIn(true);
          localStorage.setItem(STORAGE_KEYS.AUTH_LOGGED_IN, 'true');
          return { success: true };
        }
      }

      // 3. Search in registered supermarkets
      if (!allowedRoles || allowedRoles.includes('supermarket')) {
        const matchedSm = supermarkets.find((s) => {
          const u = (s.username || s.id).toLowerCase();
          const phoneDigits = s.phone.replace(/[^0-9]/g, '');
          const inputDigits = cleanUser.replace(/[^0-9]/g, '');
          const isUserMatch =
            u === cleanUser ||
            u === userPrefix ||
            (inputDigits.length > 5 && phoneDigits === inputDigits);
          const targetPass = s.password || '123';
          const isPassMatch = targetPass === cleanPass || (cleanPass === '123456' && (!s.password || s.password === '123456'));
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
    [supermarkets, visitors]
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
        let authEmail = '';

        if (cleanUser.includes('@')) {
          // If input contains '@', provide it directly as email to Supabase Auth
          authEmail = cleanUser;
        } else {
          // If no '@', resolve username (check for phone input) and generate ${input}@babolpakhsh.internal
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

          authEmail = toSyntheticEmail(resolvedUsername);
        }

        try {
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: authEmail,
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

          // If Supabase Auth failed (e.g. password was reset by admin in DB), check profiles table directly
          const userPrefix = cleanUser.includes('@') ? cleanUser.split('@')[0] : cleanUser;
          const inputDigits = cleanUser.replace(/[^0-9]/g, '');

          const { data: dbProfiles } = await supabase
            .from('profiles')
            .select('*');

          if (dbProfiles && dbProfiles.length > 0) {
            const matchedProfile = dbProfiles.find((p: any) => {
              const u = (p.username || '').toLowerCase();
              const pPhoneDigits = (p.phone || '').replace(/[^0-9]/g, '');
              const isUserMatch =
                u === cleanUser ||
                u === userPrefix ||
                (inputDigits.length > 5 && pPhoneDigits === inputDigits);
              if (!isUserMatch) return false;

              const expectedPass = p.password || '123';
              return expectedPass === cleanPass || (cleanPass === '123456' && (!p.password || p.password === '123456'));
            });

            if (matchedProfile) {
              const userRole = matchedProfile.role as UserRole;
              if (allowedRoles && !allowedRoles.includes(userRole)) {
                return { success: false, message: 'شما دسترسی ورود به این بخش را ندارید.' };
              }
              setRole(userRole);
              if (userRole === 'visitor') {
                setSelectedVisitorId(matchedProfile.id);
              } else if (userRole === 'supermarket') {
                setSelectedSupermarketId(matchedProfile.id);
              }
              setIsLoggedIn(true);
              localStorage.setItem(STORAGE_KEYS.AUTH_LOGGED_IN, 'true');
              return { success: true };
            }
          }

          // Also check local login fallback
          const fallbackRes = localLoginFallback(cleanUser, cleanPass, allowedRoles);
          if (fallbackRes.success) {
            return fallbackRes;
          }

          return {
            success: false,
            message: authError?.message?.includes('Invalid login credentials')
              ? 'نام کاربری یا رمز عبور وارد شده در سیستم ثبت نشده یا نادرست است.'
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
      const assignedVisitorId = data.assigned_visitor_id || visitors[0]?.id || '';
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

        const { error: profileError } = await supabase.from('profiles').upsert({
          id: authUserId,
          name: trimmedName,
          role: 'supermarket',
          phone: trimmedPhone,
          username: trimmedUsername,
        });

        if (profileError) {
          console.warn('Profile insert/upsert warning:', profileError.message);
        }

        // Validate assigned visitor ID against existing visitors in memory/Supabase
        let validVisitorId: string | null = null;
        if (assignedVisitorId && assignedVisitorId !== 'direct') {
          const match = visitors.find((v) => v.id === assignedVisitorId);
          if (match) {
            validVisitorId = match.id;
          }
        }
        if (!validVisitorId && visitors.length > 0) {
          validVisitorId = visitors[0].id;
        }

        const { error: smError } = await supabase.from('supermarkets').insert({
          id: authUserId,
          name: trimmedName,
          owner: trimmedOwner,
          phone: trimmedPhone,
          address: trimmedAddress,
          assigned_visitor_id: validVisitorId,
          is_active: true,
        });

        if (smError) {
          console.warn('Supermarket insert warning, attempting upsert:', smError.message);
          const { error: smUpsertError } = await supabase.from('supermarkets').upsert({
            id: authUserId,
            name: trimmedName,
            owner: trimmedOwner,
            phone: trimmedPhone,
            address: trimmedAddress,
            assigned_visitor_id: validVisitorId,
            is_active: true,
          });

          if (smUpsertError) {
            return {
              success: false,
              message: `خطا در ثبت اطلاعات فروشگاه در پایگاه داده: ${smUpsertError.message}`,
            };
          }
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
