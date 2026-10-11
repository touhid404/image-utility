// Apply the saved preference before the stylesheet and app render.
(() => {
  let theme;
  try {
    theme = localStorage.getItem("image-utility-theme");
  } catch {
    // Browsers can disable storage; the system preference still works.
  }
  if (theme !== "light" && theme !== "dark") {
    theme = matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#10151d" : "#edf0f5");
})();
