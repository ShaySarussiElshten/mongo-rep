const axios = require('axios');
const { MongoClient } = require('mongodb');
const fs = require('fs');

//const MONGO_URI = 'mongodb+srv://shay1234:2619913057@cluster0.5glztvt.mongodb.net/';
//const MONGO_URI = 'mongodb+srv://shay1234:2619913057@cluster0.5glztvt.mongodb.net/?appName=Cluster0'
const MONGO_URI = 'mongodb+srv://shay1234:2619913057@cluster1.zdqpmy9.mongodb.net/leumitrade_unsecure_dev?retryWrites=true&w=majority';

// const MONGO_URI =
//   "mongodb://shay1234:2619913057@" +
//   "cluster0-shard-00-00.5glztvt.mongodb.net:27017," +
//   "cluster0-shard-00-01.5glztvt.mongodb.net:27017," +
//   "cluster0-shard-00-02.5glztvt.mongodb.net:27017/" +
//   "leumitrade_unsecure_dev" +
//   "?ssl=true&replicaSet=atlas-5glztvt-shard-0" +
//   "&authSource=admin&retryWrites=true&w=majority";

const DB_NAME = 'leumitrade_unsecure_dev';

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

// הגדרות
const BATCH_SIZE = 100; // כמה רשומות לעבד בכל batch
const WORKERS = 10; // כמה בקשות מקבילות בתוך כל batch
let DELAY_BETWEEN_BATCHES = 300; // 300ms בין batches

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function connectToMongo(collectionName, operation) {
  const client = new MongoClient(MONGO_URI, {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(DB_NAME);
    const collection = db.collection(collectionName);
    
    return await operation(collection);
  } finally {
    await client.close();
    console.log('MongoDB connection closed');
  }
}

async function getAllDocumentsFromMongo(db) {
  const collection = db.collection('search_index');
  console.log('Counting documents in search_index...');
  const total = await collection.countDocuments();
  console.log(`Found ${total} documents in search_index. Loading...`);

  const cursor = collection
    .find({}, { projection: { paper_id: 1, symbol: 1, paper_type_he: 1 } })
    .batchSize(500);

  const allDocs = [];
  let loaded = 0;
  for await (const doc of cursor) {
    allDocs.push(doc);
    loaded++;
    if (loaded % 1000 === 0) {
      console.log(`  Loaded ${loaded}/${total} documents...`);
    }
  }
  console.log(`Loaded all ${allDocs.length} documents from search_index`);
  return allDocs;
}

async function processDocument(mongoDoc, params, mappingCollection) {
  const paperId = mongoDoc.paper_id;
  const paperTypeHe = mongoDoc.paper_type_he || 'N/A';

  if (!paperId) {
    console.log('Skipping document without paper_id:', mongoDoc._id);
    return {
      status: 'failed',
      error: { company_id: 'N/A', paper_id: 'N/A', symbol: mongoDoc.symbol || 'N/A', paper_type_he: paperTypeHe, reason: 'Missing paper_id' },
      logLine: `company_id: N/A, paper_id: N/A, symbol: ${mongoDoc.symbol || 'N/A'}, reason: Missing paper_id => paper_type_he: ${paperTypeHe}, success: 0`
    };
  }

  // בדיקה אם paper_id כבר קיים במונגו
  const existingMapping = await mappingCollection.findOne({ paper_id: paperId });
  if (existingMapping) {
    console.log(`Skipping paper_id: ${paperId} - already exists with company_id: ${existingMapping.company_id}`);
    return {
      status: 'skipped',
      logLine: `SKIPPED: company_id: ${existingMapping.company_id}, paper_id: ${paperId}, symbol: ${mongoDoc.symbol || 'N/A'}, reason: already exists => paper_type_he: ${paperTypeHe}, success: 1`
    };
  }

  console.log(`\n--- Processing symbol: ${mongoDoc.symbol}, paper_id: ${paperId} ---`);

  const { access_token } = params;
  const headers = { 'authorization': `Bearer ${access_token}` };

  const symbol = mongoDoc.symbol;
  const searchUrl = `https://rest.bridgewise.com/identifier-search?identifier=${symbol}&identifier_type=custom%2Ctase%2Cticker_exchange`;

  try {
    const searchResponse = await axios.get(searchUrl, { headers });

    const companyId = searchResponse.data[0]?.company_id;

    if (!companyId) {
      console.log(`No company_id found for symbol: ${symbol}, paper_id: ${paperId}`);
      return {
        status: 'failed',
        error: { company_id: 'N/A', paper_id: paperId, symbol, paper_type_he: paperTypeHe, reason: 'No company_id in response' },
        logLine: `company_id: N/A, paper_id: ${paperId}, symbol: ${symbol}, reason: No company_id in response => paper_type_he: ${paperTypeHe}, success: 0`
      };
    }

    const mapping = {
      company_id: companyId,
      paper_id: paperId
    };

    console.log('Mapping created:', mapping);

    const result = await mappingCollection.insertOne(mapping);
    console.log('Mapping inserted to MongoDB with _id:', result.insertedId);

    return {
      status: 'success',
      result,
      logLine: `SUCCESS: company_id: ${companyId}, paper_id: ${paperId}, symbol: ${symbol}, api: ${searchUrl} => paper_type_he: ${paperTypeHe}, success: 1`
    };

  } catch (error) {
    console.error(`Error processing symbol: ${symbol}, paper_id ${paperId}:`, error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
    }
    const reason = error.response ? `HTTP ${error.response.status}` : error.message;
    return {
      status: 'failed',
      error: { company_id: 'N/A', paper_id: paperId, symbol, paper_type_he: paperTypeHe, reason },
      logLine: `company_id: N/A, paper_id: ${paperId}, symbol: ${symbol}, reason: ${reason} => paper_type_he: ${paperTypeHe}, success: 0`
    };
  }
}

async function searchAndMapAllCompanyIds(params) {
  const client = new MongoClient(MONGO_URI, {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });
  const logFileName = `processing_log_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
  const failedRecords = [];
  
  try {
    // חיבור למונגו פעם אחת
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(DB_NAME);
    const mappingCollection = db.collection('bridgewise_identifier');

    const allDocs = await getAllDocumentsFromMongo(db);

    const results = [];
    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;

    // כתיבת כותרת לקובץ
    fs.writeFileSync(logFileName, `Processing Log - Started at ${new Date().toISOString()}\n`);
    fs.appendFileSync(logFileName, `Total documents to process: ${allDocs.length}\n`);
    fs.appendFileSync(logFileName, `Batch size: ${BATCH_SIZE}, Workers: ${WORKERS}\n`);
    fs.appendFileSync(logFileName, `Delay between batches: ${DELAY_BETWEEN_BATCHES}ms\n\n`);

    // חלוקה ל-batches
    const totalBatches = Math.ceil(allDocs.length / BATCH_SIZE);
    console.log(`\nProcessing ${allDocs.length} documents in ${totalBatches} batches of ${BATCH_SIZE} (${WORKERS} parallel workers)`);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, allDocs.length);
      const batch = allDocs.slice(start, end);

      const batchStartTime = new Date();
      console.log(`\n=== Batch ${batchIndex + 1}/${totalBatches} (Documents ${start + 1}-${end}) ===`);

      let batchSuccess = 0;
      let batchFail = 0;
      let batchSkip = 0;
      const batchLogLines = [`\n=== Batch ${batchIndex + 1}/${totalBatches} - Started at ${batchStartTime.toISOString()} ===`];

      // עיבוד מקבילי - chunks של WORKERS בקשות בו-זמנית
      for (let chunkStart = 0; chunkStart < batch.length; chunkStart += WORKERS) {
        const chunk = batch.slice(chunkStart, chunkStart + WORKERS);

        const chunkResults = await Promise.all(
          chunk.map(doc => processDocument(doc, params, mappingCollection))
        );

        // עיבוד תוצאות אחרי שכל ה-chunk סיים - כתיבה בטוחה
        for (const res of chunkResults) {
          if (res.status === 'skipped') {
            skipCount++;
            batchSkip++;
          } else if (res.status === 'success') {
            successCount++;
            batchSuccess++;
            results.push(res.result);
          } else {
            failCount++;
            batchFail++;
            if (res.error) failedRecords.push(res.error);
          }
          if (res.logLine) batchLogLines.push(res.logLine);
        }
      }

      const batchEndTime = new Date();
      const batchDuration = (batchEndTime - batchStartTime) / 1000;

      console.log(`Batch ${batchIndex + 1} completed: ${batchSuccess} success, ${batchFail} failed, ${batchSkip} skipped (${batchDuration.toFixed(2)}s)`);

      // כתיבה לקובץ פעם אחת אחרי שכל ה-batch סיים
      batchLogLines.push(`Batch ${batchIndex + 1} completed in ${batchDuration.toFixed(2)}s`);
      batchLogLines.push(`Success: ${batchSuccess}, Failed: ${batchFail}, Skip: ${batchSkip}`);
      batchLogLines.push(`Total so far - Success: ${successCount}, Failed: ${failCount}, Skip: ${skipCount}`);
      fs.appendFileSync(logFileName, batchLogLines.join('\n') + '\n');

      // Delay בין batches (למעט ה-batch האחרון)
      if (batchIndex < totalBatches - 1) {
        console.log(`Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
        await sleep(DELAY_BETWEEN_BATCHES);
      }
    }
    
    console.log(`\n=== Summary ===`);
    console.log(`Total documents: ${allDocs.length}`);
    console.log(`Successfully processed: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log(`Skipped (already exists): ${skipCount}`);

    // כתיבת סיכום לקובץ
    fs.appendFileSync(logFileName, `\n\n=== Final Summary ===\n`);
    fs.appendFileSync(logFileName, `Completed at: ${new Date().toISOString()}\n`);
    fs.appendFileSync(logFileName, `Total documents: ${allDocs.length}\n`);
    fs.appendFileSync(logFileName, `Successfully processed: ${successCount}\n`);
    fs.appendFileSync(logFileName, `Failed: ${failCount}\n`);
    fs.appendFileSync(logFileName, `Skipped (already exists): ${skipCount}\n\n`);
    
    // כתיבת רשימת כשלונות
    if (failedRecords.length > 0) {
      fs.appendFileSync(logFileName, `\n=== Failed Records (${failedRecords.length}) ===\n`);
      failedRecords.forEach((record, index) => {
        fs.appendFileSync(logFileName, `${index + 1}. company_id: ${record.company_id || 'N/A'}, paper_id: ${record.paper_id}, symbol: ${record.symbol || 'N/A'}, reason: ${record.reason} => paper_type_he: ${record.paper_type_he || 'N/A'}, success: 0\n`);
      });
    }
    
    console.log(`\nLog saved to: ${logFileName}`);
    
    return {
      total: allDocs.length,
      success: successCount,
      failed: failCount,
      skipped: skipCount,
      failedRecords: failedRecords,
      logFile: logFileName,
      results: results
    };

  } catch (error) {
    console.error('Error:', error.message);
    fs.appendFileSync(logFileName, `\n\nFATAL ERROR: ${error.message}\n`);
    throw error;
  } finally {
    await client.close();
    console.log('MongoDB connection closed');
  }
}

const params = {
  tenantId: '1',
  date: '2025-01-17',
  access_token: 'eyJraWQiOiJ1dTkxU0M5am1JSVlJNHZFcEh2OFJBT3dpR2VjU3hyVGtpMjFyZU5ydTI4PSIsImFsZyI6IlJTMjU2In0.eyJzdWIiOiI1cDRvMW9nb2Y3cmFlOWg2cDV2YWpxbTVoNyIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoicHJvZC1hcGlcL2JyaWRnZXQtY3J5cHRvLWRhdGEgcHJvZC1hcGlcL2VxdWl0aWVzLXRlY2huaWNhbC1hbmFseXNpcyBwcm9kLWFwaVwvYnJpZGdldC1nYW1pZmljYXRpb24gcHJvZC1hcGlcL25ld3MgcHJvZC1hcGlcL2VxdWl0aWVzLWZ1bmRhbWVudGFsIHByb2QtYXBpXC9iYXNpYyBwcm9kLWFwaVwvZXF1aXRpZXMtZWFybmluZy1jYWxsIHByb2QtYXBpXC9icmlkZ2V0LW1hY3JvLWRhdGEgcHJvZC1hcGlcL2VxdWl0aWVzLW5ld3MgcHJvZC1hcGlcL3JvYm8tYW5hbHlzdCBwcm9kLWFwaVwvZXF1aXRpZXMtbG9nb3MgcHJvZC1hcGlcL21hY3JvLWRhdGEgcHJvZC1hcGlcL2JyaWRnZXQtY29tcGFueS1pbnNpZ2h0IHByb2QtYXBpXC9lcXVpdGllcy1zY29yZXMgcHJvZC1hcGlcL2xvZ28gcHJvZC1hcGlcL2FsdHdpc2UtYmFzaWMgcHJvZC1hcGlcL2JyaWRnZXQtc3RvY2stY2hhcnQgcHJvZC1hcGlcL2Vhcm5pbmdzX2NhbGxfcmVjYXBzIHByb2QtYXBpXC9lYXJuaW5nc19jYWxsIHByb2QtYXBpXC9lcXVpdGllcy1jb25zZW5zdXMgcHJvZC1hcGlcL3RlbmFudC1hZG1pbiBwcm9kLWFwaVwvZXF1aXRpZXMtYmFzaWMgcHJvZC1hcGlcL2VxdWl0aWVzLXNjcmVlbmVyIHByb2QtYXBpXC90ZW5hbnQgcHJvZC1hcGlcL3NlYXJjaCBwcm9kLWFwaVwvZXNnIHByb2QtYXBpXC9icmlkZ2V0LXF1ZXN0aW9uIHByb2QtYXBpXC9lcXVpdGllcy1ldmVudHMgcHJvZC1hcGlcL2VxdWl0aWVzLWVzZyIsImF1dGhfdGltZSI6MTc3NjE1MDAwNSwiaXNzIjoiaHR0cHM6XC9cL2NvZ25pdG8taWRwLmV1LXdlc3QtMi5hbWF6b25hd3MuY29tXC9ldS13ZXN0LTJfdTYxUnRXeUtOIiwiZXhwIjoxNzc2MjM2NDA1LCJpYXQiOjE3NzYxNTAwMDUsInZlcnNpb24iOjIsImp0aSI6ImRkYjk3ZDg1LTA5YTYtNGUwYi1iMWFhLWY2MjY0M2M5MDc3MSIsImNsaWVudF9pZCI6IjVwNG8xb2dvZjdyYWU5aDZwNXZhanFtNWg3In0.RP2K4ncKA3GoeCGekEK-B03Uk4Wy5hamBh4LiCuMs8WHW7pW4xMb62ieRyKV42rsbAVSbNF4fVSqS6-uqjzEBnB0fNSliGPitKWWWVuINwERruFdY-aTg5vBRJP7QdLlsLpLnq_Dp-BeWBpMfMA6Uomi5YhaZCZzs_C29vO9-Ao10t5dLDkzMadf6x5026N_mR9V-O0a5IPg2bNAv9dmVoVVKzmXxZYNafvQ__PVyaL_msncAe2wJXU6TYec-fAN2n4rVjrRsZFHjjYZUCOh5BabQoZskmaEWAGRTFMqWiHUAz9j2w5CZoDOsmXto4h8k71aSTvBmRG4gkCQMqbjCg'
};

searchAndMapAllCompanyIds(params)
  .then(result => {
    console.log('\n=== Final Result ===');
    console.log(JSON.stringify(result, null, 2));
  })
  .catch(error => {
    console.error('Failed:', error.message);
  });

module.exports = { searchAndMapAllCompanyIds };
