'use strict';

// ===== CONSTANTS =====
const SUBJECTS = [
  { id: 'japanese', name: '国語', emoji: '📖', color: '#FF6B6B' },
  { id: 'math',     name: '数学', emoji: '🔢', color: '#4ECDC4' },
  { id: 'english',  name: '英語', emoji: '🔤', color: '#45B7D1' },
  { id: 'science',  name: '理科', emoji: '🔬', color: '#96CEB4' },
  { id: 'social',   name: '社会', emoji: '🌍', color: '#FFEAA7' },
  { id: 'reading',  name: '長文', emoji: '📝', color: '#C39BD3' },
  { id: 'other',    name: 'その他', emoji: '📚', color: '#95A5A6' },
];

const MOODS = [
  { id: 'good',   label: '😊 よかった' },
  { id: 'normal', label: '😐 普通' },
  { id: 'hard',   label: '😓 難しかった' },
];

const MINUTE_OPTIONS = [10, 15, 20, 30, 45, 60, 90, 120];

function subjectById(id) { return SUBJECTS.find(s => s.id === id) || SUBJECTS[6]; }
function subjectByName(name) { return SUBJECTS.find(s => s.name === name) || SUBJECTS[6]; }
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function dateKey(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}
function fmtMinutes(min) {
  if (!min) return '0分';
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? `${h}h${m > 0 ? m + 'm' : ''}` : `${m}分`;
}
function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' });
}

// ===== DATA STORE =====
const DB = {
  get(key) { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } },
  set(key, val) { localStorage.setItem(key, JSON.stringify(val)); },

  getJukuEvents(dateStr) {
    return this.get('juku_events').filter(e => e.date === dateStr);
  },
  addJukuEvent(dateStr, subjectId, startTime, durationMin) {
    const events = this.get('juku_events');
    events.push({ id: crypto.randomUUID(), date: dateStr, subjectId, startTime, durationMin });
    this.set('juku_events', events);
  },

  getPlans(dateStr) { return this.get('study_plans').filter(p => p.date === dateStr); },
  addPlan(dateStr, subjectId, note, plannedMin) {
    const plans = this.get('study_plans');
    plans.push({ id: crypto.randomUUID(), date: dateStr, subjectId, note, plannedMin });
    this.set('study_plans', plans);
  },
  deletePlan(id) {
    this.set('study_plans', this.get('study_plans').filter(p => p.id !== id));
  },

  getRecords(dateStr) { return this.get('study_records').filter(r => r.date === dateStr); },
  getRecordsInRange(startStr, endStr) {
    return this.get('study_records').filter(r => r.date >= startStr && r.date <= endStr);
  },
  saveRecords(dateStr, records) {
    const all = this.get('study_records').filter(r => r.date !== dateStr);
    records.forEach(r => all.push({ ...r, date: dateStr }));
    this.set('study_records', all);
  },

  getReview(dateStr) {
    return this.get('daily_reviews').find(r => r.date === dateStr) || null;
  },
  saveReview(dateStr, data) {
    const reviews = this.get('daily_reviews').filter(r => r.date !== dateStr);
    reviews.push({ date: dateStr, ...data });
    this.set('daily_reviews', reviews);
  },

  getStreak() {
    let count = 0;
    const today = todayKey();
    let d = new Date();
    while (true) {
      const key = dateKey(d);
      if (key > today) { d.setDate(d.getDate() - 1); continue; }
      const review = this.getReview(key);
      if (!review || !review.completed) break;
      count++;
      d.setDate(d.getDate() - 1);
    }
    return count;
  }
};

// ===== DATE NAVIGATION =====
let selectedDate = todayKey();

