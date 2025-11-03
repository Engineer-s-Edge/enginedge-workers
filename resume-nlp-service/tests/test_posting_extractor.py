"""
Tests for Job Posting Extractor
"""

import pytest
from src.services.posting_extractor import PostingExtractor


@pytest.fixture
def extractor():
    return PostingExtractor()


@pytest.fixture
def sample_posting():
    return """
    Senior Software Engineer

    We are looking for a Senior Software Engineer to join our team.

    Requirements:
    - 5+ years of experience in software development
    - Strong proficiency in Python, JavaScript, and TypeScript
    - Experience with React, Node.js, and AWS
    - Bachelor's degree in Computer Science or related field

    Responsibilities:
    - Design and develop scalable microservices
    - Lead technical discussions and code reviews
    - Mentor junior engineers

    Compensation: $120,000 - $160,000 per year
    Location: San Francisco, CA (Hybrid)
    Benefits: Health insurance, 401k, unlimited PTO

    Apply at: jobs@example.com
    """


def test_extractor_initialization(extractor):
    """Test that extractor initializes correctly."""
    assert extractor is not None
    assert extractor.nlp is not None
    assert len(extractor.skill_patterns) > 0


def test_basic_extraction(extractor, sample_posting):
    """Test basic extraction from job posting."""
    result = extractor.extract(sample_posting)

    assert "parsed" in result
    assert "confidence" in result
    assert result["confidence"] > 0


def test_role_extraction(extractor, sample_posting):
    """Test role extraction."""
    result = extractor.extract(sample_posting)
    role = result["parsed"]["role"]

    assert "titleRaw" in role
    assert "roleFamily" in role
    assert "seniorityInferred" in role
    assert role["seniorityInferred"] == "Senior"


def test_skills_extraction(extractor, sample_posting):
    """Test skills extraction."""
    result = extractor.extract(sample_posting)
    skills = result["parsed"]["skills"]

    assert "skillsExplicit" in skills
    assert len(skills["skillsExplicit"]) > 0

    # Should find Python, JavaScript, React, etc.
    skill_names = [s.lower() for s in skills["skillsExplicit"]]
    assert any("python" in s for s in skill_names)
    assert any("javascript" in s for s in skill_names)


def test_experience_extraction(extractor, sample_posting):
    """Test experience requirements extraction."""
    result = extractor.extract(sample_posting)
    experience = result["parsed"]["experience"]

    assert "monthsMin" in experience
    assert experience["monthsMin"] == 60  # 5 years = 60 months


def test_compensation_extraction(extractor, sample_posting):
    """Test compensation extraction."""
    result = extractor.extract(sample_posting)
    compensation = result["parsed"]["compensation"]

    assert "baseSalary" in compensation
    if compensation["baseSalary"]:
        assert compensation["baseSalary"]["min"] == 120000
        assert compensation["baseSalary"]["max"] == 160000


def test_location_extraction(extractor, sample_posting):
    """Test location extraction."""
    result = extractor.extract(sample_posting)
    location = result["parsed"]["location"]

    assert "jobLocation" in location
    # Should detect San Francisco


def test_education_extraction(extractor, sample_posting):
    """Test education requirements extraction."""
    result = extractor.extract(sample_posting)
    education = result["parsed"]["education"]

    assert "educationRequirements" in education
    if education["educationRequirements"]:
        assert any(
            "bachelor" in req["level"].lower()
            for req in education["educationRequirements"]
        )


def test_seniority_inference(extractor):
    """Test seniority level inference."""
    # Senior level
    senior_posting = "Senior Software Engineer with 7+ years experience"
    result = extractor.extract(senior_posting)
    assert result["parsed"]["role"]["seniorityInferred"] == "Senior"

    # Junior level
    junior_posting = "Junior Developer, entry level position"
    result = extractor.extract(junior_posting)
    assert result["parsed"]["role"]["seniorityInferred"] in ["Junior", "Entry"]

    # Mid level
    mid_posting = "Software Engineer with 3-5 years experience"
    result = extractor.extract(mid_posting)
    assert result["parsed"]["role"]["seniorityInferred"] == "Mid"


def test_remote_detection(extractor):
    """Test remote work detection."""
    remote_posting = "Remote Software Engineer position, work from anywhere"
    result = extractor.extract(remote_posting)
    location = result["parsed"]["location"]

    assert location["onsiteDaysPerWeek"] == 0


def test_hybrid_detection(extractor):
    """Test hybrid work detection."""
    hybrid_posting = "Hybrid position, 3 days in office"
    result = extractor.extract(hybrid_posting)
    location = result["parsed"]["location"]

    assert location["onsiteDaysPerWeek"] == 3


def test_benefits_extraction(extractor):
    """Test benefits extraction."""
    posting = "Benefits: health insurance, 401k, dental, vision, unlimited PTO"
    result = extractor.extract(posting)
    benefits = result["parsed"]["compensation"]["benefits"]

    assert len(benefits) > 0
    assert "health" in benefits or "pto" in benefits


def test_confidence_scoring(extractor):
    """Test confidence scoring."""
    # Detailed posting should have high confidence
    detailed = """
    Senior Software Engineer
    5+ years experience required
    Python, AWS, Docker
    $120k-$150k
    San Francisco, CA
    """
    result = extractor.extract(detailed)
    assert result["confidence"] > 0.6

    # Sparse posting should have lower confidence
    sparse = "Software Engineer needed"
    result = extractor.extract(sparse)
    assert result["confidence"] < 0.7


def test_section_detection(extractor, sample_posting):
    """Test section detection."""
    result = extractor.extract(sample_posting)
    sections = result["parsed"]["metadata"]["sectionSpans"]

    # Should detect some sections
    assert isinstance(sections, list)


def test_responsibilities_extraction(extractor, sample_posting):
    """Test responsibilities extraction."""
    result = extractor.extract(sample_posting)
    responsibilities = result["parsed"]["responsibilities"]

    assert isinstance(responsibilities, list)
    # Should extract bullet points from responsibilities section


def test_visa_sponsorship_detection(extractor):
    """Test visa sponsorship detection."""
    # Offers sponsorship
    posting1 = "Visa sponsorship available"
    result1 = extractor.extract(posting1)
    assert result1["parsed"]["authorization"]["visaSponsorship"] == "Yes"

    # No sponsorship
    posting2 = "No visa sponsorship available"
    result2 = extractor.extract(posting2)
    assert result2["parsed"]["authorization"]["visaSponsorship"] == "No"


def test_salary_parsing(extractor):
    """Test salary parsing."""
    # Test various formats
    test_cases = [
        ("$100,000 - $120,000", 100000, 120000),
        ("$100k - $120k", 100000, 120000),
        ("100k-120k", 100000, 120000),
    ]

    for text, expected_min, expected_max in test_cases:
        result = extractor.extract(text)
        compensation = result["parsed"]["compensation"]
        if compensation["baseSalary"]:
            assert compensation["baseSalary"]["min"] == expected_min
            assert compensation["baseSalary"]["max"] == expected_max


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
