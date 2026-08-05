import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Polygon
from reportlab.lib.units import inch

def create_flowchart():
    # 5 steps: Log In -> Book Court -> Add Co-players -> Active Session -> Scan to Exit
    d = Drawing(460, 60)
    
    # Custom colors
    primary_color = colors.HexColor("#03210f")
    accent_color = colors.HexColor("#006400") # Dark green for text
    box_bg = colors.HexColor("#f5f4ec")
    box_border = colors.HexColor("#03210f")
    text_color = colors.HexColor("#111827")
    
    steps = [
        "1. Log In",
        "2. Book Court",
        "3. Add Colleagues",
        "4. Play & Timer",
        "5. Scan to Exit"
    ]
    
    width = 75
    height = 36
    y = 12
    gap = 20
    
    for i, step in enumerate(steps):
        x = i * (width + gap) + 5
        # Draw box
        d.add(Rect(x, y, width, height, fillColor=box_bg, strokeColor=box_border, strokeWidth=1.5, rx=6, ry=6))
        # Draw text inside box
        # Split text into number and description
        num, desc = step.split(". ")
        d.add(String(x + width/2, y + 22, num, fontName="Helvetica-Bold", fontSize=8, textAnchor="middle", fillColor=primary_color))
        d.add(String(x + width/2, y + 10, desc, fontName="Helvetica-Bold", fontSize=7, textAnchor="middle", fillColor=text_color))
        
        # Draw arrow to next box
        if i < 4:
            arrow_x_start = x + width
            arrow_x_end = arrow_x_start + gap
            arrow_y = y + height/2
            d.add(Line(arrow_x_start, arrow_y, arrow_x_end - 4, arrow_y, strokeColor=primary_color, strokeWidth=1.5))
            # Arrowhead
            d.add(Polygon([arrow_x_end - 4, arrow_y + 3, arrow_x_end, arrow_y, arrow_x_end - 4, arrow_y - 3], 
                          fillColor=primary_color, strokeColor=primary_color))
            
    return d

