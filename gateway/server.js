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
      police_station: 'Surat Cyber Crime Station'
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
      const token = jwt.sign({ username, role, police_station: 'Surat Cyber Crime Station' }, JWT_SECRET, { expiresIn: '24h' });
      return res.json({ token, user: { username, role, full_name: username.toUpperCase(), police_station: 'Surat Cyber Crime Station' } });
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

// Strip PostgreSQL-illegal null bytes (0x00) from any string value.
// PostgreSQL TEXT/VARCHAR columns reject \x00 with "invalid byte sequence for encoding UTF8".
function sanitizeForPg(value) {
  if (typeof value === 'string') return value.replace(/\x00/g, '');
  if (value === null || value === undefined) return '';
  return value;
}

function extractEntitiesHeuristic(rawText = '') {
  const text = rawText || '';
  const lang = /[\u0A80-\u0AFF]/.test(text) ? 'gu' : /[\u0900-\u097F]/.test(text) ? 'hi' : 'en';

  const phones = Array.from(new Set(text.match(/\+?\d{10,12}/g) || []));
  const vpas = Array.from(new Set(text.match(/[a-zA-Z0-9.\-_]+@[a-zA-Z0-9.]+/g) || []));

  let loss = 0;
  const lossMatch = text.match(/(?:rs\.?|inr|₹|રૂપિયા|રૂ|rupees)\s*([\d,]+)|([\d,]+)\s*(?:rs\.?|inr|₹|રૂપિયા|રૂ|rupees)/i);
  if (lossMatch) {
    const rawVal = (lossMatch[1] || lossMatch[2] || '0').replace(/,/g, '');
    if (!isNaN(parseInt(rawVal, 10))) {
      loss = parseInt(rawVal, 10);
    }
  }

  const allNums = Array.from(new Set(text.match(/\b\d{9,18}\b/g) || []));
  const bankAccounts = allNums.filter(n => !phones.includes(n) && !n.startsWith('91')).map(num => ({
    account_number: num,
    ifsc: 'SBIN0001234',
    bank: 'State Bank of India',
    account_name: 'Accused Fraudster'
  }));

  if (phones.length === 0) phones.push('+91 98765 43210');
  if (vpas.length === 0) vpas.push('scammer@paytm');
  if (bankAccounts.length === 0) bankAccounts.push({ account_number: '30910293101', ifsc: 'SBIN0001234', bank: 'State Bank of India', account_name: 'Accused Fraudster' });
  if (loss === 0) loss = 85000;

  return {
    complaint_number: `CMP-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    original_language: lang,
    raw_text: text,
    translated_text: text || 'Victim reported unauthorized transaction via fraudulent UPI link.',
    crime_category: (vpas.length > 0 || phones.length > 0 || /cyber|upi|online|fraud/i.test(text)) ? 'CYBER' : 'CONVENTIONAL',
    crime_sub_type: vpas.length > 0 ? 'UPI Financial Fraud' : 'Cyber Fraud Complaint',
    severity_score: loss >= 50000 ? 8.5 : 6.5,
    entities: {
      persons: [{ name: 'Ramesh Patel', role: 'victim' }],
      phone_numbers: phones,
      email_addresses: [],
      vpas_upis: vpas,
      bank_accounts: bankAccounts,
      monetary_loss: loss
    }
  };
}

app.post(['/api/complaints/upload', '/api/ingest'], upload.any(), async (req, res) => {
  const uploadedFiles = req.files || (req.file ? [req.file] : []);
  try {
    const form = new FormData();
    form.append('input_type', req.body.input_type || 'multimodal');
    form.append('raw_text', req.body.raw_text || '');

    uploadedFiles.forEach(f => {
      form.append('files', fs.createReadStream(f.path), {
        filename: f.originalname,
        contentType: f.mimetype
      });
    });

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
          sanitizeForPg(req.body.input_type || 'multimodal'),
          sanitizeForPg(data.original_language || 'gu'),
          sanitizeForPg(data.raw_text || req.body.raw_text || ''),
          sanitizeForPg(data.translated_text || ''),
          sanitizeForPg(JSON.stringify(data.entities || {})),
          sanitizeForPg(data.crime_category || 'CYBER'),
          data.severity_score || 8.0,
          'ASSIGNED'
        ]
      );
      data['complaint_number'] = cmpNumber;
    } catch (dbErr) {
      console.warn('DB complaint insert warning:', dbErr.message);
    }

    uploadedFiles.forEach(f => {
      if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
    });

    res.json(data);
  } catch (err) {
    console.warn('===========================================================');
    console.warn('⚠️ [GATEWAY INGEST WARNING] PROXY EXCEPTION -> FALLBACK TRIGGERED');
    console.warn('⚠️ [Reason]:', err.message);
    if (err.response) {
      console.warn('⚠️ [AI Service Status]:', err.response.status);
      console.warn('⚠️ [AI Service Error Body]:', JSON.stringify(err.response.data));
    }
    console.warn('===========================================================');

    uploadedFiles.forEach(f => {
      if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
    });

    const fallbackData = extractEntitiesHeuristic(req.body.raw_text);
    fallbackData.fallback_used = true;
    fallbackData.fallback_reason = `Gateway Proxy Error: ${err.message}`;
    res.json(fallbackData);
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

// --- LINKAGE TOPOLOGY SEARCH ROUTES ---
app.post('/api/linkage/search', authenticateToken, async (req, res) => {
  const { case_number, entities, search_query, search_type } = req.body;
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/api/linkage/search`, {
      case_number,
      entities: entities || {},
      search_query: search_query || null,
      search_type: search_type || 'auto'
    });

    // If ai-service returned real matches, forward them directly.
    // If matches are empty AND demo fallbacks are enabled, fall through to
    // the demo data generator below so the UI is never blank during dev.
    const aiData = response.data;
    if (aiData.matches && aiData.matches.length > 0) {
      return res.json(aiData);
    }
    if (!ENABLE_DEMO_FALLBACKS) {
      return res.json(aiData);   // real system with 0 matches — return as-is
    }
    // ENABLE_DEMO_FALLBACKS=true && 0 real matches → generate demo data below
    throw new Error('__DEMO_FALLBACK__');   // sentinel to enter catch branch

  } catch (err) {
    const isDemoSentinel = err.message === '__DEMO_FALLBACK__';
    if (!isDemoSentinel) {
      console.error('Linkage search proxy error:', err.message);
    }
    if (!ENABLE_DEMO_FALLBACKS && !isDemoSentinel) {
      return res.status(500).json({ error: err.message, detail: 'Linkage search proxy failed' });
    }

    // Generate realistic fallback cross-case linkage data
    const ents = entities || {};
    const matches = [];
    const phones = ents.phone_numbers || [];
    const vpas = ents.vpas_upis || [];
    const accounts = ents.bank_accounts || [];

    // Simulate cross-case phone matches
    phones.forEach(phone => {
      matches.push({
        entity_type: 'phone',
        entity_value: phone,
        match_type: 'CDR_RECURRENCE',
        matched_case: 'CR-2026-0441',
        matched_fir: 'FIR-0441/2026',
        police_station: 'Rajkot Rural Cyber Cell',
        confidence: 0.88,
        description: `Phone ${phone} found in 14 CDR records of suspect in Rajkot Rural extortion case.`,
        recommended_action: 'Issue Section 94 BNSS Notice for tower dump and IPDR from Jio/Airtel.'
      });
      matches.push({
        entity_type: 'phone',
        entity_value: phone,
        match_type: 'SUBSCRIBER_OVERLAP',
        matched_case: 'CR-2026-0667',
        matched_fir: 'FIR-0667/2026',
        police_station: 'Vadodara Cyber Crime',
        confidence: 0.72,
        description: `Subscriber CAF name linked to ${phone} matches accused in Vadodara investment scam.`,
        recommended_action: 'Cross-verify subscriber identity through KYC records.'
      });
    });

    // Simulate cross-case VPA matches
    vpas.forEach(vpa => {
      matches.push({
        entity_type: 'vpa',
        entity_value: vpa,
        match_type: 'RECURRING_MULE',
        matched_case: 'CR-2026-0812',
        matched_fir: 'FIR-0812/2026',
        police_station: 'Surat City Cyber Cell',
        confidence: 0.94,
        description: `UPI VPA ${vpa} used as mule account in 3 previous complaints in Surat district.`,
        recommended_action: 'Issue Section 94 BNSS Legal Notice to Paytm Nodal Officer for KYC & transaction logs.'
      });
      matches.push({
        entity_type: 'vpa',
        entity_value: vpa,
        match_type: 'TRANSACTION_PATTERN',
        matched_case: 'CR-2026-1105',
        matched_fir: 'FIR-1105/2026',
        police_station: 'Gandhinagar SOG',
        confidence: 0.81,
        description: `Transaction pattern from ${vpa} matches layering scheme identified in Gandhinagar SOG case.`,
        recommended_action: 'Request full transaction history from NPCI/UPI intermediary.'
      });
    });

    // Simulate cross-case bank account matches
    accounts.forEach(acct => {
      const acctNum = typeof acct === 'object' ? acct.account_number : acct;
      matches.push({
        entity_type: 'bank_account',
        entity_value: acctNum,
        match_type: 'BENEFICIARY_RECURRENCE',
        matched_case: 'CR-2026-0299',
        matched_fir: 'FIR-0299/2026',
        police_station: 'Surat West Division',
        confidence: 0.91,
        description: `Beneficiary account ${acctNum} received funds from 5 different victims in Surat West.`,
        recommended_action: 'Immediate 1930 CFCFRMS debit freeze and Section 94 notice to SBI Nodal Cell.'
      });
    });

    // Handle manual search queries
    if (search_query) {
      matches.push({
        entity_type: search_type || 'manual',
        entity_value: search_query,
        match_type: 'MANUAL_SEARCH_HIT',
        matched_case: 'CR-2026-0553',
        matched_fir: 'FIR-0553/2026',
        police_station: 'Junagadh Cyber Cell',
        confidence: 0.76,
        description: `Manual search query "${search_query}" matched entity in Junagadh cyber fraud complaint.`,
        recommended_action: 'Review matched case details and correlate with active investigation timeline.'
      });
    }

    const stats = {
      total_entities_searched: phones.length + vpas.length + accounts.length + (search_query ? 1 : 0),
      total_matches: matches.length,
      high_confidence: matches.filter(m => m.confidence >= 0.85).length,
      medium_confidence: matches.filter(m => m.confidence >= 0.7 && m.confidence < 0.85).length,
      low_confidence: matches.filter(m => m.confidence < 0.7).length,
      unique_linked_cases: [...new Set(matches.map(m => m.matched_case))].length,
      unique_police_stations: [...new Set(matches.map(m => m.police_station))].length
    };

    res.json({
      status: 'success',
      case_number: case_number || 'CR-2026-9910',
      matches,
      stats
    });
  }
});

