import Papa from 'papaparse';

/**
 * Parses a CSV file asynchronously using PapaParse.
 * @param {File} file - The CSV file to parse.
 * @returns {Promise<{ rows: Array<Object>, headers: Array<string>, fileInfo: { name: string, size: string, rowCount: number, columnCount: number } }>}
 */
export const parseCSVFile = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error('No file provided for parsing.'));
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      dynamicTyping: true,
      complete: (results) => {
        if (results.errors && results.errors.length > 0 && results.data.length === 0) {
          return reject(new Error(results.errors[0]?.message || 'Failed to parse CSV file.'));
        }

        const rows = results.data || [];
        if (rows.length === 0) {
          return reject(new Error('The uploaded CSV file is empty.'));
        }

        const headers = results.meta.fields || Object.keys(rows[0] || {});
        const sizeStr = `${(file.size / 1024).toFixed(1)} KB`;
        const fileInfo = {
          name: file.name,
          size: sizeStr,
          rowCount: rows.length,
          columnCount: headers.length
        };

        resolve({ rows, headers, fileInfo });
      },
      error: (err) => {
        reject(new Error(err?.message || 'Error parsing CSV file.'));
      }
    });
  });
};
