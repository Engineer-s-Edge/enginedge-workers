"""
Resume NLP Service - FastAPI Application

Provides NLP processing for resume-worker:
- Bullet point evaluation (100+ KPIs)
- Job posting extraction
- PDF parsing
- Text analysis (grammar, active voice, etc.)
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="Resume NLP Service",
    description="NLP processing for resume optimization",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import services (will be created)
from services.bullet_evaluator import BulletEvaluator
from services.posting_extractor import PostingExtractor
from services.resume_parser import ResumeParser
from services.text_analyzer import TextAnalyzer

# Initialize services
bullet_evaluator = BulletEvaluator()
posting_extractor = PostingExtractor()
resume_parser = ResumeParser()
text_analyzer = TextAnalyzer()

# Request/Response models
class BulletEvaluationRequest(BaseModel):
    bullet: str
    targetRole: Optional[str] = None
    targetKeywords: Optional[List[str]] = None
    isCurrentRole: Optional[bool] = False

class BulletEvaluationResponse(BaseModel):
    score: float
    kpis: Dict[str, Any]
    autoFixes: List[Dict[str, Any]]
    feedback: str

class PostingExtractionRequest(BaseModel):
    text: str
    html: Optional[str] = None

class PostingExtractionResponse(BaseModel):
    parsed: Dict[str, Any]
    confidence: float

class PDFParseRequest(BaseModel):
    pdfBytes: bytes

class PDFParseResponse(BaseModel):
    metadata: Dict[str, Any]
    sections: Dict[str, Any]
    rawText: str

# Health check
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "resume-nlp-service",
        "version": "1.0.0"
    }

# Bullet evaluation endpoint
@app.post("/evaluate-bullet", response_model=BulletEvaluationResponse)
async def evaluate_bullet(request: BulletEvaluationRequest):
    """
    Evaluate a resume bullet point for quality.
    
    Checks 100+ KPIs including:
    - Action verb strength
    - Active voice
    - Quantifiable results
    - Conciseness
    - ATS compliance
    - Grammar and mechanics
    """
    try:
        result = bullet_evaluator.evaluate(
            bullet=request.bullet,
            target_role=request.targetRole,
            target_keywords=request.targetKeywords,
            is_current_role=request.isCurrentRole
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Job posting extraction endpoint
@app.post("/extract-posting", response_model=PostingExtractionResponse)
async def extract_posting(request: PostingExtractionRequest):
    """
    Extract structured data from a job posting.
    
    Extracts:
    - Role and seniority
    - Skills (required and preferred)
    - Experience requirements
    - Education requirements
    - Compensation
    - Location and remote policy
    """
    try:
        result = posting_extractor.extract(
            text=request.text,
            html=request.html
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# PDF parsing endpoint
@app.post("/parse-pdf", response_model=PDFParseResponse)
async def parse_pdf(request: PDFParseRequest):
    """
    Parse a resume PDF and extract structured data.
    
    Extracts:
    - Contact information
    - Experience sections with bullets
    - Education
    - Skills
    - Projects
    - Layout metadata (for ATS checks)
    """
    try:
        result = resume_parser.parse_pdf(request.pdfBytes)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Run server
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)

