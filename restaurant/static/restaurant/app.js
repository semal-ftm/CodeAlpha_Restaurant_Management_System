/* TableMint — Restaurant Operations UI
   Vanilla JS single-page dashboard on top of the Django REST API. */
(() => {
  "use strict";

  // ================================================================ helpers
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => Number(v || 0);
  const moneyFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  const money = (v) => moneyFmt.format(num(v));
  const qtyFmt = (v) => { const n = num(v); return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""); };
  const icon = (name, cls = "") => `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const emo = (e, cls = "") => `<span class="emoji ${cls}" aria-hidden="true">${e}</span>`;
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const initials = (name) => String(name || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  const list = (d) => (Array.isArray(d) ? d : d?.results || []);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const storage = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
  };

  const pad = (n) => String(n).padStart(2, "0");
  const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const resDate = (r) => new Date(`${r.reservation_date}T${String(r.reservation_time).slice(0, 8)}`);
  const timeOf = (d) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const dayOf = (d) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((new Date(d).setHours(0, 0, 0, 0) - today) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff === -1) return "Yesterday";
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };
  const ago = (iso) => {
    const s = Math.max(0, (Date.now() - new Date(iso)) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  const until = (d) => {
    const m = Math.round((d - Date.now()) / 60000);
    if (m <= 0) return "now";
    if (m < 60) return `in ${m} min`;
    if (m < 1440) return `in ${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ""}`.trim();
    return dayOf(d);
  };
  const elapsed = (iso) => {
    const m = Math.floor((Date.now() - new Date(iso)) / 60000);
    if (m < 1) return { label: "now", m };
    if (m < 60) return { label: `${m}m`, m };
    if (m < 1440) return { label: `${Math.floor(m / 60)}h ${m % 60}m`, m };
    return { label: `${Math.floor(m / 1440)}d`, m };
  };

  // Food & ingredient art ------------------------------------------------
  const FOOD = [
    [/burger/i, "🍔"], [/pizza/i, "🍕"], [/fries|chips|potato/i, "🍟"], [/cola|soda|pepsi|sprite|drink|juice/i, "🥤"],
    [/coffee|latte|espresso|cappuccino/i, "☕"], [/tea/i, "🍵"], [/salad/i, "🥗"], [/wing|chicken|nugget/i, "🍗"],
    [/cake|dessert|brownie/i, "🍰"], [/ice ?cream|sundae|gelato/i, "🍨"], [/pasta|spaghetti|noodle/i, "🍝"],
    [/sandwich|sub|wrap/i, "🥪"], [/taco|burrito/i, "🌮"], [/sushi/i, "🍣"], [/soup/i, "🍲"], [/steak|beef/i, "🥩"],
    [/fish|salmon|shrimp/i, "🍤"], [/rice|biryani/i, "🍛"], [/water/i, "💧"], [/hot ?dog/i, "🌭"], [/donut/i, "🍩"],
    [/side/i, "🍟"], [/main/i, "🍛"], [/starter|appetizer/i, "🥟"], [/breakfast|egg/i, "🍳"], [/shake|smoothie/i, "🥤"],
  ];
  const STOCK_ART = [
    [/chicken/i, "🍗"], [/bun|bread/i, "🍞"], [/cheese/i, "🧀"], [/cola|can|soda/i, "🥫"], [/fries|potato/i, "🥔"],
    [/tomato/i, "🍅"], [/lettuce|salad/i, "🥬"], [/onion/i, "🧅"], [/beef|meat/i, "🥩"], [/egg/i, "🥚"], [/milk/i, "🥛"],
    [/oil/i, "🫒"], [/rice/i, "🍚"], [/flour/i, "🌾"], [/sugar/i, "🍬"], [/coffee/i, "☕"], [/fish/i, "🐟"],
  ];
  const pickArt = (table, text, fallback) => (table.find(([re]) => re.test(text || "")) || [0, fallback])[1];
  const foodEmoji = (item) => pickArt(FOOD, item?.name || item?.menu_item_name, null) || pickArt(FOOD, item?.category_name, "🍽️");
  const stockEmoji = (name) => pickArt(STOCK_ART, name, "📦");
  const categoryIndex = () => {
    const names = [...new Set(S.menu.map((m) => m.category_name || "Uncategorized"))].sort();
    return (name) => Math.max(0, names.indexOf(name || "Uncategorized")) % 6;
  };
  const foodClass = (item) => `food-${categoryIndex()(item?.category_name)}`;
  const menuById = (id) => S.menu.find((m) => m.id === id);
  const AV = ["#0f9488", "#2f6fdc", "#ea6a2a", "#6d4fd8", "#c2417a", "#15803d"];
  const avatarColor = (s) => AV[[...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % AV.length];
  const avatar = (name) => `<div class="avatar" style="--av:${avatarColor(name)}">${esc(initials(name))}</div>`;

  // Animated kitchen-stage illustrations (inherit the stage colour via currentColor)
  const ART = {
    pending: `<svg class="art art-ticket" viewBox="0 0 48 48" aria-hidden="true">
      <g class="paper"><rect x="14" y="5" width="20" height="24" rx="2" fill="#fff" stroke="currentColor" stroke-width="1.5"/><path d="M18 11h12M18 15h8M18 19h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".45"/></g>
      <rect x="6" y="24" width="36" height="16" rx="5" fill="currentColor"/><rect x="11" y="27" width="26" height="3" rx="1.5" fill="rgba(0,0,0,.28)"/><circle class="led" cx="35" cy="35" r="2" fill="#fff"/></svg>`,
    preparing: `<svg class="art art-pan" viewBox="0 0 48 48" aria-hidden="true">
      <g class="steam-s"><path d="M17 16q-2-3 0-6q2-3 0-6"/><path d="M25 15q-2-3 0-6q2-3 0-6"/></g>
      <g class="fire"><path d="M16 46c-3-3-1-6 1-8 0 2 1 3 2 3 0-3 2-5 4-7 0 3 3 4 3 7 1 0 2-1 2-3 2 2 3 5 0 8z" fill="#f97316"/><path d="M20 46c-1-2 0-3 1-4 0 1 1 1 1 2 1-1 1-2 2-3 1 2 2 3 1 5z" fill="#fde047"/></g>
      <g class="pan"><g class="bits"><circle cx="14" cy="24" r="2.6" fill="#f59e0b"/><circle cx="21" cy="23" r="2.2" fill="#84cc16"/><circle cx="28" cy="24" r="2.6" fill="#ef4444"/></g>
      <path d="M6 27h30c0 5-4 9-10 9h-10c-6 0-10-4-10-9z" fill="currentColor"/><rect x="35" y="26" width="11" height="3.6" rx="1.8" fill="currentColor"/></g></svg>`,
    ready: `<svg class="art art-bell" viewBox="0 0 48 48" aria-hidden="true">
      <g class="waves" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M7 15q-3 6 0 12"/><path d="M41 15q3 6 0 12"/></g>
      <g class="bell"><rect x="21.5" y="9" width="5" height="4" rx="2" fill="currentColor"/><path d="M10 34a14 14 0 0 1 28 0z" fill="currentColor"/><path d="M16 27a9 9 0 0 1 6-6" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none" opacity=".5"/></g>
      <rect x="6" y="34" width="36" height="5" rx="2.5" fill="currentColor" opacity=".75"/></svg>`,
    served: `<svg class="art art-cloche" viewBox="0 0 48 48" aria-hidden="true">
      <g class="steam-s"><path d="M19 31q-2-3 0-6q2-3 0-6"/><path d="M27 31q-2-3 0-6q2-3 0-6"/></g>
      <g class="lid"><rect x="21.5" y="12" width="5" height="4" rx="2" fill="currentColor"/><path d="M8 34a16 16 0 0 1 32 0z" fill="currentColor"/><path d="M14 28a10 10 0 0 1 6-7" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none" opacity=".5"/></g>
      <rect x="4" y="34" width="40" height="4" rx="2" fill="currentColor" opacity=".75"/></svg>`,
  };
  function portionsLeft(m) {
    let max = Infinity, short = null;
    (m?.recipe_items || []).forEach((r) => {
      const inv = S.inventory.find((i) => i.id === r.inventory_item);
      const need = num(r.quantity_required);
      if (!inv || need <= 0) return;
      const can = Math.floor(num(inv.quantity) / need + 1e-9);
      if (can < max) { max = can; short = inv.name; }
    });
    return { max, short };
  }
  const COLD = /drink|cola|soda|pepsi|sprite|juice|water|shake|smoothie|ice|lemonade|beverage|tea|coffee|latte/i;
  const isCold = (m) => COLD.test(`${m?.name || ""} ${m?.category_name || ""}`) && !/coffee|tea|latte|espresso/i.test(m?.name || "");
  const fx = (m) => (isCold(m)
    ? `<span class="fx-bubbles" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>`
    : `<span class="fx-steam" aria-hidden="true"><i></i><i></i><i></i></span>`);

  // ================================================================ state
  const S = { me: null, summary: {}, orders: [], reservations: [], tables: [], inventory: [], menu: [], loaded: false, syncedAt: null };
  // Mirrors the server's role rules so the UI only offers what the API will accept.
  const can = (k) => !!S.me?.can?.[k];
  const canStatus = (st) => !!S.me?.can?.order_statuses?.includes(st);
  const loginUrl = () => `/login/?next=${encodeURIComponent(location.pathname + location.hash)}`;
  const UI = {
    route: "overview", q: "", keepQ: false, arrive: null, ringCol: null, flashTable: null,
    ovTab: "arrivals", railKey: "", mine: new Set(), dragId: null,
    ordersMode: storage.get("tm-orders-mode") || "board",
    orderFilter: "active", tableFilter: "all", resFilter: "upcoming", invFilter: "all",
  };
  const ROUTES = { overview: "Overview", orders: "Orders", tables: "Floor plan", reservations: "Reservations", menu: "Menu", inventory: "Inventory" };
  const FLOW = ["pending", "preparing", "ready", "served", "completed"];
  const ACTIVE = ["pending", "preparing", "ready", "served"];
  const STAGE = {
    pending:   { label: "Pending",   icon: "hourglass", next: "Start cooking", emoji: "🧾" },
    preparing: { label: "Preparing", icon: "flame",     next: "Mark ready",    emoji: "👨‍🍳" },
    ready:     { label: "Ready",     icon: "bell",      next: "Serve",         emoji: "🛎️" },
    served:    { label: "Served",    icon: "tray",      next: "Complete",      emoji: "🍽️" },
  };

  // ================================================================ api
  function csrfToken() {
    const el = $('input[name="csrfmiddlewaretoken"]');
    if (el && el.value) return el.value;
    const hit = document.cookie.split(";").map((x) => x.trim()).find((x) => x.startsWith("csrftoken="));
    return hit ? decodeURIComponent(hit.slice(10)) : "";
  }
  function flattenErrors(d) {
    if (!d || typeof d !== "object") return "";
    if (Array.isArray(d)) return d.map(flattenErrors).filter(Boolean).join(" ");
    return Object.entries(d).map(([k, v]) => {
      const msg = typeof v === "string" ? v : flattenErrors(v);
      return ["non_field_errors", "detail", "error", "inventory", "items"].includes(k) ? msg : `${cap(k.replace(/_/g, " "))}: ${msg}`;
    }).filter(Boolean).join(" ");
  }
  async function api(url, { method = "GET", body } = {}) {
    const headers = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (!["GET", "HEAD"].includes(method)) headers["X-CSRFToken"] = csrfToken();
    const res = await fetch(url, { method, headers, credentials: "same-origin", body: body === undefined ? undefined : JSON.stringify(body) });
    let data = null;
    try { data = await res.json(); } catch { /* empty body */ }
    if (res.status === 401 || (res.status === 403 && /sign in|credentials/i.test(data?.detail || ""))) {
      location.href = loginUrl();
      throw new Error("Your session has ended. Please sign in again.");
    }
    if (!res.ok) throw new Error(flattenErrors(data) || `Request failed (${res.status})`);
    return data;
  }

  const bootAt = performance.now();
  async function hideLoader() {
    const el = $("#loader");
    if (!el || el.classList.contains("done")) return;
    await wait(Math.max(0, 1100 - (performance.now() - bootAt)));
    el.classList.add("done");
    setTimeout(() => el.remove(), 700);
    await wait(250);
  }

  async function load({ notify = false, silent = false } = {}) {
    const btn = $("#refreshBtn");
    if (!silent) btn.classList.add("is-loading");
    try {
      const urls = ["/api/dashboard/", "/api/orders/", "/api/reservations/", "/api/tables/", "/api/inventory/", "/api/menu/"];
      const [summary, orders, reservations, tables, inventory, menu] = await Promise.all(urls.map((u) => api(u)));
      const first = !S.loaded;
      const before = first ? null : new Map(S.orders.map((o) => [o.id, o.status]));
      Object.assign(S, {
        summary, orders: list(orders), reservations: list(reservations), tables: list(tables),
        inventory: list(inventory), menu: list(menu), loaded: true, syncedAt: new Date(),
      });
      setOnline(true);
      if (before) announceChanges(before);
      render();
      if (first) { await hideLoader(); playEntrance(); }
      if (notify) toast("All caught up", "Data refreshed from the kitchen.");
    } catch (e) {
      setOnline(false);
      hideLoader();
      if (!silent) toast("Couldn't reach the API", e.message, "error");
    } finally {
      btn.classList.remove("is-loading");
    }
  }

  // Tell staff about orders placed or finished by someone else since the last refresh.
  function announceChanges(before) {
    let rang = false;
    S.orders.forEach((o) => {
      if (UI.mine.has(o.id)) return;
      if (!before.has(o.id)) {
        toast(`🛎️ New order #${o.id}`, `Table ${o.table_number} · ${itemSummary(o)}`);
        UI.arrive = o.id; UI.ringCol = o.status; rang = true;
      } else if (o.status === "ready" && before.get(o.id) !== "ready") {
        toast(`🔔 Order #${o.id} is ready`, `Table ${o.table_number} is waiting to be served.`);
        UI.arrive = o.id; UI.ringCol = "ready"; rang = true;
      }
    });
    UI.mine.clear();
    if (rang) {
      const nav = $('[data-route="orders"]');
      nav.classList.remove("ring"); void nav.offsetWidth; nav.classList.add("ring");
    }
  }

  async function mutate(fn, title, msg = "") {
    try {
      const r = await fn();
      await load({ silent: true });
      toast(title, typeof msg === "function" ? msg(r) : msg);
      return r;
    } catch (e) {
      toast("Something went wrong", e.message, "error");
      throw e;
    }
  }

  function setOnline(ok) {
    $("#apiDot").classList.toggle("offline", !ok);
    $("#apiState").textContent = ok ? "All systems normal" : "API unreachable";
    updateSyncLabel(ok);
  }
  function updateSyncLabel(ok = !$("#apiDot").classList.contains("offline")) {
    $("#apiSync").textContent = ok && S.syncedAt ? `Synced ${ago(S.syncedAt)}` : "Retrying automatically";
  }

  // ================================================================ derived
  const activeOrders = () => S.orders.filter((o) => ACTIVE.includes(o.status));
  const itemCount = (o) => (o.order_items || []).reduce((s, i) => s + num(i.quantity), 0);
  const itemSummary = (o) => (o.order_items || []).map((i) => `${i.quantity}× ${i.menu_item_name}`).join(", ");
  const stockLevel = (i) => {
    const q = num(i.quantity), t = num(i.low_stock_threshold);
    if (q <= t * 0.5) return "critical";
    if (q <= t) return "low";
    return "ok";
  };
  const matches = (...fields) => !UI.q || fields.join(" ").toLowerCase().includes(UI.q);
  const soldByItem = () => {
    const m = {};
    S.orders.filter((o) => o.status !== "cancelled").forEach((o) => (o.order_items || []).forEach((i) => {
      m[i.menu_item] ||= { id: i.menu_item, name: i.menu_item_name, qty: 0, revenue: 0 };
      m[i.menu_item].qty += num(i.quantity);
      m[i.menu_item].revenue += num(i.line_total ?? num(i.unit_price) * num(i.quantity));
    }));
    return m;
  };
  const upcomingReservations = () => {
    const from = Date.now() - 30 * 60 * 1000;
    return S.reservations.filter((r) => ["pending", "confirmed"].includes(r.status) && resDate(r) >= from).sort((a, b) => resDate(a) - resDate(b));
  };
  const foodStack = (o) => `<span class="food-stack">${(o.order_items || []).slice(0, 3).map((i) => {
    const m = menuById(i.menu_item) || { name: i.menu_item_name };
    return `<span class="emoji ${foodClass(m)}" title="${esc(i.menu_item_name)}">${foodEmoji(m)}</span>`;
  }).join("")}</span>`;

  // ================================================================ shared UI
  const empty = (art, title, text, action = "") =>
    `<div class="empty"><div class="empty-art emoji" aria-hidden="true">${art}</div><b>${esc(title)}</b><p>${esc(text)}</p>${action}</div>`;
  const badge = (status, label = cap(status)) => `<span class="badge ${esc(status)}">${esc(label)}</span>`;
  const skeletonRows = (n, h = 18) => Array.from({ length: n }, () => `<div style="padding:12px 20px"><div class="skel" style="height:${h}px"></div></div>`).join("");

  function renderTabs(el, items, current, onPick) {
    el.innerHTML = items.map(([key, label, count]) =>
      `<button class="tab" role="tab" data-key="${key}" aria-selected="${key === current}">${esc(label)}${count !== undefined ? `<span class="n">${count}</span>` : ""}</button>`).join("");
    el.onclick = (e) => { const b = e.target.closest("[data-key]"); if (b) onPick(b.dataset.key); };
  }

  function countUp(el, to, fmt = (v) => String(Math.round(v))) {
    const from = num(el.dataset.v);
    el.dataset.v = to;
    if (reduceMotion() || from === to) { el.textContent = fmt(to); return; }
    const start = performance.now(), dur = 900;
    const step = (t) => {
      const p = Math.min(1, (t - start) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function playEntrance() {
    const v = $(`#view-${UI.route}`);
    if (!v) return;
    v.classList.remove("animate");
    void v.offsetWidth;
    v.classList.add("animate");
    clearTimeout(playEntrance.t);
    playEntrance.t = setTimeout(() => v.classList.remove("animate"), 1800);
  }

  // ================================================================ render
  function render() {
    renderNav();
    renderOverview();
    renderOrders();
    renderTables();
    renderReservations();
    renderMenu();
    renderInventory();
    tickTimers();
    applyPerms();
  }

  function applyPerms(root = document) {
    $$("[data-perm]", root).forEach((el) => { el.hidden = !can(el.dataset.perm); });
  }

  function renderNav() {
    const setCount = (id, n) => { const el = $(id); el.hidden = !n; el.textContent = n; };
    setCount("#navOrders", activeOrders().length);
    setCount("#navRes", upcomingReservations().filter((r) => dayOf(resDate(r)) === "Today").length);
    setCount("#navStock", S.inventory.filter((i) => i.is_low_stock).length);
  }

  // Overview ----------------------------------------------------------------
  const KPIS = [
    { id: "sales", label: "Sales today", ic: "dollar", tint: "teal", fmt: money },
    { id: "orders", label: "Orders today", ic: "orders", tint: "blue" },
    { id: "kitchen", label: "In the kitchen", ic: "flame", tint: "orange" },
    { id: "res", label: "Reservations today", ic: "calendar", tint: "violet" },
  ];

  function renderOverview() {
    const h = new Date().getHours();
    const first = (S.me?.name || "").split(" ")[0];
    $("#greeting").textContent = `${h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"}${first ? `, ${first}` : ""}`;
    $("#heroDate").textContent = `Live service · ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`;

    if (!$("#kpis").children.length) {
      $("#kpis").innerHTML = KPIS.map((k, i) => `
        <article class="panel kpi tint-${k.tint} reveal" style="--i:${i + 1}">
          <div class="kpi-top"><span class="kpi-label">${k.label}</span><span class="kpi-icon">${icon(k.ic)}</span></div>
          <div class="kpi-value" id="kpi-${k.id}">${S.loaded ? "" : '<span class="skel" style="display:block;height:30px;width:60%"></span>'}</div>
          <div class="kpi-foot" id="kpi-${k.id}-foot">&nbsp;</div>
        </article>`).join("");
    }
    if (!S.loaded) {
      ["#stages", "#floorViz", "#upcoming"].forEach((s) => ($(s).innerHTML = skeletonRows(3)));
      return;
    }

    const a = S.summary, active = activeOrders();
    const ready = active.filter((o) => o.status === "ready").length;
    const free = S.tables.filter((t) => t.status === "available").length;
    const paid = S.orders.filter((o) => o.status !== "cancelled");
    const avgTicket = paid.length ? paid.reduce((s, o) => s + num(o.total_price), 0) / paid.length : 0;
    const up = upcomingReservations();
    const todayUp = up.filter((r) => dayOf(resDate(r)) === "Today");

    // Hero
    $("#heroLine").innerHTML = [
      `${emo("🔥")}<b>${plural(active.length, "order")}</b> in the kitchen`,
      `${emo("🪑")}<b>${free} of ${S.tables.length}</b> tables free`,
      `${emo("📅")}<b>${plural(todayUp.length, "booking")}</b> still to come today`,
    ].map((x) => `<span>${x}</span>`).join("");
    const next = up[0];
    $("#heroNext").innerHTML = next
      ? `<span class="hero-chip-ic">${avatar(next.customer_name)}</span><div><small>Next arrival · ${until(resDate(next))}</small><b>${esc(next.customer_name)} · Table ${esc(next.table_number)}</b></div>`
      : `<span class="hero-chip-ic emoji">🌿</span><div><small>Next arrival</small><b>No bookings ahead</b></div>`;
    const low = S.inventory.filter((i) => i.is_low_stock);
    $("#heroAlert").innerHTML = low.length
      ? `<button class="hero-chip warn" data-go="inventory"><span class="hero-chip-ic emoji">📦</span><div><small>Stock alert</small><b>${plural(low.length, "item")} running low</b></div></button>`
      : `<div class="hero-chip ok"><span class="hero-chip-ic emoji">✅</span><div><small>Pantry</small><b>All stock healthy</b></div></div>`;

    // KPIs
    countUp($("#kpi-sales"), num(a.today_sales), money);
    $("#kpi-sales-foot").innerHTML = "From served &amp; completed orders";
    countUp($("#kpi-orders"), num(a.today_orders));
    $("#kpi-orders-foot").innerHTML = `Avg. ticket <b>${money(avgTicket)}</b>`;
    countUp($("#kpi-kitchen"), active.length);
    $("#kpi-kitchen-foot").innerHTML = ready ? `<b>${ready} ready</b> to serve now` : "Nothing waiting at the pass";
    countUp($("#kpi-res"), num(a.today_reservations));
    $("#kpi-res-foot").innerHTML = next ? `Next ${until(resDate(next))}` : "No more arrivals";

    // Pipeline stages
    const counts = Object.fromEntries(ACTIVE.map((s) => [s, 0]));
    active.forEach((o) => counts[o.status]++);
    const max = Math.max(1, ...Object.values(counts));
    $("#stages").innerHTML = ACTIVE.map((s, i) => `
      <button class="stage st-${s} ${counts[s] ? "hot" : ""}" data-go="orders" data-tip="${STAGE[s].label}: ${plural(counts[s], "order")}">
        <span class="stage-art">${ART[s]}</span>
        <span class="stage-n">${counts[s]}</span>
        <span class="stage-l">${STAGE[s].label}</span>
        <span class="stage-bar"><i class="grow" style="--i:${i};width:${(counts[s] / max) * 100}%"></i></span>
      </button>`).join("");

    // Recent orders
    const recent = [...S.orders].sort((x, y) => new Date(y.created_at) - new Date(x.created_at)).slice(0, 6);
    $("#recentOrders").innerHTML = recent.length
      ? `<thead><tr><th>Order</th><th>Table</th><th>Items</th><th>Status</th><th class="r">Total</th></tr></thead><tbody>${recent.map((o) => `
          <tr>
            <td><div class="cell-main">#${o.id}</div><div class="cell-sub"><span class="when-table">Table ${esc(o.table_number ?? o.table)} · </span>${ago(o.created_at)}</div></td>
            <td>Table ${esc(o.table_number ?? o.table)}</td>
            <td><div style="display:flex;align-items:center;gap:10px">${foodStack(o)}<span class="cell-sub clip" style="max-width:200px;margin:0" title="${esc(itemSummary(o))}">${esc(itemSummary(o) || "—")}</span></div></td>
            <td>${badge(o.status)}</td>
            <td class="r strong num">${money(o.total_price)}</td>
          </tr>`).join("")}</tbody>`
      : `<tbody><tr><td>${empty("🧾", "No orders yet", "Orders will appear here the moment they're placed.", `<button class="btn btn-sm btn-primary" data-open="order" data-perm="create_order">${icon("plus", "i-xs")}Take the first order</button>`)}</td></tr></tbody>`;

    // Floor donut — status palette, legend with counts
    const total = S.tables.length;
    const parts = [["available", "Available"], ["reserved", "Reserved"], ["occupied", "Occupied"]].map(([k, l]) => ({ k, l, n: S.tables.filter((t) => t.status === k).length }));
    if (total) {
      const nonZero = parts.filter((p) => p.n).length;
      let offset = 0;
      const segs = parts.filter((p) => p.n).map((p) => {
        const share = (p.n / total) * 100, gap = nonZero > 1 ? 1.2 : 0;
        const s = `<circle class="seg seg-${p.k}" cx="75" cy="75" r="60" pathLength="100" stroke-dasharray="${Math.max(0, share - gap)} ${100 - share + gap}" stroke-dashoffset="${-offset}" data-tip="${p.l}: ${plural(p.n, "table")}"/>`;
        offset += share;
        return s;
      }).join("");
      $("#floorViz").innerHTML = `
        <div class="donut-wrap">
          <div class="donut" role="img" aria-label="${parts.map((p) => `${p.l} ${p.n}`).join(", ")}">
            <svg viewBox="0 0 150 150"><circle class="track" cx="75" cy="75" r="60"/>${segs}</svg>
            <div class="donut-center"><strong>${parts[0].n}<span style="font-size:16px;color:var(--text-3)">/${total}</span></strong><span>tables free</span></div>
          </div>
          <div class="legend">${parts.map((p) => `<div class="legend-row"><i class="seg-${p.k}"></i><span>${p.l}</span><b>${p.n}<small>${Math.round((p.n / total) * 100)}%</small></b></div>`).join("")}</div>
        </div>`;
    } else {
      $("#floorViz").innerHTML = empty("🪑", "No tables yet", "Add tables in Django admin to see your floor.");
    }

    // Arriving soon (timeline)
    $("#upcoming").innerHTML = up.length
      ? `<div class="timeline">${up.slice(0, 4).map((r, i) => { const d = resDate(r); return `
          <div class="tl-item ${i === 0 ? "soon" : ""}">
            <div class="tl-time"><b>${timeOf(d)}</b><span>${dayOf(d)}</span></div>
            <div class="tl-card">${avatar(r.customer_name)}<div class="list-main"><b>${esc(r.customer_name)}</b><span>${plural(r.number_of_guests, "guest")} · Table ${esc(r.table_number)}</span></div></div>
          </div>`; }).join("")}</div>`
      : empty("📭", "No upcoming bookings", "New reservations will line up here.", `<button class="btn btn-sm" data-open="reservation" data-perm="reserve">${icon("plus", "i-xs")}Book a table</button>`);

    // Top sellers
    const top = Object.values(soldByItem()).sort((x, y) => y.qty - x.qty).slice(0, 4);
    const topMax = top[0]?.qty || 1;
    $("#topSellers").innerHTML = top.length
      ? top.map((t, i) => { const m = menuById(t.id) || { name: t.name }; return `
        <div class="list-row">
          <div class="medal ${foodClass(m)}">${emo(foodEmoji(m))}<sup>${i + 1}</sup></div>
          <div class="list-main"><b>${esc(t.name)}</b><span>${money(t.revenue)} revenue</span><div class="seller-bar"><i class="grow" style="--i:${i};width:${(t.qty / topMax) * 100}%"></i></div></div>
          <div class="list-side"><b>${t.qty}</b><span>sold</span></div>
        </div>`; }).join("")
      : empty("📈", "No sales yet", "Your best-selling dishes will show up here.");
    $$("[data-ov-tab]").forEach((b) => b.setAttribute("aria-selected", b.dataset.ovTab === UI.ovTab));
    $("#upcoming").hidden = UI.ovTab !== "arrivals";
    $("#topSellers").hidden = UI.ovTab !== "sellers";
    renderRail();
  }

  // Scrolling "ticket rail" of what just happened on the floor.
  function renderRail() {
    const items = [];
    [...S.orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 6).forEach((o) => {
      const art = { pending: "🧾", preparing: "🔥", ready: "🛎️", served: "🍽️", completed: "✅", cancelled: "✖️" }[o.status] || "🧾";
      items.push(`${emo(art)}<b>#${o.id}</b> Table ${esc(o.table_number)} · ${esc(itemSummary(o) || "no items")}<span class="rail-pill ${esc(o.status)}">${esc(o.status)}</span><span class="ago">${ago(o.created_at)}</span>`);
    });
    upcomingReservations().slice(0, 3).forEach((r) =>
      items.push(`${emo("📅")}<b>${esc(r.customer_name)}</b> · Table ${esc(r.table_number)} · ${plural(r.number_of_guests, "guest")}<span class="ago">${dayOf(resDate(r))} ${timeOf(resDate(r))}</span>`));
    S.inventory.filter((i) => i.is_low_stock).slice(0, 3).forEach((i) =>
      items.push(`${emo("📦")}<b>${esc(i.name)}</b> running low<span class="ago">${qtyFmt(i.quantity)} ${esc(i.unit)} left</span>`));
    if (!items.length) items.push(`${emo("🌿")}<b>All quiet</b> — new orders and bookings will scroll by here`);
    const key = items.join("|");
    if (key === UI.railKey) return;  // don't restart the marquee on every refresh
    UI.railKey = key;
    const row = items.map((x) => `<span class="rail-item">${x}</span>`).join("");
    const track = $("#railTrack");
    track.innerHTML = row + row;  // doubled for a seamless loop
    track.style.setProperty("--rail-dur", `${Math.max(24, items.length * 7)}s`);
  }

  // Orders ------------------------------------------------------------------
  const orderMatches = (o) => matches(`#${o.id}`, o.id, `table ${o.table_number}`, o.status, itemSummary(o));

  function ticket(o) {
    const st = STAGE[o.status];
    return `
      <article class="ticket ${UI.arrive === o.id ? "arrive" : ""}" data-ticket="${o.id}" draggable="${dropTargets(o).length ? "true" : "false"}">
        <div class="ticket-top">
          <span class="ticket-id">#${o.id}<span class="ticket-table">Table ${esc(o.table_number ?? o.table)}</span></span>
          <span class="timer" data-since="${esc(o.created_at)}">${icon("clock", "i-xs")}<span></span></span>
        </div>
        <ul class="ticket-items">${(o.order_items || []).map((i) => {
          const m = menuById(i.menu_item) || { name: i.menu_item_name };
          return `<li>${emo(foodEmoji(m))}<span class="q">${i.quantity}×</span><span class="nm">${esc(i.menu_item_name)}</span></li>`;
        }).join("") || "<li>No items</li>"}</ul>
        <div class="ticket-foot">
          <span class="ticket-total">${money(o.total_price)}</span>
          <div class="ticket-actions">
            ${canStatus("cancelled") ? `<button class="btn btn-ghost btn-icon btn-sm btn-danger" data-cancel-order="${o.id}" aria-label="Cancel order #${o.id}" data-tip="Cancel order">${icon("ban", "i-sm")}</button>` : ""}
            ${st ? (canStatus(nextStatus(o)) ? `<button class="btn btn-sm btn-advance" data-advance="${o.id}">${st.next}${icon("arrow-right", "i-xs")}</button>` : `<span class="waiting">${waitingOn(o)}</span>`) : ""}
          </div>
        </div>
      </article>`;
  }

  function renderOrders() {
    const board = $("#ordersBoard"), listWrap = $("#ordersList");
    const isBoard = UI.ordersMode === "board";
    board.hidden = !isBoard; listWrap.hidden = isBoard;
    $$("[data-orders-mode]").forEach((b) => b.setAttribute("aria-selected", b.dataset.ordersMode === UI.ordersMode));
    if (!S.loaded) { board.innerHTML = ACTIVE.map((s) => `<div class="col st-${s}">${skeletonRows(2, 110)}</div>`).join(""); return; }

    const orders = S.orders.filter(orderMatches);
    board.innerHTML = ACTIVE.map((s, i) => {
      const col = orders.filter((o) => o.status === s).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      return `<section class="col st-${s} reveal ${UI.ringCol === s ? "flash" : ""}" style="--i:${i}" data-stage="${s}" data-label="${STAGE[s].label}" aria-label="${STAGE[s].label} orders">
        <div class="col-head"><span class="col-art">${ART[s]}</span><span class="col-title">${STAGE[s].label}</span><span class="col-n">${col.length}</span></div>
        ${col.length ? col.map(ticket).join("") : `<div class="col-empty">${emo(STAGE[s].emoji)}<span>No ${s} orders</span></div>`}
      </section>`;
    }).join("");
    UI.arrive = null; UI.ringCol = null;

    const filters = {
      active: (o) => ACTIVE.includes(o.status), all: () => true,
      completed: (o) => o.status === "completed", cancelled: (o) => o.status === "cancelled",
    };
    renderTabs($("#orderFilters"), [
      ["active", "Active", S.orders.filter(filters.active).length], ["completed", "Completed", S.orders.filter(filters.completed).length],
      ["cancelled", "Cancelled", S.orders.filter(filters.cancelled).length], ["all", "All", S.orders.length],
    ], UI.orderFilter, (k) => { UI.orderFilter = k; renderOrders(); });

    const rows = orders.filter(filters[UI.orderFilter]).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    $("#ordersTable").innerHTML = rows.length
      ? `<thead><tr><th>Order</th><th>Table</th><th>Items</th><th>Status</th><th>Placed</th><th class="r">Total</th><th class="r"><span class="sr-only">Actions</span></th></tr></thead><tbody>${rows.map((o) => `
        <tr>
          <td class="cell-main">#${o.id}</td>
          <td>Table ${esc(o.table_number ?? o.table)}</td>
          <td><div style="display:flex;align-items:center;gap:10px">${foodStack(o)}<div><div class="cell-main" style="font-weight:550">${plural(itemCount(o), "item")}</div><div class="cell-sub clip" style="max-width:240px" title="${esc(itemSummary(o))}">${esc(itemSummary(o))}</div></div></div></td>
          <td>${badge(o.status)}</td>
          <td><div>${timeOf(new Date(o.created_at))}</div><div class="cell-sub">${dayOf(new Date(o.created_at))}</div></td>
          <td class="r strong num">${money(o.total_price)}</td>
          <td><div class="row-actions">
            ${STAGE[o.status] && canStatus(nextStatus(o)) ? `<button class="btn btn-sm" data-advance="${o.id}">${STAGE[o.status].next}</button>` : STAGE[o.status] ? `<span class="waiting">${waitingOn(o)}</span>` : ""}
            ${ACTIVE.includes(o.status) && canStatus("cancelled") ? `<button class="btn btn-ghost btn-icon btn-sm btn-danger" data-cancel-order="${o.id}" aria-label="Cancel order #${o.id}">${icon("ban", "i-sm")}</button>` : ""}
          </div></td>
        </tr>`).join("")}</tbody>`
      : `<tbody><tr><td>${empty(UI.q ? "🔍" : "🧾", UI.q ? "No matching orders" : "Nothing here", UI.q ? "Try a different search term." : "Orders in this state will appear here.")}</td></tr></tbody>`;
  }

  // Board columns this role may drag a ticket into.
  const dropTargets = (o) => ACTIVE.filter((st) => st !== o.status && canStatus(st));
  const nextStatus = (o) => FLOW[FLOW.indexOf(o.status) + 1];
  const waitingOn = (o) => (["pending", "preparing"].includes(o.status) ? `${emo("🧑‍🍳")} Kitchen's turn` : `${emo("🛎️")} Floor's turn`);

  function tickTimers() {
    $$(".timer[data-since]").forEach((t) => {
      const e = elapsed(t.dataset.since);
      $("span", t).textContent = e.label;
      t.classList.toggle("warn", e.m >= 15 && e.m < 30);
      t.classList.toggle("late", e.m >= 30);
      t.title = `Waiting ${e.label}`;
    });
  }

  async function advanceOrder(id, btn, target) {
    const o = S.orders.find((x) => x.id === id);
    const next = target || (o && FLOW[FLOW.indexOf(o.status) + 1]);
    if (!o || !next || next === o.status) return;
    UI.mine.add(id);
    const card = btn?.closest(".ticket") || $(`[data-ticket="${id}"]`);
    if (btn) btn.disabled = true;
    try {
      card?.classList.add("leaving");
      await Promise.all([api(`/api/orders/${id}/set-status/`, { method: "POST", body: { status: next } }), wait(card ? 300 : 0)]);
      UI.arrive = id; UI.ringCol = next;
      await load({ silent: true });
      toast(`Order #${id} → ${cap(next)}`, next === "completed" ? "Nice work! Ticket closed." : `Moved from ${o.status} to ${next}.`);
    } catch (e) {
      card?.classList.remove("leaving");
      if (btn) btn.disabled = false;
      toast("Couldn't update order", e.message, "error");
    }
  }

  function bindBoardDrag() {
    const board = $("#ordersBoard");
    const clear = () => {
      board.classList.remove("dragging-on");
      $$(".col", board).forEach((c) => c.classList.remove("drop-ok", "drop-no", "drop-hover"));
      $$(".ticket.dragging", board).forEach((t) => t.classList.remove("dragging"));
      UI.dragId = null;
    };
    board.addEventListener("dragstart", (e) => {
      const t = e.target.closest?.(".ticket[draggable='true']");
      if (!t) return;
      const o = S.orders.find((x) => x.id === Number(t.dataset.ticket));
      const ok = dropTargets(o);
      UI.dragId = o.id;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(o.id));
      requestAnimationFrame(() => t.classList.add("dragging"));
      board.classList.add("dragging-on");
      $$(".col", board).forEach((c) => {
        if (c.dataset.stage === o.status) return;
        c.classList.add(ok.includes(c.dataset.stage) ? "drop-ok" : "drop-no");
      });
    });
    board.addEventListener("dragover", (e) => {
      const col = e.target.closest?.(".col.drop-ok");
      if (!col) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      $$(".col.drop-hover", board).forEach((c) => c !== col && c.classList.remove("drop-hover"));
      col.classList.add("drop-hover");
    });
    board.addEventListener("dragleave", (e) => {
      const col = e.target.closest?.(".col");
      if (col && !col.contains(e.relatedTarget)) col.classList.remove("drop-hover");
    });
    board.addEventListener("drop", (e) => {
      const col = e.target.closest?.(".col.drop-ok");
      const id = UI.dragId;
      clear();
      if (!col || !id) return;
      e.preventDefault();
      advanceOrder(id, null, col.dataset.stage);
    });
    board.addEventListener("dragend", clear);
  }

  async function cancelOrder(id, btn) {
    if (!(await confirmDialog(`Cancel order #${id}?`, "It will be removed from the kitchen board. Ingredients already used are not returned to stock.", "Cancel order"))) return;
    const card = btn?.closest(".ticket");
    UI.mine.add(id);
    card?.classList.add("cancelling");
    try {
      await Promise.all([api(`/api/orders/${id}/set-status/`, { method: "POST", body: { status: "cancelled" } }), wait(card ? 280 : 0)]);
      await load({ silent: true });
      toast(`Order #${id} cancelled`);
    } catch (e) {
      card?.classList.remove("cancelling");
      toast("Couldn't cancel order", e.message, "error");
    }
  }

  // Floor plan --------------------------------------------------------------
  const SHIRTS = ["#2f6fdc", "#ea6a2a", "#6d4fd8", "#0f9488", "#c2417a", "#15803d"];
  const HAIR = ["#3b2a20", "#1f1a17", "#7a4b2a", "#b88652", "#5b5b5b"];
  const DISH = ["#e0892f", "#d9534f", "#8bbf3f", "#f2c14e", "#b45f3c"];

  // Top-down table with chairs, place settings and guests.
  function tableSVG(t) {
    const n = Math.max(1, Math.min(t.capacity, 12)), cx = 110, cy = 80, st = t.status;
    const seated = st === "occupied" ? Math.min(n, Math.max(2, Math.ceil(n * 0.75))) : 0;
    const seats = [];
    let top;
    if (n <= 4) {
      const R = 34;
      top = `<circle class="t-halo" cx="${cx}" cy="${cy}" r="${R + 6}"/><circle class="t-ring" cx="${cx}" cy="${cy}" r="${R + 3.5}"/><circle class="t-top" cx="${cx}" cy="${cy}" r="${R}"/><circle class="t-grain" cx="${cx}" cy="${cy}" r="${R - 7}"/>`;
      for (let i = 0; i < n; i++) {
        const a = ((-90 + (360 / n) * i) * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a);
        seats.push({ x: cx + dx * (R + 15), y: cy + dy * (R + 15), rot: (a * 180) / Math.PI - 90, px: cx + dx * (R - 14), py: cy + dy * (R - 14) });
      }
    } else {
      const topN = Math.ceil(n / 2), botN = n - topN, w = Math.min(196, 34 + topN * 32), h = 58, x = cx - w / 2, y = cy - h / 2;
      top = `<rect class="t-halo" x="${x - 6}" y="${y - 6}" width="${w + 12}" height="${h + 12}" rx="21"/><rect class="t-ring" x="${x - 3.5}" y="${y - 3.5}" width="${w + 7}" height="${h + 7}" rx="18"/><rect class="t-top" x="${x}" y="${y}" width="${w}" height="${h}" rx="15"/><rect class="t-grain" x="${x + 7}" y="${y + 7}" width="${w - 14}" height="${h - 14}" rx="10"/>`;
      const row = (count, up) => {
        for (let i = 0; i < count; i++) {
          const px = x + (w / count) * (i + 0.5);
          seats.push({ x: px, y: up ? y - 14 : y + h + 14, rot: up ? 180 : 0, px, py: up ? y + 13 : y + h - 13 });
        }
      };
      row(topN, true); row(botN, false);
    }
    const at = (x, y, rot = 0) => `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(1)})`;
    const chairs = seats.map((c, i) => {
      const guest = i < seated
        ? `<g class="guest" style="--c:${i}"><ellipse cx="0" cy="4" rx="11" ry="6.5" fill="${SHIRTS[(t.id * 3 + i) % SHIRTS.length]}"/><ellipse cx="0" cy="-3" rx="5" ry="3.6" fill="#f2c9a5"/><circle cx="0" cy="1" r="6" fill="${HAIR[(t.id + i) % HAIR.length]}"/></g>`
        : "";
      return `<g transform="${at(c.x, c.y, c.rot)}"><g class="chair-slide" style="--c:${i}"><rect class="c-seat" x="-11" y="-9" width="22" height="18" rx="5"/><rect class="c-back" x="-12.5" y="7" width="25" height="6.5" rx="3.2"/>${guest}</g></g>`;
    }).join("");
    const settings = seats.map((c, i) => {
      const inner = i < seated
        ? `<circle class="p-plate" r="7.5"/><circle r="4.8" fill="${DISH[(t.id + i) % DISH.length]}"/><circle cx="-1.6" cy="-1.6" r="1.3" fill="#fff" opacity=".65"/>`
        : `<circle class="p-plate" r="6.5"/><circle class="p-inner" r="3.8"/><path class="p-cut" d="M-10 -4v8M10 -4v8"/>`;
      return `<g transform="${at(c.px, c.py, c.rot)}"><g class="setting" style="--c:${i}">${inner}</g></g>`;
    }).join("");
    const steam = seats.slice(0, Math.min(seated, 3)).map((c, i) =>
      `<g transform="${at(c.px, c.py)}"><g class="t-steam" style="--c:${i}"><path d="M-3 -7q-3-4 0-8q3-4 0-8"/><path d="M3 -9q-3-4 0-8q3-4 0-8"/></g></g>`).join("");
    const centre = st === "occupied"
      ? `<g transform="${at(cx, cy)}"><circle class="t-glow" r="12"/><circle r="4.2" fill="#fff3d6" stroke="#d9a441" stroke-width="1.2"/><path class="t-flame" d="M0-11c3 3 3 6 0 7c-3-1-3-4 0-7z"/></g>`
      : st === "reserved"
        ? `<g transform="${at(cx, cy)}"><g class="tent"><rect x="-24" y="-8.5" width="48" height="17" rx="3"/><text y="0.5">RESERVED</text></g></g>`
        : `<g transform="${at(cx, cy)}"><g class="vase"><circle r="6.5" fill="#fff" stroke="#e2ddd3"/><circle cx="0" cy="-3" r="2.7" fill="#f472b6"/><circle cx="3" cy="1.2" r="2.7" fill="#fb923c"/><circle cx="-3" cy="1.6" r="2.7" fill="#facc15"/><circle r="1.7" fill="#65a30d"/></g></g>`;
    return `<svg class="floor-svg" viewBox="0 0 220 160" aria-hidden="true">${chairs}${top}${settings}${centre}${steam}</svg>`;
  }

  function renderTables() {
    const floor = $("#floor");
    const count = (s) => S.tables.filter((t) => t.status === s).length;
    renderTabs($("#tableFilters"), [
      ["all", "All", S.tables.length], ["available", "Available", count("available")],
      ["reserved", "Reserved", count("reserved")], ["occupied", "Occupied", count("occupied")],
    ], UI.tableFilter, (k) => { UI.tableFilter = k; renderTables(); playEntrance(); });
    if (!S.loaded) { floor.innerHTML = Array.from({ length: 6 }, () => `<div class="panel tcard"><div class="skel" style="height:250px"></div></div>`).join(""); return; }

    const todayStr = isoDate(new Date());
    const tables = [...S.tables]
      .filter((t) => UI.tableFilter === "all" || t.status === UI.tableFilter)
      .filter((t) => matches(`table ${t.table_number}`, t.status, `${t.capacity} seats`))
      .sort((a, b) => a.table_number - b.table_number);

    floor.innerHTML = tables.length ? tables.map((t, idx) => {
      const order = activeOrders().find((o) => o.table === t.id);
      const nextRes = upcomingReservations().find((r) => r.table === t.id && r.reservation_date === todayStr);
      const info = order
        ? `${emo("🔥")}<span>Order <b>#${order.id}</b> · ${order.status} · <b>${money(order.total_price)}</b></span>`
        : nextRes
          ? `${emo("📅")}<span><b>${timeOf(resDate(nextRes))}</b> · ${esc(nextRes.customer_name)} (${nextRes.number_of_guests})</span>`
          : `${emo("✨")}<span>No activity yet today</span>`;
      return `
        <article class="panel tcard ${esc(t.status)} ${UI.flashTable === t.id ? "flash" : ""} reveal" style="--i:${idx}">
          <div class="tcard-visual">
            ${badge(t.status)}
            ${tableSVG(t)}
          </div>
          <div class="tcard-body">
            <div class="tcard-name"><b>Table ${t.table_number}</b><span>${icon("users", "i-xs")}${t.capacity} seats</span></div>
            <div class="tcard-info">${info}</div>
            <div class="seg" role="group" aria-label="Set status for table ${t.table_number}">
              ${["available", "reserved", "occupied"].map((s) => `<button type="button" data-table="${t.id}" data-status="${s}" aria-pressed="${t.status === s}" ${can("table_status") ? "" : 'disabled title="Only waiters and managers can change table status"'}><i class="dot ${s}"></i>${cap(s)}</button>`).join("")}
            </div>
            <button class="btn btn-sm" data-open="order" data-perm="create_order" data-order-table="${t.id}">${icon("plus", "i-xs")}New order for table ${t.table_number}</button>
          </div>
        </article>`;
    }).join("") : `<div class="panel" style="grid-column:1/-1">${empty("🔍", "No tables match", "Try another filter or search term.")}</div>`;
    UI.flashTable = null;
  }

  async function setTableStatus(id, status) {
    const t = S.tables.find((x) => x.id === id);
    if (!t || t.status === status) return;
    UI.flashTable = id;
    await mutate(() => api(`/api/tables/${id}/`, { method: "PATCH", body: { status } }), `Table ${t.table_number} is now ${status}`).catch(() => {});
  }

  // Reservations ------------------------------------------------------------
  function renderReservations() {
    const now = Date.now(), todayStr = isoDate(new Date());
    const live = (r) => ["pending", "confirmed"].includes(r.status);
    const grace = 30 * 60 * 1000;
    const filters = {
      upcoming: (r) => live(r) && resDate(r) >= now - grace,
      today: (r) => r.reservation_date === todayStr && r.status !== "cancelled",
      past: (r) => r.status === "completed" || (live(r) && resDate(r) < now - grace),
      cancelled: (r) => r.status === "cancelled",
      all: () => true,
    };
    renderTabs($("#resFilters"), [
      ["upcoming", "Upcoming", S.reservations.filter(filters.upcoming).length], ["today", "Today", S.reservations.filter(filters.today).length],
      ["past", "Past", S.reservations.filter(filters.past).length], ["cancelled", "Cancelled", S.reservations.filter(filters.cancelled).length],
      ["all", "All", S.reservations.length],
    ], UI.resFilter, (k) => { UI.resFilter = k; renderReservations(); });
    if (!S.loaded) { $("#resTable").innerHTML = `<tbody><tr><td>${skeletonRows(4)}</td></tr></tbody>`; return; }

    const desc = UI.resFilter === "past" || UI.resFilter === "cancelled";
    const rows = S.reservations
      .filter(filters[UI.resFilter])
      .filter((r) => matches(r.customer_name, r.customer_email, `table ${r.table_number}`, r.status))
      .sort((a, b) => (desc ? resDate(b) - resDate(a) : resDate(a) - resDate(b)));

    $("#resTable").innerHTML = rows.length
      ? `<thead><tr><th>Guest</th><th>When</th><th>Party</th><th>Table</th><th>Status</th><th class="r"><span class="sr-only">Actions</span></th></tr></thead><tbody>${rows.map((r) => { const d = resDate(r); return `
        <tr>
          <td><div class="guest">${avatar(r.customer_name)}<div><div class="cell-main">${esc(r.customer_name)}</div><div class="cell-sub">${esc(r.customer_email)}</div></div></div></td>
          <td><div class="cell-main" style="font-weight:550">${timeOf(d)} <span class="muted" style="font-weight:400">· ${dayOf(d)}</span></div><div class="cell-sub">${live(r) ? until(d) : ""}</div></td>
          <td><span style="display:inline-flex;align-items:center;gap:6px">${icon("users", "i-sm muted")}${r.number_of_guests}</span></td>
          <td>Table ${esc(r.table_number ?? r.table)}</td>
          <td>${badge(r.status)}</td>
          <td><div class="row-actions">${live(r) && can("reserve") ? `
            <button class="btn btn-sm" data-complete-res="${r.id}">${icon("check", "i-xs")}Seated</button>
            <button class="btn btn-ghost btn-icon btn-sm btn-danger" data-cancel-res="${r.id}" aria-label="Cancel reservation for ${esc(r.customer_name)}" data-tip="Cancel reservation">${icon("ban", "i-sm")}</button>` : ""}
          </div></td>
        </tr>`; }).join("")}</tbody>`
      : `<tbody><tr><td>${empty(UI.q ? "🔍" : "📭", UI.q ? "No matching reservations" : "No reservations here", UI.q ? "Try a different search term." : "Bookings in this view will appear here.", UI.q ? "" : `<button class="btn btn-sm btn-primary" data-open="reservation" data-perm="reserve">${icon("plus", "i-xs")}Book a table</button>`)}</td></tr></tbody>`;
  }

  async function cancelReservation(id) {
    const r = S.reservations.find((x) => x.id === id);
    if (!r || !(await confirmDialog("Cancel this reservation?", `${r.customer_name} · ${plural(r.number_of_guests, "guest")} · ${dayOf(resDate(r))} at ${timeOf(resDate(r))}`, "Cancel reservation"))) return;
    await mutate(() => api(`/api/reservations/${id}/cancel/`, { method: "POST" }), "Reservation cancelled", `${r.customer_name}'s booking was cancelled.`).catch(() => {});
  }
  async function completeReservation(id) {
    const r = S.reservations.find((x) => x.id === id);
    if (!r) return;
    await mutate(() => api(`/api/reservations/${id}/`, { method: "PATCH", body: { status: "completed" } }), "Guests seated 🎉", `Welcome, ${r.customer_name}!`).catch(() => {});
  }

  // Menu --------------------------------------------------------------------
  function renderMenu() {
    const wrap = $("#menuSections");
    if (!S.loaded) { wrap.innerHTML = `<div class="menu-grid">${Array.from({ length: 3 }, () => `<div class="panel dish"><div class="skel" style="height:240px"></div></div>`).join("")}</div>`; return; }
    const available = S.menu.filter((m) => m.is_available).length;
    $("#menuLine").textContent = `${available} of ${plural(S.menu.length, "dish")} available to order right now.`.replace("dishs", "dishes");

    const sold = soldByItem(), groups = {};
    S.menu.filter((m) => matches(m.name, m.description, m.category_name)).forEach((m) => (groups[m.category_name || "Uncategorized"] ||= []).push(m));
    let i = 0;
    wrap.innerHTML = Object.keys(groups).sort().map((g) => `
      <section class="menu-section">
        <h2>${emo(foodEmoji({ category_name: g }))}${esc(g)}<span class="badge plain">${groups[g].length}</span></h2>
        <div class="menu-grid">${groups[g].map((m) => `
          <article class="panel dish ${m.is_available ? "" : "off"} ${foodClass(m)} reveal" style="--i:${i++}">
            <div class="dish-visual">
              ${sold[m.id] ? `<span class="dish-sold">${emo("🔥")}${sold[m.id].qty} sold</span>` : ""}
              ${m.is_available ? fx(m) : ""}
              ${emo(foodEmoji(m))}
              <span class="dish-price">${money(m.price)}</span>
            </div>
            <div class="dish-body">
              <div><h3>${esc(m.name)}</h3><p>${esc(m.description || "No description yet")}</p></div>
              ${(m.recipe_items || []).length ? `<div class="chips">${m.recipe_items.map((r) => `<span class="chip">${stockEmoji(r.inventory_item_name)} ${esc(r.inventory_item_name)} · ${qtyFmt(r.quantity_required)}</span>`).join("")}</div>` : ""}
            </div>
            <label class="dish-foot" style="cursor:${can("menu_toggle") ? "pointer" : "default"}" ${can("menu_toggle") ? "" : 'title="Only kitchen staff and managers can change availability"'}>
              <span>${!m.is_available ? "Marked as sold out" : portionsLeft(m).max === 0 ? `<span style="color:var(--danger)">⚠ Out of ${esc(portionsLeft(m).short)}</span>` : "Available to order"}</span>
              <span class="switch"><input type="checkbox" data-menu-toggle="${m.id}" ${m.is_available ? "checked" : ""} ${can("menu_toggle") ? "" : "disabled"} aria-label="${esc(m.name)} available"><span></span></span>
            </label>
          </article>`).join("")}
        </div>
      </section>`).join("") || `<div class="panel">${empty(UI.q ? "🔍" : "🍽️", UI.q ? "No matching dishes" : "Your menu is empty", UI.q ? "Try a different search term." : "Add categories and dishes in Django admin.")}</div>`;
  }

  async function toggleMenuItem(id, on, input) {
    const m = S.menu.find((x) => x.id === id);
    input.disabled = true;
    input.closest(".dish")?.classList.toggle("off", !on);
    await mutate(() => api(`/api/menu/${id}/`, { method: "PATCH", body: { is_available: on } }), on ? `${m.name} is back on the menu` : `${m.name} marked sold out`)
      .catch(() => { input.checked = !on; input.disabled = false; input.closest(".dish")?.classList.toggle("off", on); });
  }

  // Inventory ---------------------------------------------------------------
  function renderInventory() {
    const usedIn = {};
    S.menu.forEach((m) => (m.recipe_items || []).forEach((r) => (usedIn[r.inventory_item] ||= []).push(m.name)));
    const lvl = { ok: 0, low: 0, critical: 0 };
    S.inventory.forEach((i) => lvl[stockLevel(i)]++);
    renderTabs($("#invFilters"), [
      ["all", "All items", S.inventory.length], ["low", "Needs attention", lvl.low + lvl.critical], ["ok", "Healthy", lvl.ok],
    ], UI.invFilter, (k) => { UI.invFilter = k; renderInventory(); });
    if (!S.loaded) { $("#invTable").innerHTML = `<tbody><tr><td>${skeletonRows(4)}</td></tr></tbody>`; $("#invSummary").innerHTML = ""; return; }

    $("#invSummary").innerHTML = [
      ["teal", "check-circle", lvl.ok, "Healthy items"],
      ["amber", "alert", lvl.low, "Running low"],
      ["red", "alert-circle", lvl.critical, "Critical — restock now"],
    ].map(([tint, ic, n, label], i) => `<article class="panel inv-stat tint-${tint} reveal" style="--i:${i}"><span class="kpi-icon">${icon(ic)}</span><div><b>${n}</b><span>${label}</span></div></article>`).join("");

    const LABEL = { ok: "Healthy", low: "Low", critical: "Critical" };
    const rows = [...S.inventory]
      .filter((i) => UI.invFilter === "all" || (UI.invFilter === "low" ? stockLevel(i) !== "ok" : stockLevel(i) === "ok"))
      .filter((i) => matches(i.name, i.unit, (usedIn[i.id] || []).join(" ")))
      .sort((a, b) => num(a.quantity) / Math.max(num(a.low_stock_threshold), 0.01) - num(b.quantity) / Math.max(num(b.low_stock_threshold), 0.01));

    $("#invTable").innerHTML = rows.length
      ? `<thead><tr><th>Item</th><th>Stock level</th><th class="r">On hand</th><th class="r">Alert at</th><th>Status</th><th class="r"><span class="sr-only">Actions</span></th></tr></thead><tbody>${rows.map((i, idx) => {
          const q = num(i.quantity), t = num(i.low_stock_threshold), l = stockLevel(i);
          const pct = Math.min(100, (q / Math.max(t * 4, q, 1)) * 100);
          return `
          <tr>
            <td><div class="inv-item"><span class="inv-icon emoji">${stockEmoji(i.name)}</span><div><div class="cell-main">${esc(i.name)}</div><div class="cell-sub">${usedIn[i.id] ? `Used in ${esc(usedIn[i.id].join(", "))}` : "Not linked to a dish"}</div></div></div></td>
            <td><div class="stock" data-tip="${qtyFmt(q)} ${esc(i.unit)} on hand · alert at ${qtyFmt(t)} ${esc(i.unit)}"><div class="bar"><i class="grow ${l === "ok" ? "" : l}" style="--i:${idx};width:${Math.max(3, pct)}%"></i></div><small>${Math.round(pct)}%</small></div></td>
            <td class="r strong num">${qtyFmt(q)} <span class="muted" style="font-weight:400">${esc(i.unit)}</span></td>
            <td class="r num muted">${qtyFmt(t)} ${esc(i.unit)}</td>
            <td>${badge(l, LABEL[l])}</td>
            <td><div class="row-actions"><button class="btn btn-sm ${l === "ok" ? "" : "btn-primary"}" data-adjust="${i.id}" data-perm="stock">${icon(l === "ok" ? "edit" : "plus", "i-xs")}${l === "ok" ? "Adjust" : "Restock"}</button></div></td>
          </tr>`; }).join("")}</tbody>`
      : `<tbody><tr><td>${empty(UI.q ? "🔍" : "📦", UI.q ? "No matching items" : "Nothing to show", UI.q ? "Try a different search term." : "Inventory items in this view will appear here.")}</td></tr></tbody>`;
  }

  // ================================================================ modals
  let lastFocus = null;
  function openModal(name) {
    const m = $(`#modal-${name}`);
    lastFocus = document.activeElement;
    m.classList.add("open");
    setTimeout(() => $("input:not([type=hidden]), [aria-pressed='true'], button:not([data-close])", m)?.focus({ preventScroll: true }), 80);
  }
  function closeModal(m) {
    if (!m) return;
    m.classList.remove("open");
    lastFocus?.focus?.({ preventScroll: true });
  }
  const topModal = () => $$(".modal-bg.open").pop();

  let confirmResolve = null;
  function confirmDialog(title, body, okLabel = "Confirm") {
    $("#mc-title").textContent = title;
    $("#mc-body").textContent = body;
    $("#mc-ok").textContent = okLabel;
    openModal("confirm");
    return new Promise((resolve) => (confirmResolve = resolve));
  }
  function settleConfirm(v) {
    if (!confirmResolve) return;
    const r = confirmResolve; confirmResolve = null;
    closeModal($("#modal-confirm"));
    r(v);
  }
  function showFormError(id, msg) {
    const el = $(id);
    el.classList.remove("show");
    if (msg) { void el.offsetWidth; el.classList.add("show"); }
    $("span", el).textContent = msg || "";
  }

  // New order (POS) ---------------------------------------------------------
  const pos = { table: null, cat: "all", cart: new Map(), fresh: null, tapped: null };

  function prepareOrder(tableId) {
    const tables = [...S.tables].sort((a, b) => a.table_number - b.table_number);
    pos.table = tableId || (tables.find((t) => t.status === "available") || tables[0])?.id || null;
    pos.cat = "all"; pos.cart = new Map(); pos.fresh = null; pos.tapped = null;
    showFormError("#orderError", "");
    renderPOS();
  }

  function renderPOS() {
    const tables = [...S.tables].sort((a, b) => a.table_number - b.table_number);
    const sel = tables.find((t) => t.id === pos.table);
    $("#posTableHint").textContent = sel ? `${sel.capacity} seats · ${sel.status}` : "";
    $("#posTables").innerHTML = tables.map((t) => `<button type="button" class="pick" data-pos-table="${t.id}" aria-pressed="${t.id === pos.table}"><i class="dot ${esc(t.status)}"></i>Table ${t.table_number}</button>`).join("")
      || `<span class="hint">No tables configured yet.</span>`;

    const cats = [...new Set(S.menu.map((m) => m.category_name || "Uncategorized"))].sort();
    $("#posCats").innerHTML = [["all", "All dishes", "✨"], ...cats.map((c) => [c, c, foodEmoji({ category_name: c })])]
      .map(([k, l, e]) => `<button type="button" class="pick" data-pos-cat="${esc(k)}" aria-pressed="${k === pos.cat}">${emo(e)}${esc(l)}</button>`).join("");

    const items = S.menu.filter((m) => m.is_available && (pos.cat === "all" || (m.category_name || "Uncategorized") === pos.cat));
    $("#posGrid").innerHTML = items.length ? items.map((m) => {
      const q = pos.cart.get(m.id) || 0, { max, short } = portionsLeft(m), out = max === 0;
      return `<button type="button" class="pos-item ${q ? "in" : ""} ${out ? "out" : ""} ${pos.tapped === m.id ? "tap" : ""} ${foodClass(m)}" data-pos-add="${m.id}" ${out ? "disabled" : ""} aria-label="${out ? `${esc(m.name)} is out of stock` : `Add ${esc(m.name)}`}">
        ${q ? `<span class="pos-badge qty">${q}</span>` : out ? "" : `<span class="pos-badge add">${icon("plus", "i-sm")}</span>`}
        <div class="pos-item-visual">${out ? "" : fx(m)}${emo(foodEmoji(m))}${out ? `<span class="pos-out">Out of ${esc(short)}</span>` : ""}</div>
        <div class="pos-item-body"><b>${esc(m.name)}</b><span>${money(m.price)}${max !== Infinity && !out && max <= 10 ? ` <small class="pos-left">· ${max} left</small>` : ""}</span></div>
      </button>`;
    }).join("") : `<div style="grid-column:1/-1">${empty("🍽️", "Nothing to order", "No dishes are available in this category right now.")}</div>`;
    pos.tapped = null;
    renderCart();
  }

  function renderCart() {
    const lines = [...pos.cart.entries()].map(([id, q]) => ({ m: menuById(id), q })).filter((l) => l.m);
    const count = lines.reduce((s, l) => s + l.q, 0);
    const total = lines.reduce((s, l) => s + num(l.m.price) * l.q, 0);
    const cc = $("#cartCount");
    if (cc.textContent !== String(count)) { cc.textContent = count; cc.classList.remove("bump"); void cc.offsetWidth; cc.classList.add("bump"); }
    $("#cartItems").textContent = plural(count, "item");
    $("#cartTotal").textContent = money(total);
    $("#cartClear").hidden = !count;
    const sel = S.tables.find((t) => t.id === pos.table);
    $("#placeOrder span").textContent = count ? `Send to kitchen · ${money(total)}` : "Add dishes to start";
    $("#placeOrder").disabled = !count || !sel;
    $("#cartLines").innerHTML = lines.length ? lines.map(({ m, q }) => `
      <div class="cart-line ${pos.fresh === m.id ? "new" : ""} ${foodClass(m)}">
        <span class="emoji">${foodEmoji(m)}</span>
        <div style="min-width:0"><b>${esc(m.name)}</b><span>${money(m.price)} × ${q} = <b style="display:inline;color:var(--text)">${money(num(m.price) * q)}</b></span></div>
        <div class="stepper"><button type="button" data-cart-dec="${m.id}" aria-label="Remove one ${esc(m.name)}">${icon(q > 1 ? "minus" : "trash", "i-xs")}</button><output>${q}</output><button type="button" data-cart-inc="${m.id}" aria-label="Add one ${esc(m.name)}">${icon("plus", "i-xs")}</button></div>
      </div>`).join("")
      : `<div class="cart-empty"><span class="emoji">🛒</span><b>Your order is empty</b><span>Tap any dish to add it.</span></div>`;
    pos.fresh = null;
  }

  function cartAdd(id, delta) {
    const q = (pos.cart.get(id) || 0) + delta;
    const m = menuById(id), { max, short } = portionsLeft(m);
    if (delta > 0 && q > max) {
      showFormError("#orderError", max === 0 ? `${m.name} is out of stock (${short}).` : `Only ${max} × ${m.name} can be made with the ${short} in stock.`);
      return false;
    }
    if (q <= 0) pos.cart.delete(id);
    else { if (!pos.cart.has(id)) pos.fresh = id; pos.cart.set(id, q); }
    showFormError("#orderError", "");
    return true;
  }

  async function placeOrder() {
    const items = [...pos.cart.entries()].map(([menu_item, quantity]) => ({ menu_item, quantity }));
    if (!pos.table) return showFormError("#orderError", "Choose a table first.");
    if (!items.length) return showFormError("#orderError", "Add at least one dish.");
    const btn = $("#placeOrder");
    btn.disabled = true;
    try {
      const o = await api("/api/orders/", { method: "POST", body: { table: pos.table, status: "pending", items } });
      UI.mine.add(o.id);
      const r = btn.getBoundingClientRect();
      const foods = [...new Set([...pos.cart.keys()].map((id) => foodEmoji(menuById(id))))];
      confetti(r.left + r.width / 2, r.top + r.height / 2, [...foods, "🎉", "🛎️", "✨"]);
      closeModal($("#modal-order"));
      toast(`Order #${o.id} sent to the kitchen 🎉`, `Table ${o.table_number} · ${money(o.total_price)}`);
      await load({ silent: true });
    } catch (err) {
      showFormError("#orderError", err.message);
      btn.disabled = false;
    }
  }

  // New reservation ---------------------------------------------------------
  const rs = { date: null, time: null, guests: 2, table: null };
  const SLOTS = Array.from({ length: 24 }, (_, i) => `${pad(11 + Math.floor(i / 2))}:${i % 2 ? "30" : "00"}`);

  function prepareReservation() {
    const f = $("#resForm");
    f.reset();
    $$("[aria-invalid]", f).forEach((x) => x.removeAttribute("aria-invalid"));
    showFormError("#resError", "");
    rs.date = isoDate(new Date()); rs.time = null; rs.guests = 2; rs.table = null;
    renderResForm();
  }

  function slotPast(slot) {
    if (rs.date !== isoDate(new Date())) return false;
    const [h, m] = slot.split(":").map(Number), d = new Date(); d.setHours(h, m, 0, 0);
    return d.getTime() < Date.now();
  }
  function bookedTables() {
    if (!rs.date || !rs.time) return new Set();
    return new Set(S.reservations.filter((r) => r.status !== "cancelled" && r.reservation_date === rs.date && String(r.reservation_time).slice(0, 5) === rs.time).map((r) => r.table));
  }

  function renderResForm() {
    // Dates: next 7 days + custom picker
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; });
    const inChips = days.some((d) => isoDate(d) === rs.date);
    $("#resDates").innerHTML = days.map((d, i) => {
      const k = isoDate(d);
      const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-US", { weekday: "short" });
      return `<button type="button" class="pick" data-res-date="${k}" aria-pressed="${k === rs.date}" style="flex-direction:column;gap:0;min-height:48px;padding:4px 12px"><span>${label}</span><small>${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</small></button>`;
    }).join("") + `<input class="input" type="date" id="resDateInput" min="${isoDate(new Date())}" value="${inChips ? "" : rs.date}" aria-label="Pick another date" style="max-width:170px;height:48px">`;

    // Time slots
    if (!rs.time || slotPast(rs.time)) rs.time = SLOTS.find((s) => !slotPast(s)) || null;
    $("#resSlots").innerHTML = SLOTS.map((s) => {
      const [h, m] = s.split(":").map(Number), label = new Date(2000, 0, 1, h, m).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      return `<button type="button" class="pick" data-res-time="${s}" aria-pressed="${s === rs.time}" ${slotPast(s) ? "disabled" : ""}>${label}</button>`;
    }).join("");
    $("#resTimeHint").textContent = rs.time ? "" : "No slots left today — pick another date";

    // Party size
    const maxCap = Math.max(8, ...S.tables.map((t) => t.capacity));
    $("#resGuests").innerHTML = Array.from({ length: Math.min(maxCap, 12) }, (_, i) => i + 1)
      .map((n) => `<button type="button" class="pick round" data-res-guests="${n}" aria-pressed="${n === rs.guests}">${n}</button>`).join("");

    // Tables
    const booked = bookedTables();
    const tables = [...S.tables].sort((a, b) => a.capacity - b.capacity || a.table_number - b.table_number);
    const ok = (t) => t.capacity >= rs.guests && !booked.has(t.id);
    if (!tables.some((t) => t.id === rs.table && ok(t))) rs.table = tables.find(ok)?.id || null;
    $("#resTables").innerHTML = tables.map((t) => {
      const why = t.capacity < rs.guests ? "Too small" : booked.has(t.id) ? "Already booked" : `${t.capacity} seats`;
      return `<button type="button" class="pick" data-res-table="${t.id}" aria-pressed="${t.id === rs.table}" ${ok(t) ? "" : "disabled"}><span>Table ${t.table_number}</span><small>${why}</small></button>`;
    }).join("") || `<span class="hint">No tables configured yet.</span>`;
    const fits = tables.filter(ok).length;
    $("#resTableHint").textContent = tables.length ? `${fits} of ${tables.length} available` : "";

    const sel = S.tables.find((t) => t.id === rs.table);
    $("#resSubmitLabel").textContent = sel && rs.time ? `Book table ${sel.table_number} · ${dayOf(new Date(`${rs.date}T${rs.time}`))} ${timeOf(new Date(`${rs.date}T${rs.time}`))}` : "Confirm booking";
  }

  async function submitReservation(e) {
    e.preventDefault();
    const f = e.currentTarget;
    showFormError("#resError", "");
    $$("[aria-invalid]", f).forEach((x) => x.removeAttribute("aria-invalid"));
    const bad = $$("input[required]", f).find((x) => !x.checkValidity() || !x.value.trim());
    if (bad) {
      bad.setAttribute("aria-invalid", "true"); bad.focus();
      return showFormError("#resError", bad.type === "email" ? "Please enter a valid email address." : "Please enter the guest's name.");
    }
    if (!rs.time) return showFormError("#resError", "Pick a time slot.");
    if (!rs.table) return showFormError("#resError", `No free table seats ${rs.guests} at that time. Try another time or party size.`);
    const body = {
      customer_name: f.customer_name.value.trim(), customer_email: f.customer_email.value.trim(),
      table: rs.table, reservation_date: rs.date, reservation_time: `${rs.time}:00`, number_of_guests: rs.guests, status: "confirmed",
    };
    const btn = $("button[type=submit]", f);
    btn.disabled = true;
    try {
      await api("/api/reservations/", { method: "POST", body });
      const r = btn.getBoundingClientRect();
      confetti(r.left + r.width / 2, r.top + r.height / 2, ["🥂", "🍷", "🪑", "✨", "🎉"]);
      closeModal($("#modal-reservation"));
      toast("Table booked 🎉", `${body.customer_name} · ${plural(body.number_of_guests, "guest")} · ${dayOf(new Date(`${rs.date}T${rs.time}`))} ${timeOf(new Date(`${rs.date}T${rs.time}`))}`);
      await load({ silent: true });
    } catch (err) { showFormError("#resError", err.message); }
    finally { btn.disabled = false; }
  }

  // Stock -------------------------------------------------------------------
  let stockItem = null;
  function prepareStock(id) {
    stockItem = S.inventory.find((i) => i.id === id);
    const u = stockItem.unit;
    $("#stockEmoji").textContent = stockEmoji(stockItem.name);
    $("#ms-title").lastChild.textContent = stockItem.name;
    $("#stockName").textContent = `Currently ${qtyFmt(stockItem.quantity)} ${u} on hand · alert at ${qtyFmt(stockItem.low_stock_threshold)} ${u}`;
    $("#stockQty").value = qtyFmt(stockItem.quantity);
    $("#stockThreshold").value = qtyFmt(stockItem.low_stock_threshold);
    const t = num(stockItem.low_stock_threshold) || 5;
    const steps = [...new Set([Math.ceil(t), Math.ceil(t * 2), Math.ceil(t * 5)])];
    $("#stockQuick").innerHTML = steps.map((s) => `<button type="button" class="pick" data-stock-add="${s}">+${s} ${esc(u)}</button>`).join("")
      + `<button type="button" class="pick" data-stock-set="${Math.ceil(t * 4)}">Fill to ${Math.ceil(t * 4)} ${esc(u)}</button>`;
    showFormError("#stockError", "");
  }

  async function submitStock(e) {
    e.preventDefault();
    const q = $("#stockQty").value, t = $("#stockThreshold").value;
    if (q === "" || t === "" || num(q) < 0 || num(t) < 0) return showFormError("#stockError", "Enter quantities of zero or more.");
    const btn = $("button[type=submit]", e.currentTarget);
    btn.disabled = true;
    try {
      await api(`/api/inventory/${stockItem.id}/`, { method: "PATCH", body: { quantity: num(q).toFixed(2), low_stock_threshold: num(t).toFixed(2) } });
      closeModal($("#modal-stock"));
      toast("Stock updated", `${stockItem.name} now at ${qtyFmt(q)} ${stockItem.unit}`);
      await load({ silent: true });
    } catch (err) { showFormError("#stockError", err.message); }
    finally { btn.disabled = false; }
  }

  // ================================================================ feedback
  function toast(title, msg = "", type = "success") {
    const dur = type === "error" ? 6000 : 3800;
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.setAttribute("role", type === "error" ? "alert" : "status");
    el.innerHTML = `<span class="toast-ic">${icon(type === "error" ? "alert-circle" : "check", "i-sm")}</span><div><b>${esc(title)}</b>${msg ? `<span>${esc(msg)}</span>` : ""}</div><span class="toast-bar" style="animation-duration:${dur}ms"></span>`;
    $("#toasts").appendChild(el);
    const kill = () => { el.classList.add("out"); setTimeout(() => el.remove(), 250); };
    const t = setTimeout(kill, dur);
    el.onclick = () => { clearTimeout(t); kill(); };
    while ($("#toasts").children.length > 4) $("#toasts").firstElementChild.remove();
  }

  function flyToCart(fromEl, emoji) {
    const target = $("#cartCount");
    if (reduceMotion() || !fromEl || !target || !fromEl.animate) return;
    const a = fromEl.getBoundingClientRect(), b = target.getBoundingClientRect();
    const f = document.createElement("span");
    f.className = "flyer emoji";
    f.textContent = emoji;
    const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2;
    f.style.left = `${x0}px`; f.style.top = `${y0}px`;
    document.body.appendChild(f);
    const dx = b.left + b.width / 2 - x0, dy = b.top + b.height / 2 - y0;
    f.animate([
      { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
      { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - 110}px)) scale(1.2) rotate(-18deg)`, opacity: 1, offset: 0.45 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.3) rotate(25deg)`, opacity: 0.5 },
    ], { duration: 720, easing: "cubic-bezier(.45,0,.55,1)" }).onfinish = () => {
      f.remove();
      target.classList.remove("bump"); void target.offsetWidth; target.classList.add("bump");
    };
  }

  // Celebration burst: food emoji + ribbons.
  function confetti(x, y, emojis = ["🎉", "✨"]) {
    if (reduceMotion()) return;
    const colors = ["#2dd4bf", "#fb923c", "#a3e635", "#f472b6", "#60a5fa", "#facc15"];
    const box = document.createElement("div");
    box.className = "confetti";
    box.innerHTML = Array.from({ length: 40 }, (_, i) => {
      const a = Math.random() * Math.PI * 2, d = 90 + Math.random() * 230, isEmoji = i % 3 === 0;
      const style = `left:${x}px;top:${y}px;--dx:${(Math.cos(a) * d).toFixed(0)}px;--dy:${(Math.sin(a) * d - 70 + Math.random() * 170).toFixed(0)}px;--rot:${Math.floor(Math.random() * 720 - 360)}deg;animation-delay:${Math.random() * 90}ms`;
      return isEmoji
        ? `<i class="e emoji" style="${style}">${emojis[i % emojis.length]}</i>`
        : `<i style="${style};background:${colors[i % colors.length]}"></i>`;
    }).join("");
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 1700);
  }

  const tip = $("#vizTip");
  document.addEventListener("mousemove", (e) => {
    const t = e.target.closest?.("[data-tip]");
    if (!t) { tip.classList.remove("show"); return; }
    tip.textContent = t.dataset.tip;
    tip.style.left = `${Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8)}px`;
    tip.style.top = `${e.clientY - tip.offsetHeight - 12}px`;
    tip.classList.add("show");
  });

  // ================================================================ routing & chrome
  function moveIndicator() {
    const a = $("[data-route][aria-current]"), ind = $("#navIndicator");
    if (!a) { ind.style.opacity = 0; return; }
    ind.style.opacity = 1;
    ind.style.transform = `translateY(${a.offsetTop}px)`;
  }

  function go(route) {
    if (!ROUTES[route]) route = "overview";
    const changed = UI.route !== route;
    UI.route = route;
    $$(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${route}`));
    $$("[data-route]").forEach((b) => (b.dataset.route === route ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current")));
    moveIndicator();
    $("#crumb").textContent = ROUTES[route];
    document.title = `${ROUTES[route]} · TableMint`;
    const search = $("#search");
    search.placeholder = route === "overview" ? "Search orders, guests, dishes…" : `Search ${ROUTES[route].toLowerCase()}…`;
    if (changed) {
      if (!UI.keepQ) { search.value = ""; UI.q = ""; }
      UI.keepQ = false;
      if (S.loaded) render();
      window.scrollTo({ top: 0 });
    }
    if (S.loaded) playEntrance();
    closeSidebar();
  }
  const closeSidebar = () => { $("#sidebar").classList.remove("open"); $("#scrim").classList.remove("open"); };

  const currentTheme = () => document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const syncThemeIcon = () => $("#themeToggle use").setAttribute("href", currentTheme() === "dark" ? "#i-sun" : "#i-moon");

  function clock() {
    const n = new Date();
    $("#heroClock").textContent = n.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" });
  }

  // ================================================================ events
  function bind() {
    window.addEventListener("hashchange", () => go(location.hash.slice(1)));
    window.addEventListener("resize", moveIndicator);
    $$("[data-route]").forEach((b) => (b.onclick = () => { location.hash = b.dataset.route; }));
    $("#menuToggle").onclick = () => { $("#sidebar").classList.add("open"); $("#scrim").classList.add("open"); };
    $("#scrim").onclick = closeSidebar;
    $("#refreshBtn").onclick = () => load({ notify: true });
    bindBoardDrag();
    $$("[data-ov-tab]").forEach((b) => (b.onclick = () => { UI.ovTab = b.dataset.ovTab; renderOverview(); applyPerms(); }));
    $("#themeToggle").onclick = () => {
      const ic = $("#themeToggle .i");
      ic.classList.remove("spin-once"); void ic.getBBox(); ic.classList.add("spin-once");
      const next = currentTheme() === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      storage.set("tm-theme", next);
      syncThemeIcon();
    };
    matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", syncThemeIcon);

    $("#search").addEventListener("input", (e) => {
      UI.q = e.target.value.trim().toLowerCase();
      if (UI.route === "overview" && UI.q) { UI.keepQ = true; location.hash = "orders"; return; }
      render();
    });
    $$("[data-orders-mode]").forEach((b) => (b.onclick = () => {
      UI.ordersMode = b.dataset.ordersMode; storage.set("tm-orders-mode", UI.ordersMode); renderOrders(); playEntrance();
    }));

    document.addEventListener("click", (e) => {
      const t = e.target.closest("button, a");
      if (!t) {
        if (e.target.classList?.contains("modal-bg")) e.target.id === "modal-confirm" ? settleConfirm(false) : closeModal(e.target);
        return;
      }
      const d = t.dataset;
      if (d.open) {
        if (!S.loaded) return toast("Still loading", "Please wait a moment for data to load.", "error");
        if (!can(d.open === "order" ? "create_order" : "reserve")) return toast("Not available for your role", `${S.me?.role_label || "Your"} accounts can't do this.`, "error");
        if (d.open === "order") prepareOrder(Number(d.orderTable) || null);
        if (d.open === "reservation") prepareReservation();
        openModal(d.open);
      }
      if (d.go) location.hash = d.go;
      if ("close" in d) { const m = t.closest(".modal-bg"); m.id === "modal-confirm" ? settleConfirm(false) : closeModal(m); }
      if (d.advance) advanceOrder(Number(d.advance), t);
      if (d.cancelOrder) cancelOrder(Number(d.cancelOrder), t);
      if (d.table && d.status) setTableStatus(Number(d.table), d.status);
      if (d.cancelRes) cancelReservation(Number(d.cancelRes));
      if (d.completeRes) completeReservation(Number(d.completeRes));
      if (d.adjust) { prepareStock(Number(d.adjust)); openModal("stock"); }
      if (t.id === "mc-ok") settleConfirm(true);

      // POS
      if (d.posTable) { pos.table = Number(d.posTable); renderPOS(); }
      if (d.posCat) { pos.cat = d.posCat; renderPOS(); }
      if (d.posAdd) { const id = Number(d.posAdd), el = $(".pos-item-visual .emoji", t); if (cartAdd(id, 1)) flyToCart(el, foodEmoji(menuById(id))); pos.tapped = id; renderPOS(); $(`[data-pos-add="${id}"]`)?.focus({ preventScroll: true }); }
      if (d.cartInc) { cartAdd(Number(d.cartInc), 1); renderPOS(); }
      if (d.cartDec) { cartAdd(Number(d.cartDec), -1); renderPOS(); }
      if (t.id === "cartClear") { pos.cart.clear(); renderPOS(); }
      if (t.id === "placeOrder") placeOrder();

      // Reservation chips
      if (d.resDate) { rs.date = d.resDate; renderResForm(); }
      if (d.resTime) { rs.time = d.resTime; renderResForm(); }
      if (d.resGuests) { rs.guests = Number(d.resGuests); renderResForm(); }
      if (d.resTable) { rs.table = Number(d.resTable); renderResForm(); }

      // Stock quick actions
      if (d.stockAdd) $("#stockQty").value = qtyFmt(num($("#stockQty").value) + Number(d.stockAdd));
      if (d.stockSet) $("#stockQty").value = d.stockSet;
    });

    document.addEventListener("change", (e) => {
      const id = e.target.dataset?.menuToggle;
      if (id) toggleMenuItem(Number(id), e.target.checked, e.target);
      if (e.target.id === "resDateInput" && e.target.value) { rs.date = e.target.value; renderResForm(); }
    });

    $("#resForm").addEventListener("submit", submitReservation);
    $("#stockForm").addEventListener("submit", submitStock);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const m = topModal();
        if (m) return m.id === "modal-confirm" ? settleConfirm(false) : closeModal(m);
        closeSidebar();
        return;
      }
      const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName);
      if (typing || e.metaKey || e.ctrlKey || e.altKey || topModal()) return;
      if (e.key === "/") { e.preventDefault(); $("#search").focus(); }
      else if (e.key.toLowerCase() === "n" && S.loaded && can("create_order")) { prepareOrder(); openModal("order"); }
      else if (e.key.toLowerCase() === "b" && S.loaded && can("reserve")) { prepareReservation(); openModal("reservation"); }
      else if (e.key.toLowerCase() === "r") load({ notify: true });
      else if (/^[1-6]$/.test(e.key)) location.hash = Object.keys(ROUTES)[Number(e.key) - 1];
    });
  }

  // ================================================================ who's signed in
  async function loadMe() {
    try {
      S.me = await api("/api/me/");
    } catch (e) {
      toast("Couldn't load your account", e.message, "error");
      return;
    }
    $("#userName").textContent = S.me.name;
    $("#userRole").textContent = S.me.role_label;
    $("#userRole").dataset.role = S.me.role;
    $("#userAvatar").textContent = initials(S.me.name);
    $("#userAvatar").style.setProperty("--av", avatarColor(S.me.name));
    $("#userCard").hidden = false;
    document.documentElement.dataset.role = S.me.role;
    applyPerms();
    try {
      if (!sessionStorage.getItem("tm-welcomed")) {
        sessionStorage.setItem("tm-welcomed", "1");
        const hints = { manager: "You have full access, including stock and admin.", waiter: "Take orders, seat guests and manage bookings.", kitchen: "Cook tickets and mark dishes sold out." };
        toast(`Signed in as ${S.me.role_label}`, hints[S.me.role] || "");
      }
    } catch { /* storage unavailable */ }
  }

  // ================================================================ boot
  bind();
  syncThemeIcon();
  render();
  clock();
  (async () => {
    await loadMe();
    // The kitchen lives on the order board; everyone else starts on the overview.
    go(location.hash.slice(1) || (S.me?.role === "kitchen" ? "orders" : "overview"));
    load();
  })();
  setInterval(clock, 1000);
  setInterval(tickTimers, 15000);
  setInterval(() => { if (!document.hidden && !topModal()) load({ silent: true }); }, 30000);
  setInterval(() => updateSyncLabel(), 15000);
})();
