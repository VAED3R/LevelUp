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
        """Load and process text from a file. Also parse semester subjects."""
        try:
            logger.info(f"Loading text from file: {file_path}")
            with open(file_path, 'r', encoding='utf-8') as f:
                text = f.read()
            if not text.strip():
                raise ValueError("The text file is empty")
            # Parse semester subjects
            self.semester_subjects = self._parse_semester_subjects(text)
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

    def _parse_semester_subjects(self, text: str) -> dict:
        """Parse the curriculum text and return a mapping of semester number to list of subjects."""
        import re
        semester_pattern = re.compile(r"--- SEMESTER (\d+) ")
        lines = text.splitlines()
        semester_subjects = {}
        current_semester = None
        collecting = False
        for line in lines:
            sem_match = semester_pattern.match(line.strip())
            if sem_match:
                current_semester = sem_match.group(1)
                semester_subjects[current_semester] = []
                collecting = True
                continue
            if collecting:
                # End collecting if a new semester or section starts
                if line.strip().startswith('--- SEMESTER') or line.strip().startswith('--- SEMESTER') or line.strip().startswith('--- SEMESTER') or line.strip().startswith('--- SEMESTER') or line.strip().startswith('--- SEMESTER') or line.strip().startswith('--- SEMESTER') or line.strip().startswith('--- SEMESTER') or line.strip().startswith('--- SEMESTER') or line.strip().startswith('==================') or line.strip().startswith('--- SEMESTER'):
                    collecting = False
                    continue
                # Only collect lines that look like subjects
                if line.strip() and not line.strip().startswith('---') and not line.strip().startswith('='):
                    semester_subjects[current_semester].append(line.strip())
        return semester_subjects

    def get_semester_subjects(self, semester_number: str) -> list:
        """Return the list of subjects for a given semester number as strings."""
        if hasattr(self, 'semester_subjects') and semester_number in self.semester_subjects:
            return self.semester_subjects[semester_number]
        return []

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

    def parse_curriculum(self, file_path: str) -> dict:
        """Parse the curriculum file into a dictionary mapping semester numbers to their subjects."""
        try:
            logger.info(f"Parsing curriculum from file: {file_path}")
            curriculum = {}
            with open(file_path, 'r', encoding='utf-8') as f:
                for line in f:
                    parts = line.split(':')
                    if len(parts) == 2:
                        semester = parts[0].strip()
                        subjects = [s.strip() for s in parts[1].split(',')]
                        curriculum[semester] = subjects
            logger.info("Curriculum parsed successfully")
            return curriculum
        except Exception as e:
            logger.error(f"Error parsing curriculum: {str(e)}")
            raise

    def get_subjects_for_semester(self, semester: str) -> List[str]:
        """Get subjects for a given semester."""
        try:
            curriculum = self.parse_curriculum(file_path)
            return curriculum.get(semester, [])
        except Exception as e:
            logger.error(f"Error getting subjects for semester: {str(e)}")
            raise 