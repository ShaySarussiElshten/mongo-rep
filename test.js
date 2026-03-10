const axios = require('axios');
const { MongoClient } = require('mongodb');
const fs = require('fs');

//const MONGO_URI = 'mongodb+srv://shay1234:2619913057@cluster0.5glztvt.mongodb.net/';
//const MONGO_URI = 'mongodb+srv://shay1234:2619913057@cluster0.5glztvt.mongodb.net/?appName=Cluster0'
const MONGO_URI =
  "mongodb://shay1234:2619913057@" +
  "ac-7qlui6o-shard-00-00.5glztvt.mongodb.net:27017," +
  "ac-7qlui6o-shard-00-01.5glztvt.mongodb.net:27017," +
  "ac-7qlui6o-shard-00-02.5glztvt.mongodb.net:27017/" +
  "leumitrade_unsecure_dev" +
  "?ssl=true&replicaSet=atlas-zh1ugv-shard-0" +
  "&authSource=admin&retryWrites=true&w=majority";

// const MONGO_URI =
//   "mongodb://shay1234:2619913057@" +
//   "cluster0-shard-00-00.5glztvt.mongodb.net:27017," +
//   "cluster0-shard-00-01.5glztvt.mongodb.net:27017," +
//   "cluster0-shard-00-02.5glztvt.mongodb.net:27017/" +
//   "leumitrade_unsecure_dev" +
//   "?ssl=true&replicaSet=atlas-5glztvt-shard-0" +
//   "&authSource=admin&retryWrites=true&w=majority";

const DB_NAME = 'leumitrade_unsecure_dev';

// הגדרות Rate Limiting
const DELAY_BETWEEN_REQUESTS = 0; // ללא delay בין בקשות
const BATCH_SIZE = 100; // כמה רשומות לעבד בכל batch
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

async function getAllDocumentsFromMongo() {
  return await connectToMongo('search_index', async (collection) => {
    const allDocs = await collection.find({}).toArray();
    console.log(`Found ${allDocs.length} documents in search_index`);
    return allDocs;
  });
}

