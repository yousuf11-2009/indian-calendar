// ───────────────────────── State ─────────────────────────
const today = new Date();
let state = {
  view: "month",
  year: today.getFullYear(),
  month: today.getMonth() + 1, // 1-12
  selectedDay: null,
  events: [],
  holidaysCache: {}, // year -> {iso: {name,type,religion}}
  meta: null,
  editingEventId: null,
};

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DOW_LABELS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

const $ = (sel) => document.querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

function pad2(n){ return String(n).padStart(2,"0"); }
function isoOf(y,m,d){ return `${y}-${pad2(m)}-${pad2(d)}`; }
function todayIso(){ return isoOf(today.getFullYear(), today.getMonth()+1, today.getDate()); }

// ───────────────────────── API ─────────────────────────
async function fetchMeta(){
  const r = await fetch("/api/meta");
  state.meta = await r.json();
}
async function fetchHolidays(year){
  if (state.holidaysCache[year]) return state.holidaysCache[year];
  const r = await fetch(`/api/holidays/${year}`);
  const data = await r.json();
  state.holidaysCache[year] = data;
  return data;
}
async function fetchEvents(){
  const r = await fetch("/api/events");
  state.events = await r.json();
}
async function saveEvent(payload){
  if (state.editingEventId){
    await fetch(`/api/events/${state.editingEventId}`, {
      method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload)
    });
  } else {
    await fetch("/api/events", {
      method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload)
    });
  }
  await fetchEvents();
}
async function deleteEvent(id){
  await fetch(`/api/events/${id}`, { method:"DELETE" });
  await fetchEvents();
}

// ───────────────────────── Helpers ─────────────────────────
function eventsFor(iso){
  const [y,m,d] = iso.split("-").map(Number);
  return state.events.filter(ev=>{
    if (ev.date === iso) return true;
    if (ev.repeatYearly){
      const [ey,em,ed] = ev.date.split("-").map(Number);
      return em===m && ed===d;
    }
    return false;
  });
}
function weekdayIndexMon0(y,m,d){ // Monday=0..Sunday=6
  const jsDay = new Date(y, m-1, d).getDay(); // Sun=0..Sat=6
  return (jsDay + 6) % 7;
}
function daysInMonth(y,m){ return new Date(y, m, 0).getDate(); }

function monthMatrix(y,m){
  const first = weekdayIndexMon0(y,m,1);
  const total = daysInMonth(y,m);
  const cells = [];
  for(let i=0;i<first;i++) cells.push(0);
  for(let d=1; d<=total; d++) cells.push(d);
  while(cells.length % 7 !== 0) cells.push(0);
  const weeks = [];
  for(let i=0;i<cells.length;i+=7) weeks.push(cells.slice(i,i+7));
  return weeks;
}

// ───────────────────────── Theme ─────────────────────────
function applyTheme(t){
  document.body.setAttribute("data-theme", t);
  localStorage.removeItem; // no-op (artifact safety note doesn't apply, but keep simple)
  $("#darkBtn").classList.toggle("active", t==="dark");
  $("#lightBtn").classList.toggle("active", t==="light");
  window.__theme = t;
}

// ───────────────────────── Drawer ─────────────────────────
function openDrawer(){ $("#drawer").classList.add("open"); $("#overlay").classList.add("show"); }
function closeDrawer(){ $("#drawer").classList.remove("open"); $("#overlay").classList.remove("show"); }

// ───────────────────────── Modals ─────────────────────────
function showModal(id){ $(id).classList.add("show"); }
function hideModal(id){ $(id).classList.remove("show"); }

function openMonthModal(){
  $("#monthModalYear").textContent = state.year;
  const grid = $("#monthGrid");
  grid.innerHTML = "";
  fetchHolidays(state.year).then(hols=>{
    for(let m=1; m<=12; m++){
      const hasHol = Object.keys(hols).some(k=>k.startsWith(`${state.year}-${pad2(m)}`));
      const cell = document.createElement("div");
      cell.className = "month-cell" + (m===state.month ? " active" : "");
      cell.innerHTML = `${MONTH_SHORT[m-1]}` + (hasHol ? `<span class="month-dot"></span>` : "");
      cell.onclick = () => { state.month = m; hideModal("#monthModal"); render(); };
      grid.appendChild(cell);
    }
  });
  showModal("#monthModal");
}