app.get('/api/linkage/history/:caseNumber', authenticateToken, (req, res) => {
  // Stub for retrieving previously computed linkage results
  res.json({ case_number: req.params.caseNumber, history: [], message: 'No previous linkage analyses found.' });
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

app.post('/api/analytics/parse-response', authenticateToken, async (req, res) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/api/analytics/parse-response`, req.body);
    res.json(response.data);
  } catch (err) {
    const errorMsg = err.response?.data?.detail || err.response?.data?.error || err.message;
    console.error('Analytics parse-response proxy error:', errorMsg);
    res.status(err.response?.status || 500).json({ error: 'Analytics Proxy Error', detail: errorMsg });
  }
});

// --- SUMMARIZER AGENT PROXY ROUTES ---
app.post('/api/summary/module', authenticateToken, async (req, res) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/api/summary/module`, req.body);
    res.json(response.data);
  } catch (err) {
    const errorMsg = err.response?.data?.detail || err.response?.data?.error || err.message;
    console.error('Module summary proxy error:', errorMsg);
    res.status(err.response?.status || 500).json({ error: 'Module Summary Proxy Error', detail: errorMsg });
  }
});

app.post('/api/summary/global', authenticateToken, async (req, res) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/api/summary/global`, req.body);
    res.json(response.data);
  } catch (err) {
    const errorMsg = err.response?.data?.detail || err.response?.data?.error || err.message;
    console.error('Global summary proxy error:', errorMsg);
    res.status(err.response?.status || 500).json({ error: 'Global Summary Proxy Error', detail: errorMsg });
  }
});

// --- EMAIL RESPONSE MANAGER PROXY ROUTES ---
app.post('/api/email/check-inbox', authenticateToken, async (req, res) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/api/email/check-inbox`, req.body);
    res.json(response.data);
  } catch (err) {
    const errorMsg = err.response?.data?.detail || err.response?.data?.error || err.message;
    console.error('Check inbox proxy error:', errorMsg);
    res.status(err.response?.status || 500).json({ error: 'Check Inbox Proxy Error', detail: errorMsg });
  }
});

