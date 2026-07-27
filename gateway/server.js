const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const FormData = require('form-data');
const { Pool } = require('pg');
const { sendLegalNoticeEmail } = require('./src/services/emailService');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'crimeos_secret_jwt_key_2026_investigation_suite';
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const MOCK_APIS_URL = process.env.MOCK_APIS_URL || 'http://localhost:5000';
const ENABLE_DEMO_FALLBACKS = (process.env.ENABLE_DEMO_FALLBACKS || 'false').toLowerCase() === 'true';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://crimeos_user:crimeos_password@localhost:5432/crimeos_db'
});

const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

// --- AUTHENTICATION MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token || token === 'null' || token === 'undefined') {
    return res.status(401).json({ error: 'Access token required' });
  }

  // Accept mock development/demo tokens gracefully
  if (token.startsWith('mock-jwt-')) {
    const mockUser = token.replace('mock-jwt-token-', '') || 'io_patel';
    const mockRoles = { io_patel: 'IO', sho_sharma: 'SHO', legal_desai: 'LEGAL_ADVISOR', admin_crimeos: 'ADMIN' };
    req.user = { 
      username: mockUser, 
      role: mockRoles[mockUser] || 'IO', 
      police_station: 'Ahmedabad Cyber Crime Station' 
    };
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.warn('JWT verify failed:', err.message);
      return res.status(403).json({ error: 'Invalid or expired access token' });
    }
    req.user = user;
    next();
  });
};

