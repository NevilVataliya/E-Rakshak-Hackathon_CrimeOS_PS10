const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// 1. CCTNS Mock Endpoint
app.get('/api/cctns/fir/:firNumber', (req, res) => {
  res.json({
    status: 'FOUND',
    fir_number: req.params.firNumber,
    state: 'Gujarat',
    district: 'Ahmedabad City',
    police_station: 'Cyber Crime Police Station',
    registration_date: '2026-07-20',
    complainant: 'Ramesh Patel',
    sections: ['318(4) BNS', '66D IT Act']
  });
});

// 2. eGujcop Mock Endpoint
app.get('/api/egujcop/citizen-complaint/:complaintNo', (req, res) => {
  res.json({
    portal: 'eGujcop Portal',
    complaint_no: req.params.complaintNo,
    status: 'TRANSFERRED_TO_STATION',
    assigned_station: 'Ahmedabad Cyber Crime Station',
    complainant_district: 'Ahmedabad'
  });
});

// 3. Telecom Nodal Provider Mock Endpoint (LERS CDR API)
app.post('/api/telecom/lers/cdr-request', (req, res) => {
  const { phone_number } = req.body;
  res.json({
    status: 'SUCCESS',
    request_id: 'LERS-JIO-2026-881',
    target_phone: phone_number || '+91 98765 43210',
    records_count: 142,
    records: [
      { timestamp: '2026-07-19 14:22:10', caller: phone_number, receiver: '+91 98250 11223', type: 'OUTGOING', duration: 180, tower_id: 'AHM-CG-TW-42' },
      { timestamp: '2026-07-19 15:04:33', caller: '+91 98250 11223', receiver: phone_number, type: 'INCOMING', duration: 45, tower_id: 'AHM-SATELLITE-TW-09' }
    ]
  });
});

// 4. Bank API Mock Endpoint
app.post('/api/bank/freeze-request', (req, res) => {
  res.json({
    status: 'FROZEN',
    reference_id: 'BNK-FRZ-2026-9021',
    account_number: req.body.account_number || '30910293101',
    bank_name: 'State Bank of India',
    lien_amount_inr: 85000,
    frozen_timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`[+] Mock Law Enforcement & Provider APIs running on port ${PORT}`);
});
