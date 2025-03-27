from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import PyPDF2
from io import BytesIO
import requests
import uvicorn

app = FastAPI()

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development only, restrict in production
    allow_methods=["POST"],
    allow_headers=["*"],
)

class PDFRequest(BaseModel):
    pdf_url: str

@app.post("/extract-text")
async def extract_text(request: PDFRequest):
    try:
        # Validate URL
        if not request.pdf_url.startswith(('http://', 'https://')):
            raise HTTPException(status_code=422, detail="Invalid URL format")

        # Download PDF with timeout
        try:
            response = requests.get(
                request.pdf_url,
                timeout=10,
                headers={'User-Agent': 'Mozilla/5.0'}
            )
            response.raise_for_status()
        except requests.RequestException as e:
            raise HTTPException(status_code=400, detail=f"Failed to download PDF: {str(e)}")

        # Check content type
        if 'application/pdf' not in response.headers.get('Content-Type', ''):
            raise HTTPException(status_code=400, detail="URL does not point to a PDF file")

        # Extract text
        try:
            with BytesIO(response.content) as pdf_file:
                reader = PyPDF2.PdfReader(pdf_file)
                if not reader.pages:
                    raise HTTPException(status_code=400, detail="PDF contains no pages")
                
                text = "\n".join([page.extract_text() or "" for page in reader.pages])
                if not text.strip():
                    raise HTTPException(status_code=400, detail="PDF contains no extractable text")
                
                return {"text": text}
        
        except PyPDF2.PdfReadError:
            raise HTTPException(status_code=400, detail="Invalid PDF file")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)