const axios = require('axios');

const ACCESS_TOKEN = 'eyJraWQiOiJ1dTkxU0M5am1JSVlJNHZFcEh2OFJBT3dpR2VjU3hyVGtpMjFyZU5ydTI4PSIsImFsZyI6IlJTMjU2In0.eyJzdWIiOiIzam1wMzFrNHJocThtbWFsbWI0bGU1c3N1dCIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoicHJvZC1hcGlcL2VxdWl0aWVzLXRlY2huaWNhbC1hbmFseXNpcyBwcm9kLWFwaVwvYnJpZGdldC1nYW1pZmljYXRpb24gcHJvZC1hcGlcL25ld3MgcHJvZC1hcGlcL2VxdWl0aWVzLWZ1bmRhbWVudGFsIHByb2QtYXBpXC9iYXNpYyBwcm9kLWFwaVwvZXF1aXRpZXMtZWFybmluZy1jYWxsIHByb2QtYXBpXC9icmlkZ2V0LW1hY3JvLWRhdGEgcHJvZC1hcGlcL2VxdWl0aWVzLW5ld3MgcHJvZC1hcGlcL3JvYm8tYW5hbHlzdCBwcm9kLWFwaVwvZXF1aXRpZXMtbG9nb3MgcHJvZC1hcGlcL21hY3JvLWRhdGEgcHJvZC1hcGlcL2VxdWl0aWVzLXNjb3JlcyBwcm9kLWFwaVwvbG9nbyBwcm9kLWFwaVwvYWx0d2lzZS1iYXNpYyBwcm9kLWFwaVwvZWFybmluZ3NfY2FsbF9yZWNhcHMgcHJvZC1hcGlcL2Vhcm5pbmdzX2NhbGwgcHJvZC1hcGlcL2VxdWl0aWVzLWNvbnNlbnN1cyBwcm9kLWFwaVwvdGVuYW50LWFkbWluIHByb2QtYXBpXC9lcXVpdGllcy1iYXNpYyBwcm9kLWFwaVwvZXF1aXRpZXMtc2NyZWVuZXIgcHJvZC1hcGlcL3RlbmFudCBwcm9kLWFwaVwvc2VhcmNoIHByb2QtYXBpXC9lc2cgcHJvZC1hcGlcL2JyaWRnZXQtcXVlc3Rpb24gcHJvZC1hcGlcL2VxdWl0aWVzLWV2ZW50cyBwcm9kLWFwaVwvZXF1aXRpZXMtZXNnIiwiYXV0aF90aW1lIjoxNzc0ODYxNDI2LCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAuZXUtd2VzdC0yLmFtYXpvbmF3cy5jb21cL2V1LXdlc3QtMl91NjFSdFd5S04iLCJleHAiOjE3NzQ5NDc4MjYsImlhdCI6MTc3NDg2MTQyNiwidmVyc2lvbiI6MiwianRpIjoiMmIxYTFjOTEtMTc0OC00MTM2LWI4MmQtZTFhMTgzNzcwMmE2IiwiY2xpZW50X2lkIjoiM2ptcDMxazRyaHE4bW1hbG1iNGxlNXNzdXQifQ.WBqHDgy5Bdl0mkblhSDwM7-Xfu7tzIAfaDOj4c7sE0cDhVbj0tcukKLcsad7mMSP8rnPF9T6zYf5sl9PP8LbMfSqhMWDttbdh-PUDMzcDl8DRzyIjZnnIyhgAyRHcQkjN4MLs3bbzSS_5HisLZkozMZiZZOTSB8gFFXvm_-a-TxqP1et7zHtUcb6hmFFM_qZxcZ8kppUj2lnwMOpusG0oT3fpxVJ31HxjHRJ9hRgHmp2qpe6M4MjHP-3sj6ig4APcvpi8pwatYqRrANe1BLJu1E8wL3GRaAXdcM8Th4XMjdtManN-31yaSLw2rtxr2HTbjpLocbRb6H3xXE0n5PpAg';

const headers = { 'authorization': `Bearer ${ACCESS_TOKEN}` };

const IDENTIFIER_TYPES = [
  'custom,tase,ticker_exchange',
  'ticker_exchange',
  'tase',
  'custom',
  'isin',
  'ticker',
];

async function searchRIMO() {
  const symbol = 'ORAD';

  console.log(`Searching for symbol: ${symbol}\n`);

  for (const idType of IDENTIFIER_TYPES) {
    const url = `https://rest.bridgewise.com/identifier-search?identifier=${symbol}&identifier_type=custom%2Ctase%2Cticker_exchange`;
    try {
      const response = await axios.get(url, { headers });
      console.log(`[${idType}] =>`, JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.log(`[${idType}] => ${error.response?.status || 'ERR'}: ${error.response?.data?.message || error.message}`);
    }
  }
}

searchRIMO();
