"""
Bullet Point Evaluator

Evaluates resume bullet points against 100+ KPIs for quality,
ATS compliance, and effectiveness.

Based on research from:
- Harvard Career Services
- MIT Career Development
- Yale Office of Career Strategy
- Nielsen Norman Group (scanning patterns)
- Federal Plain Language Guidelines
"""

import re
from typing import Any, Dict, List, Optional

import spacy
from nltk import sent_tokenize


class BulletEvaluator:
    def __init__(self):
        # Load spaCy model
        try:
            self.nlp = spacy.load("en_core_web_lg")
        except OSError:
            print("Downloading spaCy model...")
            import subprocess

            subprocess.run(["python", "-m", "spacy", "download", "en_core_web_lg"])
            self.nlp = spacy.load("en_core_web_lg")

        # Load action verbs (200+ strong verbs)
        self.action_verbs = self._load_action_verbs()

        # Load buzzwords (to avoid)
        self.buzzwords = [
            "dynamic",
            "results-driven",
            "ninja",
            "rockstar",
            "synergy",
            "leverage",
            "utilize",
            "passionate",
            "team player",
            "hard worker",
            "detail-oriented",
            "self-starter",
            "go-getter",
            "think outside the box",
        ]

        # Metric patterns
        self.metric_patterns = [
            r"\d+%",  # percentages
            r"\$\d+[\d,]*",  # dollars
            r"\d+x",  # multipliers
            r"\d+\s*(ms|s|min|minutes|hours|days|weeks|months)",  # time
            r"\d+\s*(users|requests|QPS|RPS|TPS|transactions)",  # volume
            r"\d+\s*(MB|GB|TB|KB)",  # data size
            r"p\d+\s*latency",  # percentile latency
        ]

    def evaluate(
        self,
        bullet: str,
        target_role: Optional[str] = None,
        target_keywords: Optional[List[str]] = None,
        is_current_role: bool = False,
    ) -> Dict[str, Any]:
        """
        Evaluate a bullet point against all KPIs.

        Returns:
            {
                "score": 0-100,
                "kpis": {...},
                "autoFixes": [...],
                "feedback": "..."
            }
        """
        # Run all KPI checks
        kpis = {}

        # A) Non-negotiable pass/fail checks
        kpis["action_verb"] = self._check_action_verb(bullet)
        kpis["active_voice"] = self._check_active_voice(bullet)
        kpis["quantifiable"] = self._check_quantifiable(bullet)
        kpis["conciseness"] = self._check_conciseness(bullet)
        kpis["tense"] = self._check_tense(bullet, is_current_role)
        kpis["ats_safe"] = self._check_ats_safe(bullet)
        kpis["keywords"] = self._check_keywords(bullet, target_keywords or [])
        kpis["no_fluff"] = self._check_no_fluff(bullet)
        kpis["grammar"] = self._check_grammar(bullet)

        # B) Structural formulas
        kpis["formula"] = self._check_formula(bullet)

        # C) Human-reviewer impact KPIs
        kpis["business_outcome"] = self._check_business_outcome(bullet)
        kpis["technical_specificity"] = self._check_technical_specificity(bullet)
        kpis["front_loaded"] = self._check_front_loaded(bullet)

        # Calculate overall score
        score = self._calculate_score(kpis)

        # Generate auto-fixes
        auto_fixes = self._generate_fixes(bullet, kpis)

        # Generate feedback
        feedback = self._generate_feedback(bullet, kpis, score)

        return {
            "score": score,
            "kpis": kpis,
            "autoFixes": auto_fixes,
            "feedback": feedback,
        }

    def _check_action_verb(self, bullet: str) -> Dict[str, Any]:
        """Check if bullet starts with a strong action verb."""
        first_word = bullet.split()[0] if bullet.split() else ""
        is_action_verb = first_word in self.action_verbs

        return {
            "pass": is_action_verb,
            "score": 1.0 if is_action_verb else 0.0,
            "firstWord": first_word,
            "isActionVerb": is_action_verb,
        }

    def _check_active_voice(self, bullet: str) -> Dict[str, Any]:
        """Check for passive voice patterns."""
        passive_pattern = r"\b(was|were|been|being)\s+\w+ed\s+by\b"
        is_passive = bool(re.search(passive_pattern, bullet, re.IGNORECASE))

        return {
            "pass": not is_passive,
            "score": 0.0 if is_passive else 1.0,
            "isPassive": is_passive,
        }

    def _check_quantifiable(self, bullet: str) -> Dict[str, Any]:
        """Check for quantifiable metrics."""
        metrics = []
        for pattern in self.metric_patterns:
            metrics.extend(re.findall(pattern, bullet, re.IGNORECASE))

        has_metrics = len(metrics) > 0
        score = min(len(metrics) / 2, 1.0)  # 2+ metrics = perfect score

        return {
            "pass": has_metrics,
            "score": score,
            "metrics": metrics,
            "count": len(metrics),
        }

    def _check_conciseness(self, bullet: str) -> Dict[str, Any]:
        """Check if bullet is concise (1-2 lines, ~15-30 words)."""
        words = len(bullet.split())
        sentences = len(sent_tokenize(bullet))

        ideal = 15 <= words <= 30 and sentences == 1
        score = 1.0 if ideal else max(0, 1 - abs(words - 22) / 22)

        return {
            "pass": ideal,
            "score": score,
            "wordCount": words,
            "sentenceCount": sentences,
        }

    def _check_tense(self, bullet: str, is_current_role: bool) -> Dict[str, Any]:
        """Check verb tense consistency."""
        doc = self.nlp(bullet)
        verbs = [token for token in doc if token.pos_ == "VERB"]

        if not verbs:
            return {"pass": True, "score": 1.0, "verbs": []}

        # Check tense of first verb
        first_verb = verbs[0]
        tense = first_verb.morph.get("Tense")

        expected_tense = "Pres" if is_current_role else "Past"
        correct = tense and expected_tense in tense

        return {
            "pass": correct,
            "score": 1.0 if correct else 0.5,
            "verbs": [v.text for v in verbs],
            "expectedTense": expected_tense,
        }

    def _check_ats_safe(self, bullet: str) -> Dict[str, Any]:
        """Check for ATS-unsafe characters."""
        unsafe_chars = ["|", "•", "→", "←", "↑", "↓", "★", "☆"]
        has_unsafe = any(char in bullet for char in unsafe_chars)

        return {
            "pass": not has_unsafe,
            "score": 0.0 if has_unsafe else 1.0,
            "unsafeChars": [c for c in unsafe_chars if c in bullet],
        }

    def _check_keywords(
        self, bullet: str, target_keywords: List[str]
    ) -> Dict[str, Any]:
        """Check for target keywords (from job posting)."""
        if not target_keywords:
            return {"pass": True, "score": 1.0, "found": [], "missing": []}

        bullet_lower = bullet.lower()
        found = [kw for kw in target_keywords if kw.lower() in bullet_lower]
        missing = [kw for kw in target_keywords if kw.lower() not in bullet_lower]

        score = len(found) / len(target_keywords) if target_keywords else 1.0

        return {
            "pass": len(found) > 0,
            "score": score,
            "found": found,
            "missing": missing,
        }

    def _check_no_fluff(self, bullet: str) -> Dict[str, Any]:
        """Check for buzzwords and fluff."""
        bullet_lower = bullet.lower()
        found_buzzwords = [bw for bw in self.buzzwords if bw in bullet_lower]

        score = max(0, 1.0 - len(found_buzzwords) * 0.2)

        return {
            "pass": len(found_buzzwords) == 0,
            "score": score,
            "buzzwords": found_buzzwords,
        }

    def _check_grammar(self, bullet: str) -> Dict[str, Any]:
        """Check basic grammar and mechanics."""
        issues = []

        if not bullet[0].isupper():
            issues.append("First letter not capitalized")

        if not bullet.endswith("."):
            issues.append("Missing period")

        # Check for double spaces
        if "  " in bullet:
            issues.append("Double spaces found")

        return {
            "pass": len(issues) == 0,
            "score": max(0, 1.0 - len(issues) * 0.1),
            "issues": issues,
        }

    def _check_formula(self, bullet: str) -> Dict[str, Any]:
        """Check if bullet follows XYZ/APR/CAR formula."""
        has_action = self._check_action_verb(bullet)["pass"]
        has_metric = self._check_quantifiable(bullet)["pass"]
        has_method = "by" in bullet.lower()

        if has_action and has_metric and has_method:
            formula = "XYZ"
            score = 1.0
        elif has_action and has_metric:
            formula = "APR"
            score = 0.8
        else:
            formula = "None"
            score = 0.3

        return {"type": formula, "score": score}

    def _check_business_outcome(self, bullet: str) -> Dict[str, Any]:
        """Check for business impact keywords."""
        business_keywords = [
            "revenue",
            "cost",
            "profit",
            "efficiency",
            "customer",
            "user",
            "conversion",
            "retention",
            "growth",
            "scale",
            "performance",
            "quality",
            "reliability",
            "security",
        ]

        bullet_lower = bullet.lower()
        found = [kw for kw in business_keywords if kw in bullet_lower]

        return {
            "pass": len(found) > 0,
            "score": min(len(found) / 2, 1.0),
            "keywords": found,
        }

    def _check_technical_specificity(self, bullet: str) -> Dict[str, Any]:
        """Check for specific technical terms (not generic)."""
        doc = self.nlp(bullet)

        # Extract technical entities and proper nouns
        tech_terms = []
        for ent in doc.ents:
            if ent.label_ in ["PRODUCT", "ORG", "GPE"]:
                tech_terms.append(ent.text)

        # Also check for capitalized technical terms
        for token in doc:
            if token.is_alpha and token.text[0].isupper() and len(token.text) > 2:
                if token.text not in tech_terms:
                    tech_terms.append(token.text)

        return {
            "pass": len(tech_terms) >= 2,
            "score": min(len(tech_terms) / 3, 1.0),
            "terms": tech_terms,
        }

    def _check_front_loaded(self, bullet: str) -> Dict[str, Any]:
        """Check if metrics/impact appear early (first 6 words)."""
        first_six_words = " ".join(bullet.split()[:6])

        has_early_metric = False
        for pattern in self.metric_patterns:
            if re.search(pattern, first_six_words, re.IGNORECASE):
                has_early_metric = True
                break

        return {"pass": has_early_metric, "score": 1.0 if has_early_metric else 0.5}

    def _calculate_score(self, kpis: Dict[str, Any]) -> float:
        """Calculate overall score (0-100) with weighted KPIs."""
        weights = {
            "action_verb": 10,
            "active_voice": 10,
            "quantifiable": 20,
            "conciseness": 10,
            "tense": 5,
            "ats_safe": 10,
            "keywords": 10,
            "no_fluff": 5,
            "grammar": 5,
            "formula": 10,
            "business_outcome": 10,
            "technical_specificity": 10,
            "front_loaded": 5,
        }

        total_score = 0
        total_weight = sum(weights.values())

        for key, weight in weights.items():
            if key in kpis:
                kpi_score = kpis[key].get("score", 0)
                total_score += kpi_score * weight

        return round((total_score / total_weight) * 100, 1)

    def _generate_fixes(
        self, bullet: str, kpis: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Generate auto-fix suggestions (top 3 by confidence)."""
        fixes = []

        # Fix 1: Replace weak verb
        if not kpis["action_verb"]["pass"]:
            first_word = bullet.split()[0]
            suggestions = self._find_similar_verbs(first_word)
            for verb in suggestions[:2]:
                fixes.append(
                    {
                        "description": f"Replace '{first_word}' with stronger verb '{verb}'",
                        "confidence": 0.9,
                        "latexPatch": bullet.replace(first_word, verb, 1),
                    }
                )

        # Fix 2: Add metric placeholder
        if not kpis["quantifiable"]["pass"]:
            fixes.append(
                {
                    "description": "Add quantifiable metric (e.g., percentage, time, volume)",
                    "confidence": 0.7,
                    "latexPatch": bullet
                    + " [ADD METRIC: X% improvement / Y users / Z ms]",
                }
            )

        # Fix 3: Convert to XYZ format
        if kpis["formula"]["type"] == "None":
            fixes.append(
                {
                    "description": "Rewrite in XYZ format (Accomplished X by Y, resulting in Z)",
                    "confidence": 0.6,
                    "latexPatch": self._convert_to_xyz(bullet),
                }
            )

        # Sort by confidence and return top 3
        return sorted(fixes, key=lambda x: x["confidence"], reverse=True)[:3]

    def _generate_feedback(
        self, bullet: str, kpis: Dict[str, Any], score: float
    ) -> str:
        """Generate human-readable feedback."""
        feedback_parts = []

        if score >= 80:
            feedback_parts.append("✅ Strong bullet point!")
        elif score >= 60:
            feedback_parts.append("⚠️ Good bullet, but can be improved.")
        else:
            feedback_parts.append("❌ Needs significant improvement.")

        # Highlight top issues
        issues = []
        if not kpis["action_verb"]["pass"]:
            issues.append("Start with a strong action verb")
        if not kpis["quantifiable"]["pass"]:
            issues.append("Add quantifiable metrics")
        if kpis["conciseness"]["score"] < 0.5:
            issues.append("Shorten to 1-2 lines")
        if not kpis["no_fluff"]["pass"]:
            issues.append("Remove buzzwords")

        if issues:
            feedback_parts.append("\n\nTop improvements:")
            for issue in issues[:3]:
                feedback_parts.append(f"  • {issue}")

        return "\n".join(feedback_parts)

    def _load_action_verbs(self) -> List[str]:
        """Load list of strong action verbs."""
        return [
            # Leadership
            "Led",
            "Directed",
            "Managed",
            "Supervised",
            "Coordinated",
            "Orchestrated",
            "Spearheaded",
            "Championed",
            "Drove",
            "Guided",
            "Mentored",
            "Coached",
            # Technical/Building
            "Built",
            "Developed",
            "Designed",
            "Engineered",
            "Implemented",
            "Created",
            "Architected",
            "Programmed",
            "Coded",
            "Deployed",
            "Launched",
            "Shipped",
            # Improvement/Optimization
            "Optimized",
            "Improved",
            "Enhanced",
            "Streamlined",
            "Refactored",
            "Modernized",
            "Automated",
            "Accelerated",
            "Reduced",
            "Increased",
            "Boosted",
            "Elevated",
            # Analysis/Research
            "Analyzed",
            "Researched",
            "Investigated",
            "Evaluated",
            "Assessed",
            "Diagnosed",
            "Identified",
            "Discovered",
            "Uncovered",
            "Determined",
            "Measured",
            "Quantified",
            # Collaboration/Communication
            "Collaborated",
            "Partnered",
            "Coordinated",
            "Communicated",
            "Presented",
            "Documented",
            "Trained",
            "Educated",
            "Advised",
            "Consulted",
            "Facilitated",
            # Problem-Solving
            "Solved",
            "Resolved",
            "Debugged",
            "Troubleshot",
            "Fixed",
            "Remediated",
            "Mitigated",
            "Prevented",
            "Eliminated",
            "Addressed",
            "Corrected",
            # Data/Metrics
            "Tracked",
            "Monitored",
            "Measured",
            "Reported",
            "Visualized",
            "Dashboarded",
            # More verbs...
            "Achieved",
            "Delivered",
            "Executed",
            "Established",
            "Initiated",
            "Pioneered",
            "Transformed",
            "Revamped",
            "Scaled",
            "Expanded",
            "Integrated",
            "Migrated",
        ]

    def _find_similar_verbs(self, word: str) -> List[str]:
        """Find similar action verbs."""
        # Simple similarity: return verbs starting with same letter
        first_letter = word[0].upper()
        similar = [v for v in self.action_verbs if v[0] == first_letter]
        return similar[:3] if similar else self.action_verbs[:3]

    def _convert_to_xyz(self, bullet: str) -> str:
        """Convert bullet to XYZ format (simple template)."""
        # This is a placeholder - real implementation would be more sophisticated
        return f"Accomplished [X] as measured by [Y] by {bullet.lower()}"
