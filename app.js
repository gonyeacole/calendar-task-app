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
const dtOf = (d, t) => new Date(`${d}T${t || "00:00"}:00`);
const hm = (x) => `${pad(x.getHours())}:${pad(x.getMinutes())}`;
const plusHour = (d, t) => { const x = dtOf(d, t); x.setHours(x.getHours() + 1); return { date: iso(x), time: hm(x) }; };
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
const isLeap = (y) => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
function birthdayOn(b, ds) {
  const md = b.date.slice(5), dmd = ds.slice(5);
  return md === dmd || (md === "02-29" && dmd === "02-28" && !isLeap(+ds.slice(0, 4)));
}
function nextBirthday(b, from = todayIso()) {
  const md = b.date.slice(5);
  for (let y = +from.slice(0, 4); y < +from.slice(0, 4) + 9; y++) {
    const c = `${y}-${md === "02-29" && !isLeap(y) ? "02-28" : md}`;
    if (c >= from) return c;
  }
  return b.date;
}
const turnsOn = (b, ds) => (b.noYear ? "" : `Turns ${+ds.slice(0, 4) - +b.date.slice(0, 4)}`);
const countdown = (ds) => { const n = daysBetween(todayIso(), ds); return n === 0 ? "Today" : n === 1 ? "Tomorrow" : `${n} days`; };
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
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d) return { birthdays: [], ...d }; } catch {}
  return { events: [], tasks: [], payments: [], birthdays: [] };
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state.data)); } catch {} }

const itemsOn = (ds) => ({
  events: state.data.events.filter((e) => e.date <= ds && ds <= (e.endDate || e.date)).sort((a, b) => (a.date === ds ? a.time || "" : "").localeCompare(b.date === ds ? b.time || "" : "")),
  tasks: state.data.tasks.filter((t) => t.due === ds),
  payments: state.data.payments.filter((p) => paymentOn(p, ds)),
  birthdays: state.data.birthdays.filter((b) => birthdayOn(b, ds)),
});

// ---------- icons ----------
const I = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 4v16M4 12h16"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  todo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="m8.5 12.2 2.4 2.4 4.6-4.9"/></svg>',
  payments: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11V9.5A3.5 3.5 0 0 1 7.5 6H19M16 3l3 3-3 3"/><path d="M20 13v1.5a3.5 3.5 0 0 1-3.5 3.5H5M8 21l-3-3 3-3"/></svg>',
  birthdays: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="9" width="17" height="4" rx="1.2"/><path d="M5 13v6.5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5V13M12 9v12"/><path d="M12 9c-1.2-3.2-4.800-3.600-4.800-1.400C7.200 9.200 10 9 12 9zM12 9c1.200-3.200 4.800-3.600 4.800-1.400C16.800 9.200 14 9 12 9z"/></svg>',
  events: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z"/></svg>',
};
const TABS = [
  ["calendar", "Calendar"], ["todo", "To Do"], ["payments", "Payments"], ["events", "Events"], ["birthdays", "Birthdays"],
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

function eventMeta(e, ds, showDate) {
  const where = e.location ? " · " + esc(e.location) : "";
  return eventWhen(e, ds, showDate) + where;
}

function eventWhen(e, ds, showDate) {
  const end = e.endDate || e.date, multi = end !== e.date;
  const range = e.time && e.endTime && e.endTime !== e.time ? `${fmtTime(e.time)} – ${fmtTime(e.endTime)}` : fmtTime(e.time);
  if (showDate) {
    const days = fmtLong(e.date) + (multi ? " – " + fmtLong(end) : "");
    return days + (e.time ? " · " + range : " · All day");
  }
  if (!e.time) return "All day";
  if (!multi) return range;
  if (ds === e.date) return `${fmtTime(e.time)} →`;
  if (ds === end) return `→ ${fmtTime(e.endTime || e.time)}`;
  return "All day";
}

function row(kind, item, { showDate = false, ds = "" } = {}) {
  if (kind === "task") {
    return `<button class="row ${item.done ? "done" : ""}" data-edit="task:${item.id}">
      <span class="marker task ${item.done ? "done" : ""}" data-toggle="${item.id}"></span>
      <span class="body"><div class="title"><span class="t">${esc(item.title)}</span></div>${taskMeta(item, showDate)}</span></button>`;
  }
  if (kind === "birthday") {
    const turns = turnsOn(item, ds || nextBirthday(item));
    const meta = showDate ? [parse(ds).toLocaleDateString(undefined, { month: "short", day: "numeric" }), turns].filter(Boolean).join(" · ") : ["Birthday", turns].filter(Boolean).join(" · ");
    return `<button class="row" data-edit="birthday:${item.id}"><span class="marker birthday"></span>
      <span class="body"><div class="title"><span class="t">${esc(item.title)}</span></div><div class="meta">${meta}</div></span>
      ${showDate ? `<span class="amount">${countdown(ds)}</span>` : ""}</button>`;
  }
  if (kind === "payment") {
    return `<button class="row" data-edit="payment:${item.id}"><span class="marker payment"></span>
      <span class="body"><div class="title"><span class="t">${esc(item.title)}</span></div><div class="meta">${showDate ? "Next " + fmtLong(nextDue(item)) + " · " + FREQS[item.freq] : money(item.amount) + " · " + FREQS[item.freq]}</div></span>
      ${showDate ? `<span class="amount">${money(item.amount)}</span>` : ""}</button>`;
  }
  return `<button class="row" data-edit="event:${item.id}"><span class="marker"></span>
    <span class="body"><div class="title"><span class="t">${esc(item.title)}</span></div><div class="meta">${eventMeta(item, ds, showDate)}</div></span></button>`;
}

// ---------- views ----------
const weekDates = (ds) => {
  const d = parse(ds); d.setDate(d.getDate() - d.getDay());
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(d); x.setDate(d.getDate() + i); return iso(x); });
};
const sortedRows = (it, ds) => [
  ...it.events.map((x) => ({ kind: "event", x, at: x.date === ds ? x.time : "" })),
  ...it.tasks.map((x) => ({ kind: "task", x, at: x.time })),
  ...it.payments.map((x) => ({ kind: "payment", x, at: "" })),
  ...it.birthdays.map((x) => ({ kind: "birthday", x, at: "" })),
].sort((a, b) => (a.at || "99:99").localeCompare(b.at || "99:99")).map((r) => row(r.kind, r.x, { ds })).join("");

