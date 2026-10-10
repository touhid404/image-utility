# Image Utility — image workbench

The workspace is the product: a quiet canvas, a precise control rail, and visible format choices. No marketing cards, decorative gradients, stock photography, testimonials, or scroll effects.

## Direction and sources

The first white/blue rounded upload card was rejected as too common. The revision uses an editorial type hierarchy, crop-corner geometry, ruled sections, muted mineral surfaces, and a single burnt-orange accent. The preview remains central.

Applied UI/UX Pro Max guidance: Minimalism & Swiss Style, native keyboard alternatives to dragging, controlled React fields, explicit async feedback. Applied Taste guidance: self-hosted type, one accent, deliberate spacing, complete interaction states, restrained motion. Its marketing-page instructions are not imposed on product controls.

## Layout and tokens

- 1260px maximum shell; 36px desktop / 20px phone gutters.
- 64px two-line display heading, 58px empty-canvas prompt, compact 10–16px tool labels. Geist 400/500/600/700 is self-hosted. Tabular dimensions and file sizes.
- Canvas + 350px control rail; stack below 768px. Outer workspace has a 2px ink top rule. Controls have 3px radii.
- Light: #efeee9 canvas, #faf9f6 surface, #e8e7e1 preview stage, #292923 ink, #66665d secondary, #b74119 accent.
- Dark: #191a17 canvas, #22231f surface, #2b2d27 preview stage, #f0f0e9 ink, #b3b4a7 secondary, #f5a67c accent with dark button text.
- Red for errors only, with readable text and icons. 3px visible focus rings. Reduced-motion preference respected.

## Interaction

- Nine formats exposed as native radio tiles, with brief use labels and a contextual explanation.
- File picker, drag/drop, clipboard paste, and a sample image. One primary action per state: Choose images → Convert → Download.
- Relevant settings appear progressively: resize dimensions, crop/fit/stretch, applicable quality, transparency/background.
- Crop sliders are per image and work by keyboard/touch. Shared settings invalidate old exports. File list retains individual previews and errors.
- Sequential cancellable workers. Finished results survive cancellation and partial failures. Radix help dialogs support focus management and Escape.
- Footer contains practical format help and codec licenses, with no filler section.

## Verification

Visually inspected desktop, loaded crop state, and 375px phone. Axe checks passed for light/dark/mobile with no horizontal overflow. Codec matrix, crop pixels, invalid dimensions, cancellation, batch ZIP, animated/multipage notices, limits, and absence of image-upload requests are tested separately.
