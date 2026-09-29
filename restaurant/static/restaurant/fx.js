/* TableMint — shared micro-interactions (sign-in page and dashboard).
   Ripples on press, tilt on hover, and an interactive dining scene. */
(() => {
  "use strict";
  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");

  // Ripple where the pointer presses a control.
  const RIPPLE = ".btn, .pick, .tab, .stage, .seg button, .nav-item, .pos-item, .hero-chip, .auth-roles > div";
  document.addEventListener("pointerdown", (e) => {
    const el = e.target.closest(RIPPLE);
    if (!el || el.disabled || reduce()) return;
    const r = el.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2;
    const s = document.createElement("span");
    s.className = "ripple";
    s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
    el.appendChild(s);
    setTimeout(() => s.remove(), 700);
  });

  // Cards lean toward the pointer, with a soft glare.
  const TILT = ".kpi, .dish, .tcard, .stage, .inv-stat, .auth-roles > div";
  let tilted = null;
  const untilt = () => {
    if (!tilted) return;
    tilted.style.transform = "";
    tilted.classList.remove("tilting");
    tilted = null;
  };
  document.addEventListener("pointermove", (e) => {
    if (!finePointer.matches || reduce()) return;
    const el = e.target.closest?.(TILT);
    if (tilted && tilted !== el) untilt();
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 8).toFixed(2)}deg) translateY(-4px)`;
    el.style.setProperty("--mx", `${((x + 0.5) * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${((y + 0.5) * 100).toFixed(1)}%`);
    el.classList.add("tilting");
    tilted = el;
  });
  document.addEventListener("pointerleave", untilt);

  // Dining scene: parallax with the pointer; tap the cloche, lamp or candle.
  document.querySelectorAll(".scene").forEach((svg) => {
    const host = svg.closest(".hero, .auth-art") || svg.parentElement;
    host.addEventListener("pointermove", (e) => {
      if (reduce()) return;
      const r = host.getBoundingClientRect();
      svg.style.setProperty("--px", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      svg.style.setProperty("--py", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    });
    host.addEventListener("pointerleave", () => { svg.style.setProperty("--px", 0); svg.style.setProperty("--py", 0); });
    svg.addEventListener("click", (e) => {
      if (e.target.closest(".s-cloche, .s-steam")) svg.classList.toggle("lifted");
      else if (e.target.closest(".s-lamp")) svg.classList.toggle("lamp-off");
      else if (e.target.closest(".s-candle")) svg.classList.toggle("candle-out");
      else if (e.target.closest(".s-glass")) { svg.classList.remove("cheers"); void svg.getBBox(); svg.classList.add("cheers"); }
    });
  });
})();
