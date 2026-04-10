function buildCapturePage() {
  initCaptureAuth();
  if (!isCaptureAuthenticated()) return;

  const indicatorSelect = document.getElementById("captureIndicatorSelect");
  const carrosSection = document.getElementById("carrosCaptureSection");
  const semaforoSection = document.getElementById("semaforoCaptureSection");
  const flota360Section = document.getElementById("flota360CaptureSection");
  const mttoPreventivoSection = document.getElementById("mttoPreventivoCaptureSection");

  const carrosApi = initCarrosCapture();
  const semaforoApi = initSemaforoCapture();
  const flota360Api = initFlota360Capture();
  const mttoApi = initMttoPreventivoCapture();

  window.refreshAllCaptureFromImport = function refreshAllCaptureFromImport() {
    carrosApi.refresh();
    semaforoApi.refresh();
    flota360Api.refresh();
    mttoApi.refresh();
  };

  if (typeof initImportExcel === "function") initImportExcel();
  if (typeof window.initUnidadesCaptureUI === "function") window.initUnidadesCaptureUI();

  function switchSection(indicatorKey) {
    carrosSection.classList.toggle("active", indicatorKey === "carros");
    semaforoSection.classList.toggle("active", indicatorKey === "semaforo");
    flota360Section.classList.toggle("active", indicatorKey === "flota360");
    if (mttoPreventivoSection) {
      mttoPreventivoSection.classList.toggle("active", indicatorKey === "mtto");
    }
    if (indicatorKey === "carros") carrosApi.refresh();
    if (typeof window.reloadUnidadesCaptureTextareas === "function") window.reloadUnidadesCaptureTextareas();
  }

  indicatorSelect.addEventListener("change", (event) => switchSection(event.target.value));
  switchSection(indicatorSelect.value);
}

function initCaptureAuth() {
  const loginContainer = document.getElementById("loginContainer");
  const captureApp = document.getElementById("captureApp");
  const loginBtn = document.getElementById("loginBtn");
  const userInput = document.getElementById("loginUser");
  const passInput = document.getElementById("loginPass");
  const message = document.getElementById("loginMessage");

  function showApp() {
    loginContainer.style.display = "none";
    captureApp.style.display = "block";
  }

  function showLogin() {
    loginContainer.style.display = "block";
    captureApp.style.display = "none";
  }

  if (isCaptureAuthenticated()) {
    showApp();
    return;
  }

  showLogin();
  loginBtn.addEventListener("click", () => {
    const user = (userInput.value || "").trim();
    const pass = passInput.value || "";
    if (user === "Settepi" && pass === "$eTTep1") {
      sessionStorage.setItem("capture_auth_ok", "1");
      message.textContent = "";
      showApp();
      buildCapturePage();
    } else {
      message.textContent = "Usuario o contraseña incorrectos.";
    }
  });
}

function isCaptureAuthenticated() {
  return sessionStorage.getItem("capture_auth_ok") === "1";
}

/** Actualiza el objeto `store` en memoria con lo último de localStorage (p. ej. tras importar Excel). */
function syncStoreFromLocal(store) {
  const fresh = getStore();
  for (const k of Object.keys(store)) delete store[k];
  Object.assign(store, fresh);
}

