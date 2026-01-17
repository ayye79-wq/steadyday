// =======================
// SteadyDay (app.js) — FULL FILE (clean + working)
// =======================

// ---------- Date helpers ----------
function isoDate(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function humanDate(d = new Date()) {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

// ---------- Toast ----------
function showToast(msg = "Saved ✓") {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._hide);
  t._hide = setTimeout(() => t.classList.remove("show"), 1400);
}

// ---------- Storage ----------
function loadAll() {
  try {
    return JSON.parse(localStorage.getItem("steadyday") || "{}");
  } catch {
    return {};
  }
}

function saveAll(db) {
  localStorage.setItem("steadyday", JSON.stringify(db));
}

function getToday(db) {
  const k = isoDate();
  if (!db[k]) {
    db[k] = {
      date: k,
      meds: {
        morning: { taken: false, time: null },
        evening: { taken: false, time: null },
      },
      glucose: [],
      notes: "",
      schedule: {
        morningTarget: "08:00",
        eveningTarget: "20:00",
        remindMorning: false,
        remindEvening: false,
      },
    };
  } else {
    db[k].schedule ||= {
      morningTarget: "08:00",
      eveningTarget: "20:00",
      remindMorning: false,
      remindEvening: false,
    };
    db[k].meds ||= {
      morning: { taken: false, time: null },
      evening: { taken: false, time: null },
    };
    db[k].glucose ||= [];
    db[k].notes ||= "";
  }
  return db[k];
}

// ---------- Misc ----------
function nowTime() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function isArabic(text) {
  return /[\u0600-\u06FF]/.test(text || "");
}

// ---------- Time helpers ----------
function minutesNow() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function normalizeHHMM(s) {
  s = String(s || "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;

  const hh = Number(m[1]);
  const mm = Number(m[2]);

  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  if (hh < 0 || hh > 23) return null;
  if (mm < 0 || mm > 59) return null;

  return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
}

function timeToMinutes(hhmm) {
  hhmm = String(hhmm || "").trim();
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;

  const h = Number(m[1]);
  const mm = Number(m[2]);

  if (Number.isNaN(h) || Number.isNaN(mm)) return null;
  if (h < 0 || h > 23) return null;
  if (mm < 0 || mm > 59) return null;

  return h * 60 + mm;
}

// ---------- Late status badge ----------
function setLateStatus(today) {
  const el = document.getElementById("lateStatus");
  if (!el) return;

  const sch = today.schedule || {};
  const now = minutesNow();

  const DUE_SOON_WINDOW = 30; // mins before target
  const GRACE = 10;           // mins after target before overdue/late

  // Targets
  const mTarget = timeToMinutes(normalizeHHMM(sch.morningTarget));
  const eTarget = timeToMinutes(normalizeHHMM(sch.eveningTarget));

  // Taken flags + times
  const mTaken = !!today.meds?.morning?.taken;
  const eTaken = !!today.meds?.evening?.taken;

  const mTakenHM = normalizeHHMM(today.meds?.morning?.time);
  const eTakenHM = normalizeHHMM(today.meds?.evening?.time);

  const mTakenMin = timeToMinutes(mTakenHM);
  const eTakenMin = timeToMinutes(eTakenHM);

  function set(text, mode) {
    el.textContent = text;
    el.classList.remove("ok", "due", "late");
    if (mode) el.classList.add(mode);
  }

  function lateBy(takenMin, targetMin) {
    if (takenMin == null || targetMin == null) return null;
    return takenMin - targetMin;
  }

  // ✅ If both done: show summary (late wins)
  if (mTaken && eTaken) {
    const mDiff = lateBy(mTakenMin, mTarget);
    const eDiff = lateBy(eTakenMin, eTarget);

    if (eDiff != null && eDiff > GRACE) {
      return set(`All done • Evening late by ${eDiff}m`, "late");
    }
    if (mDiff != null && mDiff > GRACE) {
      return set(`All done • Morning late by ${mDiff}m`, "late");
    }
    return set("All done today", "ok");
  }

  // ✅ If morning NOT taken yet: morning is the current focus
  if (!mTaken && mTarget != null) {
    if (now >= mTarget + GRACE) return set("Morning overdue", "late");
    if (now >= mTarget - DUE_SOON_WINDOW) return set("Morning due soon", "due");
    return set("On track", "ok");
  }

  // ✅ Morning taken, evening not taken: show morning result briefly + track evening
  if (mTaken && !eTaken) {
    // If we have a morning target + taken time, show if it was late/on-time
    if (mTarget != null && mTakenMin != null) {
      const diff = mTakenMin - mTarget;
      if (diff > GRACE) {
        // Morning was late — surface that (strong signal)
        return set(`Morning taken at ${mTakenHM} • Late by ${diff}m`, "late");
      }
    }

    // Otherwise focus on evening due/overdue
    if (eTarget != null) {
      if (now >= eTarget + GRACE) return set("Evening overdue", "late");
      if (now >= eTarget - DUE_SOON_WINDOW) return set("Evening due soon", "due");
      return set("On track", "ok");
    }

    // No evening target set? fallback
    return set("On track", "ok");
  }

  // ✅ Evening not taken (fallback)
  if (!eTaken && eTarget != null) {
    if (now >= eTarget + GRACE) return set("Evening overdue", "late");
    if (now >= eTarget - DUE_SOON_WINDOW) return set("Evening due soon", "due");
    return set("On track", "ok");
  }

  // ✅ If something is missing, just be safe
  set("On track", "ok");
}

// ---------- Notifications ----------
async function requestNotifyPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const p = await Notification.requestPermission();
  return p === "granted";
}

function scheduleReminder(title, body, targetHHMM) {
  const targetMins = timeToMinutes(normalizeHHMM(targetHHMM));
  if (targetMins == null) return;

  const now = minutesNow();
  let delta = (targetMins - now) * 60 * 1000;
  if (delta < 0) delta += 24 * 60 * 60 * 1000; // next day

  setTimeout(() => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
    } else {
      alert(`${title}\n\n${body}`);
    }
  }, delta);
}