function changeDate(delta) {
  const d = new Date(selectedDate + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  selectedDate = dateKey(d);
  updateDateNavUI();
  if (currentTab === 'today') renderToday();
  if (currentTab === 'review') renderReview();
}

function isFuture(dateStr) { return dateStr > todayKey(); }

function updateDateNavUI() {
  const isToday = selectedDate === todayKey();
  ['today', 'review'].forEach(tab => {
    const label = document.getElementById(`${tab}-date-label`);
    if (!label) return;
    if (isToday) label.textContent = `📅 ${fmtDate(selectedDate)}（今日）`;
    else if (isFuture(selectedDate)) label.textContent = `📅 ${fmtDate(selectedDate)}（予定）`;
    else label.textContent = `📅 ${fmtDate(selectedDate)}`;
  });
}

// ===== NAVIGATION =====
let currentTab = 'home';

function showTab(tab) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`page-${tab}`).classList.add('active');
  document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add('active');
  currentTab = tab;
  if (tab === 'home') renderHome();
  if (tab === 'today') renderToday();
  if (tab === 'review') renderReview();
  if (tab === 'progress') renderProgress();
}

// ===== MODAL =====
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ===== HOME =====
function renderHome() {
  const streak = DB.getStreak();
  const review = DB.getReview(todayKey());
  const done = review?.completed;

  document.getElementById('streak-num').textContent = streak;
  document.getElementById('streak-badge').textContent = done ? '✅ 今日完了' : '⚠️ 振り返り未入力';
  document.getElementById('streak-badge').className = `streak-badge ${done ? 'done' : 'todo'}`;

  const alert = document.getElementById('review-alert');
  if (!done) alert.classList.add('show'); else alert.classList.remove('show');

  document.getElementById('btn-review-home').className = `btn ${done ? 'btn-review done' : 'btn-review'}`;
  document.getElementById('btn-review-home').textContent = done ? '✅ 振り返り完了' : '📝 振り返りを入力する';
}

// ===== TODAY =====
function renderToday() {
  const today = selectedDate;
  updateDateNavUI();

  // Google連携バナー・同期ボタン制御
  const connected = isGcConnected();
  const banner = document.getElementById('gc-connect-banner');
  const syncBtn = document.getElementById('gc-sync-btn');
  if (banner) banner.style.display = connected ? 'none' : '';
  if (syncBtn) syncBtn.style.display = connected ? '' : 'none';

  // Juku events（手動 + Googleカレンダー）
  const manualEvents = DB.getJukuEvents(today);
  const gcEvs = getGcEvents(today);
  const events = [...gcEvs, ...manualEvents];
  const evEl = document.getElementById('juku-events-list');
  if (events.length === 0) {
    evEl.innerHTML = '<div class="empty">今日の塾はありません</div>';
  } else {
    evEl.innerHTML = events.map(e => {
      const s = subjectById(e.subjectId);
      return `<div class="event-item">
        <div class="event-dot" style="background:${s.color}"></div>
        <div class="event-info">
          <div class="event-subject">${s.emoji} ${s.name}</div>
          <div class="event-time">${e.startTime}</div>
        </div>
        <div class="event-dur">${e.durationMin}分</div>
      </div>`;
    }).join('');
  }

  // Study plans
  const plans = DB.getPlans(today);
  const plEl = document.getElementById('study-plans-list');
  if (plans.length === 0) {
    plEl.innerHTML = '<div class="empty">自習計画を追加しよう！</div>';
  } else {
    plEl.innerHTML = plans.map(p => {
      const s = subjectById(p.subjectId);
      return `<div class="plan-item">
        <div class="plan-emoji">${s.emoji}</div>
        <div class="plan-info">
          <div class="plan-subject">${s.name}</div>
          ${p.note ? `<div class="plan-note">${p.note}</div>` : ''}
        </div>
        <div class="plan-time">${fmtMinutes(p.plannedMin)}</div>
        <button class="btn-sm cancel" onclick="deletePlan('${p.id}')">✕</button>
      </div>`;
    }).join('');
  }
}

function deletePlan(id) {
  DB.deletePlan(id);
  renderToday();
}

// Add Juku Event Modal
function openAddJukuModal() {
  buildSubjectOptions('juku-subject-select');
  openModal('modal-add-juku');
}
function submitAddJuku() {
  const today = selectedDate;
  const subjectId = document.getElementById('juku-subject-select').value;
  const startTime = document.getElementById('juku-start-time').value;
  const dur = parseInt(document.getElementById('juku-duration').value);
  if (!startTime) return alert('開始時間を入力してください');
  DB.addJukuEvent(today, subjectId, startTime, dur);
  closeModal('modal-add-juku');
  renderToday();
}