def generate_pdf(output_path, logo_path):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )
    
    styles = getSampleStyleSheet()
    
    # Custom Brand Styles
    brand_primary = colors.HexColor("#03210f")
    brand_secondary = colors.HexColor("#6b7280")
    brand_accent = colors.HexColor("#b2ff59")
    
    # Modify default styles or create new ones
    styles.add(ParagraphStyle(
        name='DocTitle',
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=brand_primary,
        spaceAfter=6
    ))
    
    styles.add(ParagraphStyle(
        name='DocSubtitle',
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=14,
        textColor=brand_secondary,
        textTransform='uppercase',
        spaceAfter=15
    ))
    
    styles.add(ParagraphStyle(
        name='SectionHeader',
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=brand_primary,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    ))
    
    styles.add(ParagraphStyle(
        name='BodyCustom',
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=colors.HexColor("#111827"),
        spaceAfter=8
    ))
    
    styles.add(ParagraphStyle(
        name='BulletCustom',
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=colors.HexColor("#111827"),
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=5
    ))
    
    styles.add(ParagraphStyle(
        name='AlertText',
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#03210f")
    ))

    story = []
    
    # 1. Header with Logo & Title
    logo_w, logo_h = 100, 30
    header_data = []
    if os.path.exists(logo_path):
        img = Image(logo_path, width=logo_w, height=logo_h)
        header_data = [[img, Paragraph("CORPORATE PLAYERS USER GUIDE", styles['DocTitle'])]]
    else:
        header_data = [["", Paragraph("CORPORATE PLAYERS USER GUIDE", styles['DocTitle'])]]
        
    header_table = Table(header_data, colWidths=[110, 410])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ALIGN', (0,0), (0,0), 'LEFT'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(header_table)
    
    story.append(Paragraph("A Step-by-Step System Manual for Booking, Playing, and Session Management", styles['DocSubtitle']))
    
    # Horizontal rule
    hr = Drawing(532, 2)
    hr.add(Line(0, 0, 532, 0, strokeColor=brand_primary, strokeWidth=1.5))
    story.append(hr)
    story.append(Spacer(1, 10))
    
    # 2. Flowchart Section
    story.append(Paragraph("SESSION LIFECYCLE WORKFLOW", styles['SectionHeader']))
    story.append(create_flowchart())
    story.append(Spacer(1, 12))
    
    # 3. Step-by-Step Sections
    # Section 1
    story.append(Paragraph("1. ACCOUNT AUTHENTICATION & SECURITY", styles['SectionHeader']))
    story.append(Paragraph("Accessing your corporate account is straightforward and uses unified credentials linked to your employment profile.", styles['BodyCustom']))
    story.append(Paragraph("• <b>Login Options:</b> You can log in via the main page or specifically at the Corporate Login portal using your <b>Employee ID</b>, registered <b>Email</b>, or <b>Mobile Number</b> along with your password.", styles['BulletCustom']))
    story.append(Paragraph("• <b>First-Time Sign In:</b> If you are logging in for the first time or after a password reset, the system will automatically prompt you to set a new, secure password. You must configure this before returning to the dashboard.", styles['BulletCustom']))
    
    # Section 2
    story.append(Paragraph("2. CREATING A CORPORATE BOOKING", styles['SectionHeader']))
    story.append(Paragraph("Corporate players enjoy frictionless court booking. No personal checkout or payment processing is required, as all slots are automatically billed directly to your company.", styles['BodyCustom']))
    story.append(Paragraph("• <b>Initiating Booking:</b> Click the <b>+ Create Booking</b> button on your dashboard.", styles['BulletCustom']))
    story.append(Paragraph("• <b>Slot Configuration:</b> Select your <b>Game</b>, <b>Date</b>, and <b>Start Time</b>. If the game enforces fixed scheduling, choose from the predefined slots; otherwise, enter a custom start time.", styles['BulletCustom']))
    story.append(Paragraph("• <b>Adding Colleagues:</b> Under the co-players section, search for coworkers by typing their name, Employee ID, or mobile. Select their profile to attach them to the booking slot. Remove them at any time using the <b>×</b> badge button.", styles['BulletCustom']))
    story.append(Paragraph("• <b>Confirmation:</b> The bottom details panel displays the ending time and confirms <i>'No Payment Needed (Billed to Company)'</i>. Submit to complete the booking.", styles['BulletCustom']))
    
    # Section 3
    story.append(Paragraph("3. TRACKING PLAYTIME & ACTIVE SESSIONS", styles['SectionHeader']))
    story.append(Paragraph("The company dashboard acts as your active session assistant while you are on-court.", styles['BodyCustom']))
    story.append(Paragraph("• <b>Stopwatch Counter:</b> When your booked time begins, a prominent indigo card titled <b>Active Session Playing</b> displays a live running stopwatch showing exactly how long you have been playing.", styles['BulletCustom']))
    story.append(Paragraph("• <b>Analytics & History:</b> The dashboard lists today's calendar entries, your total accumulative corporate playtime, and a log of your completed recent sessions.", styles['BulletCustom']))
    
    # Section 4
    story.append(Paragraph("4. ENDING YOUR SESSION & CHECKOUT (CRITICAL)", styles['SectionHeader']))
    story.append(Paragraph("<b>Important:</b> Always end your session immediately when you finish playing to avoid overtime charges billed to your company account.", styles['BodyCustom']))
    
    # Callout Box for Checkout Options
    checkout_info = (
        "<b>CHECKOUT METHODS:</b><br/>"
        "1. <b>Dashboard Scanner:</b> Click 'Scan QR To End Session' on your phone's dashboard, scan the facility's Exit QR Code, and check out instantly.<br/>"
        "2. <b>Manual Token Entry:</b> If camera access fails, type the alphanumeric security token directly into the manual verification input box on your dashboard.<br/>"
        "3. <b>Facility Terminal:</b> Scan the facility checkout QR using any generic browser, select your active sessions, and confirm check-out."
    )
    
    alert_table = Table([[Paragraph(checkout_info, styles['AlertText'])]], colWidths=[520])
    alert_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f5f4ec")),
        ('BOX', (0,0), (-1,-1), 1, brand_primary),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(alert_table)
    
    # Build Document
    doc.build(story)

if __name__ == "__main__":
    out_pdf = "/Users/dhruv/arrent/game-management/public/corporate_player_guide.pdf"
    logo_img = "/Users/dhruv/arrent/game-management/public/logo.png"
    generate_pdf(out_pdf, logo_img)
    print(f"Successfully generated PDF at {out_pdf}")
