/**
 * ECU Pro Web - Main Application
 */

let currentPage = "dashboard";
let currentMapTable = null;
let isConnected = false; ECU_DATA.connected = false;
let dashInterval = null;

function showToast(msg, type = "") {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.className = "toast show " + type;
  setTimeout(() => toast.classList.remove("show"), 2200);
}

function setToolbarVisible(show) {
  const tb = document.getElementById("mainToolbar");
  if (tb) tb.style.display = show ? "flex" : "none";
}

/* ========== MAP PAGE ========== */
function renderMapPage(pageKey, titleKey, opts = {}) {
  setToolbarVisible(true);
  const container = document.getElementById("pageContainer");
  const data = getMapData(pageKey);

  const rowAxis = opts.rowAxis || TPS_AXIS;
  const colAxis = opts.colAxis || RPM_AXIS;
  const isSingle = opts.isSingleRow || false;
  const decimals = opts.decimals ?? 1;
  const colorMode = opts.colorMode || "fuel";
  const corner = opts.cornerLabel || "TPS";

  container.innerHTML = `
    <div class="page active" id="page-${pageKey}">
      <div class="page-header">
        <div>
          <div class="page-title">${t(titleKey)}</div>
          <div class="page-subtitle">${isSingle ? "RPM → Value" : corner + " × RPM"}</div>
        </div>
      </div>
      <div id="mapHost"></div>
    </div>
  `;

  currentMapTable = new MapTable(document.getElementById("mapHost"), {
    data,
    rowAxis,
    colAxis,
    isSingleRow: isSingle,
    decimals,
    colorMode,
    cornerLabel: corner,
    onChange: (d) => setMapData(pageKey, d)
  });
  currentMapTable.render();
}

/* ========== IAT Comp (1D table) ========== */
function renderIatCompPage() {
  setToolbarVisible(false);
  const d = ECU_DATA.iatCompInj;
  const container = document.getElementById("pageContainer");
  let rows = "";
  MAP_AXIS.forEach((label, i) => {
    rows += `
      <div class="form-row">
        <span class="form-label">${label} kPa</span>
        <input class="form-input" type="number" data-idx="${i}" value="${d[i]}" step="0.1" />
        <span class="form-unit">%</span>
      </div>`;
  });
  container.innerHTML = `
    <div class="page active form-page">
      <div class="page-header"><div class="page-title">${t("iat_comp_inj")}</div></div>
      <div class="form-section">
        <div class="form-section-title">IAT Compensation Injection</div>
        ${rows}
      </div>
    </div>`;
  document.querySelectorAll("#pageContainer input[data-idx]").forEach(inp => {
    inp.addEventListener("change", () => {
      ECU_DATA.iatCompInj[+inp.dataset.idx] = parseFloat(inp.value) || 0;
      showToast(t("saved"), "success");
    });
  });
}

/* ========== FORM PAGES ========== */
function renderIdleLimitPage() {
  setToolbarVisible(false);
  const d = getCurrentMode().idleLimit;
  const container = document.getElementById("pageContainer");
  container.innerHTML = `
    <div class="page active form-page">
      <div class="page-header"><div class="page-title">${t("idle_limit")}</div></div>
      <div class="form-section">
        <div class="form-section-title">${t("idle_limit")}</div>
        ${formNumber("idleSpeedCold", t("idle_speed_cold"), d.idleSpeedCold, "RPM")}
        ${formNumber("idleSpeedHot", t("idle_speed_hot"), d.idleSpeedHot, "RPM")}
        ${formNumber("idleReturnInjCold", t("idle_return_inj_cold"), d.idleReturnInjCold, "ms")}
        ${formNumber("idleReturnInjHot", t("idle_return_inj_hot"), d.idleReturnInjHot, "ms")}
        ${formNumber("maxSpeed", t("max_speed"), d.maxSpeed, "RPM")}
        ${formNumber("accelPercent", t("accel_percent"), d.accelPercent, "%")}
        ${formNumber("idleSensitivity", t("idle_sensitivity"), d.idleSensitivity, "")}
        ${formNumber("minInjCold", t("min_inj_cold"), d.minInjCold, "ms")}
        ${formNumber("minInjHot", t("min_inj_hot"), d.minInjHot, "ms")}
        ${formNumber("afrDelayCold", t("afr_delay_cold"), d.afrDelayCold, "s")}
        ${formNumber("afrDelayHot", t("afr_delay_hot"), d.afrDelayHot, "s")}
      </div>
    </div>`;
  bindFormInputs("idleLimit");
}

