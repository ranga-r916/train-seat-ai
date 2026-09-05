import io
import os
import qrcode
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

def build_ticket_pdf(booking, base_url: str = "") -> bytes:
    """
    Generates an official Electronic Reservation Slip (ERS) PDF for a train booking.
    Returns bytes of the generated PDF file.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    
    # Custom Typography Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=18,
        textColor=colors.HexColor('#0f172a'),
        alignment=TA_LEFT
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#475569')
    )

    badge_style = ParagraphStyle(
        'Badge',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#059669'),
        alignment=TA_RIGHT
    )

    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=13,
        textColor=colors.HexColor('#1e293b'),
        spaceAfter=4
    )

    cell_label = ParagraphStyle(
        'CellLabel',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor('#64748b')
    )

    cell_value = ParagraphStyle(
        'CellValue',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=11,
        textColor=colors.HexColor('#0f172a')
    )

    cell_value_bold = ParagraphStyle(
        'CellValueBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=12,
        textColor=colors.HexColor('#0f172a')
    )

    legal_style = ParagraphStyle(
        'LegalStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7,
        leading=9.5,
        textColor=colors.HexColor('#64748b')
    )

    story = []

    # 1. Header with Train Logo & Title
    pnr_short = f"TSA-{str(booking.id).replace('-', '').upper()[:8]}"
    booking_status_text = (booking.status.value if hasattr(booking.status, 'value') else str(booking.status)).upper()
    status_color = "#059669" if "CONFIRM" in booking_status_text or "OCCUPIED" in booking_status_text else "#d97706"

    header_table_data = [
        [
            Paragraph("🚆 <b>INDIAN RAILWAYS &bull; TRAIN SEAT AI</b><br/><font size=8 color='#475569'>Autonomous Dynamic Priority Seating System &bull; Electronic Reservation Slip (ERS)</font>", title_style),
            Paragraph(f"<b>PNR / BOOKING REF:</b><br/><font size=12 color='#2563eb'><b>{pnr_short}</b></font><br/><font size=8.5 color='{status_color}'><b>STATUS: {booking_status_text}</b></font>", badge_style)
        ]
    ]
    header_table = Table(header_table_data, colWidths=[360, 180])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#2563eb"), spaceAfter=12))

    # 2. Train & Journey Details
    train_name = booking.train.train_name if booking.train else "Intercity Express"
    train_num = booking.train.train_number if booking.train else "12079"
    dep_time = booking.train.departure_time if booking.train else "06:00"
    arr_time = booking.train.arrival_time if booking.train else "10:00"
    journey_date_str = str(booking.journey_date)

    journey_data = [
        [
            Paragraph("TRAIN NUMBER & NAME", cell_label),
            Paragraph("JOURNEY DATE", cell_label),
            Paragraph("DEPARTURE TIME", cell_label),
            Paragraph("ARRIVAL TIME", cell_label)
        ],
        [
            Paragraph(f"<b>{train_num}</b> - {train_name}", cell_value_bold),
            Paragraph(f"<b>{journey_date_str}</b>", cell_value),
            Paragraph(f"{dep_time} IST", cell_value),
            Paragraph(f"{arr_time} IST", cell_value)
        ],
        [
            Paragraph("BOARDING / FROM STATION", cell_label),
            Paragraph("DESTINATION / TO STATION", cell_label),
            Paragraph("SEATING QUOTA / TIER", cell_label),
            Paragraph("BOOKING TYPE", cell_label)
        ],
        [
            Paragraph(f"<b>{booking.source_station}</b>", cell_value_bold),
            Paragraph(f"<b>{booking.destination_station}</b>", cell_value_bold),
            Paragraph(f"{booking.user.priority.value if (booking.user and hasattr(booking.user.priority, 'value')) else 'General'}", cell_value),
            Paragraph("Autonomous AI Priority Allocation", cell_value)
        ]
    ]
    journey_table = Table(journey_data, colWidths=[180, 120, 120, 120])
    journey_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f8fafc')),
        ('BACKGROUND', (0, 2), (-1, 2), colors.HexColor('#f8fafc')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(journey_table)
    story.append(Spacer(1, 12))

    # 3. Passenger Details & Seat Allocation
    story.append(Paragraph("PASSENGER & SEAT ALLOCATION DETAILS", section_heading))
    
    passenger_name = booking.user.name if booking.user else "Passenger"
    passenger_age = str(booking.user.verified_age) if (booking.user and booking.user.verified_age) else "N/A"
    passenger_gender = booking.user.verified_gender if (booking.user and booking.user.verified_gender) else "N/A"
    coach_val = booking.seat.coach.coach_number if (booking.seat and booking.seat.coach) else "WL"
    seat_val = booking.seat.seat_number if booking.seat else (f"WL-{booking.waitlist_position}" if booking.waitlist_position else "Waitlist")
    
    # Priority badge text
    priority_raw = booking.user.priority.value if (booking.user and hasattr(booking.user.priority, 'value')) else "P4"
    if "P1" in priority_raw or "SENIOR" in priority_raw:
        priority_desc = "P1 &bull; Senior Citizen (Lower Berth Guarantee)"
    elif "P2" in priority_raw or "DISABLE" in priority_raw:
        priority_desc = "P2 &bull; Divyangjan / Accessible Seat"
    elif "P3" in priority_raw or "FEMALE" in priority_raw:
        priority_desc = "P3 &bull; Female Passenger (Dedicated Safety Coach)"
    else:
        priority_desc = "P4 &bull; General Commuter"

    passenger_data = [
        [
            Paragraph("#", cell_label),
            Paragraph("PASSENGER NAME", cell_label),
            Paragraph("AGE / GENDER", cell_label),
            Paragraph("COACH", cell_label),
            Paragraph("BERTH / SEAT", cell_label),
            Paragraph("STATUS", cell_label)
        ],
        [
            Paragraph("1", cell_value),
            Paragraph(f"<b>{passenger_name}</b><br/><font size=7 color='#059669'>✓ Aadhaar Verified &bull; {priority_desc}</font>", cell_value),
            Paragraph(f"{passenger_age} Yrs / {passenger_gender}", cell_value),
            Paragraph(f"<b>Coach {coach_val}</b>", cell_value_bold),
            Paragraph(f"<b>Seat {seat_val}</b>", cell_value_bold),
            Paragraph(f"<font color='{status_color}'><b>{booking_status_text}</b></font>", cell_value_bold)
        ]
    ]
    passenger_table = Table(passenger_data, colWidths=[24, 210, 86, 70, 80, 70])
    passenger_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f1f5f9')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(passenger_table)
    story.append(Spacer(1, 14))

    # 4. QR Code & Turnstile Station Gate Pass
    story.append(Paragraph("CONTACTLESS STATION TURNSTILE GATE PASS", section_heading))
    
    # Generate QR Code image
    scan_url = f"{base_url}/scan-gate/{booking.id}" if base_url else f"https://trainseatai.irctc.gov.in/scan-gate/{booking.id}"
    qr = qrcode.QRCode(version=1, box_size=5, border=1)
    qr.add_data(scan_url)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white")
    qr_buf = io.BytesIO()
    qr_img.save(qr_buf, format="PNG")
    qr_buf.seek(0)
    rl_qr = RLImage(qr_buf, width=82, height=82)

    qr_expl_text = (
        "<b>AUTOMATIC GATE SCAN INSTRUCTIONS:</b><br/>"
        "&bull; Display this high-contrast QR code on your mobile phone at the automatic turnstile entry gate.<br/>"
        "&bull; Scanning at entry automatically transitions your seat state to <b>OCCUPIED (Boarded)</b> on the train manager dashboard.<br/>"
        "&bull; Scan again at the exit turnstile at your destination to liberate the seat for the next multileg commuter.<br/>"
        f"&bull; <i>Digital Gate Verification URL: {scan_url}</i>"
    )

    qr_table_data = [
        [
            rl_qr,
            Paragraph(qr_expl_text, ParagraphStyle('QRExpl', parent=styles['Normal'], fontSize=8, leading=11, textColor=colors.HexColor('#334155')))
        ]
    ]
    qr_table = Table(qr_table_data, colWidths=[95, 445])
    qr_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e1')),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(qr_table)
    story.append(Spacer(1, 14))

    # 5. Payment & Fare Summary
    story.append(Paragraph("FARE & PAYMENT BREAKDOWN", section_heading))
    fare_amount = float(booking.payment.amount) if (booking.payment and booking.payment.amount) else 120.0
    payment_method_str = booking.payment.method.value if (booking.payment and hasattr(booking.payment.method, 'value')) else "UPI / Auto-Confirmed"
    rzp_id = booking.payment.razorpay_payment_id if (booking.payment and booking.payment.razorpay_payment_id) else f"PAY_{str(booking.id)[:8].upper()}"

    fare_data = [
        [
            Paragraph("TICKET FARE", cell_label),
            Paragraph("CONCESSION / SUBSIDY", cell_label),
            Paragraph("GST & CONVENIENCE FEE", cell_label),
            Paragraph("TOTAL AMOUNT PAID", cell_label)
        ],
        [
            Paragraph(f"₹{fare_amount:.2f}", cell_value),
            Paragraph("₹0.00 (Standard)", cell_value),
            Paragraph("₹0.00 (Zero Surcharge)", cell_value),
            Paragraph(f"<b>₹{fare_amount:.2f}</b>", cell_value_bold)
        ],
        [
            Paragraph("PAYMENT STATUS", cell_label),
            Paragraph("PAYMENT MODE", cell_label),
            Paragraph("TRANSACTION REFERENCE ID", cell_label),
            Paragraph("BOOKING TIMESTAMP", cell_label)
        ],
        [
            Paragraph("<font color='#059669'><b>SUCCESS (PAID)</b></font>", cell_value),
            Paragraph(payment_method_str, cell_value),
            Paragraph(rzp_id, cell_value),
            Paragraph(datetime.now().strftime("%d-%m-%Y %H:%M:%S"), cell_value)
        ]
    ]
    fare_table = Table(fare_data, colWidths=[135, 135, 135, 135])
    fare_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f8fafc')),
        ('BACKGROUND', (0, 2), (-1, 2), colors.HexColor('#f8fafc')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(fare_table)
    story.append(Spacer(1, 14))

    # 6. Terms & AI Safety Instructions
    story.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor("#cbd5e1"), spaceAfter=8))
    rules_text = (
        "<b>TERMS & CONDITIONS &bull; INDIAN RAILWAYS &bull; TRAIN SEAT AI SYSTEM:</b><br/>"
        "1. This Electronic Reservation Slip is valid only when presented with an original government-issued photo ID (Aadhaar Card, Voter ID, Driving License, Passport, or PAN Card).<br/>"
        "2. <b>AI Seat Auto-Reallocation:</b> If you do not scan your QR code at the station entry gate within 15 minutes of train departure, the Autonomous Seat Allocator may reassign your berth to verified waitlisted emergency passengers.<br/>"
        "3. Passengers eligible under Senior Citizen (P1) or Divyangjan (P2) concessions must carry necessary medical or age verification credentials.<br/>"
        "4. For cancellations and automated refunds, please visit your Passenger Dashboard or interact with the AI Commuter Assistant prior to chart preparation.<br/>"
        "5. Helpline: 139 &bull; UIDAI Verification: Enabled &bull; Safe Journey with Indian Railways."
    )
    story.append(Paragraph(rules_text, legal_style))

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()
