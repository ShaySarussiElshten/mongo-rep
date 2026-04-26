const fs = require('fs');
const path = require('path');

const IDENTIFIER_CSV = 'processing_log_2026-04-13T08-40-10-417Z.csv';
const LOGO_CSV = 'images_2026-04-13T09-15-36-759Z/processing_log.csv';
const OUTPUT_CSV = 'merged_identifier_logo.csv';

function parseCsv(text) {
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else if (c === '\r') {
        // ignore
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function toObjects(rows) {
  const [header, ...data] = rows;
  return data
    .filter(r => r.length === header.length && r.some(v => v !== ''))
    .map(r => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

function csvEscape(value) {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

const idRows = toObjects(parseCsv(fs.readFileSync(IDENTIFIER_CSV, 'utf8')));
const logoRows = toObjects(parseCsv(fs.readFileSync(LOGO_CSV, 'utf8')));

// Index logo rows by company_id (skip empty company_ids like "N/A")
const logoByCompanyId = new Map();
for (const row of logoRows) {
  const cid = row.company_id;
  if (!cid || cid === 'N/A') continue;
  // If multiple, keep first (could also prefer SUCCESS over FAILED)
  if (!logoByCompanyId.has(cid)) {
    logoByCompanyId.set(cid, row);
  }
}

const HEADERS = [
  'company_id',
  'paper_id',
  'symbol',
  'paper_type_he',
  'identifier_status',
  'identifier_reason',
  'identifier_api',
  'identifier_success',
  'logo_exists',
  'logo_status',
  'logo_reason',
  'logo_api',
  'logo_success'
];

const out = [HEADERS];
let matched = 0;
let unmatched = 0;

for (const r of idRows) {
  const logo = logoByCompanyId.get(r.company_id);
  if (logo) matched++;
  else unmatched++;

  out.push([
    r.company_id,
    r.paper_id,
    r.symbol,
    r.paper_type_he,
    r.status,
    r.reason,
    r.api,
    r.success,
    logo ? 'yes' : 'no',
    logo ? logo.status : '',
    logo ? logo.reason : '',
    logo ? logo.api : '',
    logo ? logo.success : ''
  ]);
}

fs.writeFileSync(OUTPUT_CSV, out.map(row => row.map(csvEscape).join(',')).join('\n'));

console.log(`Identifier rows: ${idRows.length}`);
console.log(`Logo rows:       ${logoRows.length}`);
console.log(`Matched:         ${matched}`);
console.log(`Unmatched:       ${unmatched}`);
console.log(`Wrote:           ${OUTPUT_CSV}`);