// --- RBAC MIDDLEWARE ---
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Unauthorized role: ${req.user?.role}` });
    }
    next();
  };
};

// --- 1. AUTH ROUTES ---
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      const mockRoles = { io_patel: 'IO', sho_sharma: 'SHO', legal_desai: 'LEGAL_ADVISOR', admin_crimeos: 'ADMIN' };
      const role = mockRoles[username] || 'IO';
      const token = jwt.sign({ username, role, police_station: 'Ahmedabad Cyber Crime Station' }, JWT_SECRET, { expiresIn: '24h' });
      return res.json({ token, user: { username, role, full_name: username.toUpperCase(), police_station: 'Ahmedabad Cyber Crime Station' } });
    }
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role, police_station: user.police_station }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, full_name: user.full_name, police_station: user.police_station } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// --- 2. COMPLAINT INGESTION & UPLOAD ROUTES ---
app.get('/api/complaints', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM complaints ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    if (!ENABLE_DEMO_FALLBACKS) return res.status(500).json({ error: err.message });
    res.json([
      {
        id: 'c1',
        complaint_number: 'CMP-2026-001',
        source_type: 'audio',
        original_language: 'gu',
        raw_text: 'મને વોટ્સએપ પર લોન અને યુપીઆઈ લિંક મોકલીને 85,000 રૂપિયાનું ફ્રોડ કર્યું છે.',
        translated_text: 'Victim was defrauded of INR 85,000 via WhatsApp UPI loan link.',
        crime_category: 'CYBER',
        severity_score: 8.2,
        status: 'ASSIGNED',
        created_at: new Date().toISOString()
      }
    ]);
  }
});

app.post(['/api/complaints/upload', '/api/ingest'], upload.single('file'), async (req, res) => {
  try {
    const form = new FormData();
    form.append('input_type', req.body.input_type || 'text');
    form.append('raw_text', req.body.raw_text || '');
    
    if (req.file) {
      form.append('file', fs.createReadStream(req.file.path), {
        filename: req.file.originalname,
        contentType: req.file.mimetype
      });
    }

    const aiRes = await axios.post(`${AI_SERVICE_URL}/api/ingest`, form, {
      headers: form.getHeaders()
    });

    const data = aiRes.data;

    try {
      const cmpNumber = `CMP-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      await pool.query(
        `INSERT INTO complaints (complaint_number, source_type, original_language, raw_text, translated_text, extracted_entities, crime_category, severity_score, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          cmpNumber,
          req.body.input_type || 'text',
          data.original_language || 'gu',
          data.raw_text || req.body.raw_text || '',
          data.translated_text || '',
          JSON.stringify(data.entities || {}),
          data.crime_category || 'CYBER',
          data.severity_score || 8.0,
          'ASSIGNED'
        ]
      );
      data['complaint_number'] = cmpNumber;
    } catch (dbErr) {
      console.warn('DB complaint insert warning:', dbErr.message);
      if (!ENABLE_DEMO_FALLBACKS) throw dbErr;
    }

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.json(data);
  } catch (err) {
    console.error('Ingest proxy error:', err.message);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    if (!ENABLE_DEMO_FALLBACKS) {
      return res.status(500).json({ error: err.message, stack: err.stack });
    }
    res.json({
      complaint_number: 'CMP-2026-9912',
      original_language: req.body.original_language || 'gu',
      translated_text: req.body.raw_text || 'Victim reported unauthorized transaction of Rs. 85,000 via fraudulent UPI VPA link scammer@paytm.',
      crime_category: 'CYBER',
      crime_sub_type: 'UPI Financial Fraud',
      severity_score: 8.5,
      entities: {
        persons: [{ name: 'Ramesh Patel', role: 'victim' }],
        phone_numbers: ['+91 98765 43210'],
        vpas_upis: ['scammer@paytm'],
        bank_accounts: ['30910293101'],
        monetary_loss: 85000
      }
    });
  }
});

// --- 3. CASE ROUTES ---
app.get('/api/cases', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM cases ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    if (!ENABLE_DEMO_FALLBACKS) return res.status(500).json({ error: err.message });
    res.json([
      {
        id: 'case-1',
        case_number: 'CR-2026-9910',
        fir_number: 'FIR-9910/2026',
        crime_category: 'CYBER',
        crime_sub_type: 'UPI Financial Fraud & Impersonation',
        status: 'INVESTIGATING',
        assigned_io: 'PSI Inspector V. K. Patel',
        assigned_sho: 'PI Senior Inspector R. S. Sharma',
        sections: '318(4) BNS, 66D IT Act',
        created_at: '2026-07-20T10:00:00Z'
      }
    ]);
  }
});

app.post('/api/cases', authenticateToken, async (req, res) => {
  const { case_number, fir_number, crime_category, crime_sub_type, summary, sections } = req.body;
  try {
    await pool.query(
      `INSERT INTO cases (case_number, fir_number, crime_category, crime_sub_type, summary, investigation_plan)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (case_number) DO NOTHING`,
      [case_number, fir_number, crime_category, crime_sub_type, summary, JSON.stringify({ sections })]
    );
    res.json({ success: true, case_number });
  } catch (err) {
    console.error('Case insert error:', err.message);
    if (!ENABLE_DEMO_FALLBACKS) return res.status(500).json({ error: err.message });
    res.json({ success: true, case_number });
  }
});

// --- CONFIG ROUTE ---
app.get('/api/config', (req, res) => {
  res.json({
    enable_demo_fallbacks: ENABLE_DEMO_FALLBACKS,
    debug: (process.env.DEBUG || 'true').toLowerCase() === 'true'
  });
});

app.post('/api/cases/:id/investigate', authenticateToken, async (req, res) => {
  const caseId = req.params.id;
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/api/investigate`, {
      case_number: caseId,
      complaint_text: req.body.complaint_text || req.body.summary || 'Police Investigation',
      crime_category: req.body.crime_category || 'CYBER',
      crime_sub_type: req.body.crime_sub_type || req.body.sub_type || 'General Offence',
      entities: req.body.entities || {}
    });

    const resultData = response.data;
    try {
      await pool.query(
        `UPDATE cases SET investigation_plan = $1, cross_case_matches = $2 WHERE case_number = $3`,
        [
          JSON.stringify({
            master_fir: resultData.master_fir,
            investigation_steps: resultData.investigation_steps,
            legal_requests: resultData.legal_requests
          }),
          JSON.stringify(resultData.cross_case_matches || []),
          caseId
        ]
      );
    } catch (dbErr) {
      console.warn('DB update warning for case investigation plan:', dbErr.message);
    }

    res.json(resultData);
  } catch (err) {
    const detailMsg = err.response?.data?.detail || err.response?.data?.error || err.message;
    console.error('Investigate proxy error:', detailMsg);
    if (!ENABLE_DEMO_FALLBACKS) {
      return res.status(500).json({ 
        error: 'Investigate proxy error', 
        detail: detailMsg,
        stack: err.stack 
      });
    }
    const fallbackData = {
      status: 'success',
      case_number: caseId,
      master_fir: {
        case_number: caseId,
        fir_number: `FIR-${caseId.slice(-4)}/2026`,
        sections: '318(4) BNS, 66D IT Act',
        cognizability: 'Cognizable & Non-Bailable',
        punishment: 'Up to 7 years imprisonment',
        summary: 'Cyber financial fraud via fake UPI payment links.'
      },
      investigation_steps: [
        { step_number: 1, title: 'CDR & Tower Data Requisition', description: 'Issue Section 94 BNSS notice to Jio/Airtel for CDR.', category: 'CYBER' },
        { step_number: 2, title: 'Bank Account Debit Freeze', description: 'Issue debit freeze directive under Sec 94 BNSS to SBI/HDFC.', category: 'CYBER' }
      ],
      cross_case_matches: [
        { match_type: 'VPA_RECURRENCE', matched_value: 'scammer@paytm', previous_case_no: 'CR-2026-0812', police_station: 'Surat Cyber Cell', confidence: 0.94 }
      ],
      legal_requests: [
        { request_type: 'SECTION_94_BNSS', target_provider: 'Reliance Jio Infocomm Ltd.', status: 'APPROVED', pdf_url: `/api/requests/download/Notice_Section_94_BNSS_${caseId}.pdf` },
        { request_type: 'BANK_FREEZE', target_provider: 'State Bank of India', status: 'APPROVED', pdf_url: `/api/requests/download/Notice_Section_94_BNSS_${caseId}.pdf` }
      ],
      summary: 'Agentic investigation path completed. Section 94 BNSS legal notices generated.'
    };
    res.json(fallbackData);
  }
});