function renderOptionsPage() {
  setToolbarVisible(false);
  const d = ECU_DATA.options;
  const container = document.getElementById("pageContainer");
  container.innerHTML = `
    <div class="page active form-page">
      <div class="page-header"><div class="page-title">${t("options")}</div></div>
      <div class="form-section">
        <div class="form-section-title">${t("options")}</div>
        ${formCheck("tpsMaxPower", t("tps_max_power"), d.tpsMaxPower)}
        ${formCheck("enablePassword", t("enable_password"), d.enablePassword)}
        ${formCheck("noMap", t("no_map"), d.noMap)}
        ${formCheck("ignNoTps", t("ign_no_tps"), d.ignNoTps)}
        ${formCheck("displayReal", t("display_real"), d.displayReal)}
        ${formCheck("afrControl", t("afr_control"), d.afrControl)}
      </div>
    </div>`;
  bindFormChecks("options");
}

function renderSensorVoltagePage() {
  setToolbarVisible(false);
  const d = ECU_DATA.sensorVoltage;
  const container = document.getElementById("pageContainer");

  function makeVoltageTable(title, values, axisLabels) {
    let rows = "";
    for (let i = 0; i < values.length; i++) {
      rows += `<tr>
        <td class="row-header">${axisLabels[i]}</td>
        <td contenteditable="true" data-table="${title}" data-idx="${i}">${values[i].toFixed(2)}</td>
      </tr>`;
    }
    return `
      <div class="form-section sensor-table-section">
        <div class="form-section-title">${title}</div>
        <div class="map-wrapper" style="padding:0;max-height:280px">
          <table class="map-table sensor-table">
            <thead><tr><th class="corner">Point</th><th>V</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  const ectLabels = TEMP_AXIS.map(v => v + "°C");
  const iatLabels = TEMP_AXIS.map(v => v + "°C");
  const mapLabels = MAP_AXIS.map(v => v + " kPa");
  const afrLabels = VOLTAGE_AXIS.map((v,i) => "P" + (i+1));

  container.innerHTML = `
    <div class="page active form-page">
      <div class="page-header"><div class="page-title">${t("sensor_voltage")}</div></div>
      <div class="form-section">
        <div class="form-section-title">TPS Calibration</div>
        ${formNumber("tpsVMin", t("tps_v_min"), d.tpsVMin, "V")}
        ${formNumber("tpsVMax", t("tps_v_max"), d.tpsVMax, "V")}
      </div>
      <div class="sensor-tables-grid">
        ${makeVoltageTable(t("ect_voltage"), d.ect, ectLabels)}
        ${makeVoltageTable(t("iat_voltage"), d.iat, iatLabels)}
        ${makeVoltageTable(t("map_voltage"), d.map, mapLabels)}
        ${makeVoltageTable(t("afr_voltage"), d.afr, afrLabels)}
      </div>
    </div>`;

  bindFormInputs("sensorVoltage");

  // Editable cells
  document.querySelectorAll(".sensor-table td[contenteditable]").forEach(td => {
    td.addEventListener("blur", () => {
      const table = td.dataset.table;
      const idx = +td.dataset.idx;
      let val = parseFloat(td.textContent);
      if (isNaN(val)) val = 0;
      val = +val.toFixed(2);
      td.textContent = val.toFixed(2);
      const keyMap = {
        [t("ect_voltage")]: "ect",
        [t("iat_voltage")]: "iat",
        [t("map_voltage")]: "map",
        [t("afr_voltage")]: "afr",
      };
      // fallback keys
      if (table.includes("ECT") || table.includes("ect")) ECU_DATA.sensorVoltage.ect[idx] = val;
      else if (table.includes("IAT") || table.includes("iat")) ECU_DATA.sensorVoltage.iat[idx] = val;
      else if (table.includes("MAP") || table.includes("map")) ECU_DATA.sensorVoltage.map[idx] = val;
      else if (table.includes("AFR") || table.includes("afr")) ECU_DATA.sensorVoltage.afr[idx] = val;
      showToast(t("saved"), "success");
    });
    td.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); td.blur(); }
    });
  });
}

function renderSetInfoPage() {
  setToolbarVisible(false);
  const d = ECU_DATA.setInfo;
  const container = document.getElementById("pageContainer");
  container.innerHTML = `
    <div class="page active form-page">
      <div class="page-header"><div class="page-title">${t("set_info")}</div></div>
      <div class="form-section">
        <div class="form-section-title">ECU Info</div>
        ${formText("ecuName", t("ecu_name"), d.ecuName)}
        ${formText("ecuModel", t("ecu_model"), d.ecuModel)}
        ${formText("firmware", t("firmware"), d.firmware)}
        ${formText("dataDate", t("data_date"), d.dataDate)}
      </div>
      <div class="form-section">
        <div class="form-section-title">Parameters</div>
        ${formNumber("openFanTemp", t("open_fan_temp"), d.openFanTemp, "°C")}
        ${formNumber("coldStartInj", t("cold_start_inj"), d.coldStartInj, "ms")}
        ${formNumber("coldStartDelay", t("cold_start_delay"), d.coldStartDelay, "s")}
        ${formNumber("idleAutoIgn", t("idle_auto_ign"), d.idleAutoIgn, "°")}
        ${formNumber("idleAutoInj", t("idle_auto_inj"), d.idleAutoInj, "ms")}
      </div>
    </div>`;
  bindFormInputs("setInfo");
}

function renderLearnTpsPage() {
  setToolbarVisible(false);
  const d = ECU_DATA.learnTps;
  const pct = Math.min(100, Math.max(0, ((d.current - d.min) / (d.max - d.min)) * 100));
  const container = document.getElementById("pageContainer");
  container.innerHTML = `
    <div class="page active">
      <div class="page-header">
        <div>
          <div class="page-title">${t("learn_tps_title")}</div>
          <div class="page-subtitle">${t("learn_tps_desc")}</div>
        </div>
      </div>
      <div class="learn-tps-container">
        <div class="tps-gauge" id="tpsGauge" style="background: conic-gradient(var(--accent) ${pct * 3.6}deg, var(--bg-tertiary) 0deg)">
          <div class="tps-value">${d.current.toFixed(2)}<span> V</span></div>
        </div>
        <div class="tps-info">
          <div class="form-row">
            <span class="form-label">${t("tps_min")}</span>
            <input class="form-input" type="number" id="learnMin" value="${d.min.toFixed(2)}" step="0.01" />
            <span class="form-unit">V</span>
          </div>
          <div class="form-row">
            <span class="form-label">${t("tps_max")}</span>
            <input class="form-input" type="number" id="learnMax" value="${d.max.toFixed(2)}" step="0.01" />
            <span class="form-unit">V</span>
          </div>
          <div class="form-row">
            <span class="form-label">${t("tps_current")}</span>
            <input class="form-input" type="number" id="learnCurrent" value="${d.current.toFixed(2)}" step="0.01" readonly />
            <span class="form-unit">V</span>
          </div>
        </div>
        <button class="btn-learn" id="btnStartLearn">${d.learning ? t("stop_learn") : t("start_learn")}</button>
      </div>
    </div>`;
  document.getElementById("btnStartLearn").addEventListener("click", toggleLearnTps);
  document.getElementById("learnMin").addEventListener("change", e => { ECU_DATA.learnTps.min = parseFloat(e.target.value) || 0.5; });
  document.getElementById("learnMax").addEventListener("change", e => { ECU_DATA.learnTps.max = parseFloat(e.target.value) || 4.5; });
}

/* ========== DASHBOARD ========== */
function renderDashboard() {
  setToolbarVisible(false);
  document.body.classList.add("dash-active");
  updateOrientationClass();
  const container = document.getElementById("pageContainer");

  container.innerHTML = `
    <div class="page active dashboard" id="page-dashboard">
      <div class="dash-layout">
        <div class="gauge-cluster">
          <div class="gauge-wrap">
            <canvas id="gaugeRpm" width="300" height="300"></canvas>
            <div class="gauge-digital">
              <span class="gauge-dig-value" id="dashRpm">0</span>
              <span class="gauge-dig-unit">RPM</span>
            </div>
          </div>
          <div class="gauge-wrap gauge-center">
            <canvas id="gaugeSpeed" width="340" height="340"></canvas>
            <div class="gauge-digital large">
              <span class="gauge-dig-value" id="dashSpeed">--</span>
              <span class="gauge-dig-unit">${t("kmh")}</span>
            </div>
            <span class="gauge-badge">${t("dash_waiting")}</span>
          </div>
          <div class="gauge-wrap">
            <canvas id="gaugeAfr" width="300" height="300"></canvas>
            <div class="gauge-digital">
              <span class="gauge-dig-value" id="dashAfr">14.7</span>
              <span class="gauge-dig-unit">AFR</span>
            </div>
          </div>
        </div>
        <div class="dash-secondary">
          <div class="sec-item">
            <div class="sec-label">${t("dash_tps")}</div>
            <div class="sec-value" id="dashTps">0<span>%</span></div>
            <div class="sec-bar"><div class="sec-bar-fill" id="dashTpsBar" style="width:0%"></div></div>
          </div>
          <div class="sec-item">
            <div class="sec-label">${t("dash_ect")}</div>
            <div class="sec-value" id="dashEct">25<span>°C</span></div>
          </div>
          <div class="sec-item">
            <div class="sec-label">${t("dash_iat")}</div>
            <div class="sec-value" id="dashIat">28<span>°C</span></div>
          </div>
          <div class="sec-item">
            <div class="sec-label">${t("dash_map")}</div>
            <div class="sec-value" id="dashMap">101<span>kPa</span></div>
          </div>
          <div class="sec-item">
            <div class="sec-label">${t("dash_battery")}</div>
            <div class="sec-value" id="dashBat">12.6<span>V</span></div>
          </div>
          <div class="sec-item">
            <div class="sec-label">${t("dash_inj")}</div>
            <div class="sec-value" id="dashInj">0<span>%</span></div>
          </div>
          <div class="sec-item">
            <div class="sec-label">${t("dash_ign")}</div>
            <div class="sec-value" id="dashIgn">0.0<span>°</span></div>
          </div>
          <div class="sec-item">
            <div class="sec-label">${t("dash_gear")}</div>
            <div class="sec-value" id="dashGear">N</div>
          </div>
          <div class="sec-item">
            <div class="sec-label">${t("dash_status")}</div>
            <div class="dash-status-pill" id="dashStatus">OFF</div>
          </div>
        </div>
      </div>
    </div>`;

  requestAnimationFrame(() => {
    resizeGauges();
    drawRpmGauge(ECU_DATA.dashboard.rpm);
    drawSpeedGauge(0);
    drawAfrGauge(ECU_DATA.dashboard.afr);
  });
  startDashSimulation();
}

function resizeGauges() {
  const sizes = [
    ["gaugeRpm", 0.9],
    ["gaugeSpeed", 1.05],
    ["gaugeAfr", 0.9],
  ];
  const cluster = document.querySelector(".gauge-cluster");
  if (!cluster) return;
  const isPortrait = window.matchMedia("(orientation: portrait)").matches;
  const h = cluster.clientHeight || 200;
  const w = cluster.clientWidth || 300;
  // Portrait: reserve ~36px under each gauge for digital readout
  const usableH = isPortrait ? Math.max(h - 28, 80) : h * 0.95;
  const base = Math.min(usableH, w / 3.2);
  sizes.forEach(([id, scale]) => {
    const c = document.getElementById(id);
    if (!c) return;
    const s = Math.max(60, Math.round(base * scale));
    c.width = s;
    c.height = s;
  });
}

/** Sportbike-style arc gauge */
function drawArcGauge(canvasId, value, min, max, opts) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  if (W < 10 || H < 10) return;
  const cx = W / 2, cy = H / 2 + H * 0.04;
  const r = Math.min(W, H) * 0.36;
  const startAngle = Math.PI * 0.75;
  const endAngle = Math.PI * 2.25;
  const range = endAngle - startAngle;
  const lw = opts.lineWidth || Math.max(10, r * 0.12);

  ctx.clearRect(0, 0, W, H);

  // Outer ring glow
  ctx.beginPath();
  ctx.arc(cx, cy, r + lw * 0.6, startAngle, endAngle);
  ctx.strokeStyle = "rgba(15, 23, 42, 0.8)";
  ctx.lineWidth = lw + 8;
  ctx.lineCap = "round";
  ctx.stroke();

  // Track background
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle);
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.stroke();

  // Inner dark track
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle);
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = lw - 5;
  ctx.lineCap = "round";
  ctx.stroke();

  // Value
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const valAngle = startAngle + range * t;

  // Colored arc with gradient
  const grad = ctx.createLinearGradient(
    cx + Math.cos(startAngle) * r,
    cy + Math.sin(startAngle) * r,
    cx + Math.cos(endAngle) * r,
    cy + Math.sin(endAngle) * r
  );
  const colors = opts.colors || ["#22c55e", "#eab308", "#ef4444"];
  colors.forEach((c, i) => grad.addColorStop(i / Math.max(colors.length - 1, 1), c));

  if (t > 0.005) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, valAngle);
    ctx.strokeStyle = grad;
    ctx.lineWidth = lw;
    ctx.lineCap = "round";
    ctx.shadowColor = colors[Math.min(colors.length - 1, Math.floor(t * colors.length))];
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Major / minor ticks
  const ticks = opts.ticks || 10;
  for (let i = 0; i <= ticks; i++) {
    const a = startAngle + range * (i / ticks);
    const major = i % (opts.majorEvery || 2) === 0;
    const inner = r - lw / 2 - (major ? 6 : 3);
    const outer = r + lw / 2 + (major ? 3 : 1);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
    const isRed = i >= ticks * 0.85;
    ctx.strokeStyle = isRed ? "#ef4444" : major ? "#94a3b8" : "#334155";
    ctx.lineWidth = major ? 2 : 1;
    ctx.stroke();

    // Tick labels
    if (major && opts.showLabels) {
      const labelR = r - lw / 2 - 16;
      const labelVal = Math.round(min + (max - min) * (i / ticks));
      const display = opts.labelFormat ? opts.labelFormat(labelVal) : String(labelVal);
      ctx.fillStyle = isRed ? "#f87171" : "#64748b";
      ctx.font = `bold ${Math.max(8, Math.round(r * 0.07))}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(display, cx + Math.cos(a) * labelR, cy + Math.sin(a) * labelR);
    }
  }

  // Needle shadow
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(valAngle);
  ctx.beginPath();
  ctx.moveTo(-8, 2);
  ctx.lineTo(r - 8, 2);
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.stroke();

  // Needle body
  const needleColor = opts.needleColor || "#f1f5f9";
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.lineTo(r - 12, 0);
  ctx.strokeStyle = needleColor;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.stroke();

  // Needle tip
  ctx.beginPath();
  ctx.moveTo(r - 18, -3.5);
  ctx.lineTo(r - 4, 0);
  ctx.lineTo(r - 18, 3.5);
  ctx.fillStyle = needleColor;
  ctx.fill();
  ctx.restore();

  // Center hub
  const hubGrad = ctx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, 12);
  hubGrad.addColorStop(0, "#475569");
  hubGrad.addColorStop(1, "#1e293b");
  ctx.beginPath();
  ctx.arc(cx, cy, 11, 0, Math.PI * 2);
  ctx.fillStyle = hubGrad;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fillStyle = needleColor;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, 2, 0, Math.PI * 2);
  ctx.fillStyle = "#0f172a";
  ctx.fill();
}