function openYearModal(){
  const grid = $("#yearGrid");
  grid.innerHTML = "";
  const startY = state.year - 6;
  for(let y=startY; y<=startY+11; y++){
    const cell = document.createElement("div");
    cell.className = "year-cell" + (y===state.year ? " active" : "");
    cell.textContent = y;
    cell.onclick = () => { state.year = y; hideModal("#yearModal"); render(); };
    grid.appendChild(cell);
  }
  showModal("#yearModal");
}

// ───────────────────────── Event modal ─────────────────────────
function openEventModal(iso, existing){
  state.editingEventId = existing ? existing.id : null;
  const d = new Date(iso + "T00:00:00");
  $("#eventModalDate").textContent = d.toLocaleDateString(undefined, {day:"numeric", month:"long", year:"numeric"});
  $("#evTitle").value = existing ? existing.title : "";
  $("#evTime").value = existing ? (existing.time||"") : "";
  $("#evNotes").value = existing ? (existing.desc||"") : "";
  $("#evDelete").style.display = existing ? "inline-block" : "none";

  const typeRow = $("#typeRow");
  typeRow.innerHTML = "";
  const types = state.meta.event_types;
  let selectedType = existing ? existing.type : "event";
  Object.entries(types).forEach(([key, meta])=>{
    const pill = document.createElement("div");
    pill.className = "type-pill" + (key===selectedType ? " active" : "");
    pill.style.background = key===selectedType ? meta.color : "";
    pill.textContent = `${meta.icon} ${meta.label}`;
    pill.onclick = () => {
      selectedType = key;
      $$(".type-pill", typeRow).forEach(p=>{ p.classList.remove("active"); p.style.background=""; });
      pill.classList.add("active");
      pill.style.background = meta.color;
    };
    typeRow.appendChild(pill);
  });

  let repeat = existing ? !!existing.repeatYearly : false;
  const repeatBtn = $("#evRepeat");
  repeatBtn.classList.toggle("active", repeat);
  repeatBtn.onclick = () => { repeat = !repeat; repeatBtn.classList.toggle("active", repeat); };

  $("#evSave").onclick = async () => {
    const title = $("#evTitle").value.trim();
    if (!title){ $("#evTitle").focus(); return; }
    await saveEvent({
      date: iso, type: selectedType, title,
      desc: $("#evNotes").value.trim(), time: $("#evTime").value.trim(),
      repeatYearly: repeat,
    });
    hideModal("#eventModal");
    render();
  };
  $("#evDelete").onclick = async () => {
    if (existing && confirm(`Delete '${existing.title}'?`)){
      await deleteEvent(existing.id);
      hideModal("#eventModal");
      render();
    }
  };
  showModal("#eventModal");
}

// (helpers $ and $$ defined above are reused throughout)

