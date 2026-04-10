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

const flota360ChartRefs = [];

function paintFlota360Charts(monthDate, store, els) {
  if (!els?.monthlyCanvas || !els?.weeklyCanvas || !els?.dailyCanvas) return;

  destroyFlota360Charts();
  const monthKey = toMonthKey(monthDate);
  const monthData = ensureFlota360MonthData(store, monthKey, monthDate);
  const yearly = getFlota360YearlySeries(store, monthDate.getFullYear());
  saveStore(store);

  if (els.monthName) els.monthName.textContent = getMonthLabel(monthDate);
  if (els.compareLabel) els.compareLabel.textContent = `Indicadores: ${getMonthLabel(monthDate)}`;

  const weekKeys = Object.keys(monthData.weekly || {}).sort((a, b) => Number(a) - Number(b));
  const dayKeys = Object.keys(monthData.daily || {}).sort((a, b) => Number(a) - Number(b));

  flota360ChartRefs.push(
    createFlota360MonthlyChart(
      els.monthlyCanvas,
      yearly.labels,
      yearly.porcentaje,
      "EVALUACION FLOTA 360 MENSUAL",
      monthDate.getMonth()
    ),
    createFlota360CombinedChart(
      els.weeklyCanvas,
      weekKeys,
      weekKeys.map((k) => Number((monthData.weekly[k] || emptyFlota360Point()).porcentaje || 0)),
      weekKeys.map((k) => Number((monthData.weekly[k] || emptyFlota360Point()).pendientes || 0)),
      "EVALUACION FLOTA 360 SEMANAL",
      { yPercentMin: 0, yPercentMax: 120 }
    ),
    createFlota360CombinedChart(
      els.dailyCanvas,
      dayKeys,
      dayKeys.map((k) => Number((monthData.daily[k] || emptyFlota360Point()).porcentaje || 0)),
      dayKeys.map((k) => Number((monthData.daily[k] || emptyFlota360Point()).pendientes || 0)),
      "EVALUACION FLOTA 360 DIARIO"
    )
  );
}

function getStandaloneFlota360ChartEls() {
  return {
    monthName: document.getElementById("flota360MonthName"),
    compareLabel: document.getElementById("flota360CompareLabel"),
    monthlyCanvas: document.getElementById("flota360MonthlyChart"),
    weeklyCanvas: document.getElementById("flota360WeeklyChart"),
    dailyCanvas: document.getElementById("flota360DailyChart")
  };
}

function buildFlota360Page() {
  const store = getStore();
  const now = new Date();
  const year = now.getFullYear();
  const monthSelect = document.getElementById("flota360IndicatorMonthSelect");
  let selectedDate = new Date(year, now.getMonth(), 1);

  fillIndicatorMonthSelect(monthSelect, year, selectedDate.getMonth() + 1);
  paintFlota360Charts(selectedDate, store, getStandaloneFlota360ChartEls());

  monthSelect.addEventListener("change", (event) => {
    selectedDate = new Date(year, Number(event.target.value) - 1, 1);
    paintFlota360Charts(selectedDate, store, getStandaloneFlota360ChartEls());
  });
}

function initFlota360CaptureChartsHook() {
  const monthlyCanvas = document.getElementById("captureFlota360MonthlyChart");
  const weeklyCanvas = document.getElementById("captureFlota360WeeklyChart");
  const dailyCanvas = document.getElementById("captureFlota360DailyChart");
  if (!monthlyCanvas || !weeklyCanvas || !dailyCanvas) return;

  window.refreshFlota360ChartsForCapture = function refreshFlota360ChartsForCapture(selectedDate) {
    const store = getStore();
    paintFlota360Charts(selectedDate, store, {
      monthName: null,
      compareLabel: null,
      monthlyCanvas,
      weeklyCanvas,
      dailyCanvas
    });
  };
}

const FLOTA360_MONTHLY_BAR = "#1f6fd6";
const FLOTA360_MONTHLY_BAR_ACTIVE = "#062a4d";

function createFlota360MonthlyChart(canvasNode, labels, porcentajeData, title, highlightMonthIndex) {
  const hasAnyData = porcentajeData.some((v) => Number(v || 0) > 0);
  const barColors = labels.map((_, idx) =>
    idx === highlightMonthIndex ? FLOTA360_MONTHLY_BAR_ACTIVE : FLOTA360_MONTHLY_BAR
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

const FLOTA360_PENDIENTES_DESDE_TOPE_BARRA = 3.5;
const FLOTA360_PENDIENTES_MIN_SOBRE_META = 104;

function createFlota360CombinedChart(canvasNode, labels, porcentajeData, pendientesData, title, axisOpts) {
  const yPercentAxisMin = axisOpts && Number.isFinite(axisOpts.yPercentMin) ? axisOpts.yPercentMin : 40;
  const yPercentAxisMax = axisOpts && Number.isFinite(axisOpts.yPercentMax) ? axisOpts.yPercentMax : 120;
  const hasAnyData =
    porcentajeData.some((v) => Number(v || 0) > 0) ||
    pendientesData.some((v) => Number(v || 0) > 0);

  const pendientesYData = hasAnyData
    ? pendientesData.map((p, i) => {
        if (Number(p || 0) <= 0) return null;
        const pct = Number(porcentajeData[i] || 0);
        const base = pct > 0 ? pct : 45;
        const sobreBarra = base + FLOTA360_PENDIENTES_DESDE_TOPE_BARRA;
        const y = Math.max(sobreBarra, FLOTA360_PENDIENTES_MIN_SOBRE_META);
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
          max: yPercentAxisMax,
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

function destroyFlota360Charts() {
  while (flota360ChartRefs.length) {
    const c = flota360ChartRefs.pop();
    c.destroy();
  }
}

initFlota360CaptureChartsHook();
if (document.getElementById("flota360IndicatorMonthSelect")) {
  buildFlota360Page();
}
