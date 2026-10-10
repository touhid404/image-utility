import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowRightIcon,
  CheckCircledIcon,
  Cross2Icon,
  CropIcon,
  DownloadIcon,
  FileIcon,
  ImageIcon,
  InfoCircledIcon,
  LockClosedIcon,
  MoonIcon,
  PlusIcon,
  ResetIcon,
  SunIcon,
  UploadIcon,
  ExclamationTriangleIcon,
} from "@radix-ui/react-icons";
import { zip } from "fflate";
import {
  FORMATS,
  MAX_FILES,
  MAX_BYTES,
  MAX_PIXELS,
  extension,
  outputName,
  processImage,
  saveBlob,
  sizeText,
} from "./image.js";

const INITIAL = {
  format: "png",
  resize: false,
  width: 1200,
  height: 1200,
  mode: "crop",
  quality: 85,
  transparent: true,
  background: "#ffffff",
};
const FORMAT_LABELS = {
  jpg: "Photos",
  png: "Lossless",
  webp: "Web",
  avif: "Compact",
  heic: "Apple",
  gif: "256 colors",
  tiff: "Print",
  bmp: "Bitmap",
  svg: "Container",
};
const INFO = {
  jpg: "Small files for photos. Transparency uses your background color.",
  png: "Lossless detail with full transparency. Great for graphics.",
  webp: "Compact files with transparency. Useful for the web.",
  avif: "Efficient compression with transparency. Encoding takes longer.",
  heic: "A genuine HEIC file. Encoding may take longer on mobile.",
  gif: "One still frame, up to 256 colors and binary transparency.",
  tiff: "A single uncompressed page. Larger files, lossless pixels.",
  bmp: "A 24-bit bitmap. Transparency uses your background color.",
  svg: "Contains an embedded PNG. This does not turn pixels into vector shapes.",
};
function Icon({ as: Component }) {
  return <Component aria-hidden="true" />;
}
function Toggle({ label, checked, onChange, disabled, id }) {
  return (
    <label className="toggle" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="toggle-track" aria-hidden="true" />
    </label>
  );
}
function Help({ privacy = false }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button className="text-button">
          <Icon as={privacy ? LockClosedIcon : InfoCircledIcon} />
          {privacy ? "Privacy" : "Format guide"}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog">
          <div className="dialog-heading">
            <Dialog.Title>
              {privacy
                ? "Your images stay with you."
                : "Choose the right format."}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="icon-button" aria-label="Close guide">
                <Icon as={Cross2Icon} />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description>
            {privacy
              ? "Conversion runs on your device. No image uploads, accounts, or saved image history."
              : "Every output is a still image. Convert supported files to any of these nine formats."}
          </Dialog.Description>
          {privacy ? (
            <div className="privacy-copy">
              <p>
                Files and results stay in this browser session. Removing an
                image, using Clear all, or closing the page releases the
                application’s references.
              </p>
              <p>
                Location and camera metadata are removed when pixels are
                re-encoded. Your browser, operating system, and downloaded files
                have their own storage behavior.
              </p>
              <p>
                The site downloads its own codec files when needed. Your images
                are never sent with those requests. This converter includes no
                analytics or image-upload endpoint. The hosting provider uses
                bot protection and may keep request logs; your selected images
                are not included.
              </p>
            </div>
          ) : (
            <dl className="format-guide">
              {FORMATS.map((f) => (
                <div key={f}>
                  <dt>{f.toUpperCase()}</dt>
                  <dd>{INFO[f]}</dd>
                </div>
              ))}
            </dl>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default function App() {
  const [items, setItems] = useState([]),
    [selectedId, setSelectedId] = useState(null),
    [settings, setSettings] = useState(INITIAL);
  const [theme, setTheme] = useState(() =>
    matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  );
  const [busy, setBusy] = useState(""),
    [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [dragOver, setDragOver] = useState(false),
    [original, setOriginal] = useState(false);
  const input = useRef(null),
    controller = useRef(null),
    urls = useRef(new Set()),
    latestItems = useRef(items);
  latestItems.current = items;
  const selected = items.find((i) => i.id === selectedId) || items[0],
    ready = items.filter((i) => i.width && i.status !== "loading"),
    results = items.filter((i) => i.result);
  const invalidSize =
    settings.resize &&
    (!Number.isInteger(Number(settings.width)) ||
      !Number.isInteger(Number(settings.height)) ||
      Number(settings.width) < 1 ||
      Number(settings.height) < 1 ||
      Number(settings.width) > 16384 ||
      Number(settings.height) > 16384 ||
      Number(settings.width) * Number(settings.height) > MAX_PIXELS);
  const dimensions = selected
    ? settings.resize
      ? [Number(settings.width), Number(settings.height)]
      : [selected.width, selected.height]
    : null;
  const opaque =
    ["jpg", "bmp"].includes(settings.format) || !settings.transparent;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(
    () => () => {
      controller.current?.abort();
      urls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  const makeURL = (blob) => {
    const url = URL.createObjectURL(blob);
    urls.current.add(url);
    return url;
  };
  const revoke = (url) => {
    if (url) {
      URL.revokeObjectURL(url);
      urls.current.delete(url);
    }
  };
  const releaseResult = (i) => {
    revoke(i.outputPreview);
    return {
      ...i,
      result: null,
      outputPreview: null,
      outputName: null,
      status: i.width ? "ready" : i.status,
      error: i.width ? "" : i.error,
    };
  };
  const change = (patch) => {
    setSettings((s) => ({ ...s, ...patch }));
    setItems((list) => list.map(releaseResult));
    setStatus("");
  };
  const crop = (patch) => {
    setItems((list) =>
      list.map((i) =>
        i.id === selected?.id
          ? { ...releaseResult(i), crop: { ...i.crop, ...patch } }
          : i,
      ),
    );
    setStatus("");
  };
  const update = (id, patch) =>
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  async function addFiles(files) {
    if (busy || controller.current) return;
    setError("");
    setStatus("");
    const accepted = [],
      rejected = [],
      slots = MAX_FILES - latestItems.current.length;
    for (const file of Array.from(files)) {
      if (!FORMATS.includes(extension(file.name)))
        rejected.push(`${file.name}: unsupported format.`);
      else if (!file.size || file.size > MAX_BYTES)
        rejected.push(`${file.name}: choose a nonempty file up to 25 MB.`);
      else if (accepted.length >= slots)
        rejected.push(`A batch can hold up to ${MAX_FILES} images.`);
      else
        accepted.push({
          id: crypto.randomUUID(),
          file,
          name: file.name,
          status: "loading",
          width: 0,
          height: 0,
          crop: { x: 50, y: 50 },
        });
    }
    if (rejected.length) setError([...new Set(rejected)].join(" "));
    if (!accepted.length) return;
    setItems((list) => [...list, ...accepted]);
    if (!selectedId) setSelectedId(accepted[0].id);
    setBusy("import");
    controller.current = new AbortController();
    try {
      for (let n = 0; n < accepted.length; n++) {
        const item = accepted[n];
        setStatus(`Reading ${n + 1} of ${accepted.length}: ${item.name}`);
        try {
          const data = await processImage(
            item.file,
            "inspect",
            null,
            controller.current.signal,
          );
          update(item.id, {
            width: data.width,
            height: data.height,
            preview: makeURL(data.preview),
            notice: data.notice,
            status: "ready",
          });
        } catch (err) {
          if (err.name === "AbortError") throw err;
          update(item.id, { status: "error", error: err.message });
        }
      }
      setStatus(
        `${accepted.length} image${accepted.length === 1 ? "" : "s"} added. Choose your output settings.`,
      );
    } catch (err) {
      if (err.name === "AbortError") {
        setItems((list) => list.filter((i) => i.status !== "loading"));
        setStatus("Import cancelled. Completed images remain in your batch.");
      } else setError(err.message);
    } finally {
      setBusy("");
      controller.current = null;
    }
  }
  async function convert() {
    if (!ready.length || invalidSize || busy || controller.current) return;
    setBusy("convert");
    setError("");
    setOriginal(false);
    controller.current = new AbortController();
    const candidates = latestItems.current.filter((i) => i.width && !i.result);
    let successes = 0,
      failures = 0;
    try {
      for (let n = 0; n < candidates.length; n++) {
        const item = candidates[n];
        update(item.id, { status: "converting", error: "" });
        setStatus(`Converting ${n + 1} of ${candidates.length}: ${item.name}`);
        try {
          const data = await processImage(
            item.file,
            "convert",
            { ...settings, ...item.crop },
            controller.current.signal,
            (stage) => setStatus(`${n + 1} of ${candidates.length} · ${stage}`),
          );
          update(item.id, {
            result: data.blob,
            outputPreview: makeURL(data.preview),
            outputName: outputName(item.name, settings.format),
            outputWidth: data.width,
            outputHeight: data.height,
            status: "done",
          });
          successes++;
        } catch (err) {
          if (err.name === "AbortError") throw err;
          update(item.id, { status: "error", error: err.message });
          failures++;
        }
      }
      setStatus(
        `${successes} image${successes === 1 ? "" : "s"} converted${failures ? `; ${failures} failed. Successful results are ready to download.` : ". Ready to download."}`,
      );
    } catch (err) {
      setItems((list) =>
        list.map((i) =>
          i.status === "converting" ? { ...i, status: "ready" } : i,
        ),
      );
      setStatus(
        err.name === "AbortError"
          ? "Conversion cancelled. Completed results are still available."
          : err.message,
      );
    } finally {
      setBusy("");
      controller.current = null;
    }
  }
  async function downloadZIP() {
    if (!results.length || busy) return;
    setBusy("zip");
    setStatus("Preparing your ZIP…");
    try {
      const archive = {},
        used = new Set();
      for (const item of results) {
        let name = item.outputName.replace(/[\\/\x00-\x1f]/g, "_"),
          n = 2;
        const base = name.replace(/\.[^.]+$/, "");
        while (used.has(name)) name = `${base}-${n++}.${settings.format}`;
        used.add(name);
        archive[name] = new Uint8Array(await item.result.arrayBuffer());
      }
      const blob = await new Promise((resolve, reject) =>
        zip(archive, { level: 0 }, (err, bytes) =>
          err
            ? reject(err)
            : resolve(new Blob([bytes], { type: "application/zip" })),
        ),
      );
      saveBlob(blob, "image-utility.zip");
      setStatus("ZIP download started. Your images remain on this device.");
    } catch (err) {
      setError(`ZIP could not be created: ${err.message}`);
    } finally {
      setBusy("");
    }
  }
  function remove(item) {
    revoke(item.preview);
    revoke(item.outputPreview);
    setItems((list) => list.filter((i) => i.id !== item.id));
    setStatus("");
  }
  function clear() {
    if (busy) return;
    urls.current.forEach((url) => URL.revokeObjectURL(url));
    urls.current.clear();
    setItems([]);
    setSelectedId(null);
    setError("");
    setStatus("");
  }
  async function sample() {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 900;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#e8ebdf";
    ctx.fillRect(0, 0, 1200, 900);
    ctx.fillStyle = "#829687";
    ctx.fillRect(0, 450, 1200, 450);
    ctx.fillStyle = "#d4a170";
    ctx.beginPath();
    ctx.arc(860, 300, 115, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#496758";
    ctx.beginPath();
    ctx.moveTo(0, 570);
    ctx.lineTo(420, 200);
    ctx.lineTo(840, 570);
    ctx.fill();
    ctx.fillStyle = "#31493e";
    ctx.beginPath();
    ctx.moveTo(500, 640);
    ctx.lineTo(940, 365);
    ctx.lineTo(1200, 540);
    ctx.lineTo(1200, 900);
    ctx.lineTo(500, 900);
    ctx.fill();
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    await addFiles([
      new File([blob], "sample-landscape.png", { type: "image/png" }),
    ]);
  }
  const addFilesRef = useRef(addFiles);
  addFilesRef.current = addFiles;
  useEffect(() => {
    const paste = (event) => {
      const files = Array.from(event.clipboardData?.files || []).filter(
        (file) => file.type.startsWith("image/"),
      );
      if (files.length) {
        event.preventDefault();
        addFilesRef.current(files);
      }
    };
    document.addEventListener("paste", paste);
    return () => document.removeEventListener("paste", paste);
  }, []);
  const hasAllResults = ready.length > 0 && ready.every((i) => i.result);
  const frameRatio = original
    ? selected?.width / selected?.height
    : dimensions?.[0] / dimensions?.[1] || 1;
  return (
    <>
      <a className="skip-link" href="#workspace">
        Skip to converter
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="/" aria-label="Image Utility home">
            <span className="brand-mark">
              <Icon as={CropIcon} />
            </span>
            image<span className="brand-light">utility</span>
          </a>
          <div className="header-actions">
            <Help privacy />
            <button
              className="icon-button theme-button"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              <Icon as={theme === "light" ? MoonIcon : SunIcon} />
            </button>
          </div>
        </div>
      </header>
      <main>
        <section className="intro">
          <div>
            <p className="intro-kicker">THE IMAGE WORKBENCH</p>
            <h1>
              New format.
              <br />
              <span>Right size.</span>
            </h1>
          </div>
          <div className="intro-aside">
            <p className="intro-description">
              Convert, crop, and resize.
              <br /> A single image or the whole batch.
            </p>
            <span className="local-badge">
              <Icon as={LockClosedIcon} /> On your device. Never uploaded.
            </span>
          </div>
        </section>
        <section
          className="workspace"
          id="workspace"
          aria-label="Image converter"
        >
          <div className="work-area">
            <div className="work-toolbar">
              <div className="preview-tabs" aria-label="Preview type">
                <button
                  aria-pressed={!original}
                  className={!original ? "selected" : ""}
                  onClick={() => setOriginal(false)}
                >
                  Output preview
                </button>
                <button
                  aria-pressed={original}
                  className={original ? "selected" : ""}
                  onClick={() => setOriginal(true)}
                  disabled={!selected?.preview}
                >
                  Original
                </button>
              </div>
              <span className="image-count">
                {items.length
                  ? `${items.length} / ${MAX_FILES} images`
                  : "20 images / batch"}
              </span>
            </div>
            <div
              className="preview-stage"
              onDragOver={(e) => {
                e.preventDefault();
                if (!busy) setDragOver(true);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget))
                  setDragOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                addFiles(e.dataTransfer.files);
              }}
            >
              {!items.length ? (
                <div className="drop-zone">
                  <div className="drop-topline">
                    <span>YOUR IMAGES, IN.</span>
                    <Icon as={UploadIcon} />
                  </div>
                  <div className="drop-main">
                    <h2>
                      Drop images
                      <br />
                      here.
                    </h2>
                    <p>Different files. One fresh start.</p>
                    <button
                      className="primary choose-button"
                      onClick={() => input.current.click()}
                    >
                      Choose images <Icon as={PlusIcon} />
                    </button>
                  </div>
                  <div className="drop-bottomline">
                    <span className="upload-limit">
                      25 MB per image · or paste from clipboard
                    </span>
                    <button className="sample-button" onClick={sample}>
                      Try a sample <Icon as={ArrowRightIcon} />
                    </button>
                  </div>
                </div>
              ) : selected?.preview ? (
                <div className="image-workspace">
                  <div
                    className={`image-frame ${opaque && !original ? "" : "checker"}`}
                    style={{
                      aspectRatio: String(frameRatio),
                      maxWidth: `${Math.min(560, 340 * frameRatio)}px`,
                      backgroundColor:
                        opaque && !original ? settings.background : undefined,
                    }}
                  >
                    <img
                      src={
                        !original && selected.outputPreview
                          ? selected.outputPreview
                          : selected.preview
                      }
                      alt={`${original ? "Original" : "Output preview of"} ${selected.name}`}
                      style={{
                        objectFit:
                          original || selected.outputPreview || !settings.resize
                            ? "contain"
                            : settings.mode === "crop"
                              ? "cover"
                              : settings.mode === "fit"
                                ? "contain"
                                : "fill",
                        objectPosition: `${selected.crop.x}% ${selected.crop.y}%`,
                      }}
                    />
                  </div>
                  <div className="preview-caption">
                    <span>
                      {original
                        ? `${selected.width} × ${selected.height}`
                        : dimensions?.every((n) => n > 0)
                          ? `${dimensions[0]} × ${dimensions[1]}`
                          : "Enter valid dimensions"}{" "}
                      px
                    </span>
                    <span>
                      {original
                        ? extension(selected.name).toUpperCase()
                        : settings.format.toUpperCase()}
                      {!original && !selected.result ? " · Preview" : ""}
                    </span>
                  </div>
                  {selected.notice && (
                    <p className="notice">
                      <Icon as={InfoCircledIcon} />
                      {selected.notice}
                    </p>
                  )}
                  {settings.resize && settings.mode === "crop" && !original && (
                    <div className="crop-controls">
                      <div className="crop-heading">
                        <span>
                          <Icon as={CropIcon} /> Position the crop
                        </span>
                        <button
                          className="text-button"
                          disabled={!!busy}
                          onClick={() => crop({ x: 50, y: 50 })}
                        >
                          <Icon as={ResetIcon} /> Center
                        </button>
                      </div>
                      <div className="crop-sliders">
                        <label>
                          Horizontal
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={selected.crop.x}
                            onChange={(e) =>
                              crop({ x: Number(e.target.value) })
                            }
                            disabled={!!busy}
                          />
                        </label>
                        <label>
                          Vertical
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={selected.crop.y}
                            onChange={(e) =>
                              crop({ y: Number(e.target.value) })
                            }
                            disabled={!!busy}
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="image-placeholder">
                  <Icon
                    as={selected?.error ? ExclamationTriangleIcon : ImageIcon}
                  />
                  <h2>
                    {selected?.error
                      ? "This image needs attention"
                      : "Reading your image"}
                  </h2>
                  <p>{selected?.error || "The preview will appear here."}</p>
                </div>
              )}
              {dragOver && (
                <div className="drop-overlay">
                  <Icon as={UploadIcon} /> Drop to add to your batch
                </div>
              )}
            </div>
            <div className="supported-bar">
              <span>All nine formats, in & out</span>
              <span className="supported-detail">First frame / page only</span>
            </div>
            {!!items.length && (
              <div className="batch">
                <div className="batch-heading">
                  <h2>
                    Your images <span>{items.length}</span>
                  </h2>
                  <div>
                    <button
                      className="text-button"
                      disabled={!!busy || items.length >= MAX_FILES}
                      onClick={() => input.current.click()}
                    >
                      <Icon as={PlusIcon} /> Add images
                    </button>
                    <button
                      className="text-button"
                      disabled={!!busy}
                      onClick={clear}
                    >
                      Clear all
                    </button>
                  </div>
                </div>
                <ul className="file-list">
                  {items.map((item) => (
                    <li
                      className={item.id === selected?.id ? "active" : ""}
                      key={item.id}
                    >
                      <button
                        className="file-select"
                        onClick={() => {
                          setSelectedId(item.id);
                          setOriginal(false);
                        }}
                        aria-pressed={item.id === selected?.id}
                      >
                        {item.preview ? (
                          <img src={item.preview} alt="" />
                        ) : (
                          <span className="file-placeholder">
                            <Icon as={FileIcon} />
                          </span>
                        )}
                        <span className="file-details">
                          <strong>{item.name}</strong>
                          <span>
                            {item.width
                              ? `${item.width} × ${item.height} · `
                              : ""}
                            {sizeText(item.file.size)}
                            {item.result
                              ? ` → ${sizeText(item.result.size)}`
                              : ""}
                          </span>
                        </span>
                      </button>
                      <span className={`file-status ${item.status}`}>
                        <Icon
                          as={
                            item.status === "done"
                              ? CheckCircledIcon
                              : item.status === "error"
                                ? ExclamationTriangleIcon
                                : FileIcon
                          }
                        />
                        <span>
                          {
                            {
                              loading: "Reading",
                              ready: "Ready",
                              converting: "Converting",
                              done: "Done",
                              error: "Failed",
                            }[item.status]
                          }
                        </span>
                      </span>
                      <button
                        className="icon-button"
                        disabled={!item.result || !!busy}
                        aria-label={`Download ${item.name}`}
                        onClick={() => saveBlob(item.result, item.outputName)}
                      >
                        <Icon as={DownloadIcon} />
                      </button>
                      <button
                        className="icon-button"
                        disabled={!!busy}
                        aria-label={`Remove ${item.name}`}
                        onClick={() => remove(item)}
                      >
                        <Icon as={Cross2Icon} />
                      </button>
                      {item.error && (
                        <p className="file-error" role="alert">
                          {item.error}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <aside className="settings" aria-label="Output settings">
            <div className="settings-heading">
              <h2>Output settings</h2>
              <span>Applies to your batch</span>
            </div>
            <div className="settings-content">
              <fieldset className="setting-group format-fieldset">
                <legend className="field-label">Convert to</legend>
                <div className="format-grid">
                  {FORMATS.map((f) => (
                    <label key={f} className="format-option">
                      <input
                        type="radio"
                        name="output-format"
                        value={f}
                        checked={settings.format === f}
                        disabled={!!busy}
                        onChange={() => change({ format: f })}
                        aria-label={f.toUpperCase()}
                      />
                      <span className="format-tile">
                        <strong>{f.toUpperCase()}</strong>
                        <span>{FORMAT_LABELS[f]}</span>
                        {settings.format === f && (
                          <Icon as={CheckCircledIcon} />
                        )}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="field-help format-description">
                  {INFO[settings.format]}
                </p>
              </fieldset>
              <div className="setting-group resize-group">
                <Toggle
                  id="resize"
                  label="Resize image"
                  checked={settings.resize}
                  disabled={!!busy}
                  onChange={(v) => change({ resize: v })}
                />
                {settings.resize ? (
                  <>
                    <div className="dimensions">
                      <label htmlFor="width">
                        Width
                        <div className="number-wrap">
                          <input
                            id="width"
                            aria-label="Width"
                            inputMode="numeric"
                            type="number"
                            min="1"
                            max="16384"
                            value={settings.width}
                            disabled={!!busy}
                            onChange={(e) => change({ width: e.target.value })}
                            aria-invalid={!!invalidSize}
                            aria-describedby={
                              invalidSize ? "size-error" : undefined
                            }
                          />
                          <span aria-hidden="true">px</span>
                        </div>
                      </label>
                      <span className="dimension-cross">×</span>
                      <label htmlFor="height">
                        Height
                        <div className="number-wrap">
                          <input
                            id="height"
                            aria-label="Height"
                            inputMode="numeric"
                            type="number"
                            min="1"
                            max="16384"
                            value={settings.height}
                            disabled={!!busy}
                            onChange={(e) => change({ height: e.target.value })}
                            aria-invalid={!!invalidSize}
                            aria-describedby={
                              invalidSize ? "size-error" : undefined
                            }
                          />
                          <span aria-hidden="true">px</span>
                        </div>
                      </label>
                    </div>
                    <div className="presets">
                      <button
                        disabled={!!busy}
                        onClick={() => change({ width: 200, height: 200 })}
                      >
                        200 × 200
                      </button>
                      <button
                        disabled={!!busy}
                        onClick={() => change({ width: 1080, height: 1080 })}
                      >
                        Square
                      </button>
                      <button
                        disabled={!!busy}
                        onClick={() => change({ width: 1920, height: 1080 })}
                      >
                        16:9
                      </button>
                    </div>
                    {invalidSize && (
                      <p id="size-error" className="inline-error" role="alert">
                        Use whole pixels from 1 to 16,384, with a maximum of 16
                        megapixels.
                      </p>
                    )}
                    <span className="field-label mode-label">How it fits</span>
                    <div
                      className="segments"
                      role="group"
                      aria-label="Resize fit mode"
                    >
                      {["crop", "fit", "stretch"].map((mode) => (
                        <button
                          aria-pressed={settings.mode === mode}
                          key={mode}
                          className={settings.mode === mode ? "selected" : ""}
                          disabled={!!busy}
                          onClick={() => change({ mode })}
                        >
                          {mode === "crop" && <Icon as={CropIcon} />}
                          {mode[0].toUpperCase() + mode.slice(1)}
                        </button>
                      ))}
                    </div>
                    <p className="field-help">
                      {
                        {
                          crop: "Fill the size. Adjust the crop in your preview.",
                          fit: "Keep the full image, with padding around it.",
                          stretch:
                            "Use exact dimensions. The image may distort.",
                        }[settings.mode]
                      }
                    </p>
                  </>
                ) : (
                  <p className="field-help resize-help">
                    Keep the original dimensions.
                  </p>
                )}
              </div>
              {["jpg", "webp", "avif", "heic"].includes(settings.format) && (
                <div className="setting-group">
                  <label
                    className="field-label quality-label"
                    htmlFor="quality"
                  >
                    Quality <span>{settings.quality}%</span>
                  </label>
                  <input
                    id="quality"
                    type="range"
                    min="1"
                    max="100"
                    value={settings.quality}
                    disabled={!!busy}
                    onChange={(e) =>
                      change({ quality: Number(e.target.value) })
                    }
                  />
                  <div className="range-labels">
                    <span>Smaller file</span>
                    <span>More detail</span>
                  </div>
                </div>
              )}
              <div className="setting-group transparency-group">
                {!["jpg", "bmp"].includes(settings.format) && (
                  <Toggle
                    id="transparency"
                    label="Keep transparency"
                    checked={settings.transparent}
                    disabled={!!busy}
                    onChange={(v) => change({ transparent: v })}
                  />
                )}
                {opaque && (
                  <label className="background-row" htmlFor="background">
                    <span>Background</span>
                    <span className="color-input">
                      <input
                        id="background"
                        type="color"
                        value={settings.background}
                        disabled={!!busy}
                        onChange={(e) => change({ background: e.target.value })}
                      />
                      <span>{settings.background.toUpperCase()}</span>
                    </span>
                  </label>
                )}
                {settings.format === "gif" && (
                  <p className="field-help">
                    GIF uses fully transparent or fully opaque pixels.
                  </p>
                )}
              </div>
              <div className="metadata-note">
                <Icon as={LockClosedIcon} />
                <p>
                  Location and camera metadata removed. Your files are never
                  uploaded.
                </p>
              </div>
            </div>
            <div className="export-area">
              {busy && (
                <div className="progress-feedback" role="status">
                  <span>{status}</span>
                  <div className="indeterminate-bar" />
                </div>
              )}
              {["import", "convert"].includes(busy) ? (
                <button
                  className="secondary export-button"
                  onClick={() => controller.current?.abort()}
                >
                  Cancel {busy === "import" ? "import" : "conversion"}
                </button>
              ) : hasAllResults ? (
                <button
                  className="primary export-button"
                  disabled={!!busy}
                  onClick={
                    ready.length === 1
                      ? () => saveBlob(ready[0].result, ready[0].outputName)
                      : downloadZIP
                  }
                >
                  <Icon as={DownloadIcon} />
                  {busy === "zip"
                    ? "Preparing ZIP…"
                    : ready.length === 1
                      ? "Download image"
                      : `Download ZIP (${results.length})`}
                </button>
              ) : (
                <button
                  className="primary export-button"
                  disabled={!ready.length || invalidSize || !!busy}
                  onClick={convert}
                >
                  <Icon as={ArrowRightIcon} />
                  {ready.length > 1
                    ? `Convert ${ready.filter((i) => !i.result).length} images`
                    : "Convert image"}
                </button>
              )}
              {results.length > 0 && !hasAllResults && (
                <button
                  className="text-button partial-download"
                  disabled={!!busy}
                  onClick={downloadZIP}
                >
                  <Icon as={DownloadIcon} /> Download completed (
                  {results.length})
                </button>
              )}
              <span className="export-hint">
                {ready.length
                  ? `${ready.length} image${ready.length === 1 ? "" : "s"} · .${settings.format} output`
                  : "Add images, then make them yours."}
              </span>
            </div>
          </aside>
        </section>
        <input
          className="sr-only"
          ref={input}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.avif,.heic,.heif,.gif,.tif,.tiff,.bmp,.svg"
          aria-label="Choose image files"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
          tabIndex="-1"
        />
        {error && (
          <div className="error-banner" role="alert">
            <Icon as={ExclamationTriangleIcon} />
            <p>{error}</p>
            <button
              className="icon-button"
              aria-label="Dismiss error"
              onClick={() => setError("")}
            >
              <Icon as={Cross2Icon} />
            </button>
          </div>
        )}
        <div className="status-line" role="status" aria-live="polite">
          {!busy && status}
        </div>
        <div className="under-tool">
          <p>
            <Icon as={LockClosedIcon} /> Private by design. Processing stays in
            this tab.
          </p>
          <Help />
        </div>
        <footer>
          <span>
            Image Utility <span className="footer-separator">/</span> A useful
            little workbench.
          </span>
          <a href="/third-party-notices.txt" target="_blank" rel="noreferrer">
            Open-source codec notices <Icon as={ArrowRightIcon} />
          </a>
        </footer>
      </main>
    </>
  );
}
