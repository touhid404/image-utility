export const FORMATS = [
  "jpg",
  "png",
  "webp",
  "avif",
  "heic",
  "gif",
  "tiff",
  "bmp",
  "svg",
];
export const MAX_FILES = 20;
export const MAX_BYTES = 25 * 1024 * 1024;
export const MAX_PIXELS = 16_000_000;
export const MIME = {
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

export function extension(name) {
  const ext = name.split(".").pop().toLowerCase();
  return { jpeg: "jpg", tif: "tiff", heif: "heic" }[ext] || ext;
}
export function sizeText(bytes) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
export function outputName(name, format) {
  return `${name.replace(/\.[^.]+$/, "") || "image"}.${format}`;
}

async function svgBitmap(file) {
  const url = URL.createObjectURL(
    new Blob([await file.arrayBuffer()], { type: "image/svg+xml" }),
  );
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () =>
        reject(
          new Error(
            "This SVG could not be rendered. Embed any linked images or fonts first.",
          ),
        );
      image.src = url;
    });
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > 40_000_000
    )
      throw new Error("SVG must have valid dimensions below 40 megapixels.");
    return await createImageBitmap(image);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function processImage(file, action, settings, signal, onProgress) {
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  const format = extension(file.name);
  const bitmap = format === "svg" ? await svgBitmap(file) : null;
  if (signal?.aborted) {
    bitmap?.close();
    throw new DOMException("Cancelled", "AbortError");
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./codec.worker.js", import.meta.url), {
      type: "module",
    });
    let timer;
    const finish = (error, data) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      worker.terminate();
      error ? reject(error) : resolve(data);
    };
    const abort = () => finish(new DOMException("Cancelled", "AbortError"));
    signal?.addEventListener("abort", abort, { once: true });
    timer = setTimeout(
      () =>
        finish(
          new Error(
            "This image took too long to process. Try a smaller image or a faster format.",
          ),
        ),
      180_000,
    );
    worker.onerror = () =>
      finish(
        new Error(
          "The image processor could not run in this browser. Try a current browser or a smaller image.",
        ),
      );
    worker.onmessage = ({ data }) => {
      if (data.progress) onProgress?.(data.progress);
      else if (data.error) finish(new Error(data.error));
      else finish(null, data);
    };
    worker.postMessage(
      { file, format, bitmap, action, settings },
      bitmap ? [bitmap] : [],
    );
  });
}

export function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