// ───────────────────────── Search ─────────────────────────
let searchTimer = null;
function onSearchInput(){
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 150);
}
async function runSearch(){
  const q = $("#searchInput").value.trim().toLowerCase();
  const box = $("#searchResults");
  if (!q){ box.classList.remove("show"); box.innerHTML=""; return; }

  let results = [];
  state.events.forEach(ev=>{
    if (ev.title.toLowerCase().includes(q) || (ev.desc||"").toLowerCase().includes(q)){
      const meta = state.meta.event_types[ev.type] || state.meta.event_types.event;
      results.push({icon: meta.icon, name: ev.title, date: ev.date});
    }
  });
  const years = [state.year-1, state.year, state.year+1, state.year+2];
  for (const y of years){
    const hols = await fetchHolidays(y);
    Object.entries(hols).forEach(([iso, info])=>{
      if (info.name.toLowerCase().includes(q)) results.push({icon:"🎉", name:info.name, date:iso});
    });
  }
  if (q.match(/^\d{4}(-\d{0,2}(-\d{0,2})?)?$/)){
    results.push({icon:"📅", name:`Go to ${q}`, date:q.length===10?q:null, isDateQuery:true, raw:q});
  }
  results = results.slice(0,10);

  box.innerHTML = `<div class="search-results-inner">${
    results.length ? results.map(r=>`
      <div class="search-row" data-date="${r.date||''}" data-raw="${r.raw||''}">
        <span>${r.icon} ${r.name}</span>
        <span class="sr-date">${r.date||''}</span>
      </div>`).join("") : `<div class="search-empty">No matches found</div>`
  }</div>`;
  box.classList.add("show");

  $$(".search-row", box).forEach(row=>{
    row.onclick = () => {
      const dateStr = row.dataset.date;
      if (dateStr && dateStr.length===10){
        const [y,m,d] = dateStr.split("-").map(Number);
        state.year=y; state.month=m; state.selectedDay=d; state.view="month";
        $("#searchInput").value=""; box.classList.remove("show");
        render();
      }
    };
  });
}

// ───────────────────────── Navigation ─────────────────────────
function navPrev(){
  if (state.view==="year"){ state.year--; }
  else if (state.view==="day" || state.view==="week"){
    const d = new Date(state.year, state.month-1, state.selectedDay||1);
    d.setDate(d.getDate() - (state.view==="day"?1:7));
    state.year=d.getFullYear(); state.month=d.getMonth()+1; state.selectedDay=d.getDate();
  } else {
    state.month--; if (state.month<1){ state.month=12; state.year--; }
  }
  render();
}
function navNext(){
  if (state.view==="year"){ state.year++; }
  else if (state.view==="day" || state.view==="week"){
    const d = new Date(state.year, state.month-1, state.selectedDay||1);
    d.setDate(d.getDate() + (state.view==="day"?1:7));
    state.year=d.getFullYear(); state.month=d.getMonth()+1; state.selectedDay=d.getDate();
  } else {
    state.month++; if (state.month>12){ state.month=1; state.year++; }
  }
  render();
}
function goToday(){
  state.year=today.getFullYear(); state.month=today.getMonth()+1;
  state.selectedDay = state.view==="day" ? today.getDate() : null;
  if (state.view==="year") state.view="month";
  render();
}
function setView(v){
  state.view=v;
  $$(".tab").forEach(t=> t.classList.toggle("active", t.dataset.view===v));
  render();
}

// ───────────────────────── Rendering ─────────────────────────
async function render(){
  $("#monthLabel").textContent = state.meta.month_names[state.month-1];
  $("#yearLabel").textContent = state.year;
  $("#monthLabelBtn").style.display = state.view==="year" ? "none" : "inline-flex";
  $("#viewHint").style.display = state.view==="month" ? "block" : "none";

  const content = $("#content");
  content.innerHTML = "";

  if (state.view==="month") await renderMonth(content);
  else if (state.view==="day") await renderDay(content);
  else if (state.view==="week") await renderWeek(content);
  else if (state.view==="year") await renderYear(content);

  renderLegend();
}

