# 🫧 A Bubble That Doesn’t Want to Be Popped

An interactive, high-performance web application featuring a deformable soft-body soap bubble with physics, personality, and procedural audio.

---

## 🌟 Overview & Concept

Unlike static image-based web games, **A Bubble That Doesn’t Want to Be Popped** models a soft-body liquid membrane that deforms dynamically in response to your touch and mouse gestures:
- **Drag & Carry**: Pick up the bubble and move it around with natural fluid momentum.
- **Stretch & Pull**: Grab near an edge and drag outward to deform the bubble into elastic, oblong, or teardrop shapes.
- **Edge Squashing**: Fling or push the bubble against the screen edges — it flattens and bulges outward against the walls preserving volume!
- **Poke & Wobble**: Rapidly tap or click to indent the membrane and watch harmonic ripple waves race around the surface.
- **Repeated Poking**: Agitate the bubble to spawn floating miniature baby bubbles that you can pop individually.
- **The Big Pop & Rebirth**: Push the strain too far or poke it repeatedly until the stress limit is exceeded, triggering an explosive burst of shimmering droplets, shockwaves, and comic pop effects, followed by a dramatic inflation rebirth!
- **Expressive Personality**: The bubble has cute, animated eyes and mouth that look at your cursor, get worried when pulled, squint when strained, scream when panicking, and sigh with relief when calmed down!

---

## 🚀 Key Features

| Feature | Description |
| :--- | :--- |
| **Soft-Body Spring Mesh** | 48 radial vertices coupled with spring restitution, neighbor surface tension, and air volume conservation (squashing one side causes opposite sides to bulge). |
| **Edge Collision & Flattening** | Smooth contact clamping against screen borders with velocity boing rebound. |
| **Interactive Baby Bubbles** | Poking in rapid succession spawns floating baby bubbles with buoyancy physics and clickable pop reactions. |
| **Procedural Web Audio** | Zero audio files needed! Generates realistic liquid bloops, rubbery stretch creaks, wall bounces, and explosive pop blasts using the Web Audio API. |
| **Stress & Pop System** | Dynamic stress bar tracking strain, velocity impacts, and poke frequency. |
| **Play Modes** | • **Classic Play** (balanced physics & pop limits)<br>• **Dodge & Escape!** (bubble actively flees your cursor)<br>• **Zen Mode** (indestructible bubble for pure stress-relief stretching) |
| **Visual Themes** | 5 color themes: Soap Rainbow, Neon Cyber, Sunset Opal, Cosmic Astral, and Emerald Dew. |
| **Responsive & Cross-Device** | Full pointer events support (mouse, pen, and touch screens) with Retina/HiDPI display scaling. |

---

## 🎮 How to Interact

- **Move / Drag**: Click or touch inside the bubble body and drag.
- **Stretch / Pull**: Click near the outer edge of the bubble and drag outward.
- **Poke**: Quick tap or click on the bubble surface.
- **Pop Baby Bubbles**: Click or tap any floating baby bubble.
- **Shortcuts**:
  - `M`: Toggle Sound
  - `R`: Respawn / Reset bubble
  - `?`: Open Help / Tutorial modal
  - `Esc`: Close open modal

---

## 📁 Project Architecture

```
bubblee/
├── index.html          # Semantic HTML5 layout, HUD, modals, and canvas
├── css/
│   └── style.css       # Glassmorphism design system, responsive UI, animations
├── js/
│   ├── audio.js        # Procedural Web Audio API sound synthesizer
│   ├── particles.js    # Mini bubbles, splash droplets, shockwaves, ambient motes
│   ├── bubble.js       # Soft-body physics, spring mesh, volume conservation & face
│   └── app.js          # Game loop, pointer event dispatcher, and UI state
├── assets/
│   └── favicon.svg     # Vector favicon
└── README.md           # Documentation
```

---

## 🛠️ How to Run Locally

Because this application is built with standard HTML5, CSS3, and modern ES6 JavaScript with Canvas 2D and Web Audio, **no compilation or complex build tooling is required**.

### Option 1: Direct File Open
Double click `index.html` in your file explorer to open it directly in any modern browser (Chrome, Edge, Firefox, Safari).

### Option 2: Local HTTP Server (Recommended)
Using Python:
```bash
# In the project directory:
python -m http.server 8000
```
Then navigate to `http://localhost:8000` in your browser.

Or using Node:
```bash
npx serve .
```

---

## 🔬 Mathematical & Physics Implementation

1. **Radial Elastic Spring Law**:
   $$F_{\text{radial}} = -k_{\text{radial}} \cdot (r_i - R_0)$$
   Restores each perimeter vertex back to its equilibrium radius.

2. **Surface Tension Coupling**:
   $$F_{\text{tension}} = k_{\text{tension}} \cdot \left(\frac{r_{i-1} + r_{i+1}}{2} - r_i\right)$$
   Couples adjacent vertices to transmit harmonic capillary waves across the bubble.

3. **Shoelace Polygon Area & Volume Conservation**:
   $$A = \frac{1}{2} \left|\sum_{i=0}^{N-1} (x_i y_{i+1} - x_{i+1} y_i)\right|$$
   When squashed against an edge or indented, $A < A_0$, applying outward pressure:
   $$F_{\text{pressure}} = k_{\text{vol}} \cdot \frac{A_0 - A}{A_0} \cdot R_0$$
   This ensures realistic organic bulging when the bubble is squeezed.

