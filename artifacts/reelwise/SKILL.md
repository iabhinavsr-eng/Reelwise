# Reelwise Design System

Reelwise is a mobile teleprompter and video-recording app for creators who want
to deliver social videos naturally while following a script. The source reference
is a mobile onboarding flow supplied as HTML; its visual language is the basis for
this system. The retained source is in `docs/references/`.

## What's here

- `tokens.json` is the single source of truth for both light and dark themes.
- `src/components/ui/` contains the themed reusable component library.
- `src/preview/` is the living style guide and its component stories.
- `docs/references/` retains the onboarding reference and its provenance.
- `docs/AGENTS.md` describes package structure and consumption.

## Visual and composition guidance

- Use near-black ink for the primary action. Reserve Reelwise green for progress,
  focus, selected states, and concise emphasis.
- Use the soft mint surface for helpful context and suggested content; keep it
  distinct from a primary action.
- Preserve the mobile-first type hierarchy: a compact uppercase step label, a
  clear headline, and short supporting copy.
- Keep forms and cards comfortably rounded, borders quiet, and the active task
  visually obvious.
- Make onboarding language reassuring and direct. Explain a setting before
  asking the creator to choose it.
- Motion should be brief and state-driven. Loading feedback must explain what is
  happening; avoid movement near the active script while someone is speaking.

## Typography note

The source uses the operating system's native font stack. No font file was
provided, so the web style guide uses Inter as a portable stand-in; native
consumers should prefer their platform's system font.

## Source and scope

The supplied HTML is an app-UI reference, not a reusable component library.
Accordingly, this package keeps the themed stock component families and records
the source-derived visual guidance. Its dark theme is derived because the
reference only provides a light interface.