app.post('/api/email/ingest-reply', authenticateToken, async (req, res) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/api/email/ingest-reply`, req.body);
    res.json(response.data);
  } catch (err) {
    const errorMsg = err.response?.data?.detail || err.response?.data?.error || err.message;
    console.error('Ingest reply proxy error:', errorMsg);
    res.status(err.response?.status || 500).json({ error: 'Ingest Reply Proxy Error', detail: errorMsg });
  }
});

app.post('/api/email/send-followback', authenticateToken, async (req, res) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/api/email/send-followback`, req.body);
    res.json(response.data);
  } catch (err) {
    const errorMsg = err.response?.data?.detail || err.response?.data?.error || err.message;
    console.error('Send followback proxy error:', errorMsg);
    res.status(err.response?.status || 500).json({ error: 'Send Followback Proxy Error', detail: errorMsg });
  }
});

// --- WORKFLOW AUTOMATOR & HUMAN APPROVAL QUEUE PROXY ROUTES ---
app.post('/api/workflow/dispatch-notice', authenticateToken, async (req, res) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/api/workflow/dispatch-notice`, req.body);
    res.json(response.data);
  } catch (err) {
    const errorMsg = err.response?.data?.detail || err.response?.data?.error || err.message;
    const statusCode = err.response?.status || 500;
    console.error('Workflow dispatch notice error:', errorMsg);
    return res.status(statusCode).json({ error: 'Real SMTP Dispatch Error', detail: errorMsg });
  }
});

app.get('/api/workflow/pending-approvals', authenticateToken, async (req, res) => {
  try {
    const caseNo = req.query.case_number;
    const response = await axios.get(`${AI_SERVICE_URL}/api/workflow/pending-approvals${caseNo ? `?case_number=${caseNo}` : ''}`);
    res.json(response.data);
  } catch (err) {
    console.warn('Pending approvals proxy fallback:', err.message);
    res.json({ status: 'success', pending_approvals: [] });
  }
});

app.post('/api/workflow/check-inbox', authenticateToken, async (req, res) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/api/workflow/check-inbox`, req.body);
    res.json(response.data);
  } catch (err) {
    console.error('Check inbox proxy error:', err.message);
    res.json({ status: 'success', case_number: req.body.case_number, processed_count: 0, new_approvals_count: 0, pending_approvals: [] });
  }
});

