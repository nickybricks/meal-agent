# Design System Strategy: The Radiant Hearth

## 1. Overview & Creative North Star
**Creative North Star: "The Culinary Playground"**

This design system moves away from the sterile, rigid grids of traditional utility apps and toward a high-energy, editorial experience. We are building a "Culinary Playground"—a space that feels as tactile and inviting as a well-loved kitchen. 

To achieve this, we reject "default" web aesthetics. Instead of 1px lines and sharp corners, we use **Hyper-Organic Geometry** and **Tonal Depth**. The UI should feel like a series of soft, layered ceramic plates. We break the "template" look through intentional asymmetry, overlapping food photography that "breaks" container bounds, and a typography scale that favors bold, expressive display sizes to guide the user’s appetite and intuition.

---

## 2. Colors: Appetizing & Ambient
Our palette is rooted in the "Fresh to Table" philosophy. Greens represent vitality, oranges represent heat and flavor, and our neutrals mimic the soft tones of parchment and flour.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning or containment. Boundaries must be defined solely through background color shifts.
*   **Example:** A recipe card (`surface-container-lowest`) should sit on a `surface-container-low` section. The contrast is felt, not seen as a line.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of materials. 
*   **Base:** `surface` (#fefdf1) is your canvas.
*   **Sections:** Use `surface-container-low` to define large content areas.
*   **Interactive Cards:** Use `surface-container-lowest` (#ffffff) to provide a "lifted" look.
*   **Nesting:** When nesting a search bar inside a header, move from `surface-container-high` to `surface-bright`.

### Signature Textures & Glassmorphism
To create a high-energy, modern feel:
*   **The Signature Gradient:** Use a subtle linear gradient from `primary` (#297300) to `primary_container` (#99f070) at a 135-degree angle for hero buttons and "Recipe of the Day" banners. This adds a "glow" that flat hex codes lack.
*   **Frosted Glass:** Floating navigation bars or modal overlays must use semi-transparent `surface` colors (80% opacity) with a `backdrop-filter: blur(20px)`. This keeps the UI feeling "airy" and connected to the content beneath.

---

## 3. Typography: The Approachable Authority
We use **Plus Jakarta Sans** across the entire system. Its modern, rounded terminals perfectly complement our heavy-radius containers.

*   **Expressive Displays:** Use `display-lg` (3.5rem) for hero greetings (e.g., "Good morning, Chef."). These should have a tight letter-spacing (-0.02em) to feel high-end and editorial.
*   **Directional Headlines:** `headline-md` (1.75rem) is used for category titles. It provides authority without being aggressive.
*   **Clean Utility:** `body-lg` (1rem) is the workhorse for ingredients and instructions. Ensure a generous line-height (1.6) to maintain the "airy" feel.
*   **Hierarchy via Tone:** Never use pure black for text. Use `on_surface` (#373830) for primary reading and `on_surface_variant` (#64655c) for secondary metadata (like prep time or calorie counts).

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are too "software-like" for this system. We mimic natural ambient light.

*   **The Layering Principle:** Avoid shadows for static elements. Use color nesting (e.g., a `surface_container_highest` element inside a `surface_container` area) to create a soft, natural sense of depth.
*   **Ambient Shadows:** When a card requires a "floating" state (like a dragged ingredient), use a massive blur (40px+) at a very low opacity (6%). The shadow color must be a tint of `on_surface` (#373830), never pure black, to ensure it feels like a soft shadow on a kitchen counter.
*   **The "Ghost Border":** If accessibility requires a stroke (e.g., high-contrast mode), use a "Ghost Border": `outline_variant` (#babaaf) at 15% opacity. This defines the edge without interrupting the visual flow.

---

## 5. Components

### The Signature Radius
Every container, card, and button must adhere to the **Roundedness Scale**.
*   **Cards/Containers:** Use `lg` (2rem/32px) or `xl` (3rem/48px).
*   **Buttons:** Must be `full` (9999px) for a pill-shaped, friendly look.

### Buttons
*   **Primary:** `primary` background with `on_primary` text. High-energy, used for "Start Cooking."
*   **Secondary:** `secondary_container` background with `on_secondary_container` text. Perfect for "Add to Cart."
*   **Tertiary:** No background. Use `tertiary` (#845d00) bold text.

### Interactive "Taste" Chips
*   **Filter Chips:** Use `surface_container_high` with a radius of `full`. When selected, transition to `secondary` with a haptic-like scale animation (scale 0.95 on click).

### Input Fields
*   **Text Inputs:** Background `surface_container_highest`. No border. The focus state is a 2px `primary` "Ghost Border" (20% opacity) and a slight background shift to `surface_bright`.

### Cards & Lists (No-Divider Rule)
*   **Forbid Dividers:** Horizontal lines are banned. To separate recipe steps or list items, use vertical whitespace (1.5rem+) or alternate background shades between `surface_container_low` and `surface_container_lowest`.

### Signature Component: The "Ingredient Bubble"
A specialized chip for meal agents. Use a `surface_container_lowest` background, `xl` (3rem) radius, and an accompanying high-quality ingredient icon that overlaps the top-left corner by 8px.

---

## 6. Do’s and Don’ts

### Do:
*   **Use Asymmetry:** Place images slightly off-center or overlapping the edge of their containers to create a "scrapbook" editorial feel.
*   **Prioritize Air:** Use the Spacing Scale generously. If it feels "spaced out," add 8px more.
*   **Color as Information:** Use `primary` (Green) for success/healthy choices and `secondary` (Orange) for heat/warnings/prompts.

### Don’t:
*   **Don't use 1px lines:** Even for table data, use tonal rows instead of grid lines.
*   **Don't crowd the plate:** Avoid dense clusters of information. If a screen feels busy, move secondary information into a "Ghost Border" modal or a secondary tab.
*   **Don't use "Default" Shadows:** Avoid the CSS `box-shadow: 0 2px 4px rgba(0,0,0,0.5)`. It is the enemy of this system's airy nature.