// Add Study Plan Modal
function openAddPlanModal() {
  buildSubjectOptions('plan-subject-select');
  buildMinuteOptions('plan-minutes-select');
  openModal('modal-add-plan');
}
function submitAddPlan() {
  const today = selectedDate;
  const subjectId = document.getElementById('plan-subject-select').value;
  const note = document.getElementById('plan-note-input').value.trim();
  const min = parseInt(document.getElementById('plan-minutes-select').value);
  DB.addPlan(today, subjectId, note, min);
  closeModal('modal-add-plan');
  renderToday();
}

// ===== REVIEW =====
let reviewMood = 'normal';
let reviewRecords = [];

function renderReview() {
  const today = selectedDate;
  updateDateNavUI();

  const existing = DB.getReview(today);
  reviewMood = existing?.mood || 'normal';
  renderMoodButtons();

  document.getElementById('review-juku-comment').value = existing?.jukuComment || '';
  document.getElementById('review-memo').value = existing?.memo || '';

  // Build records from today's plans
  const plans = DB.getPlans(today);
  const existingRecords = DB.getRecords(today);

  if (existingRecords.length > 0) {
    reviewRecords = existingRecords;
  } else {
    reviewRecords = plans.map(p => ({
      id: crypto.randomUUID(),
      subjectId: p.subjectId,
      note: p.note,
      plannedMin: p.plannedMin,
      actualMin: p.plannedMin,
    }));
  }

  // 未来日付は振り返り不可
  const futureMsg = document.getElementById('review-future-msg');
  const reviewForm = document.getElementById('review-form-body');
  const saveBtn = document.getElementById('review-save-btn');
  if (isFuture(today)) {
    futureMsg.style.display = '';
    reviewForm.style.display = 'none';
    saveBtn.style.display = 'none';
    return;
  }
  futureMsg.style.display = 'none';
  reviewForm.style.display = '';
  saveBtn.style.display = '';

  // Juku section visibility
  const events = DB.getJukuEvents(selectedDate);
  document.getElementById('review-juku-section').style.display = events.length > 0 ? '' : 'none';

  renderReviewRecords();
}

function renderMoodButtons() {
  MOODS.forEach(m => {
    const btn = document.getElementById(`mood-${m.id}`);
    btn.className = `mood-btn${reviewMood === m.id ? ' selected' : ''}`;
  });
}

function selectMood(id) {
  reviewMood = id;
  renderMoodButtons();
}

function renderReviewRecords() {
  const el = document.getElementById('review-records-list');
  el.innerHTML = reviewRecords.map((r, i) => {
    const s = subjectById(r.subjectId);
    return `<div class="record-item">
      <div class="record-emoji">${s.emoji}</div>
      <div class="record-info">
        <div class="record-subject">${s.name}</div>
        ${r.note ? `<div class="record-note">${r.note}</div>` : ''}
      </div>
      <input class="record-min-input" type="number" min="0" max="300"
        value="${r.actualMin}"
        onchange="updateRecordMin(${i}, this.value)"
        inputmode="numeric" />
      <span style="font-size:12px;color:var(--text2)">分</span>
    </div>`;
  }).join('');
}

function updateRecordMin(i, val) {
  reviewRecords[i].actualMin = parseInt(val) || 0;
}

function openAddRecordModal() {
  buildSubjectOptions('record-subject-select');
  buildMinuteOptions('record-minutes-select');
  document.getElementById('record-note-input').value = '';
  openModal('modal-add-record');
}
function submitAddRecord() {
  const subjectId = document.getElementById('record-subject-select').value;
  const note = document.getElementById('record-note-input').value.trim();
  const actualMin = parseInt(document.getElementById('record-minutes-select').value);
  reviewRecords.push({ id: crypto.randomUUID(), subjectId, note, plannedMin: 0, actualMin });
  closeModal('modal-add-record');
  renderReviewRecords();
}

