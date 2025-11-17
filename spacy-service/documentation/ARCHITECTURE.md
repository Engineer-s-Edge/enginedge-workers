# spaCy Service - Architecture Documentation

## Overview

The spaCy Service is a Python microservice built with FastAPI providing NLP processing capabilities.

## System Architecture

```
┌─────────────────────────────────────────────────┐
│         FastAPI Application                     │
│  REST Endpoints + Kafka Consumer              │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────┴───────────────────────────────┐
│           Services Layer                         │
│  BulletEvaluator | PostingExtractor            │
│  ResumeParser | TextAnalyzer                   │
│  SpeechAnalyzer | TopicCategorizer             │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────┴───────────────────────────────┐
│         NLP Libraries                           │
│  spaCy | NLTK | PyMuPDF                        │
└─────────────────────────────────────────────────┘
```

## Components

### Services

- **BulletEvaluator** - 100+ KPI rules for bullet point evaluation
- **PostingExtractor** - NER-based job posting extraction
- **ResumeParser** - PDF parsing and layout analysis
- **TextAnalyzer** - Grammar checking, passive voice detection
- **SpeechAnalyzer** - Filler word detection and analysis
- **TopicCategorizer** - Semantic topic categorization

### NLP Libraries

- **spaCy** - NER, POS tagging, dependency parsing
- **NLTK** - Grammar checking, tokenization
- **PyMuPDF** - PDF parsing and layout analysis

## Kafka Integration

Consumes and produces messages on Kafka topics:
- `resume.bullet.evaluate.request`
- `resume.posting.extract.request`
- `resume.pdf.parse.request`