// Two bubbles side by side, both always visible: the selected day, and its week.
function bubbleHTML(kind) {
  const today = todayIso();
  if (kind === "day") {
    const it = itemsOn(state.selected);
    const title = state.selected === today ? "Today" : fmtLong(state.selected);
    const rows = sortedRows(it, state.selected);
    return `<h2 class="b-title">${esc(title)}</h2>${rows ? "" : `<div class="b-sub">Nothing scheduled</div>`}<div class="b-list">${rows}</div>`;
  }
  const week = weekDates(state.selected);
  const days = week.map((ds) => ({ ds, it: itemsOn(ds) }));
  const groups = days.filter((d) => d.it.events.length + d.it.tasks.length + d.it.payments.length + d.it.birthdays.length)
    .map((d) => `<div class="day-label">${d.ds === today ? "Today" : fmtLong(d.ds)}</div>${sortedRows(d.it, d.ds)}`).join("");
  const title = today >= week[0] && today <= week[6] ? "This Week" : "Week";
  return `<h2 class="b-title">${title}</h2>${groups ? "" : `<div class="b-sub">Nothing scheduled</div>`}<div class="b-list">${groups}</div>`;
}

const panelHTML = () => `<div class="bubbles"><section class="bubble" data-bubble="day">${bubbleHTML("day")}</section><section class="bubble" data-bubble="week">${bubbleHTML("week")}</section></div>`;

