# Design System Document

## 1. Overview & Creative North Star: "The Financial Architect"
This design system moves away from the generic "SaaS dashboard" aesthetic to embrace an editorial, high-end professional atmosphere. The North Star for this system is **"The Financial Architect."** 

The interface should feel like a bespoke physical workspace—precise, structured, and premium. We achieve this by moving away from rigid lines and "box-in-box" layouts, instead using **Tonal Depth** and **Intentional Asymmetry**. The goal is to make dense Moroccan insurance data (contracts, renewals, and claims) feel breathable and authoritative rather than overwhelming. 

Instead of a flat grid, we use a "layered paper" approach, where information is grouped by subtle shifts in surface luminosity, mimicking the way a professional organizes high-stakes documents on a clean desk.

---

## 2. Color & Surface Philosophy
The palette is rooted in a deep, authoritative blue, balanced by a sophisticated spectrum of functional accents.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to section off major areas of the application. High-end UI is defined by its silhouette, not its outlines. 
- Boundaries must be defined by shifts between `surface-container` levels.
- Example: A sidebar using `surface-container-low` should sit directly against a main content area using `surface`, separated only by the color change.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Use the following tiers to create depth:
- **Base Layer:** `surface` (#f8f9ff) for the main application background.
- **Structural Layer:** `surface-container-low` (#eff4ff) for sidebars or secondary navigation.
- **Active Layer:** `surface-container-lowest` (#ffffff) for primary data cards and input forms to make them "pop" against the background.
- **Top Layer:** `surface-container-highest` (#d3e4fe) for active states or highlighted rows in data-dense tables.

### The "Glass & Gradient" Rule
To inject "soul" into the corporate environment:
- **CTAs:** Use a subtle linear gradient for primary buttons, transitioning from `primary` (#004ac6) to `primary_container` (#2563eb) at a 135-degree angle.
- **Floating Elements:** Modals and dropdowns must use a "Glassmorphism" effect: `surface_container_lowest` at 85% opacity with a `20px` backdrop-blur.

---

## 3. Typography: Editorial Authority
We utilize **Inter** for its neutral, modernist clarity, paired with high-contrast sizing to create an editorial hierarchy.

- **Display & Headlines:** Used for "Grand Totals" (Chiffre d’affaires) and Page Titles. Large tracking (letter-spacing: -0.02em) should be applied to `headline-lg` to create a compact, premium look.
- **Financial Monospace:** All MAD currency values and policy numbers must use a tabular-nums font setting (or a high-quality monospace variant) to ensure vertical alignment in tables.
- **Labels:** `label-sm` and `label-md` should be used sparingly for metadata, often in all-caps with increased letter-spacing (+0.05em) to differentiate them from body text.

**Locale Formatting:**
- Currency: `12 345,00 MAD` (Narrow non-breaking space as thousands separator, comma for decimals).
- Dates: `DD/MM/YYYY` (Standard French Moroccan format).

---

## 4. Elevation & Depth
We eschew traditional drop shadows in favor of **Tonal Layering**.

- **The Layering Principle:** Depth is achieved by "stacking." A `surface-container-lowest` card placed on a `surface-container-low` background creates a natural, soft lift without visual clutter.
- **Ambient Shadows:** Only use shadows for "floating" components (Modals, Tooltips). Use a large blur (32px) at 6% opacity, tinted with the `on_surface` color (#0b1c30). This mimics natural ambient occlusion rather than a "drop shadow."
- **The "Ghost Border":** For internal elements like table rows or input fields where a boundary is functional, use the `outline_variant` token at **15% opacity**. Never use a 100% opaque border.

---

## 5. Components
All components follow the `rounded-xl` (1rem) corner radius to soften the corporate density.

### Cards & Lists
**Strict Rule:** No horizontal dividers between list items. 
- Use vertical white space (8px–12px) or a 1-step shift in `surface-container` tiers to separate content. 
- For "Assuré" lists, use a `surface-container-low` background on hover to indicate interactivity.

### Buttons
- **Primary:** Gradient-fill (Primary to Primary-Container), `rounded-lg`, with a subtle `primary_fixed` inner-glow.
- **Secondary:** Transparent background with a "Ghost Border" (outline-variant at 20%).
- **Tertiary:** No background; use `primary` text weight 600.

### Input Fields
- Background: `surface_container_highest` at low opacity.
- Border: "Ghost Border" on resting, `primary` 2px stroke on focus.
- Micro-copy: French helper text (e.g., "Format: 06 12 34 56 78") in `label-sm`.

### Status Badges (The Semantic Trio)
- **Validated (Validé):** `secondary_container` background with `on_secondary_container` text.
- **Pending (En attente):** `tertiary_container` (Amber) background with `on_tertiary_fixed`.
- **Urgent/Late (Retard):** `error_container` background with `on_error_container` text.

---

## 6. Do’s and Don’ts

### Do
- **Do** prioritize the sidebar layout: A wide, collapsible sidebar (`surface-container-low`) that feels like a permanent architectural fixture.
- **Do** use `MAD` as a suffix for all financial data to maintain Moroccan context.
- **Do** use asymmetry in the dashboard: e.g., a 2/3 width main chart paired with a 1/3 width "Recent Activities" feed to break the "template" feel.

### Don't
- **Don’t** use black (#000000) for text. Always use `on_surface` (#0b1c30) for better tonal harmony.
- **Don’t** use "Card-in-Card" layouts with borders. If you need a nested container, change the background color instead.
- **Don’t** use standard 400 weight for body text in data-heavy tables; use 500 (Medium) for better legibility against blue-tinted backgrounds.

---

## 7. Layout Focus: The Desktop Experience
The app is designed for Electron. The **Top Bar** should be treated as a "Glass" element (backdrop-blur) that sits above the content. The **Collapsible Sidebar** should use a vertical "Signature Line"—a single, 2px wide `primary` vertical bar—to indicate the active navigation section, rather than a full-box highlight. This maintains the "Financial Architect" aesthetic of precision and restraint.