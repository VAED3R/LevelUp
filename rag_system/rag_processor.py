import os
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np
from typing import List, Tuple
import logging

logger = logging.getLogger(__name__)

class RAGProcessor:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        try:
            logger.info(f"Initializing RAG processor with model: {model_name}")
            self.model = SentenceTransformer(model_name)
            self.index = None
            self.texts = []
            logger.info("RAG processor initialized successfully")
        except Exception as e:
            logger.error(f"Error initializing RAG processor: {str(e)}")
            raise
        
    def load_text(self, file_path: str) -> None:
        """Load and process text from a file."""
        try:
            logger.info(f"Loading text from file: {file_path}")
            with open(file_path, 'r', encoding='utf-8') as f:
                text = f.read()
            
            if not text.strip():
                raise ValueError("The text file is empty")
                
            # Split text into chunks (you can adjust the chunk size)
            self.texts = self._split_text(text)
            logger.info(f"Text split into {len(self.texts)} chunks")
            
            # Create embeddings
            logger.info("Creating embeddings...")
            embeddings = self.model.encode(self.texts)
            logger.info(f"Created embeddings with shape: {embeddings.shape}")
            
            # Create FAISS index
            dimension = embeddings.shape[1]
            self.index = faiss.IndexFlatL2(dimension)
            self.index.add(embeddings.astype('float32'))
            logger.info("FAISS index created successfully")
            
        except Exception as e:
            logger.error(f"Error loading text: {str(e)}")
            raise
        
    def _split_text(self, text: str, chunk_size: int = 200) -> List[str]:
        """Split text into chunks of approximately equal size."""
        try:
            words = text.split()
            chunks = []
            current_chunk = []
            current_size = 0
            
            for word in words:
                current_chunk.append(word)
                current_size += len(word) + 1  # +1 for space
                
                if current_size >= chunk_size:
                    chunks.append(' '.join(current_chunk))
                    current_chunk = []
                    current_size = 0
                    
            if current_chunk:
                chunks.append(' '.join(current_chunk))
                
            return chunks
        except Exception as e:
            logger.error(f"Error splitting text: {str(e)}")
            raise
    
    def search(self, query: str, k: int = 3) -> List[Tuple[str, float]]:
        """Search for relevant text chunks given a query."""
        try:
            if not self.index:
                raise ValueError("No text has been loaded. Call load_text() first.")
                
            # Encode query
            query_embedding = self.model.encode([query])
            
            # Search in FAISS index
            distances, indices = self.index.search(query_embedding.astype('float32'), k)
            
            # Return results with their distances
            results = []
            for idx, distance in zip(indices[0], distances[0]):
                if idx < len(self.texts):  # Ensure index is valid
                    results.append((self.texts[idx], float(distance)))
                    
            return results
        except Exception as e:
            logger.error(f"Error in search: {str(e)}")
            raise
    
    def get_relevant_context(self, query: str, k: int = 3) -> str:
        """Get relevant context for a query as a single string."""
        try:
            results = self.search(query, k)
            return "\n".join([text for text, _ in results])
        except Exception as e:
            logger.error(f"Error getting context: {str(e)}")
            raise 