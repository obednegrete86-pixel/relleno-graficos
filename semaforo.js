if (typeof Chart !== "undefined") {
  try {
    if (typeof ChartDataLabels !== "undefined") {
      Chart.register(ChartDataLabels);
    }
  } catch (e) {
    /* plugin ya registrado */
  }
  Chart.defaults.font.family = "\"Arial Narrow\", Arial, sans-serif";
}

const semaforoChartRefs = [];

function paintSemaforoCharts(monthDate, store, els) {
  if (!els?.monthlyCanvas || !els?.weeklyCanvas || !els?.dailyCanvas) return;

  destroySemaforoCharts();
  const monthKey = toMonthKey(monthDate);
  const monthData = ensureSemaforoMonthData(store, monthKey, monthDate);
  const yearly = getSemaforoYearlySeries(store, monthDate.getFullYear());
  saveStore(store);

  if (els.monthName) els.monthName.textContent = getMonthLabel(monthDate);
  if (els.compareLabel) els.compareLabel.textContent = `Indicadores: ${getMonthLabel(monthDate)}`;

  const weekKeys = Object.keys(monthData.weekly || {}).sort((a, b) => Number(a) - Number(b));
  const dayKeys = Object.keys(monthData.daily || {}).sort((a, b) => Number(a) - Number(b));

  semaforoChartRefs.push(
    createSemaforoMonthlyChart(
      els.monthlyCanvas,
      yearly.labels,
      yearly.porcentaje,
      "SEMAFORO DE LLANTAS MENSUAL",
      monthDate.getMonth()
    ),
    createSemaforoCombinedChart(
      els.weeklyCanvas,
      weekKeys,
      weekKeys.map((k) => Number((monthData.weekly[k] || emptySemaforoPoint()).porcentaje || 0)),
      weekKeys.map((k) => Number((monthData.weekly[k] || emptySemaforoPoint()).pendientes || 0)),
      "SEMAFORO DE LLANTAS SEMANAL"
    ),
    createSemaforoCombinedChart(
      els.dailyCanvas,
      dayKeys,
      dayKeys.map((k) => Number((monthData.daily[k] || emptySemaforoPoint()).porcentaje || 0)),
      dayKeys.map((k) => Number((monthData.daily[k] || emptySemaforoPoint()).pendientes || 0)),
      "SEMAFORO DE LLANTAS DIARIO"
    )
  );
  if (typeof window.renderUnidadesIndicadorPanel === "function") {
    window.renderUnidadesIndicadorPanel("semaforo", monthKey);
  }
}

function getStandaloneSemaforoChartEls() {
  return {
    monthName: document.getElementById("semaforoMonthName"),
    compareLabel: document.getElementById("semaforoCompareLabel"),
    monthlyCanvas: document.getElementById("semaforoMonthlyChart"),
    weeklyCanvas: document.getElementById("semaforoWeeklyChart"),
    dailyCanvas: document.getElementById("semaforoDailyChart")
  };
}

function buildSemaforoPage() {
  const store = getStore();
  const now = new Date();
  const year = now.getFullYear();
  const monthSelect = document.getElementById("semaforoIndicatorMonthSelect");
  let selectedDate = new Date(year, now.getMonth(), 1);

  fillIndicatorMonthSelect(monthSelect, year, selectedDate.getMonth() + 1);
  paintSemaforoCharts(selectedDate, store, getStandaloneSemaforoChartEls());

  monthSelect.addEventListener("change", (event) => {
    selectedDate = new Date(year, Number(event.target.value) - 1, 1);
    paintSemaforoCharts(selectedDate, store, getStandaloneSemaforoChartEls());
  });
}

function initSemaforoCaptureChartsHook() {
  const monthlyCanvas = document.getElementById("captureSemaforoMonthlyChart");
  const weeklyCanvas = document.getElementById("captureSemaforoWeeklyChart");
  const dailyCanvas = document.getElementById("captureSemaforoDailyChart");
  if (!monthlyCanvas || !weeklyCanvas || !dailyCanvas) return;

  window.refreshSemaforoChartsForCapture = function refreshSemaforoChartsForCapture(selectedDate) {
    const store = getStore();
    paintSemaforoCharts(selectedDate, store, {
      monthName: null,
      compareLabel: null,
      monthlyCanvas,
      weeklyCanvas,
      dailyCanvas
    });
  };
}

const SEMAFORO_MONTHLY_BAR = "#1f6fd6";
const SEMAFORO_MONTHLY_BAR_ACTIVE = "#062a4d";

