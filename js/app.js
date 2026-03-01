// ============================================================
//  FACTORY MACHINE MONITOR — Main ES6 Application
//  Modules: SSE Connection, Event Manager, Chart Engine
// ============================================================

// ── CONFIG ───────────────────────────────────────────────────
const API = {
  stream:   'backend/stream.php',
  post:     'backend/post_event.php',
  get:      'backend/get_events.php',
};

const MACHINES = [
  { id:'M1', name:'Compressor A1',     line:'A', threshold:85 },
  { id:'M2', name:'Conveyor A2',       line:'A', threshold:80 },
  { id:'M3', name:'Hydraulic Press A3',line:'A', threshold:90 },
  { id:'M4', name:'Compressor B1',     line:'B', threshold:85 },
  { id:'M5', name:'Conveyor B2',       line:'B', threshold:80 },
  { id:'M6', name:'Hydraulic Press B3',line:'B', threshold:90 },
];

// ── STATE ─────────────────────────────────────────────────────
const state = {
  lastId:       0,
  eventSource:  null,
  activeFilter: 'all',
  eventCount:   0,
  faultCount:   0,
  machineState: {},   // { M1: { value, status }, ... }
  chartInstance: null,
  chartData:    { labels:[], values:[], statuses:[] },
  chartMachine: 'M1',
};

// Initialise machine state
MACHINES.forEach(m => {
  state.machineState[m.id] = { value: '--', status: 'normal', name: m.name, line: m.line, threshold: m.threshold };
});

// ── SSE CONNECTION — Module 3 ────────────────────────────────
const connectStream = (line = null) => {
  if (state.eventSource) state.eventSource.close();

  const url = line
    ? `${API.stream}?lastId=${state.lastId}&line=${line}`
    : `${API.stream}?lastId=${state.lastId}`;

  state.eventSource = new EventSource(url);

  state.eventSource.onmessage = (e) => {
    const event = JSON.parse(e.data);
    handleNewEvent(event);
  };

  state.eventSource.onerror = () => {
    updateConnectionStatus(false);
    setTimeout(() => connectStream(line), 3000);  // auto-reconnect
  };

  state.eventSource.onopen = () => updateConnectionStatus(true);
};

// ── EVENT HANDLER ─────────────────────────────────────────────
const handleNewEvent = (event) => {
  state.lastId = event.id;
  state.eventCount++;

  // Update machine card
  updateMachineCard(event);

  // Add to event log
  addEventToLog(event);

  // Update stats
  updateStats(event);

  // Update chart if relevant machine
  if (event.machine_id === state.chartMachine) {
    addChartPoint(event);
  }

  // Fault alert toast
  if (event.event_type === 'fault' || event.status === 'critical') {
    state.faultCount++;
    showToast(event, 'fault');
    playAlertSound();
  }
};

// ── MACHINE CARD UPDATE ───────────────────────────────────────
const updateMachineCard = (event) => {
  const card = document.getElementById(`machine-${event.machine_id}`);
  if (!card) return;

  const val   = parseFloat(event.sensor_value);
  const max   = parseFloat(event.threshold_max) || 85;
  const pct   = Math.min((val / (max * 1.2)) * 100, 100);

  state.machineState[event.machine_id] = { value: val, status: event.status };

  // Update status class
  card.className = `machine-card status-${event.status}`;

  // Update temp value
  const tempEl = card.querySelector('.temp-value');
  if (tempEl) {
    tempEl.textContent = val.toFixed(1);
    tempEl.className = `temp-value ${event.status !== 'normal' ? event.status : ''}`;
  }

  // Update badge
  const badge = card.querySelector('.status-badge');
  if (badge) {
    badge.textContent = event.status.toUpperCase();
    badge.className = `status-badge badge-${event.status}`;
  }

  // Update bar
  const bar = card.querySelector('.temp-bar');
  if (bar) {
    bar.style.width = `${pct}%`;
    bar.className = `temp-bar ${event.status !== 'normal' ? event.status : ''}`;
  }
};

// ── EVENT LOG ─────────────────────────────────────────────────
const addEventToLog = (event) => {
  const log = document.getElementById('event-log');
  if (!log) return;

  const time = new Date(event.created_at).toLocaleTimeString();
  const item = document.createElement('div');
  item.className = `event-item ${event.event_type === 'fault' ? 'fault' : event.status}`;
  item.innerHTML = `
    <span class="event-time">${time}</span>
    <span class="event-machine">${event.machine_name}</span>
    <span class="event-temp">${parseFloat(event.sensor_value).toFixed(1)}°C</span>
    <span class="event-status">
      <span class="status-badge badge-${event.status}">${event.status.toUpperCase()}</span>
    </span>
    <span class="line-tag line-${event.line}">LINE ${event.line}</span>
  `;
  log.prepend(item);

  // Keep log manageable
  while (log.children.length > 50) log.removeChild(log.lastChild);
};

// ── STATS UPDATE ──────────────────────────────────────────────
const updateStats = (event) => {
  const el = (id) => document.getElementById(id);
  if (el('stat-total'))    el('stat-total').textContent    = state.eventCount;
  if (el('stat-faults'))   el('stat-faults').textContent   = state.faultCount;
  if (el('stat-lineA'))    updateLineStats('A');
  if (el('stat-lineB'))    updateLineStats('B');
};

const updateLineStats = (line) => {
  const machines = MACHINES.filter(m => m.line === line);
  const critical = machines.filter(m => {
    const s = state.machineState[m.id];
    return s && (s.status === 'critical' || s.status === 'warning');
  });
  const el = document.getElementById(`stat-line${line}`);
  if (el) el.textContent = critical.length > 0 ? `${critical.length} ALERT` : 'OK';
};

