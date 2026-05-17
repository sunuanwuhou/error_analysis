const fs = require('fs');
const path = require('path');

function loadXlsx() {
  try {
    return require('xlsx');
  } catch (_) {
    const fallback = path.resolve(__dirname, '../../../error_manage/node_modules/xlsx');
    return require(fallback);
  }
}

const XLSX = loadXlsx();
const file = process.argv[2];
if (!file) {
  console.error('missing input file');
  process.exit(1);
}

const wb = XLSX.readFile(file, { cellStyles: false, cellFormula: false, cellHTML: false });
const payload = wb.SheetNames.map((name) => ({
  name,
  rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' }),
}));

process.stdout.write(JSON.stringify(payload));
