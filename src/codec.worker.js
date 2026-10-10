import UTIF from "utif";
import { parseGIF, decompressFrame } from "gifuct-js";
import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { Buffer } from "buffer";
import { decode as decodeBMP } from "bmp-ts";
import { getCodec, to8Bit } from "./codecs.js";
// bmp-ts uses the Node-compatible Buffer API internally.
globalThis.Buffer = Buffer;

const MIME = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  heic: "image/heic",
  gif: "image/gif",
  tiff: "image/tiff",
  bmp: "image/bmp",
  svg: "image/svg+xml",
};
const progress = (message) => self.postMessage({ progress: message });
const checkSize = (width, height, max = 40_000_000) => {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width * height > max ||
    width > 16384 ||
    height > 16384
  )
    throw new Error(
      `Image dimensions exceed the ${max === 16_000_000 ? "16" : "40"} megapixel or 16,384 pixel side limit.`,
    );
};
function pixelsCanvas(data, width, height) {
  checkSize(width, height);
  const canvas = new OffscreenCanvas(width, height);
  canvas
    .getContext("2d")
    .putImageData(
      new ImageData(new Uint8ClampedArray(data), width, height),
      0,
      0,
    );
  return canvas;
}

async function decode(file, format, bitmap) {
  if (bitmap)
    return {
      image: bitmap,
      notice:
        "SVG is rendered as pixels. Scripts and external resources are not loaded.",
    };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (format === "heic") {
    progress("Loading the HEIC decoder…");
    const { default: factory } = await import(
      "libheif-js/libheif-wasm/libheif-bundle.mjs"
    );
    const lib = await factory();
    const decoder = new lib.HeifDecoder();
    const images = decoder.decode(bytes);
    if (!images.length)
      throw new Error(
        "This HEIC file could not be decoded. It may be damaged or use an unsupported HEIF codec.",
      );
    try {
      const image = images.find((item) => item.is_primary?.()) || images[0];
      const width = image.get_width(),
        height = image.get_height();
      checkSize(width, height);
      const data = await new Promise((resolve, reject) =>
        image.display(
          { data: new Uint8ClampedArray(width * height * 4), width, height },
          (output) =>
            output
              ? resolve(output)
              : reject(new Error("HEIC pixel decoding failed.")),
        ),
      );
      return {
        image: pixelsCanvas(data.data, width, height),
        notice: images.length > 1 ? "HEIC: primary image only." : "",
      };
    } finally {
      images.forEach((image) => image.free?.());
    }
  }
  if (format === "tiff") {
    const pages = UTIF.decode(bytes.buffer);
    const page = pages[0];
    if (!page) throw new Error("No readable TIFF page was found.");
    checkSize(page.t256?.[0], page.t257?.[0]);
    UTIF.decodeImage(bytes.buffer, page);
    return {
      image: pixelsCanvas(UTIF.toRGBA8(page), page.width, page.height),
      notice:
        pages.length > 1
          ? `TIFF: first page only (${pages.length} pages).`
          : "",
    };
  }
  if (format === "gif") {
    const gif = parseGIF(bytes);
    checkSize(gif.lsd.width, gif.lsd.height);
    const frames = gif.frames.filter((frame) => frame.image);
    if (!frames.length) throw new Error("No readable GIF frame was found.");
    const frame = decompressFrame(frames[0], gif.gct, true);
    const canvas = new OffscreenCanvas(gif.lsd.width, gif.lsd.height);
    canvas
      .getContext("2d")
      .putImageData(
        new ImageData(
          new Uint8ClampedArray(frame.patch),
          frame.dims.width,
          frame.dims.height,
        ),
        frame.dims.left,
        frame.dims.top,
      );
    return {
      image: canvas,
      notice:
        frames.length > 1
          ? `GIF: first frame only (${frames.length} frames). Animation is removed.`
          : "",
    };
  }
  if (format === "bmp") {
    // Validate headers before the decoder allocates its pixel buffer.
    if (bytes.length < 26 || bytes[0] !== 66 || bytes[1] !== 77)
      throw new Error("Invalid BMP file.");
    const view = new DataView(bytes.buffer);
    const core = view.getUint32(14, true) === 12;
    checkSize(
      core ? view.getUint16(18, true) : view.getInt32(18, true),
      Math.abs(core ? view.getUint16(20, true) : view.getInt32(22, true)),
    );
    // Native decoding correctly handles opaque BMP alpha and palette variants.
    try {
      return {
        image: await createImageBitmap(new Blob([bytes], { type: MIME.bmp })),
        notice: "",
      };
    } catch {
      /* Use the bundled fallback for remaining variants. */
    }
    const decoded = decodeBMP(Buffer.from(bytes), { toRGBA: true });
    if (!decoded.maskAlpha)
      for (let i = 3; i < decoded.data.length; i += 4) decoded.data[i] = 255;
    return {
      image: pixelsCanvas(
        decoded.data,
        decoded.width,
        Math.abs(decoded.height),
      ),
      notice: "",
    };
  }
  try {
    const image = await createImageBitmap(
      new Blob([bytes], { type: MIME[format] }),
    );
    checkSize(image.width, image.height);
    return { image, notice: "" };
  } catch (error) {
    if (format === "avif" || format === "webp") {
      const codec = await getCodec(format);
      const wasmURL =
        format === "avif"
          ? (await import("@pbk20191/icodec/avif-dec.wasm?url")).default
          : (await import("@pbk20191/icodec/webp-dec.wasm?url")).default;
      await codec.loadDecoder(wasmURL);
      const decoded = codec.decode(bytes);
      const normalized = to8Bit(decoded);
      return {
        image: pixelsCanvas(
          normalized.data,
          normalized.width,
          normalized.height,
        ),
        notice: "",
      };
    }
    throw error;
  }
}

