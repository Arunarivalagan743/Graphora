export const createEmptyManualRow = (columnHeaders) => columnHeaders.reduce((acc, header) => {
  acc[header] = '';
  return acc;
}, {});

export const headersMatch = (currentHeaders, nextHeaders) => {
  if (!currentHeaders || !nextHeaders) return false;
  if (currentHeaders.length !== nextHeaders.length) return false;
  return currentHeaders.every((header, index) => String(header).trim().toLowerCase() === String(nextHeaders[index]).trim().toLowerCase());
};

export const getPrimaryKeyColumn = (nodesMapping, availableHeaders) => {
  if (nodesMapping && Array.isArray(nodesMapping) && nodesMapping.length > 0) {
    const primary = nodesMapping[0].idColumn;
    if (primary) return String(primary).trim();
  }
  return availableHeaders && availableHeaders.length > 0 ? String(availableHeaders[0]).trim() : null;
};

export const escapeCsvValue = (value) => {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

export const buildCsvText = (columnHeaders, rows) => {
  const headerLine = columnHeaders.map(escapeCsvValue).join(',');
  const rowLines = rows.map((row) => columnHeaders.map((header) => escapeCsvValue(row?.[header])).join(','));
  return [headerLine, ...rowLines].join('\r\n');
};