function initCarrosCapture() {
  const store = getStore();
  const today = new Date();
  const year = today.getFullYear();
  const select = document.getElementById("captureMonthSelect");
  let selectedDate = new Date(year, today.getMonth(), 1);
  let captureMonth = null;
  fillMonthSelect(select, year, selectedDate.getMonth() + 1);

  function refreshCaptureView() {
    syncStoreFromLocal(store);
    const captureKey = toMonthKey(selectedDate);
    const referenceDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1);
    const referenceKey = toMonthKey(referenceDate);
    captureMonth = ensureMonthData(store, captureKey, selectedDate);
    const referenceMonth = ensureMonthData(store, referenceKey, referenceDate);
    const currentYearly = ensureYearlyData(store, selectedDate.getFullYear());
    saveStore(store);

    document.getElementById("currentMonthLabel").textContent = getMonthLabel(selectedDate);
    document.getElementById("previousMonthLabel").textContent = getMonthLabel(referenceDate);
    document.getElementById("statusLabel").textContent = captureMonth.status === "closed" ? "Cerrado" : "Abierto";
    renderMonthlyGrid(currentYearly, selectedDate.getMonth() + 1);
    renderPreviousSummary(referenceMonth, store, referenceDate);
    renderWeeklyTable(captureMonth);
    renderDailyTable(captureMonth, selectedDate);
  }

  refreshCaptureView();
  select.addEventListener("change", (event) => {
    selectedDate = new Date(year, Number(event.target.value) - 1, 1);
    refreshCaptureView();
    setStatus(`Mes activo: ${getMonthLabel(selectedDate)}.`);
    if (typeof window.reloadUnidadesCaptureTextareas === "function") window.reloadUnidadesCaptureTextareas();
  });
  document.getElementById("saveBtn").addEventListener("click", () => {
    if (captureMonth.status === "closed") return setStatus("Este mes ya está cerrado. No se permiten cambios.");
    const currentYearly = ensureYearlyData(store, selectedDate.getFullYear());
    readFormIntoMonth(store, captureMonth, selectedDate);
    captureMonth.monthlyTotalUCT = Number(currentYearly[String(selectedDate.getMonth() + 1)] || 0);
    captureMonth.updatedAt = new Date().toISOString();
    saveStore(store);
    setStatus(`Datos guardados para ${getMonthLabel(selectedDate)}.`);
  });
  document.getElementById("closeBtn").addEventListener("click", () => {
    const currentYearly = ensureYearlyData(store, selectedDate.getFullYear());
    readFormIntoMonth(store, captureMonth, selectedDate);
    captureMonth.monthlyTotalUCT = Number(currentYearly[String(selectedDate.getMonth() + 1)] || 0);
    captureMonth.status = "closed";
    captureMonth.updatedAt = new Date().toISOString();
    saveStore(store);
    document.getElementById("statusLabel").textContent = "Cerrado";
    setStatus(`Mes ${getMonthLabel(selectedDate)} cerrado.`);
  });
  document.getElementById("reopenBtn").addEventListener("click", () => {
    captureMonth.status = "open";
    captureMonth.updatedAt = new Date().toISOString();
    saveStore(store);
    document.getElementById("statusLabel").textContent = "Abierto";
    setStatus(`Mes ${getMonthLabel(selectedDate)} reabierto.`);
  });
  return { refresh: refreshCaptureView };
}

function fillMonthSelect(selectNode, year, selectedMonth) {
  selectNode.innerHTML = "";
  MONTH_LABELS_SHORT.forEach((label, idx) => {
    const monthNumber = idx + 1;
    const option = document.createElement("option");
    option.value = String(monthNumber);
    option.textContent = `${label} ${year}`;
    if (monthNumber === selectedMonth) option.selected = true;
    selectNode.appendChild(option);
  });
}

function renderPreviousSummary(previous, store, previousDate) {
  const previousYearly = ensureYearlyData(store, previousDate.getFullYear());
  const prevMonthNumber = previousDate.getMonth() + 1;
  const totals = {
    monthly: Number(previousYearly[String(prevMonthNumber)] || previous.monthlyTotalUCT || 0),
    weekly: Object.values(previous.weekly || {}).reduce((acc, row) => acc + sumCategoryRow(row), 0),
    daily: Object.values(previous.daily || {}).reduce((acc, row) => acc + sumCategoryRow(row), 0)
  };

  const node = document.getElementById("previousSummary");
  node.innerHTML = `
    <div class="chip">Mensual: <strong>${totals.monthly}</strong> UCT</div>
    <div class="chip">Suma semanal: <strong>${totals.weekly}</strong> UCT</div>
    <div class="chip">Suma diaria: <strong>${totals.daily}</strong> UCT</div>
    <div class="chip">Estado: <strong>${previous.status === "closed" ? "Cerrado" : "Abierto"}</strong></div>
  `;
}