function drawRpmGauge(rpm) {
  drawArcGauge("gaugeRpm", rpm, 0, 15000, {
    ticks: 15,
    majorEvery: 3,
    showLabels: true,
    labelFormat: (v) => String(Math.round(v / 1000)),
    colors: ["#22c55e", "#4ade80", "#eab308", "#f97316", "#ef4444"],
    needleColor: "#38bdf8",
  });
}

function drawSpeedGauge(speed) {
  drawArcGauge("gaugeSpeed", speed || 0, 0, 300, {
    ticks: 12,
    majorEvery: 2,
    showLabels: true,
    labelFormat: (v) => String(v),
    colors: ["#6366f1", "#818cf8", "#a78bfa", "#c084fc", "#e879f9"],
    needleColor: "#e9d5ff",
  });
}

function drawAfrGauge(afr) {
  drawArcGauge("gaugeAfr", afr, 10, 18, {
    ticks: 8,
    majorEvery: 2,
    showLabels: true,
    labelFormat: (v) => v.toFixed(0),
    colors: ["#3b82f6", "#22c55e", "#86efac", "#eab308", "#ef4444"],
    needleColor: "#fdba74",
  });
}

function startDashSimulation() {
  stopDashSimulation();
  // Mock live data only when "connected"
  dashInterval = setInterval(() => {
    if (!isConnected || currentPage !== "dashboard") return;
    const d = ECU_DATA.dashboard;
    // Simulate gentle variation
    d.rpm = Math.max(0, d.rpm + (Math.random() - 0.45) * 200);
    if (d.rpm < 800 && Math.random() > 0.7) d.rpm = 900 + Math.random() * 500;
    d.tps = Math.max(0, Math.min(100, d.tps + (Math.random() - 0.5) * 3));
    d.afr = Math.max(10, Math.min(18, d.afr + (Math.random() - 0.5) * 0.15));
    d.ect = Math.min(110, d.ect + (Math.random() - 0.3) * 0.1);
    d.iat = 25 + Math.random() * 8;
    d.map = 95 + Math.random() * 20;
    d.battery = 12.2 + Math.random() * 0.8;
    d.injDuty = Math.min(100, d.tps * 0.7 + Math.random() * 5);
    d.ignAdvance = 8 + d.tps * 0.15 + Math.random();
    d.status = d.rpm > 500 ? "RUN" : "IDLE";
    // Speed stays "--" (placeholder)
    updateDashUI();
  }, 400);
}

