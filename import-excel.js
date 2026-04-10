(function () {
  function normKey(k) {
    return String(k)
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\u0300-\u036f/g, "");
  }

  function firstDefined(obj, keys) {
    for (const k of keys) {
      const nk = normKey(k);
      for (const ok of Object.keys(obj)) {
        if (normKey(ok) === nk) {
          const v = obj[ok];
          if (v !== undefined && v !== null && String(v).trim() !== "") return v;
        }
      }
    }
    return undefined;
  }

  function parseOptionalNumber(val) {
    if (val === undefined || val === null) return null;
    const s = String(val).trim();
    if (s === "") return null;
    const n = Number(s.replace(",", "."));
    if (Number.isNaN(n)) return null;
    return Math.max(0, Math.round(n));
  }

  function parseOptionalPercent(val) {
    if (val === undefined || val === null) return null;
    const s = String(val).trim();
    if (s === "") return null;
    const n = Number(s.replace(",", "."));
    if (Number.isNaN(n)) return null;
    return Math.min(100, Math.max(0, Math.round(n)));
  }

  function parseGrain(val) {
    if (val === undefined || val === null) return null;
    const s = normKey(String(val));
    if (s === "semana" || s === "week" || s === "w" || s === "semana_iso") return "week";
    if (s === "dia" || s === "día" || s === "day" || s === "d") return "day";
    return null;
  }

  function rowsFromSheet(wb, name) {
    const sh = wb.Sheets[name];
    if (!sh) return [];
    return XLSX.utils.sheet_to_json(sh, { defval: "", raw: false });
  }

  function rowHasCategoryData(row) {
    return CATEGORY_KEYS.some((key) => parseOptionalNumber(firstDefined(row, [key])) !== null);
  }

  function mergeCategoryRow(target, row) {
    for (const key of CATEGORY_KEYS) {
      const n = parseOptionalNumber(firstDefined(row, [key]));
      if (n !== null) target[key] = n;
    }
  }

  function mergePointRow(target, row) {
    const p = parseOptionalPercent(firstDefined(row, ["porcentaje", "porc", "pct"]));
    const pen = parseOptionalNumber(firstDefined(row, ["pendientes", "pendiente"]));
    if (p !== null) target.porcentaje = p;
    if (pen !== null) target.pendientes = pen;
  }

  function applyCarrosUctAnual(store, wb, errors) {
    let n = 0;
    for (const row of rowsFromSheet(wb, "carros_uct_anual")) {
      const year = parseOptionalNumber(firstDefined(row, ["año", "ano", "year"]));
      const month = parseOptionalNumber(firstDefined(row, ["mes", "month"]));
      const uct = parseOptionalNumber(firstDefined(row, ["uct"]));
      if (year === null || month === null || uct === null) continue;
      if (month < 1 || month > 12) {
        errors.push(`carros_uct_anual: mes inválido (${month})`);
        continue;
      }
      const yearly = ensureYearlyData(store, year);
      yearly[String(month)] = uct;
      n += 1;
    }
    return n;
  }

  function applyCarrosTotalMes(store, wb, errors) {
    let n = 0;
    for (const row of rowsFromSheet(wb, "carros_total_mes")) {
      const mk = String(firstDefined(row, ["clave_mes", "month_key"]) || "").trim();
      if (!/^\d{4}-\d{2}$/.test(mk)) continue;
      const tot = parseOptionalNumber(firstDefined(row, ["total_uct_mes", "monthlytotaluct", "total_uct"]));
      if (tot === null) continue;
      const dateObj = parseMonthKey(mk);
      const md = ensureMonthData(store, mk, dateObj);
      md.monthlyTotalUCT = tot;
      md.updatedAt = new Date().toISOString();
      n += 1;
    }
    return n;
  }

  function applyCarrosDetalle(store, wb, errors) {
    let n = 0;
    for (const row of rowsFromSheet(wb, "carros_detalle")) {
      const mk = String(firstDefined(row, ["clave_mes", "month_key"]) || "").trim();
      if (!/^\d{4}-\d{2}$/.test(mk)) continue;
      const grain = parseGrain(firstDefined(row, ["tipo", "grain", "type"]));
      const period = parseOptionalNumber(firstDefined(row, ["periodo", "period", "semana", "dia", "day"]));
      if (!grain || period === null) continue;
      if (!rowHasCategoryData(row)) continue;
      const dateObj = parseMonthKey(mk);
      const md = ensureMonthData(store, mk, dateObj);
      if (grain === "week") {
        if (period < 1 || period > 53) {
          errors.push(`carros_detalle: semana fuera de rango (${period})`);
          continue;
        }
        const wk = String(period);
        if (!md.weekly[wk]) md.weekly[wk] = emptyCategoryRow();
        mergeCategoryRow(md.weekly[wk], row);
      } else {
        const dim = getDaysInMonth(dateObj);
        if (period < 1 || period > dim) {
          errors.push(`carros_detalle: día fuera de rango para ${mk} (${period})`);
          continue;
        }
        const dk = String(period);
        if (!md.daily[dk]) md.daily[dk] = emptyCategoryRow();
        mergeCategoryRow(md.daily[dk], row);
      }
      md.updatedAt = new Date().toISOString();
      n += 1;
    }
    return n;
  }

  function applySemaforoAnual(store, wb, errors) {
    let n = 0;
    for (const row of rowsFromSheet(wb, "semaforo_anual")) {
      const year = parseOptionalNumber(firstDefined(row, ["año", "ano", "year"]));
      const month = parseOptionalNumber(firstDefined(row, ["mes", "month"]));
      if (year === null || month === null) continue;
      if (month < 1 || month > 12) continue;
      const p = parseOptionalPercent(firstDefined(row, ["porcentaje", "pct"]));
      const pen = parseOptionalNumber(firstDefined(row, ["pendientes"]));
      if (p === null && pen === null) continue;
      const yearly = ensureSemaforoYearlyData(store, year);
      const k = String(month);
      if (!yearly[k]) yearly[k] = emptySemaforoPoint();
      mergePointRow(yearly[k], row);
      n += 1;
    }
    return n;
  }

  function applySemaforoDetalle(store, wb, errors) {
    let n = 0;
    for (const row of rowsFromSheet(wb, "semaforo_detalle")) {
      const mk = String(firstDefined(row, ["clave_mes", "month_key"]) || "").trim();
      if (!/^\d{4}-\d{2}$/.test(mk)) continue;
      const grain = parseGrain(firstDefined(row, ["tipo", "grain", "type"]));
      const period = parseOptionalNumber(firstDefined(row, ["periodo", "period"]));
      if (!grain || period === null) continue;
      if (parseOptionalPercent(firstDefined(row, ["porcentaje"])) === null
        && parseOptionalNumber(firstDefined(row, ["pendientes"])) === null) {
        continue;
      }
      const dateObj = parseMonthKey(mk);
      const md = ensureSemaforoMonthData(store, mk, dateObj);
      if (grain === "week") {
        if (period < 1 || period > 53) continue;
        const wk = String(period);
        if (!md.weekly[wk]) md.weekly[wk] = emptySemaforoPoint();
        mergePointRow(md.weekly[wk], row);
      } else {
        const dim = getDaysInMonth(dateObj);
        if (period < 1 || period > dim) continue;
        const dk = String(period);
        if (!md.daily[dk]) md.daily[dk] = emptySemaforoPoint();
        mergePointRow(md.daily[dk], row);
      }
      md.updatedAt = new Date().toISOString();
      n += 1;
    }
    return n;
  }

  function applyFlotaAnual(store, wb) {
    let n = 0;
    for (const row of rowsFromSheet(wb, "flota360_anual")) {
      const year = parseOptionalNumber(firstDefined(row, ["año", "ano", "year"]));
      const month = parseOptionalNumber(firstDefined(row, ["mes", "month"]));
      if (year === null || month === null) continue;
      if (month < 1 || month > 12) continue;
      const p = parseOptionalPercent(firstDefined(row, ["porcentaje"]));
      const pen = parseOptionalNumber(firstDefined(row, ["pendientes"]));
      if (p === null && pen === null) continue;
      const yearly = ensureFlota360YearlyData(store, year);
      const k = String(month);
      if (!yearly[k]) yearly[k] = emptyFlota360Point();
      mergePointRow(yearly[k], row);
      n += 1;
    }
    return n;
  }

  function applyFlotaDetalle(store, wb) {
    let n = 0;
    for (const row of rowsFromSheet(wb, "flota360_detalle")) {
      const mk = String(firstDefined(row, ["clave_mes", "month_key"]) || "").trim();
      if (!/^\d{4}-\d{2}$/.test(mk)) continue;
      const grain = parseGrain(firstDefined(row, ["tipo", "grain", "type"]));
      const period = parseOptionalNumber(firstDefined(row, ["periodo", "period"]));
      if (!grain || period === null) continue;
      if (parseOptionalPercent(firstDefined(row, ["porcentaje"])) === null
        && parseOptionalNumber(firstDefined(row, ["pendientes"])) === null) {
        continue;
      }
      const dateObj = parseMonthKey(mk);
      const md = ensureFlota360MonthData(store, mk, dateObj);
      if (grain === "week") {
        if (period < 1 || period > 53) continue;
        const wk = String(period);
        if (!md.weekly[wk]) md.weekly[wk] = emptyFlota360Point();
        mergePointRow(md.weekly[wk], row);
      } else {
        const dim = getDaysInMonth(dateObj);
        if (period < 1 || period > dim) continue;
        const dk = String(period);
        if (!md.daily[dk]) md.daily[dk] = emptyFlota360Point();
        mergePointRow(md.daily[dk], row);
      }
      md.updatedAt = new Date().toISOString();
      n += 1;
    }
    return n;
  }

  function applyMttoAnual(store, wb) {
    let n = 0;
    for (const row of rowsFromSheet(wb, "mtto_anual")) {
      const year = parseOptionalNumber(firstDefined(row, ["año", "ano", "year"]));
      const month = parseOptionalNumber(firstDefined(row, ["mes", "month"]));
      if (year === null || month === null) continue;
      if (month < 1 || month > 12) continue;
      const p = parseOptionalPercent(firstDefined(row, ["porcentaje"]));
      const pen = parseOptionalNumber(firstDefined(row, ["pendientes"]));
      if (p === null && pen === null) continue;
      const yearly = ensureMttoPreventivoYearlyData(store, year);
      const k = String(month);
      if (!yearly[k]) yearly[k] = emptyMttoPreventivoPoint();
      mergePointRow(yearly[k], row);
      n += 1;
    }
    return n;
  }

  function applyMttoDetalle(store, wb) {
    let n = 0;
    for (const row of rowsFromSheet(wb, "mtto_detalle")) {
      const mk = String(firstDefined(row, ["clave_mes", "month_key"]) || "").trim();
      if (!/^\d{4}-\d{2}$/.test(mk)) continue;
      const grain = parseGrain(firstDefined(row, ["tipo", "grain", "type"]));
      const period = parseOptionalNumber(firstDefined(row, ["periodo", "period"]));
      if (!grain || period === null) continue;
      if (parseOptionalPercent(firstDefined(row, ["porcentaje"])) === null
        && parseOptionalNumber(firstDefined(row, ["pendientes"])) === null) {
        continue;
      }
      const dateObj = parseMonthKey(mk);
      const md = ensureMttoPreventivoMonthData(store, mk, dateObj);
      if (grain === "week") {
        if (period < 1 || period > 53) continue;
        const wk = String(period);
        if (!md.weekly[wk]) md.weekly[wk] = emptyMttoPreventivoPoint();
        mergePointRow(md.weekly[wk], row);
      } else {
        const dim = getDaysInMonth(dateObj);
        if (period < 1 || period > dim) continue;
        const dk = String(period);
        if (!md.daily[dk]) md.daily[dk] = emptyMttoPreventivoPoint();
        mergePointRow(md.daily[dk], row);
      }
      md.updatedAt = new Date().toISOString();
      n += 1;
    }
    return n;
  }

  function applyWorkbookToStore(wb) {
    const store = getStore();
    const errors = [];
    let total = 0;
    total += applyCarrosUctAnual(store, wb, errors);
    total += applyCarrosTotalMes(store, wb, errors);
    total += applyCarrosDetalle(store, wb, errors);
    total += applySemaforoAnual(store, wb, errors);
    total += applySemaforoDetalle(store, wb, errors);
    total += applyFlotaAnual(store, wb);
    total += applyFlotaDetalle(store, wb);
    total += applyMttoAnual(store, wb);
    total += applyMttoDetalle(store, wb);
    saveStore(store);
    return { total, errors };
  }

  window.initImportExcel = function initImportExcel() {
    const input = document.getElementById("importExcelInput");
    const btn = document.getElementById("importExcelBtn");
    const msg = document.getElementById("importExcelMessage");
    if (!input || !btn || !msg) return;

    btn.addEventListener("click", () => {
      msg.textContent = "";
      msg.classList.remove("status-error");
      const file = input.files && input.files[0];
      if (!file) {
        msg.textContent = "Selecciona un archivo Excel (.xlsx).";
        msg.classList.add("status-error");
        return;
      }
      if (typeof XLSX === "undefined") {
        msg.textContent = "No se cargó la librería XLSX. Revisa la conexión o el script en la página.";
        msg.classList.add("status-error");
        return;
      }
      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const data = new Uint8Array(e.target.result);
          const wb = XLSX.read(data, { type: "array" });
          const { total, errors } = applyWorkbookToStore(wb);
          if (typeof window.refreshAllCaptureFromImport === "function") {
            window.refreshAllCaptureFromImport();
          }
          let text = total > 0
            ? `Importación lista: ${total} fila(s) aplicada(s).`
            : "No se importó ninguna fila (revisa encabezados y celdas con datos).";
          if (errors.length) {
            text += " Avisos: " + errors.slice(0, 5).join(" ");
            if (errors.length > 5) text += ` (+${errors.length - 5} más)`;
          }
          msg.textContent = text;
        } catch (err) {
          msg.textContent = "Error al leer el archivo: " + (err && err.message ? err.message : String(err));
          msg.classList.add("status-error");
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };
})();
