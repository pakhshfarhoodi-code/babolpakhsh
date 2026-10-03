import { useState, useEffect, useCallback, useRef } from 'react';
import { Product, Category, ProductPriceHistory, ProductLike } from '../../types';
import { INITIAL_CATEGORIES, INITIAL_BRANDS, INITIAL_PRODUCTS } from '../../data/initialData';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  STORAGE_KEYS,
  generateUniqueId,
  addDeletedId,
  getMarketTestIds,
  setMarketTestId,
  setBulkMarketTestIds,
} from '../utils';
import { sanitizeImageUrl } from '../../utils/imageUtils';

export const LEGACY_MOCK_NAMES = new Set([
  'بستنی مگنوم شکلاتی میهن',
  'بستنی عروسکی دومینو',
  'بستنی سالار شاهتوت کاله',
  'بستنی لیتری وانیلی پاک',
  'سوسیس کوکتل ۸۰٪ دمس (۱ کیلوگرم)',
  'سوسیس کوکتل ۸۰٪ دمس',
  'کالباس ژامبون مرغ ۹۰٪ سولیکو',
  'همبرگر ۹۰٪ ممتاز کاله (بسته ۴ عددی)',
  'همبرگر ۹۰٪ ممتاز کاله',
  'ناگت مرغ ۷۰٪ ب آ (۹۰۰ گرمی)',
  'ناگت مرغ ۷۰٪ ب آ',
  'فیله مرغ سوخاری پامچال',
]);