function stopDashSimulation() {
  if (dashInterval) { clearInterval(dashInterval); dashInterval = null; }
}

function updateDashUI() {
  const d = ECU_DATA.dashboard;
  const el = id => document.getElementById(id);
  if (!el("dashRpm")) return;

  el("dashRpm").textContent = Math.round(d.rpm);
  el("dashTps").innerHTML = d.tps.toFixed(0) + "<span>%</span>";
  const tpsBar = el("dashTpsBar");
  if (tpsBar) tpsBar.style.width = d.tps + "%";
  el("dashAfr").textContent = d.afr.toFixed(1);
  el("dashEct").innerHTML = d.ect.toFixed(0) + "<span>°C</span>";
  el("dashIat").innerHTML = d.iat.toFixed(0) + "<span>°C</span>";
  el("dashMap").innerHTML = d.map.toFixed(0) + "<span>kPa</span>";
  el("dashBat").innerHTML = d.battery.toFixed(1) + "<span>V</span>";
  el("dashInj").innerHTML = d.injDuty.toFixed(0) + "<span>%</span>";
  el("dashIgn").innerHTML = d.ignAdvance.toFixed(1) + "<span>°</span>";
  el("dashGear").textContent = d.gear;
  const st = el("dashStatus");
  st.textContent = d.status;
  st.className = "dash-status-pill " + (d.status === "OFF" ? "off" : "");

  // Redraw gauges
  drawRpmGauge(d.rpm);
  drawAfrGauge(d.afr);
  // Speed stays at 0 / -- (placeholder)
  drawSpeedGauge(0);
}

