const axios = require('axios');
const fs = require('fs');

const ACCESS_TOKEN = 'eyJraWQiOiJ1dTkxU0M5am1JSVlJNHZFcEh2OFJBT3dpR2VjU3hyVGtpMjFyZU5ydTI4PSIsImFsZyI6IlJTMjU2In0.eyJzdWIiOiIzam1wMzFrNHJocThtbWFsbWI0bGU1c3N1dCIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoicHJvZC1hcGlcL2VxdWl0aWVzLXRlY2huaWNhbC1hbmFseXNpcyBwcm9kLWFwaVwvYnJpZGdldC1nYW1pZmljYXRpb24gcHJvZC1hcGlcL25ld3MgcHJvZC1hcGlcL2VxdWl0aWVzLWZ1bmRhbWVudGFsIHByb2QtYXBpXC9iYXNpYyBwcm9kLWFwaVwvZXF1aXRpZXMtZWFybmluZy1jYWxsIHByb2QtYXBpXC9icmlkZ2V0LW1hY3JvLWRhdGEgcHJvZC1hcGlcL2VxdWl0aWVzLW5ld3MgcHJvZC1hcGlcL3JvYm8tYW5hbHlzdCBwcm9kLWFwaVwvZXF1aXRpZXMtbG9nb3MgcHJvZC1hcGlcL21hY3JvLWRhdGEgcHJvZC1hcGlcL2VxdWl0aWVzLXNjb3JlcyBwcm9kLWFwaVwvbG9nbyBwcm9kLWFwaVwvYWx0d2lzZS1iYXNpYyBwcm9kLWFwaVwvZWFybmluZ3NfY2FsbF9yZWNhcHMgcHJvZC1hcGlcL2Vhcm5pbmdzX2NhbGwgcHJvZC1hcGlcL2VxdWl0aWVzLWNvbnNlbnN1cyBwcm9kLWFwaVwvdGVuYW50LWFkbWluIHByb2QtYXBpXC9lcXVpdGllcy1iYXNpYyBwcm9kLWFwaVwvZXF1aXRpZXMtc2NyZWVuZXIgcHJvZC1hcGlcL3RlbmFudCBwcm9kLWFwaVwvc2VhcmNoIHByb2QtYXBpXC9lc2cgcHJvZC1hcGlcL2JyaWRnZXQtcXVlc3Rpb24gcHJvZC1hcGlcL2VxdWl0aWVzLWV2ZW50cyBwcm9kLWFwaVwvZXF1aXRpZXMtZXNnIiwiYXV0aF90aW1lIjoxNzc0MzUxOTQxLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAuZXUtd2VzdC0yLmFtYXpvbmF3cy5jb21cL2V1LXdlc3QtMl91NjFSdFd5S04iLCJleHAiOjE3NzQ0MzgzNDEsImlhdCI6MTc3NDM1MTk0MSwidmVyc2lvbiI6MiwianRpIjoiMDE1OGEzMTEtNTkxZS00NTcyLTlhNTEtZGIwMDI0YzFiMWFjIiwiY2xpZW50X2lkIjoiM2ptcDMxazRyaHE4bW1hbG1iNGxlNXNzdXQifQ.a6sXo8dDZfpe93Rd-d_8GV_RteaPp2IXw8lOisaztyZw_fSbJSSDORMvrl2qI3iYD0oy-zpxhy36eeTTOJXx4aU4DNf33TKHa1tx5Iiqvi6NiPSu4B5Duxa-CfWjw4SK8kpDh3nYeAsX01hP0B04YEcU5c_ofUWt7wS5I7QZeGwEZr5XEHtDY0OYmLckSKONNo9QWFvx6VdFc6PIvuEj_tCpiFhQSFjmod8k-fq51rqJJwdz9ysKT4oXfOyVBd_bPznMMAVpMA0IijBqxsprPJoDYpZPF-Mac9oa0L7gqRAzgf2azqfZ-wZ-cH6aXLB9ZUwKiaJVO4PIIpM65ZyDiw';

const COMPANY_ID = 60518746;

async function testOneLogo() {
  const headers = { 'authorization': `Bearer ${ACCESS_TOKEN}` };
  const logoApiUrl = `https://rest.bridgewise.com/companies/${COMPANY_ID}/logos`;

  console.log('Fetching logo for company_id:', COMPANY_ID);
  console.log('URL:', logoApiUrl);

  const logoResponse = await axios.get(logoApiUrl, { headers });
  console.log('API Response:', JSON.stringify(logoResponse.data, null, 2));

  const imageUrl = logoResponse.data.links[0].url;
  const extension = logoResponse.data.links[0].extension || 'png';

  console.log('\nDownloading image...');
  const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });

  const fileName = `logo_${COMPANY_ID}.${extension}`;
  fs.writeFileSync(fileName, imageResponse.data);
  console.log(`Saved: ${fileName} (${imageResponse.data.length} bytes)`);
}

testOneLogo().catch(error => {
  console.error('Failed:', error.message);
});
