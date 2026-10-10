/**
 * Synchronizes PWA icons, favicon, Apple Touch Icon, and dynamic Web App Manifest
 * with the user-defined logo from settings or the system default.
 */
export function syncPwaIconsAndManifest(logoUrl?: string) {
  if (typeof document === 'undefined') return;

  const effectiveLogo = logoUrl || '/icon-512-v2.png?v=7';

  try {
    // 1. Update all favicon link elements
    const favicons = document.querySelectorAll<HTMLLinkElement>("link[rel*='icon']");
    favicons.forEach((el) => {
      el.href = effectiveLogo;
    });

    // 2. Update iOS Apple Touch Icon
    let appleIcon = document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']");
    if (!appleIcon) {
      appleIcon = document.createElement('link');
      appleIcon.rel = 'apple-touch-icon';
      document.head.appendChild(appleIcon);
    }
    appleIcon.href = effectiveLogo;

    // 3. Update Web App Manifest dynamically for mobile install prompts
    const mimeType = effectiveLogo.startsWith('data:image/webp')
      ? 'image/webp'
      : (effectiveLogo.startsWith('data:image/png') ? 'image/png' : 'image/png');

    const manifestData = {
      name: 'بارفروش | شبکه پخش عمده فرهودی',
      short_name: 'بارفروش',
      description: 'سامانه یکپارچه بارفروش، شبکه پخش عمده فرهودی شامل مدیریت سفارشات، پورتال ویزیتورها و انبارداری',
      start_url: './',
      scope: './',
      display: 'standalone',
      background_color: '#0F172A',
      theme_color: '#0F172A',
      icons: [
        {
          src: effectiveLogo,
          sizes: '192x192',
          type: mimeType,
          purpose: 'any',
        },
        {
          src: effectiveLogo,
          sizes: '192x192',
          type: mimeType,
          purpose: 'maskable',
        },
        {
          src: effectiveLogo,
          sizes: '512x512',
          type: mimeType,
          purpose: 'any',
        },
        {
          src: effectiveLogo,
          sizes: '512x512',
          type: mimeType,
          purpose: 'maskable',
        },
      ],
    };

    const manifestBlob = new Blob([JSON.stringify(manifestData)], { type: 'application/manifest+json' });
    const manifestBlobUrl = URL.createObjectURL(manifestBlob);

    let manifestLink = document.querySelector<HTMLLinkElement>("link[rel='manifest']");
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }
    manifestLink.href = manifestBlobUrl;
  } catch (err) {
    console.warn('Failed to sync PWA icons and manifest:', err);
  }
}
