# pip install -r requirements.txt

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import traceback
import logging
import requests
from dotenv import load_dotenv
import difflib

# LlamaIndex imports
from llama_index.core import VectorStoreIndex, Document
from llama_index.embeddings.huggingface import HuggingFaceEmbedding

app = FastAPI()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Helper to parse semester subjects from text
import re
def parse_semester_subjects(text: str) -> dict:
    semester_pattern = re.compile(r"--- SEMESTER (\d+)")
    lines = text.splitlines()
    semester_subjects = {}
    current_semester = None
    collecting = False
    for line in lines:
        sem_match = semester_pattern.search(line.strip())
        if sem_match:
            current_semester = sem_match.group(1)
            semester_subjects[current_semester] = []
            collecting = True
            continue
        if collecting:
            # End collecting if a new semester or section starts
            if line.strip().startswith('--- SEMESTER') or line.strip().startswith('=================='):
                collecting = False
                continue
            # Only collect lines that look like subjects
            if line.strip() and not line.strip().startswith('---') and not line.strip().startswith('='):
                semester_subjects[current_semester].append(line.strip())
    return semester_subjects

@app.on_event("startup")
async def startup_event():
    logger.info("[STARTUP] Entering startup_event...")
    try:
        load_dotenv()
        file_path = os.path.join(os.path.dirname(__file__), "rag6.txt")
        logger.info(f"[STARTUP] Checking for RAG text file at: {file_path}")
        if not os.path.exists(file_path):
            logger.error(f"[STARTUP] RAG text file not found at: {file_path}")
            raise FileNotFoundError(f"RAG text file not found at: {file_path}")
        logger.info("[STARTUP] RAG text file found. Reading file...")
        with open(file_path, "r", encoding="utf-8") as f:
            text = f.read()
        logger.info(f"[STARTUP] File read. Length: {len(text)} characters")
        # Parse semester subjects
        logger.info("[STARTUP] Parsing semester subjects...")
        semester_subjects = parse_semester_subjects(text)
        logger.info(f"[STARTUP] Parsed semester subjects: {list(semester_subjects.keys())}")
        # Build LlamaIndex
        logger.info("[STARTUP] Creating Document...")
        document = Document(text=text)
        logger.info("[STARTUP] Building VectorStoreIndex from document...")
        try:
            embed_model = HuggingFaceEmbedding(model_name="sentence-transformers/all-MiniLM-L6-v2")
            logger.info("[STARTUP] HuggingFaceEmbedding created successfully.")
        except Exception as embed_err:
            logger.error(f"[STARTUP] Error creating HuggingFaceEmbedding: {embed_err} (type: {type(embed_err)})")
            raise
        try:
            index = VectorStoreIndex.from_documents([document], embed_model=embed_model)
            logger.info("[STARTUP] VectorStoreIndex created successfully.")
        except Exception as idx_err:
            logger.error(f"[STARTUP] Error creating VectorStoreIndex: {idx_err} (type: {type(idx_err)})")
            raise
        logger.info("[STARTUP] Creating query engine from index...")
        try:
            retriever = index.as_retriever()
            logger.info("[STARTUP] Query engine created successfully.")
        except Exception as qe_err:
            logger.error(f"[STARTUP] Error creating query engine: {qe_err} (type: {type(qe_err)})")
            raise
        app.state.retriever = retriever
        app.state.semester_subjects = semester_subjects
        logger.info("[STARTUP] LlamaIndex loaded and index built successfully (in app.state)")
    except Exception as e:
        logger.error(f"[STARTUP] Error loading LlamaIndex: {e} (type: {type(e)})")
        logger.error(traceback.format_exc())
        app.state.retriever = None
        app.state.semester_subjects = {}
    logger.info("[STARTUP] Exiting startup_event.")

class Query(BaseModel):
    text: str
    k: int = 3

class SemesterQuery(BaseModel):
    semester: str

class TopicRequest(BaseModel):
    topic: str

