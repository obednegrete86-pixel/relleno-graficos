/* Genera assets/plantilla-importacion-indicadores.xlsx — ejecutar: npm run build:template */
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

const outDir = path.join(__dirname, "..", "assets");
const outFile = path.join(outDir, "plantilla-importacion-indicadores.xlsx");

/** Fecha de referencia: variables de entorno TEMPLATE_YEAR / TEMPLATE_MONTH (1-12) o hoy. */
function templateAnchorDate() {
  const now = new Date();
  const y = Number(process.env.TEMPLATE_YEAR) || now.getFullYear();
  const m = Number(process.env.TEMPLATE_MONTH);
  const month = m >= 1 && m <= 12 ? m : now.getMonth() + 1;
  return new Date(y, month - 1, 1);
}

function daysInMonth(year, monthIndex0) {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

/** Número de semana ISO (1-53) para una fecha (mediodía local para evitar bordes). */
function getISOWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

/** Semanas ISO distintas que tocan al menos un día del mes calendario. */
function isoWeeksOverlappingMonth(year, monthIndex0) {
  const dim = daysInMonth(year, monthIndex0);
  const set = new Set();
  for (let day = 1; day <= dim; day++) {
    set.add(getISOWeek(new Date(year, monthIndex0, day)));
  }
  return [...set].sort((a, b) => a - b);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function monthKey(year, month1) {
  return `${year}-${pad2(month1)}`;
}

const anchor = templateAnchorDate();
const TEMPLATE_YEAR = anchor.getFullYear();
const TEMPLATE_MONTH = anchor.getMonth() + 1;
const TEMPLATE_MONTH_INDEX0 = anchor.getMonth();
const TEMPLATE_CLAVE_MES = monthKey(TEMPLATE_YEAR, TEMPLATE_MONTH);
const DIM = daysInMonth(TEMPLATE_YEAR, TEMPLATE_MONTH_INDEX0);
const WEEKS_IN_MONTH = isoWeeksOverlappingMonth(TEMPLATE_YEAR, TEMPLATE_MONTH_INDEX0);

const instructions = [
  ["Plantilla de importación — Indicadores (Captura Settepi)"],
  [""],
  ["Cómo usar"],
  ["1. Llene solo las celdas que corresponden a datos ya ocurridos. Filas futuras pueden dejarse en blanco."],
  ["2. Esta plantilla se genera con el mes de referencia: año " + TEMPLATE_YEAR + ", mes " + TEMPLATE_MONTH + " (" + TEMPLATE_CLAVE_MES + ")."],
  ["   Para otro mes, ejecute: TEMPLATE_YEAR=2026 TEMPLATE_MONTH=5 npm run build:template"],
  ["3. clave_mes debe ser YYYY-MM (ej. 2026-04). En *_detalle del mes actual ya viene rellenada."],
  ["4. En hojas *_detalle, tipo = semana (número de semana ISO) o dia (día del mes 1-" + DIM + ")."],
  ["5. periodo = semana ISO (1-53) o día del mes según el tipo."],
  ["6. Importe desde la página Captura. Los datos se fusionan con lo ya guardado en el navegador."],
  [""],
  ["Hojas"],
  ["carros_uct_anual — UCT promedio por mes (12 meses del año " + TEMPLATE_YEAR + ")"],
  ["carros_total_mes — Total UCT del mes (una fila por mes del año)"],
  ["carros_detalle — Semanas ISO que caen en " + TEMPLATE_CLAVE_MES + " + un día por fila (1-" + DIM + ")"],
  ["semaforo_anual / semaforo_detalle — Semáforo de llantas"],
  ["flota360_anual / flota360_detalle — Evaluación Flota 360"],
  ["mtto_anual / mtto_detalle — MTTO preventivo"]
];

const EMPTY_UCT = ["", "", "", "", ""];
const EMPTY_POINT = ["", ""];

function buildCarrosUctAnual() {
  const rows = [["año", "mes", "uct"]];
  for (let mes = 1; mes <= 12; mes++) {
    rows.push([TEMPLATE_YEAR, mes, ""]);
  }
  return rows;
}

function buildCarrosTotalMes() {
  const rows = [["clave_mes", "total_uct_mes"]];
  for (let mes = 1; mes <= 12; mes++) {
    rows.push([monthKey(TEMPLATE_YEAR, mes), ""]);
  }
  return rows;
}

function buildCarrosDetalle() {
  const header = ["clave_mes", "tipo", "periodo", "lt5", "d6_30", "d31_60", "d61_100", "gt100"];
  const rows = [header];
  for (const w of WEEKS_IN_MONTH) {
    rows.push([TEMPLATE_CLAVE_MES, "semana", w, ...EMPTY_UCT]);
  }
  for (let dia = 1; dia <= DIM; dia++) {
    rows.push([TEMPLATE_CLAVE_MES, "dia", dia, ...EMPTY_UCT]);
  }
  return rows;
}

function buildSemaforoAnual() {
  const rows = [["año", "mes", "porcentaje", "pendientes"]];
  for (let mes = 1; mes <= 12; mes++) {
    rows.push([TEMPLATE_YEAR, mes, "", ""]);
  }
  return rows;
}

function buildSemaforoDetalle() {
  const header = ["clave_mes", "tipo", "periodo", "porcentaje", "pendientes"];
  const rows = [header];
  for (const w of WEEKS_IN_MONTH) {
    rows.push([TEMPLATE_CLAVE_MES, "semana", w, ...EMPTY_POINT]);
  }
  for (let dia = 1; dia <= DIM; dia++) {
    rows.push([TEMPLATE_CLAVE_MES, "dia", dia, ...EMPTY_POINT]);
  }
  return rows;
}

function buildFlotaAnual() {
  const rows = [["año", "mes", "porcentaje", "pendientes"]];
  for (let mes = 1; mes <= 12; mes++) {
    rows.push([TEMPLATE_YEAR, mes, "", ""]);
  }
  return rows;
}

function buildFlotaDetalle() {
  return buildSemaforoDetalle();
}

function buildMttoAnual() {
  const rows = [["año", "mes", "porcentaje", "pendientes"]];
  for (let mes = 1; mes <= 12; mes++) {
    rows.push([TEMPLATE_YEAR, mes, "", ""]);
  }
  return rows;
}

function buildMttoDetalle() {
  return buildSemaforoDetalle();
}

function aoaToSheet(aoa) {
  return XLSX.utils.aoa_to_sheet(aoa);
}

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, aoaToSheet(instructions), "Instrucciones");
XLSX.utils.book_append_sheet(wb, aoaToSheet(buildCarrosUctAnual()), "carros_uct_anual");
XLSX.utils.book_append_sheet(wb, aoaToSheet(buildCarrosTotalMes()), "carros_total_mes");
XLSX.utils.book_append_sheet(wb, aoaToSheet(buildCarrosDetalle()), "carros_detalle");
XLSX.utils.book_append_sheet(wb, aoaToSheet(buildSemaforoAnual()), "semaforo_anual");
XLSX.utils.book_append_sheet(wb, aoaToSheet(buildSemaforoDetalle()), "semaforo_detalle");
XLSX.utils.book_append_sheet(wb, aoaToSheet(buildFlotaAnual()), "flota360_anual");
XLSX.utils.book_append_sheet(wb, aoaToSheet(buildFlotaDetalle()), "flota360_detalle");
XLSX.utils.book_append_sheet(wb, aoaToSheet(buildMttoAnual()), "mtto_anual");
XLSX.utils.book_append_sheet(wb, aoaToSheet(buildMttoDetalle()), "mtto_detalle");

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
XLSX.writeFile(wb, outFile);
console.log("Escrito:", outFile);
console.log(
  "Mes detalle:",
  TEMPLATE_CLAVE_MES,
  "| días:",
  DIM,
  "| semanas ISO en el mes:",
  WEEKS_IN_MONTH.join(", ")
);