// ---------- Day progress dots ----------
function updateProgressDots(today) {
  const pM = document.getElementById("progMorning");
  const pE = document.getElementById("progEvening");

  const sch = today.schedule || {};
  const now = minutesNow();
  const GRACE = 10;

  const mTarget = timeToMinutes(normalizeHHMM(sch.morningTarget));
  const eTarget = timeToMinutes(normalizeHHMM(sch.eveningTarget));

  const mTaken = !!today.meds?.morning?.taken;
  const eTaken = !!today.meds?.evening?.taken;

  const mTakenMin = timeToMinutes(normalizeHHMM(today.meds?.morning?.time));
  const eTakenMin = timeToMinutes(normalizeHHMM(today.meds?.evening?.time));

  if (pM) {
    pM.classList.remove("done", "late");
    if (mTaken && mTarget != null && mTakenMin != null) {
      pM.classList.add(mTakenMin > mTarget + GRACE ? "late" : "done");
    } else if (!mTaken && mTarget != null && now > mTarget + GRACE) {
      pM.classList.add("late");
    }
  }

  if (pE) {
    pE.classList.remove("done", "late");
    if (eTaken && eTarget != null && eTakenMin != null) {
      pE.classList.add(eTakenMin > eTarget + GRACE ? "late" : "done");
    } else if (!eTaken && eTarget != null && now > eTarget + GRACE) {
      pE.classList.add("late");
    }
  }
}

