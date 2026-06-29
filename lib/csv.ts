export function csvEscape(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  if (!/[",\n\r]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(rows: unknown[][]) {
  return `${rows.map((row) => row.map(csvEscape).join(",")).join("\n")}\n`;
}
