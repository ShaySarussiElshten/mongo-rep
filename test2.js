const axios = require('axios');
const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb+srv://shay1234:2619913057@cluster0.5glztvt.mongodb.net/';
const DB_NAME = 'leumitrade_unsecure_dev';

async function connectToMongo(collectionName, operation) {
  const client = new MongoClient(MONGO_URI);
  
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

async function getCompanyLogo(params) {
  try {
    const { paper_id } = params;
    
    // שליפת המיפוי ממונגו לפי paper_id
    const mapping = await connectToMongo('bridgewise_identifier', async (collection) => {
      const doc = await collection.findOne({ paper_id: paper_id });
      console.log('Loaded mapping from MongoDB:', JSON.stringify(doc, null, 2));
      
      if (!doc || !doc.company_id) {
        throw new Error('company_id not found for paper_id: ' + paper_id);
      }
      
      return doc;
    });
    
    const companyId = mapping.company_id;
    console.log('Using company_id:', companyId);
    
    const { access_token } = params;
    const headers = { 'authorization': `Bearer ${access_token}` };
    
    // בקשה לקבלת לוגו
    const logoUrl = `https://rest.bridgewise.com/companies/${companyId}/logos`;
    console.log('Logo URL:', logoUrl);
    
    const logoResponse = await axios.get(logoUrl, { headers });
    console.log('Logo response:', JSON.stringify(logoResponse.data, null, 2));

    return {
      companyId: companyId,
      paperId: paper_id,
      logoData: logoResponse.data
    };

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    throw error;
  }
}

const params = {
  paper_id: 1080456,
  access_token: 'eyJraWQiOiJ1dTkxU0M5am1JSVlJNHZFcEh2OFJBT3dpR2VjU3hyVGtpMjFyZU5ydTI4PSIsImFsZyI6IlJTMjU2In0.eyJzdWIiOiI1cDRvMW9nb2Y3cmFlOWg2cDV2YWpxbTVoNyIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoicHJvZC1hcGlcL2JyaWRnZXQtY3J5cHRvLWRhdGEgcHJvZC1hcGlcL2VxdWl0aWVzLXRlY2huaWNhbC1hbmFseXNpcyBwcm9kLWFwaVwvYnJpZGdldC1nYW1pZmljYXRpb24gcHJvZC1hcGlcL25ld3MgcHJvZC1hcGlcL2VxdWl0aWVzLWZ1bmRhbWVudGFsIHByb2QtYXBpXC9iYXNpYyBwcm9kLWFwaVwvZXF1aXRpZXMtZWFybmluZy1jYWxsIHByb2QtYXBpXC9icmlkZ2V0LW1hY3JvLWRhdGEgcHJvZC1hcGlcL2VxdWl0aWVzLW5ld3MgcHJvZC1hcGlcL3JvYm8tYW5hbHlzdCBwcm9kLWFwaVwvZXF1aXRpZXMtbG9nb3MgcHJvZC1hcGlcL21hY3JvLWRhdGEgcHJvZC1hcGlcL2JyaWRnZXQtY29tcGFueS1pbnNpZ2h0IHByb2QtYXBpXC9lcXVpdGllcy1zY29yZXMgcHJvZC1hcGlcL2xvZ28gcHJvZC1hcGlcL2FsdHdpc2UtYmFzaWMgcHJvZC1hcGlcL2JyaWRnZXQtc3RvY2stY2hhcnQgcHJvZC1hcGlcL2Vhcm5pbmdzX2NhbGxfcmVjYXBzIHByb2QtYXBpXC9lYXJuaW5nc19jYWxsIHByb2QtYXBpXC9lcXVpdGllcy1jb25zZW5zdXMgcHJvZC1hcGlcL3RlbmFudC1hZG1pbiBwcm9kLWFwaVwvZXF1aXRpZXMtYmFzaWMgcHJvZC1hcGlcL2VxdWl0aWVzLXNjcmVlbmVyIHByb2QtYXBpXC90ZW5hbnQgcHJvZC1hcGlcL3NlYXJjaCBwcm9kLWFwaVwvZXNnIHByb2QtYXBpXC9icmlkZ2V0LXF1ZXN0aW9uIHByb2QtYXBpXC9lcXVpdGllcy1ldmVudHMgcHJvZC1hcGlcL2VxdWl0aWVzLWVzZyIsImF1dGhfdGltZSI6MTc3MzA4MjgwNSwiaXNzIjoiaHR0cHM6XC9cL2NvZ25pdG8taWRwLmV1LXdlc3QtMi5hbWF6b25hd3MuY29tXC9ldS13ZXN0LTJfdTYxUnRXeUtOIiwiZXhwIjoxNzczMTY5MjA1LCJpYXQiOjE3NzMwODI4MDUsInZlcnNpb24iOjIsImp0aSI6ImMwMWRiY2FkLWVjMmQtNDE3Ny04OWU0LWQ3NmJhZTJhMTViMiIsImNsaWVudF9pZCI6IjVwNG8xb2dvZjdyYWU5aDZwNXZhanFtNWg3In0.pGkUmOCN3Baq7IwPeF4boLW_7YQZoiGPKkDBA25_z6EpO-Qq5VPRnT-xKBXGJo1R2qbwoqq_ifwblYLf8F129XMl8KQJO-sWp-8X7oJ9c9ec_LNvq3GWUdAnDg6K8XtGy7-VRhGKRMUkEmPaka91_H5KxMqwdrknmPBXH3LLiW_jef6IoyL8A6NkbpgJqPdqH-me1vsWZaAZR63K4srhcrPvoxA4yMO_RPGI31LJjp-EuDoR-KQYo9_0pYat1gJb-WW8OndarB2i66vLum217f0KoQsdXXqdWLHXMwarWkrStKY3Ftgs8x8yUWKCb9C9mY9Aek-diH-GV2wkquaqQg'
};

getCompanyLogo(params)
  .then(result => {
    console.log('Success:', JSON.stringify(result, null, 2));
  })
  .catch(error => {
    console.error('Failed:', error.message);
  });

module.exports = { getCompanyLogo };