/* ========== LEARN TPS ========== */
let learnInterval = null;
function toggleLearnTps() {
  const d = ECU_DATA.learnTps;
  d.learning = !d.learning;
  const btn = document.getElementById("btnStartLearn");
  if (d.learning) {
    btn.textContent = t("stop_learn");
    learnInterval = setInterval(() => {
      d.current = +(d.min + Math.random() * (d.max - d.min)).toFixed(2);
      const pct = Math.min(100, Math.max(0, ((d.current - d.min) / (d.max - d.min)) * 100));
      const gauge = document.getElementById("tpsGauge");
      const valEl = document.querySelector(".tps-value");
      const curInput = document.getElementById("learnCurrent");
      if (gauge) gauge.style.background = `conic-gradient(var(--accent) ${pct * 3.6}deg, var(--bg-tertiary) 0deg)`;
      if (valEl) valEl.innerHTML = `${d.current.toFixed(2)}<span> V</span>`;
      if (curInput) curInput.value = d.current.toFixed(2);
    }, 300);
  } else {
    btn.textContent = t("start_learn");
    clearInterval(learnInterval);
    showToast(t("learn_success"), "success");
  }
}

/* ========== FORM HELPERS ========== */
function formNumber(key, label, value, unit) {
  return `<div class="form-row">
    <span class="form-label">${label}</span>
    <input class="form-input" type="number" data-key="${key}" value="${value}" step="any" />
    <span class="form-unit">${unit}</span>
  </div>`;
}
function formText(key, label, value) {
  return `<div class="form-row">
    <span class="form-label">${label}</span>
    <input class="form-input" type="text" data-key="${key}" value="${value}" style="width:140px;text-align:left" />
    <span class="form-unit"></span>
  </div>`;
}
function formCheck(key, label, checked) {
  return `<div class="form-row">
    <span class="form-label">${label}</span>
    <input class="form-checkbox" type="checkbox" data-key="${key}" ${checked ? "checked" : ""} />
  </div>`;
}
function bindFormInputs(group) {
  document.querySelectorAll("#pageContainer input[data-key]").forEach(input => {
    input.addEventListener("change", () => {
      const key = input.dataset.key;
      const val = input.type === "number" ? parseFloat(input.value) : input.value;
      if (group === "idleLimit") getCurrentMode().idleLimit[key] = val;
      else if (group === "sensorVoltage") ECU_DATA.sensorVoltage[key] = val;
      else if (group === "setInfo") ECU_DATA.setInfo[key] = val;
      showToast(t("saved"), "success");
    });
  });
}
function bindFormChecks(group) {
  document.querySelectorAll("#pageContainer input[type=checkbox][data-key]").forEach(input => {
    input.addEventListener("change", () => {
      if (group === "options") ECU_DATA.options[input.dataset.key] = input.checked;
      showToast(t("saved"), "success");
    });
  });
}