function saveReview() {
  const today = selectedDate;
  const jukuComment = document.getElementById('review-juku-comment').value.trim();
  const memo = document.getElementById('review-memo').value.trim();

  DB.saveReview(today, {
    mood: reviewMood,
    jukuComment,
    memo,
    completed: true,
  });
  DB.saveRecords(today, reviewRecords);

  alert('振り返りを保存しました！🎉');
  renderHome();
  showTab('home');
}

// ===== PROGRESS =====
let progressPeriod = 'today';
let chartInstance = null;
let dailyChartInstance = null;

function renderProgress() {
  renderProgressData();
}

function setProgressPeriod(period) {
  progressPeriod = period;
  document.querySelectorAll('#progress-segment .seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.period === period);
  });
  renderProgressData();
}

function renderProgressData() {
  const { startStr, endStr, days } = getPeriodRange(progressPeriod);
  const records = DB.getRecordsInRange(startStr, endStr);

  // 今日の詳細リスト（今日タブのみ）
  const detailSection = document.getElementById('today-detail-section');
  if (progressPeriod === 'today') {
    const todayRecords = DB.getRecords(todayKey());
    const review = DB.getReview(todayKey());
    detailSection.style.display = '';
    detailSection.innerHTML = `<div class="card">
      <div class="card-title">📋 今日の入力内容</div>
      ${todayRecords.length === 0 ? '<div class="empty">まだ記録がありません</div>' :
        todayRecords.map(r => {
          const s = subjectById(r.subjectId);
          return `<div class="plan-item">
            <div class="plan-emoji">${s.emoji}</div>
            <div class="plan-info">
              <div class="plan-subject">${s.name}</div>
              ${r.note ? `<div class="plan-note">${r.note}</div>` : ''}
            </div>
            <div class="plan-time">${fmtMinutes(r.actualMin)}</div>
          </div>`;
        }).join('')}
      ${review?.memo ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--surface2);font-size:13px;color:var(--text2)">💬 ${review.memo}</div>` : ''}
    </div>`;
  } else {
    detailSection.style.display = 'none';
  }

  // Subject totals
  const subjectMap = {};
  let totalActual = 0, totalPlanned = 0;
  for (const r of records) {
    subjectMap[r.subjectId] = (subjectMap[r.subjectId] || 0) + (r.actualMin || 0);
    totalActual += r.actualMin || 0;
    totalPlanned += r.plannedMin || 0;
  }

  // Summary
  document.getElementById('prog-total').textContent = fmtMinutes(totalActual);
  const rate = totalPlanned > 0 ? Math.round(totalActual / totalPlanned * 100) : 0;
  document.getElementById('prog-rate').textContent = totalPlanned > 0 ? `${rate}%` : 'ー';
  document.getElementById('prog-subjects').textContent = Object.keys(subjectMap).length + '科目';

  // Subject bars
  const sorted = Object.entries(subjectMap).sort((a, b) => b[1] - a[1]);
  const maxMin = sorted[0]?.[1] || 1;
  const barsEl = document.getElementById('subject-bars');
  barsEl.innerHTML = sorted.length === 0
    ? '<div class="empty">データがありません</div>'
    : sorted.map(([id, min]) => {
      const s = subjectById(id);
      const pct = Math.round(min / maxMin * 100);
      return `<div class="bar-row">
        <div class="bar-label">${s.emoji}</div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct}%;background:${s.color}">${s.name}</div>
        </div>
        <div class="bar-time">${fmtMinutes(min)}</div>
      </div>`;
    }).join('');

  // Daily chart (week/month)
  const dailySection = document.getElementById('daily-chart-section');
  if (progressPeriod === 'today') {
    dailySection.style.display = 'none';
  } else {
    dailySection.style.display = '';
    renderDailyChart(startStr, endStr, days, records);
  }

  // Pie chart (month only)
  const pieSection = document.getElementById('pie-chart-section');
  if (progressPeriod === 'month') {
    pieSection.style.display = '';
    renderPieChart(sorted);
  } else {
    pieSection.style.display = 'none';
  }
}

function getPeriodRange(period) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (period === 'today') {
    const s = dateKey(today);
    return { startStr: s, endStr: s, days: 1 };
  }
  if (period === 'week') {
    const dow = today.getDay();
    const mon = new Date(today);
    mon.setDate(today.getDate() - ((dow + 6) % 7));
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return { startStr: dateKey(mon), endStr: dateKey(sun), days: 7 };
  }
  // month
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return { startStr: dateKey(firstDay), endStr: dateKey(lastDay), days: lastDay.getDate() };
}

function renderDailyChart(startStr, endStr, days, records) {
  const labels = [], data = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startStr + 'T00:00:00');
    d.setDate(d.getDate() + i);
    if (d > new Date()) break;
    const key = dateKey(d);
    const dayTotal = records.filter(r => r.date === key).reduce((s, r) => s + (r.actualMin || 0), 0);
    labels.push(`${d.getMonth()+1}/${d.getDate()}`);
    data.push(+(dayTotal / 60).toFixed(1));
  }

  if (dailyChartInstance) dailyChartInstance.destroy();
  const ctx = document.getElementById('daily-chart').getContext('2d');
  dailyChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: 'rgba(79,142,247,0.7)',
        borderRadius: 6,
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8888aa', font: { size: 10 } }, grid: { color: '#26262f' } },
        y: { ticks: { color: '#8888aa', font: { size: 10 }, callback: v => v + 'h' }, grid: { color: '#26262f' }, beginAtZero: true }
      }
    }
  });
}

function renderPieChart(sorted) {
  if (chartInstance) chartInstance.destroy();
  const ctx = document.getElementById('pie-chart').getContext('2d');
  if (sorted.length === 0) return;
  chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: sorted.map(([id]) => subjectById(id).name),
      datasets: [{
        data: sorted.map(([, min]) => min),
        backgroundColor: sorted.map(([id]) => subjectById(id).color),
        borderWidth: 2,
        borderColor: '#1c1c24',
      }]
    },
    options: {
      plugins: {
        legend: { position: 'right', labels: { color: '#f0f0f5', font: { size: 12 }, padding: 12 } }
      }
    }
  });
}

// ===== HELPERS =====
function buildSubjectOptions(selectId) {
  const el = document.getElementById(selectId);
  el.innerHTML = SUBJECTS.map(s => `<option value="${s.id}">${s.emoji} ${s.name}</option>`).join('');
}

function buildMinuteOptions(selectId) {
  const el = document.getElementById(selectId);
  el.innerHTML = MINUTE_OPTIONS.map(m => `<option value="${m}"${m===30?' selected':''}>${m}分</option>`).join('');
}

// ===== GOOGLE CALENDAR (iCal) =====
function gcIcsUrl() { return localStorage.getItem('gc_ics_url') || ''; }
function isGcConnected() { return !!gcIcsUrl() && localStorage.getItem('gc_events'); }

async function openGcSetup() {
  const current = gcIcsUrl();
  const url = prompt(
    'GoogleカレンダーのiCal URLを貼り付けてください。\n\n' +
    '【取得方法】\n' +
    '① Googleカレンダーを開く\n' +
    '② 右上の歯車⚙️→「設定」\n' +
    '③ 左の「穂のカレンダー」をクリック\n' +
    '④「カレンダーの統合」→「iCal形式の非公開URL」をコピー',
    current
  );
  if (url === null) return;
  localStorage.setItem('gc_ics_url', url.trim());
  const ok = await syncFromICS();
  if (ok) { renderToday(); alert('カレンダーと連携しました！✅'); }
}

async function syncFromICS() {
  let url = gcIcsUrl();
  if (!url) return false;

  // webcal:// → https:// に変換
  url = url.replace(/^webcal:\/\//i, 'https://');

  const btn = document.getElementById('gc-sync-btn');
  if (btn) btn.textContent = '⏳ 同期中...';

  const proxies = [
    u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    u => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
    u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
  ];

  for (const makeProxy of proxies) {
    try {
      const resp = await fetch(makeProxy(url), { signal: AbortSignal.timeout(8000) });
      if (!resp.ok) continue;
      const raw = await resp.text();
      // allorigins は JSON で返す
      let icsText = raw;
      try {
        const j = JSON.parse(raw);
        if (j.contents) icsText = j.contents;
      } catch {}
      if (!icsText.includes('BEGIN:VCALENDAR')) continue;

      const events = parseICS(icsText);
      const juku = events
        .filter(e => (e.summary || '').includes('明光'))
        .map(e => ({
          id: e.uid,
          date: e.date,
          subjectId: SUBJECTS.find(s => (e.summary || '').includes(s.name))?.id || 'other',
          startTime: e.startTime,
          durationMin: e.durationMin || 90,
        }));
      localStorage.setItem('gc_events', JSON.stringify(juku));
      if (btn) btn.textContent = '🔄 同期';
      return true;
    } catch { continue; }
  }

  if (btn) btn.textContent = '🔄 同期';
  alert('読み込みに失敗しました。\niCal URLが正しいか確認してください。\n（webcal:// または https:// で始まるURL）');
  return false;
}

function parseICS(text) {
  text = text.replace(/\r\n /g, '').replace(/\r\n\t/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const events = [];
  let cur = null;
  for (const line of text.split('\n')) {
    const ci = line.indexOf(':');
    if (ci < 0) continue;
    const key = line.slice(0, ci);
    const val = line.slice(ci + 1).trim();
    const base = key.split(';')[0];
    if (base === 'BEGIN' && val === 'VEVENT') { cur = {}; }
    else if (base === 'END' && val === 'VEVENT' && cur) { events.push(cur); cur = null; }
    else if (cur) {
      if (base === 'SUMMARY') cur.summary = val.replace(/\\,/g, ',').replace(/\\n/g, ' ');
      else if (base === 'UID') cur.uid = val;
      else if (base === 'DTSTART') Object.assign(cur, parseICSdt(val));
      else if (base === 'DTEND') cur._endMs = parseICStMs(val);
    }
  }
  for (const e of events) {
    if (e._startMs && e._endMs) e.durationMin = Math.round((e._endMs - e._startMs) / 60000);
  }
  return events;
}

function parseICSdt(val) {
  const isUTC = val.endsWith('Z');
  const v = val.replace('Z', '');
  const yr = +v.slice(0,4), mo = +v.slice(4,6)-1, dy = +v.slice(6,8);
  if (!v.includes('T')) return { date: `${yr}-${String(mo+1).padStart(2,'0')}-${String(dy).padStart(2,'0')}`, startTime: '', _startMs: new Date(yr,mo,dy).getTime() };
  const hr = +v.slice(9,11), mn = +v.slice(11,13);
  const dt = isUTC ? new Date(Date.UTC(yr,mo,dy,hr,mn)) : new Date(yr,mo,dy,hr,mn);
  return {
    date: dateKey(dt),
    startTime: dt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
    _startMs: dt.getTime(),
  };
}

function parseICStMs(val) {
  const isUTC = val.endsWith('Z');
  const v = val.replace('Z', '');
  const yr = +v.slice(0,4), mo = +v.slice(4,6)-1, dy = +v.slice(6,8);
  if (!v.includes('T')) return new Date(yr,mo,dy).getTime();
  const hr = +v.slice(9,11), mn = +v.slice(11,13);
  return isUTC ? Date.UTC(yr,mo,dy,hr,mn) : new Date(yr,mo,dy,hr,mn).getTime();
}

function getGcEvents(dateStr) {
  return JSON.parse(localStorage.getItem('gc_events') || '[]').filter(e => e.date === dateStr);
}

// ===== NOTIFICATIONS =====
async function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') await Notification.requestPermission();
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  // Tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => showTab(btn.dataset.tab));
  });

  // Progress segment
  document.querySelectorAll('#progress-segment .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => setProgressPeriod(btn.dataset.period));
  });

  // Mood buttons
  MOODS.forEach(m => {
    document.getElementById(`mood-${m.id}`)?.addEventListener('click', () => selectMood(m.id));
  });

  requestNotificationPermission();
  showTab('home');
});
