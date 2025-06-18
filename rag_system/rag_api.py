from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from rag_processor import RAGProcessor
import os
import traceback
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Initialize RAG processor
rag_processor = RAGProcessor()

# Load the RAG text file
try:
    file_path = os.path.join(os.path.dirname(__file__), "Calicut_RAG.txt")
    logger.info(f"Loading RAG text from: {file_path}")
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"RAG text file not found at: {file_path}")
    rag_processor.load_text(file_path)
    logger.info("RAG text loaded successfully")
except Exception as e:
    logger.error(f"Error loading RAG text: {str(e)}")
    logger.error(traceback.format_exc())

class Query(BaseModel):
    text: str
    k: int = 3

@app.post("/search")
async def search(query: Query):
    try:
        logger.info(f"Processing search query: {query.text}")
        results = rag_processor.search(query.text, query.k)
        return {"results": [{"text": text, "score": float(score)} for text, score in results]}
    except Exception as e:
        logger.error(f"Error in search: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/context")
async def get_context(query: Query):
    try:
        logger.info(f"Processing context query: {query.text}")
        if not rag_processor.index:
            raise ValueError("RAG system not initialized. Text file may not have been loaded properly.")
        context = rag_processor.get_relevant_context(query.text, query.k)
        return {"context": context}
    except Exception as e:
        logger.error(f"Error in get_context: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 