function renderMonthlyGrid(yearlyData, currentMonthNumber) {
  const grid = document.getElementById("monthlyGrid");
  grid.innerHTML = "";
  MONTH_LABELS_SHORT.forEach((label, idx) => {
    const monthNum = idx + 1;
    const wrapper = document.createElement("div");
    wrapper.className = "monthly-item";
    wrapper.innerHTML = `
      <label for="m-${monthNum}">${label}</label>
      <input id="m-${monthNum}" type="number" min="0" step="1" value="${Number(yearlyData[String(monthNum)] || 0)}" data-table="monthly" data-month="${monthNum}">
    `;
    if (monthNum !== currentMonthNumber) {
      wrapper.querySelector("label").classList.add("subtle");
    }
    grid.appendChild(wrapper);
  });
}

function renderWeeklyTable(current) {
  const weeks = ISO_WEEKS_FULL;
  const tbody = document.getElementById("weeklyTbody");
  tbody.innerHTML = "";

  weeks.forEach((weekNo) => {
    const row = current.weekly[String(weekNo)] || emptyCategoryRow();
    current.weekly[String(weekNo)] = row;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${weekNo}</td>
      ${CATEGORY_KEYS.map((key) => `<td><input type="number" min="0" step="1" value="${Number(row[key] || 0)}" data-table="weekly" data-row="${weekNo}" data-key="${key}"></td>`).join("")}
    `;
    tbody.appendChild(tr);
  });
}

function renderDailyTable(current, currentDate) {
  const days = getDaysInMonth(currentDate);
  const tbody = document.getElementById("dailyTbody");
  tbody.innerHTML = "";

  for (let day = 1; day <= days; day += 1) {
    const row = current.daily[String(day)] || emptyCategoryRow();
    current.daily[String(day)] = row;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${day}</td>
      ${CATEGORY_KEYS.map((key) => `<td><input type="number" min="0" step="1" value="${Number(row[key] || 0)}" data-table="daily" data-row="${day}" data-key="${key}"></td>`).join("")}
    `;
    tbody.appendChild(tr);
  }
}

function readFormIntoMonth(store, current, currentDate) {
  const yearly = ensureYearlyData(store, currentDate.getFullYear());
  document.querySelectorAll("input[data-table='monthly']").forEach((input) => {
    const month = input.dataset.month;
    yearly[month] = sanitizeNumber(input.value);
  });
  current.monthlyTotalUCT = Number(yearly[String(currentDate.getMonth() + 1)] || 0);

  document.querySelectorAll("input[data-table='weekly']").forEach((input) => {
    const week = input.dataset.row;
    const key = input.dataset.key;
    if (!current.weekly[week]) current.weekly[week] = emptyCategoryRow();
    current.weekly[week][key] = sanitizeNumber(input.value);
  });

  document.querySelectorAll("input[data-table='daily']").forEach((input) => {
    const day = input.dataset.row;
    const key = input.dataset.key;
    if (!current.daily[day]) current.daily[day] = emptyCategoryRow();
    current.daily[day][key] = sanitizeNumber(input.value);
  });
}

function sanitizeNumber(rawValue) {
  const n = Number(rawValue);
  if (Number.isNaN(n) || n < 0) return 0;
  return Math.round(n);
}

function setStatus(message) {
  document.getElementById("statusMessage").textContent = message;
}

function initSemaforoCapture() {
  const select = document.getElementById("semaforoCaptureMonthSelect");
  if (!select) return { refresh: () => {} };

  const store = getStore();
  const today = new Date();
  const year = today.getFullYear();
  let selectedDate = new Date(year, today.getMonth(), 1);
  fillMonthSelect(select, year, selectedDate.getMonth() + 1);

  function renderSemaforoCapture() {
    syncStoreFromLocal(store);
    const monthKey = toMonthKey(selectedDate);
    const monthData = ensureSemaforoMonthData(store, monthKey, selectedDate);
    const yearly = ensureSemaforoYearlyData(store, selectedDate.getFullYear());
    saveStore(store);
    document.getElementById("semaforoCurrentMonthLabel").textContent = getMonthLabel(selectedDate);
    renderSemaforoMonthlyTable(yearly);
    renderSemaforoWeeklyTable(monthData);
    renderSemaforoDailyTable(monthData, selectedDate);
  }

  renderSemaforoCapture();
  select.addEventListener("change", (event) => {
    selectedDate = new Date(year, Number(event.target.value) - 1, 1);
    renderSemaforoCapture();
    document.getElementById("semaforoStatusMessage").textContent = `Mes activo: ${getMonthLabel(selectedDate)}.`;
    if (typeof window.reloadUnidadesCaptureTextareas === "function") window.reloadUnidadesCaptureTextareas();
  });
  document.getElementById("saveSemaforoBtn").addEventListener("click", () => {
    const monthData = ensureSemaforoMonthData(store, toMonthKey(selectedDate), selectedDate);
    const yearly = ensureSemaforoYearlyData(store, selectedDate.getFullYear());
    readSemaforoForm(yearly, monthData, selectedDate);
    monthData.updatedAt = new Date().toISOString();
    saveStore(store);
    document.getElementById("semaforoStatusMessage").textContent = `Semaforo guardado para ${getMonthLabel(selectedDate)}.`;
  });
  return { refresh: renderSemaforoCapture };
}

function initFlota360Capture() {
  const select = document.getElementById("flota360CaptureMonthSelect");
  if (!select) return { refresh: () => {} };

  const store = getStore();
  const today = new Date();
  const year = today.getFullYear();
  let selectedDate = new Date(year, today.getMonth(), 1);
  fillMonthSelect(select, year, selectedDate.getMonth() + 1);

  function renderFlota360Capture() {
    syncStoreFromLocal(store);
    const monthKey = toMonthKey(selectedDate);
    const monthData = ensureFlota360MonthData(store, monthKey, selectedDate);
    const yearly = ensureFlota360YearlyData(store, selectedDate.getFullYear());
    saveStore(store);
    document.getElementById("flota360CurrentMonthLabel").textContent = getMonthLabel(selectedDate);
    renderFlota360MonthlyTable(yearly);
    renderFlota360WeeklyTable(monthData);
    renderFlota360DailyTable(monthData, selectedDate);
  }

  renderFlota360Capture();
  select.addEventListener("change", (event) => {
    selectedDate = new Date(year, Number(event.target.value) - 1, 1);
    renderFlota360Capture();
    document.getElementById("flota360StatusMessage").textContent = `Mes activo: ${getMonthLabel(selectedDate)}.`;
    if (typeof window.reloadUnidadesCaptureTextareas === "function") window.reloadUnidadesCaptureTextareas();
  });
  document.getElementById("saveFlota360Btn").addEventListener("click", () => {
    const monthData = ensureFlota360MonthData(store, toMonthKey(selectedDate), selectedDate);
    const yearly = ensureFlota360YearlyData(store, selectedDate.getFullYear());
    readFlota360Form(yearly, monthData, selectedDate);
    monthData.updatedAt = new Date().toISOString();
    saveStore(store);
    document.getElementById("flota360StatusMessage").textContent = `Evaluacion Flota 360 guardada para ${getMonthLabel(selectedDate)}.`;
  });
  return { refresh: renderFlota360Capture };
}

function renderFlota360MonthlyTable(yearly) {
  const grid = document.getElementById("flota360MonthlyGrid");
  grid.innerHTML = "";
  MONTH_LABELS_SHORT.forEach((label, idx) => {
    const month = String(idx + 1);
    const row = yearly[month] || emptyFlota360Point();
    const card = document.createElement("div");
    card.className = "monthly-item";
    card.innerHTML = `
      <label>${label}</label>
      <label class="subtle">Porcentaje (%)</label>
      <input type="number" min="0" max="100" step="1" value="${Number(row.porcentaje || 0)}" data-table="f360-monthly" data-row="${month}" data-key="porcentaje">
    `;
    grid.appendChild(card);
  });
}

function renderFlota360WeeklyTable(monthData) {
  const tbody = document.getElementById("flota360WeeklyTbody");
  tbody.innerHTML = "";
  ISO_WEEKS_FULL.forEach((weekNo) => {
    const row = monthData.weekly[String(weekNo)] || emptyFlota360Point();
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${weekNo}</td>
      <td><input type="number" min="0" max="100" step="1" value="${Number(row.porcentaje || 0)}" data-table="f360-weekly" data-row="${weekNo}" data-key="porcentaje"></td>
      <td><input type="number" min="0" step="1" value="${Number(row.pendientes || 0)}" data-table="f360-weekly" data-row="${weekNo}" data-key="pendientes"></td>`;
    tbody.appendChild(tr);
  });
}

function renderFlota360DailyTable(monthData, monthDate) {
  const tbody = document.getElementById("flota360DailyTbody");
  tbody.innerHTML = "";
  const days = getDaysInMonth(monthDate);
  for (let day = 1; day <= days; day += 1) {
    const row = monthData.daily[String(day)] || emptyFlota360Point();
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${day}</td>
      <td><input type="number" min="0" max="100" step="1" value="${Number(row.porcentaje || 0)}" data-table="f360-daily" data-row="${day}" data-key="porcentaje"></td>
      <td><input type="number" min="0" step="1" value="${Number(row.pendientes || 0)}" data-table="f360-daily" data-row="${day}" data-key="pendientes"></td>`;
    tbody.appendChild(tr);
  }
}

function readFlota360Form(yearly, monthData, selectedDate) {
  document.querySelectorAll("input[data-table='f360-monthly']").forEach((input) => {
    const row = input.dataset.row;
    const key = input.dataset.key;
    if (!yearly[row]) yearly[row] = emptyFlota360Point();
    yearly[row][key] = sanitizeNumber(input.value);
  });
  document.querySelectorAll("input[data-table='f360-weekly']").forEach((input) => {
    const row = input.dataset.row;
    const key = input.dataset.key;
    if (!monthData.weekly[row]) monthData.weekly[row] = emptyFlota360Point();
    monthData.weekly[row][key] = sanitizeNumber(input.value);
  });
  document.querySelectorAll("input[data-table='f360-daily']").forEach((input) => {
    const row = input.dataset.row;
    const key = input.dataset.key;
    if (!monthData.daily[row]) monthData.daily[row] = emptyFlota360Point();
    monthData.daily[row][key] = sanitizeNumber(input.value);
  });
  const monthNum = String(selectedDate.getMonth() + 1);
  if (!yearly[monthNum]) yearly[monthNum] = emptyFlota360Point();
}

function initMttoPreventivoCapture() {
  const select = document.getElementById("mttoPreventivoCaptureMonthSelect");
  if (!select) return { refresh: () => {} };

  const store = getStore();
  const today = new Date();
  const year = today.getFullYear();
  let selectedDate = new Date(year, today.getMonth(), 1);
  fillMonthSelect(select, year, selectedDate.getMonth() + 1);

  function renderMttoPreventivoCapture() {
    syncStoreFromLocal(store);
    const monthKey = toMonthKey(selectedDate);
    const monthData = ensureMttoPreventivoMonthData(store, monthKey, selectedDate);
    const yearly = ensureMttoPreventivoYearlyData(store, selectedDate.getFullYear());
    saveStore(store);
    document.getElementById("mttoPreventivoCurrentMonthLabel").textContent = getMonthLabel(selectedDate);
    renderMttoPreventivoMonthlyTable(yearly);
    renderMttoPreventivoWeeklyTable(monthData);
    renderMttoPreventivoDailyTable(monthData, selectedDate);
  }

  renderMttoPreventivoCapture();
  select.addEventListener("change", (event) => {
    selectedDate = new Date(year, Number(event.target.value) - 1, 1);
    renderMttoPreventivoCapture();
    document.getElementById("mttoPreventivoStatusMessage").textContent = `Mes activo: ${getMonthLabel(selectedDate)}.`;
    if (typeof window.reloadUnidadesCaptureTextareas === "function") window.reloadUnidadesCaptureTextareas();
  });
  document.getElementById("saveMttoPreventivoBtn").addEventListener("click", () => {
    const monthData = ensureMttoPreventivoMonthData(store, toMonthKey(selectedDate), selectedDate);
    const yearly = ensureMttoPreventivoYearlyData(store, selectedDate.getFullYear());
    readMttoPreventivoForm(yearly, monthData, selectedDate);
    monthData.updatedAt = new Date().toISOString();
    saveStore(store);
    document.getElementById("mttoPreventivoStatusMessage").textContent = `MTTO Preventivo guardado para ${getMonthLabel(selectedDate)}.`;
  });
  return { refresh: renderMttoPreventivoCapture };
}

function renderMttoPreventivoMonthlyTable(yearly) {
  const grid = document.getElementById("mttoPreventivoMonthlyGrid");
  if (!grid) return;
  grid.innerHTML = "";
  MONTH_LABELS_SHORT.forEach((label, idx) => {
    const month = String(idx + 1);
    const row = yearly[month] || emptyMttoPreventivoPoint();
    const card = document.createElement("div");
    card.className = "monthly-item";
    card.innerHTML = `
      <label>${label}</label>
      <label class="subtle">Porcentaje (%)</label>
      <input type="number" min="0" max="100" step="1" value="${Number(row.porcentaje || 0)}" data-table="mtto-monthly" data-row="${month}" data-key="porcentaje">
    `;
    grid.appendChild(card);
  });
}

function renderMttoPreventivoWeeklyTable(monthData) {
  const tbody = document.getElementById("mttoPreventivoWeeklyTbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  ISO_WEEKS_FULL.forEach((weekNo) => {
    const row = monthData.weekly[String(weekNo)] || emptyMttoPreventivoPoint();
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${weekNo}</td>
      <td><input type="number" min="0" max="100" step="1" value="${Number(row.porcentaje || 0)}" data-table="mtto-weekly" data-row="${weekNo}" data-key="porcentaje"></td>
      <td><input type="number" min="0" step="1" value="${Number(row.pendientes || 0)}" data-table="mtto-weekly" data-row="${weekNo}" data-key="pendientes"></td>`;
    tbody.appendChild(tr);
  });
}

function renderMttoPreventivoDailyTable(monthData, monthDate) {
  const tbody = document.getElementById("mttoPreventivoDailyTbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  const days = getDaysInMonth(monthDate);
  for (let day = 1; day <= days; day += 1) {
    const row = monthData.daily[String(day)] || emptyMttoPreventivoPoint();
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${day}</td>
      <td><input type="number" min="0" max="100" step="1" value="${Number(row.porcentaje || 0)}" data-table="mtto-daily" data-row="${day}" data-key="porcentaje"></td>
      <td><input type="number" min="0" step="1" value="${Number(row.pendientes || 0)}" data-table="mtto-daily" data-row="${day}" data-key="pendientes"></td>`;
    tbody.appendChild(tr);
  }
}

function readMttoPreventivoForm(yearly, monthData, selectedDate) {
  document.querySelectorAll("input[data-table='mtto-monthly']").forEach((input) => {
    const row = input.dataset.row;
    const key = input.dataset.key;
    if (!yearly[row]) yearly[row] = emptyMttoPreventivoPoint();
    yearly[row][key] = sanitizeNumber(input.value);
  });
  document.querySelectorAll("input[data-table='mtto-weekly']").forEach((input) => {
    const row = input.dataset.row;
    const key = input.dataset.key;
    if (!monthData.weekly[row]) monthData.weekly[row] = emptyMttoPreventivoPoint();
    monthData.weekly[row][key] = sanitizeNumber(input.value);
  });
  document.querySelectorAll("input[data-table='mtto-daily']").forEach((input) => {
    const row = input.dataset.row;
    const key = input.dataset.key;
    if (!monthData.daily[row]) monthData.daily[row] = emptyMttoPreventivoPoint();
    monthData.daily[row][key] = sanitizeNumber(input.value);
  });
  const monthNum = String(selectedDate.getMonth() + 1);
  if (!yearly[monthNum]) yearly[monthNum] = emptyMttoPreventivoPoint();
}

function renderSemaforoMonthlyTable(yearly) {
  const grid = document.getElementById("semaforoMonthlyGrid");
  grid.innerHTML = "";
  MONTH_LABELS_SHORT.forEach((label, idx) => {
    const month = String(idx + 1);
    const row = yearly[month] || emptySemaforoPoint();
    const card = document.createElement("div");
    card.className = "monthly-item";
    card.innerHTML = `
      <label>${label}</label>
      <label class="subtle">Porcentaje (%)</label>
      <input type="number" min="0" max="100" step="1" value="${Number(row.porcentaje || 0)}" data-table="s-monthly" data-row="${month}" data-key="porcentaje">
    `;
    grid.appendChild(card);
  });
}

function renderSemaforoWeeklyTable(monthData) {
  const tbody = document.getElementById("semaforoWeeklyTbody");
  tbody.innerHTML = "";
  ISO_WEEKS_FULL.forEach((weekNo) => {
    const row = monthData.weekly[String(weekNo)] || emptySemaforoPoint();
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${weekNo}</td>
      <td><input type="number" min="0" max="100" step="1" value="${Number(row.porcentaje || 0)}" data-table="s-weekly" data-row="${weekNo}" data-key="porcentaje"></td>
      <td><input type="number" min="0" step="1" value="${Number(row.pendientes || 0)}" data-table="s-weekly" data-row="${weekNo}" data-key="pendientes"></td>`;
    tbody.appendChild(tr);
  });
}

function renderSemaforoDailyTable(monthData, monthDate) {
  const tbody = document.getElementById("semaforoDailyTbody");
  tbody.innerHTML = "";
  const days = getDaysInMonth(monthDate);
  for (let day = 1; day <= days; day += 1) {
    const row = monthData.daily[String(day)] || emptySemaforoPoint();
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${day}</td>
      <td><input type="number" min="0" max="100" step="1" value="${Number(row.porcentaje || 0)}" data-table="s-daily" data-row="${day}" data-key="porcentaje"></td>
      <td><input type="number" min="0" step="1" value="${Number(row.pendientes || 0)}" data-table="s-daily" data-row="${day}" data-key="pendientes"></td>`;
    tbody.appendChild(tr);
  }
}

function readSemaforoForm(yearly, monthData, selectedDate) {
  document.querySelectorAll("input[data-table='s-monthly']").forEach((input) => {
    const row = input.dataset.row;
    const key = input.dataset.key;
    if (!yearly[row]) yearly[row] = emptySemaforoPoint();
    yearly[row][key] = sanitizeNumber(input.value);
  });
  document.querySelectorAll("input[data-table='s-weekly']").forEach((input) => {
    const row = input.dataset.row;
    const key = input.dataset.key;
    if (!monthData.weekly[row]) monthData.weekly[row] = emptySemaforoPoint();
    monthData.weekly[row][key] = sanitizeNumber(input.value);
  });
  document.querySelectorAll("input[data-table='s-daily']").forEach((input) => {
    const row = input.dataset.row;
    const key = input.dataset.key;
    if (!monthData.daily[row]) monthData.daily[row] = emptySemaforoPoint();
    monthData.daily[row][key] = sanitizeNumber(input.value);
  });
  const monthNum = String(selectedDate.getMonth() + 1);
  if (!yearly[monthNum]) yearly[monthNum] = emptySemaforoPoint();
}

buildCapturePage();