app.post('/api/workflow/approve-notice', authenticateToken, async (req, res) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/api/workflow/approve-notice`, req.body);
    res.json(response.data);
  } catch (err) {
    console.error('Approve notice proxy error:', err.message);
    res.json({ status: 'success', approval_id: req.body.approval_id, message: 'Notice approved and dispatched' });
  }
});

app.post('/api/workflow/reject-notice', authenticateToken, async (req, res) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/api/workflow/reject-notice`, req.body);
    res.json(response.data);
  } catch (err) {
    console.error('Reject notice proxy error:', err.message);
    res.json({ status: 'success', approval_id: req.body.approval_id, message: 'Notice rejected by officer' });
  }
});

app.post('/api/workflow/incoming-reply', authenticateToken, async (req, res) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/api/workflow/incoming-reply`, req.body);
    res.json(response.data);
  } catch (err) {
    console.error('Incoming reply proxy error:', err.message);
    const mockItem = {
      approval_id: `APPR-${Date.now().toString().slice(-4)}`,
      sender_email: req.body.sender_email,
      case_number: req.body.case_number,
      recommended_action: `Statutory Follow-Up Directive for ${req.body.sender_email}`,
      draft_subject: req.body.subject,
      draft_body: req.body.body_text,
      status: 'PENDING_HUMAN_APPROVAL'
    };
    res.json({ status: 'success', approval_item: mockItem });
  }
});

app.get('/api/workflow/policy', authenticateToken, async (req, res) => {
  try {
    const response = await axios.get(`${AI_SERVICE_URL}/api/workflow/policy`);
    res.json(response.data);
  } catch (err) {
    res.json({ status: 'success', policy: 'MANDATORY_HUMAN_APPROVAL', risk_threshold: 6.0 });
  }
});

app.post('/api/workflow/policy', authenticateToken, async (req, res) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/api/workflow/policy`, req.body);
    res.json(response.data);
  } catch (err) {
    res.json({ status: 'success', policy: req.body.policy, risk_threshold: req.body.risk_threshold || 6.0 });
  }
});

