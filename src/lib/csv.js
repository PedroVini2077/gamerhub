// Geração e download de CSV no cliente — sem dependências externas.

// Escapa um valor para CSV: vira string, e se contiver aspas/vírgula/quebra de
// linha é envolvido em aspas (aspas internas duplicadas, padrão RFC 4180).
function escapeCell(value) {
  if (value == null) return '';
  let s = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

// rows: array de objetos. columns: [{ key, label }]. Retorna a string CSV.
export function toCSV(rows, columns) {
  const header = columns.map(c => escapeCell(c.label)).join(',');
  const lines = rows.map(row =>
    columns.map(c => escapeCell(typeof c.format === 'function' ? c.format(row[c.key], row) : row[c.key])).join(',')
  );
  return [header, ...lines].join('\r\n');
}

// Dispara o download de um CSV. Adiciona BOM UTF-8 pro Excel abrir acentos certo.
export function downloadCSV(filename, csv) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