/* ========== NAVIGATION ========== */
function navigateTo(page) {
  currentPage = page;
  currentMapTable = null;
  stopDashSimulation();
  document.body.classList.remove("dash-active");

  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.page === page);
  });
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebarOverlay").classList.remove("show");

  switch (page) {
    case "dashboard":
      renderDashboard();
      break;
    case "inj-ve":
      renderMapPage("inj-ve", "inj_ve", { decimals: 2, colorMode: "fuel" });
      break;
    case "inj-degree":
      renderMapPage("inj-degree", "inj_degree", { decimals: 0, colorMode: "fuel" });
      break;
    case "ign-degree":
      renderMapPage("ign-degree", "ign_degree", { decimals: 1, colorMode: "ign" });
      break;
    case "ign-time":
      renderMapPage("ign-time", "ign_time", { decimals: 2, isSingleRow: true, colorMode: "neutral", cornerLabel: "RPM" });
      break;
    case "afr":
      renderMapPage("afr", "afr", { decimals: 1, colorMode: "afr" });
      break;
    case "ect-comp-inj":
      renderMapPage("ect-comp-inj", "ect_comp_inj", {
        decimals: 1, colorMode: "fuel",
        rowAxis: ECT_AXIS, cornerLabel: "ECT°C"
      });
      break;
    case "ect-comp-ign":
      renderMapPage("ect-comp-ign", "ect_comp_ign", {
        decimals: 1, colorMode: "ign",
        rowAxis: ECT_AXIS, cornerLabel: "ECT°C"
      });
      break;
    case "map-comp-inj":
      renderMapPage("map-comp-inj", "map_comp_inj", {
        decimals: 1, colorMode: "fuel",
        rowAxis: MAP_AXIS, cornerLabel: "kPa"
      });
      break;
    case "iat-comp-inj":
      renderIatCompPage();
      break;
    case "idle-limit":
      renderIdleLimitPage();
      break;
    case "options":
      renderOptionsPage();
      break;
    case "sensor-voltage":
      renderSensorVoltagePage();
      break;
    case "set-info":
      renderSetInfoPage();
      break;
    case "learn-tps":
      renderLearnTpsPage();
      break;
  }
}