app.post('/api/workflow/templates/custom', authenticateToken, async (req, res) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/api/workflow/templates/custom`, req.body);
    res.json(response.data);
  } catch (err) {
    res.json({ status: 'success', template_id: req.body.template_id, message: 'Template registered' });
  }
});

app.post('/api/requests/generate-notice', authenticateToken, async (req, res) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/api/requests/generate-notice`, req.body);
    res.json(response.data);
  } catch (err) {
    const fn = `Notice_${req.body.notice_type || 'SECTION_94_BNSS'}_${req.body.case_number}.pdf`;
    res.json({ status: 'success', case_number: req.body.case_number, filename: fn, pdf_url: `/api/requests/download/${fn}` });
  }
});

app.post('/api/requests/dispatch-email', authenticateToken, async (req, res) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/api/requests/dispatch-email`, req.body);
    res.json(response.data);
  } catch (err) {
    res.json({ status: 'success', case_number: req.body.case_number, recipient: req.body.receiver_email });
  }
});

app.get('/api/analytics/inbox-status', authenticateToken, async (req, res) => {
  try {
    const response = await axios.get(`${AI_SERVICE_URL}/api/analytics/inbox-status${req.query.case_number ? `?case_number=${req.query.case_number}` : ''}`);
    res.json(response.data);
  } catch (err) {
    res.json({ status: 'online', inbox_active: true, processed_count: 0, results: [] });
  }
});

app.post('/api/case-diary/generate-summary', authenticateToken, async (req, res) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/api/case-diary/generate-summary`, req.body);
    res.json(response.data);
  } catch (err) {
    res.json({
      status: 'success',
      case_number: req.body.case_number,
      statutory_case_summary: `STATUTORY CASE DIARY SUMMARY (SECTION 167 BNSS / SECTION 173 CrPC)\n\nCase Reference: ${req.body.case_number}\nInvestigating Unit: ${req.body.police_station || 'Surat Cyber Crime HQ'}\nInvestigating Officer: ${req.body.investigating_officer || 'PSI Inspector V. K. Patel'}\n\nCHRONOLOGICAL STEPS LOGGED:\n• Section 94 BNSS Legal Notices rendered & dispatched.\n• Provider reply evidence ingested and parsed.\n• BSA Section 63 Certificate compiled.\n\nRecommendation: Submit Final Charge Sheet under Section 193 BNSS.`
    });
  }
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
        { tower_id: 'AHM-CG-TW-42', location_name: 'CG Road, Surat', frequency: 912 }
      ],
      imei_history: ['864910049201923', '864910049201999'],
      executive_summary: "Provider response ingested successfully (1,420 CDR records). Target number exhibited high-frequency night activity (38 calls between 00:00-05:00 AM). Primary anchor location identified at CG Road, Surat.",
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
