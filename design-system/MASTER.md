# Image Utility — desktop editor direction

The prior warm, editorial workbench was rejected for resembling the user's portfolio. This revision changes the information architecture, proportions, and visual identity, rather than just the accent color.

## Product structure

A thumbnail queue sits beside a dedicated preview canvas and export inspector. The introduction is a compact workspace title, not a large marketing headline. The task occupies most of the screen. Desktop uses three columns; tablet moves the queue into a horizontal strip; phone stacks the canvas and inspector while keeping batch navigation near the preview.

## Visual identity

- Cool, pale surfaces and an always-dark canvas create a clear working boundary around the image.
- Acid lime identifies the main action; dark ink keeps its text legible. An olive focus/selection tone provides accessible contrast on light surfaces.
- Geist is self-hosted. Display text is 22–26px; compact controls are 10–13px. Numeric values use tabular figures.
- The canvas has a subtle dot grid and image-boundary corner marks. Both support the editing context; there are no decorative marketing illustrations or feature cards.
- Main frame radius 12px; control radii 4–7px. Compact toolbars, clear separators, and consistent touch targets.
- Light: #edf0f5 outer surface, #ffffff panels, #242c3a ink, #5b6578 secondary, #daf362 accent, #526b24 selection/focus.
- Dark: #10151d outer surface, #19212d panels, #eef3fc ink, #a5b2c7 secondary. The preview remains #222c3c in both themes.

## Interaction and guidance

Retain the task-first Sites guidance and applicable Taste/UI/UX Pro Max principles: deliberate type and spacing, one accent, visible keyboard focus, restrained motion, native form semantics, progressive settings, clear errors, and complete interaction states. Landing-page marketing patterns do not apply to the editor.

All nine output formats remain visible as native radio tiles. Crop adjustment works through native keyboard/touch sliders. File actions are attached to each thumbnail. Changes to shared settings invalidate prior results. Sequential workers, cancellation, per-file errors, and ZIP downloads are unchanged.

The preview height stays stable when resize settings open or close. Desktop and tablet constrain the workspace height, scroll the image queue and export settings independently, and keep export actions visible. Phone uses a fixed-height preview above the settings. The image scales into the available canvas space so crop controls remain visible.

## Verification

Visually inspected empty, loaded/crop, completed, light/dark, and 375px phone states. Axe checks passed in all five states, with no horizontal overflow on phone. Production smoke checks downloaded all nine outputs and re-imported each at 200 × 200. Individual crop positions, duplicate-safe batch ZIP names, invalid dimensions, and dialog Escape behavior passed. No JavaScript errors or image-upload requests were observed.

The codec worker implementation is unchanged. This update remains local for the user's later VPS deployment. The README contains a product overview and current workspace screenshot; installation steps and codec implementation details were removed.

Theme selection is remembered separately from image data and applied before the first render. Reload checks passed for saved light/dark modes with the opposite system preference, invalid preferences, and unavailable browser storage. Selected images are still cleared on reload.

Resize layout checks passed at 1440px, 1024px, 800px, and 375px: the middle panel retained its height through resize toggles, dimension changes, and original/output switching. Crop controls stayed inside the canvas, no horizontal overflow occurred, and accessibility checks reported no violations. A resized PNG download still completed successfully.
