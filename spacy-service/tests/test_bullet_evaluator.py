"""
Tests for Bullet Evaluator

Tests the bullet point evaluation logic against gold dataset.
"""

import json
from pathlib import Path

import pytest

from src.services.bullet_evaluator import BulletEvaluator


@pytest.fixture
def evaluator():
    return BulletEvaluator()


@pytest.fixture
def gold_dataset():
    """Load gold dataset."""
    gold_file = Path(__file__).parent.parent / "data" / "gold_bullets.json"
    with open(gold_file, "r") as f:
        return json.load(f)


def test_evaluator_initialization(evaluator):
    """Test that evaluator initializes correctly."""
    assert evaluator is not None
    assert evaluator.nlp is not None
    assert len(evaluator.action_verbs) > 0


def test_strong_bullet_evaluation(evaluator):
    """Test evaluation of a strong bullet point."""
    bullet = (
        "Developed scalable microservices architecture using Node.js and Docker, "
        "reducing deployment time by 60%"
    )
    result = evaluator.evaluate(bullet)

    assert result["overallScore"] >= 0.85
    assert result["passed"] is True
    assert result["checks"]["actionVerb"]["passed"] is True
    assert result["checks"]["quantifiable"]["passed"] is True
    assert result["checks"]["activeVoice"]["passed"] is True


def test_weak_bullet_evaluation(evaluator):
    """Test evaluation of a weak bullet point."""
    bullet = "Was responsible for working on various projects"
    result = evaluator.evaluate(bullet)

    assert result["overallScore"] < 0.5
    assert result["checks"]["actionVerb"]["passed"] is False
    assert result["checks"]["activeVoice"]["passed"] is False
    assert result["checks"]["quantifiable"]["passed"] is False


def test_gold_dataset_accuracy(evaluator, gold_dataset):
    """Test evaluator against entire gold dataset."""
    correct_predictions = 0
    total_checks = 0

    for item in gold_dataset:
        bullet = item["bullet"]
        expected_checks = item["expectedChecks"]

        result = evaluator.evaluate(bullet)

        # Check each individual check
        for check_name, expected_value in expected_checks.items():
            if check_name in result["checks"]:
                actual_value = result["checks"][check_name]["passed"]
                if actual_value == expected_value:
                    correct_predictions += 1
                total_checks += 1

    accuracy = correct_predictions / total_checks if total_checks > 0 else 0
    print(
        f"\nGold Dataset Accuracy: {accuracy:.2%} ({correct_predictions}/{total_checks})"
    )

    # Assert at least 80% accuracy
    assert accuracy >= 0.80, f"Accuracy {accuracy:.2%} is below 80% threshold"


def test_action_verb_detection(evaluator):
    """Test action verb detection."""
    # Strong action verbs
    assert evaluator._check_action_verb("Developed a new feature")["passed"] is True
    assert evaluator._check_action_verb("Led a team of engineers")["passed"] is True
    assert evaluator._check_action_verb("Architected the system")["passed"] is True

    # Weak or no action verbs
    assert evaluator._check_action_verb("Was responsible for tasks")["passed"] is False
    assert evaluator._check_action_verb("Helped with projects")["passed"] is False


def test_quantifiable_results(evaluator):
    """Test quantifiable results detection."""
    # Has metrics
    assert (
        evaluator._check_quantifiable("Improved performance by 50%")["passed"] is True
    )
    assert evaluator._check_quantifiable("Reduced costs by $10K")["passed"] is True
    assert evaluator._check_quantifiable("Supported 1M users")["passed"] is True

    # No metrics
    assert evaluator._check_quantifiable("Improved the system")["passed"] is False
    assert evaluator._check_quantifiable("Made things better")["passed"] is False


def test_passive_voice_detection(evaluator):
    """Test passive voice detection."""
    # Active voice
    assert evaluator._check_active_voice("I developed the feature")["passed"] is True
    assert evaluator._check_active_voice("Led the project")["passed"] is True

    # Passive voice
    assert evaluator._check_active_voice("The feature was developed")["passed"] is False
    assert evaluator._check_active_voice("Tasks were completed")["passed"] is False


