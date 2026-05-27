// Calendar — view template
// Consumes theme tokens from Fusion Studio shell

(function () {
  const root = document.documentElement;

  window.addEventListener("message", (event) => {
    if (event.data?.type === "theme-update" && event.data.tokens) {
      Object.entries(event.data.tokens).forEach(([key, value]) => {
        root.style.setProperty(key, value);
      });
    }
  });

  if (window.parent !== window) {
    window.parent.postMessage({ type: "view-ready", id: "calendar" }, "*");
  }
})();