function render(image, settings) {
  const width = settings.resize ? Number(settings.width) : image.width;
  const height = settings.resize ? Number(settings.height) : image.height;
  checkSize(width, height, 16_000_000);
  const canvas = new OffscreenCanvas(width, height),
    ctx = canvas.getContext("2d");
  // JPEG and our 24-bit BMP output have no alpha channel.
  if (!settings.transparent || ["jpg", "bmp"].includes(settings.format)) {
    ctx.fillStyle = settings.background;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  if (!settings.resize || settings.mode === "stretch")
    ctx.drawImage(image, 0, 0, width, height);
  else if (settings.mode === "fit") {
    const scale = Math.min(width / image.width, height / image.height);
    const w = image.width * scale,
      h = image.height * scale;
    ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
  } else {
    const scale = Math.max(width / image.width, height / image.height);
    const sw = width / scale,
      sh = height / scale;
    ctx.drawImage(
      image,
      ((image.width - sw) * settings.x) / 100,
      ((image.height - sh) * settings.y) / 100,
      sw,
      sh,
      0,
      0,
      width,
      height,
    );
  }
  return canvas;
}

async function thumbnail(image) {
  const scale = Math.min(1, 1000 / Math.max(image.width, image.height));
  const canvas = new OffscreenCanvas(
    Math.max(1, Math.round(image.width * scale)),
    Math.max(1, Math.round(image.height * scale)),
  );
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.convertToBlob({ type: "image/png" });
}

function encodeBMP(image) {
  const { width, height, data } = image;
  const stride = Math.ceil((width * 3) / 4) * 4;
  const bytes = new Uint8Array(54 + stride * height),
    view = new DataView(bytes.buffer);
  bytes.set([66, 77]);
  view.setUint32(2, bytes.length, true);
  view.setUint32(10, 54, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true);
  view.setUint32(34, stride * height, true);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const source = (y * width + x) * 4,
        target = 54 + (height - y - 1) * stride + x * 3;
      bytes[target] = data[source + 2];
      bytes[target + 1] = data[source + 1];
      bytes[target + 2] = data[source];
    }
  return bytes;
}