@app.post("/search")
async def search(query: Query, request: Request):
    try:
        logger.info(f"Processing search query: {query.text}")
        retriever = request.app.state.retriever
        if not retriever:
            raise ValueError("LlamaIndex not initialized.")
        # Retrieve top-k relevant chunks (nodes)
        nodes = retriever.retrieve(query.text)
        context = "\n".join([node.get_content() for node in nodes])
        # Build system prompt
        system_prompt = (
            "You are a helpful assistant. Here is some relevant context from our knowledge base:\n"
            f"{context}\n\nBased on this context and the user's question, provide a clear and helpful response."
        )
        # Call DeepSeek API
        api_key = os.environ.get("NEXT_PUBLIC_DEEPSEEK_API_KEY")
        if api_key:
            logger.info(f"[DeepSeek] API key loaded: {api_key[:4]}...{'*' * (len(api_key)-8) if len(api_key) > 8 else ''}{api_key[-4:]}")
        else:
            logger.error("[DeepSeek] API key NOT loaded from environment variable NEXT_PUBLIC_DEEPSEEK_API_KEY.")
        if not api_key:
            raise ValueError("DeepSeek API key not set in environment variable NEXT_PUBLIC_DEEPSEEK_API_KEY.")
        response = requests.post(
            "https://api.deepseek.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": "deepseek-chat",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": query.text}
                ],
                "temperature": 0.7,
                "max_tokens": 1000
            }
        )
        if response.status_code != 200:
            logger.error(f"DeepSeek API error: {response.text}")
            raise HTTPException(status_code=500, detail="DeepSeek API error")
        data = response.json()
        answer = data["choices"][0]["message"]["content"]
        return {"answer": answer, "context": context}
    except Exception as e:
        logger.error(f"Error in search: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/context")
async def get_context(query: Query, request: Request):
    try:
        logger.info(f"Processing context query: {query.text}")
        retriever = request.app.state.retriever
        if not retriever:
            raise ValueError("LlamaIndex not initialized.")
        # Retrieve top-k relevant chunks (nodes)
        nodes = retriever.retrieve(query.text)
        context = "\n".join([node.get_content() for node in nodes])
        # Build system prompt
        system_prompt = (
            "You are a helpful assistant. Here is some relevant context from our knowledge base:\n"
            f"{context}\n\nBased on this context and the user's question, provide a clear and helpful response."
        )
        # Call DeepSeek API
        api_key = os.environ.get("NEXT_PUBLIC_DEEPSEEK_API_KEY")
        if api_key:
            logger.info(f"[DeepSeek] API key loaded: {api_key[:4]}...{'*' * (len(api_key)-8) if len(api_key) > 8 else ''}{api_key[-4:]}")
        else:
            logger.error("[DeepSeek] API key NOT loaded from environment variable NEXT_PUBLIC_DEEPSEEK_API_KEY.")
        if not api_key:
            raise ValueError("DeepSeek API key not set in environment variable NEXT_PUBLIC_DEEPSEEK_API_KEY.")
        response = requests.post(
            "https://api.deepseek.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": "deepseek-chat",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": query.text}
                ],
                "temperature": 0.7,
                "max_tokens": 1000
            }
        )
        if response.status_code != 200:
            logger.error(f"DeepSeek API error: {response.text}")
            raise HTTPException(status_code=500, detail="DeepSeek API error")
        data = response.json()
        answer = data["choices"][0]["message"]["content"]
        return {"answer": answer, "context": context}
    except Exception as e:
        logger.error(f"Error in get_context: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/semester_subjects")
async def semester_subjects_endpoint(query: SemesterQuery, request: Request):
    try:
        logger.info(f"Getting subjects for semester: {query.semester}")
        semester_subjects = request.app.state.semester_subjects
        subjects = semester_subjects.get(query.semester, [])
        return {"semester": query.semester, "subjects": subjects}
    except Exception as e:
        logger.error(f"Error in semester_subjects: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/validate-topic")
async def validate_topic(request: TopicRequest):
    topic = request.topic
    try:
        logger.info(f"[validate-topic] Received topic: {topic}")
        BASE_DIR = os.path.dirname(os.path.abspath(__file__))
        TOPICS_PATH = os.path.join(BASE_DIR, 'quiz_topics.txt')
        with open(TOPICS_PATH, 'r') as f:
            quiz_topics = [line.strip().lower() for line in f if line.strip()]
        logger.info(f"[validate-topic] Loaded {len(quiz_topics)} topics from quiz_topics.txt: {quiz_topics}")
        topic_lower = topic.strip().lower()
        logger.info(f"[validate-topic] Normalized input topic: {topic_lower}")
        # Exact or substring match
        matches = [t for t in quiz_topics if t == topic_lower or t in topic_lower or topic_lower in t]
        logger.info(f"[validate-topic] Exact/substring matches: {matches}")
        # Fuzzy match if no direct match
        if not matches:
            fuzzy_matches = difflib.get_close_matches(topic_lower, quiz_topics, n=1, cutoff=0.8)
            logger.info(f"[validate-topic] Fuzzy matches: {fuzzy_matches}")
            if fuzzy_matches:
                matches = fuzzy_matches
        if matches:
            logger.info(f"[validate-topic] Topic '{topic}' is valid. Matched topic: {matches[0]}")
            return {"valid": True, "matchedTopic": matches[0]}
        else:
            logger.info(f"[validate-topic] Topic '{topic}' is not valid. No matches found.")
            return {"valid": False, "matchedTopic": None}
    except Exception as e:
        logger.error(f"[validate-topic] Error: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 