function renderCalendar() {
  const y = state.view.getFullYear(), m = state.view.getMonth();
  const first = new Date(y, m, 1), start = new Date(y, m, 1 - first.getDay());
  const weeks = Math.ceil((first.getDay() + daysInMonth(y, m)) / 7);
  const today = todayIso();
  // Events longer than a day are drawn as a line under their days (stacked in lanes when they overlap).
  const lastDay = new Date(start); lastDay.setDate(start.getDate() + weeks * 7 - 1);
  const [gridFrom, gridTo] = [iso(start), iso(lastDay)];
  const multi = state.data.events.filter((e) => (e.endDate || e.date) > e.date && e.date <= gridTo && e.endDate >= gridFrom)
    .sort((a, b) => a.date.localeCompare(b.date) || b.endDate.localeCompare(a.endDate) || a.id.localeCompare(b.id));
  const laneEnd = [], lane = new Map();
  for (const e of multi) {
    let l = laneEnd.findIndex((end) => end < e.date);
    if (l < 0) l = laneEnd.length;
    laneEnd[l] = e.endDate; lane.set(e.id, l);
  }
  let cells = "";
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const ds = iso(d), it = itemsOn(ds);
    const dots = [
      ...it.events.filter((e) => (e.endDate || e.date) === e.date).map(() => "event"),
      ...it.tasks.map(() => "task"),
      ...it.payments.map(() => "payment"),
      ...it.birthdays.map(() => "birthday"),
    ].slice(0, 4).map((k) => `<i class="dot ${k}"></i>`).join("");
    const dow = d.getDay();
    const bars = multi.filter((e) => e.date <= ds && ds <= e.endDate && lane.get(e.id) < 2).map((e) => {
      const capL = ds === e.date || dow === 0, capR = ds === e.endDate || dow === 6;   // rounded ends at the real start/end and at week edges
      // starts/ends at the middle of the date number; at a week edge it stops where the page content stops (15px in)
      const l = ds === e.date ? "50%" : dow === 0 ? "15px" : "0", r = ds === e.endDate ? "50%" : dow === 6 ? "15px" : "0";
      return `<i class="bar l${lane.get(e.id)}" style="left:${l};right:${r};border-radius:${capL ? 2 : 0}px ${capR ? 2 : 0}px ${capR ? 2 : 0}px ${capL ? 2 : 0}px"></i>`;
    }).join("");
    cells += `<button class="day ${d.getMonth() !== m ? "out" : ""} ${ds === today ? "today" : ""} ${ds === state.selected ? "sel" : ""}" data-day="${ds}">
      <span class="num">${d.getDate()}</span><span class="dots">${dots}</span>${bars}<span class="plus" aria-hidden="true">${I.plus}</span></button>`;
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

function renderBirthdays() {
  const list = state.data.birthdays.map((b) => ({ b, next: nextBirthday(b) })).sort((a, c) => a.next.localeCompare(c.next));
  const sub = list.length ? `Next: ${list[0].b.title} · ${countdown(list[0].next)}` : "None yet";
  return `${header("Birthdays", sub)}
    ${list.length ? "" : `<div class="empty">No birthdays yet. Tap + to add one.</div>`}
    <div class="list">${list.map(({ b, next }) => row("birthday", b, { showDate: true, ds: next })).join("")}</div>`;
}

const VIEWS = { birthdays: renderBirthdays, calendar: renderCalendar, todo: renderTodo, payments: renderPayments, events: renderEvents };

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
    tabs.innerHTML = `<span class="tab-pill" aria-hidden="true"></span>` + TABS.map(([k, label]) => `<button data-tab="${k}">${I[k]}<span>${label}</span></button>`).join("");
  }
  tabs.style.setProperty("--i", TABS.findIndex(([k]) => k === state.tab));   // the glass pill glides to this slot
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
function openSheet(html, onMount, { tall = false } = {}) {
  let scrim = liveScrim();
  if (scrim) scrim.firstElementChild.innerHTML = html;   // switching form type: swap content in place
  else {
    // a tall sheet opens up to just below the year in the page header
    const year = document.querySelector(".head .sub");
    const top = tall && year ? Math.max(year.getBoundingClientRect().bottom, 60) + 12 : 0;
    sheetRoot.innerHTML = `<div class="scrim" data-scrim><div class="sheet ${tall ? "tall" : ""}" style="--sheet-top:${top}px">${html}</div></div>`;
    scrim = liveScrim();
  }
  onMount?.(scrim.firstElementChild);
}

const pillDate = (name, val, extra = "") => `<input class="pill-in date" type="date" name="${name}" value="${val || ""}" ${extra}>`;
const pillTime = (name, val) => `<input class="pill-in time" type="time" name="${name}" value="${val || ""}">`;
const frow = (label, inner) => `<div class="frow"><span>${label}</span><div class="pills-in">${inner}</div></div>`;

