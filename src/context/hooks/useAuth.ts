import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { UserRole, CurrentUser, Visitor, Supermarket, Profile } from '../../types';
import { INITIAL_PROFILES } from '../../data/initialData';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { STORAGE_KEYS, generateUniqueId, toSyntheticEmail, normalizeDigits } from '../utils';

interface UseAuthProps {
  visitors: Visitor[];
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

export function useAuth({ visitors, supermarkets, setSupermarkets }: UseAuthProps) {
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
      const v = visitors.find((vis) => vis.id === selectedVisitorId) || visitors[0];
      return {
        id: v?.id || authenticatedProfile?.id || '',
        name: v?.name || authenticatedProfile?.name || 'ویزیتور',
        username: v?.username || authenticatedProfile?.username || 'visitor',
        role: 'visitor',
        roleTitle: `ویزیتور (${v?.region || 'منطقه توزیع'})`,
        phone: v?.phone || authenticatedProfile?.phone || '',
      };
    }
    if (role === 'supermarket') {
      const s = supermarkets.find((sm) => sm.id === selectedSupermarketId) || supermarkets[0];
      return {
        id: s?.id || authenticatedProfile?.id || '',
        name: s?.name || authenticatedProfile?.name || 'فروشگاه طرف قرارداد',
        username: s?.username || authenticatedProfile?.username || 'supermarket',
        role: 'supermarket',
        roleTitle: `فروشگاه (${s?.owner || 'مدیریت'})`,
        phone: s?.phone || authenticatedProfile?.phone || '',
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

  // Local fallback login evaluator with strict role & password enforcement
  const localLoginFallback = useCallback(
    (
      rawUser: string,
      rawPass: string,
      allowedRoles?: UserRole[]
    ): { success: boolean; message?: string } => {
      const cleanUser = normalizeDigits(rawUser.trim()).toLowerCase();
      const inputDigits = cleanUser.replace(/[^0-9]/g, '');
      const userPrefix = cleanUser.includes('@') ? cleanUser.split('@')[0] : cleanUser;

      // 1. Search in profiles (if any exist locally)
      const matchedProfile = INITIAL_PROFILES.find((p) => {
        const u = normalizeDigits(p.username).toLowerCase();
        const phoneDigits = normalizeDigits(p.phone).replace(/[^0-9]/g, '');
        return (
          u === cleanUser ||
          u === userPrefix ||
          (inputDigits.length >= 7 && phoneDigits.includes(inputDigits)) ||
          (inputDigits.length >= 7 && inputDigits.includes(phoneDigits) && phoneDigits.length >= 7)
        );
      });

      if (matchedProfile) {
        if (!verifyPassword(rawPass, matchedProfile.password)) {
          return { success: false, message: 'رمز عبور وارد شده نادرست است.' };
        }
        if (allowedRoles && !allowedRoles.includes(matchedProfile.role)) {
          return {
            success: false,
            message: `این حساب دارای نقش «${ROLE_LABELS[matchedProfile.role]}» می‌باشد. لطفاً از زبانه اختصاصی خود وارد شوید.`,
          };
        }
        setRole(matchedProfile.role);
        setAuthProfile({
          id: matchedProfile.id,
          name: matchedProfile.name,
          username: matchedProfile.username,
          phone: matchedProfile.phone,
        });
        if (matchedProfile.role === 'visitor') {
          setSelectedVisitorId(matchedProfile.id);
        } else if (matchedProfile.role === 'supermarket') {
          setSelectedSupermarketId(matchedProfile.id);
        }
        setIsLoggedIn(true);
        return { success: true };
      }

      // 2. Search in registered visitors
      const matchedVis = visitors.find((v) => {
        const u = normalizeDigits(v.username || v.id).toLowerCase();
        const phoneDigits = normalizeDigits(v.phone || '').replace(/[^0-9]/g, '');
        return (
          u === cleanUser ||
          u === userPrefix ||
          (inputDigits.length >= 7 && phoneDigits.includes(inputDigits)) ||
          (inputDigits.length >= 7 && inputDigits.includes(phoneDigits) && phoneDigits.length >= 7)
        );
      });

      if (matchedVis) {
        if (!verifyPassword(rawPass, matchedVis.password)) {
          return { success: false, message: 'رمز عبور وارد شده نادرست است.' };
        }
        if (allowedRoles && !allowedRoles.includes('visitor')) {
          return {
            success: false,
            message: `این حساب دارای نقش «${ROLE_LABELS['visitor']}» می‌باشد. لطفاً از زبانه اختصاصی ویزیتورها وارد شوید.`,
          };
        }
        setRole('visitor');
        setAuthProfile({
          id: matchedVis.id,
          name: matchedVis.name,
          username: matchedVis.username || matchedVis.id,
          phone: matchedVis.phone,
        });
        setSelectedVisitorId(matchedVis.id);
        setIsLoggedIn(true);
        return { success: true };
      }

      // 3. Search in registered supermarkets
      const matchedSm = supermarkets.find((s) => {
        const u = normalizeDigits(s.username || s.id).toLowerCase();
        const phoneDigits = normalizeDigits(s.phone || '').replace(/[^0-9]/g, '');
        return (
          u === cleanUser ||
          u === userPrefix ||
          (inputDigits.length >= 7 && phoneDigits.includes(inputDigits)) ||
          (inputDigits.length >= 7 && inputDigits.includes(phoneDigits) && phoneDigits.length >= 7)
        );
      });

      if (matchedSm) {
        if (!verifyPassword(rawPass, matchedSm.password)) {
          return { success: false, message: 'رمز عبور وارد شده نادرست است.' };
        }
        if (allowedRoles && !allowedRoles.includes('supermarket')) {
          return {
            success: false,
            message: `این حساب دارای نقش «${ROLE_LABELS['supermarket']}» می‌باشد. لطفاً از زبانه اختصاصی فروشگاه‌ها وارد شوید.`,
          };
        }
        if (matchedSm.is_active === false) {
          return {
            success: false,
            message: 'حساب کاربری فروشگاه شما غیرفعال است. جهت فعال‌سازی با مدیریت تماس بگیرید.',
          };
        }
        setRole('supermarket');
        setAuthProfile({
          id: matchedSm.id,
          name: matchedSm.name,
          username: matchedSm.username || matchedSm.id,
          phone: matchedSm.phone,
        });
        setSelectedSupermarketId(matchedSm.id);
        setIsLoggedIn(true);
        return { success: true };
      }

      return {
        success: false,
        message: 'نام کاربری یا شماره همراه وارد شده یافت نشد.',
      };
    },
    [supermarkets, visitors, setRole, setSelectedVisitorId, setSelectedSupermarketId, setIsLoggedIn, setAuthProfile]
  );

  // Main login with credentials evaluator
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

      if (isSupabaseConfigured && supabase) {
        try {
          // Step 1: Direct Database Profiles lookup
          const { data: dbProfiles, error: profErr } = await supabase
            .from('profiles')
            .select('*');

          if (!profErr && dbProfiles && dbProfiles.length > 0) {
            const matchedProfile = dbProfiles.find((p: any) => {
              const u = normalizeDigits(p.username || '').toLowerCase();
              const pPhoneDigits = normalizeDigits(p.phone || '').replace(/[^0-9]/g, '');
              const pName = (p.name || '').toLowerCase();

              return (
                u === normalizedUser ||
                u === userPrefix ||
                (rawDigits.length >= 7 && pPhoneDigits.includes(rawDigits)) ||
                (rawDigits.length >= 7 && rawDigits.includes(pPhoneDigits) && pPhoneDigits.length >= 7) ||
                pName === normalizedUser
              );
            });

            if (matchedProfile) {
              const userRole = matchedProfile.role as UserRole;

              if (!verifyPassword(cleanPass, matchedProfile.password)) {
                return { success: false, message: 'رمز عبور وارد شده نادرست است.' };
              }

              if (allowedRoles && !allowedRoles.includes(userRole)) {
                return {
                  success: false,
                  message: `این حساب دارای نقش «${ROLE_LABELS[userRole] || userRole}» می‌باشد. لطفاً از زبانه اختصاصی خود وارد شوید.`,
                };
              }

              if (userRole === 'supermarket' && matchedProfile.is_active === false) {
                return {
                  success: false,
                  message: 'حساب کاربری فروشگاه شما غیرفعال است. جهت فعال‌سازی با مدیریت تماس بگیرید.',
                };
              }

              setRole(userRole);
              setAuthProfile({
                id: matchedProfile.id,
                name: matchedProfile.name,
                username: matchedProfile.username,
                phone: matchedProfile.phone,
              });
              if (userRole === 'visitor') {
                setSelectedVisitorId(matchedProfile.id);
              } else if (userRole === 'supermarket') {
                setSelectedSupermarketId(matchedProfile.id);
              }
              setIsLoggedIn(true);
              return { success: true };
            }
          }

          // Step 2: Check supermarkets table directly
          const { data: dbSupermarkets } = await supabase
            .from('supermarkets')
            .select('*');

          if (dbSupermarkets && dbSupermarkets.length > 0) {
            const matchedSm = dbSupermarkets.find((s: any) => {
              const u = normalizeDigits(s.username || '').toLowerCase();
              const sPhoneDigits = normalizeDigits(s.phone || '').replace(/[^0-9]/g, '');
              const sName = (s.name || '').toLowerCase();

              return (
                u === normalizedUser ||
                u === userPrefix ||
                (rawDigits.length >= 7 && sPhoneDigits.includes(rawDigits)) ||
                (rawDigits.length >= 7 && rawDigits.includes(sPhoneDigits) && sPhoneDigits.length >= 7) ||
                sName === normalizedUser
              );
            });

            if (matchedSm) {
              if (!verifyPassword(cleanPass, matchedSm.password)) {
                return { success: false, message: 'رمز عبور وارد شده نادرست است.' };
              }

              if (allowedRoles && !allowedRoles.includes('supermarket')) {
                return {
                  success: false,
                  message: `این حساب دارای نقش «${ROLE_LABELS['supermarket']}» می‌باشد. لطفاً از زبانه اختصاصی فروشگاه‌ها وارد شوید.`,
                };
              }

              if (matchedSm.is_active === false) {
                return {
                  success: false,
                  message: 'حساب کاربری فروشگاه شما غیرفعال است. جهت فعال‌سازی با مدیریت تماس بگیرید.',
                };
              }

              setRole('supermarket');
              setAuthProfile({
                id: matchedSm.id,
                name: matchedSm.name,
                username: matchedSm.username || matchedSm.id,
                phone: matchedSm.phone,
              });
              setSelectedSupermarketId(matchedSm.id);
              setIsLoggedIn(true);
              return { success: true };
            }
          }

          // Step 3: Try Supabase Auth signInWithPassword
          const authEmail = normalizedUser.includes('@')
            ? normalizedUser
            : toSyntheticEmail(normalizedUser);

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
                return {
                  success: false,
                  message: `این حساب دارای نقش «${ROLE_LABELS[userRole] || userRole}» می‌باشد. لطفاً از زبانه اختصاصی خود وارد شوید.`,
                };
              }
              setRole(userRole);
              setAuthProfile({
                id: profile.id,
                name: profile.name,
                username: profile.username,
                phone: profile.phone,
              });
              if (userRole === 'visitor') {
                setSelectedVisitorId(profile.id);
              } else if (userRole === 'supermarket') {
                setSelectedSupermarketId(profile.id);
              }
            }

            setIsLoggedIn(true);
            return { success: true };
          }
        } catch (err: unknown) {
          console.warn('Supabase DB/Auth lookup error, checking local fallback:', err);
        }
      }

      // Fallback to local memory & registered accounts
      return localLoginFallback(normalizedUser, cleanPass, allowedRoles);
    },
    [setRole, setSelectedVisitorId, setSelectedSupermarketId, setIsLoggedIn, setAuthProfile, localLoginFallback]
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
      const assignedVisitorId = data.assigned_visitor_id || visitors[0]?.id || '';
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
        if (!validVisitorId && visitors.length > 0) {
          validVisitorId = visitors[0].id;
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