// ---------- Rendering ----------
function render(today) {
  // Med buttons
  const mBtn = document.getElementById("morningBtn");
  const eBtn = document.getElementById("eveningBtn");

  if (mBtn) mBtn.classList.toggle("on", !!today.meds?.morning?.taken);
  if (eBtn) eBtn.classList.toggle("on", !!today.meds?.evening?.taken);

  const mState = document.getElementById("morningState");
  if (mState) {
    mState.textContent = today.meds?.morning?.taken
      ? `Taken • ${today.meds.morning.time || ""}`.trim()
      : "Not taken";
  }

  const eState = document.getElementById("eveningState");
  if (eState) {
    eState.textContent = today.meds?.evening?.taken
      ? `Taken • ${today.meds.evening.time || ""}`.trim()
      : "Not taken";
  }

  // Notes
  const notesEl = document.getElementById("notes");
  if (notesEl) notesEl.value = today.notes || "";

  // Glucose list
  const list = document.getElementById("glucoseList");
  if (list) {
    const arr = Array.isArray(today.glucose) ? today.glucose : [];
    if (!arr.length) {
      list.textContent = "No readings yet.";
    } else {
      list.innerHTML = arr
        .slice()
        .reverse()
        .map((g) => {
          const tag = g.tag ? ` <span class="pill">${g.tag}</span>` : "";
          const note = g.note ? ` — ${g.note}` : "";
          return `<div>• <strong>${g.value}</strong> at ${g.time}${tag}${note}</div>`;
        })
        .join("");
    }
  }

  // Schedule UI values
  const sch = today.schedule || {};
  const mt = document.getElementById("morningTime");
  const et = document.getElementById("eveningTime");

  if (mt) mt.value = sch.morningTarget || "08:00";
  if (et) et.value = sch.eveningTarget || "20:00";

  const rmBtn = document.getElementById("remindMorning");
  const reBtn = document.getElementById("remindEvening");
  if (rmBtn) rmBtn.textContent = sch.remindMorning ? "Morning reminder ON" : "Enable morning reminder";
  if (reBtn) reBtn.textContent = sch.remindEvening ? "Evening reminder ON" : "Enable evening reminder";

  // Progress + status
  updateProgressDots(today);
  setLateStatus(today);

  // RTL support for notes
  if (notesEl) {
    const rtl = isArabic(notesEl.value);
    notesEl.style.direction = rtl ? "rtl" : "ltr";
    notesEl.style.textAlign = rtl ? "right" : "left";
  }
}

// ---------- History ----------
function renderHistory(db) {
  const keys = Object.keys(db).sort().reverse().slice(0, 14);
  const el = document.getElementById("historyList");
  if (!el) return;

  if (!keys.length) {
    el.innerHTML = `
      <div class="empty-history">
        <div class="seed">🌱</div>
        <div class="msg">Your journey starts here.</div>
        <div class="sub">Each day you log becomes a quiet victory.</div>
      </div>
    `;
    return;
  }

  el.innerHTML = keys
    .map((k) => {
      const d = db[k];
     const m = d.meds?.morning?.taken
  ? `✓ ${d.meds.morning.time || ""}`.trim()
  : "—";

const e = d.meds?.evening?.taken
  ? `✓ ${d.meds.evening.time || ""}`.trim()
  : "—";

      const g = d.glucose?.length || 0;
      return `
        <div class="day" data-day="${k}">
          <strong>${k}</strong>
          <div class="muted">Morning: ${m} • Evening: ${e} • Readings: ${g}</div>
        </div>
      `;
    })
    .join("");

  el.querySelectorAll(".day").forEach((card) => {
    card.addEventListener("click", () => {
      const k = card.getAttribute("data-day");
      const d = db[k];
      alert(
        `SteadyDay — ${k}\n\n` +
          `Morning meds: ${d.meds.morning.taken ? "Taken" : "Not taken"}\n` +
          `Evening meds: ${d.meds.evening.taken ? "Taken" : "Not taken"}\n` +
          `Readings: ${(d.glucose || [])
            .map((x) => `${x.value}@${x.time}`)
            .join(", ") || "None"}\n\n` +
          `Notes:\n${d.notes || "—"}`
      );
    });
  });
}

// ---------- Tabs ----------
function showTab(name) {
  const todaySec = document.getElementById("today");
  const histSec = document.getElementById("history");
  if (todaySec) todaySec.classList.toggle("hidden", name !== "today");
  if (histSec) histSec.classList.toggle("hidden", name !== "history");

  document.querySelectorAll(".tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === name);
  });
}

