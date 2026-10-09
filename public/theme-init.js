// First-party, parser-blocking bootstrap. Boundary parity is covered by tests/theme.test.ts.
(function () {
  var preference = "auto";
  try { preference = localStorage.getItem("dealpatch.theme") || "auto"; } catch {}
  if (!["auto", "morning", "afternoon", "evening", "night"].includes(preference)) preference = "auto";
  var hour = new Date().getHours();
  var mode = hour >= 5 && hour < 12 ? "morning" : hour >= 12 && hour < 17 ? "afternoon" : hour >= 17 && hour < 21 ? "evening" : "night";
  document.documentElement.dataset.theme = preference === "auto" ? mode : preference;
})();