async function renderMonth(content){
  const hols = await fetchHolidays(state.year);
  const weeks = monthMatrix(state.year, state.month);
  const todayStr = todayIso();

  const card = document.createElement("div");
  card.className = "cal-card";

  const dow = document.createElement("div");
  dow.className = "dow-row";
  DOW_LABELS.forEach((l,i)=>{
    const c = document.createElement("div");
    c.className = "dow-cell" + (i>=5 ? " weekend" : "");
    c.textContent = l;
    dow.appendChild(c);
  });
  card.appendChild(dow);

  const grid = document.createElement("div");
  grid.className = "day-grid";
  let workdays = 0, natCount=0, optCount=0;

  Object.entries(hols).forEach(([iso, info])=>{
    if (iso.startsWith(`${state.year}-${pad2(state.month)}`)){
      if (info.type==="national") natCount++; else optCount++;
    }
  });

  weeks.forEach((week, wi)=>{
    week.forEach((day, ci)=>{
      const cellWrap = document.createElement("div");
      cellWrap.className = "day-cell";
      if (day===0){
        cellWrap.innerHTML = `<button class="day-btn empty"></button>`;
        grid.appendChild(cellWrap);
        return;
      }
      const iso = isoOf(state.year, state.month, day);
      const hol = hols[iso];
      const evs = eventsFor(iso);
      const isToday = iso===todayStr;
      const isSelected = state.selectedDay===day;
      const isWeekend = ci>=5;
      if (isWeekend && !hol) ; // weekend doesn't count workday
      if (!isWeekend && !hol) workdays++;

      const btn = document.createElement("button");
      btn.className = "day-btn" + (isToday?" today":"") + (hol?" holiday":"") + (isWeekend && !hol?" weekend":"") + (isSelected?" selected":"");
      btn.textContent = day;
      if (hol || evs.length){
        const dot = document.createElement("span");
        dot.className = "day-dot";
        dot.style.background = hol ? (state.meta.category_colors[hol.religion]?.fg || "#ffb74d") : "var(--purple)";
        btn.appendChild(dot);
      }
      btn.onclick = () => {
        state.selectedDay = state.selectedDay===day ? null : day;
        render();
      };
      cellWrap.appendChild(btn);
      grid.appendChild(cellWrap);
    });
  });
  card.appendChild(grid);

  const stats = document.createElement("div");
  stats.className = "stats-row";
  const evCount = state.events.filter(e=>e.date.startsWith(`${state.year}-${pad2(state.month)}`)).length;
  [["Workdays",workdays,"var(--purple)"],["National",natCount,"var(--green)"],
   ["Optional",optCount,"var(--orange)"],["Events",evCount,"#9c6dff"]].forEach(([label,val,color])=>{
    const s = document.createElement("div");
    s.className="stat";
    s.innerHTML = `<div class="stat-val" style="color:${color}">${val}</div><div class="stat-label">${label.toUpperCase()}</div>`;
    stats.appendChild(s);
  });
  card.appendChild(stats);
  content.appendChild(card);

  if (state.selectedDay){
    renderDayDetail(content, isoOf(state.year, state.month, state.selectedDay), hols);
  }

  const monthHols = Object.entries(hols).filter(([iso])=>iso.startsWith(`${state.year}-${pad2(state.month)}`))
    .sort((a,b)=>a[0].localeCompare(b[0]));
  if (monthHols.length){
    const label = document.createElement("div");
    label.className = "section-label";
    label.textContent = "HOLIDAYS THIS MONTH";
    content.appendChild(label);
    monthHols.forEach(([iso, info])=>{
      const day = Number(iso.split("-")[2]);
      const rel = state.meta.category_colors[info.religion];
      const row = document.createElement("div");
      row.className = "panel";
      row.style.padding = "10px 14px";
      row.innerHTML = `
        <div class="panel-row" style="padding:0;">
          <span class="badge" style="background:${info.type==='national'?'var(--green)':'var(--orange)'};color:${info.type==='national'?'#0a1a10':'#2a1a05'}">${info.type.slice(0,3).toUpperCase()}</span>
          <span style="color:var(--faint);font-size:12px;">${day}</span>
          <span class="grow">${info.name}</span>
          ${rel ? `<span class="badge" style="background:${rel.bg};color:${rel.fg}">${rel.label}</span>` : ""}
        </div>`;
      content.appendChild(row);
    });
  }
}