/* ========== TOOLBAR ========== */
function initToolbar() {
  document.getElementById("btnPlus1").addEventListener("click", () => currentMapTable && currentMapTable.adjustSelected(1));
  document.getElementById("btnMinus1").addEventListener("click", () => currentMapTable && currentMapTable.adjustSelected(-1));
  document.getElementById("btnPlus01").addEventListener("click", () => currentMapTable && currentMapTable.adjustSelected(0.1));
  document.getElementById("btnMinus01").addEventListener("click", () => currentMapTable && currentMapTable.adjustSelected(-0.1));
  document.getElementById("btnSmooth").addEventListener("click", () => currentMapTable && currentMapTable.smoothSelected());
  document.getElementById("btnCopy").addEventListener("click", () => {
    if (!currentMapTable) return;
    const cells = currentMapTable.getSelectedCells();
    if (cells.length === 0) { showToast(t("select_cells")); return; }
    const val = currentMapTable.data[cells[0].r][cells[0].c];
    cells.forEach(({ r, c }) => { currentMapTable.data[r][c] = val; });
    currentMapTable.render();
    cells.forEach(({ r, c }) => {
      const td = currentMapTable.container.querySelector(`td[data-r="${r}"][data-c="${c}"]`);
      if (td) { td.classList.add("selected"); currentMapTable.selected.add(`${r},${c}`); }
    });
    currentMapTable.onChange(currentMapTable.data);
    showToast(t("copied"), "success");
  });
  document.getElementById("btnReset").addEventListener("click", () => {
    if (!confirm(t("reset_confirm"))) return;
    resetMap(currentPage);
    navigateTo(currentPage);
    showToast(t("saved"), "success");
  });
}

