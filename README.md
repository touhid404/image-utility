# Image Utility

A public image workbench built with React and Vite. Converts JPG, PNG, WebP, AVIF, HEIC, GIF, TIFF, BMP, and SVG in both directions and resizes with adjustable crop, fit, or stretch. Batch settings, per-image previews, individual downloads, ZIP downloads, light/dark themes, and clipboard paste are included.

## Run locally

Requires a current Node.js release.

```sh
npm ci
npm run dev
```

Build with `npm run build`; inspect the built site with `npm run preview`. Static hosting configuration is in `.openai/hosting.json`. Sites publishing uses the existing project ID and the skill's source/publish helper.

## Privacy and limits

Conversion runs in short-lived browser workers. No image-upload API, analytics, authentication, localStorage, IndexedDB, or saved image history is used. Removing files, clearing the batch, or closing the page releases application references. Downloads are controlled by the user. Browser/OS caches and downloaded files are outside the application's storage controls.

Start limits: 20 images per batch, 25 MB per input file, 16 megapixels per output, 16,384 pixels per output side. A 40-megapixel decoded source guard limits memory use. Device capabilities can impose lower practical limits. Processing is sequential and cancellable.

GIF uses the first frame; TIFF uses the first page; HEIC uses the primary image. SVG input is rendered in browser image mode. SVG output contains a PNG and does not trace vectors. GIF has a 256-color palette and binary transparency. JPG/BMP flatten onto the selected background. All images are re-encoded without original camera/location metadata.

Modern browsers must support WebAssembly SIMD, module workers, OffscreenCanvas, createImageBitmap, and secure-context APIs. HEIC/AVIF encoders are downloaded only when selected and can take longer on small devices. Unsupported files show per-file errors. The tested browser is current desktop Chrome, including mobile viewport emulation; real-device Safari and Firefox testing remains outstanding.

## Codec dependencies

Native browser codecs are used where available. Additional codecs use `@pbk20191/icodec`, `libheif-js`, `UTIF`, `gifuct-js`, `gifenc`, and `bmp-ts`. ZIP uses `fflate`. Codec license/source references are in `public/third-party-notices.txt`; design rationale is in `design-system/MASTER.md`.

## Validation

Nine output formats decode back to their expected dimensions; all 81 input/output pairs pass with generated fixtures. Pixel checks verify crop position, fit padding, stretch, and transparency. UI checks cover first-frame/page notices, ZIP names, invalid dimensions, malformed files, the 20-file limit, dialog keyboard behavior, light/dark contrast, and 375px overflow. Production smoke testing covers real downloads and CSP. Generated QA fixtures/screenshots are ignored in `artifacts/`.
