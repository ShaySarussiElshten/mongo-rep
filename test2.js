const axios = require('axios');
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const MONGO_URI = 'mongodb+srv://shay1234:2619913057@cluster1.zdqpmy9.mongodb.net/leumitrade_unsecure_dev?retryWrites=true&w=majority';
const DB_NAME = 'leumitrade_unsecure_dev';

const BATCH_SIZE = 10;
const DELAY_BETWEEN_BATCHES = 500;

const PAPER_IDS_FILTER = [
  1148899, 1148907, 1148931, 1148949, 1148956, 1148964, 1148980, 1149020, 1149038, 1149053,
  1149103, 1149137, 1149160, 1149228, 1149244, 1149251, 1149285, 1149301, 1149335, 1149848,
  1149855, 1149863, 1149871, 1149889, 1149897, 1149905, 1149939, 1149970, 1150036, 1150192,
  1150200, 1150374, 1150440, 1150473, 1150499, 1150523, 1150606, 1150622, 1150671, 1150713,
  1150739, 1150747, 1155092, 1155191, 1155340, 1161827, 1166172, 1167568, 1167576, 1169622,
  1184092, 1190685, 1190776, 1190859, 1194141, 1194182, 1207729, 1210970, 1213594, 1220391,
  1226927, 1231919, 1233170, 5100110, 5100169, 5100565, 5100771, 5101670, 5101704, 5101712,
  5102371, 5102470, 5102488, 5102652, 5102850, 5102876, 5103247, 5103403, 5103999, 5104476,
  5104823, 5105390, 5106422, 5106430, 5106885, 5107156, 5107453, 5107503, 5107859, 5108006,
  5108253, 5110051, 5110150, 5110176, 5110192, 5110333, 5110341, 5110374, 5110531, 5110655,
  5110929, 5111059, 5111117, 5111133, 5111190, 5111216, 5111273, 5111299, 5111331, 5111356,
  5111398, 5111414, 5111455, 5111570, 5111695, 5111836, 5111869, 5111885, 5111992, 5112560,
  5112586, 5112768, 5113105, 5113121, 5113188, 5113568, 5113782, 5114939, 5115068, 5115076,
  5115290, 5115365, 5115548, 5115555, 5115738, 5115894, 5115928, 5115936, 5115977, 5115985,
  5115993, 5116009, 5116660, 5116785, 5116793, 5117007, 5117130, 5117239, 5117247, 5117262,
  5117270, 5117288, 5117460, 5117841, 5118419, 5118849, 5119409, 5119441, 5119458, 5119763,
  5120340, 5120779, 5121363, 5121801, 5121819, 5121835, 5122114, 5122510, 5122536, 5122551,
  5122932, 5123104, 5123112, 5123559, 5124672, 5124698, 5124706, 5124912, 5125208, 5125216,
  5125281, 5125646, 5125828, 5125836, 5125935, 5125943, 5125950, 5125992, 5127188, 5127360,
  5127501, 5127527, 5127774, 5127782, 5127790, 5127808, 5128095, 5128103, 5128111, 5128137,
  5128194, 5128202, 5128210, 5128236, 5128244, 5128251, 5128293, 5128590, 5128871, 5128897,
  5129143, 5129168, 5129275, 5129283, 5129408, 5129424, 5129465, 5129473, 5129523, 5129663,
  5129689, 5129697, 5129705, 5129721, 5129739, 5129762, 5129770, 5129788, 5130018, 5130026,
  5130273, 5130505, 5130638, 5130661, 5131081, 5131107, 5131164, 5131180, 5131404, 5131420,
  5131792, 5132030, 5132295, 5132428, 5132436, 5132592, 5132634, 5132865, 5132998, 5133145,
  5133152, 5133574, 5133608, 5133616, 5133756, 5133764, 5134101, 5134705, 5134754, 5134762,
  5135041, 5135322, 5135348, 5135736, 5135835, 5135843, 5136213, 5136221, 5136379, 5137021,
  5137039, 5137088, 5137195, 5137203, 5137310, 5137435, 5137807, 5137815, 5137948, 5138300,
  5138409, 5138722, 5138847, 5138854, 5138862, 5138888, 5139571, 5139639, 5139837, 5139985,
  5140009, 5140132, 5140561, 5140629, 5140710, 5140728, 5140926, 5140991, 5141460, 5141775,
  5141783, 5141932, 5142021, 5142187, 5231030, 5231055, 5231097
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const ACCESS_TOKEN = 'eyJraWQiOiJ1dTkxU0M5am1JSVlJNHZFcEh2OFJBT3dpR2VjU3hyVGtpMjFyZU5ydTI4PSIsImFsZyI6IlJTMjU2In0.eyJzdWIiOiI1cDRvMW9nb2Y3cmFlOWg2cDV2YWpxbTVoNyIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoicHJvZC1hcGlcL2JyaWRnZXQtY3J5cHRvLWRhdGEgcHJvZC1hcGlcL2VxdWl0aWVzLXRlY2huaWNhbC1hbmFseXNpcyBwcm9kLWFwaVwvYnJpZGdldC1nYW1pZmljYXRpb24gcHJvZC1hcGlcL25ld3MgcHJvZC1hcGlcL2VxdWl0aWVzLWZ1bmRhbWVudGFsIHByb2QtYXBpXC9iYXNpYyBwcm9kLWFwaVwvZXF1aXRpZXMtZWFybmluZy1jYWxsIHByb2QtYXBpXC9icmlkZ2V0LW1hY3JvLWRhdGEgcHJvZC1hcGlcL2VxdWl0aWVzLW5ld3MgcHJvZC1hcGlcL3JvYm8tYW5hbHlzdCBwcm9kLWFwaVwvZXF1aXRpZXMtbG9nb3MgcHJvZC1hcGlcL21hY3JvLWRhdGEgcHJvZC1hcGlcL2JyaWRnZXQtY29tcGFueS1pbnNpZ2h0IHByb2QtYXBpXC9lcXVpdGllcy1zY29yZXMgcHJvZC1hcGlcL2xvZ28gcHJvZC1hcGlcL2FsdHdpc2UtYmFzaWMgcHJvZC1hcGlcL2JyaWRnZXQtc3RvY2stY2hhcnQgcHJvZC1hcGlcL2Vhcm5pbmdzX2NhbGxfcmVjYXBzIHByb2QtYXBpXC9lYXJuaW5nc19jYWxsIHByb2QtYXBpXC9lcXVpdGllcy1jb25zZW5zdXMgcHJvZC1hcGlcL3RlbmFudC1hZG1pbiBwcm9kLWFwaVwvZXF1aXRpZXMtYmFzaWMgcHJvZC1hcGlcL2VxdWl0aWVzLXNjcmVlbmVyIHByb2QtYXBpXC90ZW5hbnQgcHJvZC1hcGlcL3NlYXJjaCBwcm9kLWFwaVwvZXNnIHByb2QtYXBpXC9icmlkZ2V0LXF1ZXN0aW9uIHByb2QtYXBpXC9lcXVpdGllcy1ldmVudHMgcHJvZC1hcGlcL2VxdWl0aWVzLWVzZyIsImF1dGhfdGltZSI6MTc3NjE1MDAwNSwiaXNzIjoiaHR0cHM6XC9cL2NvZ25pdG8taWRwLmV1LXdlc3QtMi5hbWF6b25hd3MuY29tXC9ldS13ZXN0LTJfdTYxUnRXeUtOIiwiZXhwIjoxNzc2MjM2NDA1LCJpYXQiOjE3NzYxNTAwMDUsInZlcnNpb24iOjIsImp0aSI6ImRkYjk3ZDg1LTA5YTYtNGUwYi1iMWFhLWY2MjY0M2M5MDc3MSIsImNsaWVudF9pZCI6IjVwNG8xb2dvZjdyYWU5aDZwNXZhanFtNWg3In0.RP2K4ncKA3GoeCGekEK-B03Uk4Wy5hamBh4LiCuMs8WHW7pW4xMb62ieRyKV42rsbAVSbNF4fVSqS6-uqjzEBnB0fNSliGPitKWWWVuINwERruFdY-aTg5vBRJP7QdLlsLpLnq_Dp-BeWBpMfMA6Uomi5YhaZCZzs_C29vO9-Ao10t5dLDkzMadf6x5026N_mR9V-O0a5IPg2bNAv9dmVoVVKzmXxZYNafvQ__PVyaL_msncAe2wJXU6TYec-fAN2n4rVjrRsZFHjjYZUCOh5BabQoZskmaEWAGRTFMqWiHUAz9j2w5CZoDOsmXto4h8k71aSTvBmRG4gkCQMqbjCg';

const headers = { 'authorization': `Bearer ${ACCESS_TOKEN}` };

async function downloadAllLogos() {
  const timestampFolder = `images_${new Date().toISOString().replace(/[:.]/g, '-')}`;
  fs.mkdirSync(timestampFolder, { recursive: true });

  const processingLogFile = path.join(timestampFolder, 'processing_log.txt');
  fs.writeFileSync(processingLogFile, `Logo download processing log - ${new Date().toISOString()}\n\n`);

  const log = (msg) => fs.appendFileSync(processingLogFile, msg + '\n');
  // Minimal console output so user knows it started + where the file is
  process.stdout.write(`Writing run output to: ${processingLogFile}\n`);

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    log('Connected to MongoDB');

    const db = client.db(DB_NAME);
    const collection = db.collection('bridgewise_identifier');
    const searchIndex = db.collection('search_index');

    const allDocs = await collection.find({}).toArray();
    log(`Found ${allDocs.length} documents in bridgewise_identifier\n`);

    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;
    const totalBatches = Math.ceil(allDocs.length / BATCH_SIZE);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, allDocs.length);
      const batch = allDocs.slice(start, end);

      const batchLogLines = [`=== Batch ${batchIndex + 1}/${totalBatches} (${start + 1}-${end}) ===`];

      const results = await Promise.all(batch.map(async (doc) => {
        const { company_id, paper_id } = doc;

        // Look up symbol + paper_type_he from search_index by paper_id
        const indexDoc = await searchIndex.findOne({ paper_id });
        const symbol = indexDoc?.symbol || 'N/A';
        const paperTypeHe = indexDoc?.paper_type_he || 'N/A';

        if (!indexDoc || !indexDoc.symbol) {
          const reason = `No symbol found in search_index for paper_id=${paper_id}`;
          return {
            status: 'failed',
            logLine: `company_id: ${company_id}, paper_id: ${paper_id}, symbol: ${symbol}, reason: ${reason} => paper_type_he: ${paperTypeHe}, success: 0`
          };
        }

        const folderName = indexDoc.country_id === 1 ? String(paper_id) : symbol;
        const symbolFolder = path.join(timestampFolder, 'light', folderName);
        const filePath = path.join(symbolFolder, 'square.png');
        const logoApiUrl = `https://rest.bridgewise.com/companies/${company_id}/logos`;

        // Skip if already downloaded
        if (fs.existsSync(filePath)) {
          return {
            status: 'skipped',
            logLine: `SKIPPED: company_id: ${company_id}, paper_id: ${paper_id}, symbol: ${symbol}, reason: already exists => paper_type_he: ${paperTypeHe}, success: 1`
          };
        }

        try {
          // Get logo URL from Bridgewise API
          const logoResponse = await axios.get(logoApiUrl, { headers });

          const links = logoResponse.data?.links;
          if (!links || links.length === 0) {
            throw new Error('No logo links in response');
          }

          const imageUrl = links[0].url;

          // Download the image
          const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
          fs.mkdirSync(symbolFolder, { recursive: true });
          fs.writeFileSync(filePath, imageResponse.data);

          return {
            status: 'success',
            logLine: `SUCCESS: company_id: ${company_id}, paper_id: ${paper_id}, symbol: ${symbol}, api: ${logoApiUrl} => paper_type_he: ${paperTypeHe}, success: 1`
          };

        } catch (error) {
          const reason = error.response ? `HTTP ${error.response.status}` : error.message;
          return {
            status: 'failed',
            logLine: `company_id: ${company_id}, paper_id: ${paper_id}, symbol: ${symbol}, reason: ${reason} => paper_type_he: ${paperTypeHe}, success: 0`
          };
        }
      }));

      results.forEach(r => {
        if (r.status === 'success') successCount++;
        else if (r.status === 'skipped') skipCount++;
        else failCount++;
        if (r.logLine) batchLogLines.push(r.logLine);
      });

      fs.appendFileSync(processingLogFile, batchLogLines.join('\n') + '\n');
      // Single console line per batch so user has a heartbeat
      process.stdout.write(`Batch ${batchIndex + 1}/${totalBatches} done — success: ${successCount}, skipped: ${skipCount}, failed: ${failCount}\n`);

      if (batchIndex < totalBatches - 1) {
        await sleep(DELAY_BETWEEN_BATCHES);
      }
    }

    // Write summary to processing log
    fs.appendFileSync(processingLogFile, `\n=== Summary ===\nTotal: ${allDocs.length}\nSuccess: ${successCount}\nSkipped: ${skipCount}\nFailed: ${failCount}\nImages saved to: ${timestampFolder}/\n`);
    process.stdout.write(`\nDone. See: ${processingLogFile}\n`);

  } finally {
    await client.close();
    log('MongoDB connection closed');
  }
}

downloadAllLogos().catch(error => {
  console.error('Fatal error:', error.message);
});
