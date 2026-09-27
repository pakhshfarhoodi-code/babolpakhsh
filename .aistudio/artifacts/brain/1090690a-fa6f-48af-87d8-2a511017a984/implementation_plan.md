# Brand Logo Design & Multi-Surface Integration Plan

A plan for generating a custom, modern B2B logo for **Farhoodi Wholesale Distribution (بارفروش)** and integrating it across three key surfaces:
1. **Login Screen**: Replacing generic icons with the new branded logo badge.
2. **Top-Right Header (App Shell)**: Embedding the logo inside a glassmorphic badge on the top right of the application header.
3. **Browser Favicon (`index.html`)**: Setting the logo image as the site favicon and apple-touch-icon so it displays in browser tabs.

---

## Confirmed Choices from Phase 1

- **Logo Aesthetic**: Modern emblem combining cold-chain wholesale logistics (snowflake / frost star / distribution vector) with a premium royal blue and gold palette (`#1e3a8a`, `#3b82f6`, `#f59e0b`).
- **Header Placement**: Positioned on the top right of the application header inside a glassmorphic elevated badge with brand title "فرهودی | پخش عمده".
- **Browser Tab Favicon**: Linked in `index.html` via `<link rel="icon">` and `<link rel="apple-touch-icon">`.

---

## 1. Logo Asset Generation

- **Tool Call**: `generate_image`
- **Filename**: `farhoodi_b2b_logo` (`.png` / `.jpg`)
- **Aspect Ratio**: `1:1`
- **Prompt**:
  > Modern minimalist vector logo icon for "Farhoodi B2B Food Wholesale Distribution". Features a sleek stylized snowflake emblem fused with a fast logistics delivery arrow, vibrant dark blue gradient background with glowing gold accents, clean sharp geometric lines, premium 3D glassmorphic badge look, isolated on a square dark background, 8k commercial brand icon quality.

---

## 2. Interface Integration Strategy

### A. Login Screen (`src/components/LoginScreen.tsx`)
- Replace the icon box in the app header with the generated logo image in a rounded badge.
- Preserve light/dark mode contrast and glassmorphism.

### B. Application Header (`src/components/Header.tsx` or `src/components/Layout.tsx`)
- Embed the logo image inside a glassmorphic badge on the top right (RTL layout: right side).
- Display next to the brand title "پخش عمده فرهودی | بارفروش".

### C. Browser Tab Favicon & Meta (`index.html`)
- Add `<link rel="icon" type="image/png" href="..." />` pointing to the logo asset.
- Update `<title>` to "بارفروش | شبکه پخش عمده فرهودی".

---

## 3. Technical Verification & Compilation
- Run `lint_applet` and `compile_applet`.
- Restart dev server to verify image asset loading in browser tab and headers.
