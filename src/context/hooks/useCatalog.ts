import { useState, useEffect, useCallback } from 'react';
import { Product, Category, ProductPriceHistory } from '../../types';
import { INITIAL_CATEGORIES, INITIAL_BRANDS, INITIAL_PRODUCTS } from '../../data/initialData';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { STORAGE_KEYS, generateUniqueId } from '../utils';

export function useCatalog() {
  const PRESET_CAT_IDS = new Set(['cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5']);

  const [categories, setCategories] = useState<Category[]>(() => {
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
    const saved = localStorage.getItem(STORAGE_KEYS.BRANDS);
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // Dummy seed products that should not be kept if user wants clean data
  const DUMMY_PRODUCT_IDS = new Set(['prod-1', 'prod-2', 'prod-3', 'prod-4', 'prod-5', 'prod-6', 'prod-7', 'prod-8', 'prod-9']);

  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (!saved) return [];
    try {
      const parsed: Product[] = JSON.parse(saved);
      // Filter out any default dummy products from seed data
      const cleaned = parsed.filter((p) => !DUMMY_PRODUCT_IDS.has(p.id));
      return cleaned;
    } catch {
      return [];
    }
  });

  const [priceHistories, setPriceHistories] = useState<ProductPriceHistory[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PRICE_HISTORIES);
    return saved ? JSON.parse(saved) : [];
  });

  // Local storage persistence
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.BRANDS, JSON.stringify(brands));
  }, [brands]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PRICE_HISTORIES, JSON.stringify(priceHistories));
  }, [priceHistories]);

  // Update product price (supports both store price and visitor purchase price)
  const updateProductPrice = useCallback((productId: string, newPrice: number, newVisitorPrice?: number) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;
    
    const targetVisitorPrice = newVisitorPrice !== undefined ? newVisitorPrice : (prod.visitor_price ?? Math.round(newPrice * 0.85));
    if (prod.price === newPrice && prod.visitor_price === targetVisitorPrice) return;

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
      prev.map((p) => (p.id === productId ? { ...p, price: newPrice, visitor_price: targetVisitorPrice } : p))
    );

    if (isSupabaseConfigured && supabase) {
      supabase
        .from('products')
        .update({ price: newPrice, visitor_price: targetVisitorPrice })
        .eq('id', productId)
        .then(({ error }) => {
          if (error) console.error('خطا در تغییر قیمت کالا روی Supabase:', error);
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
    setProducts((prev) => [
      ...prev,
      {
        ...newProd,
        id,
        visitor_price,
        reserved_stock: 0,
      },
    ]);
    if (newProd.brand && newProd.brand.trim()) {
      const bTrimmed = newProd.brand.trim();
      setBrands((prev) => (prev.includes(bTrimmed) ? prev : [...prev, bTrimmed]));
    }

    if (isSupabaseConfigured && supabase) {
      supabase
        .from('products')
        .insert({
          id,
          name: newProd.name,
          category_id: newProd.category_id,
          brand: newProd.brand,
          price: newProd.price,
          visitor_price,
          stock: newProd.stock,
          reserved_stock: 0,
          unit: newProd.unit,
          image_url: newProd.image_url,
          is_active: newProd.is_active,
        })
        .then(({ error }) => {
          if (error) console.error('خطا در افزودن کالای جدید روی Supabase:', error);
        });
    }
  }, []);

  // Bulk Upsert Products from Excel import
  const bulkUpsertProducts = useCallback((items: Array<{
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
    is_active?: boolean;
  }>): { success: boolean; createdCount: number; updatedCount: number; message: string } => {
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

      const catId = item.category_id || categories[0]?.id || '';
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
          is_active: item.is_active !== undefined ? item.is_active : current.is_active,
        };
        updatedProducts[matchIndex] = updatedProd;
        itemsToUpsertToSupabase.push(updatedProd);
        updatedCount++;
      } else {
        // Create new product
        const newId = item.id && item.id.trim() ? item.id.trim() : `prod-${Date.now().toString().slice(-4)}-${index}`;
        
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

    if (newHistories.length > 0) {
      setPriceHistories((prev) => [...newHistories, ...prev]);
    }

    if (newBrandsSet.size > 0) {
      setBrands((prev) => {
        const combined = new Set([...prev, ...Array.from(newBrandsSet)]);
        return Array.from(combined);
      });
    }

    // Persist products and brands to Supabase asynchronously
    if (isSupabaseConfigured && supabase) {
      (async () => {
        try {
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
            return {
              id: p.id && p.id.trim() ? p.id.trim() : `prod-${Date.now().toString().slice(-4)}-${idx}`,
              name: p.name.trim(),
              category_id: p.category_id || categories[0]?.id || '',
              brand: p.brand?.trim() || 'متفرقه',
              price: sPrice,
              visitor_price: vPrice,
              consumer_price: p.consumer_price !== undefined && p.consumer_price !== null ? Number(p.consumer_price) : null,
              stock: p.stock !== undefined ? Number(p.stock) : 50,
              reserved_stock: 0,
              unit: p.unit || 'عدد',
              image_url: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400&auto=format&fit=crop&q=60&referrerPolicy=no-referrer',
              is_active: p.is_active ?? true,
            };
          });

          const chunkSize = 50;
          for (let i = 0; i < rowsToSave.length; i += chunkSize) {
            const chunk = rowsToSave.slice(i, i + chunkSize);
            const { error: upsertErr } = await supabase.from('products').upsert(chunk, { onConflict: 'id' });
            if (upsertErr) {
              console.warn('Supabase products upsert failed, retrying without visitor_price:', upsertErr.message);
              const fallbackChunk = chunk.map(({ visitor_price, ...rest }) => rest);
              const { error: fallbackErr } = await supabase.from('products').upsert(fallbackChunk, { onConflict: 'id' });
              if (fallbackErr) {
                console.error('Supabase fallback upsert failed:', fallbackErr.message);
              }
            }
          }
        } catch (err) {
          console.error('خطای غیرمنتظره در ثبت کالاهای اکسل روی Supabase:', err);
        }
      })();
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

  // Delete product
  const deleteProduct = useCallback((productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return { success: false, message: 'کالای مورد نظر یافت نشد.' };
    if (prod.reserved_stock > 0) {
      return {
        success: false,
        message: `امکان حذف کالا وجود ندارد زیرا ${prod.reserved_stock} واحد از آن در سفارشات جاری رزرو است.`,
      };
    }
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    if (isSupabaseConfigured && supabase) {
      supabase.from('products').delete().eq('id', productId).then(({ error }) => {
        if (error) console.error('خطا در حذف کالا از Supabase:', error);
      });
    }
    return { success: true, message: `کالای «${prod.name}» با موفقیت حذف گردید.` };
  }, [products]);

  // Bulk Delete Products
  const bulkDeleteProducts = useCallback(async (productIds: string[]) => {
    if (!productIds || productIds.length === 0) {
      return { success: false, message: 'هیچ کالایی برای حذف انتخاب نشده است.', count: 0 };
    }

    const reservedProducts = products.filter(
      (p) => productIds.includes(p.id) && p.reserved_stock > 0
    );
    if (reservedProducts.length > 0) {
      const names = reservedProducts.map((p) => p.name).slice(0, 3).join('، ');
      return {
        success: false,
        message: `امکان حذف ${reservedProducts.length} کالا (${names}...) به دلیل داشتن رزرو فعال در سفارشات جاری وجود ندارد.`,
        count: 0,
      };
    }

    const idsToDelete = new Set(productIds);
    setProducts((prev) => prev.filter((p) => !idsToDelete.has(p.id)));

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('products').delete().in('id', productIds);
      } catch (err) {
        console.error('Error deleting products from Supabase:', err);
      }
    }

    return {
      success: true,
      message: `${productIds.length} کالا با موفقیت از سیستم حذف شدند.`,
      count: productIds.length,
    };
  }, [products]);

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
    }
  ) => {
    if (!productIds || productIds.length === 0) {
      return { success: false, message: 'هیچ کالایی برای ویرایش انتخاب نشده است.', count: 0 };
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
      try {
        const rows = updatedItemsForDb.map((p) => ({
          id: p.id,
          name: p.name,
          category_id: p.category_id,
          brand: p.brand,
          price: p.price,
          visitor_price: p.visitor_price,
          stock: p.stock,
          reserved_stock: p.reserved_stock,
          unit: p.unit,
          image_url: p.image_url,
          is_active: p.is_active,
        }));
        await supabase.from('products').upsert(rows, { onConflict: 'id' });
      } catch (err) {
        console.error('Error updating products in Supabase:', err);
      }
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
    setCategories((prev) => [...prev, newCat]);

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
    setCategories((prev) =>
      prev.map((c) => (c.id === categoryId ? { ...c, name: trimmed } : c))
    );

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
    setBrands((prev) => [...prev, trimmed]);

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

  return {
    categories,
    setCategories,
    brands,
    setBrands,
    products,
    setProducts,
    priceHistories,
    setPriceHistories,
    updateProductPrice,
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
  };
}
