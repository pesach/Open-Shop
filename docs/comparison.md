# Open-Shop Visual & Color Comparison Specification

This document details the exact pixel-by-pixel, background-by-background, and foreground-by-foreground color specifications required for Open-Shop to match the reference Photopea dark studio theme.

---

## 🎨 Master Palette Matrix

| Section / UI Element | Required Background Hex | Required Foreground / Text Hex | Borders & Accents | Status & Verification |
| :--- | :--- | :--- | :--- | :--- |
| **Top Menubar (`.topbar`)** | `#474747` (Full 100% width) | `#e0e0e0` / `#ffffff` on hover | `border-bottom: 1px solid #1a1a1a` | Logo on top-left before `File`. Zero Account button. Top links keep `About` and `Report a bug` only; all subsequent links (`Learn`, `Blog`, `API`, social) are removed. |
| **Brand Logo & Favicon** | Solitary squircle: `#3b82f6` -> `#2563eb` Blue Gradient | White Aperture (`#ffffff`) | Crisp drop-shadow | Blue squircle ONLY. Applied to menubar (`promo/icon.svg`), banner (`promo/logo.svg`), and favicon. NEVER yellow or altered colors. |
| **Tool Options Bar** | `#474747` (Lighter studio charcoal) | `#ffffff` / `#e0e0e0` | `border-bottom: 1px solid #1a1a1a` | Form controls have `#242424` inputs with `#ffffff` text. Creates smooth 7px rounded contrast against workspace container. |
| **Left Toolbar (`.toolbar`)** | `#242424` | `#d0d0d0` Silver Icons (`--gs-invert: 0.78`) | `border-right: 1px solid #1a1a1a` | `#2563eb` active tool highlight. Flush placement without `< >` toggle. NEVER white. |
| **Main Canvas Surround (`.mainblock`)** | `#252525` (Medium neutral grey) | `#ffffff` Document Canvas | Clear contrast around documents | Surrounds active document tab with `border-top-left-radius: 7px; padding: 4px 4px 0 4px;`. |
| **Document Tabs (`.doctab`, `.block .panelhead div`)** | Inactive: `#242424`<br>Active: `#474747` | Inactive: `#b0b0b0`<br>Active: `#ffffff` | `border-radius: 4px` | Active tab blends seamlessly into the `#474747` options bar. |
| **Right Panels - Container (`.rightbar`)** | `#252525` (Studio panel grey) | `#e0e0e0` | `border-left: 1px solid #1a1a1a` | Must be `#252525` throughout all panel bodies. **NEVER WHITE**. |
| **Right Panels - Header Tabs (`.panelhead`)** | Inactive: `#242424`<br>Active: `#474747` | Inactive: `#b0b0b0`<br>Active: `#ffffff` | Active tab has `#2563eb` top indicator | Tabs: `History`, `Swatches`, `Color` on top; `Layers`, `Channels`, `Paths` on bottom. |
| **Right Panels - Body & Tree (`.lpbody`, `.layeritem`)** | `#252525` | `#ffffff` | `border-bottom: 1px solid #282828` | Selected layer: `#2563eb` highlight. 18px lock/eye icons. **NEVER WHITE**. |
| **Right Panels - Action Footer (`.lpfoot`)** | `#252525` | Silver icons (`18px`) | `border-top: 1px solid #282828` | Actions: Link, `fx`, Mask, Adjustment, Folder, New Layer, Trash. **NEVER WHITE**. |
| **Home Screen - Action Buttons (`.bhover`)** | `rgba(255, 255, 255, 0.05)` | `#e0e0e0` (high contrast) | `border: 1px solid rgba(255, 255, 255, 0.28)` | Exactly 5 buttons: `[New Project] [Open From Computer] [Templates]` + `[Generate] [Video?]`. Zero "Install Photopea" button. |
| **Home Screen - Dropzone** | Transparent / `#242424` | `#888888` text | `border: 1px solid rgba(255, 255, 255, 0.18)` | High contrast `Drop any files here` text. |
| **Home Screen - Left Sidebar** | Clean storage shortcuts | High contrast icons | Flush layout | Contains: `Home`, `This Device`, `Dropbox`, `OneDrive`, `Google Drive`, `Pick any File`. Links to `PeaDrive`, `PeaGames`, `Photopea`, `Vectorpea`, `Jampea` are permanently removed. |
| **Modal Windows (`.window`, New Project)** | `#2b2b2b` (Solid opaque) | `#e0e0e0` | `border: 1px solid rgba(255, 255, 255, 0.15)` | Centered floating modal with drop shadow (`box-shadow: 0 16px 48px rgba(0,0,0,0.75)`). Zero transparency bleed-through. |
| **Dropdown Selects (`select`, `.fitem select`)** | `#242424` (Dark Studio) | `#ffffff` (Crisp white) | `border: 1px solid rgba(255, 255, 255, 0.2)` | Custom chevron arrow (`background-image: svg`), `appearance: none; -webkit-appearance: none;`. **NEVER WHITE**. |
| **All Brand Logo References** | Blue `#3b82f6` -> `#2563eb` | White aperture ring & text | Solid Blue Squircle | `logo_pp`, `logo_vp`, `logo_jp`, `logo_cucumber` MUST all map to the official Blue Open-Shop logo. **NEVER YELLOW, GREEN, OR PINK**. |

---

## 🔍 Systematic Verification Checklist

Every agent working on this codebase MUST check every one of these points using DOM computed styles before reporting:

1. **Verify No White Panels or Selects**: Check `window.getComputedStyle(el).backgroundColor` on `.rightbar`, `.lpbody`, `.toolbar`, `.options`, and all `<select>` dropdowns to ensure none equal `rgb(255, 255, 255)`.
2. **Verify Menubar Full Width**: Ensure the topbar has `width: 100%` and no white background leaks to the right of the header.
3. **Verify Blue Brand Logo & Favicon**: Confirm `promo/icon.svg` and `dbs.js` use the `#3b82f6` -> `#2563eb` gradient and the top-left icon is present before `File`. Never allow yellow `logo_vp` or green `logo_pp` assets.
4. **Verify Top Links & Account**: Confirm `About` and `Report a bug` are present, `Learn`, `Blog`, `API`, and social links are removed, and `Account` button is hidden.
5. **Verify Sidebar Cleanliness**: Ensure `PeaDrive`, `PeaGames`, `Photopea`, `Vectorpea`, `Jampea` are absent from storage/shortcuts list.
6. **Verify Smooth 7px Rounded Corner**: Check `.mainblock .panelhead` has `border-top-left-radius: 7px` and `padding: 4px 4px 0 4px`.
7. **Verify Clean Layer Footer**: Ensure the Diagnostics badge is hidden (`display: none`) and does not overlap the Trash button or layer actions.


