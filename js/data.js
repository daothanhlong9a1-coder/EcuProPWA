/**
 * ECU Data Model – aligned with ECU Pro 9.1X
 * 4 Modes (No.1–No.4) = operating modes, not cylinders
 */

const RPM_AXIS = Array.from({ length: 30 }, (_, i) => (i + 1) * 500);
const TPS_AXIS = [100, 90, 80, 70, 60, 50, 40, 30, 20, 15, 10, 5, 0, "IDLE"];
const ECT_AXIS = [-20, -10, 0, 10, 20, 30, 40, 50, 60, 70, 80, 90];
const MAP_AXIS = [20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];
const VOLTAGE_AXIS = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.2, 4.5, 4.8];
const TEMP_AXIS = [-20, 0, 20, 40, 60, 80, 100, 120, 140, 160, 180];

function createDefaultMap(rows, cols, baseValue, variance = 0, opts = {}) {
  const map = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      let val = baseValue;
      if (variance > 0) {
        const tpsFactor = opts.reverseTps
          ? (rows - 1 - r) / Math.max(rows - 2, 1)
          : r / Math.max(rows - 2, 1);
        const rpmFactor = 1 - Math.abs(c - cols / 2) / (cols / 2) * 0.25;
        val = +(baseValue * (0.55 + tpsFactor * 0.55) * rpmFactor + (Math.random() - 0.5) * variance).toFixed(2);
      }
      row.push(val);
    }
    map.push(row);
  }
  return map;
}