def test_conciseness(evaluator):
    """Test conciseness check."""
    # Good length
    short_bullet = "Developed feature with 50% improvement"
    assert evaluator._check_concise(short_bullet)["passed"] is True

    # Too short
    too_short = "Did work"
    assert evaluator._check_concise(too_short)["passed"] is False

    # Too long
    too_long = "A" * 300
    assert evaluator._check_concise(too_long)["passed"] is False


def test_ats_safety(evaluator):
    """Test ATS safety checks."""
    # Safe
    assert evaluator._check_ats_safe("Developed Python application")["passed"] is True

    # Unsafe characters
    assert evaluator._check_ats_safe("Developed app ★★★")["passed"] is False
    assert evaluator._check_ats_safe("Led team 👥")["passed"] is False


def test_fix_generation(evaluator):
    """Test auto-fix generation."""
    bullet = "Helped with improving system"
    evaluation = evaluator.evaluate(bullet)
    fixes = evaluator.generate_fixes(bullet, evaluation)

    assert len(fixes) > 0
    assert all("description" in fix for fix in fixes)
    assert all("fixedText" in fix for fix in fixes)
    assert all("confidence" in fix for fix in fixes)
    assert all(0 <= fix["confidence"] <= 1 for fix in fixes)


def test_role_specific_evaluation(evaluator):
    """Test role-specific evaluation."""
    bullet = "Developed machine learning model with 95% accuracy"

    # Should score higher for ML Engineer role
    ml_result = evaluator.evaluate(bullet, role="ML Engineer")
    generic_result = evaluator.evaluate(bullet, role="Frontend Engineer")

    # Both should pass, but ML role might have higher relevance
    assert ml_result["passed"] is True
    assert generic_result["passed"] is True


def test_tense_consistency(evaluator):
    """Test tense consistency check."""
    # Consistent past tense
    assert (
        evaluator._check_tense("Developed and deployed the application")["passed"]
        is True
    )

    # Consistent present tense
    assert evaluator._check_tense("Develop and deploy applications")["passed"] is True

    # Mixed tenses
    assert (
        evaluator._check_tense("Developed and deploy the application")["passed"]
        is False
    )


def test_keyword_presence(evaluator):
    """Test keyword presence check."""
    # Has relevant keywords
    assert (
        evaluator._check_keywords("Developed Python application using AWS")["passed"]
        is True
    )

    # Generic/vague
    assert evaluator._check_keywords("Did some work on things")["passed"] is False


def test_fluff_detection(evaluator):
    """Test fluff word detection."""
    # No fluff
    assert evaluator._check_no_fluff("Developed scalable system")["passed"] is True

    # Has fluff
    assert (
        evaluator._check_no_fluff("Leveraged synergies to optimize")["passed"] is False
    )
    assert evaluator._check_no_fluff("Utilized best practices")["passed"] is False


@pytest.mark.parametrize(
    "bullet,expected_min_score",
    [
        ("Developed scalable microservices reducing costs by 40%", 0.85),
        ("Led team of 5 engineers to deliver project 2 weeks early", 0.80),
        ("Implemented CI/CD pipeline increasing deployment frequency by 10x", 0.85),
        ("Was responsible for various tasks", 0.30),
        ("Helped with projects", 0.25),
    ],
)
def test_score_ranges(evaluator, bullet, expected_min_score):
    """Test that bullets score within expected ranges."""
    result = evaluator.evaluate(bullet)
    assert result["overallScore"] >= expected_min_score


def test_evaluation_consistency(evaluator):
    """Test that evaluation is consistent across multiple runs."""
    bullet = "Developed scalable microservices reducing costs by 40%"

    results = [evaluator.evaluate(bullet) for _ in range(5)]
    scores = [r["overallScore"] for r in results]

    # All scores should be identical (deterministic)
    assert len(set(scores)) == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
