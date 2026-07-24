# Design System Context & UI Reference Manual

This document provides an exhaustive, concrete design-system reference for the **Tabs IDE** web client application. All values, color tokens, typography specifications, component primitives, elevation rules, and layout dimensions are quoted directly from the source files in the repository.

---

## 1. Design Tokens & Theming

### Source of Truth
- **CSS / Theme Variables File**: [`tabs-main/apps/web/src/index.css`](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css)
- **Vite & Tailwind v4 Integration**: [`tabs-main/apps/web/vite.config.ts`](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/vite.config.ts#L61) using `@tailwindcss/vite` (Tailwind CSS v4.3.0).
- **Fonts Source**: [`tabs-main/apps/web/index.html`](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/index.html#L20-L25) via Google Fonts (DM Sans).

---

### Color Tokens

All semantic color tokens are defined in [`tabs-main/apps/web/src/index.css`](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L227-L286) using OKLCH, `color-mix`, and Tailwind color primitives.

| Token | Light Mode Value (`:root`) | Dark Mode Value (`@variant dark`) | File & Line Citation |
| :--- | :--- | :--- | :--- |
| `--background` | `var(--color-white)` (`#ffffff`) | `color-mix(in srgb, var(--color-neutral-950) 95%, var(--color-white))` | [index.css:230, 259](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L230) |
| `--app-chrome-background` | `var(--background)` | `var(--background)` | [index.css:231, 260](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L231) |
| `--foreground` | `var(--color-neutral-800)` (`#262626`) | `var(--color-neutral-100)` (`#f5f5f5`) | [index.css:232, 261](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L232) |
| `--card` | `var(--color-white)` (`#ffffff`) | `color-mix(in srgb, var(--background) 98%, var(--color-white))` | [index.css:233, 262](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L233) |
| `--card-foreground` | `var(--color-neutral-800)` (`#262626`) | `var(--color-neutral-100)` (`#f5f5f5`) | [index.css:234, 263](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L234) |
| `--popover` | `color-mix(in srgb, var(--color-white) 80%, transparent)` | `color-mix(in srgb, var(--background) 80%, transparent)` | [index.css:235, 264](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L235) |
| `--popover-foreground` | `var(--color-neutral-800)` (`#262626`) | `var(--color-neutral-100)` (`#f5f5f5`) | [index.css:236, 265](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L236) |
| `--primary` | `oklch(0.488 0.217 264)` | `oklch(0.588 0.217 264)` | [index.css:237, 266](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L237) |
| `--primary-foreground` | `var(--color-white)` (`#ffffff`) | `var(--color-white)` (`#ffffff`) | [index.css:238, 267](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L238) |
| `--secondary` | `color-mix(in srgb, var(--color-black) 4%, transparent)` | `color-mix(in srgb, var(--color-white) 4%, transparent)` | [index.css:239, 268](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L239) |
| `--secondary-foreground` | `var(--color-neutral-800)` (`#262626`) | `var(--color-neutral-100)` (`#f5f5f5`) | [index.css:240, 269](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L240) |
| `--muted` | `color-mix(in srgb, var(--color-black) 4%, transparent)` | `color-mix(in srgb, var(--color-white) 4%, transparent)` | [index.css:241, 270](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L241) |
| `--muted-foreground` | `color-mix(in srgb, var(--color-neutral-500) 90%, var(--color-black))` | `color-mix(in srgb, var(--color-neutral-500) 90%, var(--color-white))` | [index.css:242, 271](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L242) |
| `--accent` | `color-mix(in srgb, var(--color-black) 4%, transparent)` | `color-mix(in srgb, var(--color-white) 4%, transparent)` | [index.css:243, 272](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L243) |
| `--accent-foreground` | `var(--color-neutral-800)` (`#262626`) | `var(--color-neutral-100)` (`#f5f5f5`) | [index.css:244, 273](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L244) |
| `--destructive` | `var(--color-red-500)` (`#ef4444`) | `color-mix(in srgb, var(--color-red-500) 90%, var(--color-white))` | [index.css:245, 274](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L245) |
| `--destructive-foreground` | `var(--color-red-700)` (`#b91c1c`) | `var(--color-red-400)` (`#f87171`) | [index.css:249, 278](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L249) |
| `--border` | `color-mix(in srgb, var(--color-black) 8%, transparent)` | `color-mix(in srgb, var(--color-white) 6%, transparent)` | [index.css:246, 275](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L246) |
| `--input` | `color-mix(in srgb, var(--color-black) 10%, transparent)` | `color-mix(in srgb, var(--color-white) 8%, transparent)` | [index.css:247, 276](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L247) |
| `--ring` | `oklch(0.488 0.217 264)` | `oklch(0.588 0.217 264)` | [index.css:248, 277](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L248) |
| `--info` | `var(--color-blue-500)` (`#3b82f6`) | `var(--color-blue-500)` (`#3b82f6`) | [index.css:250, 279](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L250) |
| `--info-foreground` | `var(--color-blue-700)` (`#1d4ed8`) | `var(--color-blue-400)` (`#60a5fa`) | [index.css:251, 280](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L251) |
| `--success` | `var(--color-emerald-500)` (`#10b981`) | `var(--color-emerald-500)` (`#10b981`) | [index.css:252, 281](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L252) |
| `--success-foreground` | `var(--color-emerald-700)` (`#047857`) | `var(--color-emerald-400)` (`#34d399`) | [index.css:253, 282](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L253) |
| `--warning` | `var(--color-amber-500)` (`#f59e0b`) | `var(--color-amber-500)` (`#f59e0b`) | [index.css:254, 283](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L254) |
| `--warning-foreground` | `var(--color-amber-700)` (`#b45309`) | `var(--color-amber-400)` (`#fbbf24`) | [index.css:255, 284](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L255) |

#### Special Decorative Gradient Token
- **`--ultrathink-spectrum`**: `linear-gradient(120deg, #ff6b6b 0%, #f59e0b 18%, #22c55e 36%, #14b8a6 54%, #3b82f6 72%, #ec4899 90%, #ff6b6b 100%)` ([index.css:837-846](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L837))

---

### Border-Radius Scale

The base radius token is defined at `:root` level and calculated systematically for component sizes:

| Radius Token | Expression | Calculated Value (rem / px) | File & Line Citation |
| :--- | :--- | :--- | :--- |
| `--radius` | Base Value | `0.625rem` (10px) | [index.css:229](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L229) |
| `--radius-sm` | `calc(var(--radius) - 4px)` | `0.375rem` (6px) | [index.css:69](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L69) |
| `--radius-md` | `calc(var(--radius) - 2px)` | `0.5rem` (8px) | [index.css:70](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L70) |
| `--radius-lg` | `var(--radius)` | `0.625rem` (10px) | [index.css:71](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L71) |
| `--radius-xl` | `calc(var(--radius) + 4px)` | `0.875rem` (14px) | [index.css:72](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L72) |
| `--radius-2xl` | `calc(var(--radius) + 8px)` | `1.125rem` (18px) | [index.css:73](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L73) |
| `--radius-3xl` | `calc(var(--radius) + 12px)` | `1.375rem` (22px) | [index.css:74](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L74) |
| `--radius-4xl` | `calc(var(--radius) + 16px)` | `1.625rem` (26px) | [index.css:75](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L75) |

---

### Shadow & Elevation Scale

| Elevation Tier | Box Shadow Specification | Backdrop Filter | Usage / Context | Citation |
| :--- | :--- | :--- | :--- | :--- |
| **Card / Surface Inset** | `inset-shadow-[0_1px_--theme(--color-white/16%)]` / `shadow-[0_1px_--theme(--color-black/4%)]` | N/A | Cards, inputs, buttons | [button.tsx:34](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/ui/button.tsx#L34), [card.tsx:11](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/ui/card.tsx#L11) |
| **Button Focus / Outline** | `shadow-xs/5`, `shadow-primary/24 shadow-xs` | N/A | Default buttons, outline buttons | [button.tsx:34](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/ui/button.tsx#L34) |
| **Composer Glass (Light)** | `0 18px 48px -20px rgb(0 0 0 / 28%), 0 4px 14px -7px rgb(0 0 0 / 22%)` | `blur(16px)` | Floating bottom chat input bar | [index.css:160-168](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L160) |
| **Composer Glass (Dark)** | `0 18px 48px -20px rgb(0 0 0 / 60%), 0 4px 14px -7px rgb(0 0 0 / 40%)` | `blur(16px)` | Floating bottom chat input bar in dark mode | [index.css:175-179](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L175) |
| **Modal / Dialog Overlay** | N/A | `blur(8px) !important` | Screen backdrops for Dialog, Sheet, Alert | [index.css:931](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L931) |
| **Floating Popups** | `shadow-lg/5` | `blur(16px) !important` | Dropdown Menu, Select, Popover, Dialog Popup | [index.css:945](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L945), [dialog.tsx:68](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/ui/dialog.tsx#L68) |

---

### Z-Index Scale

| Class / Value | Specific Purpose | Source File & Line Citation |
| :--- | :--- | :--- |
| `z-0` | Base workspace container layout, lower frame cards | [`WorkspaceShell.tsx:5764`](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/WorkspaceShell.tsx#L5764) |
| `z-10` | Interactive overlay controls, sticky table headers, drag handles | [`KeybindingsSettings.tsx:1336`](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/settings/KeybindingsSettings.tsx#L1336) |
| `z-20` | Drawer resize hit-areas, elevated toggle buttons, pill floating badges | [`ThreadTerminalDrawer.tsx:970`](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/ThreadTerminalDrawer.tsx#L970) |
| `z-30` | Sticky search bars in model pickers, floating action controls | [`FusedModelPicker.tsx:481`](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/chat/FusedModelPicker.tsx#L481) |
| `z-40` | Top quick-access command palette overlay, slide-out drawer panels | [`WorkspaceShell.tsx:339`](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/WorkspaceShell.tsx#L339) |
| `z-50` | Dialog backdrops, Dialog viewports, Tooltip & Menu positioners | [`dialog.tsx:28`](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/ui/dialog.tsx#L28), [`menu.tsx:54`](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/ui/menu.tsx#L54) |
| `z-[9999]` | Application cold boot / splash screen transition layer | [`__root.tsx:88`](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/routes/__root.tsx#L88) |
| `z-[10000]` | Desktop native context menu fallback portal overlay | [`contextMenuFallback.ts:18`](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/contextMenuFallback.ts#L18) |
| `z-[99999]` | Fullscreen critical settings view modal | [`_chat.settings.tsx:864`](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/routes/_chat.settings.tsx#L864) |

---

## 2. Typography System

### Font Families

1. **Primary Sans-Serif (UI Body & Headers)**:
   - Stack: `"DM Sans Variable", "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`
   - Import Source: Imported in [`tabs-main/apps/web/index.html:20-25`](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/index.html#L20-L25):
     `https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&display=swap`
   - Configured in: [`index.css:39-41`](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L39) as `--font-sans`.

2. **Monospace (Code, Terminal, Inputs & Shortcuts)**:
   - Stack: `"SF Mono", "SFMono-Regular", "JetBrains Mono", Consolas, "Liberation Mono", Menlo, monospace`
   - Configured in: [`index.css:42-43`](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L42) as `--font-mono` and applied globally to `pre, code, textarea, input` at line 338.

---

### Type Scale

| Size Token | Font Size (px / rem) | Line Height | Letter Spacing | Font Weight | Mapped Components & Elements | Citation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `text-[10px]` | 10px / `0.625rem` | ~14px (`1.4`) | Normal / Mono | `400` / `500` / `700` | Keyboard shortcuts (`kbd.tsx`), small pill badges, footnote superscripts, index tags | [kbd.tsx:12](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/ui/kbd.tsx#L12) |
| `text-[11px]` | 11px / `0.6875rem` | ~16px (`1.45`) | `tracking-[0.14em]` / `tracking-[0.18em]` | `500` / `600` | Section uppercase headers, category list dividers, sub-navigation titles | [_chat.settings.tsx:2162](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/routes/_chat.settings.tsx#L2162) |
| `text-xs` | 12px / `0.75rem` | `1rem` (16px) | Normal | `400` / `500` / `600` | Small buttons (`xs`/`sm`), badges, tooltips, inline code blocks, markdown footnotes, table cells | [badge.tsx:21](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/ui/badge.tsx#L21), [index.css:579](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L579) |
| `text-sm` | 14px / `0.875rem` | `1.25rem` (20px) | Normal | `400` / `500` / `600` | Standard body text, desktop button text, input text, dropdown menu items, card description | [button.tsx:11](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/ui/button.tsx#L11), [card.tsx:68](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/ui/card.tsx#L68) |
| `text-base` | 16px / `1.0rem` | `1.5rem` (24px) | Normal | `400` / `500` | Mobile default inputs/buttons, main chat response text | [button.tsx:11](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/ui/button.tsx#L11), [input.tsx:36](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/ui/input.tsx#L36) |
| `text-lg` | 18px / `1.125rem` | `1.75rem` (28px) | Normal | `600` | Card header title (`CardTitle`), Markdown h2 headings, Button `xl` size | [card.tsx:110](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/ui/card.tsx#L110), [index.css:458](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L458) |
| `text-xl` | 20px / `1.25rem` | `1.75rem` (28px) | `tracking-tight` | `600` | Dialog popup title (`DialogTitle`), Markdown h1 headings | [dialog.tsx:130](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/ui/dialog.tsx#L130), [index.css:454](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L454) |
| `text-2xl` | 24px / `1.5rem` | `2rem` (32px) | `tracking-tight` | `700` | Main settings section headers, modal view titles | [_chat.settings.tsx:1506](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/routes/_chat.settings.tsx#L1506) |
| `text-3xl` | 30px / `1.875rem` | `2.25rem` (36px) | `tracking-tight` | `600` / `700` | Empty state main titles, primary dashboard headings | [_chat.index.tsx:27](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/routes/_chat.index.tsx#L27) |
| `text-4xl` | 36px / `2.25rem` | `2.5rem` (40px) | `tracking-tight` | `600` | Hero screen titles (desktop viewport) | [_chat.index.tsx:27](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/routes/_chat.index.tsx#L27) |

---

## 3. Core Component Patterns & Primitives

All UI primitives are located under [`tabs-main/apps/web/src/components/ui/`](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/ui/).

### 1. Button Primitive
- **Source**: [`tabs-main/apps/web/src/components/ui/button.tsx`](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/ui/button.tsx)
- **Base Style**: `inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border font-medium text-base sm:text-sm transition-shadow`
- **Variants**:
  - `default`: `border-primary bg-primary text-primary-foreground shadow-primary/24 shadow-xs hover:bg-primary/90`
  - `destructive`: `border-destructive bg-destructive text-white shadow-destructive/24 shadow-xs hover:bg-destructive/90`
  - `destructive-outline`: `border-input bg-popover text-destructive-foreground hover:border-destructive/32 hover:bg-destructive/4`
  - `outline`: `border-input bg-popover text-foreground shadow-xs/5 hover:bg-accent/50 dark:hover:bg-input/64`
  - `secondary`: `border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/90`
  - `ghost`: `border-transparent text-foreground hover:bg-accent`
  - `link`: `border-transparent underline-offset-4 hover:underline`
- **Sizing Conventions**:
  - `xs`: `h-7 sm:h-6 px-2 text-xs rounded-md`
  - `sm`: `h-8 sm:h-7 px-2.5 text-xs`
  - `default`: `h-9 sm:h-8 px-3 text-sm`
  - `lg`: `h-10 sm:h-9 px-3.5 text-sm`
  - `xl`: `h-11 sm:h-10 px-4 text-base`
  - `icon`: `size-9 sm:size-8`
  - `icon-xs`: `size-7 sm:size-6 rounded-md`

---

### 2. Input Control Primitive
- **Source**: [`tabs-main/apps/web/src/components/ui/input.tsx`](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/ui/input.tsx)
- **Wrapper Style**: `inline-flex w-full rounded-lg border border-input bg-background text-base sm:text-sm shadow-xs/5 transition-shadow`
- **Sizing Conventions**:
  - `sm`: Height `h-7.5 sm:h-6.5`, padding `px-2.5`
  - `default`: Height `h-8.5 sm:h-7.5`, padding `px-3`
  - `lg`: Height `h-9.5 sm:h-8.5`, padding `px-3`
- **States**:
  - Focus Ring: `has-focus-visible:ring-[3px] has-focus-visible:border-ring`
  - Disabled: `has-disabled:opacity-64`
  - Invalid: `has-aria-invalid:border-destructive/36 has-focus-visible:has-aria-invalid:ring-destructive/16`

---

### 3. Card Primitive
- **Source**: [`tabs-main/apps/web/src/components/ui/card.tsx`](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/ui/card.tsx)
- **Base Style**: `relative flex flex-col rounded-2xl border bg-card text-card-foreground shadow-xs/5`
- **Padding Convention**: `p-6` for `CardHeader`, `CardPanel`, `CardFooter`
- **CardFrame Variant**: `CardFrame` stacks multiple cards with shared inner borders using `[clip-path:inset(...)]` and `rounded-2xl` corners.

---

### 4. Navigation Tabs Primitive
- **Source**: [`tabs-main/apps/web/src/components/ui/tabs.tsx`](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/ui/tabs.tsx)
- **TabsList Container**: `inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground`
- **TabsTrigger Item**: `inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all`
- **Active State**: `bg-background text-foreground shadow-sm`
- **Hover State**: `hover:bg-muted/80 hover:text-foreground`

---

### 5. Dialog & Modal Popups
- **Source**: [`tabs-main/apps/web/src/components/ui/dialog.tsx`](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/ui/dialog.tsx)
- **Backdrop**: `fixed inset-0 z-50 bg-black/45 backdrop-blur-[8px]`
- **Popup Container**: `max-w-lg rounded-2xl border bg-popover backdrop-blur-3xl text-popover-foreground shadow-lg/5`
- **Header & Panel Padding**: `p-6`
- **Footer**: `border-t bg-muted/72 py-4 px-6 sm:flex-row sm:justify-end`

---

### 6. Master-Detail Layout Primitive
- **Source**: [`tabs-main/apps/web/src/components/ui/master-detail.tsx`](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/ui/master-detail.tsx)
- **MasterDetail Root**: `flex flex-1 min-h-0 min-w-0 gap-6`
- **MasterDetailSidebar**: `flex w-56 shrink-0 flex-col gap-3 border-r border-border/70 pr-6`
- **MasterDetailContent**: `flex-1 min-w-0 -my-2 py-2 pr-4`
- **MasterDetailItem**: Active item uses `variant="secondary"`, inactive uses `variant="ghost"` with drag handle `GripVerticalIcon` on hover.

---

### Icon System & Sizes

- **Primary Icon Library**: [`lucide-react`](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/package.json#L39) (v0.564.0)
- **IDE File Icons Library**: [`@vscode/codicons`](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/package.json#L33) (v0.0.36)

#### Standard Icon Sizes
| Size Token | Dimensions (px) | Usage Context | Citation |
| :--- | :--- | :--- | :--- |
| `size-3` | 12px × 12px | Micro badges, inline drag controls | [master-detail.tsx:130](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/ui/master-detail.tsx#L130) |
| `size-3.5` | 14px × 14px | Small button icons (`icon-xs`), list grip icons | [button.tsx:26](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/ui/button.tsx#L26) |
| `size-4` | 16px × 16px | Standard UI button icons, dropdown menu items | [button.tsx:11](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/ui/button.tsx#L11) |
| `size-4.5` | 18px × 18px | Mobile button icons, large menu items | [button.tsx:11](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/ui/button.tsx#L11) |
| `size-5` | 20px × 20px | Header action icons, XL button icons | [button.tsx:24](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/ui/button.tsx#L24) |

---

## 4. Layout Conventions & Framework Structure

### Responsive Breakpoints

Tailwind CSS v4 standard responsive breakpoints are used throughout the layout:

| Breakpoint | Minimum Width | Typical Screen Target |
| :--- | :--- | :--- |
| `sm` | `40rem` (640px) | Mobile landscape / Small tablets |
| `md` | `48rem` (768px) | Tablets / Sidebar brand visibility threshold |
| `lg` | `64rem` (1024px) | Laptops / Desktop split view |
| `xl` | `80rem` (1280px) | Large Desktop viewports |

---

### Structural Dimensions & Heights

Defined in [`tabs-main/apps/web/src/index.css`](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L7-L16) and [`sidebar.tsx`](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/ui/sidebar.tsx#L26-L29):

| Shell Region | Height / Width Dimension | CSS Property / Variable | File & Line Citation |
| :--- | :--- | :--- | :--- |
| **Top Titlebar / Header** | `52px` | `--workspace-topbar-height` | [index.css:9](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L9) |
| **Subheader / Surface Bar** | `2.5rem` (40px) | `.surface-subheader` (`h-10`) | [index.css:146](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L146) |
| **Primary Navigation Sidebar** | `16rem` (256px) | `SIDEBAR_WIDTH` / `--sidebar-width` | [sidebar.tsx:26](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/ui/sidebar.tsx#L26) |
| **Collapsed Icon Sidebar** | `3rem` (48px) | `SIDEBAR_WIDTH_ICON` | [sidebar.tsx:28](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/ui/sidebar.tsx#L28) |
| **Sidebar Minimum Resize Width** | `256px` | `SIDEBAR_RESIZE_DEFAULT_MIN_WIDTH` | [sidebar.tsx:29](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/ui/sidebar.tsx#L29) |
| **Mobile Drawer Sidebar** | `calc(100vw - 0.75rem)` | `SIDEBAR_WIDTH_MOBILE` | [sidebar.tsx:27](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/ui/sidebar.tsx#L27) |
| **App Custom Scrollbar Width** | `6px` | `--app-scrollbar-width` | [index.css:8](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L8) |
| **Titlebar Control Button Size** | `1.75rem` (28px) | `--workspace-titlebar-control-size` | [index.css:14](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/index.css#L14) |
| **Settings Slide-over Drawer** | `40rem` (640px) | `max-w-[40rem]` | [WorkspaceShell.tsx:4493](file:///Users/rushil.dev/Desktop/Tabs-ide-cleanup-vscode-web-2026-04-28/tabs-main/apps/web/src/components/WorkspaceShell.tsx#L4493) |

---

### Window Controls & Safe-Area Padding

For frameless desktop (Electron Window Controls Overlay) and mobile safe area insets:

```css
/* index.css lines 10-15 */
--workspace-controls-top: 0px;
--workspace-controls-left: calc(env(safe-area-inset-left) + 0.75rem);
--workspace-controls-right: calc(env(safe-area-inset-right) + 0.75rem);
--workspace-titlebar-control-size: 1.75rem;
--workspace-titlebar-control-gap: 0.75rem;

/* Chat composer horizontal padding (index.css lines 150-152) */
.chat-composer-horizontal-inset {
  padding-inline-start: calc(env(safe-area-inset-left) + 0.75rem);
  padding-inline-end: calc(env(safe-area-inset-right) + 0.75rem);
}
@media (min-width: 40rem) {
  .chat-composer-horizontal-inset {
    padding-inline-start: calc(env(safe-area-inset-left) + 1.25rem);
    padding-inline-end: calc(env(safe-area-inset-right) + 1.25rem);
  }
}
```
