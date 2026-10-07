// Calendar / To Do / Recurring Payments / Events — vanilla ES module, data in localStorage.

const KEY = "calendar-task-app:v1";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const FREQS = { weekly: "Weekly", biweekly: "Every 2 weeks", monthly: "Monthly", yearly: "Yearly" };

// ---------- dates (local, "YYYY-MM-DD") ----------
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const todayIso = () => iso(new Date());
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
const fmtLong = (s) => parse(s).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const fmtTime = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? "AM" : "PM"}`;
};
const money = (n) => Number(n).toLocaleString(undefined, { style: "currency", currency: "USD" });
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);

// Does recurring payment `p` fall on date string `ds`?
function paymentOn(p, ds) {
  if (ds < p.start) return false;
  const d = parse(ds), s = parse(p.start);
  switch (p.freq) {
    case "weekly": return daysBetween(p.start, ds) % 7 === 0;
    case "biweekly": return daysBetween(p.start, ds) % 14 === 0;
    case "yearly": return d.getMonth() === s.getMonth() && d.getDate() === Math.min(s.getDate(), daysInMonth(d.getFullYear(), d.getMonth()));
    default: return d.getDate() === Math.min(s.getDate(), daysInMonth(d.getFullYear(), d.getMonth()));
  }
}
const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
function nextDue(p, from = todayIso()) {
  const d = parse(from < p.start ? p.start : from);
  for (let i = 0; i < 400; i++, d.setDate(d.getDate() + 1)) if (paymentOn(p, iso(d))) return iso(d);
  return p.start;
}
const monthlyCost = (p) => p.amount * ({ weekly: 52 / 12, biweekly: 26 / 12, monthly: 1, yearly: 1 / 12 }[p.freq] ?? 1);

// ---------- state ----------
const state = {
  tab: "calendar",
  view: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  selected: todayIso(),
  data: load(),
};
function load() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d) return d; } catch {}
  return { events: [], tasks: [], payments: [] };
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state.data)); } catch {} }

const itemsOn = (ds) => ({
  events: state.data.events.filter((e) => e.date === ds).sort((a, b) => (a.time || "").localeCompare(b.time || "")),
  tasks: state.data.tasks.filter((t) => t.due === ds),
  payments: state.data.payments.filter((p) => paymentOn(p, ds)),
});

// ---------- icons ----------
const I = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 4v16M4 12h16"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  todo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="m8.5 12.2 2.4 2.4 4.6-4.9"/></svg>',
  payments: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11V9.5A3.5 3.5 0 0 1 7.5 6H19M16 3l3 3-3 3"/><path d="M20 13v1.5a3.5 3.5 0 0 1-3.5 3.5H5M8 21l-3-3 3-3"/></svg>',
  events: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z"/></svg>',
};
const TABS = [
  ["calendar", "Calendar"], ["todo", "To Do"], ["payments", "Payments"], ["events", "Events"],
];

// ---------- shared pieces ----------
function header(title, sub, { search = true, add = true } = {}) {
  return `<div class="head"><div><h1>${esc(title)}</h1><div class="sub">${esc(sub)}</div></div>
    <div class="actions">
      ${search ? `<button class="icon-btn" data-act="search" aria-label="Search">${I.search}</button>` : ""}
      ${add ? `<button class="icon-btn" data-act="add" aria-label="Add">${I.plus}</button>` : ""}
    </div></div>`;
}

function taskMeta(t, showDate) {
  const bits = [showDate && t.due ? fmtLong(t.due) : "", fmtTime(t.time)].filter(Boolean).join(" · ");
  return bits ? `<div class="meta">${bits}</div>` : "";
}

function row(kind, item, { showDate = false } = {}) {
  if (kind === "task") {
    return `<button class="row ${item.done ? "done" : ""}" data-edit="task:${item.id}">
      <span class="marker task ${item.done ? "done" : ""}" data-toggle="${item.id}"></span>
      <span class="body"><div class="title"><span class="t">${esc(item.title)}</span></div>${taskMeta(item, showDate)}</span></button>`;
  }
  if (kind === "payment") {
    return `<button class="row" data-edit="payment:${item.id}"><span class="marker payment"></span>
      <span class="body"><div class="title"><span class="t">${esc(item.title)}</span></div><div class="meta">${showDate ? "Next " + fmtLong(nextDue(item)) + " · " + FREQS[item.freq] : money(item.amount) + " · " + FREQS[item.freq]}</div></span>
      ${showDate ? `<span class="amount">${money(item.amount)}</span>` : ""}</button>`;
  }
  return `<button class="row" data-edit="event:${item.id}"><span class="marker"></span>
    <span class="body"><div class="title"><span class="t">${esc(item.title)}</span></div><div class="meta">${showDate ? fmtLong(item.date) + (item.time ? " · " : "") : ""}${item.time ? fmtTime(item.time) : showDate ? "" : "All day"}</div></span></button>`;
}

// ---------- views ----------
const weekDates = (ds) => {
  const d = parse(ds); d.setDate(d.getDate() - d.getDay());
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(d); x.setDate(d.getDate() + i); return iso(x); });
};
const sortedRows = (it) => [
  ...it.events.map((x) => ({ kind: "event", x, at: x.time })),
  ...it.tasks.map((x) => ({ kind: "task", x, at: x.time })),
  ...it.payments.map((x) => ({ kind: "payment", x, at: "" })),
].sort((a, b) => (a.at || "99:99").localeCompare(b.at || "99:99")).map((r) => row(r.kind, r.x)).join("");
const countText = (e, t, p) => [
  e && `${e} Event${e > 1 ? "s" : ""}`, t && `${t} Task${t > 1 ? "s" : ""}`, p && `${p} Payment${p > 1 ? "s" : ""}`,
].filter(Boolean).join(", ");

// Two bubbles side by side, both always visible: the selected day, and its week.
function bubbleHTML(kind) {
  const today = todayIso();
  if (kind === "day") {
    const it = itemsOn(state.selected);
    const title = state.selected === today ? "Today" : fmtLong(state.selected);
    return `<h2 class="b-title">${esc(title)}</h2><div class="b-sub">${countText(it.events.length, it.tasks.length, it.payments.length) || "Nothing scheduled"}</div><div class="b-list">${sortedRows(it)}</div>`;
  }
  const week = weekDates(state.selected);
  const days = week.map((ds) => ({ ds, it: itemsOn(ds) }));
  const total = (k) => days.reduce((n, d) => n + d.it[k].length, 0);
  const groups = days.filter((d) => d.it.events.length + d.it.tasks.length + d.it.payments.length)
    .map((d) => `<div class="day-label">${d.ds === today ? "Today" : fmtLong(d.ds)}</div>${sortedRows(d.it)}`).join("");
  const title = today >= week[0] && today <= week[6] ? "This Week" : "Week";
  return `<h2 class="b-title">${title}</h2><div class="b-sub">${countText(total("events"), total("tasks"), total("payments")) || "Nothing scheduled"}</div><div class="b-list">${groups}</div>`;
}

const panelHTML = () => `<div class="bubbles"><section class="bubble" data-bubble="day">${bubbleHTML("day")}</section><section class="bubble" data-bubble="week">${bubbleHTML("week")}</section></div>`;

function renderCalendar() {
  const y = state.view.getFullYear(), m = state.view.getMonth();
  const first = new Date(y, m, 1), start = new Date(y, m, 1 - first.getDay());
  const weeks = Math.ceil((first.getDay() + daysInMonth(y, m)) / 7);
  const today = todayIso();
  let cells = "";
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const ds = iso(d), it = itemsOn(ds);
    const dots = [
      ...it.events.map(() => "event"),
      ...it.tasks.map(() => "task"),
      ...it.payments.map(() => "payment"),
    ].slice(0, 3).map((k) => `<i class="dot ${k}"></i>`).join("");
    cells += `<button class="day ${d.getMonth() !== m ? "out" : ""} ${ds === today ? "today" : ""} ${ds === state.selected ? "sel" : ""}" data-day="${ds}">
      <span class="num">${d.getDate()}</span><span class="dots">${dots}</span></button>`;
  }
  return `${header(MONTHS[m], String(y), {})}
    <div class="dow">${DOW.map((d) => `<span>${d}</span>`).join("")}</div>
    <div class="grid" id="grid">${cells}</div>
    <div id="panel">${panelHTML()}</div>`;
}

function renderTodo() {
  const open = state.data.tasks.filter((t) => !t.done).sort((a, b) => (a.due || "9").localeCompare(b.due || "9"));
  const done = state.data.tasks.filter((t) => t.done);
  const today = todayIso();
  const overdue = open.filter((t) => t.due && t.due < today).length;
  return `${header("To Do", `${open.length} open${overdue ? `, ${overdue} overdue` : ""}`)}
    ${open.length || done.length ? "" : `<div class="empty">No tasks yet. Tap + to add one.</div>`}
    <div class="list">${open.map((t) => row("task", t, { showDate: true })).join("")}</div>
    ${done.length ? `<div class="group-label">Completed</div><div class="list">${done.map((t) => row("task", t, { showDate: true })).join("")}</div>` : ""}`;
}

function renderPayments() {
  const ps = [...state.data.payments].sort((a, b) => nextDue(a).localeCompare(nextDue(b)));
  const total = ps.reduce((s, p) => s + monthlyCost(p), 0);
  return `${header("Payments", "Recurring")}
    <div class="total-card"><span>Per month</span><b>${money(total)}</b></div>
    ${ps.length ? "" : `<div class="empty">No recurring payments yet. Tap + to add one.</div>`}
    <div class="list">${ps.map((p) => row("payment", p, { showDate: true })).join("")}</div>`;
}

function renderEvents() {
  const today = todayIso();
  const evs = [...state.data.events].sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
  const upcoming = evs.filter((e) => e.date >= today), past = evs.filter((e) => e.date < today).reverse();
  const group = (list) => {
    let last = "", out = "";
    for (const e of list) {
      if (e.date !== last) { out += `${last ? "</div>" : ""}<div class="group-label">${e.date === today ? "Today" : fmtLong(e.date)}</div><div class="list">`; last = e.date; }
      out += row("event", e);
    }
    return out + (last ? "</div>" : "");
  };
  return `${header("Events", `${upcoming.length} upcoming`)}
    ${evs.length ? "" : `<div class="empty">No events yet. Tap + to add one.</div>`}
    ${group(upcoming)}${past.length ? `<div class="group-label" style="margin-top:34px">Past</div>${group(past)}` : ""}`;
}

const VIEWS = { calendar: renderCalendar, todo: renderTodo, payments: renderPayments, events: renderEvents };

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const EASE = "cubic-bezier(.22,.8,.24,1)";
const animate = (el, keyframes, opts) => (reduceMotion || !el ? null : el.animate(keyframes, { easing: EASE, ...opts }));
const rise = (el, delay = 0) => animate(el, [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 360, delay, fill: "backwards" });

function render({ enter = false } = {}) {
  const view = document.getElementById("view");
  const top = view.scrollTop;
  view.innerHTML = VIEWS[state.tab]();
  view.scrollTop = top;
  const tabs = document.getElementById("tabs");
  if (!tabs.children.length) {
    tabs.innerHTML = TABS.map(([k, label]) => `<button data-tab="${k}">${I[k]}<span>${label}</span></button>`).join("");
  }
  tabs.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("on", b.dataset.tab === state.tab));
  if (enter) [...view.children].forEach((el, i) => rise(el, Math.min(i, 6) * 25));
}

// Swap the day panel below the grid without touching the rest of the page.
function updatePanel() {
  document.querySelectorAll("[data-bubble]").forEach((el, i) => {
    el.innerHTML = bubbleHTML(el.dataset.bubble);
    rise(el.querySelector(".b-title"), i * 40);
    rise(el.querySelector(".b-sub"), 30 + i * 40);
    [...el.querySelector(".b-list").children].forEach((r, j) => rise(r, 70 + i * 40 + j * 35));
  });
}

let monthBusy = false;
// Slide the current grid out, swap the month, slide the new grid in.
async function changeMonth(dir, from = 0) {
  if (monthBusy || state.tab !== "calendar") return;
  monthBusy = true;
  try {
    const grid = document.getElementById("grid");
    const out = animate(grid, [{ transform: `translateX(${from}px)`, opacity: 1 - Math.min(Math.abs(from) / 400, .4) }, { transform: `translateX(${-dir * 70}px)`, opacity: 0 }], { duration: 170, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" });
    if (out) await out.finished.catch(() => {});
    state.view = new Date(state.view.getFullYear(), state.view.getMonth() + dir, 1);
    render();
    animate(document.getElementById("grid"), [{ transform: `translateX(${dir * 70}px)`, opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 340 });
    const head = document.querySelector(".head > div");
    animate(head, [{ opacity: 0, transform: `translateX(${dir * 14}px)` }, { opacity: 1, transform: "none" }], { duration: 300 });
  } finally { monthBusy = false; }
}

function selectDay(ds) {
  const d = parse(ds), v = state.view;
  state.selected = ds;
  const delta = (d.getFullYear() - v.getFullYear()) * 12 + d.getMonth() - v.getMonth();
  if (delta) return changeMonth(delta > 0 ? 1 : -1);   // tapped a greyed-out day: go to that month
  document.querySelectorAll(".day.sel").forEach((c) => c.classList.remove("sel"));
  document.querySelector(`[data-day="${ds}"]`)?.classList.add("sel");
  updatePanel();
}

// ---------- sheets (add / edit / search) ----------
const sheetRoot = document.getElementById("sheet-root");
const liveScrim = () => sheetRoot.querySelector(".scrim:not(.closing)");
function closeSheet() {
  const scrim = liveScrim();
  if (!scrim) return;
  scrim.classList.add("closing");
  setTimeout(() => scrim.remove(), reduceMotion ? 0 : 280);
}
function openSheet(html, onMount) {
  let scrim = liveScrim();
  if (scrim) scrim.firstElementChild.innerHTML = html;   // switching form type: swap content in place
  else {
    sheetRoot.innerHTML = `<div class="scrim" data-scrim><div class="sheet">${html}</div></div>`;
    scrim = liveScrim();
  }
  onMount?.(scrim.firstElementChild);
}

function formFields(type, v) {
  const f = (label, input) => `<label class="field">${label}${input}</label>`;
  const title = f("Title", `<input name="title" required autocomplete="off" value="${esc(v.title)}">`);
  if (type === "event") return title + `<div class="field-row">${f("Date", `<input type="date" name="date" required value="${v.date}">`)}${f("Time", `<input type="time" name="time" value="${v.time || ""}">`)}</div>`;
  if (type === "task") return title + `<div class="field-row">${f("Due date (optional)", `<input type="date" name="due" value="${v.due || ""}">`)}${f("Time", `<input type="time" name="time" value="${v.time || ""}">`)}</div>`;
  return title + `<div class="field-row">${f("Amount", `<input type="number" name="amount" step="0.01" min="0" required inputmode="decimal" value="${v.amount ?? ""}">`)}
    ${f("Repeats", `<select name="freq">${Object.entries(FREQS).map(([k, l]) => `<option value="${k}" ${v.freq === k ? "selected" : ""}>${l}</option>`).join("")}</select>`)}</div>`
    + f("First payment date", `<input type="date" name="start" required value="${v.start}">`);
}

function openForm(type, item) {
  const editing = !!item;
  const defaults = {
    event: { title: "", date: state.selected, time: "" },
    task: { title: "", due: state.tab === "calendar" ? state.selected : "", done: false },
    payment: { title: "", amount: "", freq: "monthly", start: state.selected },
  };
  const names = { event: "Event", task: "Task", payment: "Payment" };
  const draft = item ? { ...item } : defaults[type];
  const collection = { event: "events", task: "tasks", payment: "payments" };

  const draw = (t) => {
    openSheet(`<div class="sheet-head"><button class="link muted" data-close>Cancel</button><h2>${editing ? "Edit" : "New"} ${names[t]}</h2><button class="link" form="f" type="submit">Save</button></div>
      ${editing ? "" : `<div class="seg">${Object.entries(names).map(([k, l]) => `<button type="button" data-type="${k}" class="${k === t ? "on" : ""}">${l}</button>`).join("")}</div>`}
      <form id="f">${formFields(t, { ...defaults[t], ...draft })}</form>
      ${editing ? `<button class="danger" data-delete>Delete ${names[t]}</button>` : ""}`, (sheet) => {
      sheet.querySelector("input[name=title]").focus();
      sheet.querySelectorAll("[data-type]").forEach((b) => b.addEventListener("click", () => {
        draft.title = sheet.querySelector("input[name=title]").value; draw(b.dataset.type); type = b.dataset.type;
      }));
      sheet.querySelector("[data-delete]")?.addEventListener("click", () => {
        state.data[collection[t]] = state.data[collection[t]].filter((x) => x.id !== item.id); save(); closeSheet(); render();
      });
      sheet.querySelector("#f").addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = Object.fromEntries(new FormData(e.target));
        const next = { ...(item || { id: uid() }), ...fd };
        if (t === "payment") next.amount = parseFloat(fd.amount);
        if (t === "task") { next.due = fd.due || ""; next.time = fd.time || ""; next.done = item?.done ?? false; }
        const list = state.data[collection[t]];
        const i = list.findIndex((x) => x.id === next.id);
        i >= 0 ? (list[i] = next) : list.push(next);
        save(); closeSheet();
        const date = next.date || next.due || next.start;
        if (!editing && state.tab === "calendar" && date) { state.selected = date; state.view = new Date(parse(date).getFullYear(), parse(date).getMonth(), 1); }
        render();
      });
    });
  };
  draw(type);
}

function openSearch() {
  const result = (q) => {
    q = q.trim().toLowerCase();
    if (!q) return "";
    const hit = (x) => x.title.toLowerCase().includes(q);
    const { events, tasks, payments } = state.data;
    const html = [...events.filter(hit).map((e) => row("event", e, { showDate: true })), ...tasks.filter(hit).map((t) => row("task", t, { showDate: true })), ...payments.filter(hit).map((p) => row("payment", p, { showDate: true }))].join("");
    return html || `<div class="empty">No results</div>`;
  };
  openSheet(`<div class="sheet-head"><h2>Search</h2><button class="link" data-close>Done</button></div>
    <input class="search-input" placeholder="Search events, tasks, payments" autocomplete="off"><div class="list" id="results"></div>`, (sheet) => {
    const input = sheet.querySelector("input"), out = sheet.querySelector("#results");
    input.focus();
    input.addEventListener("input", () => { out.innerHTML = result(input.value); });
  });
}

// ---------- events ----------
const addTypeForTab = { calendar: "event", events: "event", todo: "task", payments: "payment" };

let reflow, justDragged = false;
document.addEventListener("click", (e) => {
  const t = e.target;
  const q = (sel) => t.closest(sel);
  if (q("[data-close]") || t.matches("[data-scrim]")) return closeSheet();
  if (q("[data-tab]")) {
    const tab = q("[data-tab]").dataset.tab;
    if (tab !== state.tab) { state.tab = tab; render({ enter: true }); }
    return;
  }
  if (q("[data-act]")) {
    const a = q("[data-act]").dataset.act;
    if (a === "search") return openSearch();
    if (a === "add") return openForm(addTypeForTab[state.tab]);
  }
  if (q("[data-toggle]")) {
    const task = state.data.tasks.find((x) => x.id === q("[data-toggle]").dataset.toggle);
    if (task) {
      task.done = !task.done; save();
      // flip the checkmark and strike-through in place so they animate, then re-sort the To Do list
      document.querySelectorAll(`[data-toggle="${task.id}"]`).forEach((m) => { m.classList.toggle("done", task.done); m.closest(".row").classList.toggle("done", task.done); });
      if (state.tab === "todo") { clearTimeout(reflow); reflow = setTimeout(() => render(), 450); }
    }
    return;
  }
  if (q("[data-day]")) {
    if (justDragged) return;
    return selectDay(q("[data-day]").dataset.day);
  }
  if (q("[data-edit]")) {
    const [type, id] = q("[data-edit]").dataset.edit.split(":");
    const item = state.data[{ event: "events", task: "tasks", payment: "payments" }[type]].find((x) => x.id === id);
    if (item) openForm(type, item);
  }
});

// Drag the grid with a finger or mouse; release past a threshold (or with a flick) to change month.
let drag = null;
document.addEventListener("pointerdown", (e) => {
  const grid = e.target.closest("#grid");
  drag = grid && !monthBusy ? { x: e.clientX, y: e.clientY, t: performance.now(), dx: 0, active: false, grid } : null;
});
document.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.active) {
    if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
    drag.active = true;
    drag.grid.style.willChange = "transform, opacity";
  }
  drag.dx = dx;
  drag.grid.style.transform = `translateX(${dx}px)`;
  drag.grid.style.opacity = 1 - Math.min(Math.abs(dx) / 400, .4);
});
const endDrag = () => {
  if (!drag) return;
  const { active, dx, grid, t } = drag; drag = null;
  if (!active) return;
  justDragged = true; setTimeout(() => { justDragged = false; }, 60);
  const velocity = dx / Math.max(performance.now() - t, 1);          // px per ms
  if (Math.abs(dx) > 70 || Math.abs(velocity) > .5) {
    grid.style.transform = grid.style.opacity = grid.style.willChange = "";
    changeMonth(dx < 0 ? 1 : -1, dx);
  } else {
    const back = animate(grid, [{ transform: `translateX(${dx}px)`, opacity: grid.style.opacity }, { transform: "none", opacity: 1 }], { duration: 280 });
    grid.style.transform = grid.style.opacity = grid.style.willChange = "";
    if (!back) return;
  }
};
document.addEventListener("pointerup", endDrag);
document.addEventListener("pointercancel", endDrag);
document.addEventListener("keydown", (e) => {
  if (state.tab !== "calendar" || liveScrim() || e.target.matches("input, textarea, select")) return;
  if (e.key === "ArrowLeft") changeMonth(-1);
  if (e.key === "ArrowRight") changeMonth(1);
});

render();