async function encode(canvas, settings) {
  const { format, quality } = settings;
  if (["jpg", "png", "webp"].includes(format)) {
    const blob = await canvas.convertToBlob({
      type: MIME[format],
      quality: quality / 100,
    });
    if (blob.type === MIME[format]) return blob;
    if (format !== "webp")
      throw new Error(`This browser cannot export ${format.toUpperCase()}.`);
  }
  if (format === "svg") {
    const png = new Uint8Array(
      await (await canvas.convertToBlob({ type: "image/png" })).arrayBuffer(),
    );
    let binary = "";
    for (let i = 0; i < png.length; i += 8192)
      binary += String.fromCharCode(...png.subarray(i, i + 8192));
    return new Blob(
      [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}"><title>Raster image embedded in SVG</title><image width="${canvas.width}" height="${canvas.height}" href="data:image/png;base64,${btoa(binary)}"/></svg>`,
      ],
      { type: MIME.svg },
    );
  }
  const image = canvas
    .getContext("2d")
    .getImageData(0, 0, canvas.width, canvas.height);
  let bytes;
  if (format === "tiff")
    bytes = UTIF.encodeImage(image.data.buffer, image.width, image.height, {
      t338: [2],
    });
  else if (format === "bmp") bytes = encodeBMP(image);
  else if (format === "gif") {
    const palette = quantize(image.data, 256, {
      format: "rgba4444",
      oneBitAlpha: true,
    });
    const indices = applyPalette(image.data, palette, "rgba4444");
    const transparentIndex = palette.findIndex((color) => color[3] === 0);
    const gif = GIFEncoder();
    gif.writeFrame(indices, image.width, image.height, {
      palette,
      transparent: transparentIndex >= 0,
      transparentIndex: Math.max(0, transparentIndex),
      repeat: -1,
    });
    gif.finish();
    bytes = gif.bytes();
  } else {
    progress(`Loading the ${format.toUpperCase()} encoder…`);
    const codec = await getCodec(format);
    const wasmURL =
      format === "heic"
        ? (await import("@pbk20191/icodec/heic-enc.wasm?url")).default
        : format === "avif"
          ? (await import("@pbk20191/icodec/avif-enc.wasm?url")).default
          : (await import("@pbk20191/icodec/webp-enc.wasm?url")).default;
    await codec.loadEncoder(wasmURL);
    progress(`Encoding ${format.toUpperCase()}…`);
    bytes = codec.encode(
      image,
      format === "heic"
        ? { quality, preset: "ultrafast" }
        : format === "avif"
          ? { quality, speed: 8 }
          : { quality },
    );
  }
  return new Blob([bytes], { type: MIME[format] });
}

self.onmessage = async ({ data }) => {
  let image;
  try {
    if (typeof OffscreenCanvas === "undefined")
      throw new Error(
        "This tool requires a current browser with OffscreenCanvas support.",
      );
    progress("Reading image…");
    const decoded = await decode(data.file, data.format, data.bitmap);
    image = decoded.image;
    checkSize(image.width, image.height);
    if (data.action === "inspect")
      self.postMessage({
        width: image.width,
        height: image.height,
        preview: await thumbnail(image),
        notice: decoded.notice,
      });
    else {
      progress("Resizing image…");
      const canvas = render(image, data.settings);
      const blob = await encode(canvas, data.settings);
      self.postMessage({
        blob,
        preview: await thumbnail(canvas),
        width: canvas.width,
        height: canvas.height,
        notice: decoded.notice,
      });
    }
  } catch (error) {
    self.postMessage({
      error:
        error.message || "The image could not be processed. Try another file.",
    });
  } finally {
    image?.close?.();
  }
};
