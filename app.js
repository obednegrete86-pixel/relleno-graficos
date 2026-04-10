const STORAGE_KEY = "settepi_uct_data_v1";
const GOAL_UCT = 18;
const CATEGORY_KEYS = ["lt5", "d6_30", "d31_60", "d61_100", "gt100"];
const CATEGORY_LABELS = {
  lt5: "<5 DIAS",
  d6_30: "6-30 DIAS",
  d31_60: "31-60 DIAS",
  d61_100: "61-100 DIAS",
  gt100: ">100 DIAS"
};
const CATEGORY_COLORS = {
  lt5: "#B5E6A2",
  d6_30: "#94DCF8",
  d31_60: "#FFFF00",
  d61_100: "#FFC000",
  gt100: "#FF0000"
};
const MONTH_LABELS_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const ISO_WEEKS_FULL = Array.from({ length: 53 }, (_, idx) => idx + 1);
const INDICATOR_OPTIONS = {
  carros: "Carros Taller",
  semaforo: "Semaforo de Llantas",
  flota360: "Evaluacion de Flota 360",
  mtto: "MTTO Preventivo"
};

function toMonthKey(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function parseMonthKey(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function getMonthLabel(dateObj) {
  return dateObj.toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric"
  }).replace(/^\w/, (c) => c.toUpperCase());
}

/** Select de mes para paginas de indicadores (Semaforo, Flota 360, etc.). */
function fillIndicatorMonthSelect(selectNode, year, selectedMonth) {
  if (!selectNode) return;
  selectNode.innerHTML = "";
  MONTH_LABELS_SHORT.forEach((label, idx) => {
    const option = document.createElement("option");
    option.value = String(idx + 1);
    option.textContent = `${label} ${year}`;
    if (idx + 1 === selectedMonth) option.selected = true;
    selectNode.appendChild(option);
  });
}

function getCurrentAndPreviousMonth() {
  const currentDate = new Date();
  const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const previousMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  return {
    currentKey: toMonthKey(currentMonthStart),
    previousKey: toMonthKey(previousMonthStart),
    currentDate: currentMonthStart,
    previousDate: previousMonthStart
  };
}

function monthHasData(monthData) {
  if (!monthData) return false;
  if (Number(monthData.monthlyTotalUCT || 0) > 0) return true;
  if (Object.values(monthData.weekly || {}).some((row) => sumCategoryRow(row) > 0)) return true;
  if (Object.values(monthData.daily || {}).some((row) => sumCategoryRow(row) > 0)) return true;
  return false;
}

function getOperationalMonths(store) {
  const now = new Date();
  const currentDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const previousKey = toMonthKey(previousDate);
  const currentKey = toMonthKey(currentDate);
  const nextKey = toMonthKey(nextDate);
  const useCurrentAsReference = !monthHasData(store[previousKey]);

  if (useCurrentAsReference) {
    return {
      referenceDate: currentDate,
      referenceKey: currentKey,
      captureDate: nextDate,
      captureKey: nextKey
    };
  }

  return {
    referenceDate: previousDate,
    referenceKey: previousKey,
    captureDate: currentDate,
    captureKey: currentKey
  };
}

function getDaysInMonth(dateObj) {
  return new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0).getDate();
}

function getMonthISOWeeks(dateObj) {
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth();
  const lastDay = getDaysInMonth(dateObj);
  const set = new Set();

  for (let d = 1; d <= lastDay; d += 1) {
    set.add(getISOWeekNumber(new Date(year, month, d)));
  }

  return Array.from(set).sort((a, b) => a - b);
}

function getISOWeekNumber(dateObj) {
  const date = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

function getStore() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch (err) {
    return {};
  }
}

