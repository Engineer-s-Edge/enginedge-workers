# Bug Report: resume-nlp-service

This document outlines the bugs and issues found in the `resume-nlp-service` module.

## High Severity Bugs

### 1. Runtime Model Downloading

- **File:** `src/services/bullet_evaluator.py`
- **Severity:** High
- **Description:** The `BulletEvaluator` service downloads the spaCy model at runtime if it's not found.
- **Impact:** This will cause a long delay on the first request to the service, and may fail if the service does not have internet access in a production environment. The model should be downloaded and included in the Docker image.

### 2. Insecure CORS Policy

- **File:** `src/main.py`
- **Severity:** High
- **Description:** The FastAPI application is configured with a wide-open CORS policy (`allow_origins=["*"]`).
- **Impact:** This is a security risk, as it allows any website to make requests to the service. The CORS policy should be restricted to only the domains that need to access the service.

## Medium Severity Bugs

### 1. Broad Exception Handling

- **File:** `src/main.py`
- **Severity:** Medium
- **Description:** The API endpoints use broad `except Exception` blocks.
- **Impact:** This can swallow exceptions and make debugging difficult. More specific exceptions should be caught.

## Low Severity Bugs

### 1. Basic Verb Similarity Function

- **File:** `src/services/bullet_evaluator.py`
- **Severity:** Low
- **Description:** The `_find_similar_verbs` function is very basic and only returns verbs that start with the same letter.
- **Impact:** The suggestions for stronger action verbs will not be very helpful.