/* ========== CONNECT ========== */
function initConnect() {
  const btn = document.getElementById("btnConnect");
  const statusBar = document.getElementById("statusBar");
  const statusText = document.getElementById("statusText");

  btn.addEventListener("click", () => {
    if (isConnected) {
      isConnected = false; ECU_DATA.connected = false;
      btn.classList.remove("connected");
      btn.innerHTML = `<i class="fas fa-plug"></i> <span>${t("connect")}</span>`;
      statusBar.className = "status-bar offline";
      statusText.textContent = t("status_offline");
      ECU_DATA.dashboard.rpm = 0;
      ECU_DATA.dashboard.status = "OFF";
      if (currentPage === "dashboard") updateDashUI();
    } else {
      statusBar.className = "status-bar connecting";
      statusText.textContent = t("status_connecting");
      btn.disabled = true;
      setTimeout(() => {
        isConnected = true; ECU_DATA.connected = true;
        btn.disabled = false;
        btn.classList.add("connected");
        btn.innerHTML = `<i class="fas fa-plug"></i> <span>${t("disconnect")}</span>`;
        statusBar.className = "status-bar online";
        statusText.textContent = t("status_online");
        ECU_DATA.dashboard.rpm = 1200;
        ECU_DATA.dashboard.status = "IDLE";
        showToast(t("status_online"), "success");
        if (currentPage === "dashboard") startDashSimulation();
      }, 1000);
    }
  });
}

/* ========== UI INIT ========== */
function initUI() {
  document.getElementById("btnMenu").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
    document.getElementById("sidebarOverlay").classList.toggle("show");
  });
  document.getElementById("sidebarOverlay").addEventListener("click", () => {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("sidebarOverlay").classList.remove("show");
  });
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => navigateTo(btn.dataset.page));
  });
  document.getElementById("btnLang").addEventListener("click", () => {
    setLanguage(currentLang === "vi" ? "en" : "vi");
    navigateTo(currentPage);
  });
}


/* ========== MODE + DATA ACTIONS ========== */
function initModeBar() {
  document.querySelectorAll(".mode-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const mode = +btn.dataset.mode;
      setCurrentMode(mode);
      document.querySelectorAll(".mode-btn").forEach(b => b.classList.toggle("active", +b.dataset.mode === mode));
      // Re-render current page with new mode data
      navigateTo(currentPage);
      showToast(`${t("mode")} No.${mode + 1}`, "success");
    });
  });
}

function initDataActions() {
  document.getElementById("btnReadCur").addEventListener("click", async () => {
    const ok = await Comm.readCurrent(currentPage);
    if (ok) navigateTo(currentPage);
  });
  document.getElementById("btnWriteCur").addEventListener("click", async () => {
    await Comm.writeCurrent(currentPage);
  });
  document.getElementById("btnReadAll").addEventListener("click", async () => {
    const ok = await Comm.readAll();
    if (ok) navigateTo(currentPage);
  });
  document.getElementById("btnWriteAll").addEventListener("click", async () => {
    await Comm.writeAll();
  });
  document.getElementById("btnSaveFile").addEventListener("click", () => {
    Comm.saveToFile();
  });
  document.getElementById("btnOpenFile").addEventListener("click", () => {
    document.getElementById("fileInput").click();
  });
  document.getElementById("fileInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await Comm.loadFromFile(file);
    // Sync mode buttons
    document.querySelectorAll(".mode-btn").forEach(b =>
      b.classList.toggle("active", +b.dataset.mode === ECU_DATA.currentMode)
    );
    navigateTo(currentPage);
    e.target.value = "";
  });
  document.getElementById("btnFactory").addEventListener("click", async () => {
    const ok = await Comm.factoryReset();
    if (ok) navigateTo(currentPage);
  });
}


function updateOrientationClass() {
  const isLand = window.matchMedia("(orientation: landscape)").matches;
  document.body.classList.toggle("dash-landscape", isLand && currentPage === "dashboard");
}

function refreshDashboardGauges() {
  if (currentPage !== "dashboard") return;
  updateOrientationClass();
  resizeGauges();
  drawRpmGauge(ECU_DATA.dashboard.rpm);
  drawSpeedGauge(0);
  drawAfrGauge(ECU_DATA.dashboard.afr);
}

window.addEventListener("resize", () => {
  refreshDashboardGauges();
});

window.addEventListener("orientationchange", () => {
  setTimeout(refreshDashboardGauges, 200);
});

document.addEventListener("DOMContentLoaded", () => {
  setLanguage(currentLang);
  initUI();
  initToolbar();
  initConnect();
  initModeBar();
  initDataActions();
  navigateTo("dashboard");
});