function formFields(type, v) {
  const f = (label, input) => `<label class="field">${label}${input}</label>`;
  const title = (ph) => `<label class="field title-field"><input name="title" required autocomplete="off" placeholder="${ph}" aria-label="Title" value="${esc(v.title)}"></label>`;
  const notes = f("Notes", `<textarea name="notes" rows="4">${esc(v.notes)}</textarea>`);
  if (type === "event") return title("Event name") + `<div class="fcard ${v.allDay ? "allday" : ""}">
    <label class="frow toggle-row"><span>All-day</span><span class="switch"><input type="checkbox" name="allDay" ${v.allDay ? "checked" : ""}><i></i></span></label>
    <div class="range">
      <div class="rcol"><span class="rlabel">Starts</span>${pillDate("date", v.date, "required")}${pillTime("time", v.time)}</div>
      <div class="rcol"><span class="rlabel">Ends</span>${pillDate("endDate", v.endDate)}${pillTime("endTime", v.endTime)}</div>
    </div></div>`
    + f("Location", `<input name="location" autocomplete="off" value="${esc(v.location)}">`) + notes;
  if (type === "task") return title("Task") + `<div class="fcard">${frow("Due", pillDate("due", v.due) + pillTime("time", v.time))}</div>` + notes;
  if (type === "birthday") return title("Name") + `<div class="fcard">${frow("Date", pillDate("date", v.date, "required"))}
    <label class="frow toggle-row"><span>Year unknown</span><span class="switch"><input type="checkbox" name="noYear" ${v.noYear ? "checked" : ""}><i></i></span></label></div>` + notes;
  return title("Payment name") + `<div class="field-row">${f("Amount", `<input type="number" name="amount" step="0.01" min="0" required inputmode="decimal" value="${v.amount ?? ""}">`)}
    ${f("Repeats", `<select name="freq">${Object.entries(FREQS).map(([k, l]) => `<option value="${k}" ${v.freq === k ? "selected" : ""}>${l}</option>`).join("")}</select>`)}</div>`
    + `<div class="fcard">${frow("First payment", pillDate("start", v.start, "required"))}</div>` + notes;
}

// Keeps Starts / Ends consistent: moving the start moves the end by the same amount, and the end can't land before the start.
function wireEventForm(form) {
  const el = (n) => form.elements[n], card = form.querySelector(".fcard");
  const allDay = () => el("allDay").checked;
  const at = (d, t) => dtOf(el(d).value, allDay() ? "" : el(t).value);
  const span = () => at("endDate", "endTime") - at("date", "time");
  let dur = span(); if (!(dur >= 0)) dur = 36e5;
  const setEnd = (ms) => {
    const x = new Date(at("date", "time").getTime() + ms);
    el("endDate").value = iso(x); if (!allDay()) el("endTime").value = hm(x);
  };
  ["date", "time"].forEach((n) => el(n).addEventListener("change", () => { if (el("date").value) setEnd(dur); }));
  ["endDate", "endTime"].forEach((n) => el(n).addEventListener("change", () => {
    if (!el("endDate").value) return setEnd(dur);
    if (span() < 0) setEnd(0);
    dur = span();
  }));
  el("allDay").addEventListener("change", () => {
    card.classList.toggle("allday", allDay());
    if (allDay()) { dur = Math.max(span(), 0); return; }
    if (!el("time").value) el("time").value = "09:00";
    if (!el("endTime").value) el("endTime").value = "10:00";
    dur = span(); if (!(dur >= 0)) { dur = 36e5; setEnd(dur); }
  });
}

