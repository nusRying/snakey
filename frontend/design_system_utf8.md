## Design System: Snakey.io

### Pattern

- **Name:** Horizontal Scroll Journey
- **Conversion Focus:** Immersive product discovery. High engagement. Keep navigation visible.
  28,Bento Grid Showcase,bento, grid, features, modular, apple-style, showcase", 1. Hero, 2. Bento Grid (Key Features), 3. Detail Cards, 4. Tech Specs, 5. CTA, Floating Action Button or Bottom of Grid, Card backgrounds: #F5F5F7 or Glass. Icons: Vibrant brand colors. Text: Dark., Hover card scale (1.02), video inside cards, tilt effect, staggered reveal, Scannable value props. High information density without clutter. Mobile stack.
  29,Interactive 3D Configurator,3d, configurator, customizer, interactive, product", 1. Hero (Configurator), 2. Feature Highlight (synced), 3. Price/Specs, 4. Purchase, Inside Configurator UI + Sticky Bottom Bar, Neutral studio background. Product: Realistic materials. UI: Minimal overlay., Real-time rendering, material swap animation, camera rotate/zoom, light reflection, Increases ownership feeling. 360 view reduces return rates. Direct add-to-cart.
  30,AI-Driven Dynamic Landing,ai, dynamic, personalized, adaptive, generative", 1. Prompt/Input Hero, 2. Generated Result Preview, 3. How it Works, 4. Value Prop, Input Field (Hero) + 'Try it' Buttons, Adaptive to user input. Dark mode for compute feel. Neon accents., Typing text effects, shimmering generation loaders, morphing layouts, Immediate value demonstration. 'Show, don't tell'. Low friction start.
- **CTA Placement:** Floating Sticky CTA or End of Horizontal Track
- **Color Strategy:** Continuous palette transition. Chapter colors. Progress bar #000000.
- **Sections:** 1. Intro (Vertical), 2. The Journey (Horizontal Track), 3. Detail Reveal, 4. Vertical Footer

### Style

- **Name:** Cyberpunk UI
- **Keywords:** Neon, dark mode, terminal, HUD, sci-fi, glitch, dystopian, futuristic, matrix, tech noir
- **Best For:** Gaming platforms, tech products, crypto apps, sci-fi applications, developer tools, entertainment
- **Performance:** ΓÜá Moderate | **Accessibility:** ΓÜá Limited (dark+neon)

### Colors

| Role       | Hex     |
| ---------- | ------- |
| Primary    | #7C3AED |
| Secondary  | #A78BFA |
| CTA        | #F43F5E |
| Background | #0F0F23 |
| Text       | #E2E8F0 |

_Notes: Neon purple + rose action_

### Typography

- **Heading:** Inter
- **Body:** Inter
- **Mood:** spatial, legible, glass, system, clean, neutral
- **Best For:** Spatial computing, AR/VR, glassmorphism interfaces
- **Google Fonts:** https://fonts.google.com/share?selection.family=Inter:wght@300;400;500;600
- **CSS Import:**

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
```

### Key Effects

Neon glow (text-shadow), glitch animations (skew/offset), scanlines (::before overlay), terminal fonts

### Avoid (Anti-patterns)

- Light mode default
- No transaction status

### Pre-Delivery Checklist

- [ ] No emojis as icons (use SVG: Heroicons/Lucide)
- [ ] cursor-pointer on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard nav
- [ ] prefers-reduced-motion respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
