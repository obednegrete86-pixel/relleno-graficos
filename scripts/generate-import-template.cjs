/* Genera assets/plantilla-importacion-indicadores.xlsx — ejecutar: npm run build:template */
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

const outDir = path.join(__dirname, "..", "assets");
const outFile = path.join(outDir, "plantilla-importacion-indicadores.xlsx");

const instructions = [
  ["Plantilla de importación — Indicadores (Captura Settepi)"],
  [""],
  ["Cómo usar"],
  ["1. Llene solo las hojas que necesite. Las filas de ejemplo puede borrarlas o sustituirlas."],
  ["2. clave_mes debe ser YYYY-MM (ej. 2026-04)."],
  ["3. En hojas *_detalle, tipo = semana (semana ISO) o dia (día del mes 1-31)."],
  ["4. periodo = número de semana ISO (1-53) o día del mes según el tipo."],
  ["5. Importe desde la página Captura (archivo .xlsx o .xls). Los datos se fusionan con lo ya guardado."],
  [""],
  ["Hojas"],
  ["carros_uct_anual — Promedio UCT por mes del año"],
  ["carros_total_mes — Total UCT del mes (campo mensual del mes)"],
  ["carros_detalle — Desglose por categoría (Carros Taller)"],
  ["semaforo_anual / semaforo_detalle — Semáforo de llantas"],
  ["flota360_anual / flota360_detalle — Evaluación Flota 360"],
  ["mtto_anual / mtto_detalle — MTTO preventivo"]
];

const carrosUctAnual = [
  ["año", "mes", "uct"],
  [2026, 1, ""],
  [2026, 2, ""],
  [2026, 3, ""],
  [2026, 4, ""]
];

const carrosTotalMes = [
  ["clave_mes", "total_uct_mes"],
  ["2026-04", ""]
];

const carrosDetalle = [
  ["clave_mes", "tipo", "periodo", "lt5", "d6_30", "d31_60", "d61_100", "gt100"],
  ["2026-04", "semana", 14, "", "", "", "", ""],
  ["2026-04", "dia", 1, "", "", "", "", ""]
];

const semaforoAnual = [
  ["año", "mes", "porcentaje", "pendientes"],
  [2026, 4, "", ""]
];

const semaforoDetalle = [
  ["clave_mes", "tipo", "periodo", "porcentaje", "pendientes"],
  ["2026-04", "semana", 14, "", ""],
  ["2026-04", "dia", 9, "", ""]
];

const flotaAnual = [
  ["año", "mes", "porcentaje", "pendientes"],
  [2026, 4, "", ""]
];

const flotaDetalle = [
  ["clave_mes", "tipo", "periodo", "porcentaje", "pendientes"],
  ["2026-04", "semana", 14, "", ""],
  ["2026-04", "dia", 9, "", ""]
];

const mttoAnual = [
  ["año", "mes", "porcentaje", "pendientes"],
  [2026, 4, "", ""]
];

const mttoDetalle = [
  ["clave_mes", "tipo", "periodo", "porcentaje", "pendientes"],
  ["2026-04", "semana", 14, "", ""],
  ["2026-04", "dia", 9, "", ""]
];

function aoaToSheet(aoa) {
  return XLSX.utils.aoa_to_sheet(aoa);
}

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, aoaToSheet(instructions), "Instrucciones");
XLSX.utils.book_append_sheet(wb, aoaToSheet(carrosUctAnual), "carros_uct_anual");
XLSX.utils.book_append_sheet(wb, aoaToSheet(carrosTotalMes), "carros_total_mes");
XLSX.utils.book_append_sheet(wb, aoaToSheet(carrosDetalle), "carros_detalle");
XLSX.utils.book_append_sheet(wb, aoaToSheet(semaforoAnual), "semaforo_anual");
XLSX.utils.book_append_sheet(wb, aoaToSheet(semaforoDetalle), "semaforo_detalle");
XLSX.utils.book_append_sheet(wb, aoaToSheet(flotaAnual), "flota360_anual");
XLSX.utils.book_append_sheet(wb, aoaToSheet(flotaDetalle), "flota360_detalle");
XLSX.utils.book_append_sheet(wb, aoaToSheet(mttoAnual), "mtto_anual");
XLSX.utils.book_append_sheet(wb, aoaToSheet(mttoDetalle), "mtto_detalle");

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
XLSX.writeFile(wb, outFile);
console.log("Escrito:", outFile);
