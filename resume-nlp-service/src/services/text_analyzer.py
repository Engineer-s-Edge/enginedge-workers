"""
Text Analyzer

Provides NLP utilities for text analysis.

Features:
- Named Entity Recognition (NER)
- Part-of-Speech (POS) tagging
- Dependency parsing
- Keyword extraction
- Readability metrics
"""

import spacy
import nltk
from nltk.tokenize import sent_tokenize, word_tokenize
from typing import Dict, List, Any

class TextAnalyzer:
    def __init__(self):
        # Load spaCy model
        try:
            self.nlp = spacy.load("en_core_web_lg")
        except OSError:
            print("Downloading spaCy model...")
            import subprocess
            subprocess.run(["python", "-m", "spacy", "download", "en_core_web_lg"])
            self.nlp = spacy.load("en_core_web_lg")
        
        # Download NLTK data
        try:
            nltk.data.find('tokenizers/punkt')
        except LookupError:
            nltk.download('punkt')
        
        try:
            nltk.data.find('taggers/averaged_perceptron_tagger')
        except LookupError:
            nltk.download('averaged_perceptron_tagger')
    
    def analyze(self, text: str) -> Dict[str, Any]:
        """
        Perform comprehensive text analysis.
        
        Returns:
            {
                "entities": [...],
                "pos_tags": [...],
                "dependencies": [...],
                "keywords": [...],
                "metrics": {...}
            }
        """
        doc = self.nlp(text)
        
        return {
            "entities": self._extract_entities(doc),
            "pos_tags": self._extract_pos_tags(doc),
            "dependencies": self._extract_dependencies(doc),
            "keywords": self._extract_keywords(doc),
            "metrics": self._calculate_metrics(text, doc)
        }
    
    def _extract_entities(self, doc) -> List[Dict[str, str]]:
        """Extract named entities."""
        entities = []
        for ent in doc.ents:
            entities.append({
                "text": ent.text,
                "label": ent.label_,
                "start": ent.start_char,
                "end": ent.end_char
            })
        return entities
    
    def _extract_pos_tags(self, doc) -> List[Dict[str, str]]:
        """Extract POS tags."""
        pos_tags = []
        for token in doc:
            pos_tags.append({
                "text": token.text,
                "pos": token.pos_,
                "tag": token.tag_
            })
        return pos_tags
    
    def _extract_dependencies(self, doc) -> List[Dict[str, Any]]:
        """Extract dependency parse."""
        dependencies = []
        for token in doc:
            dependencies.append({
                "text": token.text,
                "dep": token.dep_,
                "head": token.head.text,
                "children": [child.text for child in token.children]
            })
        return dependencies
    
    def _extract_keywords(self, doc) -> List[str]:
        """Extract keywords using noun chunks and entities."""
        keywords = set()
        
        # Add noun chunks
        for chunk in doc.noun_chunks:
            keywords.add(chunk.text.lower())
        
        # Add named entities
        for ent in doc.ents:
            keywords.add(ent.text.lower())
        
        return list(keywords)
    
    def _calculate_metrics(self, text: str, doc) -> Dict[str, Any]:
        """Calculate readability metrics."""
        sentences = list(doc.sents)
        words = [token for token in doc if not token.is_punct]
        
        # Basic counts
        num_sentences = len(sentences)
        num_words = len(words)
        num_chars = len(text)
        
        # Average lengths
        avg_sentence_length = num_words / num_sentences if num_sentences > 0 else 0
        avg_word_length = sum(len(token.text) for token in words) / num_words if num_words > 0 else 0
        
        # Syllable count (approximation)
        syllables = sum(self._count_syllables(token.text) for token in words)
        
        # Flesch Reading Ease
        if num_sentences > 0 and num_words > 0:
            flesch = 206.835 - 1.015 * (num_words / num_sentences) - 84.6 * (syllables / num_words)
        else:
            flesch = 0
        
        return {
            "num_sentences": num_sentences,
            "num_words": num_words,
            "num_chars": num_chars,
            "avg_sentence_length": round(avg_sentence_length, 2),
            "avg_word_length": round(avg_word_length, 2),
            "flesch_reading_ease": round(flesch, 2)
        }
    
    def _count_syllables(self, word: str) -> int:
        """Count syllables in a word (approximation)."""
        word = word.lower()
        vowels = "aeiouy"
        syllable_count = 0
        previous_was_vowel = False
        
        for char in word:
            is_vowel = char in vowels
            if is_vowel and not previous_was_vowel:
                syllable_count += 1
            previous_was_vowel = is_vowel
        
        # Adjust for silent 'e'
        if word.endswith('e'):
            syllable_count -= 1
        
        # Ensure at least 1 syllable
        if syllable_count == 0:
            syllable_count = 1
        
        return syllable_count
    
    def check_grammar(self, text: str) -> List[Dict[str, Any]]:
        """
        Basic grammar checks using POS tagging.
        
        Returns list of potential issues.
        """
        doc = self.nlp(text)
        issues = []
        
        # Check for repeated words
        tokens = [token.text.lower() for token in doc if not token.is_punct]
        for i in range(len(tokens) - 1):
            if tokens[i] == tokens[i + 1]:
                issues.append({
                    "type": "repeated_word",
                    "word": tokens[i],
                    "position": i
                })
        
        # Check for sentence fragments (no verb)
        for sent in doc.sents:
            has_verb = any(token.pos_ == "VERB" for token in sent)
            if not has_verb and len(list(sent)) > 3:
                issues.append({
                    "type": "no_verb",
                    "sentence": sent.text
                })
        
        return issues
    
    def extract_action_verbs(self, text: str) -> List[str]:
        """Extract action verbs from text."""
        doc = self.nlp(text)
        action_verbs = []
        
        for token in doc:
            if token.pos_ == "VERB" and token.dep_ in ["ROOT", "ccomp", "xcomp"]:
                action_verbs.append(token.lemma_)
        
        return action_verbs
    
    def is_passive_voice(self, text: str) -> bool:
        """Check if text uses passive voice."""
        doc = self.nlp(text)
        
        for token in doc:
            # Passive voice pattern: auxiliary + past participle
            if token.dep_ == "auxpass":
                return True
        
        return False
    
    def extract_metrics_and_numbers(self, text: str) -> List[Dict[str, Any]]:
        """Extract numbers and metrics from text."""
        doc = self.nlp(text)
        metrics = []
        
        for ent in doc.ents:
            if ent.label_ in ["PERCENT", "MONEY", "QUANTITY", "CARDINAL"]:
                metrics.append({
                    "text": ent.text,
                    "type": ent.label_,
                    "start": ent.start_char,
                    "end": ent.end_char
                })
        
        return metrics

