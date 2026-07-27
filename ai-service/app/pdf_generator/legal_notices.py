import os
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from datetime import datetime

def generate_section_94_bnss_pdf(output_path: str, case_data: dict, request_details: dict) -> str:
    """
    Generates an official Section 94 BNSS Notice PDF (Order to Produce Documents/Data).
    Complies with legal formats used by Indian Law Enforcement agencies.
    """
    case_data = case_data or {}
    request_details = request_details or {}
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40
    )

    styles = getSampleStyleSheet()
    
    header_style = ParagraphStyle(
        'HeaderStyle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#0D47A1')
    )
    
    sub_header_style = ParagraphStyle(
        'SubHeaderStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#111827')
    )

    body_style = ParagraphStyle(
        'BodyStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        alignment=TA_JUSTIFY
    )

    title_notice = ParagraphStyle(
        'TitleNotice',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#B91C1C')
    )

    story = []

    # Header Emblem & Police Dept Title
    story.append(Paragraph("<b>CYBER CRIME POLICE STATION</b>", header_style))
    story.append(Paragraph("POLICE DEPARTMENT | STATE LAW ENFORCEMENT", sub_header_style))
    story.append(Paragraph("Office of the Station House Officer, Cyber Crime Cell", sub_header_style))
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0D47A1'), spaceAfter=15))

    # Metadata Table
    case_no = case_data.get('case_number', 'CR-2026-9910')
    fir_no = case_data.get('fir_number', 'FIR-0042/2026')
    date_str = datetime.now().strftime("%d/%m/%Y")
    provider_name = request_details.get('target_provider', 'Nodal Legal Compliance Authority')

    meta_data = [
        [Paragraph(f"<b>Notice No:</b> POL/ACC/{case_no}/2026", body_style), Paragraph(f"<b>Date:</b> {date_str}", body_style)],
        [Paragraph(f"<b>FIR No:</b> {fir_no}", body_style), Paragraph(f"<b>Legal Authority:</b> Section 94 BNSS, 2023", body_style)],
    ]
    meta_table = Table(meta_data, colWidths=[260, 260])
    meta_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 15))

    # Notice Title
    story.append(Paragraph("<b>NOTICE U/S 94 OF BHARATIYA NAGARIK SURAKSHA SANHITA (BNSS), 2023</b>", title_notice))
    story.append(Paragraph("<i>(Corresponding to Section 91 of Code of Criminal Procedure, 1973)</i>", ParagraphStyle('Sub', parent=body_style, alignment=TA_CENTER, fontSize=9)))
    story.append(Spacer(1, 15))

    # Recipient
    story.append(Paragraph(f"<b>TO,</b>", body_style))
    story.append(Paragraph(f"<b>The Nodal Officer / Authorized Signatory,</b><br/>{provider_name}<br/>Nodal Legal Compliance Department", body_style))
    story.append(Spacer(1, 15))

    # Subject
    subj_text = f"<b>SUBJECT: Directives to produce Call Detail Records (CDR) / IPDR / Account logs for investigation under FIR No. {fir_no}.</b>"
    story.append(Paragraph(subj_text, body_style))
    story.append(Spacer(1, 12))

    # Notice Text Body
    body_p1 = f"WHEREAS, an investigation into a cognizable offence registered under <b>{case_data.get('crime_sub_type', 'Criminal Offence')}</b> (Sections: {case_data.get('sections', 'Relevant BNS & IT Act Sections')}) is currently being conducted by the undersigned Investigating Officer."
    story.append(Paragraph(body_p1, body_style))
    story.append(Spacer(1, 10))

    body_p2 = f"AND WHEREAS, it has been disclosed during the investigation that the data/records specified in the schedule below are in your possession and are considered essential and necessary for the purpose of the ongoing criminal investigation."
    story.append(Paragraph(body_p2, body_style))
    story.append(Spacer(1, 10))

    body_p3 = "NOW THEREFORE, in exercise of powers conferred under <b>Section 94 of Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023</b>, you are hereby directed to produce and furnish the required documents/certified digital logs within <b>48 hours</b> of receipt of this notice."
    story.append(Paragraph(body_p3, body_style))
    story.append(Spacer(1, 15))

    # Requisition Schedule Table
    story.append(Paragraph("<b>SCHEDULE OF REQUISITION DATA:</b>", ParagraphStyle('Sched', parent=body_style, fontName='Helvetica-Bold')))
    story.append(Spacer(1, 6))

    target_items = request_details.get('items', ['Requisition parameter details'])
    req_rows = [["S.No.", "Requisition Parameter", "Requested Details"]]
    for idx, item in enumerate(target_items, 1):
        req_rows.append([str(idx), "Target Identifiers / Range", str(item)])

    req_table = Table(req_rows, colWidths=[40, 200, 280])
    req_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0D47A1')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#9CA3AF')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(req_table)
    story.append(Spacer(1, 20))

    # Signature Block
    sig_data = [
        [Paragraph("", body_style), Paragraph("<b>Signature & Official Police Seal</b>", ParagraphStyle('RightBold', parent=body_style, alignment=TA_RIGHT))],
        [Paragraph("", body_style), Paragraph("<b>(V. K. PATEL)</b><br/>Police Inspector / IO<br/>Cyber Crime Police Station", ParagraphStyle('Right', parent=body_style, alignment=TA_RIGHT))],
    ]
    sig_table = Table(sig_data, colWidths=[260, 260])
    story.append(sig_table)

    doc.build(story)
    return output_path


