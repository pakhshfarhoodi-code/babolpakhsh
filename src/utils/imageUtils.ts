/**
 * Image handling utilities for image compression, fallback resolution,
 * and cross-device optimization.
 */

export function compressImageFile(
  file: File,
  maxWidth = 600,
  maxHeight = 600,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('فایل انتخاب‌شده تصویر نیست.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('خطا در خواندن فایل تصویر.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('خطا در بارگذاری تصویر.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Compress to JPEG with quality 0.75
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function getCategoryFallbackImage(catId?: string, name?: string): string {
  const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400&auto=format&fit=crop&q=60';

  if (name) {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('بستنی') || lowerName.includes('مگنوم') || lowerName.includes('سالار')) {
      return 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=400&auto=format&fit=crop&q=60';
    }
    if (
      lowerName.includes('سوسیس') ||
      lowerName.includes('کالباس') ||
      lowerName.includes('ژامبون') ||
      lowerName.includes('همبرگر') ||
      lowerName.includes('ناگت')
    ) {
      return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&auto=format&fit=crop&q=60';
    }
    if (
      lowerName.includes('شیر') ||
      lowerName.includes('پنیر') ||
      lowerName.includes('ماست') ||
      lowerName.includes('خامه') ||
      lowerName.includes('کره')
    ) {
      return 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=400&auto=format&fit=crop&q=60';
    }
    if (
      lowerName.includes('آبمیوه') ||
      lowerName.includes('نوشابه') ||
      lowerName.includes('دلستر') ||
      lowerName.includes('دوغ') ||
      lowerName.includes('رانی')
    ) {
      return 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400&auto=format&fit=crop&q=60';
    }
  }

  switch (catId) {
    case 'cat-1':
      return 'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=400&auto=format&fit=crop&q=60';
    case 'cat-2':
      return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&auto=format&fit=crop&q=60';
    case 'cat-3':
      return 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=400&auto=format&fit=crop&q=60';
    case 'cat-4':
      return 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400&auto=format&fit=crop&q=60';
    case 'cat-5':
      return 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&auto=format&fit=crop&q=60';
    default:
      return DEFAULT_IMAGE;
  }
}

export function sanitizeImageUrl(imageUrl?: string, categoryId?: string, productName?: string): string {
  if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.trim()) {
    return getCategoryFallbackImage(categoryId, productName);
  }

  const trimmed = imageUrl.trim();

  // Blob URLs are local memory pointers that don't exist on other devices
  if (trimmed.startsWith('blob:')) {
    return getCategoryFallbackImage(categoryId, productName);
  }

  return trimmed;
}
