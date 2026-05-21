# Flypower PDF Generator

Internal tool for converting HTML flyover reports to PDF with clickable links preserved.

## How It Works

1. Upload an HTML file (flyover report)
2. Playwright renders it to PDF (perfect CSS — Grid, Flexbox, variables all work)
3. PyMuPDF finds link text in the rendered PDF and injects clickable URI annotations
4. Download the PDF with all links working

## Quick Start

### Backend (Terminal 1)

```bash
cd tools/pdf-generator/backend
pip install -r requirements.txt
playwright install chromium
uvicorn main:app --reload --port 8000
```

### Frontend (Terminal 2)

```bash
cd tools/pdf-generator/frontend
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Requirements

- Python 3.10+
- Node.js 18+
- Playwright Chromium browser (installed via `playwright install chromium`)

## Cloud Deployment (Later)

The app is structured for easy containerization:
- Backend: Dockerfile with Playwright pre-installed
- Frontend: Static build, deploy anywhere (Netlify, Vercel, S3)
