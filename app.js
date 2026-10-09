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
// US holidays, worked out from their rules so they appear in every year (the usual US Holidays set)
const nthWeekday = (y, m, wd, n) => 1 + ((wd - new Date(y, m, 1).getDay() + 7) % 7) + (n - 1) * 7;
const lastWeekday = (y, m, wd) => { const last = new Date(y, m + 1, 0); return last.getDate() - ((last.getDay() - wd + 7) % 7); };
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, mm = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * mm + 114) / 31), day = ((h + l - 7 * mm + 114) % 31) + 1;
  return [month - 1, day];
}
const holidayCache = {};
function holidaysOfYear(y) {
  if (holidayCache[y]) return holidayCache[y];
  const map = {}, add = (m, d, name) => { const k = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`; (map[k] ||= []).push(name); };
  add(0, 1, "New Year's Day"); add(0, nthWeekday(y, 0, 1, 3), "Martin Luther King Jr. Day"); add(1, 14, "Valentine's Day");
  add(1, nthWeekday(y, 1, 1, 3), "Presidents' Day"); add(2, nthWeekday(y, 2, 0, 2), "Daylight Saving Time starts"); add(2, 17, "St. Patrick's Day");
  add(...easter(y), "Easter Sunday"); add(4, nthWeekday(y, 4, 0, 2), "Mother's Day"); add(4, lastWeekday(y, 4, 1), "Memorial Day");
  add(5, nthWeekday(y, 5, 0, 3), "Father's Day"); add(5, 19, "Juneteenth"); add(6, 4, "Independence Day"); add(8, nthWeekday(y, 8, 1, 1), "Labor Day");
  add(9, nthWeekday(y, 9, 1, 2), "Columbus Day"); add(9, 31, "Halloween"); add(10, nthWeekday(y, 10, 0, 1), "Daylight Saving Time ends");
  add(10, 11, "Veterans Day"); add(10, nthWeekday(y, 10, 4, 4), "Thanksgiving"); add(11, 25, "Christmas Day");
  return (holidayCache[y] = map);
}
const holidaysOn = (ds) => holidaysOfYear(+ds.slice(0, 4))[ds] || [];

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

// ---------- light / dark ----------
const THEME_KEY = "calendar-task-app:theme";
const root = document.documentElement;
const prefersDark = matchMedia("(prefers-color-scheme: dark)");
const currentTheme = () => root.dataset.theme || (prefersDark.matches ? "dark" : "light");
function applyTheme(t) {
  root.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t === "dark" ? "#000000" : "#f4ead8");
}
try { const saved = localStorage.getItem(THEME_KEY); if (saved) applyTheme(saved); } catch {}

function toggleTheme(btn) {
  const next = currentTheme() === "dark" ? "light" : "dark";
  root.classList.add("theming");                         // fade colors across instead of snapping
  applyTheme(next);
  try { localStorage.setItem(THEME_KEY, next); } catch {}
  btn.innerHTML = next === "dark" ? I.moon : I.sun;
  animate(btn, [{ transform: "scale(.5) rotate(-70deg)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 420 });
  setTimeout(() => root.classList.remove("theming"), 500);
}

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
  holidays: holidaysOn(ds),
});

// ---------- icons ----------
const I = {
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round"><path d="M20 14.6A8.2 8.2 0 1 1 9.4 4a6.6 6.6 0 0 0 10.6 10.6z"/></svg>',
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
function header(title, sub, { add = true } = {}) {
  return `<div class="head"><div><h1>${esc(title)}</h1>${sub ? `<div class="sub"><span>${esc(sub)}</span></div>` : ""}</div>
    <div class="actions">
      <button class="icon-btn" data-act="theme" aria-label="Switch between light and dark">${currentTheme() === "dark" ? I.moon : I.sun}</button>
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

function row(kind, item, { showDate = false, ds = "", compact = false } = {}) {
  if (kind === "task") {
    return `<button class="row ${item.done ? "done" : ""}" data-edit="task:${item.id}">
      <span class="marker task ${item.done ? "done" : ""}" data-toggle="${item.id}"></span>
      <span class="body"><div class="title"><span class="t">${esc(item.title)}</span></div>${taskMeta(item, showDate)}</span></button>`;
  }
  if (kind === "holiday") {
    return `<div class="row"><span class="marker holiday"></span><span class="body"><div class="title"><span class="t">${esc(item)}</span></div><div class="meta">Holiday</div></span></div>`;
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
      <span class="body"><div class="title"><span class="t">${esc(item.title)}</span></div><div class="meta">${compact ? FREQS[item.freq] : showDate ? "Next " + fmtLong(nextDue(item)) + " · " + FREQS[item.freq] : money(item.amount) + " · " + FREQS[item.freq]}</div></span>
      ${showDate || compact ? `<span class="amount">${money(item.amount)}</span>` : ""}</button>`;
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
  ...it.holidays.map((x) => ({ kind: "holiday", x, at: "" })),
].sort((a, b) => (a.at || "99:99").localeCompare(b.at || "99:99")).map((r) => row(r.kind, r.x, { ds })).join("");

// Two bubbles side by side, both always visible: the selected day, and its week.
// One card: the selected day on top, then the rest of its week (the selected day is not repeated).
function cardHTML() {
  const today = todayIso(), sel = state.selected, week = weekDates(sel);
  const rows = sortedRows(itemsOn(sel), sel);
  const later = week.filter((ds) => ds > sel).map((ds) => ({ ds, it: itemsOn(ds) }))
    .filter((d) => d.it.events.length + d.it.tasks.length + d.it.payments.length + d.it.birthdays.length + d.it.holidays.length)
    .map((d) => `<div class="day-label">${fmtLong(d.ds)}</div>${sortedRows(d.it, d.ds)}`).join("");
  const weekTitle = today >= week[0] && today <= week[6] ? "This week" : "Rest of the week";
  // Only show what has something in it; with nothing on the day or later in the week, no card at all.
  const dayPart = rows ? `<h2 class="b-title">Today</h2><div class="b-list"><div class="day-label">${fmtLong(sel)}</div>${rows}</div>` : "";
  const weekPart = later ? `<h2 class="b-title">${weekTitle}</h2><div class="b-list">${later}</div>` : "";
  return dayPart + (dayPart && weekPart ? `<div class="b-sep"></div>` : "") + weekPart;
}
const panelHTML = () => { const c = cardHTML(); return c ? `<div class="bubbles"><section class="bubble">${c}</section></div>` : ""; };

function renderCalendar() {
  const y = state.view.getFullYear(), m = state.view.getMonth();
  const first = new Date(y, m, 1), start = new Date(y, m, 1 - first.getDay());
  const weeks = Math.ceil((first.getDay() + daysInMonth(y, m)) / 7);
  const today = todayIso();
  // Events longer than a day: a soft band behind their dates, with a solid circle on the first and last day.
  const lastDay = new Date(start); lastDay.setDate(start.getDate() + weeks * 7 - 1);
  const [gridFrom, gridTo] = [iso(start), iso(lastDay)];
  const multi = state.data.events.filter((e) => (e.endDate || e.date) > e.date && e.date <= gridTo && e.endDate >= gridFrom);
  let cells = "";
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const ds = iso(d), it = itemsOn(ds);
    const dots = [
      ...it.events.filter((e) => (e.endDate || e.date) === e.date).map(() => "event"),
      ...it.tasks.map(() => "task"),
      ...it.payments.map(() => "payment"),
      ...it.birthdays.map(() => "birthday"),
      ...it.holidays.map(() => "holiday"),
    ].slice(0, 4).map((k) => `<i class="dot ${k}"></i>`).join("");
    const dow = d.getDay();
    const spans = multi.filter((e) => e.date <= ds && ds <= e.endDate).map((e) => {
      const capL = ds === e.date || dow === 0, capR = ds === e.endDate || dow === 6;   // rounded ends at the real start/end and at week edges
      return `<i class="span" style="left:${capL ? "4.5px" : "-0.5px"};right:${capR ? "4.5px" : "-0.5px"};border-radius:${capL ? 999 : 0}px ${capR ? 999 : 0}px ${capR ? 999 : 0}px ${capL ? 999 : 0}px"></i>`;
    }).join("");
    const isEnd = multi.some((e) => ds === e.date || ds === e.endDate);
    cells += `<button class="day ${d.getMonth() !== m ? "out" : ""} ${ds === today ? "today" : ""} ${ds === state.selected ? "sel" : ""} ${isEnd ? "ev-end" : ""}" data-day="${ds}">
      <span class="num">${d.getDate()}</span><span class="dots">${dots}</span>${spans}<span class="plus" aria-hidden="true">${I.plus}</span></button>`;
  }
  return `${header(MONTHS[m], String(y), {})}
    <div class="dow">${DOW.map((d) => `<span>${d}</span>`).join("")}</div>
    <div class="grid" id="grid">${cells}</div>
    <div id="panel">${panelHTML()}</div>`;
}

// Empty tabs: faint placeholder rows showing what the list will look like, plus a short message
const emptyHTML = (title, text) => `<div class="ghost-card" aria-hidden="true">${
  [[70, 36], [54, 28], [62, 32]].map(([a, b]) => `<div class="ghost"><i></i><div><u style="width:${a}%"></u><u class="s" style="width:${b}%"></u></div></div>`).join("")}</div>
  <div class="empty-msg"><h2>${esc(title)}</h2><p>${esc(text)}</p></div>`;

function renderTodo() {
  const open = state.data.tasks.filter((t) => !t.done).sort((a, b) => (a.due || "9").localeCompare(b.due || "9") || (a.time || "").localeCompare(b.time || ""));
  const done = state.data.tasks.filter((t) => t.done);
  const today = todayIso(), weekEnd = weekDates(today)[6];
  const overdue = open.filter((t) => t.due && t.due < today);
  // grouped by when they're due; empty groups don't show
  const groups = [
    ["Overdue", overdue, "od"],
    ["Today", open.filter((t) => t.due === today), ""],
    ["This week", open.filter((t) => t.due > today && t.due <= weekEnd), ""],
    ["Later", open.filter((t) => t.due > weekEnd), ""],
    ["No date", open.filter((t) => !t.due), ""],
    ["Completed", done, ""],
  ].filter(([, list]) => list.length);
  return `${header("To Do", "")}
    ${open.length || done.length ? "" : emptyHTML("Nothing yet", "Your tasks will show up here. Tap + to add the first one.")}
    ${groups.map(([label, list, cls]) => `<div class="group-label ${cls}">${label}</div><div class="pay-card">${list.map((t) => row("task", t, { showDate: label !== "Today" })).join("")}</div>`).join("")}`;
}

function renderPayments() {
  const ps = state.data.payments;
  const total = ps.reduce((s, p) => s + monthlyCost(p), 0);
  const today = todayIso(), t0 = parse(today);
  const dayAt = (i) => { const d = new Date(t0); d.setDate(t0.getDate() + i); return iso(d); };
  // the next seven days, with a dot where money goes out
  const strip = Array.from({ length: 7 }, (_, i) => {
    const ds = dayAt(i), any = ps.some((p) => paymentOn(p, ds));
    return `<div class="${i === 0 ? "on" : ""}"><span class="cap">${parse(ds).toLocaleDateString(undefined, { weekday: "short" })}</span><b>${parse(ds).getDate()}</b><i class="${any ? "" : "none"}"></i></div>`;
  }).join("");
  // every charge in the next 30 days, in date order
  const due = [];
  for (let i = 0; i < 30; i++) { const ds = dayAt(i); ps.forEach((p) => { if (paymentOn(p, ds)) due.push({ p, ds }); }); }
  const dueRows = due.map(({ p, ds }) => `<button class="row pay-row" data-edit="payment:${p.id}">
      <span class="pay-dt"><b>${parse(ds).getDate()}</b><span>${parse(ds).toLocaleDateString(undefined, { weekday: "short" })}</span></span>
      <span class="body"><div class="title"><span class="t">${esc(p.title)}</span></div><div class="meta">${FREQS[p.freq]}</div></span>
      <span class="amount">${money(p.amount)}</span></button>`).join("");
  const later = ps.filter((p) => !due.some((d) => d.p === p)).sort((a, b) => nextDue(a).localeCompare(nextDue(b)));
  return `${header("Payments", "")}
    <div class="pay-combo"><div class="pay-combo-row"><span class="lbl">Monthly total</span><b>${money(total)}</b></div><div class="pay-strip7">${strip}</div></div>
    ${ps.length ? `<div class="group-label">Next 30 days</div>
      ${dueRows ? `<div class="pay-card">${dueRows}</div>` : `<div class="empty" style="padding:24px 0">Nothing due in the next 30 days.</div>`}
      ${later.length ? `<div class="group-label">Later</div><div class="pay-card">${later.map((p) => row("payment", p, { showDate: true })).join("")}</div>` : ""}`
      : emptyHTML("No payments yet", "Recurring payments will show up here. Tap + to add the first one.")}`;
}

function renderEvents() {
  const today = todayIso();
  const evs = [...state.data.events].sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
  const upcoming = evs.filter((e) => e.date >= today), past = evs.filter((e) => e.date < today).reverse();
  const [next, ...rest] = upcoming;
  const away = (e) => daysBetween(today, e.date);
  const where = (e) => (e.location ? " · " + esc(e.location) : "");
  const hero = next ? (() => {
    const n = away(next), end = next.endDate || next.date;
    const when = end !== next.date ? `${fmtLong(next.date)} – ${fmtLong(end)}` : eventWhen(next, next.date, false);
    return `<button class="ev-hero" data-edit="event:${next.id}"><span class="cap">Up next · ${n === 0 ? "Today" : fmtLong(next.date)}</span>
      <h2>${esc(next.title)}</h2><p>${when}${where(next)}</p><span class="pill">${n === 0 ? "Today" : n === 1 ? "Tomorrow" : `In ${n} days`}</span></button>`;
  })() : "";
  const restRows = rest.map((e) => `<button class="row" data-edit="event:${e.id}"><span class="marker"></span>
      <span class="body"><div class="title"><span class="t">${esc(e.title)}</span></div><div class="meta">${eventWhen(e, e.date, true)}${where(e)}</div></span>
      <span class="when">${away(e) === 1 ? "Tomorrow" : away(e) + " days"}</span></button>`).join("");
  const pastRows = past.map((e) => row("event", e, { showDate: true })).join("");
  return `${header("Events", "")}
    ${evs.length ? "" : emptyHTML("No events yet", "Your events will show up here. Tap + to add the first one.")}
    ${hero}
    ${rest.length ? `<div class="group-label">After that</div><div class="pay-card">${restRows}</div>` : ""}
    ${past.length ? `<div class="group-label" style="margin-top:34px">Past</div><div class="list">${pastRows}</div>` : ""}`;
}

function renderBirthdays() {
  const list = state.data.birthdays.map((b) => ({ b, next: nextBirthday(b) })).sort((a, c) => a.next.localeCompare(c.next));
  const [first, ...rest] = list;
  const day = (ds) => parse(ds).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const hero = first ? (() => {
    const n = daysBetween(todayIso(), first.next), turns = turnsOn(first.b, first.next);
    return `<button class="ev-hero" data-edit="birthday:${first.b.id}"><span class="cap">Next birthday · ${n === 0 ? "Today" : day(first.next)}</span>
      <h2>${esc(first.b.title)}</h2><p>${turns || "Birthday"}</p><span class="pill">${n === 0 ? "Today" : n === 1 ? "Tomorrow" : `In ${n} days`}</span></button>`;
  })() : "";
  const rows = rest.map(({ b, next }) => `<button class="row" data-edit="birthday:${b.id}"><span class="marker birthday"></span>
      <span class="body"><div class="title"><span class="t">${esc(b.title)}</span></div><div class="meta">${[day(next), turnsOn(b, next)].filter(Boolean).join(" · ")}</div></span>
      <span class="when">${countdown(next)}</span></button>`).join("");
  return `${header("Birthdays", "")}
    ${list.length ? "" : emptyHTML("No birthdays yet", "Birthdays will show up here. Tap + to add the first one.")}
    ${hero}
    ${rest.length ? `<div class="group-label">After that</div><div class="pay-card">${rows}</div>` : ""}`;
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
  const panel = document.getElementById("panel"); if (!panel) return;
  panel.innerHTML = panelHTML();
  const card = panel.querySelector(".bubble"); if (!card) return;
  card.querySelectorAll(".b-title").forEach((el, i) => rise(el, i * 25));
  card.querySelectorAll(".b-list").forEach((list, s) => [...list.children].forEach((r, j) => rise(r, 50 + s * 70 + j * 35)));
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
    // slide the month name and year
    document.querySelectorAll(".head h1, .head .sub > span:first-child").forEach((el) =>
      animate(el, [{ opacity: 0, transform: `translateX(${dir * 14}px)` }, { opacity: 1, transform: "none" }], { duration: 300 }));
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

// ---------- sheets (add / edit) ----------
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
    if (a === "theme") return toggleTheme(q("[data-act]"));
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

// ---------- jump to a month: hold the month name, slide, tap a month ----------
// Hold ~half a second on the month name; a ribbon of months opens. Slide to scrub (the calendar follows live).
// Let go and the ribbon stays open: drag it, then tap a month to land on it. Tapping outside cancels.
const JUMP = { N: 36, cell: 56, HOLD: 450 };
let jump = null, jh = null;
const viewIdx = () => state.view.getFullYear() * 12 + state.view.getMonth();
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
function showMonth(idx) { state.view = new Date(Math.floor(idx / 12), ((idx % 12) + 12) % 12, 1); render(); }
function jumpPlace(off, smooth) {
  const w = jump.rail.parentElement.clientWidth;
  jump.rail.style.transition = smooth ? "transform .26s cubic-bezier(.22,.8,.24,1)" : "none";
  jump.rail.style.transform = `translateX(${w / 2 - ((JUMP.N + off) * JUMP.cell + JUMP.cell / 2)}px)`;
}
function jumpOpen() {
  const app = document.getElementById("app"), head = document.querySelector(".head").getBoundingClientRect(), top = head.bottom - app.getBoundingClientRect().top + 10;
  let items = "";
  for (let k = -JUMP.N; k <= JUMP.N; k++) {
    const i = jump.base + k, m = ((i % 12) + 12) % 12, y = Math.floor(i / 12);
    items += `<div class="ji" style="left:${(k + JUMP.N) * JUMP.cell}px"><span>${MONTHS[m].slice(0, 3)}</span>${m === 0 ? `<small>${y}</small>` : ""}</div>`;
  }
  const root = document.createElement("div"); root.id = "jump";
  root.innerHTML = `<div class="jrib" style="top:${top}px"><div class="jmask"><div class="jrail">${items}</div></div><i class="jpick"></i></div>`;
  app.append(root);
  jump.root = root; jump.rail = root.querySelector(".jrail"); jump.top = top; jumpPlace(0, false);
  animate(root.firstElementChild, [{ opacity: 0, transform: "translateY(-6px) scale(.97)" }, { opacity: 1, transform: "none" }], { duration: 240 });
  root.addEventListener("pointerdown", (e) => {
    if (!jump?.pinned) return;
    if (!e.target.closest(".jrib")) return jumpClose(jump.base);                 // outside: cancel
    root.setPointerCapture(e.pointerId); jump.g = { x: e.clientX, off0: jump.off, moved: false };
  });
  root.addEventListener("pointermove", (e) => {
    const g = jump?.g; if (!g) return;
    const dx = e.clientX - g.x; if (!g.moved && Math.abs(dx) < 6) return;
    g.moved = true; jump.off = clampN(g.off0 - dx / JUMP.cell, -JUMP.N + 1, JUMP.N - 1); jumpPlace(jump.off, false);
    const idx = jump.base + Math.round(jump.off); if (idx !== viewIdx()) showMonth(idx);
  });
  root.addEventListener("pointerup", (e) => {
    const g = jump?.g; if (!g) return; jump.g = null;
    if (g.moved) { jump.off = Math.round(jump.off); jumpPlace(jump.off, true); return; }       // snap to the nearest month
    const box = root.querySelector(".jmask").getBoundingClientRect();                         // a tap: land on the month you tapped
    jump.off = Math.round(jump.off) + Math.round((e.clientX - (box.left + box.width / 2)) / JUMP.cell);
    jumpPlace(jump.off, true); const idx = jump.base + jump.off; if (idx !== viewIdx()) showMonth(idx);
    const j = jump; setTimeout(() => { if (jump === j) jumpClose(idx); }, 240);
  });
}
function jumpPin() {
  jump.pinned = true; jump.root.classList.add("pinned");
  jump.off = Math.round(jump.off); jumpPlace(jump.off, true);
  const hint = document.createElement("div"); hint.className = "jhint"; hint.textContent = "Tap a month to go there";
  hint.style.top = `${jump.top + 58 + 8}px`; jump.root.append(hint);
  animate(hint, [{ opacity: 0, transform: "translateY(-4px)" }, { opacity: 1, transform: "none" }], { duration: 260 });
}
function jumpClose(land) {
  const j = jump; if (!j) return; jump = null;
  if (land !== viewIdx()) showMonth(land);
  animate(j.root, [{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: "forwards" });
  setTimeout(() => j.root.remove(), reduceMotion ? 0 : 200);
}
document.addEventListener("pointerdown", (e) => {
  if (state.tab !== "calendar" || jump || monthBusy || e.button || !e.target.closest(".head > div:first-child")) return;
  const h = (jh = { x: e.clientX, y: e.clientY, id: e.pointerId, open: false });
  h.timer = setTimeout(() => {
    h.open = true; jump = { base: viewIdx(), off: 0, pinned: false };
    jumpOpen(); document.getElementById("app").setPointerCapture?.(h.id);
  }, JUMP.HOLD);
});
document.addEventListener("pointermove", (e) => {
  if (!jh) return;
  if (!jh.open) { if (Math.hypot(e.clientX - jh.x, e.clientY - jh.y) > 8) { clearTimeout(jh.timer); jh = null; } return; }
  jump.off = clampN(-(e.clientX - jh.x) / JUMP.cell, -JUMP.N + 1, JUMP.N - 1); jumpPlace(jump.off, false);
  const idx = jump.base + Math.round(jump.off); if (idx !== viewIdx()) showMonth(idx);
});
function endJumpHold() {
  if (!jh) return; clearTimeout(jh.timer);
  const was = jh; jh = null; if (!was.open) return;
  justDragged = true; setTimeout(() => { justDragged = false; }, 80);
  jumpPin();
}
document.addEventListener("pointerup", endJumpHold);
document.addEventListener("pointercancel", endJumpHold);
document.addEventListener("contextmenu", (e) => { if (e.target.closest?.(".head > div:first-child")) e.preventDefault(); });

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && jump) return jumpClose(jump.base);
  if (state.tab !== "calendar" || liveScrim() || e.target.matches("input, textarea, select")) return;
  if (e.key === "ArrowLeft") changeMonth(-1);
  if (e.key === "ArrowRight") changeMonth(1);
});

render();

// iOS home-screen apps report a page height shorter than the screen (by the status-bar inset) and leave the strip below blank,
// unless the document itself is as tall as the screen. fitScreen (defined in index.html's <head> so it runs before the first
// paint) makes it so; here it only re-checks on events. It never switches the mode off while the gap is 0..120, so the layout
// can't flip back and forth after launch.
const fitScreen = window.fitScreen || (() => {});
for (const ev of ["resize", "pageshow", "focus"]) addEventListener(ev, fitScreen);
document.addEventListener("visibilitychange", fitScreen);
addEventListener("orientationchange", () => setTimeout(fitScreen, 300));
// the document is taller than the viewport in that mode; never let it scroll away from the top
addEventListener("scroll", () => { if (scrollY && document.documentElement.classList.contains("tall-screen")) scrollTo(0, 0); }, { passive: true });
