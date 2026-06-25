# Change Connected Brand Style Guide

## Color Palette

### Primary Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Deep Navy | `#0a1929` | Primary background |
| Lime Green | `#c5f82a` | Accent headings, CTAs |
| White | `#ffffff` | Body text, icons |

### Secondary Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Teal/Cyan | `#00bcd4` | Logo gradient start |
| Blue | `#2196f3` | Logo gradient end |
| Light Gray | `#9ca3af` | Secondary text, footer |

### Gradient

- **Logo Gradient**: Linear from green (`#7ed321`) through teal (`#00bcd4`) to blue (`#2196f3`)
- Direction: Diagonal, top-left to bottom-right

---

## Typography

### Headings

- **Font**: Bold Italic display font (suggest: Oswald Bold Italic or similar condensed sans-serif)
- **Color**: Lime Green (`#c5f82a`)
- **Style**: Italic, bold weight
- **Examples**: "Our Purpose", "Our Partnership Approach", "Connect With Us"

### Body Text

- **Font**: Clean sans-serif (suggest: Inter, Open Sans, or system sans-serif)
- **Color**: White (`#ffffff`)
- **Weight**: Regular (400)
- **Line Height**: 1.6 for readability

### Navigation

- **Style**: Uppercase
- **Letter Spacing**: Slightly expanded
- **Color**: White
- **Weight**: Medium (500)

---

## Logo

- **Symbol**: Abstract interlocking "X" or infinity loop
- **Colors**: Green-to-blue gradient
- **Text**: "CHANGE CONNECTED" in white, stacked two lines
- **Clear Space**: Maintain padding equal to the height of the "C" in CHANGE

---

## UI Components

### Buttons

- **Primary Style**: Outlined/bordered (not solid fill)
- **Border**: White or lime green, 1-2px
- **Text**: Uppercase, letter-spaced
- **Hover**: Consider subtle fill or glow effect

### Section Dividers

- **Style**: Short horizontal line under section headings
- **Color**: Teal/cyan accent
- **Width**: ~60-80px centered

### Cards/Containers

- **Background**: Slightly lighter navy or semi-transparent overlay
- **Border Radius**: Subtle rounding (4-8px)

---

## Imagery Style

### Photography

- **Theme**: Connection, collaboration, puzzle pieces fitting together
- **Treatment**: Dark overlay (~60-70% opacity navy) for text legibility
- **Subjects**: Hands working together, network/connection visuals

### Icons

- **Style**: Simple line icons or filled with white
- **Social**: Circular container with white fill, dark icon

---

## Spacing & Layout

- **Max Content Width**: ~1200px centered
- **Section Padding**: Generous vertical padding (80-120px)
- **Text Width**: Body text max ~700px for readability

---

## Brand Voice

- **Tone**: Professional, confident, partnership-focused
- **Keywords**: Connect, talent, change, deliver, transform
- **Tagline**: "Connecting great talent, delivering great change"

---

## Footer

- **Background**: Same deep navy as site
- **Elements**: Company name, email, LinkedIn icon, copyright
- **Company Number**: 16401015

---

## Quick Reference

```css
:root {
  --color-bg-primary: #0a1929;
  --color-accent: #c5f82a;
  --color-text-primary: #ffffff;
  --color-text-secondary: #9ca3af;
  --color-gradient-start: #7ed321;
  --color-gradient-mid: #00bcd4;
  --color-gradient-end: #2196f3;

  --font-heading: 'Oswald', sans-serif;
  --font-body: 'Inter', sans-serif;

  --spacing-section: 100px;
  --max-content-width: 1200px;
  --border-radius: 6px;
}
```
