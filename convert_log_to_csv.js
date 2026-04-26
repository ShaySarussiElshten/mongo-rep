const fs = require('fs');
const path = require('path');

const inputFile = process.argv[2];
if (!inputFile) {
  console.error('Usage: node convert_log_to_csv.js <log_file>');
  process.exit(1);
}

const outputFile = inputFile.replace(/\.txt$/, '.csv');
const content = fs.readFileSync(inputFile, 'utf8');
const lines = content.split('\n');

const HEADERS = ['status', 'company_id', 'paper_id', 'symbol', 'reason', 'api', 'paper_type_he', 'success'];

function csvEscape(value) {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function parsePairs(segment) {
  const result = {};
  if (!segment) return result;
  for (const pair of segment.split(',')) {
    const trimmed = pair.trim();
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const key = trimmed.substring(0, colonIdx).trim();
    const value = trimmed.substring(colonIdx + 1).trim();
    result[key] = value;
  }
  return result;
}

const rows = [HEADERS];
let parsed = 0;

for (const line of lines) {
  let status = '';
  let body = '';

  if (line.startsWith('SUCCESS:')) {
    status = 'SUCCESS';
    body = line.substring('SUCCESS:'.length).trim();
  } else if (line.startsWith('SKIPPED:')) {
    status = 'SKIPPED';
    body = line.substring('SKIPPED:'.length).trim();
  } else if (/^company_id:/.test(line.trim())) {
    status = 'FAILED';
    body = line.trim();
  } else {
    continue;
  }

  const arrowIdx = body.indexOf(' => ');
  const main = arrowIdx === -1 ? body : body.substring(0, arrowIdx);
  const suffix = arrowIdx === -1 ? '' : body.substring(arrowIdx + 4);

  const fields = { ...parsePairs(main), ...parsePairs(suffix) };

  rows.push([
    status,
    fields.company_id || '',
    fields.paper_id || '',
    fields.symbol || '',
    fields.reason || '',
    fields.api || '',
    fields.paper_type_he || '',
    fields.success || ''
  ]);
  parsed++;
}

const csv = rows.map(r => r.map(csvEscape).join(',')).join('\n');
fs.writeFileSync(outputFile, csv);

console.log(`Parsed ${parsed} rows`);
console.log(`Wrote: ${outputFile}`);
