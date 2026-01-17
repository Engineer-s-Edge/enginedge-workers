"""
Topic Categorizer

Provides topic categorization and analysis using spaCy.

Features:
- Topic categorization using semantic similarity
- Category suggestion based on entities and keywords
- Keyword extraction for topics
- Entity extraction for category naming
- Similarity calculation between topics
"""

from typing import Any, Dict, List, Optional

import spacy


class TopicCategorizer:
    def __init__(self):
        # Load spaCy model
        try:
            self.nlp = spacy.load("en_core_web_lg")
        except OSError:
            print("Downloading spaCy model...")
            import subprocess

            subprocess.run(["python", "-m", "spacy", "download", "en_core_web_lg"])
            self.nlp = spacy.load("en_core_web_lg")

    def categorize_topic(
        self,
        topic_name: str,
        description: Optional[str] = None,
        existing_categories: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Categorize a topic using spaCy semantic analysis.

        Args:
            topic_name: Name of the topic to categorize
            description: Optional description of the topic
            existing_categories: Optional list of existing category names to compare against

        Returns:
            {
                "suggested_category": str,
                "confidence": float (0-1),
                "keywords": List[str],
                "entities": List[Dict],
                "similarity_scores": Dict[str, float] (if existing_categories provided),
                "reasoning": str
            }
        """
        # Process topic name
        topic_doc = self.nlp(topic_name)
        if description:
            desc_doc = self.nlp(description)
        else:
            desc_doc = None

        # Extract entities
        entities = self._extract_entities(topic_doc, desc_doc)

        # Extract keywords
        keywords = self._extract_keywords(topic_doc, desc_doc)

        # Calculate similarity to existing categories if provided
        similarity_scores = {}
        if existing_categories:
            for category in existing_categories:
                category_doc = self.nlp(category)
                similarity = topic_doc.similarity(category_doc)
                similarity_scores[category] = float(similarity)

        # Suggest category based on entities and keywords
        suggested_category = self._suggest_category(
            topic_doc, entities, keywords, existing_categories, similarity_scores
        )

        # Calculate confidence
        confidence = self._calculate_confidence(
            topic_doc, entities, keywords, similarity_scores
        )

        # Generate reasoning
        reasoning = self._generate_reasoning(
            suggested_category, entities, keywords, similarity_scores
        )

        return {
            "suggested_category": suggested_category,
            "confidence": confidence,
            "keywords": keywords,
            "entities": entities,
            "similarity_scores": similarity_scores,
            "reasoning": reasoning,
        }

    def suggest_categories(
        self,
        topic_name: str,
        description: Optional[str] = None,
        existing_categories: Optional[List[str]] = None,
        top_k: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Suggest multiple categories for a topic, ranked by relevance.

        Args:
            topic_name: Name of the topic
            description: Optional description
            existing_categories: Optional list of existing categories
            top_k: Number of suggestions to return

        Returns:
            List of category suggestions with scores, sorted by relevance
        """
        topic_doc = self.nlp(topic_name)
        if description:
            desc_doc = self.nlp(description)
        else:
            desc_doc = None

        suggestions = []

        # If existing categories provided, calculate similarities
        if existing_categories:
            for category in existing_categories:
                category_doc = self.nlp(category)
                similarity = topic_doc.similarity(category_doc)
                suggestions.append(
                    {
                        "category": category,
                        "score": float(similarity),
                        "type": "existing",
                    }
                )

        # Generate new category suggestions based on entities
        entities = self._extract_entities(topic_doc, desc_doc)

        # Suggest categories from entities
        for entity in entities:
            if entity["label"] in ["ORG", "PERSON", "EVENT", "WORK_OF_ART"]:
                # Use entity text as potential category
                entity_category = entity["text"]
                if entity_category not in [s["category"] for s in suggestions]:
                    suggestions.append(
                        {
                            "category": entity_category,
                            "score": 0.6,  # Medium confidence for entity-based
                            "type": "entity_based",
                            "source": entity["label"],
                        }
                    )

        # Sort by score and return top_k
        suggestions.sort(key=lambda x: x["score"], reverse=True)
        return suggestions[:top_k]

    def calculate_topic_similarity(
        self,
        topic1: str,
        topic2: str,
        description1: Optional[str] = None,
        description2: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Calculate similarity between two topics.

        Args:
            topic1: First topic name
            topic2: Second topic name
            description1: Optional description for topic1
            description2: Optional description for topic2

        Returns:
            {
                "similarity": float (0-1),
                "shared_keywords": List[str],
                "shared_entities": List[str],
                "analysis": str
            }
        """
        # Process topics
        topic1_doc = self.nlp(topic1)
        topic2_doc = self.nlp(topic2)

        if description1:
            topic1_full = self.nlp(f"{topic1}. {description1}")
        else:
            topic1_full = topic1_doc

        if description2:
            topic2_full = self.nlp(f"{topic2}. {description2}")
        else:
            topic2_full = topic2_doc

        # Calculate similarity
        similarity = topic1_full.similarity(topic2_full)

        # Extract shared keywords
        keywords1 = set(self._extract_keywords(topic1_doc))
        keywords2 = set(self._extract_keywords(topic2_doc))
        shared_keywords = list(keywords1.intersection(keywords2))

        # Extract shared entities
        entities1 = self._extract_entities(topic1_doc)
        entities2 = self._extract_entities(topic2_doc)
        entities2_texts = {e["text"].lower() for e in entities2}
        shared_entities = [e for e in entities1 if e["text"].lower() in entities2_texts]

        # Generate analysis
        analysis = self._generate_similarity_analysis(
            similarity, shared_keywords, shared_entities
        )

        return {
            "similarity": float(similarity),
            "shared_keywords": shared_keywords,
            "shared_entities": shared_entities,
            "analysis": analysis,
        }

    def extract_topic_features(
        self, topic_name: str, description: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Extract comprehensive features from a topic for categorization.

        Args:
            topic_name: Name of the topic
            description: Optional description

        Returns:
            {
                "keywords": List[str],
                "entities": List[Dict],
                "noun_chunks": List[str],
                "main_verbs": List[str],
                "domain_indicators": List[str],
                "complexity_indicators": Dict
            }
        """
        full_text = topic_name
        if description:
            full_text = f"{topic_name}. {description}"

        doc = self.nlp(full_text)

        # Extract features
        keywords = self._extract_keywords(doc)
        entities = self._extract_entities(doc)
        noun_chunks = [chunk.text for chunk in doc.noun_chunks]
        main_verbs = [
            token.lemma_
            for token in doc
            if token.pos_ == "VERB" and token.dep_ == "ROOT"
        ]

        # Domain indicators (entities and keywords that suggest domain)
        domain_indicators = []
        for ent in entities:
            if ent["label"] in ["ORG", "EVENT", "WORK_OF_ART", "LAW"]:
                domain_indicators.append(ent["text"])

        # Complexity indicators
        complexity_indicators = {
            "word_count": len([t for t in doc if not t.is_punct]),
            "sentence_count": len(list(doc.sents)),
            "avg_word_length": sum(len(t.text) for t in doc if not t.is_punct)
            / max(len([t for t in doc if not t.is_punct]), 1),
            "technical_terms": len(
                [
                    t
                    for t in doc
                    if t.pos_ == "NOUN" and len(t.text) > 8 and t.text[0].isupper()
                ]
            ),
        }

        return {
            "keywords": keywords,
            "entities": entities,
            "noun_chunks": noun_chunks,
            "main_verbs": main_verbs,
            "domain_indicators": domain_indicators,
            "complexity_indicators": complexity_indicators,
        }

    def _extract_entities(
        self, doc, desc_doc: Optional[Any] = None
    ) -> List[Dict[str, str]]:
        """Extract named entities from document(s)."""
        entities = []
        docs_to_process = [doc]
        if desc_doc:
            docs_to_process.append(desc_doc)

        for d in docs_to_process:
            for ent in d.ents:
                entities.append(
                    {
                        "text": ent.text,
                        "label": ent.label_,
                        "start": ent.start_char,
                        "end": ent.end_char,
                    }
                )

        # Remove duplicates
        seen = set()
        unique_entities = []
        for ent in entities:
            key = (ent["text"].lower(), ent["label"])
            if key not in seen:
                seen.add(key)
                unique_entities.append(ent)

        return unique_entities

    def _extract_keywords(self, doc, desc_doc: Optional[Any] = None) -> List[str]:
        """Extract keywords from document(s)."""
        keywords = set()
        docs_to_process = [doc]
        if desc_doc:
            docs_to_process.append(desc_doc)

        for d in docs_to_process:
            # Add noun chunks
            for chunk in d.noun_chunks:
                keywords.add(chunk.text.lower())

            # Add important nouns and adjectives
            for token in d:
                if token.pos_ in ["NOUN", "PROPN"] and not token.is_stop:
                    keywords.add(token.lemma_.lower())

        return sorted(list(keywords))

    def _suggest_category(
        self,
        topic_doc,
        entities: List[Dict],
        keywords: List[str],
        existing_categories: Optional[List[str]],
        similarity_scores: Dict[str, float],
    ) -> str:
        """Suggest a category name for the topic."""
        # If we have existing categories and high similarity, use that
        if existing_categories and similarity_scores:
            best_match = max(similarity_scores.items(), key=lambda x: x[1])
            if best_match[1] > 0.7:  # High similarity threshold
                return best_match[0]

        # Try to extract category from entities
        for entity in entities:
            if entity["label"] in ["ORG", "EVENT", "WORK_OF_ART"]:
                return entity["text"]

        # Use first significant keyword as category
        if keywords:
            # Filter out common words
            significant_keywords = [
                kw
                for kw in keywords
                if len(kw) > 3 and kw not in ["the", "and", "for", "with", "from"]
            ]
            if significant_keywords:
                # Capitalize first letter
                category = significant_keywords[0].title()
                return category

        # Default to "Uncategorized"
        return "Uncategorized"

    def _calculate_confidence(
        self,
        topic_doc,
        entities: List[Dict],
        keywords: List[str],
        similarity_scores: Dict[str, float],
    ) -> float:
        """Calculate confidence score for categorization."""
        confidence = 0.5  # Base confidence

        # Boost if we have entities
        if entities:
            confidence += 0.2

        # Boost if we have keywords
        if len(keywords) >= 3:
            confidence += 0.1

        # Boost if high similarity to existing category
        if similarity_scores:
            max_similarity = max(similarity_scores.values())
            if max_similarity > 0.7:
                confidence += 0.2
            elif max_similarity > 0.5:
                confidence += 0.1

        return min(1.0, confidence)

    def _generate_reasoning(
        self,
        category: str,
        entities: List[Dict],
        keywords: List[str],
        similarity_scores: Dict[str, float],
    ) -> str:
        """Generate human-readable reasoning for category assignment."""
        reasons = []

        if similarity_scores:
            best_match = max(similarity_scores.items(), key=lambda x: x[1])
            if best_match[1] > 0.7:
                reasons.append(
                    f"High similarity ({best_match[1]:.2f}) to existing category '{best_match[0]}'"
                )

        if entities:
            entity_types = [e["label"] for e in entities]
            reasons.append(f"Detected entities: {', '.join(set(entity_types))}")

        if keywords:
            top_keywords = keywords[:5]
            reasons.append(f"Key terms: {', '.join(top_keywords)}")

        if not reasons:
            return "Category assigned based on topic name analysis."

        return ". ".join(reasons) + "."

    def _generate_similarity_analysis(
        self,
        similarity: float,
        shared_keywords: List[str],
        shared_entities: List[Dict],
    ) -> str:
        """Generate analysis of topic similarity."""
        if similarity > 0.8:
            level = "very high"
        elif similarity > 0.6:
            level = "high"
        elif similarity > 0.4:
            level = "moderate"
        else:
            level = "low"

        analysis = f"Topics have {level} similarity ({similarity:.2f})."

        if shared_keywords:
            analysis += f" Shared keywords: {', '.join(shared_keywords[:5])}."

        if shared_entities:
            entity_texts = [e["text"] for e in shared_entities[:3]]
            analysis += f" Shared entities: {', '.join(entity_texts)}."

        return analysis