function createSemaforoMonthlyChart(canvasNode, labels, porcentajeData, title, highlightMonthIndex) {
  const hasAnyData = porcentajeData.some((v) => Number(v || 0) > 0);
  const barColors = labels.map((_, idx) =>
    idx === highlightMonthIndex ? SEMAFORO_MONTHLY_BAR_ACTIVE : SEMAFORO_MONTHLY_BAR
  );
  return new Chart(canvasNode, {
    data: {
      labels,
      datasets: [
        {
          type: "bar",
          label: "Porcentaje",
          data: hasAnyData ? porcentajeData : labels.map(() => null),
          yAxisID: "yPercent",
          backgroundColor: barColors,
          borderRadius: 4,
          datalabels: {
            color: "#ffffff",
            anchor: "end",
            align: "start",
            offset: 2,
            font: { size: 12, weight: "800" },
            clamp: true,
            formatter: (v) => (Number(v || 0) > 0 ? `${Math.round(v)}%` : "")
          }
        },
        {
          type: "line",
          label: "Meta 95%",
          data: labels.map(() => 95),
          yAxisID: "yPercent",
          borderColor: "#f4841f",
          borderWidth: 2,
          pointRadius: 0,
          borderDash: [6, 4],
          datalabels: { display: false }
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: title,
          color: "#1f2937",
          font: { size: 13, weight: "600" }
        },
        legend: { position: "bottom", labels: { boxWidth: 14 } }
      },
      scales: {
        yPercent: {
          min: 0,
          max: 100,
          ticks: { callback: (v) => `${v}%` }
        },
        x: {
          ticks: { maxRotation: 0, minRotation: 0 }
        }
      }
    }
  });
}

const SEMAFORO_PENDIENTES_DESDE_TOPE_BARRA = 3.5;
const SEMAFORO_PENDIENTES_MIN_SOBRE_META = 104;

function createSemaforoCombinedChart(canvasNode, labels, porcentajeData, pendientesData, title) {
  const yPercentAxisMin = 40;
  const hasAnyData =
    porcentajeData.some((v) => Number(v || 0) > 0) ||
    pendientesData.some((v) => Number(v || 0) > 0);

  const pendientesYData = hasAnyData
    ? pendientesData.map((p, i) => {
        if (Number(p || 0) <= 0) return null;
        const pct = Number(porcentajeData[i] || 0);
        const base = pct > 0 ? pct : 45;
        const sobreBarra = base + SEMAFORO_PENDIENTES_DESDE_TOPE_BARRA;
        const y = Math.max(sobreBarra, SEMAFORO_PENDIENTES_MIN_SOBRE_META);
        return Math.min(y, 118);
      })
    : labels.map(() => null);

  return new Chart(canvasNode, {
    data: {
      labels,
      datasets: [
        {
          type: "bar",
          label: "Porcentaje",
          data: hasAnyData ? porcentajeData : labels.map(() => null),
          yAxisID: "yPercent",
          order: 1,
          base: yPercentAxisMin,
          backgroundColor: "#1f6fd6",
          borderRadius: 4,
          datalabels: {
            color: "#ffffff",
            anchor: "center",
            align: "center",
            offset: 0,
            rotation: -90,
            font: {
              family: '"Arial Narrow", Arial, sans-serif',
              size: 12,
              weight: "800"
            },
            clamp: false,
            clip: false,
            formatter: (v) => (Number(v || 0) > 0 ? `${Math.round(v)}%` : "")
          }
        },
        {
          type: "line",
          label: "Pendientes",
          data: pendientesYData,
          yAxisID: "yPercent",
          order: 3,
          showLine: false,
          pointStyle: "rect",
          pointRadius: 10.08,
          pointHoverRadius: 11.52,
          pointBackgroundColor: "#d92d20",
          pointBorderColor: "#d92d20",
          datalabels: {
            color: "#ffffff",
            anchor: "center",
            align: "center",
            rotation: 0,
            formatter: (_v, ctx) => {
              const n = pendientesData[ctx.dataIndex];
              return Number(n || 0) > 0 ? String(Math.round(n)).slice(0, 3) : "";
            },
            font: {
              family: '"Arial Narrow", Arial, sans-serif',
              size: 10,
              weight: "700"
            }
          }
        },
        {
          type: "line",
          label: "Meta 95%",
          data: labels.map(() => 95),
          yAxisID: "yPercent",
          order: 0,
          borderColor: "#e6b800",
          borderWidth: 2,
          pointRadius: 0,
          datalabels: { display: false }
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { top: 14 }
      },
      datasets: {
        bar: {
          categoryPercentage: 0.96,
          barPercentage: 0.92
        }
      },
      plugins: {
        title: {
          display: true,
          text: title,
          color: "#1f2937",
          font: {
            family: '"Arial Narrow", Arial, sans-serif',
            size: 13,
            weight: "600"
          }
        },
        legend: { position: "bottom", labels: { boxWidth: 14 } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const ds = ctx.dataset;
              if (ds.label === "Pendientes") {
                const n = pendientesData[ctx.dataIndex];
                return n != null && Number(n) > 0 ? `Pendientes: ${Math.round(n)}` : "";
              }
              if (ds.label === "Meta 95%") return "Meta: 95%";
              const v = ctx.parsed.y;
              return v != null && !Number.isNaN(v) ? `Porcentaje: ${Math.round(v)}%` : "";
            }
          }
        }
      },
      scales: {
        yPercent: {
          min: yPercentAxisMin,
          max: 120,
          position: "left",
          ticks: {
            stepSize: 10,
            callback: (v) => `${v}%`
          }
        },
        x: {
          ticks: { maxRotation: 0, minRotation: 0 }
        }
      }
    }
  });
}

function destroySemaforoCharts() {
  while (semaforoChartRefs.length) {
    const c = semaforoChartRefs.pop();
    c.destroy();
  }
}

initSemaforoCaptureChartsHook();
if (document.getElementById("semaforoIndicatorMonthSelect")) {
  buildSemaforoPage();
}
