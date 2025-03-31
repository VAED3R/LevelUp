from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from io import BytesIO
import requests
import fitz  # PyMuPDF
from PIL import Image
import pytesseract
import uvicorn

pytesseract.pytesseract.tesseract_cmd = r"C:/Program Files/Tesseract-OCR/tesseract.exe"

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

# Function to apply OCR on image pages
def ocr_image(image):
    """Extract text from image using Tesseract OCR."""
    try:
        text = pytesseract.image_to_string(image)
        return text.strip() if text else "[No text detected by OCR]"
    except Exception as e:
        return f"[OCR failed: {str(e)}]"

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

        # Extract text with PyMuPDF
        pdf_stream = BytesIO(response.content)
        doc = fitz.open(stream=pdf_stream, filetype="pdf")
        
        extracted_text = []
        
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            text = page.get_text()

            if text.strip():
                # If there is text, use it
                extracted_text.append(text)
            else:
                # Page might be an image → OCR it
                img = page.get_pixmap()  # Render page as image
                img_pil = Image.frombytes("RGB", [img.width, img.height], img.samples)
                
                ocr_text = ocr_image(img_pil)
                extracted_text.append(f"[OCR Page {page_num + 1}]\n{ocr_text}")

        # Join extracted text
        result_text = "\n\n".join(extracted_text).strip()

        if not result_text:
            raise HTTPException(status_code=400, detail="No text extracted from PDF")

        return {"text": result_text}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
