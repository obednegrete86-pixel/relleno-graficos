Chart.register(ChartDataLabels);
Chart.defaults.font.family = "\"Arial Narrow\", Arial, sans-serif";
Chart.register({
  id: "stackedTotalLabels",
  afterDatasetsDraw(chart, args, pluginOptions) {
    if (!pluginOptions || !pluginOptions.enabled) return;
    if (chart.config.type !== "bar") return;

    const ctx = chart.ctx;
    const xScale = chart.scales.x;
    const yScale = chart.scales.y;
    const totals = pluginOptions.totals || [];
    const color = pluginOptions.color || "#0f172a";
    const fontSize = pluginOptions.fontSize || 10;
    const fontWeight = pluginOptions.fontWeight || "700";
    const outsideOffset = pluginOptions.outsideOffset || 4;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.font = `${fontWeight} ${fontSize}px "Arial Narrow", Arial, sans-serif`;

    totals.forEach((total, index) => {
      if (!total || total <= 0) return;
      const x = xScale.getPixelForValue(index);
      const yTop = yScale.getPixelForValue(total);
      const y = Math.max(yScale.top + 10, yTop - outsideOffset);
      ctx.fillText(String(total), x, y);
    });

    ctx.restore();
  }
});

const chartRefs = [];

function buildIndicatorsPage() {
  const store = getStore();
  const now = new Date();
  const year = now.getFullYear();
  const fixedWeeklyDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const fixedWeeklyKey = toMonthKey(fixedWeeklyDate);
  const fixedWeeklyData = ensureMonthData(store, fixedWeeklyKey, fixedWeeklyDate);
  const select = document.getElementById("indicatorMonthSelect");
  let selectedDate = new Date(year, now.getMonth(), 1);
  fillIndicatorMonthSelect(select, year, selectedDate.getMonth() + 1);

  function destroyCharts() {
    while (chartRefs.length) {
      const chart = chartRefs.pop();
      chart.destroy();
    }
  }

  function renderForMonth(dateObj) {
    const monthKey = toMonthKey(dateObj);
    const monthData = ensureMonthData(store, monthKey, dateObj);
    const monthlySeries = getYearlySeries(store, dateObj.getFullYear());
    saveStore(store);

    destroyCharts();
    document.getElementById("compareLabel").textContent = `Indicadores: ${getMonthLabel(dateObj)}`;
    document.getElementById("currentMonthName").textContent = getMonthLabel(dateObj);
    document.getElementById("yearlyTitle").textContent = `Mensual ${dateObj.getFullYear()}`;

    chartRefs.push(createMonthlyChart(
      document.getElementById("yearlyMonthlyChart"),
      dateObj.getMonth(),
      monthlySeries
    ));
    chartRefs.push(
      createStackedChart(
        document.getElementById("currentDailyChart"),
        Object.keys(monthData.daily || {}).sort((a, b) => Number(a) - Number(b)),
        monthData.daily || {},
        "SETTEPI CARROS TALLER DIARIO"
      ),
      createStackedChart(
        document.getElementById("currentWeeklyChart"),
        Object.keys(fixedWeeklyData.weekly || {}).sort((a, b) => Number(a) - Number(b)),
        fixedWeeklyData.weekly || {},
        "SETTEPI / CARROS TALLER SEMANAL"
      )
    );
    if (typeof window.renderUnidadesIndicadorPanel === "function") {
      window.renderUnidadesIndicadorPanel("carros", monthKey);
    }
  }

  renderForMonth(selectedDate);

  select.addEventListener("change", (event) => {
    const monthNumber = Number(event.target.value);
    selectedDate = new Date(year, monthNumber - 1, 1);
    renderForMonth(selectedDate);
  });
}