def generate_section_79_it_act_takedown_pdf(output_path: str, case_data: dict, request_details: dict) -> str:
    """
    Generates an official Emergency Content Takedown Order PDF under Section 79(3)(b) IT Act, 2000
    and Rule 3(1)(b) Information Technology (Intermediary Guidelines) Rules, 2021.
    Directs Intermediaries (Meta/Google/Telegram) to immediately disable access to illegal/obscene content.
    """
    case_data = case_data or {}
    request_details = request_details or {}
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40
    )

    styles = getSampleStyleSheet()
    
    header_style = ParagraphStyle(
        'HeaderStyle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#B91C1C')
    )
    
    sub_header_style = ParagraphStyle(
        'SubHeaderStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#111827')
    )

    body_style = ParagraphStyle(
        'BodyStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        alignment=TA_JUSTIFY
    )

    title_notice = ParagraphStyle(
        'TitleNotice',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#B91C1C')
    )

    story = []

    # Header Emblem & Dept Title
    story.append(Paragraph("<b>EMERGENCY CONTENT TAKEDOWN & BLOCKING DIRECTIVE</b>", header_style))
    story.append(Paragraph("OFFICE OF THE INVESTIGATING OFFICER | CYBER CRIME CELL", sub_header_style))
    story.append(Paragraph("Issued under Sec 79(3)(b) IT Act, 2000 & Rule 3 IT Intermediary Rules, 2021", sub_header_style))
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#B91C1C'), spaceAfter=15))

    # Metadata Table
    case_no = case_data.get('case_number', 'CR-2026-1436')
    fir_no = case_data.get('fir_number', 'FIR-1436/2026')
    date_str = datetime.now().strftime("%d/%m/%Y %H:%M HRS")
    provider_name = request_details.get('target_provider', 'Meta Platforms Inc. / Google LLC / Telegram FZ-LLC')

    meta_data = [
        [Paragraph(f"<b>Directive Order No:</b> POL/TAKEDOWN/{case_no}/2026", body_style), Paragraph(f"<b>Date & Time:</b> {date_str}", body_style)],
        [Paragraph(f"<b>FIR No:</b> {fir_no}", body_style), Paragraph(f"<b>Legal Authority:</b> Sec 79(3)(b) IT Act r/w Sec 94 BNSS", body_style)],
    ]
    meta_table = Table(meta_data, colWidths=[260, 260])
    meta_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 15))

    # Notice Title
    story.append(Paragraph("<b>EMERGENCY NOTICE TO DISABLE ACCESS / REMOVE OBJECTIONABLE CONTENT</b>", title_notice))
    story.append(Paragraph("<i>(Mandatory Intermediary Compliance Notice under IT Act 2000)</i>", ParagraphStyle('Sub', parent=body_style, alignment=TA_CENTER, fontSize=9)))
    story.append(Spacer(1, 15))

    # Recipient
    story.append(Paragraph(f"<b>TO,</b>", body_style))
    story.append(Paragraph(f"<b>The Chief Compliance Officer / Grievance Officer / Nodal Legal Counsel,</b><br/>{provider_name}<br/>Intermediary Legal Compliance Department", body_style))
    story.append(Spacer(1, 15))

    # Subject
    subj_text = f"<b>SUBJECT: Immediate Order to remove, disable access, and block dissemination of objectionable video/content under FIR No. {fir_no}.</b>"
    story.append(Paragraph(subj_text, body_style))
    story.append(Spacer(1, 12))

    # Body
    body_p1 = f"WHEREAS, an investigation into cognizable offences involving <b>{case_data.get('crime_sub_type', 'Sextortion and Online Blackmail')}</b> (Sections: {case_data.get('sections', 'IT Act Sec 67A, 66E, 66D, BNS Sec 308, 351')}) is currently being conducted."
    story.append(Paragraph(body_p1, body_style))
    story.append(Spacer(1, 10))

    body_p2 = "AND WHEREAS, it has been brought to notice that objectionable, non-consensual sexually explicit / extortion content related to the victim has been uploaded or threatened to be disseminated across your platform/network."
    story.append(Paragraph(body_p2, body_style))
    story.append(Spacer(1, 10))

    body_p3 = "NOW THEREFORE, in exercise of powers under <b>Section 79(3)(b) of the Information Technology Act, 2000</b> read with <b>Rule 3 of IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021</b>, you are hereby ORDERED to:"
    story.append(Paragraph(body_p3, body_style))
    story.append(Spacer(1, 10))

    orders = [
        "1. Immediately remove, disable access to, and block the objectionable content / URLs listed in the schedule below within <b>24 hours</b>.",
        "2. Preserve all server logs, IP login records, account creation metadata, and hash signatures for a period of 180 days for investigation.",
        "3. Confirm compliance immediately via official nodal response email to the Cyber Crime Police Station."
    ]
    for o in orders:
        story.append(Paragraph(f"<b>{o}</b>", ParagraphStyle('Ord', parent=body_style, textColor=colors.HexColor('#B91C1C'))))
        story.append(Spacer(1, 4))

    story.append(Spacer(1, 12))

    # Schedule Table
    story.append(Paragraph("<b>SCHEDULE OF TARGET CONTENT / HANDLES:</b>", ParagraphStyle('Sched', parent=body_style, fontName='Helvetica-Bold')))
    story.append(Spacer(1, 6))

    target_items = request_details.get('items', ['Target URL / Account Handle details'])
    req_rows = [["S.No.", "Target Parameter", "Description / Identifier"]]
    for idx, item in enumerate(target_items, 1):
        req_rows.append([str(idx), "Target Content / Handle", str(item)])

    req_table = Table(req_rows, colWidths=[40, 200, 280])
    req_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#B91C1C')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#9CA3AF')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(req_table)
    story.append(Spacer(1, 20))

    # Signature Block
    sig_data = [
        [Paragraph("", body_style), Paragraph("<b>Signature & Official Police Seal</b>", ParagraphStyle('RightBold', parent=body_style, alignment=TA_RIGHT))],
        [Paragraph("", body_style), Paragraph("<b>(V. K. PATEL)</b><br/>Police Inspector / IO<br/>Cyber Crime Police Station", ParagraphStyle('Right', parent=body_style, alignment=TA_RIGHT))],
    ]
    sig_table = Table(sig_data, colWidths=[260, 260])
    story.append(sig_table)

    doc.build(story)
    return output_path