function saveStore(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function emptyCategoryRow() {
  return { lt5: 0, d6_30: 0, d31_60: 0, d61_100: 0, gt100: 0 };
}

function ensureMonthData(store, monthKey, monthDate) {
  if (!store[monthKey]) {
    const days = getDaysInMonth(monthDate);
    const weekly = {};
    const daily = {};

    ISO_WEEKS_FULL.forEach((week) => { weekly[String(week)] = emptyCategoryRow(); });
    for (let i = 1; i <= days; i += 1) {
      daily[String(i)] = emptyCategoryRow();
    }

    store[monthKey] = {
      monthlyTotalUCT: 0,
      weekly,
      daily,
      status: "open",
      updatedAt: new Date().toISOString()
    };
  } else {
    ISO_WEEKS_FULL.forEach((week) => {
      const key = String(week);
      if (!store[monthKey].weekly[key]) store[monthKey].weekly[key] = emptyCategoryRow();
    });
  }

  return store[monthKey];
}

function ensureYearlyData(store, year) {
  const y = String(year);
  if (!store.__yearly) store.__yearly = {};
  if (!store.__yearly[y]) {
    store.__yearly[y] = {};
    for (let m = 1; m <= 12; m += 1) {
      store.__yearly[y][String(m)] = 0;
    }
  } else {
    for (let m = 1; m <= 12; m += 1) {
      const key = String(m);
      if (typeof store.__yearly[y][key] !== "number") {
        store.__yearly[y][key] = Number(store.__yearly[y][key] || 0);
      }
    }
  }
  return store.__yearly[y];
}

function getYearlySeries(store, year) {
  const yearly = ensureYearlyData(store, year);
  const labels = [...MONTH_LABELS_SHORT];
  const values = labels.map((_, idx) => Number(yearly[String(idx + 1)] || 0));
  return { labels, values };
}

function sumCategoryRow(row) {
  return CATEGORY_KEYS.reduce((acc, key) => acc + Number(row[key] || 0), 0);
}

function getContrastColor(hexColor) {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#0f172a" : "#ffffff";
}

function emptySemaforoPoint() {
  return { porcentaje: 0, pendientes: 0 };
}

function ensureSemaforoMonthData(store, monthKey, monthDate) {
  if (!store.__semaforo) store.__semaforo = {};
  if (!store.__semaforo[monthKey]) {
    const days = getDaysInMonth(monthDate);
    const weekly = {};
    const daily = {};
    ISO_WEEKS_FULL.forEach((week) => { weekly[String(week)] = emptySemaforoPoint(); });
    for (let i = 1; i <= days; i += 1) {
      daily[String(i)] = emptySemaforoPoint();
    }
    store.__semaforo[monthKey] = {
      weekly,
      daily,
      status: "open",
      updatedAt: new Date().toISOString()
    };
  } else {
    ISO_WEEKS_FULL.forEach((week) => {
      const key = String(week);
      if (!store.__semaforo[monthKey].weekly[key]) store.__semaforo[monthKey].weekly[key] = emptySemaforoPoint();
    });
  }
  return store.__semaforo[monthKey];
}

function ensureSemaforoYearlyData(store, year) {
  const y = String(year);
  if (!store.__semaforo_yearly) store.__semaforo_yearly = {};
  if (!store.__semaforo_yearly[y]) {
    store.__semaforo_yearly[y] = {};
    for (let m = 1; m <= 12; m += 1) {
      store.__semaforo_yearly[y][String(m)] = emptySemaforoPoint();
    }
  } else {
    for (let m = 1; m <= 12; m += 1) {
      const k = String(m);
      if (!store.__semaforo_yearly[y][k]) store.__semaforo_yearly[y][k] = emptySemaforoPoint();
    }
  }
  return store.__semaforo_yearly[y];
}

function getSemaforoYearlySeries(store, year) {
  const yearly = ensureSemaforoYearlyData(store, year);
  const labels = [...MONTH_LABELS_SHORT];
  return {
    labels,
    porcentaje: labels.map((_, idx) => Number((yearly[String(idx + 1)] || emptySemaforoPoint()).porcentaje || 0)),
    pendientes: labels.map((_, idx) => Number((yearly[String(idx + 1)] || emptySemaforoPoint()).pendientes || 0))
  };
}

function emptyFlota360Point() {
  return { porcentaje: 0, pendientes: 0 };
}

function ensureFlota360MonthData(store, monthKey, monthDate) {
  if (!store.__flota360) store.__flota360 = {};
  if (!store.__flota360[monthKey]) {
    const days = getDaysInMonth(monthDate);
    const weekly = {};
    const daily = {};
    ISO_WEEKS_FULL.forEach((week) => {
      weekly[String(week)] = emptyFlota360Point();
    });
    for (let i = 1; i <= days; i += 1) {
      daily[String(i)] = emptyFlota360Point();
    }
    store.__flota360[monthKey] = {
      weekly,
      daily,
      status: "open",
      updatedAt: new Date().toISOString()
    };
  } else {
    ISO_WEEKS_FULL.forEach((week) => {
      const key = String(week);
      if (!store.__flota360[monthKey].weekly[key]) store.__flota360[monthKey].weekly[key] = emptyFlota360Point();
    });
  }
  return store.__flota360[monthKey];
}

function ensureFlota360YearlyData(store, year) {
  const y = String(year);
  if (!store.__flota360_yearly) store.__flota360_yearly = {};
  if (!store.__flota360_yearly[y]) {
    store.__flota360_yearly[y] = {};
    for (let m = 1; m <= 12; m += 1) {
      store.__flota360_yearly[y][String(m)] = emptyFlota360Point();
    }
  } else {
    for (let m = 1; m <= 12; m += 1) {
      const k = String(m);
      if (!store.__flota360_yearly[y][k]) store.__flota360_yearly[y][k] = emptyFlota360Point();
    }
  }
  return store.__flota360_yearly[y];
}

function getFlota360YearlySeries(store, year) {
  const yearly = ensureFlota360YearlyData(store, year);
  const labels = [...MONTH_LABELS_SHORT];
  return {
    labels,
    porcentaje: labels.map((_, idx) => Number((yearly[String(idx + 1)] || emptyFlota360Point()).porcentaje || 0)),
    pendientes: labels.map((_, idx) => Number((yearly[String(idx + 1)] || emptyFlota360Point()).pendientes || 0))
  };
}

function emptyMttoPreventivoPoint() {
  return { porcentaje: 0, pendientes: 0 };
}

function ensureMttoPreventivoMonthData(store, monthKey, monthDate) {
  if (!store.__mtto_preventivo) store.__mtto_preventivo = {};
  if (!store.__mtto_preventivo[monthKey]) {
    const days = getDaysInMonth(monthDate);
    const weekly = {};
    const daily = {};
    ISO_WEEKS_FULL.forEach((week) => {
      weekly[String(week)] = emptyMttoPreventivoPoint();
    });
    for (let i = 1; i <= days; i += 1) {
      daily[String(i)] = emptyMttoPreventivoPoint();
    }
    store.__mtto_preventivo[monthKey] = {
      weekly,
      daily,
      status: "open",
      updatedAt: new Date().toISOString()
    };
  } else {
    ISO_WEEKS_FULL.forEach((week) => {
      const key = String(week);
      if (!store.__mtto_preventivo[monthKey].weekly[key]) {
        store.__mtto_preventivo[monthKey].weekly[key] = emptyMttoPreventivoPoint();
      }
    });
  }
  return store.__mtto_preventivo[monthKey];
}

function ensureMttoPreventivoYearlyData(store, year) {
  const y = String(year);
  if (!store.__mtto_preventivo_yearly) store.__mtto_preventivo_yearly = {};
  if (!store.__mtto_preventivo_yearly[y]) {
    store.__mtto_preventivo_yearly[y] = {};
    for (let m = 1; m <= 12; m += 1) {
      store.__mtto_preventivo_yearly[y][String(m)] = emptyMttoPreventivoPoint();
    }
  } else {
    for (let m = 1; m <= 12; m += 1) {
      const k = String(m);
      if (!store.__mtto_preventivo_yearly[y][k]) store.__mtto_preventivo_yearly[y][k] = emptyMttoPreventivoPoint();
    }
  }
  return store.__mtto_preventivo_yearly[y];
}

function getMttoPreventivoYearlySeries(store, year) {
  const yearly = ensureMttoPreventivoYearlyData(store, year);
  const labels = [...MONTH_LABELS_SHORT];
  return {
    labels,
    porcentaje: labels.map((_, idx) => Number((yearly[String(idx + 1)] || emptyMttoPreventivoPoint()).porcentaje || 0)),
    pendientes: labels.map((_, idx) => Number((yearly[String(idx + 1)] || emptyMttoPreventivoPoint()).pendientes || 0))
  };
}

/** Listas de unidades por indicador y mes (Captura + paneles de lectura). */
function ensureUnidadesStore(store) {
  if (!store.__unidades) store.__unidades = {};
  return store.__unidades;
}

function getUnidadesMes(store, indicador, monthKey) {
  const root = ensureUnidadesStore(store);
  if (!root[indicador]) root[indicador] = {};
  if (!root[indicador][monthKey]) {
    root[indicador][monthKey] = { enTallerText: "", pendientesText: "" };
  }
  return root[indicador][monthKey];
}

function setUnidadesMesTexts(store, indicador, monthKey, enTallerText, pendientesText) {
  const e = getUnidadesMes(store, indicador, monthKey);
  e.enTallerText = enTallerText != null ? String(enTallerText) : "";
  e.pendientesText = pendientesText != null ? String(pendientesText) : "";
}

/** Rango de días en taller → clave de categoría del gráfico apilado Carros. */
function diasEnTallerToCategory(dias) {
  const d = Number(dias);
  if (!Number.isFinite(d) || d < 0) return null;
  if (d < 5) return "lt5";
  if (d <= 30) return "d6_30";
  if (d <= 60) return "d31_60";
  if (d <= 100) return "d61_100";
  return "gt100";
}