function openForm(type, item, preset) {
  const editing = !!item;
  const base = preset?.date || state.selected;
  const soon = (() => {                                  // next full hour today, otherwise 9:00 on the chosen day
    if (base !== todayIso()) return { date: base, time: "09:00" };
    const x = new Date(); x.setMinutes(0, 0, 0); x.setHours(x.getHours() + 1); return { date: iso(x), time: hm(x) };
  })();
  const soonEnd = plusHour(soon.date, soon.time);
  const defaults = {
    event: { title: "", date: soon.date, time: soon.time, endDate: soonEnd.date, endTime: soonEnd.time, allDay: false },
    task: { title: "", due: state.tab === "calendar" ? state.selected : "", done: false },
    payment: { title: "", amount: "", freq: "monthly", start: state.selected },
    birthday: { title: "", date: state.selected, noYear: false },
  };
  if (preset && !item) Object.assign(defaults.event, preset);
  const names = { event: "Event", task: "Task", payment: "Payment", birthday: "Birthday" };
  const asForm = (e) => {                                // saved event -> form values (no end saved yet = one hour; no time = all-day)
    const end = e.time ? plusHour(e.date, e.time) : { date: e.date, time: "" };
    return { ...e, allDay: !e.time, endDate: e.endDate || end.date, endTime: e.endTime || end.time };
  };
  const draft = item ? (type === "event" ? asForm(item) : { ...item }) : defaults[type];
  const collection = { event: "events", task: "tasks", payment: "payments", birthday: "birthdays" };

  const draw = (t) => {
    openSheet(`<div class="sheet-head"><button class="link muted" data-close>Cancel</button><h2>${editing ? "Edit" : "New"} ${names[t]}</h2><button class="link" form="f" type="submit">Save</button></div>
      ${editing ? "" : `<div class="seg">${Object.entries(names).map(([k, l]) => `<button type="button" data-type="${k}" class="${k === t ? "on" : ""}">${l}</button>`).join("")}</div>`}
      <form id="f">${formFields(t, { ...defaults[t], ...draft })}</form>
      ${editing ? `<button class="danger" data-delete>Delete ${names[t]}</button>` : ""}`, (sheet) => {
      sheet.querySelector("input[name=title]").focus({ preventScroll: true });
      if (t === "event") wireEventForm(sheet.querySelector("#f"));
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
        if (t === "birthday") next.noYear = fd.noYear === "on";
        if (t === "event") {
          delete next.allDay;
          next.endDate = fd.endDate || fd.date;
          if (fd.allDay) { next.time = ""; next.endTime = ""; }
          else { next.time = fd.time || "09:00"; next.endTime = fd.endTime || next.time; }
        }
        if (t === "task") { next.due = fd.due || ""; next.time = fd.time || ""; next.done = item?.done ?? false; }
        const list = state.data[collection[t]];
        const i = list.findIndex((x) => x.id === next.id);
        i >= 0 ? (list[i] = next) : list.push(next);
        save(); closeSheet();
        const date = t === "birthday" ? nextBirthday(next) : next.date || next.due || next.start;
        if (!editing && state.tab === "calendar" && date) { state.selected = date; state.view = new Date(parse(date).getFullYear(), parse(date).getMonth(), 1); }
        render();
      });
    }, { tall: true });
  };
  draw(type);
}

function openSearch() {
  const result = (q) => {
    q = q.trim().toLowerCase();
    if (!q) return "";
    const hit = (x) => x.title.toLowerCase().includes(q);
    const { events, tasks, payments, birthdays } = state.data;
    const html = [...events.filter(hit).map((e) => row("event", e, { showDate: true })), ...tasks.filter(hit).map((t) => row("task", t, { showDate: true })), ...payments.filter(hit).map((p) => row("payment", p, { showDate: true })), ...birthdays.filter(hit).map((b) => row("birthday", b, { showDate: true, ds: nextBirthday(b) }))].join("");
    return html || `<div class="empty">No results</div>`;
  };
  openSheet(`<div class="sheet-head"><h2>Search</h2><button class="link" data-close>Done</button></div>
    <input class="search-input" placeholder="Search events, tasks, payments, birthdays" autocomplete="off"><div class="list" id="results"></div>`, (sheet) => {
    const input = sheet.querySelector("input"), out = sheet.querySelector("#results");
    input.focus();
    input.addEventListener("input", () => { out.innerHTML = result(input.value); });
  });
}

// ---------- events ----------
const addTypeForTab = { calendar: "event", events: "event", todo: "task", payments: "payment", birthdays: "birthday" };

