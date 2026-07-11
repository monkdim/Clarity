# KyanOS — the new identity, and the plan to get there

**Decision (July 2026):** the language keeps its name — **Clarity**. The operating system is rebranded from ClarityOS to **KyanOS**. The story: *KyanOS — built in Clarity.* (Same shape as macOS/Swift: the platform and the language each get a name that fits.)

The spring/Meadow identity is retired. This document is the spec for the new identity and the sequencing plan for shipping it, informed by the renderer constraints documented in [AUDIT.md](AUDIT.md) §3.11.

---

## 1. The identity

**Name.** *Kyan* — from **kyanite**, a deep-blue crystal — and an echo of *cyan*, the color the brand resolves to. Coined enough to own, short enough to type.

**Concept.** *Obsidian & neon.* Dark volcanic glass as the material; a single signature light — the spectrum — refracting across it. Premium dev/gamer energy: sharp, fast, tactile. Not synthwave, not cyberpunk-kitsch; restraint is what makes the neon land.

**Signature gradient.** Violet → cyan. One gradient, everywhere it matters and nowhere else: the logo's lit edge, the boot progress bar, focus rings, selection highlights, hero moments. Everything around it stays quiet.

**Logo.** A geometric monogram: the letter **K** cut like a gem facet — angular shards, flat fills, with exactly one edge lit by the signature gradient. Scales from 16 px favicon to boot splash. Wordmark: the name set in the UI grotesk, single weight, tight tracking.

**Modes.** One identity, two adaptive modes — **Obsidian** (dark) and **Quartz** (light) — equally designed, switchable by user choice or time of day. No theme zoo diluting the brand; the existing theme-protocol stays as the implementation mechanism (two registered themes + accent-hue preference).

**Wallpapers** (all procedurally drawable): *deep-space mineral* (macro crystal facets catching the gradient edge), *aurora light fields* (soft neon ribbons on near-black / on pale grey for Quartz), *geometric grids* (fine perspective lines fading to the horizon).

**Hero app.** **Prism** — the game hub. Library, launcher, and (long-term) the front door for the Clarity game engine: games you play and games you build, in one place. Pinned to the dock by default. Prism is also the brand's story made literal: the dark OS refracting light into play.

### Design tokens (v1)

| Token | Obsidian (dark) | Quartz (light) |
|---|---|---|
| `bg` | `#05060A` | `#F4F6FB` |
| `surface` | `#0D111A` | `#FFFFFF` |
| `surface-raised` | `#151B29` | `#FFFFFF` (elevated shadow) |
| `hairline` | `#242D42` | `#E2E7F2` |
| `text` | `#E9EDF6` | `#0C1018` |
| `text-muted` | `#8C96AC` | `#5B6478` |
| `accent` (solid) | `#2AD8F0` | `#0891B2` |
| `accent-violet` | `#8B5CF6` | `#7C3AED` |
| `signature` | `linear #7C3AED → #4F46E5 → #22D3EE` | same |
| `success / warn / danger` | `#34D399 / #FBBF24 / #FB7185` | darkened equivalents |

- **Type:** grotesk + mono duo. UI: an Inter/Geist-class grotesk. Code & terminal: a JetBrains-class mono. Ramp: 11 / 13 / 15 / 18 / 22 / 28 / 40, weights 400/500/650.
- **Radii:** windows 12 px, controls 8 px, pills full. **Borders:** 1 px hairline on every surface (the dark theme's depth comes from hairlines + tinted glow, not heavy shadows).
- **Motion:** 150–220 ms ease-out for UI, one orchestrated moment at boot (facet monogram assembles, gradient sweeps the progress bar). Respect a reduced-motion setting from day one.

Interactive mockups of all of this (desktop, dock, Prism, terminal, launcher, boot splash, both modes) accompany this doc as an HTML preview page.

---

## 2. Renderer prerequisites (the honest part)

Per the audit, the current renderer cannot draw this identity — or the *old* one, whose frosted-glass tokens were already aspirational. Before re-theming, the pipeline needs:

1. **Alpha blending** in `fill_rect`/`blit` (FFI fast path) — unlocks shadows, glass, glow, AA.
2. **A gradient primitive** (linear, two-stop minimum) with an FFI fast path — the signature is a gradient; it can't be a per-pixel Clarity loop.
3. **A real text stack**: multi-size font rendering (scalable bitmap strikes at the ramp sizes as step one; proper rasterization later), correct `measure_text`.
4. **Anti-aliased rounded rects** (or alpha-composited corner masks).
5. **The desktop actually composing**: one window model shared by DesktopSession and the Compositor, DisplayServer→WM input wiring, and blit-out to the screen buffer (all itemized in AUDIT.md §3).

Item 5 plus a hosted display backend (an SDL/minifb-style window via the existing FFI) yields **`clarity desktop`: the full KyanOS session running in a window on macOS, Linux, and Windows** — the demoable, distributable form of the OS that doesn't wait for the kernel. The QEMU/bare-metal track continues in parallel (see AUDIT.md priority ladder P3).

---

## 3. Rollout phases

**Phase K1 — Identity & site.**
- Land tokens as `theme_kyan.clarity` (obsidian + quartz) in the theme registry; retire meadow/bloom/watercolor/aurora to an archive module.
- New monogram/wordmark in `branding` (single module — fold `branding_modern` in); boot splash redesigned around the facet-assembly moment.
- Website regenerated with the new identity; deploy to GitHub Pages now (`monkdim.github.io/Clarity`), real domain after the name settles. Strip `clarityos.dev` from `website_gen` and `test_polish`.
- Docs sweep: KyanOS naming, one consistent story (paired with AUDIT.md P0 doc fixes).

**Phase K2 — Renderer.** Alpha, gradients, text ramp, AA (§2, items 1–4). Each lands with tests + a visual golden-image harness (render → BMP → hash) so the design system stays pixel-stable in CI.

**Phase K3 — The composed desktop.** One window model, input wiring, screen blit-out, window chrome actually drawn, `clarity desktop` hosted mode. First real screenshots replace the unverifiable ones.

**Phase K4 — Re-skin everything.** Widgets, dock, launcher, statusbar, settings, and the eleven apps on the new tokens; Prism v1 ships as app #12 (library UI first; engine hooks later).

**Phase K5 — Prism grows teeth.** A 2D game engine in the stdlib (sprite batching, input map, audio mixing, fixed-timestep loop) + one polished first-party game as the showcase and tutorial.

---

## 4. Strategy decisions recorded (July 2026)

- **Distribution: both tracks.** Track A (near): `clarity desktop` hosted session + a packaged VM app for Mac/PC. Track B (long): the real kernel/ISO path, made honest by CI (kernel must compile, ISO must boot headless QEMU) before any claims.
- **Self-hosting endgame: maximum.** Native Clarity VM replaces QuickJS as the OS runtime bet (the freestanding-QuickJS approach is judged a dead end in AUDIT.md §4.9); native compilation (Clarity → C/LLVM) is the v2.0 goal.
- **Audience:** gamers, devs, tinkerers, learners — in that tone. The gamer thread is real: aesthetic now (KyanOS identity), game *dev* next (Prism + engine), games-on-KyanOS as the long arc.
- **Theming:** one identity, adaptive modes, user accent-hue — community themes remain possible via the existing protocol but aren't a launch surface.
