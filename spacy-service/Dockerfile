FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Download spaCy model
RUN python -m spacy download en_core_web_lg

# Download NLTK data to /usr/share/nltk_data (system-wide location)
RUN python -c "import nltk; nltk.download('punkt', download_dir='/usr/share/nltk_data'); nltk.download('averaged_perceptron_tagger', download_dir='/usr/share/nltk_data')"

# Set NLTK data path
ENV NLTK_DATA=/usr/share/nltk_data

# Copy application code
COPY . .

# Expose port (default 3008, but can be overridden via PORT env var)
EXPOSE 3008

# Run FastAPI server - use PORT env var if set, otherwise default to 3008
CMD ["sh", "-c", "uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-3008}"]
