const { MongoClient } = require('mongodb');
const fs = require('fs');

const MONGO_URI = 'mongodb+srv://shay1234:2619913057@cluster1.zdqpmy9.mongodb.net/leumitrade_unsecure_dev?retryWrites=true&w=majority';
const DB_NAME = 'leumitrade_unsecure_dev';
const FAILED_FILE = './failed.txt';

async function enrichFailedLog() {
  const raw = fs.readFileSync(FAILED_FILE, 'utf-8');
  const lines = raw.split('\n');

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  console.log('Connected to MongoDB');

  const searchIndex = client.db(DB_NAME).collection('search_index');

  const enrichedLines = await Promise.all(lines.map(async (line) => {
    const match = line.match(/company_id:\s*(\d+),\s*paper_id:\s*(\d+),\s*reason:\s*(.+)/);
    if (!match) return line; // header, empty line, summary — keep as-is

    const company_id = match[1];
    const paper_id = parseInt(match[2]);
    const reason = match[3];

    const doc = await searchIndex.findOne({ paper_id });
    const symbol = doc?.symbol ?? 'N/A';

    return `company_id: ${company_id}, paper_id: ${paper_id}, symbol: ${symbol}, reason: ${reason}`;
  }));

  await client.close();
  console.log('MongoDB connection closed');

  fs.writeFileSync(FAILED_FILE, enrichedLines.join('\n'), 'utf-8');
  console.log(`Done. Updated ${FAILED_FILE}`);
}

enrichFailedLog().catch(err => {
  console.error('Fatal error:', err.message);
});
