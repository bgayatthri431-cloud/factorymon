// ── FactoryMon app.js — Light Theme ─────────────────────

const API = {
  stream:  'backend/stream.php',
  post:    'backend/post_event.php',
  events:  'backend/get_events.php',
};

const MACHINES = [
  { id:'M1', name:'Compressor A1',      line:'A', threshold:85 },
  { id:'M2', name:'Conveyor A2',        line:'A', threshold:80 },
  { id:'M3', name:'Hydraulic Press A3', line:'A', threshold:90 },
  { id:'M4', name:'Compressor B1',      line:'B', threshold:85 },
  { id:'M5', name:'Conveyor B2',        line:'B', threshold:80 },
  { id:'M6', name:'Hydraulic Press B3', line:'B', threshold:90 },
];

const state = {
  eventSource: null,
  lastId: 0,
  currentLine: 'all',
  chart: null,
  currentMachine: 'M1',
  stats: { total:0, faults:0 },
};

// ── INIT MACHINE CARDS ──────────────────────────────────
const initCards = () => {
  const grid = document.getElementById('machines-grid');
  grid.innerHTML = MACHINES.map(m => `
    <div class="machine-card" id="card-${m.id}">
      <div class="card-top">
        <div>
          <div class="machine-name">${m.name}</div>
          <div class="machine-meta">ID: ${m.id} · THRESHOLD: ${m.threshold}°C</div>
        </div>
        <span class="status-badge normal" id="badge-${m.id}">NORMAL</span>
      </div>
      <div class="temp-value" id="temp-${m.id}">--°C</div>
      <div class="temp-bar">
        <div class="temp-fill" id="bar-${m.id}"></div>
      </div>
      <div class="card-bottom">
        <span class="temp-range">0°C — MAX: ${m.threshold}°C</span>
        <span class="line-tag ${m.line}">LINE ${m.line}</span>
      </div>
    </div>
  `).join('');
};

// ── INIT CHART ──────────────────────────────────────────
const initChart = () => {
  const selector = document.getElementById('machine-selector');
  selector.innerHTML = MACHINES.map(m =>
    `<button class="m-btn ${m.id === 'M1' ? 'active' : ''}"
      onclick="switchMachine('${m.id}', this)">${m.id}</button>`
  ).join('');

  const ctx = document.getElementById('tempChart').getContext('2d');
  state.chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Temperature °C',
        data: [],
        borderColor: '#1d4ed8',
        borderWidth: 2,
        pointBackgroundColor: [],
        pointRadius: 4,
        tension: 0.3,
        fill: true,
        backgroundColor: 'rgba(29,78,216,0.05)',
      }, {
        label: 'Threshold',
        data: [],
        borderColor: '#dc2626',
        borderWidth: 1.5,
        borderDash: [5,4],
        pointRadius: 0,
        fill: false,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          min: 0, max: 130,
          grid: { color: '#f1f5f9' },
          ticks: { font: { family: 'DM Mono', size: 11 }, color: '#94a3b8' }
        },
        x: {
          grid: { display: false },
          ticks: { font: { family: 'DM Mono', size: 10 }, color: '#94a3b8', maxTicksLimit: 8 }
        }
      }
    }
  });

  loadChartData('M1');
};

