"""
FastAPI backend for Flypower PDF Generator.
Accepts HTML file upload, returns PDF with clickable links.
"""

import os
import asyncio
import tempfile
import traceback
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from converter import convert_html_to_pdf

executor = ThreadPoolExecutor(max_workers=2)

app = FastAPI(title="Flypower PDF Generator", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

TEMP_DIR = tempfile.mkdtemp(prefix="flypower_pdf_")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/convert")
async def convert(file: UploadFile = File(...)):
    if not file.filename or not file.filename.endswith((".html", ".htm")):
        raise HTTPException(status_code=400, detail="File must be .html or .htm")

    content = await file.read()
    try:
        html_content = content.decode("utf-8")
    except UnicodeDecodeError:
        html_content = content.decode("latin-1")

    base_name = os.path.splitext(file.filename)[0]
    output_path = os.path.join(TEMP_DIR, f"{base_name}.pdf")

    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            executor, convert_html_to_pdf, html_content, output_path
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")

    return {
        "filename": f"{base_name}.pdf",
        "download_url": f"/download/{base_name}.pdf",
        "links_found": result["total_links"],
        "links_injected": result["injected"],
        "links_not_found": result["not_found"],
    }


@app.get("/download/{filename}")
async def download(filename: str):
    filepath = os.path.join(TEMP_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(
        filepath,
        media_type="application/pdf",
        filename=filename,
    )