function create1D(len, base, variance = 0) {
  return Array.from({ length: len }, (_, i) => {
    const factor = i / Math.max(len - 1, 1);
    return +(base * (0.7 + factor * 0.5) + (Math.random() - 0.5) * variance).toFixed(2);
  });
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/** One complete mode data set */
function createModeData(modeIndex) {
  // Slight variation per mode so they look different
  const v = 0.3 * modeIndex;
  return {
    injVe: createDefaultMap(14, 30, 5.0 + v, 1.5, { reverseTps: true }),
    injDegree: createDefaultMap(14, 30, 180 + modeIndex * 5, 25, { reverseTps: true }),
    ignDegree: createDefaultMap(14, 30, 18 + modeIndex, 8, { reverseTps: true }),
    afr: createDefaultMap(14, 30, 13.2, 1.0, { reverseTps: true }),
    ignTime: createDefaultMap(1, 30, 2.8 + v * 0.1, 0.4),
    idleLimit: {
      idleSpeedCold: 1500 + modeIndex * 50,
      idleSpeedHot: 1400 + modeIndex * 40,
      idleReturnInjCold: 2.5,
      idleReturnInjHot: 2.0,
      maxSpeed: 12000 + modeIndex * 500,
      accelPercent: 30,
      idleSensitivity: 5,
      minInjCold: 1.8,
      minInjHot: 1.5,
      afrDelayCold: 3.0,
      afrDelayHot: 2.0,
    },
  };
}

/**
 * Page numbers matching original RetPage() mapping
 * Original: page = functionId * 16 + modeNumber
 * function ids derived from button name last hex digit
 */
const PAGE_MAP = {
  "inj-ve": 1,       // Oil_Time  → page base 1
  "inj-degree": 2,   // Oil_Angle
  "ign-degree": 3,   // Ign_Angle
  "ign-time": 4,     // Ign_Time
  "afr": 5,          // AF_Dat
  "idle-limit": 6,
  "ect-comp-inj": 7,
  "ect-comp-ign": 8,
  "map-comp-inj": 9,
};

/** UART command codes from original source */
const UART_CMD = {
  REALTIME: 105,
  READ_CURRENT: 154,
  READ_ALL: 171,
  WRITE_CURRENT: 90,   // via proDgvEnter
  FACTORY_RESET: 119,
  CONNECT_PROBE: 72,
};

const ECU_DATA = {
  // 4 operating modes (No.1 – No.4)
  modes: [
    createModeData(0),
    createModeData(1),
    createModeData(2),
    createModeData(3),
  ],
  currentMode: 0, // 0–3

  // Shared (not per-mode)
  ectCompInj: createDefaultMap(11, 30, 5, 8),
  ectCompIgn: createDefaultMap(11, 30, 2, 3),
  mapCompInj: createDefaultMap(11, 30, 3, 5),
  iatCompInj: create1D(11, 2.0, 1.5),

  options: {
    tpsMaxPower: false,
    enablePassword: false,
    noMap: false,
    ignNoTps: false,
    displayReal: true,
    afrControl: true,
  },

  sensorVoltage: {
    tpsVMin: 0.50,
    tpsVMax: 4.50,
    ect: create1D(11, 2.5, 0.8),
    iat: create1D(11, 2.5, 0.8),
    map: create1D(11, 2.5, 0.8),
    afr: create1D(11, 2.5, 0.8),
  },

  setInfo: {
    ecuName: "NAITO ECU",
    ecuModel: "Pro 9.1X",
    firmware: "9.1.2.18",
    dataDate: new Date().toISOString().slice(0, 10),
    openFanTemp: 95,
    coldStartInj: 3.0,
    coldStartDelay: 2.0,
    idleAutoIgn: 2.0,
    idleAutoInj: 0.3,
  },

  learnTps: { min: 0.50, max: 4.50, current: 0.80, learning: false },

  dashboard: {
    rpm: 0, speed: 0, tps: 0, afr: 14.7, ect: 25, iat: 28,
    map: 101, battery: 12.6, injDuty: 0, ignAdvance: 0, gear: "N", status: "OFF",
  },

  // Connection state (mock)
  connected: false,
  ecuMode: 2, // ECU_PC4
  ecuVer: 9.1,
};

const DEFAULT_DATA = deepClone(ECU_DATA);

/* ========== Mode helpers ========== */
function getCurrentMode() {
  return ECU_DATA.modes[ECU_DATA.currentMode];
}

function setCurrentMode(idx) {
  if (idx >= 0 && idx < 4) ECU_DATA.currentMode = idx;
}

function getMapData(page) {
  const mode = getCurrentMode();
  const map = {
    "inj-ve": mode.injVe,
    "inj-degree": mode.injDegree,
    "ign-degree": mode.ignDegree,
    "ign-time": mode.ignTime,
    "afr": mode.afr,
    "ect-comp-inj": ECU_DATA.ectCompInj,
    "ect-comp-ign": ECU_DATA.ectCompIgn,
    "map-comp-inj": ECU_DATA.mapCompInj,
  };
  return map[page] || null;
}

function setMapData(page, data) {
  const mode = getCurrentMode();
  const shared = {
    "ect-comp-inj": () => ECU_DATA.ectCompInj = data,
    "ect-comp-ign": () => ECU_DATA.ectCompIgn = data,
    "map-comp-inj": () => ECU_DATA.mapCompInj = data,
  };
  if (shared[page]) { shared[page](); return; }
  const keys = {
    "inj-ve": "injVe", "inj-degree": "injDegree",
    "ign-degree": "ignDegree", "ign-time": "ignTime", "afr": "afr",
  };
  if (keys[page]) mode[keys[page]] = data;
}

function resetMap(page) {
  const def = deepClone(DEFAULT_DATA);
  if (["inj-ve","inj-degree","ign-degree","ign-time","afr","idle-limit"].includes(page)) {
    const key = { "inj-ve":"injVe","inj-degree":"injDegree","ign-degree":"ignDegree",
      "ign-time":"ignTime","afr":"afr","idle-limit":"idleLimit" }[page];
    ECU_DATA.modes[ECU_DATA.currentMode][key] = def.modes[ECU_DATA.currentMode][key];
  } else if (page === "ect-comp-inj") ECU_DATA.ectCompInj = def.ectCompInj;
  else if (page === "ect-comp-ign") ECU_DATA.ectCompIgn = def.ectCompIgn;
  else if (page === "map-comp-inj") ECU_DATA.mapCompInj = def.mapCompInj;
  else if (page === "options") ECU_DATA.options = def.options;
  else if (page === "sensor-voltage") ECU_DATA.sensorVoltage = def.sensorVoltage;
  else if (page === "set-info") ECU_DATA.setInfo = def.setInfo;
}

/** Page number like original: functionBase * 16 + modeNumber (1-based) */
function getPageNumber(page) {
  const base = PAGE_MAP[page] || 1;
  return base * 16 + (ECU_DATA.currentMode + 1);
}

/* ========== Communication layer (mock UART, real logic flow) ========== */
const Comm = {
  /** Check connection – mirrors proComNormal() */
  isConnected() {
    return ECU_DATA.connected;
  },

  requireConnect() {
    if (!this.isConnected()) {
      showToast(t("status_offline"), "error");
      return false;
    }
    return true;
  },

  /**
   * Read current page from ECU
   * Original: proKeyRdCur → proTxCommand(154)
   */
  async readCurrent(page) {
    if (!this.requireConnect()) return false;
    showToast(t("reading") || "Reading...", "");
    await this._delay(600);
    // Mock: slightly randomize current map to simulate ECU data
    const data = getMapData(page);
    if (data) {
      data.forEach(row => {
        if (Array.isArray(row)) {
          row.forEach((_, i) => {
            if (typeof row[i] === "number") {
              row[i] = +(row[i] * (0.95 + Math.random() * 0.1)).toFixed(2);
            }
          });
        }
      });
      setMapData(page, data);
    }
    showToast(t("read_ok") || "Read OK", "success");
    return true;
  },

  /**
   * Write current page to ECU
   * Original: proDgvEnter(true, RetPageNumber())
   */
  async writeCurrent(page) {
    if (!this.requireConnect()) return false;
    const pageNum = getPageNumber(page);
    showToast((t("writing") || "Writing...") + ` [P${pageNum}]`, "");
    await this._delay(800);
    // In real: serialize map → UART hex frames
    showToast(t("write_ok") || "Write OK", "success");
    return true;
  },

  /**
   * Read ALL maps from ECU
   * Original: proKeyReadAll → proTxCommand(171)
   */
  async readAll() {
    if (!this.requireConnect()) return false;
    if (!confirm(t("confirm_read_all") || "Confirm read all?")) return false;
    showToast(t("reading_all") || "Reading all...", "");
    await this._delay(1500);
    // Mock: refresh all 4 modes with slight variation
    for (let m = 0; m < 4; m++) {
      const mode = ECU_DATA.modes[m];
      ["injVe","injDegree","ignDegree","afr"].forEach(k => {
        mode[k].forEach(row => {
          row.forEach((_, i) => {
            if (typeof row[i] === "number")
              row[i] = +(row[i] * (0.97 + Math.random() * 0.06)).toFixed(2);
          });
        });
      });
    }
    showToast(t("read_ok") || "Read all OK", "success");
    return true;
  },

  /**
   * Write ALL maps to ECU
   * Original: proKeyWriterAll → proDgvEnter(false, page)
   */
  async writeAll() {
    if (!this.requireConnect()) return false;
    if (!confirm(t("confirm_write_all") || "Confirm write all?")) return false;
    showToast(t("writing_all") || "Writing all...", "");
    await this._delay(2000);
    showToast(t("write_ok") || "Write all OK", "success");
    return true;
  },

  /**
   * Factory reset
   * Original: Restore factory data
   */
  async factoryReset() {
    if (!this.requireConnect()) return false;
    if (!confirm(t("confirm_reset") || "Factory reset?")) return false;
    showToast(t("restoring") || "Restoring...", "");
    await this._delay(1200);
    const def = deepClone(DEFAULT_DATA);
    ECU_DATA.modes = def.modes;
    ECU_DATA.ectCompInj = def.ectCompInj;
    ECU_DATA.ectCompIgn = def.ectCompIgn;
    ECU_DATA.mapCompInj = def.mapCompInj;
    ECU_DATA.iatCompInj = def.iatCompInj;
    ECU_DATA.options = def.options;
    ECU_DATA.sensorVoltage = def.sensorVoltage;
    showToast(t("reset_ok") || "Factory reset OK", "success");
    return true;
  },

  /**
   * Save all settings + maps to JSON file (browser download)
   * Mirrors exportModuleTAB / Save in original
   */
  saveToFile() {
    const payload = {
      version: "9.1.2.18",
      exportDate: new Date().toISOString(),
      currentMode: ECU_DATA.currentMode,
      modes: ECU_DATA.modes,
      ectCompInj: ECU_DATA.ectCompInj,
      ectCompIgn: ECU_DATA.ectCompIgn,
      mapCompInj: ECU_DATA.mapCompInj,
      iatCompInj: ECU_DATA.iatCompInj,
      options: ECU_DATA.options,
      sensorVoltage: ECU_DATA.sensorVoltage,
      setInfo: ECU_DATA.setInfo,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ECU_Data_Mode${ECU_DATA.currentMode + 1}_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast(t("saved") || "Saved", "success");
  },

  /**
   * Load settings from JSON file
   */
  loadFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (data.modes) ECU_DATA.modes = data.modes;
          if (data.ectCompInj) ECU_DATA.ectCompInj = data.ectCompInj;
          if (data.ectCompIgn) ECU_DATA.ectCompIgn = data.ectCompIgn;
          if (data.mapCompInj) ECU_DATA.mapCompInj = data.mapCompInj;
          if (data.iatCompInj) ECU_DATA.iatCompInj = data.iatCompInj;
          if (data.options) ECU_DATA.options = data.options;
          if (data.sensorVoltage) ECU_DATA.sensorVoltage = data.sensorVoltage;
          if (data.setInfo) ECU_DATA.setInfo = data.setInfo;
          if (typeof data.currentMode === "number") ECU_DATA.currentMode = data.currentMode;
          showToast(t("load_ok") || "Loaded", "success");
          resolve(true);
        } catch (err) {
          showToast(t("load_fail") || "Load failed", "error");
          reject(err);
        }
      };
      reader.readAsText(file);
    });
  },

  /**
   * Copy current mode data to another mode
   * Mirrors "Copy data to..." in original
   */
  copyModeTo(targetModeIdx) {
    if (targetModeIdx === ECU_DATA.currentMode) return;
    ECU_DATA.modes[targetModeIdx] = deepClone(getCurrentMode());
    showToast((t("copied") || "Copied") + ` → Mode ${targetModeIdx + 1}`, "success");
  },

  /**
   * Copy current map page to all 4 modes
   */
  copyPageToAllModes(page) {
    const src = deepClone(getMapData(page));
    if (!src) return;
    const key = {
      "inj-ve":"injVe","inj-degree":"injDegree","ign-degree":"ignDegree",
      "ign-time":"ignTime","afr":"afr"
    }[page];
    if (!key) return;
    for (let m = 0; m < 4; m++) {
      if (m !== ECU_DATA.currentMode) ECU_DATA.modes[m][key] = deepClone(src);
    }
    showToast((t("copied") || "Copied") + " → All modes", "success");
  },

  _delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
};
