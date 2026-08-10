const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Configure SMTP transport from environment variables
const createTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });
  }
  // Return null if credentials are not configured (will use mock dispatch fallback)
  return null;
};

/**
 * Dispatches an official Section 94 BNSS or LERS legal request email to provider nodal officer.
 * Attaches the generated legal PDF document.
 */
const sendLegalNoticeEmail = async ({ toEmail, providerName, caseNumber, requestNumber, pdfPath, noticeType = 'SECTION_94_BNSS' }) => {
  const transporter = createTransporter();

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; color: #111827; max-width: 600px; margin: 0 auto; border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #0D47A1; color: #FFFFFF; padding: 20px; text-align: center;">
        <h2 style="margin: 0;">Surat CYBER CRIME CELL</h2>
        <p style="margin: 5px 0 0 0; font-size: 14px;">GUJARAT POLICE DEPARTMENT | GOVERNMENT OF GUJARAT</p>
      </div>
      
      <div style="padding: 24px; background-color: #FFFFFF;">
        <p style="margin-top: 0;"><strong>OFFICIAL LEGAL NOTICE U/S 94 BNSS, 2023</strong></p>
        <p>To,<br/><strong>The Nodal Officer / Legal Compliance Dept.</strong><br/>${providerName}</p>

        <p>This email serves as an official notice issued under <strong>Section 94 of Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023</strong> regarding ongoing criminal investigation in <strong>Case No. ${caseNumber}</strong> (Notice No: <strong>${requestNumber}</strong>).</p>

        <p>You are hereby directed to produce the requisitioned records (CDR / IPDR / Account logs / Debit Freeze confirmation) specified in the attached official document within <strong>48 hours</strong>.</p>

        <div style="background-color: #F3F4F6; padding: 12px; border-left: 4px solid #0D47A1; margin: 20px 0;">
          <p style="margin: 0; font-size: 13px;"><strong>Attached Document:</strong> ${path.basename(pdfPath || 'Section_94_BNSS_Notice.pdf')}</p>
          <p style="margin: 5px 0 0 0; font-size: 12px; color: #6B7280;">Signed & Approved by Investigating Officer PSI V. K. Patel, Surat Cyber Crime Station.</p>
        </div>

        <p style="font-size: 12px; color: #6B7280; margin-bottom: 0;">Please acknowledge receipt of this email notice. Replies with attached data should quote Notice No: ${requestNumber}.</p>
      </div>

      <div style="background-color: #F9FAFB; padding: 12px; text-align: center; font-size: 11px; color: #9CA3AF; border-top: 1px solid #E5E7EB;">
        Official Law Enforcement Communication — Police Headquarters, Surat, Gujarat, India
      </div>
    </div>
  `;

  if (!transporter) {
    console.log(`[+] [MOCK EMAIL DISPATCH] Notice ${requestNumber} dispatched to ${toEmail} (${providerName}). Attached PDF: ${pdfPath}`);
    return {
      status: 'MOCK_DISPATCH_SUCCESS',
      recipient: toEmail,
      provider: providerName,
      timestamp: new Date().toISOString()
    };
  }

  try {
    const attachments = [];
    if (pdfPath && fs.existsSync(pdfPath)) {
      attachments.push({
        filename: path.basename(pdfPath),
        path: pdfPath
      });
    }

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Surat Cyber Police" <nodal.cyber@police.gujarat.gov.in>',
      to: toEmail,
      subject: `[LEGAL NOTICE] Section 94 BNSS Requisition Notice - Case ${caseNumber} (${requestNumber})`,
      html: htmlContent,
      attachments
    });

    console.log(`[+] Real Email Dispatched successfully: ${info.messageId}`);
    return {
      status: 'REAL_DISPATCH_SUCCESS',
      messageId: info.messageId,
      recipient: toEmail,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    console.error('[-] Email dispatch error:', err);
    throw err;
  }
};

module.exports = {
  sendLegalNoticeEmail
};