let reflow, justDragged = false;
document.addEventListener("click", (e) => {
  const t = e.target;
  const q = (sel) => t.closest(sel);
  if (justDragged) return;                       // the click that follows a hold or a drag is not a tap
  const plusCell = q(".day.plus");
  clearPlus();
  if (plusCell) return openForm("event", null, { date: plusCell.dataset.day });
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
    const item = state.data[{ event: "events", task: "tasks", payment: "payments", birthday: "birthdays" }[type]].find((x) => x.id === id);
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
// Hold a date for half a second and a + appears on it; keep holding and drag across days to pick a range.
const HOLD_MS = 500;
let hold = null, tip = null;
const shortDate = (ds) => parse(ds).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const dayAt = (x, y) => document.elementFromPoint(x, y)?.closest?.("#grid [data-day]")?.dataset.day;
function clearPlus() { document.querySelectorAll(".day.plus").forEach((c) => c.classList.remove("plus")); }
function clearRange() { document.querySelectorAll("#grid .rng, #grid .rs, #grid .re, #grid .rend, #grid .plus").forEach((c) => c.classList.remove("rng", "rs", "re", "rend", "plus")); }
const span2 = (a, b) => (a <= b ? [a, b] : [b, a]);
function paintRange(a, b) {
  const [lo, hi] = span2(a, b), many = lo !== hi;
  document.querySelectorAll("#grid [data-day]").forEach((c) => {
    const ds = c.dataset.day, inside = ds >= lo && ds <= hi, dow = parse(ds).getDay();
    c.classList.toggle("plus", inside && !many);
    c.classList.toggle("rng", inside && many);
    c.classList.toggle("rs", inside && many && (ds === lo || dow === 0));
    c.classList.toggle("re", inside && many && (ds === hi || dow === 6));
    c.classList.toggle("rend", inside && many && (ds === lo || ds === hi));
  });
  if (!many) { tip?.remove(); return; }
  if (!tip) { tip = document.createElement("div"); tip.className = "range-tip"; }
  tip.textContent = `${shortDate(lo)} – ${shortDate(hi)} · ${daysBetween(lo, hi) + 1} days`;
  tip.style.top = `${document.getElementById("grid").getBoundingClientRect().bottom + 2}px`;
  if (!tip.isConnected) document.body.append(tip);
}
document.addEventListener("pointerdown", (e) => {
  clearTimeout(hold?.timer);
  const cell = e.target.closest("#grid [data-day]");
  if (!cell || monthBusy) { hold = null; return; }
  const h = (hold = { x: e.clientX, y: e.clientY, from: cell.dataset.day, to: cell.dataset.day, active: false });
  h.timer = setTimeout(() => { h.active = true; drag = null; clearPlus(); paintRange(h.from, h.from); }, HOLD_MS);
});
document.addEventListener("pointermove", (e) => {
  if (!hold) return;
  if (!hold.active) {                             // moved before the hold finished: that is a swipe, not a hold
    if (Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > 6) { clearTimeout(hold.timer); hold = null; }
    return;
  }
  const ds = dayAt(e.clientX, e.clientY);
  if (ds && ds !== hold.to) { hold.to = ds; paintRange(hold.from, ds); }
});
function endHold(cancelled) {
  if (!hold) return;
  clearTimeout(hold.timer);
  const h = hold; hold = null;
  if (!h.active) return;
  justDragged = true; setTimeout(() => { justDragged = false; }, 80);
  const [lo, hi] = span2(h.from, h.to);
  tip?.remove(); tip = null;
  if (lo === hi && !cancelled) return;            // a single held date keeps its +; tap it to add an event
  clearRange();
  if (!cancelled) openForm("event", null, { date: lo, endDate: hi, allDay: true, time: "", endTime: "" });
}
document.addEventListener("pointerup", () => endHold(false));
document.addEventListener("pointercancel", () => endHold(true));
document.addEventListener("touchmove", (e) => { if (hold?.active) e.preventDefault(); }, { passive: false });
document.addEventListener("contextmenu", (e) => { if (e.target.closest?.("#grid")) e.preventDefault(); });

document.addEventListener("keydown", (e) => {
  if (state.tab !== "calendar" || liveScrim() || e.target.matches("input, textarea, select")) return;
  if (e.key === "ArrowLeft") changeMonth(-1);
  if (e.key === "ArrowRight") changeMonth(1);
});

render();

// iOS home-screen apps report a page height shorter than the screen (by the status-bar inset) and leave the strip below blank,
// unless the document itself is as tall as the screen. Make it so, and keep everything pinned to the real screen edges.
function fitScreen() {
  const gap = screen.height - innerHeight;
  const short = matchMedia("(display-mode: standalone)").matches && innerWidth < innerHeight && gap > 0 && gap <= 70;
  const root = document.documentElement;
  root.classList.toggle("tall-screen", short);
  root.style.setProperty("--app-h", short ? `${screen.height}px` : "");
}
fitScreen();
addEventListener("resize", fitScreen);
addEventListener("orientationchange", () => setTimeout(fitScreen, 300));
// the document is taller than the viewport in that mode; never let it scroll away from the top
addEventListener("scroll", () => { if (scrollY && document.documentElement.classList.contains("tall-screen")) scrollTo(0, 0); }, { passive: true });