function renderDayDetail(content, iso, hols){
  const hol = hols[iso];
  const evs = eventsFor(iso);
  const d = new Date(iso+"T00:00:00");
  const panel = document.createElement("div");
  panel.className = "panel";
  let html = `<p class="panel-date">${d.getDate()} ${state.meta.month_names[d.getMonth()]} ${d.getFullYear()}</p>
              <p class="panel-weekday">${d.toLocaleDateString(undefined,{weekday:"long"})}</p>`;
  const isWeekend = d.getDay()===0 || d.getDay()===6;
  if (!hol && !evs.length && !isWeekend){
    html += `<div class="panel-empty">No events — regular workday</div>`;
  }
  if (hol){
    const rel = state.meta.category_colors[hol.religion];
    html += `<div class="panel-row">
      <span class="badge" style="background:${hol.type==='national'?'var(--green)':'var(--orange)'};color:${hol.type==='national'?'#0a1a10':'#2a1a05'}">${hol.type.slice(0,3).toUpperCase()}</span>
      <span class="grow">${hol.name}</span>
      ${rel ? `<span class="badge" style="background:${rel.bg};color:${rel.fg}">${rel.label}</span>` : ""}
    </div>`;
  }
  if (isWeekend && !hol){
    html += `<div class="panel-row"><span class="badge" style="background:#3a1525;color:var(--weekend)">WKD</span><span>${d.toLocaleDateString(undefined,{weekday:"long"})}</span></div>`;
  }
  evs.forEach(ev=>{
    const meta = state.meta.event_types[ev.type] || state.meta.event_types.event;
    html += `<div class="panel-row" data-evid="${ev.id}">
      <span>${meta.icon}</span>
      <span class="grow">${ev.title}${ev.time ? " · "+ev.time : ""}</span>
      <span class="row-actions">
        <button class="mini-icon-btn edit" data-id="${ev.id}">✎</button>
        <button class="mini-icon-btn del" data-id="${ev.id}">✕</button>
      </span>
    </div>`;
  });
  panel.innerHTML = html;
  const addBtn = document.createElement("button");
  addBtn.className = "add-event-btn";
  addBtn.textContent = "+ Add Event";
  addBtn.onclick = () => openEventModal(iso, null);
  panel.appendChild(addBtn);
  content.appendChild(panel);

  $$(".mini-icon-btn.edit", panel).forEach(b=>{
    b.onclick = () => {
      const ev = state.events.find(e=>e.id===b.dataset.id);
      openEventModal(iso, ev);
    };
  });
  $$(".mini-icon-btn.del", panel).forEach(b=>{
    b.onclick = async () => {
      const ev = state.events.find(e=>e.id===b.dataset.id);
      if (confirm(`Delete '${ev.title}'?`)){
        await deleteEvent(b.dataset.id);
        render();
      }
    };
  });
}

async function renderDay(content){
  if (!state.selectedDay) state.selectedDay = (state.year===today.getFullYear() && state.month===today.getMonth()+1) ? today.getDate() : 1;
  const hols = await fetchHolidays(state.year);
  renderDayDetail(content, isoOf(state.year, state.month, state.selectedDay), hols);
}

async function renderWeek(content){
  const anchorDay = state.selectedDay || today.getDate();
  const anchor = new Date(state.year, state.month-1, anchorDay);
  const dow = (anchor.getDay()+6)%7;
  const monday = new Date(anchor); monday.setDate(anchor.getDate()-dow);
  const hols = await fetchHolidays(state.year);
  const todayStr = todayIso();

  for (let i=0;i<7;i++){
    const d = new Date(monday); d.setDate(monday.getDate()+i);
    const iso = isoOf(d.getFullYear(), d.getMonth()+1, d.getDate());
    const hol = hols[iso];
    const evs = eventsFor(iso);
    const row = document.createElement("div");
    row.className = "week-row" + (iso===todayStr ? " today" : "");
    let infoHtml = "";
    if (!hol && !evs.length) infoHtml = `<div class="none">No events</div>`;
    if (hol){
      const rel = state.meta.category_colors[hol.religion];
      infoHtml += `<div class="line" style="color:${rel?.fg||'var(--orange)'}">● ${hol.name}</div>`;
    }
    evs.slice(0,2).forEach(ev=>{
      const meta = state.meta.event_types[ev.type] || state.meta.event_types.event;
      infoHtml += `<div class="line">${meta.icon} ${ev.title}</div>`;
    });
    if (evs.length>2) infoHtml += `<div class="line" style="color:var(--faint)">+${evs.length-2} more</div>`;

    row.innerHTML = `
      <div class="week-date"><span class="num">${d.getDate()}</span><span class="lbl">${DOW_LABELS[i]}</span></div>
      <div class="week-info">${infoHtml}</div>`;
    row.onclick = () => {
      state.year=d.getFullYear(); state.month=d.getMonth()+1; state.selectedDay=d.getDate(); state.view="day";
      $$(".tab").forEach(t=> t.classList.toggle("active", t.dataset.view==="day"));
      render();
    };
    content.appendChild(row);
  }
}