// ---------- Doctor Export ----------
function fmtDateLong(iso) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildDoctorReportHTML(db, days = 7) {
  const keys = Object.keys(db).sort().reverse().slice(0, days);

  const rangeText = keys.length
    ? `${fmtDateLong(keys[keys.length - 1])} — ${fmtDateLong(keys[0])}`
    : "No entries yet";

  const rows = keys
    .map((k) => {
      const d = db[k] || {};
      const morning = d.meds?.morning?.taken ? `Taken • ${d.meds.morning.time || ""}` : "Not taken";
      const evening = d.meds?.evening?.taken ? `Taken • ${d.meds.evening.time || ""}` : "Not taken";

      const readings =
        (d.glucose || [])
          .map((g) => `${escapeHtml(g.value)} @ ${escapeHtml(g.time)}${g.note ? ` — ${escapeHtml(g.note)}` : ""}`)
          .join("<br>") || `<span class="muted">None</span>`;

      const notes = d.notes ? escapeHtml(d.notes).replaceAll("\n", "<br>") : `<span class="muted">—</span>`;

      return `
        <div class="day">
          <div class="day-title">${escapeHtml(fmtDateLong(k))}</div>

          <div class="grid">
            <div class="box">
              <div class="label">Morning meds</div>
              <div class="val">${escapeHtml(morning)}</div>
            </div>
            <div class="box">
              <div class="label">Evening meds</div>
              <div class="val">${escapeHtml(evening)}</div>
            </div>
          </div>

          <div class="box">
            <div class="label">Blood sugar readings</div>
            <div class="val">${readings}</div>
          </div>

          <div class="box">
            <div class="label">Notes</div>
            <div class="val">${notes}</div>
          </div>
        </div>
      `;
    })
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SteadyDay — Doctor Export</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#fff;color:#111827}
    .wrap{max-width:900px;margin:0 auto;padding:22px}
    h1{margin:0 0 6px;font-size:22px}
    .sub{color:#6b7280;margin:0 0 14px}
    .meta{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0 18px}
    .pill{background:#f3f4f6;border:1px solid #e5e7eb;padding:6px 10px;border-radius:999px;font-size:13px;color:#111827}
    .day{border:1px solid #e5e7eb;border-radius:14px;padding:14px;margin:0 0 12px}
    .day-title{font-weight:900;margin-bottom:10px}
    .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
    .box{border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px;margin-top:10px}
    .label{font-size:12px;color:#6b7280;font-weight:800;margin-bottom:6px;text-transform:uppercase;letter-spacing:.02em}
    .val{font-size:14px;line-height:1.6}
    .muted{color:#6b7280}
    .foot{margin-top:14px;color:#6b7280;font-size:12px}
    @media print{
      .wrap{max-width:none;padding:0}
      .day{break-inside:avoid-page}
    }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>SteadyDay — Doctor Export</h1>
    <p class="sub">Last ${days} days summary (private, on-device log)</p>

    <div class="meta">
      <div class="pill">Range: ${escapeHtml(rangeText)}</div>
      <div class="pill">Generated: ${escapeHtml(new Date().toLocaleString())}</div>
    </div>

    ${rows || `<p class="muted">No entries yet.</p>`}

    <div class="foot">Disclaimer: Tracking only. Not medical advice.</div>
  </div>

  <script>
    setTimeout(() => window.print(), 350);
  </script>
</body>
</html>`;
}

function openDoctorExport() {
  const db = loadAll();
  const html = buildDoctorReportHTML(db, 7);

  const w = window.open("", "_blank");
  if (!w) {
    alert("Popup blocked. Please allow popups for this site to export.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

// ---------- Time input formatter ----------
function attachTimeInputFormatter(inputEl) {
  if (!inputEl) return;

  inputEl.addEventListener("input", () => {
    let v = inputEl.value.replace(/\D/g, "").slice(0, 4);
    if (v.length >= 3) v = v.slice(0, 2) + ":" + v.slice(2);
    inputEl.value = v;
  });

  inputEl.addEventListener("blur", () => {
    const fixed = normalizeHHMM(inputEl.value);
    inputEl.value = fixed || "";
  });
}

// ---------- Init ----------
(function init() {
  const db = loadAll();
  const today = getToday(db);
  saveAll(db);

  // First paint
  render(today);
  renderHistory(db);

  // Date header
  const dateEl = document.getElementById("todayDate");
  if (dateEl) dateEl.textContent = "Today • " + humanDate(new Date());

  // Refresh status every 30s
  setInterval(() => {
    const db2 = loadAll();
    const t2 = getToday(db2);
    setLateStatus(t2);
    updateProgressDots(t2);
  }, 30000);

  // Schedule inputs
  const mt = document.getElementById("morningTime");
  const et = document.getElementById("eveningTime");
  const saveSched = document.getElementById("saveSchedule");

  if (mt) attachTimeInputFormatter(mt);
  if (et) attachTimeInputFormatter(et);

  if (saveSched) {
    saveSched.addEventListener("click", () => {
      const dbx = loadAll();
      const t = getToday(dbx);

      const mVal = normalizeHHMM(mt?.value);
      const eVal = normalizeHHMM(et?.value);

      if (mt?.value && !mVal) return alert("Morning target must be HH:MM (ex: 08:00)");
      if (et?.value && !eVal) return alert("Evening target must be HH:MM (ex: 20:00)");

      t.schedule.morningTarget = mVal || t.schedule.morningTarget;
      t.schedule.eveningTarget = eVal || t.schedule.eveningTarget;

      saveAll(dbx);
      render(t);
      showToast("Schedule saved ✓");
    });
  }

  // Reminder toggles
  const rmBtn = document.getElementById("remindMorning");
  if (rmBtn) {
    rmBtn.addEventListener("click", async () => {
      const ok = await requestNotifyPermission();
      const dbx = loadAll();
      const t = getToday(dbx);

      t.schedule.remindMorning = !t.schedule.remindMorning;
      saveAll(dbx);
      render(t);

      if (ok && t.schedule.remindMorning) {
        scheduleReminder("SteadyDay", "Time for your morning meds.", t.schedule.morningTarget);
      }
    });
  }

  const reBtn = document.getElementById("remindEvening");
  if (reBtn) {
    reBtn.addEventListener("click", async () => {
      const ok = await requestNotifyPermission();
      const dbx = loadAll();
      const t = getToday(dbx);

      t.schedule.remindEvening = !t.schedule.remindEvening;
      saveAll(dbx);
      render(t);

      if (ok && t.schedule.remindEvening) {
        scheduleReminder("SteadyDay", "Time for your evening meds.", t.schedule.eveningTarget);
      }
    });
  }

  // Tabs
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      showTab(tab);
      if (tab === "history") renderHistory(loadAll());
    });
  });

  // Doctor export
  const exportBtn = document.getElementById("exportDoctor");
  if (exportBtn) exportBtn.addEventListener("click", openDoctorExport);

  // Morning meds toggle
  const morningBtn = document.getElementById("morningBtn");
  if (morningBtn) {
    morningBtn.addEventListener("click", () => {
      const dbx = loadAll();
      const t = getToday(dbx);

      t.meds.morning.taken = !t.meds.morning.taken;
      t.meds.morning.time = t.meds.morning.taken ? nowTime() : null;

      saveAll(dbx);
      render(t);
      renderHistory(dbx);
    });
  }

  // Evening meds toggle
  const eveningBtn = document.getElementById("eveningBtn");
  if (eveningBtn) {
    eveningBtn.addEventListener("click", () => {
      const dbx = loadAll();
      const t = getToday(dbx);

      t.meds.evening.taken = !t.meds.evening.taken;
      t.meds.evening.time = t.meds.evening.taken ? nowTime() : null;

      saveAll(dbx);
      render(t);
      renderHistory(dbx);
    });
  }

  // Notes autosave
  const notes = document.getElementById("notes");
  if (notes) {
    notes.addEventListener("input", () => {
      const dbx = loadAll();
      const t = getToday(dbx);
      t.notes = notes.value;
      saveAll(dbx);
    });
  }

  // Add glucose
  const addBtn = document.getElementById("addGlucose");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      const inp = document.getElementById("glucose");
      const tagEl = document.getElementById("glucoseTag");
      const noteEl = document.getElementById("glucoseNote");

      const val = Number(inp?.value);
      if (!val || val <= 0) return;

      const tag = tagEl?.value || "Other";
      const note = (noteEl?.value || "").trim();

      const dbx = loadAll();
      const t = getToday(dbx);

      t.glucose.push({ value: val, time: nowTime(), tag, note });

      saveAll(dbx);

      if (inp) inp.value = "";
      if (noteEl) noteEl.value = "";

      render(t);
      renderHistory(dbx);
    });
  }
})();
// ---------- PWA: Service Worker ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then(() => console.log("🟢 SteadyDay PWA ready"))
      .catch(console.error);
  });
}