async function processDocument(mongoDoc, params, mappingCollection, failedRecords, logFileName) {
  const paperId = mongoDoc.paper_id;
  
  if (!paperId) {
    console.log('Skipping document without paper_id:', mongoDoc._id);
    const errorInfo = { paper_id: 'N/A', reason: 'Missing paper_id', doc_id: mongoDoc._id };
    failedRecords.push(errorInfo);
    fs.appendFileSync(logFileName, `FAILED: paper_id: N/A, doc_id: ${mongoDoc._id}, reason: Missing paper_id\n`);
    return null;
  }

  // דילוג על paper_type_id = 10
  if (mongoDoc.paper_type_id === 10) {
    console.log(`Skipping paper_id: ${paperId} - paper_type_id is 10`);
    return 'skipped';
  }

  // בדיקה אם paper_id כבר קיים במונגו
  const existingMapping = await mappingCollection.findOne({ paper_id: paperId });
  if (existingMapping) {
    console.log(`Skipping paper_id: ${paperId} - already exists with company_id: ${existingMapping.company_id}`);
    return 'skipped';
  }
  
  console.log(`\n--- Processing paper_id: ${paperId} ---`);
  
  const { access_token } = params;
  const headers = { 'authorization': `Bearer ${access_token}` };
  
  const searchUrl = `https://rest.bridgewise.com/identifier-search?identifier=${paperId}&identifier_type=custom%2Ctase%2Cticker_exchange`;
  
  try {
    const searchResponse = await axios.get(searchUrl, { headers });
    
    const companyId = searchResponse.data[0]?.company_id;
    
    if (!companyId) {
      console.log(`No company_id found for paper_id: ${paperId}`);
      const errorInfo = { paper_id: paperId, reason: 'No company_id in response' };
      failedRecords.push(errorInfo);
      fs.appendFileSync(logFileName, `FAILED: paper_id: ${paperId}, reason: No company_id in response\n`);
      return null;
    }

    const mapping = {
      company_id: companyId,
      paper_id: paperId
    };

    console.log('Mapping created:', mapping);

    const result = await mappingCollection.insertOne(mapping);
    console.log('Mapping inserted to MongoDB with _id:', result.insertedId);

    return result;
    
  } catch (error) {
    console.error(`Error processing paper_id ${paperId}:`, error.message);
    const errorInfo = {
      paper_id: paperId,
      reason: error.message,
      status: error.response?.status || 'N/A'
    };
    failedRecords.push(errorInfo);
    fs.appendFileSync(logFileName, `FAILED: paper_id: ${paperId}, reason: ${error.message}, status: ${error.response?.status || 'N/A'}\n`);
    
    if (error.response) {
      console.error('Status:', error.response.status);
    }
    return null;
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
    
    const allDocs = await getAllDocumentsFromMongo();
    
    const results = [];
    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;
    
    // כתיבת כותרת לקובץ
    fs.writeFileSync(logFileName, `Processing Log - Started at ${new Date().toISOString()}\n`);
    fs.appendFileSync(logFileName, `Total documents to process: ${allDocs.length}\n`);
    fs.appendFileSync(logFileName, `Batch size: ${BATCH_SIZE}\n`);
    fs.appendFileSync(logFileName, `Delay between batches: ${DELAY_BETWEEN_BATCHES}ms\n\n`);
    
    // חלוקה ל-batches
    const totalBatches = Math.ceil(allDocs.length / BATCH_SIZE);
    console.log(`\nProcessing ${allDocs.length} documents in ${totalBatches} batches of ${BATCH_SIZE}`);
    
    for (let batchIndex = 227; batchIndex < totalBatches; batchIndex++) { // התחלה מ-Batch 228 (index 227)
      const start = batchIndex * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, allDocs.length);
      const batch = allDocs.slice(start, end);
      
      const batchStartTime = new Date();
      console.log(`\n=== Batch ${batchIndex + 1}/${totalBatches} (Documents ${start + 1}-${end}) ===`);
      fs.appendFileSync(logFileName, `\n=== Batch ${batchIndex + 1}/${totalBatches} - Started at ${batchStartTime.toISOString()} ===\n`);
      
      let batchSuccess = 0;
      let batchFail = 0;
      let batchSkip = 0;
      
      for (let i = batch.length - 1; i >= 0; i--) {
        const doc = batch[i];
        const result = await processDocument(doc, params, mappingCollection, failedRecords, logFileName);
        
        if (result === 'skipped') {
          skipCount++;
          batchSkip++;
        } else if (result) {
          successCount++;
          batchSuccess++;
          results.push(result);
        } else {
          failCount++;
          batchFail++;
        }
        
        // delay של 2 שניות החל מ-batch 6 ומעלה (למעט הבקשה האחרונה ב-batch)
        if (i > 0 && batchIndex >= 5) { // batch 6 ומעלה (index מתחיל מ-0)
          await sleep(2000);
        }
      }
      
      const batchEndTime = new Date();
      const batchDuration = (batchEndTime - batchStartTime) / 1000;
      
      console.log(`Batch ${batchIndex + 1} completed: ${batchSuccess} success, ${batchFail} failed, ${batchSkip} skipped`);
      fs.appendFileSync(logFileName, `Batch ${batchIndex + 1} completed in ${batchDuration.toFixed(2)}s\n`);
      fs.appendFileSync(logFileName, `Success: ${batchSuccess}, Failed: ${batchFail}, Skip: ${batchSkip}\n`);
      fs.appendFileSync(logFileName, `Total so far - Success: ${successCount}, Failed: ${failCount}, Skip: ${skipCount}\n`);
      
      // Delay בין batches (למעט ה-batch האחרון)
      if (batchIndex < totalBatches - 1) {
        console.log(`Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
        fs.appendFileSync(logFileName, `Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...\n`);
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
        fs.appendFileSync(logFileName, `${index + 1}. paper_id: ${record.paper_id}, reason: ${record.reason}, status: ${record.status || 'N/A'}\n`);
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
  access_token: 'eyJraWQiOiJ1dTkxU0M5am1JSVlJNHZFcEh2OFJBT3dpR2VjU3hyVGtpMjFyZU5ydTI4PSIsImFsZyI6IlJTMjU2In0.eyJzdWIiOiI1cDRvMW9nb2Y3cmFlOWg2cDV2YWpxbTVoNyIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoicHJvZC1hcGlcL2JyaWRnZXQtY3J5cHRvLWRhdGEgcHJvZC1hcGlcL2VxdWl0aWVzLXRlY2huaWNhbC1hbmFseXNpcyBwcm9kLWFwaVwvYnJpZGdldC1nYW1pZmljYXRpb24gcHJvZC1hcGlcL25ld3MgcHJvZC1hcGlcL2VxdWl0aWVzLWZ1bmRhbWVudGFsIHByb2QtYXBpXC9iYXNpYyBwcm9kLWFwaVwvZXF1aXRpZXMtZWFybmluZy1jYWxsIHByb2QtYXBpXC9icmlkZ2V0LW1hY3JvLWRhdGEgcHJvZC1hcGlcL2VxdWl0aWVzLW5ld3MgcHJvZC1hcGlcL3JvYm8tYW5hbHlzdCBwcm9kLWFwaVwvZXF1aXRpZXMtbG9nb3MgcHJvZC1hcGlcL21hY3JvLWRhdGEgcHJvZC1hcGlcL2JyaWRnZXQtY29tcGFueS1pbnNpZ2h0IHByb2QtYXBpXC9lcXVpdGllcy1zY29yZXMgcHJvZC1hcGlcL2xvZ28gcHJvZC1hcGlcL2FsdHdpc2UtYmFzaWMgcHJvZC1hcGlcL2JyaWRnZXQtc3RvY2stY2hhcnQgcHJvZC1hcGlcL2Vhcm5pbmdzX2NhbGxfcmVjYXBzIHByb2QtYXBpXC9lYXJuaW5nc19jYWxsIHByb2QtYXBpXC9lcXVpdGllcy1jb25zZW5zdXMgcHJvZC1hcGlcL3RlbmFudC1hZG1pbiBwcm9kLWFwaVwvZXF1aXRpZXMtYmFzaWMgcHJvZC1hcGlcL2VxdWl0aWVzLXNjcmVlbmVyIHByb2QtYXBpXC90ZW5hbnQgcHJvZC1hcGlcL3NlYXJjaCBwcm9kLWFwaVwvZXNnIHByb2QtYXBpXC9icmlkZ2V0LXF1ZXN0aW9uIHByb2QtYXBpXC9lcXVpdGllcy1ldmVudHMgcHJvZC1hcGlcL2VxdWl0aWVzLWVzZyIsImF1dGhfdGltZSI6MTc3MzA4MjgwNSwiaXNzIjoiaHR0cHM6XC9cL2NvZ25pdG8taWRwLmV1LXdlc3QtMi5hbWF6b25hd3MuY29tXC9ldS13ZXN0LTJfdTYxUnRXeUtOIiwiZXhwIjoxNzczMTY5MjA1LCJpYXQiOjE3NzMwODI4MDUsInZlcnNpb24iOjIsImp0aSI6ImMwMWRiY2FkLWVjMmQtNDE3Ny04OWU0LWQ3NmJhZTJhMTViMiIsImNsaWVudF9pZCI6IjVwNG8xb2dvZjdyYWU5aDZwNXZhanFtNWg3In0.pGkUmOCN3Baq7IwPeF4boLW_7YQZoiGPKkDBA25_z6EpO-Qq5VPRnT-xKBXGJo1R2qbwoqq_ifwblYLf8F129XMl8KQJO-sWp-8X7oJ9c9ec_LNvq3GWUdAnDg6K8XtGy7-VRhGKRMUkEmPaka91_H5KxMqwdrknmPBXH3LLiW_jef6IoyL8A6NkbpgJqPdqH-me1vsWZaAZR63K4srhcrPvoxA4yMO_RPGI31LJjp-EuDoR-KQYo9_0pYat1gJb-WW8OndarB2i66vLum217f0KoQsdXXqdWLHXMwarWkrStKY3Ftgs8x8yUWKCb9C9mY9Aek-diH-GV2wkquaqQg'
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