function fillIndicatorMonthSelect(selectNode, year, selectedMonth) {
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

function createMonthlyChart(canvasNode, activeIndex, monthlySeries) {
  const hasMonthlyData = monthlySeries.values.some((v) => Number(v || 0) > 0);
  return new Chart(canvasNode, {
    type: "bar",
    data: {
      labels: monthlySeries.labels,
      datasets: [
        {
          label: "UCT",
          data: hasMonthlyData ? monthlySeries.values : monthlySeries.labels.map(() => null),
          backgroundColor: monthlySeries.labels.map((_, idx) => (idx === activeIndex ? "#062a4d" : "#a9c6e5")),
          borderRadius: 6,
          barThickness: 24
        },
        {
          type: "line",
          label: "Meta 18 UCT",
          data: monthlySeries.labels.map(() => GOAL_UCT),
          borderColor: "#c2185b",
          borderWidth: 3,
          borderDash: [6, 6],
          pointRadius: 0,
          order: -10
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          top: 8,
          right: 8,
          bottom: 4,
          left: 8
        }
      },
      plugins: {
        title: {
          display: true,
          text: "SETTEPI / PROMEDIO CARROS TALLER MENSUAL",
          color: "#1f2937",
          font: { size: 13, weight: "600" }
        },
        legend: { display: false },
        datalabels: {
          color: "#111827",
          anchor: "end",
          align: "top",
          offset: 2,
          formatter: (v, ctx) => (ctx.dataset.type === "line" || Number(v || 0) <= 0 ? "" : v)
        }
      },
      scales: {
        y: {
          beginAtZero: true
        },
        x: {
          ticks: {
            maxRotation: 0
          }
        }
      }
    }
  });
}

function createStackedChart(canvasNode, labels, rowsObj, titleText) {
  const isDailyChart = titleText.includes("DIARIO");
  const datasets = CATEGORY_KEYS.map((key) => ({
    label: CATEGORY_LABELS[key],
    data: labels.map((label) => Number((rowsObj[label] || emptyCategoryRow())[key] || 0)),
    backgroundColor: CATEGORY_COLORS[key],
    stack: "total",
    categoryPercentage: 0.9,
    barPercentage: isDailyChart ? 0.855 : 0.95,
    maxBarThickness: isDailyChart ? 22 : 24
  }));

  const totalData = labels.map((label) => sumCategoryRow(rowsObj[label] || emptyCategoryRow()));
  datasets.push({
    type: "line",
    label: "Meta 18 UCT",
    data: labels.map(() => GOAL_UCT),
    borderColor: "#c2185b",
    borderWidth: 3,
    borderDash: [6, 6],
    pointRadius: 0,
    yAxisID: "y",
    order: -10
  });

  return new Chart(canvasNode, {
    type: "bar",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          top: 8,
          right: 8,
          bottom: 4,
          left: 8
        }
      },
      plugins: {
        title: {
          display: true,
          text: titleText,
          color: "#1f2937",
          font: { size: 13, weight: "600" }
        },
        legend: {
          position: "bottom",
          labels: {
            boxWidth: 14,
            padding: 6
          }
        },
        tooltip: {
          mode: "index",
          intersect: false,
          callbacks: {
            footer: (items) => {
              if (!items.length) return "";
              const idx = items[0].dataIndex;
              return `Total: ${totalData[idx]} UCT`;
            }
          }
        },
        datalabels: {
          formatter: (value, ctx) => {
            if (ctx.dataset.type === "line" || value === 0) return "";
            return value;
          },
          color: (ctx) => {
            const bg = ctx.dataset.backgroundColor || "#000000";
            return getContrastColor(bg);
          },
          anchor: "center",
          align: "center",
          font: { weight: "700", size: 9 },
          clamp: true
        },
        stackedTotalLabels: {
          enabled: true,
          totals: totalData,
          color: "#0f172a",
          fontSize: 10,
          fontWeight: "700",
          outsideOffset: 3
        }
      },
      scales: {
        x: {
          stacked: true,
          ticks: {
            autoSkip: false,
            maxRotation: 0,
            minRotation: 0,
            font: {
              family: "\"Arial Narrow\", Arial, sans-serif",
              size: 10
            },
            padding: 0
          }
        },
        y: {
          stacked: true,
          beginAtZero: true
        }
      }
    }
  });
}

buildIndicatorsPage();