export function useCatalog() {
  const PRESET_CAT_IDS = new Set(['cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5']);

  const [categories, setCategories] = useState<Category[]>(() => {
    if (isSupabaseConfigured) return [];
    const saved = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter((c: Category) => !PRESET_CAT_IDS.has(c.id)) : [];
    } catch {
      return [];
    }
  });

  const [brands, setBrands] = useState<string[]>(() => {
    if (isSupabaseConfigured) return [];
    const saved = localStorage.getItem(STORAGE_KEYS.BRANDS);
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [products, setProducts] = useState<Product[]>(() => {
    if (isSupabaseConfigured) return [];
    const saved = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    const marketTestIds = getMarketTestIds();
    if (!saved) return [];
    try {
      const parsed: Product[] = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((p) => !LEGACY_MOCK_NAMES.has(p.name?.trim()))
        .map((p) => ({
          ...p,
          is_market_test:
            p.is_market_test !== undefined
              ? Boolean(p.is_market_test)
              : marketTestIds.has(p.id),
        }));
    } catch {
      return [];
    }
  });

  const [productLikes, setProductLikes] = useState<ProductLike[]>(() => {
    if (isSupabaseConfigured) return [];
    const saved = localStorage.getItem(STORAGE_KEYS.PRODUCT_LIKES);
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const productLikesRef = useRef<ProductLike[]>(productLikes);
  useEffect(() => {
    productLikesRef.current = productLikes;
  }, [productLikes]);

  const inFlightLikesRef = useRef<Set<string>>(new Set());

  const [units, setUnits] = useState<string[]>(() => {
    if (isSupabaseConfigured) return [];
    const saved = localStorage.getItem(STORAGE_KEYS.UNITS);
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [priceHistories, setPriceHistories] = useState<ProductPriceHistory[]>(() => {
    if (isSupabaseConfigured) return [];
    const saved = localStorage.getItem(STORAGE_KEYS.PRICE_HISTORIES);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    if (isSupabaseConfigured) return;
    try {
      localStorage.setItem(STORAGE_KEYS.PRODUCT_LIKES, JSON.stringify(productLikes));
    } catch {}
  }, [productLikes]);

  // Local storage persistence (Only in mock / offline mode)
  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem(STORAGE_KEYS.BRANDS, JSON.stringify(brands));
  }, [brands]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem(STORAGE_KEYS.UNITS, JSON.stringify(units));
  }, [units]);

  // Keep units synced with any unique unit found in products
  useEffect(() => {
    if (products.length > 0) {
      setUnits((prev) => {
        const set = new Set(prev);
        let changed = false;
        products.forEach((p) => {
          if (p.unit && p.unit.trim() && !set.has(p.unit.trim())) {
            set.add(p.unit.trim());
            changed = true;
          }
        });
        return changed ? Array.from(set) : prev;
      });
    }
  }, [products]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    localStorage.setItem(STORAGE_KEYS.PRICE_HISTORIES, JSON.stringify(priceHistories));
  }, [priceHistories]);

  // Update product price (supports store price, visitor purchase price, and optional consumer price)
  const updateProductPrice = useCallback((productId: string, newPrice: number, newVisitorPrice?: number, newConsumerPrice?: number) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;
    
    const targetVisitorPrice = newVisitorPrice !== undefined ? newVisitorPrice : (prod.visitor_price ?? Math.round(newPrice * 0.85));
    const targetConsumerPrice = newConsumerPrice !== undefined ? newConsumerPrice : prod.consumer_price;
    if (prod.price === newPrice && prod.visitor_price === targetVisitorPrice && prod.consumer_price === targetConsumerPrice) return;

    const nowPersian = new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());

    const historyRecord: ProductPriceHistory = {
      id: `price-hist-${Date.now()}`,
      product_id: productId,
      old_price: prod.price,
      new_price: newPrice,
      old_visitor_price: prod.visitor_price,
      new_visitor_price: targetVisitorPrice,
      changed_by: 'مدیریت مرکزی',
      changed_at: nowPersian,
    };

    setPriceHistories((prev) => [historyRecord, ...prev]);
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, price: newPrice, visitor_price: targetVisitorPrice, consumer_price: targetConsumerPrice } : p))
    );

    if (isSupabaseConfigured && supabase) {
      supabase
        .from('products')
        .update({
          price: newPrice,
          visitor_price: targetVisitorPrice,
          consumer_price: targetConsumerPrice !== undefined ? targetConsumerPrice : null,
        })
        .eq('id', productId)
        .then(({ error }) => {
          if (error) {
            supabase
              .from('products')
              .update({ price: newPrice, visitor_price: targetVisitorPrice })
              .eq('id', productId);
          }
        });

      supabase
        .from('product_price_history')
        .insert({
          product_id: productId,
          old_price: prod.price,
          new_price: newPrice,
          changed_by: 'مدیریت مرکزی',
        })
        .then(({ error }) => {
          if (error) console.error('خطا در ثبت تاریخچه قیمت روی Supabase:', error);
        });
    }
  }, [products]);

  // Add new product
  const addNewProduct = useCallback((newProd: Omit<Product, 'id' | 'reserved_stock'>) => {
    const id = `prod-${Date.now().toString().slice(-4)}`;
    const visitor_price = newProd.visitor_price !== undefined ? newProd.visitor_price : Math.round(newProd.price * 0.85);
    const validCatId = newProd.category_id && newProd.category_id.trim() ? newProd.category_id.trim() : null;

    const safeImage = sanitizeImageUrl(newProd.image_url, validCatId || undefined, newProd.name);

    const productToAdd: Product = {
      ...newProd,
      id,
      category_id: validCatId || '',
      image_url: safeImage,
      visitor_price,
      items_per_package: newProd.items_per_package !== undefined && Number(newProd.items_per_package) > 0 ? Number(newProd.items_per_package) : undefined,
      reserved_stock: 0,
      is_market_test: Boolean(newProd.is_market_test),
    };

    if (newProd.is_market_test) {
      setMarketTestId(id, true);
    }

    setProducts((prev) => {
      const next = [...prev, productToAdd];
      if (!isSupabaseConfigured) {
        try {
          localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(next));
        } catch {
          // storage quota fallback
        }
      }
      return next;
    });

    if (newProd.brand && newProd.brand.trim()) {
      const bTrimmed = newProd.brand.trim();
      setBrands((prev) => (prev.includes(bTrimmed) ? prev : [...prev, bTrimmed]));
    }

    if (isSupabaseConfigured && supabase) {
      (async () => {
        // Ensure category exists in categories table if provided
        if (validCatId) {
          const matchedCategory = categories.find((c) => c.id === validCatId);
          if (matchedCategory) {
            await supabase.from('categories').upsert({
              id: matchedCategory.id,
              name: matchedCategory.name,
              icon: matchedCategory.icon || 'Layers',
            }, { onConflict: 'id' });
          }
        }

        const row = {
          id,
          name: newProd.name.trim(),
          category_id: validCatId,
          brand: newProd.brand?.trim() || 'متفرقه',
          price: newProd.price,
          visitor_price,
          consumer_price: newProd.consumer_price !== undefined ? newProd.consumer_price : null,
          stock: newProd.stock,
          reserved_stock: 0,
          unit: newProd.unit || 'عدد',
          items_per_package: newProd.items_per_package !== undefined && Number(newProd.items_per_package) > 0 ? Number(newProd.items_per_package) : null,
          image_url: newProd.image_url,
          is_active: newProd.is_active ?? true,
          is_market_test: Boolean(newProd.is_market_test),
        };

        // Try 1: Full insert
        const { error: err1 } = await supabase.from('products').insert(row);
        if (!err1) return;

        console.warn('Supabase product insert failed, retrying without is_market_test / FK:', err1.message);
        
        // Try 2: Without is_market_test (if column doesn't exist on remote DB)
        const { is_market_test, ...rowNoMarket } = row;
        const { error: err2 } = await supabase.from('products').insert(rowNoMarket);
        if (!err2) return;

        // Try 3: With category_id = null (avoids foreign key constraint violation)
        const rowNoFK = { ...rowNoMarket, category_id: null };
        const { error: err3 } = await supabase.from('products').insert(rowNoFK);
        if (!err3) return;

        console.warn('Supabase fallback insert failed, retrying without consumer_price:', err3.message);
        const { consumer_price, ...row4 } = rowNoFK;
        const { error: err4 } = await supabase.from('products').insert(row4);
        if (!err4) return;

        console.warn('Supabase fallback insert failed, retrying without visitor_price:', err4.message);
        const { visitor_price: vp, ...row5 } = row4;
        const { error: err5 } = await supabase.from('products').insert(row5);
        if (!err5) return;

        const { brand: b, ...row6 } = row5;
        await supabase.from('products').insert(row6);
      })();
    }
  }, [categories]);

  // Update a single product (Name, Brand, Category, Image, Prices, Stock, Unit, is_active, is_market_test)
  const updateProduct = useCallback((
    productId: string,
    updates: Partial<Omit<Product, 'id' | 'reserved_stock'>>
  ): { success: boolean; message: string } => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) {
      return { success: false, message: 'کالای مورد نظر یافت نشد.' };
    }

    const targetPrice = updates.price !== undefined ? updates.price : prod.price;
    const targetVisitorPrice = updates.visitor_price !== undefined
      ? updates.visitor_price
      : (prod.visitor_price ?? Math.round(targetPrice * 0.85));
    const targetConsumerPrice = updates.consumer_price !== undefined ? updates.consumer_price : prod.consumer_price;
    const targetIsMarketTest = updates.is_market_test !== undefined
      ? Boolean(updates.is_market_test)
      : (prod.is_market_test ?? false);

    const targetName = updates.name !== undefined ? updates.name.trim() : prod.name;
    const targetCatId = updates.category_id !== undefined ? updates.category_id : prod.category_id;
    const targetImage = updates.image_url !== undefined
      ? sanitizeImageUrl(updates.image_url, targetCatId, targetName)
      : sanitizeImageUrl(prod.image_url, targetCatId, targetName);

    const updatedProd: Product = {
      ...prod,
      ...updates,
      name: targetName,
      brand: updates.brand !== undefined ? updates.brand.trim() || 'متفرقه' : prod.brand,
      category_id: targetCatId,
      image_url: targetImage,
      unit: updates.unit !== undefined ? updates.unit : prod.unit,
      items_per_package: updates.items_per_package !== undefined
        ? (Number(updates.items_per_package) > 0 ? Number(updates.items_per_package) : undefined)
        : prod.items_per_package,
      stock: updates.stock !== undefined ? updates.stock : prod.stock,
      price: targetPrice,
      visitor_price: targetVisitorPrice,
      consumer_price: targetConsumerPrice,
      is_active: updates.is_active !== undefined ? updates.is_active : (prod.is_active ?? true),
      is_market_test: targetIsMarketTest,
    };

    if (updates.is_market_test !== undefined) {
      setMarketTestId(productId, targetIsMarketTest);
    }

    if (updates.brand && updates.brand.trim()) {
      const bTrimmed = updates.brand.trim();
      setBrands((prev) => (prev.includes(bTrimmed) ? prev : [...prev, bTrimmed]));
    }

    // Price history record if prices changed
    if (
      (updates.price !== undefined && updates.price !== prod.price) ||
      (updates.visitor_price !== undefined && updates.visitor_price !== prod.visitor_price)
    ) {
      const nowPersian = new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date());

      const historyRecord: ProductPriceHistory = {
        id: `price-hist-${Date.now()}`,
        product_id: productId,
        old_price: prod.price,
        new_price: targetPrice,
        old_visitor_price: prod.visitor_price,
        new_visitor_price: targetVisitorPrice,
        changed_by: 'مدیریت مرکزی',
        changed_at: nowPersian,
      };

      setPriceHistories((prev) => [historyRecord, ...prev]);
    }

    setProducts((prev) => {
      const next = prev.map((p) => (p.id === productId ? updatedProd : p));
      if (!isSupabaseConfigured) {
        try {
          localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(next));
        } catch {}
      }
      return next;
    });

    if (isSupabaseConfigured && supabase) {
      (async () => {
        const payload: Record<string, unknown> = {};
        if (updates.name !== undefined) payload.name = updates.name.trim();
        if (updates.brand !== undefined) payload.brand = updates.brand.trim();
        if (updates.category_id !== undefined) payload.category_id = updates.category_id || null;
        if (updates.price !== undefined) payload.price = targetPrice;
        if (updates.visitor_price !== undefined) payload.visitor_price = targetVisitorPrice;
        if (updates.consumer_price !== undefined) payload.consumer_price = targetConsumerPrice ?? null;
        if (updates.stock !== undefined) payload.stock = updates.stock;
        if (updates.unit !== undefined) payload.unit = updates.unit;
        if (updates.items_per_package !== undefined) {
          payload.items_per_package = Number(updates.items_per_package) > 0 ? Number(updates.items_per_package) : null;
        }
        if (updates.image_url !== undefined) payload.image_url = updates.image_url;
        if (updates.is_active !== undefined) payload.is_active = updates.is_active;
        if (updates.is_market_test !== undefined) payload.is_market_test = updates.is_market_test;

        if (Object.keys(payload).length === 0) return;

        // Try 1: Full payload update
        const { error: err1 } = await supabase.from('products').update(payload).eq('id', productId);
        if (!err1) return;

        console.warn('Supabase product update failed, retrying without optional columns:', err1.message);

        // Try 2: Without is_market_test & consumer_price
        const { is_market_test, consumer_price, ...payload2 } = payload;
        const { error: err2 } = await supabase.from('products').update(payload2).eq('id', productId);
        if (!err2) return;

        // Try 3: Without category_id (prevents FK constraint failure)
        const { category_id, ...payload3 } = payload2;
        const { error: err3 } = await supabase.from('products').update(payload3).eq('id', productId);
        if (!err3) return;

        // Try 4: Core fields only (name, price, stock, is_active, unit)
        const corePayload: Record<string, unknown> = {};
        if (payload.name !== undefined) corePayload.name = payload.name;
        if (payload.price !== undefined) corePayload.price = payload.price;
        if (payload.stock !== undefined) corePayload.stock = payload.stock;
        if (payload.is_active !== undefined) corePayload.is_active = payload.is_active;
        if (payload.unit !== undefined) corePayload.unit = payload.unit;

        if (Object.keys(corePayload).length > 0) {
          const { error: err4 } = await supabase.from('products').update(corePayload).eq('id', productId);
          if (err4) {
            console.error('Core product update failed on Supabase:', err4.message);
          }
        }
      })();
    }

    return { success: true, message: 'اطلاعات کالا با موفقیت ویرایش شد.' };
  }, [products]);

  // Toggle Like / Market Interest for a Product by a Supermarket
  const toggleProductLike = useCallback(
    async (
      productId: string,
      supermarket: { id: string; name: string; owner?: string; phone?: string }
    ): Promise<{ success: boolean; liked: boolean; message: string }> => {
      if (!productId || !supermarket || !supermarket.id) {
        return { success: false, liked: false, message: 'اطلاعات فروشگاه یا کالا ناقص است.' };
      }

      if (inFlightLikesRef.current.has(productId)) {
        return { success: false, liked: false, message: 'درخواست قبلی برای این کالا در حال پردازش است.' };
      }

      inFlightLikesRef.current.add(productId);

      // 1) Read current like state from ref before any mutation
      const currentLikes = productLikesRef.current;
      const existingLike = currentLikes.find(
        (pl) => pl.product_id === productId && pl.supermarket_id === supermarket.id
      );
      const wasLiked = Boolean(existingLike);
      const shouldLike = !wasLiked;
      const targetProd = products.find((p) => p.id === productId);

      // 2) Optimistic UI update
      let optimisticLikes: ProductLike[];
      if (shouldLike) {
        const newLike: ProductLike = {
          id: `like-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          product_id: productId,
          supermarket_id: supermarket.id,
          supermarket_name: supermarket.name || 'فروشگاه',
          supermarket_owner: supermarket.owner || '',
          supermarket_phone: supermarket.phone || '',
          created_at: new Date().toISOString(),
        };
        optimisticLikes = [newLike, ...currentLikes];
      } else {
        optimisticLikes = currentLikes.filter(
          (pl) => !(pl.product_id === productId && pl.supermarket_id === supermarket.id)
        );
      }

      setProductLikes(optimisticLikes);
      productLikesRef.current = optimisticLikes;
      if (!isSupabaseConfigured) {
        try {
          localStorage.setItem(STORAGE_KEYS.PRODUCT_LIKES, JSON.stringify(optimisticLikes));
        } catch {}
      }

      // 3) Supabase sync with error checking and rollback
      if (isSupabaseConfigured && supabase) {
        try {
          if (!shouldLike) {
            const { error: deleteError } = await supabase
              .from('product_likes')
              .delete()
              .eq('product_id', productId)
              .eq('supermarket_id', supermarket.id);

            if (deleteError) {
              // Rollback UI
              setProductLikes(currentLikes);
              productLikesRef.current = currentLikes;
              inFlightLikesRef.current.delete(productId);
              return {
                success: false,
                liked: wasLiked,
                message: deleteError.message || 'خطا در لغو علاقه‌مندی به کالا در پایگاه داده.',
              };
            }
          } else {
            const { error: upsertError } = await supabase.from('product_likes').upsert(
              {
                product_id: productId,
                supermarket_id: supermarket.id,
                supermarket_name: supermarket.name || 'فروشگاه',
                supermarket_owner: supermarket.owner || '',
                supermarket_phone: supermarket.phone || '',
                created_at: new Date().toISOString(),
              },
              { onConflict: 'product_id,supermarket_id' }
            );

            if (upsertError) {
              // Rollback UI
              setProductLikes(currentLikes);
              productLikesRef.current = currentLikes;
              inFlightLikesRef.current.delete(productId);
              return {
                success: false,
                liked: wasLiked,
                message: upsertError.message || 'خطا در ثبت علاقه‌مندی به کالا در پایگاه داده.',
              };
            }
          }

          // Silent refetch of likes
          const { data: refetchedLikes, error: refetchErr } = await supabase
            .from('product_likes')
            .select('*');
          if (!refetchErr && refetchedLikes) {
            setProductLikes(refetchedLikes);
            productLikesRef.current = refetchedLikes;
          }
        } catch (err) {
          // Rollback UI
          setProductLikes(currentLikes);
          productLikesRef.current = currentLikes;
          inFlightLikesRef.current.delete(productId);
          const msg = err instanceof Error ? err.message : 'خطای غیرمنتظره در ارتباط با پایگاه داده.';
          return { success: false, liked: wasLiked, message: msg };
        }
      }

      inFlightLikesRef.current.delete(productId);

      return {
        success: true,
        liked: shouldLike,
        message: shouldLike
          ? `علاقه‌مندی شما به «${targetProd?.name || 'کالا'}» با موفقیت ثبت شد.`
          : `علاقه‌مندی به «${targetProd?.name || 'کالا'}» لغو گردید.`,
      };
    },
    [products]
  );

  // Bulk Upsert Products from Excel import
  const bulkUpsertProducts = useCallback(async (items: Array<{
    id?: string;
    name: string;
    category_id?: string;
    category_name?: string;
    brand?: string;
    price: number;
    visitor_price?: number;
    consumer_price?: number;
    stock?: number;
    unit?: string;
    items_per_package?: number;
    is_active?: boolean;
  }>): Promise<{ success: boolean; createdCount: number; updatedCount: number; message: string }> => {
    if (!items || items.length === 0) {
      return { success: false, createdCount: 0, updatedCount: 0, message: 'هیچ داده‌ای برای ثبت یافت نشد.' };
    }

    const nowPersian = new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());

    const newBrandsSet = new Set<string>();
    const affectedCategoryIds = new Set<string>();
    const newHistories: ProductPriceHistory[] = [];
    const itemsToUpsertToSupabase: Product[] = [];

    let createdCount = 0;
    let updatedCount = 0;

    const currentProducts = products || [];
    const updatedProducts = [...currentProducts];

    items.forEach((item, index) => {
      const trimmedName = (item.name || '').trim();
      if (!trimmedName) return;

      const brandName = (item.brand || '').trim() || 'متفرقه';
      if (brandName) newBrandsSet.add(brandName);

      const catId = (item.category_id || categories[0]?.id || '').trim();
      if (catId) affectedCategoryIds.add(catId);

      // Find match by id or by name (case-insensitive)
      const matchIndex = updatedProducts.findIndex((p) => {
        if (item.id && item.id.trim() && p.id.toLowerCase() === item.id.trim().toLowerCase()) {
          return true;
        }
        return p.name.trim().toLowerCase() === trimmedName.toLowerCase();
      });

      const storePrice = Number(item.price) || 0;
      const visitorPrice = item.visitor_price !== undefined && item.visitor_price !== null && Number(item.visitor_price) > 0
        ? Number(item.visitor_price)
        : Math.round(storePrice * 0.85);
      const stockQty = item.stock !== undefined ? Math.max(0, Number(item.stock) || 0) : 50;
      const unitStr = (item.unit || '').trim() || 'عدد';

        const parsedPackQty = item.items_per_package !== undefined && Number(item.items_per_package) > 0
          ? Number(item.items_per_package)
          : undefined;

        if (matchIndex >= 0) {
        // Update existing product
        const current = updatedProducts[matchIndex];
        const hasPriceChanged = current.price !== storePrice || current.visitor_price !== visitorPrice;

        if (hasPriceChanged) {
          newHistories.push({
            id: `price-hist-${Date.now()}-${index}`,
            product_id: current.id,
            old_price: current.price,
            new_price: storePrice,
            old_visitor_price: current.visitor_price,
            new_visitor_price: visitorPrice,
            changed_by: 'ویرایش اکسل',
            changed_at: nowPersian,
          });
        }

        const updatedProd: Product = {
          ...current,
          name: trimmedName || current.name,
          brand: brandName || current.brand,
          category_id: catId,
          price: storePrice > 0 ? storePrice : current.price,
          visitor_price: visitorPrice > 0 ? visitorPrice : current.visitor_price,
          consumer_price: item.consumer_price !== undefined ? Number(item.consumer_price) || undefined : current.consumer_price,
          stock: stockQty !== undefined ? stockQty : current.stock,
          unit: unitStr || current.unit,
          items_per_package: parsedPackQty !== undefined ? parsedPackQty : current.items_per_package,
          is_active: item.is_active !== undefined ? item.is_active : current.is_active,
        };
        updatedProducts[matchIndex] = updatedProd;
        itemsToUpsertToSupabase.push(updatedProd);
        updatedCount++;
      } else {
        // Create new product
        const newId = item.id && item.id.trim() ? item.id.trim() : generateUniqueId('prod');
        
        const newProd: Product = {
          id: newId,
          name: trimmedName,
          brand: brandName,
          category_id: catId,
          price: storePrice,
          visitor_price: visitorPrice,
          consumer_price: item.consumer_price !== undefined ? Number(item.consumer_price) || undefined : undefined,
          stock: stockQty,
          reserved_stock: 0,
          unit: unitStr,
          items_per_package: parsedPackQty,
          image_url: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400&auto=format&fit=crop&q=60&referrerPolicy=no-referrer',
          is_active: item.is_active !== undefined ? item.is_active : true,
          created_at: new Date().toISOString(),
        };
        updatedProducts.push(newProd);
        itemsToUpsertToSupabase.push(newProd);
        createdCount++;
      }
    });

    setProducts(updatedProducts);

    // Save immediately to local storage so even if refreshed instantly, products are never lost!
    if (!isSupabaseConfigured) {
      try {
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(updatedProducts));
      } catch {}

      if (newHistories.length > 0) {
        setPriceHistories((prev) => {
          const next = [...newHistories, ...prev];
          try {
            localStorage.setItem(STORAGE_KEYS.PRICE_HISTORIES, JSON.stringify(next));
          } catch {}
          return next;
        });
      }

      if (newBrandsSet.size > 0) {
        setBrands((prev) => {
          const combined = Array.from(new Set([...prev, ...Array.from(newBrandsSet)]));
          try {
            localStorage.setItem(STORAGE_KEYS.BRANDS, JSON.stringify(combined));
          } catch {}
          return combined;
        });
      }
    } else {
      if (newHistories.length > 0) {
        setPriceHistories((prev) => [...newHistories, ...prev]);
      }
      if (newBrandsSet.size > 0) {
        setBrands((prev) => Array.from(new Set([...prev, ...Array.from(newBrandsSet)])));
      }
    }

    // Persist products, categories, and brands to Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        // 0. Sync categories first so Foreign Key constraint (category_id -> categories.id) is satisfied!
        if (categories.length > 0) {
          const catRows = categories.map((c, i) => ({
            id: c.id,
            name: c.name,
            icon: c.icon || 'Layers',
            sort_order: i + 1,
          }));
          await supabase.from('categories').upsert(catRows, { onConflict: 'id' });
        }

        // 1. Sync new brands to Supabase
        if (newBrandsSet.size > 0) {
          const brandRows = Array.from(newBrandsSet).map((b) => ({
            id: `b-${Date.now().toString().slice(-4)}-${Math.random().toString(36).substring(2, 6)}`,
            name: b,
          }));
          await supabase.from('brands').upsert(brandRows, { onConflict: 'name' });
        }

        // 2. Sync products to Supabase
        const rowsToSave = (itemsToUpsertToSupabase.length > 0 ? itemsToUpsertToSupabase : items).map((p, idx) => {
          const sPrice = Number(p.price) || 0;
          const vPrice = p.visitor_price !== undefined && Number(p.visitor_price) > 0 ? Number(p.visitor_price) : Math.round(sPrice * 0.85);
          const validCatId = p.category_id && p.category_id.trim() ? p.category_id.trim() : null;
          return {
            id: p.id && p.id.trim() ? p.id.trim() : generateUniqueId('prod'),
            name: p.name.trim(),
            category_id: validCatId,
            brand: p.brand?.trim() || 'متفرقه',
            price: sPrice,
            visitor_price: vPrice,
            consumer_price: p.consumer_price !== undefined && p.consumer_price !== null ? Number(p.consumer_price) : null,
            stock: p.stock !== undefined ? Number(p.stock) : 50,
            reserved_stock: 0,
            unit: p.unit || 'عدد',
            items_per_package: p.items_per_package !== undefined && Number(p.items_per_package) > 0 ? Number(p.items_per_package) : null,
            image_url: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400&auto=format&fit=crop&q=60&referrerPolicy=no-referrer',
            is_active: p.is_active ?? true,
          };
        });

        const chunkSize = 50;
        for (let i = 0; i < rowsToSave.length; i += chunkSize) {
          const chunk = rowsToSave.slice(i, i + chunkSize);
          
          // Try 1: Full upsert
          const { error: err1 } = await supabase.from('products').upsert(chunk, { onConflict: 'id' });
          if (!err1) continue;

          console.warn('Supabase products upsert failed, retrying with category_id = null fallback:', err1.message);

          // Try 2: With category_id = null & without items_per_package fallback
          const chunkNoFK = chunk.map((item) => {
            const { items_per_package, ...rest } = item;
            return { ...rest, category_id: null };
          });
          const { error: err2 } = await supabase.from('products').upsert(chunkNoFK, { onConflict: 'id' });
          if (!err2) continue;

          console.warn('Supabase products upsert failed, retrying without consumer_price:', err2.message);
          
          // Try 3: Strip consumer_price & category_id
          const chunk3 = chunkNoFK.map(({ consumer_price, ...rest }) => rest);
          const { error: err3 } = await supabase.from('products').upsert(chunk3, { onConflict: 'id' });
          if (!err3) continue;

          console.warn('Supabase products upsert failed, retrying without visitor_price:', err3.message);

          // Try 4: Strip consumer_price, visitor_price & category_id
          const chunk4 = chunk3.map(({ visitor_price, ...rest }) => rest);
          const { error: err4 } = await supabase.from('products').upsert(chunk4, { onConflict: 'id' });
          if (!err4) continue;

          // Try 5: Strip brand
          const chunk5 = chunk4.map(({ brand, ...rest }) => rest);
          const { error: err5 } = await supabase.from('products').upsert(chunk5, { onConflict: 'id' });
          if (err5) {
            console.error('All progressive fallbacks failed on Supabase for products chunk:', err5.message);
          }
        }
      } catch (err) {
        console.error('خطای غیرمنتظره در ثبت کالاهای اکسل روی Supabase:', err);
      }
    }

    const totalCount = items.length;
    const finalCreated = createdCount;
    const finalUpdated = updatedCount;
    const brandCount = Math.max(1, newBrandsSet.size);
    const catCount = Math.max(1, affectedCategoryIds.size);
    const message = `پردازش و ثبت با موفقیت انجام شد: ${totalCount} کالا (${finalCreated} کالای جدید، ${finalUpdated} به‌روزرسانی قیمت و مشخصات) در ${brandCount} برند و ${catCount} دسته‌بندی در سامانه ذخیره گردید.`;

    return {
      success: true,
      createdCount: finalCreated,
      updatedCount: finalUpdated,
      message,
    };
  }, [products, categories]);

  // Delete product (Admin full authority: cleans up product and unlinks FK references so historical invoices remain valid)
  const deleteProduct = useCallback(async (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return { success: false, message: 'کالای مورد نظر یافت نشد.' };

    // Record tombstone immediately to prevent any auto-sync resurrection
    addDeletedId(STORAGE_KEYS.DELETED_PRODUCT_IDS, productId);
    setMarketTestId(productId, false);

    // Update local state and persist to localStorage
    setProducts((prev) => {
      const next = prev.filter((p) => p.id !== productId);
      if (!isSupabaseConfigured) {
        try {
          localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(next));
        } catch {}
      }
      return next;
    });

    if (isSupabaseConfigured && supabase) {
      try {
        // 1. Unlink product_id in order_items so historical invoice line items preserve their name, price, quantity
        await supabase.from('order_items').update({ product_id: null }).eq('product_id', productId);
        // 2. Unlink product_id in loading_bill_items
        await supabase.from('loading_bill_items').update({ product_id: null }).eq('product_id', productId);
        // 3. Unlink product_id in inventory_transactions
        await supabase.from('inventory_transactions').update({ product_id: null }).eq('product_id', productId);
        // 4. Delete price history
        await supabase.from('product_price_history').delete().eq('product_id', productId);
        // 5. Delete product row from Supabase
        const { error } = await supabase.from('products').delete().eq('id', productId);
        if (error) {
          console.warn('Supabase product delete error:', error.message);
        }
      } catch (err) {
        console.error('Error during product deletion on Supabase:', err);
      }
    }
    return { success: true, message: `کالای «${prod.name}» با موفقیت حذف گردید.` };
  }, [products]);

  // Bulk Delete Products (Admin full authority)
  const bulkDeleteProducts = useCallback(async (productIds: string[]) => {
    if (!productIds || productIds.length === 0) {
      return { success: false, message: 'هیچ کالایی برای حذف انتخاب نشده است.', count: 0 };
    }

    productIds.forEach((id) => addDeletedId(STORAGE_KEYS.DELETED_PRODUCT_IDS, id));
    setBulkMarketTestIds(productIds, false);

    const idsToDelete = new Set(productIds);
    setProducts((prev) => {
      const next = prev.filter((p) => !idsToDelete.has(p.id));
      if (!isSupabaseConfigured) {
        try {
          localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(next));
        } catch {}
      }
      return next;
    });

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('order_items').update({ product_id: null }).in('product_id', productIds);
        await supabase.from('loading_bill_items').update({ product_id: null }).in('product_id', productIds);
        await supabase.from('inventory_transactions').update({ product_id: null }).in('product_id', productIds);
        await supabase.from('product_price_history').delete().in('product_id', productIds);
        const { error } = await supabase.from('products').delete().in('id', productIds);
        if (error) {
          console.warn('Supabase bulk product delete error:', error.message);
        }
      } catch (err) {
        console.error('Error deleting products from Supabase:', err);
      }
    }

    return {
      success: true,
      message: `${productIds.length} کالا با موفقیت از سیستم حذف شدند.`,
      count: productIds.length,
    };
  }, []);

  // Bulk Update Products
  const bulkUpdateProducts = useCallback(async (
    productIds: string[],
    updates: {
      category_id?: string;
      brand?: string;
      unit?: string;
      priceAdjustmentPercent?: number;
      fixedPrice?: number;
      is_active?: boolean;
      is_market_test?: boolean;
    }
  ) => {
    if (!productIds || productIds.length === 0) {
      return { success: false, message: 'هیچ کالایی برای ویرایش انتخاب نشده است.', count: 0 };
    }

    if (updates.is_market_test !== undefined) {
      setBulkMarketTestIds(productIds, Boolean(updates.is_market_test));
    }

    const targetIds = new Set(productIds);
    const updatedItemsForDb: Product[] = [];

    const updatedProducts = products.map((prod) => {
      if (!targetIds.has(prod.id)) return prod;

      let newPrice = prod.price;
      if (updates.fixedPrice !== undefined && updates.fixedPrice > 0) {
        newPrice = updates.fixedPrice;
      } else if (updates.priceAdjustmentPercent !== undefined && updates.priceAdjustmentPercent !== 0) {
        newPrice = Math.max(100, Math.round(prod.price * (1 + updates.priceAdjustmentPercent / 100)));
      }

      const newVisitorPrice = Math.round(newPrice * 0.85);

      const updated: Product = {
        ...prod,
        category_id: updates.category_id || prod.category_id,
        brand: updates.brand?.trim() || prod.brand,
        unit: updates.unit?.trim() || prod.unit,
        price: newPrice,
        visitor_price: newVisitorPrice,
        is_active: updates.is_active !== undefined ? updates.is_active : prod.is_active,
        is_market_test: updates.is_market_test !== undefined ? updates.is_market_test : (prod.is_market_test ?? false),
      };

      updatedItemsForDb.push(updated);
      return updated;
    });

    setProducts(updatedProducts);

    if (updates.brand && updates.brand.trim()) {
      const bTrimmed = updates.brand.trim();
      setBrands((prev) => (prev.includes(bTrimmed) ? prev : [...prev, bTrimmed]));
    }

    if (isSupabaseConfigured && supabase && updatedItemsForDb.length > 0) {
      (async () => {
        const rows = updatedItemsForDb.map((p) => ({
          id: p.id,
          name: p.name,
          category_id: p.category_id,
          brand: p.brand,
          price: p.price,
          visitor_price: p.visitor_price,
          consumer_price: p.consumer_price,
          stock: p.stock,
          reserved_stock: p.reserved_stock,
          unit: p.unit,
          image_url: p.image_url,
          is_active: p.is_active,
          is_market_test: p.is_market_test,
        }));

        const { error: err1 } = await supabase.from('products').upsert(rows, { onConflict: 'id' });
        if (!err1) return;

        console.warn('Supabase bulk update upsert failed with full fields, retrying without is_market_test / visitor_price:', err1.message);
        const rows2 = rows.map(({ is_market_test, visitor_price, ...rest }) => rest);
        const { error: err2 } = await supabase.from('products').upsert(rows2, { onConflict: 'id' });
        if (!err2) return;

        console.warn('Supabase bulk update upsert failed, retrying without brand:', err2.message);
        const rows3 = rows2.map(({ brand, ...rest }) => rest);
        const { error: err3 } = await supabase.from('products').upsert(rows3, { onConflict: 'id' });
        if (err3) {
          console.error('All bulk update fallback upserts failed on Supabase:', err3.message);
        }
      })();
    }

    return {
      success: true,
      message: `تعداد ${productIds.length} کالا با موفقیت به‌روزرسانی گروهی شدند.`,
      count: productIds.length,
    };
  }, [products]);

  // Add category
  const addCategory = useCallback((name: string, icon = 'Layers') => {
    const trimmed = name.trim();
    if (!trimmed) {
      return { success: false, message: 'لطفاً نام دسته‌بندی را وارد نمایید.' };
    }
    const exists = categories.some((c) => c.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      return { success: false, message: 'دسته‌بندی با این نام قبلاً ثبت شده است.' };
    }
    const newCatId = generateUniqueId('cat');
    const newCat: Category = {
      id: newCatId,
      name: trimmed,
      icon,
      sort_order: categories.length + 1,
      created_at: new Date().toISOString(),
    };
    setCategories((prev) => {
      const next = [...prev, newCat];
      if (!isSupabaseConfigured) {
        try {
          localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(next));
        } catch {}
      }
      return next;
    });

    if (isSupabaseConfigured && supabase) {
      supabase
        .from('categories')
        .insert({
          id: newCat.id,
          name: newCat.name,
          icon: newCat.icon,
          sort_order: newCat.sort_order,
        })
        .then(({ error }) => {
          if (error) console.error('خطا در ثبت دسته‌بندی روی Supabase:', error);
        });
    }

    return { success: true, message: `دسته‌بندی «${trimmed}» با موفقیت افزوده شد.`, category: newCat };
  }, [categories]);

  // Update category
  const updateCategory = useCallback((categoryId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) {
      return { success: false, message: 'نام دسته‌بندی نمی‌تواند خالی باشد.' };
    }
    const exists = categories.some(
      (c) => c.id !== categoryId && c.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      return { success: false, message: 'دسته‌بندی دیگری با این نام از قبل وجود دارد.' };
    }
    setCategories((prev) => {
      const next = prev.map((c) => (c.id === categoryId ? { ...c, name: trimmed } : c));
      if (!isSupabaseConfigured) {
        try {
          localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(next));
        } catch {}
      }
      return next;
    });

    if (isSupabaseConfigured && supabase) {
      supabase
        .from('categories')
        .update({ name: trimmed })
        .eq('id', categoryId)
        .then(({ error }) => {
          if (error) console.error('خطا در تغییر نام دسته‌بندی روی Supabase:', error);
        });
    }

    return { success: true, message: `نام دسته‌بندی با موفقیت به «${trimmed}» تغییر یافت.` };
  }, [categories]);

  // Delete category
  const deleteCategory = useCallback((categoryId: string) => {
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) {
      return { success: false, message: 'دسته‌بندی یافت نشد.' };
    }
    const remainingCats = categories.filter((c) => c.id !== categoryId);
    const fallbackCatId = remainingCats.length > 0 ? remainingCats[0].id : '';

    setProducts((prev) =>
      prev.map((p) => (p.category_id === categoryId ? { ...p, category_id: fallbackCatId } : p))
    );
    setCategories((prev) => prev.filter((c) => c.id !== categoryId));

    if (isSupabaseConfigured && supabase) {
      supabase
        .from('products')
        .update({ category_id: fallbackCatId })
        .eq('category_id', categoryId)
        .then(() => {
          supabase
            .from('categories')
            .delete()
            .eq('id', categoryId)
            .then(({ error }) => {
              if (error) console.error('خطا در حذف دسته‌بندی روی Supabase:', error);
            });
        });
    }

    return { success: true, message: `دسته‌بندی «${cat.name}» با موفقیت حذف شد.` };
  }, [categories]);

  // Add brand
  const addBrand = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      return { success: false, message: 'لطفاً نام برند را وارد نمایید.' };
    }
    const exists = brands.some((b) => b.trim().toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      return { success: false, message: 'این برند قبلاً در فهرست برندها تعریف شده است.' };
    }
    setBrands((prev) => {
      const next = [...prev, trimmed];
      if (!isSupabaseConfigured) {
        try {
          localStorage.setItem(STORAGE_KEYS.BRANDS, JSON.stringify(next));
        } catch {}
      }
      return next;
    });

    if (isSupabaseConfigured && supabase) {
      const brandId = generateUniqueId('brand');
      supabase
        .from('brands')
        .insert({ id: brandId, name: trimmed })
        .then(({ error }) => {
          if (error) console.error('خطا در افزودن برند به پایگاه داده Supabase:', error);
        });
    }

    return { success: true, message: `برند «${trimmed}» با موفقیت افزوده شد.` };
  }, [brands]);

  // Update brand
  const updateBrand = useCallback((oldBrandName: string, newBrandName: string) => {
    const trimmed = newBrandName.trim();
    if (!trimmed) {
      return { success: false, message: 'نام برند نمی‌تواند خالی باشد.' };
    }
    if (trimmed.toLowerCase() !== oldBrandName.trim().toLowerCase()) {
      const exists = brands.some((b) => b.trim().toLowerCase() === trimmed.toLowerCase());
      if (exists) {
        return { success: false, message: 'این برند از قبل در فهرست برندها تعریف شده است.' };
      }
    }
    setBrands((prev) =>
      prev.map((b) => (b.trim().toLowerCase() === oldBrandName.trim().toLowerCase() ? trimmed : b))
    );
    setProducts((prev) =>
      prev.map((p) =>
        p.brand && p.brand.trim().toLowerCase() === oldBrandName.trim().toLowerCase()
          ? { ...p, brand: trimmed }
          : p
      )
    );

    if (isSupabaseConfigured && supabase) {
      supabase
        .from('brands')
        .update({ name: trimmed })
        .eq('name', oldBrandName)
        .then(({ error }) => {
          if (error) console.error('خطا در به‌روزرسانی جدول برندها روی Supabase:', error);
        });

      supabase
        .from('products')
        .update({ brand: trimmed })
        .eq('brand', oldBrandName)
        .then(({ error }) => {
          if (error) console.error('خطا در به‌روزرسانی فیلد برند محصولات روی Supabase:', error);
        });
    }

    return { success: true, message: `نام برند با موفقیت به «${trimmed}» تغییر یافت.` };
  }, [brands]);

  // Delete brand
  const deleteBrand = useCallback((brandName: string) => {
    const trimmed = brandName.trim();
    const exists = brands.some((b) => b.trim().toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      return { success: false, message: 'برند مورد نظر یافت نشد.' };
    }

    setProducts((prev) =>
      prev.map((p) =>
        p.brand && p.brand.trim().toLowerCase() === trimmed.toLowerCase()
          ? { ...p, brand: 'متفرقه' }
          : p
      )
    );
    setBrands((prev) => prev.filter((b) => b.trim().toLowerCase() !== trimmed.toLowerCase()));

    if (isSupabaseConfigured && supabase) {
      supabase
        .from('brands')
        .delete()
        .eq('name', trimmed)
        .then(({ error }) => {
          if (error) console.error('خطا در حذف برند از جدول Supabase:', error);
        });

      supabase
        .from('products')
        .update({ brand: 'متفرقه' })
        .eq('brand', trimmed)
        .then(({ error }) => {
          if (error) console.error('خطا در تغییر برند محصولات حذف‌شده روی Supabase:', error);
        });
    }

    return { success: true, message: `برند «${trimmed}» با موفقیت حذف شد.` };
  }, [brands]);

  // Add unit
  const addUnit = useCallback((unitName: string) => {
    const trimmed = unitName.trim();
    if (!trimmed) {
      return { success: false, message: 'عنوان واحد سنجش نمی‌تواند خالی باشد.' };
    }
    const exists = units.some((u) => u.trim().toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      return { success: false, message: 'این واحد سنجش قبلاً تعریف شده است.' };
    }

    setUnits((prev) => [...prev, trimmed]);

    if (isSupabaseConfigured && supabase) {
      supabase.from('units').upsert({ name: trimmed }).then(({ error }) => {
        if (error) console.warn('Supabase unit insert note:', error.message);
      });
    }

    return { success: true, message: `واحد سنجش «${trimmed}» با موفقیت ایجاد شد.` };
  }, [units]);

  // Update unit
  const updateUnit = useCallback((oldUnitName: string, newUnitName: string) => {
    const oldTrimmed = oldUnitName.trim();
    const newTrimmed = newUnitName.trim();
    if (!newTrimmed) {
      return { success: false, message: 'عنوان جدید واحد سنجش نمی‌تواند خالی باشد.' };
    }
    if (oldTrimmed.toLowerCase() === newTrimmed.toLowerCase()) {
      return { success: true, message: 'تغییری در عنوان واحد سنجش داده نشد.' };
    }
    const exists = units.some(
      (u) => u.trim().toLowerCase() === newTrimmed.toLowerCase() && u.trim().toLowerCase() !== oldTrimmed.toLowerCase()
    );
    if (exists) {
      return { success: false, message: 'این واحد سنجش قبلاً وجود دارد.' };
    }

    setUnits((prev) => prev.map((u) => (u.trim().toLowerCase() === oldTrimmed.toLowerCase() ? newTrimmed : u)));

    setProducts((prev) =>
      prev.map((p) => (p.unit && p.unit.trim().toLowerCase() === oldTrimmed.toLowerCase() ? { ...p, unit: newTrimmed } : p))
    );

    if (isSupabaseConfigured && supabase) {
      supabase.from('products').update({ unit: newTrimmed }).eq('unit', oldTrimmed).then(() => {});
      supabase.from('units').delete().eq('name', oldTrimmed).then(() => {
        supabase.from('units').upsert({ name: newTrimmed }).then(() => {});
      });
    }

    return { success: true, message: `عنوان واحد سنجش با موفقیت به «${newTrimmed}» تغییر یافت.` };
  }, [units]);

  // Delete unit
  const deleteUnit = useCallback((unitName: string) => {
    const trimmed = unitName.trim();
    setUnits((prev) => prev.filter((u) => u.trim().toLowerCase() !== trimmed.toLowerCase()));

    if (isSupabaseConfigured && supabase) {
      supabase.from('units').delete().eq('name', trimmed).then(() => {});
    }

    return { success: true, message: `واحد سنجش «${trimmed}» با موفقیت حذف شد.` };
  }, []);

  return {
    categories,
    setCategories,
    brands,
    setBrands,
    units,
    setUnits,
    products,
    setProducts,
    productLikes,
    setProductLikes,
    toggleProductLike,
    priceHistories,
    setPriceHistories,
    updateProductPrice,
    updateProduct,
    addNewProduct,
    bulkUpsertProducts,
    deleteProduct,
    bulkDeleteProducts,
    bulkUpdateProducts,
    addCategory,
    updateCategory,
    deleteCategory,
    addBrand,
    updateBrand,
    deleteBrand,
    addUnit,
    updateUnit,
    deleteUnit,
  };
}
