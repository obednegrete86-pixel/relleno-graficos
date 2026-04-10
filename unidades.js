/**
 * Listas de unidades (pendientes / en taller) por indicador y mes.
 * Catálogo: assets/flota-settepi.csv (columnas ID ACTIVAS, CLIENTES, MARCA, AÑO).
 */
(function () {
  const FLOTA_CSV_URL = "assets/flota-settepi.csv";
  let flotaMapPromise = null;

  function loadFlotaMap() {
    if (!flotaMapPromise) {
      flotaMapPromise = fetch(FLOTA_CSV_URL)
        .then((r) => {
          if (!r.ok) throw new Error(r.statusText);
          return r.text();
        })
        .then(parseCsvToMap)
        .catch((err) => {
          console.warn("Flota CSV:", err);
          return new Map();
        });
    }
    return flotaMapPromise;
  }

  function parseCsvToMap(text) {
    const map = new Map();
    const lines = text.split(/\r?\n/);
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(",");
      if (parts.length < 4) continue;
      const id = String(parts[0]).trim().replace(/\s/g, "");
      if (!/^\d+$/.test(id)) continue;
      const anio = String(parts[parts.length - 1]).trim();
      const marca = String(parts[parts.length - 2]).trim();
      const cliente = parts.slice(1, parts.length - 2).join(",").trim();
      map.set(id, { id, cliente, marca, anio });
    }
    return map;
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function parseCarrosTallerLine(line) {
    const t = line.trim();
    if (!t) return null;
    const partsTab = t.split(/\t+/);
    if (partsTab.length >= 2 && /^\d+$/.test(partsTab[0].trim())) {
      const dias = Number(partsTab[1].trim().replace(",", "."));
      return { id: partsTab[0].trim(), dias: Number.isFinite(dias) ? dias : null };
    }
    const m = t.match(/^(\d+)\s*[,;]\s*(\d+(?:[.,]\d+)?)\s*$/);
    if (m) {
      const dias = Number(m[2].replace(",", "."));
      return { id: m[1], dias: Number.isFinite(dias) ? dias : null };
    }
    if (/^\d+$/.test(t)) return { id: t, dias: null };
    return null;
  }

  function parseIdLines(text) {
    const out = [];
    const seen = new Set();
    for (const line of String(text || "").split(/\r?\n/)) {
      const id = line.trim().replace(/\s/g, "");
      if (!/^\d+$/.test(id) || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    return out;
  }

  function parseCarrosEnTallerText(text) {
    const rows = [];
    const seen = new Set();
    for (const line of String(text || "").split(/\r?\n/)) {
      const row = parseCarrosTallerLine(line);
      if (!row || seen.has(row.id)) continue;
      seen.add(row.id);
      rows.push(row);
    }
    return rows;
  }

  function rowStyleForCategory(cat) {
    if (!cat || !CATEGORY_COLORS[cat]) return "background:#f3f4f6;";
    return `background:${CATEGORY_COLORS[cat]};color:#0f172a;`;
  }

  function buildRowCellsCarrosTaller(row, map) {
    const info = map.get(row.id) || { cliente: "—", marca: "—", anio: "—" };
    const cat = row.dias != null && Number.isFinite(row.dias) ? diasEnTallerToCategory(row.dias) : null;
    const label = cat ? CATEGORY_LABELS[cat] || cat : "—";
    const diasTxt = row.dias != null && Number.isFinite(row.dias) ? String(Math.round(row.dias)) : "—";
    const st = rowStyleForCategory(cat);
    return `<tr style="${st}">
      <td><strong>${esc(row.id)}</strong></td>
      <td>${esc(diasTxt)}</td>
      <td>${esc(label)}</td>
      <td>${esc(info.cliente)}</td>
      <td>${esc(info.marca)}</td>
      <td>${esc(info.anio)}</td>
    </tr>`;
  }

  function buildRowCellsSimpleId(id, map) {
    const info = map.get(id) || { cliente: "—", marca: "—", anio: "—" };
    return `<tr>
      <td><strong>${esc(id)}</strong></td>
      <td>${esc(info.cliente)}</td>
      <td>${esc(info.marca)}</td>
      <td>${esc(info.anio)}</td>
    </tr>`;
  }

  function renderTablesHtml(indicador, monthKey, map) {
    const store = getStore();
    const u = getUnidadesMes(store, indicador, monthKey);
    const isCarros = indicador === "carros";

    let htmlEn = "";
    let htmlPe = "";

    if (isCarros) {
      const rowsT = parseCarrosEnTallerText(u.enTallerText || "");
      htmlEn =
        rowsT.length === 0
          ? "<p class=\"subtle\">Sin unidades en taller capturadas para este mes.</p>"
          : `<div class="table-scroll"><table class="data-table unidades-data-table"><thead><tr>
            <th>ID</th><th>Días en taller</th><th>Rango (gráfica)</th><th>Cliente</th><th>Marca</th><th>Año</th>
          </tr></thead><tbody>${rowsT.map((r) => buildRowCellsCarrosTaller(r, map)).join("")}</tbody></table></div>`;

      const idsP = parseIdLines(u.pendientesText || "");
      htmlPe =
        idsP.length === 0
          ? "<p class=\"subtle\">Sin unidades pendientes listadas.</p>"
          : `<div class="table-scroll"><table class="data-table unidades-data-table"><thead><tr>
            <th>ID</th><th>Cliente</th><th>Marca</th><th>Año</th>
          </tr></thead><tbody>${idsP.map((id) => buildRowCellsSimpleId(id, map)).join("")}</tbody></table></div>`;
    } else {
      const idsT = parseIdLines(u.enTallerText || "");
      htmlEn =
        idsT.length === 0
          ? "<p class=\"subtle\">Sin unidades en taller.</p>"
          : `<div class="table-scroll"><table class="data-table unidades-data-table"><thead><tr>
            <th>ID</th><th>Cliente</th><th>Marca</th><th>Año</th>
          </tr></thead><tbody>${idsT.map((id) => buildRowCellsSimpleId(id, map)).join("")}</tbody></table></div>`;

      const idsP = parseIdLines(u.pendientesText || "");
      htmlPe =
        idsP.length === 0
          ? "<p class=\"subtle\">Sin unidades pendientes.</p>"
          : `<div class="table-scroll"><table class="data-table unidades-data-table"><thead><tr>
            <th>ID</th><th>Cliente</th><th>Marca</th><th>Año</th>
          </tr></thead><tbody>${idsP.map((id) => buildRowCellsSimpleId(id, map)).join("")}</tbody></table></div>`;
    }

    const titulo = `Mes ${monthKey}`;
    return `
      <section class="card unidades-panel-card">
        <h2>Unidades — ${titulo}</h2>
        <p class="subtle">Datos desde Captura. Cliente/Marca/Año desde <code>flota-settepi.csv</code> cuando el ID coincide.</p>
        <h3 class="unidades-subtitle">En taller</h3>
        ${isCarros ? "<p class=\"subtle\">Carros: color de fila = rango de días como en el gráfico apilado.</p>" : ""}
        ${htmlEn}
        <h3 class="unidades-subtitle" style="margin-top:1.25rem;">Pendientes</h3>
        ${htmlPe}
        <div class="actions" style="margin-top:1rem;">
          <button type="button" class="btn-outline unidades-export-btn" data-exp-ind="${indicador}" data-exp-mk="${monthKey}">Exportar tablas (CSV)</button>
        </div>
      </section>
    `;
  }

  function csvEscape(v) {
    const s = String(v ?? "");
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function buildExportCsv(indicador, monthKey, map) {
    const store = getStore();
    const u = getUnidadesMes(store, indicador, monthKey);
    const lines = [];
    const isCarros = indicador === "carros";
    lines.push(["seccion", "id", "dias_taller", "rango_grafica", "cliente", "marca", "anio"].join(","));
    if (isCarros) {
      for (const row of parseCarrosEnTallerText(u.enTallerText || "")) {
        const info = map.get(row.id) || {};
        const cat = row.dias != null && Number.isFinite(row.dias) ? diasEnTallerToCategory(row.dias) : "";
        const lab = cat ? CATEGORY_LABELS[cat] || cat : "";
        lines.push(
          ["en_taller", row.id, row.dias != null ? Math.round(row.dias) : "", lab, info.cliente || "", info.marca || "", info.anio || ""]
            .map(csvEscape)
            .join(",")
        );
      }
      for (const id of parseIdLines(u.pendientesText || "")) {
        const info = map.get(id) || {};
        lines.push(["pendientes", id, "", "", info.cliente || "", info.marca || "", info.anio || ""].map(csvEscape).join(","));
      }
    } else {
      for (const id of parseIdLines(u.enTallerText || "")) {
        const info = map.get(id) || {};
        lines.push(["en_taller", id, "", "", info.cliente || "", info.marca || "", info.anio || ""].map(csvEscape).join(","));
      }
      for (const id of parseIdLines(u.pendientesText || "")) {
        const info = map.get(id) || {};
        lines.push(["pendientes", id, "", "", info.cliente || "", info.marca || "", info.anio || ""].map(csvEscape).join(","));
      }
    }
    return lines.join("\r\n");
  }

  function monthKeyFromSelectEl(sel) {
    if (!sel) return null;
    const m = Number(sel.value);
    if (!m || m < 1 || m > 12) return null;
    const y = new Date().getFullYear();
    return toMonthKey(new Date(y, m - 1, 1));
  }

  function wireExportButtons(root, map) {
    root.querySelectorAll(".unidades-export-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const indicador = btn.getAttribute("data-exp-ind");
        const monthKey = btn.getAttribute("data-exp-mk");
        const csv = buildExportCsv(indicador, monthKey, map);
        const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `unidades_${indicador}_${monthKey}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      });
    });
  }

  window.renderUnidadesIndicadorPanel = function renderUnidadesIndicadorPanel(indicador, monthKey) {
    const el = document.getElementById("unidadesIndicadoresPanel");
    if (!el || !monthKey) return;
    loadFlotaMap().then((map) => {
      el.innerHTML = renderTablesHtml(indicador, monthKey, map);
      wireExportButtons(el, map);
    });
  };

  function reloadCaptureTextareas() {
    document.querySelectorAll(".unidades-capture-block").forEach((block) => {
      const indicador = block.getAttribute("data-unidades-indicador");
      const selId = block.getAttribute("data-month-select-id");
      const sel = document.getElementById(selId);
      const mk = monthKeyFromSelectEl(sel);
      if (!indicador || !mk) return;
      const store = getStore();
      const u = getUnidadesMes(store, indicador, mk);
      const taE = block.querySelector('textarea[data-field="enTaller"]');
      const taP = block.querySelector('textarea[data-field="pendientes"]');
      if (taE) taE.value = u.enTallerText || "";
      if (taP) taP.value = u.pendientesText || "";
      const msg = block.querySelector(".unidades-capture-msg");
      if (msg) msg.textContent = "";
    });
  }

  window.reloadUnidadesCaptureTextareas = reloadCaptureTextareas;

  function saveBlock(block) {
    const indicador = block.getAttribute("data-unidades-indicador");
    const selId = block.getAttribute("data-month-select-id");
    const sel = document.getElementById(selId);
    const mk = monthKeyFromSelectEl(sel);
    const msg = block.querySelector(".unidades-capture-msg");
    if (!indicador || !mk) {
      if (msg) msg.textContent = "No se pudo leer el mes del selector.";
      return;
    }
    const taE = block.querySelector('textarea[data-field="enTaller"]');
    const taP = block.querySelector('textarea[data-field="pendientes"]');
    const store = getStore();
    setUnidadesMesTexts(store, indicador, mk, taE ? taE.value : "", taP ? taP.value : "");
    saveStore(store);
    if (msg) msg.textContent = `Listas guardadas para ${mk}.`;
  }

  window.initUnidadesCaptureUI = function initUnidadesCaptureUI() {
    document.querySelectorAll(".unidades-capture-block").forEach((block) => {
      if (block.dataset.unidadesInit === "1") return;
      block.dataset.unidadesInit = "1";
      const btn = block.querySelector(".unidades-guardar-btn");
      if (btn) btn.addEventListener("click", () => saveBlock(block));
      const ex = block.querySelector(".unidades-exportar-local-btn");
      if (ex) {
        ex.addEventListener("click", () => {
          const indicador = block.getAttribute("data-unidades-indicador");
          const sel = document.getElementById(block.getAttribute("data-month-select-id"));
          const mk = monthKeyFromSelectEl(sel);
          if (!mk) return;
          loadFlotaMap().then((map) => {
            const csv = buildExportCsv(indicador, mk, map);
            const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `unidades_${indicador}_${mk}.csv`;
            a.click();
            URL.revokeObjectURL(a.href);
          });
        });
      }
    });
    reloadCaptureTextareas();
  };

})();
