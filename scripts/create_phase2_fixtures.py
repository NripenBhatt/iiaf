"""Offline synthetic fixtures only; never impersonate missing original DBRAU files.
Uses preinstalled python-docx, python-pptx, Pillow and reportlab.
Run from project root, then bun scripts/create_phase2_spreadsheets.ts.
"""
from pathlib import Path
from docx import Document
from pptx import Presentation
from pptx.util import Inches
from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

ROOT = Path('src/test/fixtures/phase2')
ROOT.mkdir(parents=True, exist_ok=True)

def word(name, title, paragraphs, rows):
    doc = Document()
    doc.add_heading(title, 0)
    for text in paragraphs:
        doc.add_paragraph(text)
    table = doc.add_table(rows=0, cols=len(rows[0]))
    for row in rows:
        for cell, value in zip(table.add_row().cells, row):
            cell.text = value
    doc.save(ROOT / name)

word('synthetic-hindi-agenda.docx', 'SYNTHETIC DEMO — कार्यसूची',
     ['केवल परीक्षण के लिए। वास्तविक DBRAU अभिलेख नहीं।', 'Meeting_ID: M-0042', 'बैठक तिथि: 13 अक्टूबर 2026'],
     [['समय', 'विषय', 'टिप्पणी'], ['10:00', 'प्रवेश समीक्षा', ''], ['11:00', 'प्लेसमेंट चर्चा', 'निर्णय अभी दर्ज नहीं']])
word('synthetic-minutes.docx', 'SYNTHETIC DEMO — Minutes',
     ['Meeting_ID: M-0042', 'Meeting_Date: 2026-10-13', 'Attendance: Not supplied', 'Discussion: Review of the synthetic admissions table.'],
     [['Item', 'Recorded outcome'], ['Admissions', 'Discussed; no approval recorded']])
word('synthetic-decisions.docx', 'SYNTHETIC DEMO — Decisions and Resolutions',
     ['Meeting_ID: M-0042', 'Resolution: Request a revised draft; not approve the programme.'],
     [['Action', 'Owner', 'Due date'], ['Prepare revised draft', '', '']])
word('synthetic-performance.docx', 'SYNTHETIC DEMO — Institutional Performance Evidence',
     ['Fictional test values, not DBRAU records or verified evidence.', 'Evidence_ID: EV-0042'],
     [['Metric', 'Value', 'Unit'], ['Admissions', '142', 'students'], ['Placement', '83%', 'synthetic rate']])

(ROOT / 'synthetic-labels.txt').write_text('SYNTHETIC DEMO\nEvidence_ID: EV-0042\n\nबैठक तिथि: 13 अक्टूबर 2026\n', encoding='utf-8')
(ROOT / 'synthetic-table.csv').write_text('Name,Empty,Count,Rate,Date,Formula\n"SYNTHETIC DEMO हिन्दी",,142,83%,2026-10-13,=C2-24\n', encoding='utf-8')

pres = Presentation()
for title, detail in [('SYNTHETIC DEMO — Agenda', 'Meeting_ID: M-0042'), ('कार्यसूची', 'प्रवेश समीक्षा')]:
    slide = pres.slides.add_slide(pres.slide_layouts[1])
    slide.shapes.title.text = title
    slide.placeholders[1].text = detail
pres.save(ROOT / 'synthetic-slides.pptx')

image = Image.new('RGB', (1000, 700), 'white')
draw = ImageDraw.Draw(image)
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 30)
for i, text in enumerate(['SYNTHETIC DEMO - OCR TEST', 'From Ideas to Enterprises', 'IIAF Test University A', '13 October 2026', '10:00 to 16:00 IST', 'Venue: Synthetic Hall', 'Not a real event or original poster']):
    draw.text((35, 40 + i * 80), text, font=font, fill='black')
for ext in ['png', 'jpg', 'jpeg']:
    image.save(ROOT / f'synthetic-poster.{ext}')

def pdf(name, pages):
    c = canvas.Canvas(str(ROOT / name), pagesize=(612, 792))
    for kind in pages:
        if kind == 'text':
            for i, text in enumerate(['SYNTHETIC DEMO - native PDF test', 'Evidence_ID: EV-0042', 'Meeting_Date: 2026-10-13']):
                c.drawString(40, 740 - 30 * i, text)
        else:
            c.drawImage(ImageReader(image), 30, 200, width=550, height=385)
        c.showPage()
    c.save()
pdf('synthetic-text.pdf', ['text'])
pdf('synthetic-scanned.pdf', ['scan'])
pdf('synthetic-mixed.pdf', ['text', 'scan'])