const { MongoClient } = require('mongodb');

const MONGO_URI =
  "mongodb://shay1234:2619913057@" +
  "ac-7qlui6o-shard-00-00.5glztvt.mongodb.net:27017," +
  "ac-7qlui6o-shard-00-01.5glztvt.mongodb.net:27017," +
  "ac-7qlui6o-shard-00-02.5glztvt.mongodb.net:27017/" +
  "leumitrade_unsecure_dev" +
  "?ssl=true&replicaSet=atlas-zh1ugv-shard-0" +
  "&authSource=admin&retryWrites=true&w=majority";

const DB_NAME = 'leumitrade_unsecure_dev';
const COLLECTION_NAME = 'bridgewise_identifier';

async function removeDuplicates() {
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
    const collection = db.collection(COLLECTION_NAME);

    // ספירה ראשונית
    const initialCount = await collection.countDocuments();
    console.log(`סה"כ רשומות בהתחלה: ${initialCount}`);

    // מציאת כל הכפילויות
    console.log('\nמחפש כפילויות...');
    const duplicates = await collection.aggregate([
      {
        $group: {
          _id: "$company_id",
          count: { $sum: 1 },
          docs: { $push: { id: "$_id", paper_id: "$paper_id" } }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]).toArray();

    console.log(`נמצאו ${duplicates.length} company_id עם כפילויות`);

    if (duplicates.length === 0) {
      console.log('✅ אין כפילויות למחיקה!');
      return;
    }

    let totalDeleted = 0;

    for (let i = 0; i < duplicates.length; i++) {
      const duplicate = duplicates[i];
      const companyId = duplicate._id;
      const docs = duplicate.docs;
      const count = duplicate.count;
      
      console.log(`\n[${i + 1}/${duplicates.length}] company_id: ${companyId} - נמצאו ${count} רשומות`);
      
      // שמירת הרשומה הראשונה ומחיקת השאר
      const keepDoc = docs[0];
      const docsToDelete = docs.slice(1);
      
      console.log(`  ✓ משאיר: paper_id ${keepDoc.paper_id} (ID: ${keepDoc.id})`);
      console.log(`  ✗ מוחק ${docsToDelete.length} רשומות: paper_ids [${docsToDelete.map(d => d.paper_id).join(', ')}]`);
      
      // מחיקת הרשומות המיותרות
      const deleteIds = docsToDelete.map(doc => doc.id);
      const deleteResult = await collection.deleteMany({
        _id: { $in: deleteIds }
      });
      
      console.log(`  → נמחקו ${deleteResult.deletedCount} רשומות`);
      totalDeleted += deleteResult.deletedCount;
    }

    console.log(`\n=== סיכום ===`);
    console.log(`company_id עם כפילויות: ${duplicates.length}`);
    console.log(`סה"כ רשומות שנמחקו: ${totalDeleted}`);

    // בדיקה סופית
    const finalCount = await collection.countDocuments();
    console.log(`רשומות בהתחלה: ${initialCount}`);
    console.log(`רשומות בסוף: ${finalCount}`);
    console.log(`הפרש: ${initialCount - finalCount}`);

    // וידוא שאין יותר כפילויות
    console.log('\nבודק שאין יותר כפילויות...');
    const remainingDuplicates = await collection.aggregate([
      {
        $group: {
          _id: "$company_id",
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]).toArray();

    if (remainingDuplicates.length === 0) {
      console.log('✅ מושלם! אין יותר כפילויות');
    } else {
      console.log(`❌ עדיין נותרו ${remainingDuplicates.length} כפילויות`);
      remainingDuplicates.forEach(dup => {
        console.log(`  company_id: ${dup._id} - ${dup.count} רשומות`);
      });
    }

  } catch (error) {
    console.error('שגיאה:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    throw error;
  } finally {
    await client.close();
    console.log('\nחיבור MongoDB נסגר');
  }
}

// הרצת הסקריפט
if (require.main === module) {
  removeDuplicates()
    .then(() => {
      console.log('\n🎉 הסקריפט הסתיים בהצלחה!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 הסקריפט נכשל:', error.message);
      process.exit(1);
    });
}

module.exports = { removeDuplicates };