async function renderYear(content){
  const hols = await fetchHolidays(state.year);
  const todayStr = todayIso();
  const grid = document.createElement("div");
  grid.className = "year-grid-view";
  for (let m=1;m<=12;m++){
    const card = document.createElement("div");
    card.className = "year-month-card";
    const weeks = monthMatrix(state.year, m);
    let inner = `<div class="ym-title">${MONTH_SHORT[m-1]}</div><div class="ym-grid">`;
    weeks.forEach(week=>{
      week.forEach(day=>{
        if (day===0){ inner += `<div class="ym-day"></div>`; return; }
        const iso = isoOf(state.year,m,day);
        let cls = "ym-day";
        if (iso===todayStr) cls += " today";
        else if (hols[iso]) cls += " holiday";
        else if (eventsFor(iso).length) cls += " event";
        inner += `<div class="${cls}">${day}</div>`;
      });
    });
    inner += `</div>`;
    card.innerHTML = inner;
    card.onclick = () => { state.month=m; setView("month"); };
    grid.appendChild(card);
  }
  content.appendChild(grid);
}

function renderLegend(){
  const items = [["Today","var(--accent)"]];
  Object.values(state.meta.category_colors).forEach(v=> items.push([v.label, v.fg]));
  items.push(["Event","#9c6dff"]);
  $("#legendRow").innerHTML = items.map(([label,color])=>
    `<div class="legend-item"><span class="legend-dot" style="background:${color}"></span>${label}</div>`
  ).join("");
  $("#drawerLegend").innerHTML = items.map(([label,color])=>
    `<div class="legend-item"><span class="legend-dot" style="background:${color}"></span>${label}</div>`
  ).join("");
}

// ───────────────────────── Wire up ─────────────────────────
function wireEvents(){
  $("#openDrawer").onclick = openDrawer;
  $("#closeDrawer").onclick = closeDrawer;
  $("#overlay").onclick = () => { closeDrawer(); hideModal("#monthModal"); hideModal("#yearModal"); hideModal("#eventModal"); };

  $("#darkBtn").onclick = () => applyTheme("dark");
  $("#lightBtn").onclick = () => applyTheme("light");

  $("#drawerToday").onclick = () => { closeDrawer(); goToday(); };
  $("#drawerYearView").onclick = () => { closeDrawer(); setView("year"); };

  $$(".tab").forEach(t=> t.onclick = () => setView(t.dataset.view));
  $("#prevBtn").onclick = navPrev;
  $("#nextBtn").onclick = navNext;
  $("#fabToday").onclick = goToday;

  $("#monthLabelBtn").onclick = openMonthModal;
  $("#yearLabelBtn").onclick = openYearModal;
  $("#closeMonthModal").onclick = () => hideModal("#monthModal");
  $("#closeYearModal").onclick = () => hideModal("#yearModal");
  $("#closeEventModal").onclick = () => hideModal("#eventModal");
  $("#evCancel").onclick = () => hideModal("#eventModal");

  $("#searchInput").addEventListener("input", onSearchInput);
  $("#searchClear").onclick = () => { $("#searchInput").value=""; $("#searchResults").classList.remove("show"); };
}

async function init(){
  await fetchMeta();
  await fetchEvents();
  wireEvents();
  applyTheme("dark");
  await render();
}
init();
