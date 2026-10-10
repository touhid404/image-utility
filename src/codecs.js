// Import only requested codecs, keeping unrelated formats out of the deployment.
export async function getCodec(format) {
  if (format === "heic") return import("image-codec-heic");
  if (format === "avif") return import("image-codec-avif");
  return import("image-codec-webp");
}
globalThis._icodec_ImageData = (data, width, height, depth = 8) => {
  if (depth === 8) return new ImageData(data, width, height);
  return { data, width, height, depth };
};
export function to8Bit(image) {
  if (!image.depth || image.depth === 8) return image;
  const source = new Uint16Array(
    image.data.buffer,
    image.data.byteOffset,
    image.width * image.height * 4,
  );
  const data = new Uint8ClampedArray(source.length),
    max = (1 << image.depth) - 1;
  for (let i = 0; i < source.length; i++) data[i] = (source[i] * 255) / max;
  return new ImageData(data, image.width, image.height);
}
