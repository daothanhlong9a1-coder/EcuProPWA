/**
 * Map Table Component
 * Giao diện bảng gần giống phần mềm gốc ECU Pro
 */

class MapTable {
  constructor(container, options = {}) {
    this.container = container;
    this.colAxis = options.colAxis || RPM_AXIS;
    this.rowAxis = options.rowAxis || TPS_AXIS;
    this.data = options.data || [];
    this.isSingleRow = options.isSingleRow || false;
    this.selected = new Set();
    this.onChange = options.onChange || (() => {});
    this.decimals = options.decimals ?? 1;
    this.colorMode = options.colorMode || "fuel";
    this.cornerLabel = options.cornerLabel || "TPS";
  }

  getCellColor(val) {
    if (this.colorMode === "neutral") return null;
    if (!this._minMax) {
      let min = Infinity, max = -Infinity;
      this.data.forEach(row => row.forEach(v => {
        if (typeof v === "number") {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }));
      this._minMax = { min, max: max === min ? min + 1 : max };
    }
    const { min, max } = this._minMax;
    const t = Math.max(0, Math.min(1, (val - min) / (max - min)));

    if (this.colorMode === "afr") {
      if (t < 0.4) return `rgba(30, 64, 175, ${0.25 + t * 0.5})`;
      if (t < 0.6) return `rgba(22, 101, 52, ${0.3 + (t - 0.4) * 0.5})`;
      return `rgba(153, 27, 27, ${0.25 + (t - 0.6) * 0.6})`;
    }
    if (this.colorMode === "ign") {
      return `rgba(234, 179, 8, ${0.15 + t * 0.55})`;
    }
    return `rgba(34, 197, 94, ${0.12 + t * 0.55})`;
  }

  render() {
    this._minMax = null;
    const rows = this.isSingleRow ? 1 : this.rowAxis.length;
    const cols = this.colAxis.length;

    let html = `<div class="map-wrapper"><table class="map-table" id="mapTable">`;
    html += `<thead><tr><th class="corner">${this.cornerLabel}</th>`;
    for (let c = 0; c < cols; c++) {
      html += `<th>${this.colAxis[c]}</th>`;
    }
    html += `</tr></thead><tbody>`;

    for (let r = 0; r < rows; r++) {
      const label = this.isSingleRow ? "VAL" : this.rowAxis[r];
      const isIdle = label === "IDLE";
      html += `<tr>`;
      html += `<td class="row-header ${isIdle ? "idle-label" : ""}">${label}</td>`;
      for (let c = 0; c < cols; c++) {
        const val = this.data[r] ? this.data[r][c] : 0;
        const key = `${r},${c}`;
        const sel = this.selected.has(key) ? "selected" : "";
        const idleCls = isIdle ? "idle-row" : "";
        const bg = this.getCellColor(val);
        const style = bg && !this.selected.has(key) ? `style="background:${bg}"` : "";
        html += `<td class="${sel} ${idleCls}" data-r="${r}" data-c="${c}" data-val="${val}" ${style}>${this.format(val)}</td>`;
      }
      html += `</tr>`;
    }
    html += `</tbody></table></div>`;
    this.container.innerHTML = html;
    this.bindEvents();
  }

  format(val) {
    if (typeof val !== "number") return val;
    return Number.isInteger(val) ? val : val.toFixed(this.decimals);
  }

  bindEvents() {
    const table = this.container.querySelector("#mapTable");
    if (!table) return;
    let isDragging = false;

    const selectCell = (td, additive = false) => {
      if (!td || !td.dataset.r) return;
      const key = `${td.dataset.r},${td.dataset.c}`;
      if (!additive) this.clearSelection();
      this.selected.add(key);
      td.classList.add("selected");
    };

    table.addEventListener("mousedown", (e) => {
      const td = e.target.closest("td[data-r]");
      if (!td) return;
      e.preventDefault();
      isDragging = true;
      selectCell(td, e.ctrlKey || e.metaKey);
    });
    table.addEventListener("mouseover", (e) => {
      if (!isDragging) return;
      const td = e.target.closest("td[data-r]");
      if (td) selectCell(td, true);
    });
    document.addEventListener("mouseup", () => { isDragging = false; });

    table.addEventListener("touchstart", (e) => {
      const td = e.target.closest("td[data-r]");
      if (td) selectCell(td, false);
    }, { passive: true });

    table.addEventListener("dblclick", (e) => {
      const td = e.target.closest("td[data-r]");
      if (td) this.editCell(td);
    });

    let pressTimer;
    table.addEventListener("touchstart", (e) => {
      const td = e.target.closest("td[data-r]");
      if (!td) return;
      pressTimer = setTimeout(() => this.editCell(td), 550);
    }, { passive: true });
    table.addEventListener("touchend", () => clearTimeout(pressTimer));
    table.addEventListener("touchmove", () => clearTimeout(pressTimer));
  }

  editCell(td) {
    const r = +td.dataset.r;
    const c = +td.dataset.c;
    const current = this.data[r][c];
    const input = document.createElement("input");
    input.type = "number";
    input.className = "cell-input";
    input.value = current;
    input.step = "any";
    td.textContent = "";
    td.appendChild(input);
    input.focus();
    input.select();

    const commit = () => {
      let val = parseFloat(input.value);
      if (isNaN(val)) val = current;
      this.data[r][c] = +val.toFixed(this.decimals);
      this._minMax = null;
      td.textContent = this.format(this.data[r][c]);
      td.dataset.val = this.data[r][c];
      const bg = this.getCellColor(this.data[r][c]);
      if (bg) td.style.background = bg;
      this.onChange(this.data);
    };
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); input.blur(); }
      if (e.key === "Escape") td.textContent = this.format(current);
    });
  }

  clearSelection() {
    this.selected.clear();
    this.container.querySelectorAll("td.selected").forEach(td => td.classList.remove("selected"));
  }

  getSelectedCells() {
    return Array.from(this.selected).map(k => {
      const [r, c] = k.split(",").map(Number);
      return { r, c };
    });
  }

  adjustSelected(delta) {
    const cells = this.getSelectedCells();
    if (cells.length === 0) { showToast(t("select_cells")); return; }
    cells.forEach(({ r, c }) => {
      this.data[r][c] = +(this.data[r][c] + delta).toFixed(this.decimals);
    });
    this._minMax = null;
    this.render();
    cells.forEach(({ r, c }) => {
      const td = this.container.querySelector(`td[data-r="${r}"][data-c="${c}"]`);
      if (td) { td.classList.add("selected"); this.selected.add(`${r},${c}`); }
    });
    this.onChange(this.data);
  }

  smoothSelected() {
    const cells = this.getSelectedCells();
    if (cells.length < 2) { this.smoothAll(); return; }
    let sum = 0;
    cells.forEach(({ r, c }) => sum += this.data[r][c]);
    const avg = sum / cells.length;
    cells.forEach(({ r, c }) => {
      this.data[r][c] = +((this.data[r][c] + avg) / 2).toFixed(this.decimals);
    });
    this._minMax = null;
    this.render();
    cells.forEach(({ r, c }) => {
      const td = this.container.querySelector(`td[data-r="${r}"][data-c="${c}"]`);
      if (td) { td.classList.add("selected"); this.selected.add(`${r},${c}`); }
    });
    this.onChange(this.data);
    showToast(t("smoothed"));
  }

  smoothAll() {
    const rows = this.data.length;
    const cols = this.data[0].length;
    const newData = this.data.map(row => [...row]);
    for (let r = 0; r < rows; r++) {
      for (let c = 1; c < cols - 1; c++) {
        newData[r][c] = +((this.data[r][c - 1] + this.data[r][c] + this.data[r][c + 1]) / 3).toFixed(this.decimals);
      }
    }
    this.data = newData;
    this._minMax = null;
    this.render();
    this.onChange(this.data);
    showToast(t("smoothed"));
  }

  setData(data) {
    this.data = data;
    this.selected.clear();
    this._minMax = null;
    this.render();
  }
}
