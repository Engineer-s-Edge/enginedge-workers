"""
spaCy Service - FastAPI Application

Provides NLP processing using spaCy:
- Bullet point evaluation (100+ KPIs)
- Job posting extraction
- PDF parsing
- Text analysis (grammar, active voice, etc.)
- Topic categorization and analysis
"""

import os
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="spaCy Service",
    description="NLP processing using spaCy for text analysis, topic categorization, and more",
    version="2.0.0",
)

# CORS middleware (restrict origins via env ALLOWED_ORIGINS, comma-separated)
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in allowed_origins if o.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# Import services (after environment setup)
from .services.bullet_evaluator import BulletEvaluator  # noqa: E402
from .services.posting_extractor import PostingExtractor  # noqa: E402
from .services.resume_parser import ResumeParser  # noqa: E402
from .services.speech_analyzer import SpeechAnalyzer  # noqa: E402
from .services.text_analyzer import TextAnalyzer  # noqa: E402
from .services.topic_categorizer import TopicCategorizer  # noqa: E402

# Initialize services
bullet_evaluator = BulletEvaluator()
posting_extractor = PostingExtractor()
resume_parser = ResumeParser()
text_analyzer = TextAnalyzer()
speech_analyzer = SpeechAnalyzer()
topic_categorizer = TopicCategorizer()


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


class SpeechAnalysisRequest(BaseModel):
    text: str
    durationSeconds: float = 60.0


class SpeechAnalysisResponse(BaseModel):
    fillers: List[str]
    frequency: float
    confidence: float
    patterns: List[str]
    totalWords: int
    fillerCount: int


class TopicCategorizationRequest(BaseModel):
    topicName: str
    description: Optional[str] = None
    existingCategories: Optional[List[str]] = None


class TopicCategorizationResponse(BaseModel):
    suggestedCategory: str
    confidence: float
    keywords: List[str]
    entities: List[Dict[str, Any]]
    similarityScores: Dict[str, float]
    reasoning: str


class TopicSuggestionRequest(BaseModel):
    topicName: str
    description: Optional[str] = None
    existingCategories: Optional[List[str]] = None
    topK: int = 5


class TopicSuggestionResponse(BaseModel):
    suggestions: List[Dict[str, Any]]


class TopicSimilarityRequest(BaseModel):
    topic1: str
    topic2: str
    description1: Optional[str] = None
    description2: Optional[str] = None


class TopicSimilarityResponse(BaseModel):
    similarity: float
    sharedKeywords: List[str]
    sharedEntities: List[Dict[str, Any]]
    analysis: str


class TopicFeaturesRequest(BaseModel):
    topicName: str
    description: Optional[str] = None


class TopicFeaturesResponse(BaseModel):
    keywords: List[str]
    entities: List[Dict[str, Any]]
    nounChunks: List[str]
    mainVerbs: List[str]
    domainIndicators: List[str]
    complexityIndicators: Dict[str, Any]


# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "spacy-service", "version": "2.0.0"}


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
            is_current_role=request.isCurrentRole,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
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
        result = posting_extractor.extract(text=request.text, html=request.html)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


# Speech analysis endpoint
@app.post("/analyze-speech", response_model=SpeechAnalysisResponse)
async def analyze_speech(request: SpeechAnalysisRequest):
    """
    Analyze speech transcription for filler words and patterns.

    Returns:
    - Detected filler words
    - Frequency (fillers per minute)
    - Confidence score
    - Repetitive patterns
    """
    try:
        result = speech_analyzer.analyze_speech(
            text=request.text,
            duration_seconds=request.durationSeconds,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
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
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


# Topic categorization endpoint
@app.post("/categorize-topic", response_model=TopicCategorizationResponse)
async def categorize_topic(request: TopicCategorizationRequest):
    """
    Categorize a topic using spaCy semantic analysis.

    Uses:
    - Named entity recognition
    - Keyword extraction
    - Semantic similarity to existing categories
    - Entity-based category suggestion

    Returns:
    - Suggested category name
    - Confidence score (0-1)
    - Extracted keywords and entities
    - Similarity scores to existing categories
    - Reasoning for the categorization
    """
    try:
        result = topic_categorizer.categorize_topic(
            topic_name=request.topicName,
            description=request.description,
            existing_categories=request.existingCategories,
        )
        return TopicCategorizationResponse(
            suggestedCategory=result["suggested_category"],
            confidence=result["confidence"],
            keywords=result["keywords"],
            entities=result["entities"],
            similarityScores=result["similarity_scores"],
            reasoning=result["reasoning"],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


# Topic category suggestions endpoint
@app.post("/suggest-categories", response_model=TopicSuggestionResponse)
async def suggest_categories(request: TopicSuggestionRequest):
    """
    Suggest multiple categories for a topic, ranked by relevance.

    Returns:
    - List of category suggestions with scores
    - Suggestions can be from existing categories or newly generated
    - Sorted by relevance score
    """
    try:
        suggestions = topic_categorizer.suggest_categories(
            topic_name=request.topicName,
            description=request.description,
            existing_categories=request.existingCategories,
            top_k=request.topK,
        )
        return TopicSuggestionResponse(suggestions=suggestions)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


# Topic similarity endpoint
@app.post("/topic-similarity", response_model=TopicSimilarityResponse)
async def topic_similarity(request: TopicSimilarityRequest):
    """
    Calculate similarity between two topics.

    Returns:
    - Similarity score (0-1)
    - Shared keywords
    - Shared entities
    - Analysis of similarity
    """
    try:
        result = topic_categorizer.calculate_topic_similarity(
            topic1=request.topic1,
            topic2=request.topic2,
            description1=request.description1,
            description2=request.description2,
        )
        return TopicSimilarityResponse(
            similarity=result["similarity"],
            sharedKeywords=result["shared_keywords"],
            sharedEntities=result["shared_entities"],
            analysis=result["analysis"],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


# Topic features extraction endpoint
@app.post("/extract-topic-features", response_model=TopicFeaturesResponse)
async def extract_topic_features(request: TopicFeaturesRequest):
    """
    Extract comprehensive features from a topic for categorization.

    Returns:
    - Keywords
    - Entities
    - Noun chunks
    - Main verbs
    - Domain indicators
    - Complexity indicators
    """
    try:
        result = topic_categorizer.extract_topic_features(
            topic_name=request.topicName,
            description=request.description,
        )
        return TopicFeaturesResponse(
            keywords=result["keywords"],
            entities=result["entities"],
            nounChunks=result["noun_chunks"],
            mainVerbs=result["main_verbs"],
            domainIndicators=result["domain_indicators"],
            complexityIndicators=result["complexity_indicators"],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


# Run server
if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