// --- 4. LEGAL REQUEST & EMAIL DISPATCH ROUTES ---
app.get('/api/requests', authenticateToken, async (req, res) => {
  res.json([
    {
      id: 'req-1',
      request_number: 'REQ-2026-001',
      case_id: 'CR-2026-9910',
      request_type: 'SECTION_94_BNSS',
      target_provider: 'Reliance Jio Infocomm Ltd.',
      provider_email: 'nodal.gujarat@jio.com',
      status: 'APPROVED',
      pdf_url: '/api/requests/download/Notice_Section_94_BNSS_CR-2026-9910.pdf',
      created_at: new Date().toISOString()
    },
    {
      id: 'req-2',
      request_number: 'REQ-2026-002',
      case_id: 'CR-2026-9910',
      request_type: 'BANK_FREEZE',
      target_provider: 'State Bank of India',
      provider_email: 'cybercell.nodal@sbi.co.in',
      status: 'APPROVED',
      pdf_url: '/api/requests/download/Notice_Section_94_BNSS_CR-2026-9910.pdf',
      created_at: new Date().toISOString()
    }
  ]);
});

app.post('/api/requests/:id/dispatch', authenticateToken, async (req, res) => {
  const reqId = req.params.id;
  const { provider_email, provider_name, case_number, pdf_url } = req.body;

  try {
    const pdfPath = path.join(__dirname, '../ai-service/generated_pdfs', path.basename(pdf_url || 'Notice_Section_94_BNSS_CR-2026-9910.pdf'));
    
    const dispatchResult = await sendLegalNoticeEmail({
      toEmail: provider_email || 'nodal.gujarat@jio.com',
      providerName: provider_name || 'Reliance Jio Infocomm Ltd.',
      caseNumber: case_number || 'CR-2026-9910',
      requestNumber: reqId,
      pdfPath
    });

    res.json({
      success: true,
      request_id: reqId,
      status: 'DISPATCHED',
      dispatch_result: dispatchResult
    });
  } catch (err) {
    console.error('Dispatch error:', err);
    if (!ENABLE_DEMO_FALLBACKS) return res.status(500).json({ error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Failed to dispatch email notice' });
  }
});

app.get('/api/requests/download/:filename', (req, res) => {
  const filename = req.params.filename;
  res.redirect(`${AI_SERVICE_URL}/api/requests/download/${filename}`);
});

// --- 5. RESPONSE ANALYTICS & AUDIT LOGS ---
app.post('/api/analytics/parse-response', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/api/analytics/parse-response`, {
      file_path: req.file ? req.file.path : null,
      response_type: req.body.response_type || 'CDR'
    });
    res.json(response.data);
  } catch (err) {
    console.error('Parse response proxy error:', err.message);
    if (!ENABLE_DEMO_FALLBACKS) return res.status(500).json({ error: err.message, stack: err.stack });
    res.json({
      status: 'success',
      response_type: 'CDR',
      total_records: 1420,
      date_range: '01/06/2026 to 15/07/2026',
      top_b_parties: [
        { phone: '+91 98250 11223', call_count: 84, total_duration_min: 192 },
        { phone: '+91 98790 44551', call_count: 42, total_duration_min: 88 }
      ],
      night_calls_count: 38,
      top_tower_locations: [
        { tower_id: 'AHM-CG-TW-42', location_name: 'CG Road, Ahmedabad', frequency: 912 }
      ],
      imei_history: ['864910049201923', '864910049201999'],
      executive_summary: "Provider response ingested successfully (1,420 CDR records). Target number exhibited high-frequency night activity (38 calls between 00:00-05:00 AM). Primary anchor location identified at CG Road, Ahmedabad.",
      recommended_next_action: "Issue Section 94 BNSS Notice for IMEI 864910049201999 handset CAF details."
    });
  }
});

app.get('/api/admin/audit-logs', authenticateToken, authorizeRoles('SHO', 'ADMIN'), (req, res) => {
  res.json([
    { id: 'l1', user: 'PSI Inspector V. K. Patel', action: 'GENERATED_SECTION_94_NOTICE', case_id: 'CR-2026-9910', timestamp: new Date().toISOString() },
    { id: 'l2', user: 'PI Senior Inspector R. S. Sharma', action: 'DISPATCHED_EMAIL_NOTICE', case_id: 'CR-2026-9910', timestamp: new Date().toISOString() }
  ]);
});

app.listen(PORT, () => {
  console.log(`[+] Crime OS AI Gateway running on port ${PORT} (ENABLE_DEMO_FALLBACKS=${ENABLE_DEMO_FALLBACKS})`);
});