const switchMachine = (id, btn) => {
  document.querySelectorAll('.m-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.currentMachine = id;
  state.chart.data.labels = [];
  state.chart.data.datasets[0].data = [];
  state.chart.data.datasets[0].pointBackgroundColor = [];
  state.chart.data.datasets[1].data = [];
  state.chart.update();
  loadChartData(id);
};

const loadChartData = async (machineId) => {
  try {
    const res  = await fetch(`${API.events}?action=chart&machine_id=${machineId}`);
    const data = await res.json();
    const m    = MACHINES.find(x => x.id === machineId);

    state.chart.data.labels = data.labels || [];
    state.chart.data.datasets[0].data = data.values || [];
    state.chart.data.datasets[0].pointBackgroundColor = (data.statuses || []).map(s =>
      s === 'critical' ? '#dc2626' : s === 'warning' ? '#d97706' : '#16a34a'
    );
    state.chart.data.datasets[1].data = (data.values || []).map(() => m?.threshold || 85);
    state.chart.update();
  } catch(e) {}
};

const addChartPoint = (event) => {
  if (event.machine_id !== state.currentMachine) return;
  const m    = MACHINES.find(x => x.id === event.machine_id);
  const time = new Date(event.created_at || Date.now()).toLocaleTimeString();
  const color = event.status === 'critical' ? '#dc2626' : event.status === 'warning' ? '#d97706' : '#16a34a';

  state.chart.data.labels.push(time);
  state.chart.data.datasets[0].data.push(parseFloat(event.sensor_value));
  state.chart.data.datasets[0].pointBackgroundColor.push(color);
  state.chart.data.datasets[1].data.push(m?.threshold || 85);

  if (state.chart.data.labels.length > 20) {
    state.chart.data.labels.shift();
    state.chart.data.datasets[0].data.shift();
    state.chart.data.datasets[0].pointBackgroundColor.shift();
    state.chart.data.datasets[1].data.shift();
  }
  state.chart.update('none');
};

// ── UPDATE CARD ─────────────────────────────────────────
const updateMachineCard = (event) => {
  const card  = document.getElementById(`card-${event.machine_id}`);
  const temp  = document.getElementById(`temp-${event.machine_id}`);
  const badge = document.getElementById(`badge-${event.machine_id}`);
  const bar   = document.getElementById(`bar-${event.machine_id}`);
  if (!card) return;

  const m       = MACHINES.find(x => x.id === event.machine_id);
  const pct     = Math.min((parseFloat(event.sensor_value) / (m?.threshold || 85)) * 100, 100);
  const color   = event.status === 'critical' ? '#dc2626' : event.status === 'warning' ? '#d97706' : '#16a34a';

  card.className  = `machine-card status-${event.status}`;
  temp.textContent = `${parseFloat(event.sensor_value).toFixed(1)}°C`;
  temp.className   = `temp-value ${event.status}`;
  badge.textContent = event.status.toUpperCase();
  badge.className   = `status-badge ${event.status}`;
  bar.style.width   = `${pct}%`;
  bar.style.background = color;

  // Update line status
  if (event.status === 'critical' || event.status === 'warning') {
    const el = document.getElementById(`stat-line${event.line}`);
    if (el) { el.textContent = 'ALERT'; el.style.color = '#dc2626'; }
  }
};

// ── ADD EVENT TO FEED ────────────────────────────────────
const addEventToFeed = (event) => {
  const feed = document.getElementById('event-feed');
  const empty = feed.querySelector('.empty');
  if (empty) empty.remove();

  const time = new Date(event.created_at || Date.now()).toLocaleTimeString();
  const item = document.createElement('div');
  item.className = 'event-item';
  item.innerHTML = `
    <div class="event-dot ${event.status}"></div>
    <div class="event-machine">${event.machine_name}</div>
    <div class="event-temp">${parseFloat(event.sensor_value).toFixed(1)}°C</div>
    <span class="event-status ${event.status}">${event.status}</span>
    <div class="event-time">${time}</div>
  `;

  feed.insertBefore(item, feed.firstChild);
  if (feed.children.length > 50) feed.removeChild(feed.lastChild);
};

// ── TOAST ────────────────────────────────────────────────
const showToast = (event) => {
  if (event.status === 'normal') return;
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.style.borderLeftColor = event.status === 'critical' ? '#dc2626' : '#d97706';
  toast.innerHTML = `
    <div class="toast-title">${event.status === 'critical' ? '🚨' : '⚠️'} ${event.status.toUpperCase()} FAULT</div>
    <div class="toast-desc">${event.machine_name} · ${parseFloat(event.sensor_value).toFixed(1)}°C</div>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);

  // Sound
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = event.status === 'critical' ? 880 : 660;
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(); osc.stop(ctx.currentTime + 0.3);
  } catch(e) {}
};

// ── STATS ────────────────────────────────────────────────
const updateStats = async () => {
  try {
    const res  = await fetch(`${API.events}?action=stats`);
    const data = await res.json();
    document.getElementById('stat-total').textContent  = data.total  || 0;
    document.getElementById('stat-faults').textContent = data.faults || 0;
  } catch(e) {}
};

// ── SSE CONNECTION ────────────────────────────────────────
const connectStream = (line = null) => {
  if (state.eventSource) state.eventSource.close();

  let url = `${API.stream}?lastId=${state.lastId}`;
  if (line && line !== 'all') url += `&line=${line}`;

  state.eventSource = new EventSource(url);

  state.eventSource.onopen = () => {
    document.getElementById('conn-pulse').style.background = '#16a34a';
    document.getElementById('conn-status').textContent = 'LIVE';
  };

  state.eventSource.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data);
      if (!event.machine_id) return;
      state.lastId = event.id;
      updateMachineCard(event);
      addEventToFeed(event);
      addChartPoint(event);
      showToast(event);
      updateStats();
    } catch(err) {}
  };

  state.eventSource.onerror = () => {
    document.getElementById('conn-pulse').style.background = '#d97706';
    document.getElementById('conn-status').textContent = 'RECONNECTING...';
    state.eventSource.close();
    setTimeout(() => connectStream(state.currentLine), 3000);
  };
};

// ── LINE FILTER ───────────────────────────────────────────
const setLine = (line, btn) => {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.currentLine = line;
  connectStream(line);
};

// ── START ─────────────────────────────────────────────────
initCards();
initChart();
updateStats();
connectStream();
