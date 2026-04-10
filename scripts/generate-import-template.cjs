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

/** Igual que en app.js: semanas ISO 1..53 para alinear con las tablas de captura. */
const ISO_WEEKS_FULL = Array.from({ length: 53 }, (_, idx) => idx + 1);

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

const instructions = [
  ["Plantilla de importación — Indicadores (Captura Settepi)"],
  [""],
  ["Cómo usar"],
  ["1. Llene solo las celdas que corresponden a datos ya ocurridos. Filas futuras pueden dejarse en blanco."],
  ["2. Esta plantilla se genera con el mes de referencia: año " + TEMPLATE_YEAR + ", mes " + TEMPLATE_MONTH + " (" + TEMPLATE_CLAVE_MES + ")."],
  ["   Para otro mes, ejecute: TEMPLATE_YEAR=2026 TEMPLATE_MONTH=5 npm run build:template"],
  ["3. clave_mes debe ser YYYY-MM (ej. 2026-04). En *_detalle del mes actual ya viene rellenada."],
  ["4. En *_detalle: filas semana = semanas ISO 1-53 (como en pantalla Captura); luego filas dia = días 1-" + DIM + " del mes."],
  ["5. periodo = semana ISO (1-53) o día del mes según el tipo."],
  ["6. Importe desde la página Captura. Los datos se fusionan con lo ya guardado en el navegador."],
  [""],
  ["Hojas"],
  ["carros_uct_anual — UCT promedio por mes (12 meses del año " + TEMPLATE_YEAR + ")"],
  ["carros_total_mes — Total UCT del mes (una fila por mes del año)"],
  ["carros_detalle — Semanas ISO 1-53 + un día por fila del mes (1-" + DIM + "), clave_mes " + TEMPLATE_CLAVE_MES],
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
  for (const w of ISO_WEEKS_FULL) {
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
  for (const w of ISO_WEEKS_FULL) {
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
console.log("Mes detalle:", TEMPLATE_CLAVE_MES, "| días:", DIM, "| filas semana: 53 + día:", DIM);