// ── CHART ENGINE — Module 5 ───────────────────────────────────
const initChart = async (machineId = 'M1') => {
  state.chartMachine = machineId;

  const res  = await fetch(`${API.get}?action=chart&machine_id=${machineId}&limit=15`);
  const data = await res.json();

  const ctx = document.getElementById('tempChart');
  if (!ctx) return;

  const machine = MACHINES.find(m => m.id === machineId);
  const threshold = machine ? machine.threshold : 85;

  if (state.chartInstance) state.chartInstance.destroy();

  state.chartInstance = new Chart(ctx.getContext('2d'), {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [
        {
          label: `${machineId} Temperature (°C)`,
          data: data.values,
          borderColor: '#00d4ff',
          backgroundColor: 'rgba(0,212,255,0.08)',
          borderWidth: 2,
          pointBackgroundColor: data.statuses.map(s =>
            s === 'critical' ? '#ff3355' : s === 'warning' ? '#ffaa00' : '#00d4ff'
          ),
          pointRadius: 5,
          tension: 0.4,
          fill: true,
        },
        {
          label: `Threshold (${threshold}°C)`,
          data: Array(data.labels.length).fill(threshold),
          borderColor: 'rgba(255,51,85,0.5)',
          borderDash: [6, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#c8d8e8', font: { family: 'Share Tech Mono', size: 11 } }
        }
      },
      scales: {
        x: {
          ticks: { color: '#566880', font: { family: 'Share Tech Mono', size: 10 } },
          grid:  { color: 'rgba(30,42,58,0.8)' }
        },
        y: {
          min: 0,
          ticks: {
            color: '#566880',
            font: { family: 'Share Tech Mono', size: 10 },
            callback: v => `${v}°C`
          },
          grid: { color: 'rgba(30,42,58,0.8)' }
        }
      }
    }
  });
};

const addChartPoint = (event) => {
  if (!state.chartInstance) return;
  const chart = state.chartInstance;
  const time  = new Date(event.created_at).toLocaleTimeString();
  const val   = parseFloat(event.sensor_value);

  chart.data.labels.push(time);
  chart.data.datasets[0].data.push(val);
  chart.data.datasets[0].pointBackgroundColor.push(
    event.status === 'critical' ? '#ff3355' : event.status === 'warning' ? '#ffaa00' : '#00d4ff'
  );

  // Keep last 20 points
  if (chart.data.labels.length > 20) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
    chart.data.datasets[0].pointBackgroundColor.shift();
  }

  // Extend threshold line
  chart.data.datasets[1].data.push(chart.data.datasets[1].data[0]);
  if (chart.data.datasets[1].data.length > 20) chart.data.datasets[1].data.shift();

  chart.update('active');
};

// ── PUBLISH EVENT — Module 2 ──────────────────────────────────
const publishReading = async (machineId, value) => {
  const machine = MACHINES.find(m => m.id === machineId);
  if (!machine) return;

  const res = await fetch(API.post, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      machine_id:    machine.id,
      machine_name:  machine.name,
      line:          machine.line,
      sensor_value:  value,
      threshold_max: machine.threshold
    })
  });
  return res.json();
};

// ── TOAST NOTIFICATIONS ───────────────────────────────────────
const showToast = (event, type) => {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span style="color:${type === 'fault' ? 'var(--critical)' : 'var(--normal)'}">⚠</span>
    <span>
      <strong>${event.machine_name}</strong><br>
      ${parseFloat(event.sensor_value).toFixed(1)}°C — ${event.status.toUpperCase()} on Line ${event.line}
    </span>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
};

// ── ALERT SOUND (subtle beep) ─────────────────────────────────
const playAlertSound = () => {
  try {
    const ctx   = new (window.AudioContext || window.webkitAudioContext)();
    const osc   = ctx.createOscillator();
    const gain  = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(); osc.stop(ctx.currentTime + 0.3);
  } catch(e) {}
};

// ── CONNECTION STATUS ─────────────────────────────────────────
const updateConnectionStatus = (connected) => {
  const el = document.getElementById('conn-status');
  if (!el) return;
  el.textContent = connected ? 'LIVE' : 'RECONNECTING...';
  el.style.color = connected ? 'var(--normal)' : 'var(--warning)';
  const pulse = document.getElementById('conn-pulse');
  if (pulse) pulse.style.background = connected ? 'var(--normal)' : 'var(--warning)';
};

// ── LOAD INITIAL EVENTS ───────────────────────────────────────
const loadInitialEvents = async () => {
  const res  = await fetch(`${API.get}?action=events&limit=15`);
  const data = await res.json();
  data.events.reverse().forEach(e => addEventToLog(e));

  const stats = await fetch(`${API.get}?action=stats`).then(r => r.json());
  state.eventCount = stats.total;
  state.faultCount = stats.faults;
  const el = (id) => document.getElementById(id);
  if (el('stat-total'))  el('stat-total').textContent  = stats.total;
  if (el('stat-faults')) el('stat-faults').textContent = stats.faults;
};

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadInitialEvents();
  connectStream();
  if (document.getElementById('tempChart')) await initChart('M1');

  // Chart machine selector
  document.querySelectorAll('[data-chart-machine]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-chart-machine]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      initChart(btn.dataset.chartMachine);
    });
  });

  // Line filter
  document.querySelectorAll('[data-line-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-line-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const line = btn.dataset.lineFilter;
      connectStream(line === 'all' ? null : line);
    });
  });

  // Simulate buttons
  document.querySelectorAll('[data-sim]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { machine, temp } = btn.dataset;
      btn.disabled = true;
      btn.textContent = 'SENDING...';
      await publishReading(machine, parseFloat(temp));
      btn.disabled = false;
      btn.textContent = `${temp}°C`;
    });
  });
});
