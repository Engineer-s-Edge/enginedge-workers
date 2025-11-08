"""
Speech Analyzer

Provides speech analysis capabilities including filler word detection.
"""

from typing import Any, Dict, List

import spacy


class SpeechAnalyzer:
    def __init__(self):
        # Load spaCy model
        try:
            self.nlp = spacy.load("en_core_web_lg")
        except OSError:
            print("Downloading spaCy model...")
            import subprocess

            subprocess.run(["python", "-m", "spacy", "download", "en_core_web_lg"])
            self.nlp = spacy.load("en_core_web_lg")

        # Common filler words and phrases
        self.filler_words = [
            "um",
            "uh",
            "ah",
            "er",
            "like",
            "you know",
            "so",
            "well",
            "actually",
            "basically",
            "literally",
            "right",
            "okay",
            "ok",
            "yeah",
            "yep",
            "hmm",
            "huh",
        ]

    def analyze_speech(
        self, text: str, duration_seconds: float = 60.0
    ) -> Dict[str, Any]:
        """
        Analyze speech transcription for filler words and patterns.

        Args:
            text: Transcription text
            duration_seconds: Duration of speech in seconds (for frequency calculation)

        Returns:
            {
                "fillers": [...],
                "frequency": float,  # fillers per minute
                "confidence": float,  # 0-1
                "patterns": [...],  # repetitive patterns
                "total_words": int,
                "filler_count": int
            }
        """
        doc = self.nlp(text.lower())
        tokens = [token.text for token in doc if not token.is_punct]

        detected_fillers: List[str] = []
        filler_positions: List[int] = []

        # Detect filler words
        for i, token in enumerate(tokens):
            if token in self.filler_words:
                detected_fillers.append(token)
                filler_positions.append(i)

        # Calculate frequency (fillers per minute)
        duration_minutes = duration_seconds / 60.0 if duration_seconds > 0 else 1.0
        frequency = (
            len(detected_fillers) / duration_minutes if duration_minutes > 0 else 0
        )

        # Detect repetitive patterns (same filler repeated within 5 words)
        patterns: List[str] = []
        for i in range(len(filler_positions) - 1):
            pos1 = filler_positions[i]
            pos2 = filler_positions[i + 1]
            if pos2 - pos1 <= 5:
                filler1 = tokens[pos1]
                filler2 = tokens[pos2]
                if filler1 == filler2:
                    patterns.append(f"{filler1} (repeated)")

        # Calculate confidence based on detection quality
        # Higher confidence if we detect multiple fillers and patterns
        confidence = min(
            1.0,
            0.3 + (len(detected_fillers) * 0.1) + (len(patterns) * 0.2),
        )

        return {
            "fillers": list(set(detected_fillers)),  # Unique fillers
            "frequency": round(frequency, 2),
            "confidence": round(confidence, 2),
            "patterns": list(set(patterns)),
            "total_words": len(tokens),
            "filler_count": len(detected_fillers),
        }
