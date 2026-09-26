import { useState, useEffect, useCallback } from 'react';
import { Product, Category, ProductPriceHistory } from '../../types';
import { INITIAL_CATEGORIES, INITIAL_BRANDS, INITIAL_PRODUCTS } from '../../data/initialData';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { STORAGE_KEYS, generateUniqueId } from '../utils';

export function useCatalog() {
  const [categories, setCategories] = useState<Category[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (!saved) return INITIAL_CATEGORIES;
    try {
      const parsed: Category[] = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
      return INITIAL_CATEGORIES;
    } catch {
      return INITIAL_CATEGORIES;
    }
  });

  const [brands, setBrands] = useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.BRANDS);
    if (!saved) return INITIAL_BRANDS;
    try {
      const parsed: string[] = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
      return INITIAL_BRANDS;
    } catch {
      return INITIAL_BRANDS;
    }
  });

  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (!saved) return INITIAL_PRODUCTS;
    try {
      const parsed: Product[] = JSON.parse(saved);
      const existingIds = new Set(parsed.map((p) => p.id));
      const updatedExisting = parsed.map((p) => {
        const init = INITIAL_PRODUCTS.find((ip) => ip.id === p.id);
        return {
          ...p,
          brand: p.brand || init?.brand,
        };
      });
      const missingInitial = INITIAL_PRODUCTS.filter((ip) => !existingIds.has(ip.id));
      return [...updatedExisting, ...missingInitial];
    } catch {
      return INITIAL_PRODUCTS;
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

  // Update product price
  const updateProductPrice = useCallback((productId: string, newPrice: number) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod || prod.price === newPrice) return;

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
      changed_by: 'مدیریت مرکزی',
      changed_at: nowPersian,
    };

    setPriceHistories((prev) => [historyRecord, ...prev]);
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, price: newPrice } : p))
    );

    if (isSupabaseConfigured && supabase) {
      supabase
        .from('products')
        .update({ price: newPrice })
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
    setProducts((prev) => [
      ...prev,
      {
        ...newProd,
        id,
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
    return { success: true, message: `کالای «${prod.name}» با موفقیت حذف گردید.` };
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
    const fallbackCatId = remainingCats.length > 0 ? remainingCats[0].id : 'cat-1';

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
    deleteProduct,
    addCategory,
    updateCategory,
    deleteCategory,
    addBrand,
    updateBrand,
    deleteBrand,
  };
}
