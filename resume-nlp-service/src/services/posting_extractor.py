"""
Job Posting Extractor

Extracts structured data from job postings using NLP and rule-based patterns.

Extracts:
- Role and seniority
- Skills (required and preferred)
- Experience requirements
- Education requirements
- Compensation
- Location and remote policy
- Responsibilities
"""

import re
import spacy
from typing import Dict, List, Any, Optional, Tuple

class PostingExtractor:
    def __init__(self):
        # Load spaCy model
        try:
            self.nlp = spacy.load("en_core_web_lg")
        except OSError:
            print("Downloading spaCy model...")
            import subprocess
            subprocess.run(["python", "-m", "spacy", "download", "en_core_web_lg"])
            self.nlp = spacy.load("en_core_web_lg")
        
        # Load skill taxonomy (common tech skills)
        self.skill_patterns = self._load_skill_taxonomy()
        
        # Seniority keywords
        self.seniority_keywords = {
            "entry": ["entry", "junior", "associate", "new grad", "graduate"],
            "mid": ["mid", "intermediate", "experienced"],
            "senior": ["senior", "sr", "lead", "principal", "staff"],
            "executive": ["director", "vp", "vice president", "chief", "head of"]
        }
    
    def extract(self, text: str, html: Optional[str] = None) -> Dict[str, Any]:
        """
        Extract structured data from job posting.
        
        Returns:
            {
                "parsed": {...},
                "confidence": 0-1
            }
        """
        doc = self.nlp(text)
        
        parsed = {
            "metadata": self._extract_metadata(text, html),
            "role": self._extract_role(doc, text),
            "employment": self._extract_employment(doc, text),
            "location": self._extract_location(doc, text),
            "compensation": self._extract_compensation(doc, text),
            "authorization": self._extract_authorization(text),
            "education": self._extract_education(doc, text),
            "experience": self._extract_experience(doc, text),
            "skills": self._extract_skills(doc, text),
            "responsibilities": self._extract_responsibilities(text),
            "internship": self._extract_internship(text),
            "application": self._extract_application(text),
            "company": self._extract_company(doc, text),
            "quality": self._assess_quality(text),
            "provenance": []  # Would track extraction sources
        }
        
        # Calculate confidence
        confidence = self._calculate_confidence(parsed)
        
        return {
            "parsed": parsed,
            "confidence": confidence
        }
    
    def _extract_metadata(self, text: str, html: Optional[str]) -> Dict[str, Any]:
        """Extract posting metadata."""
        import hashlib
        
        return {
            "language": "en",
            "dateScraped": None,  # Would be set by caller
            "textRaw": text,
            "htmlRaw": html,
            "checksumSha256": hashlib.sha256(text.encode()).hexdigest(),
            "sectionSpans": self._detect_sections(text)
        }
    
    def _detect_sections(self, text: str) -> List[Dict[str, Any]]:
        """Detect major sections in posting."""
        sections = []
        
        section_patterns = [
            (r"(?i)(responsibilities|what you'll do|duties)", "Responsibilities"),
            (r"(?i)(qualifications|requirements|what we're looking for)", "Qualifications"),
            (r"(?i)(preferred|nice to have|bonus)", "Preferred Qualifications"),
            (r"(?i)(benefits|perks|what we offer)", "Benefits"),
            (r"(?i)(about (us|the company|the role))", "About"),
        ]
        
        for pattern, name in section_patterns:
            match = re.search(pattern, text)
            if match:
                sections.append({
                    "name": name,
                    "start": match.start(),
                    "end": match.start() + 500  # Approximate section length
                })
        
        return sections
    
    def _extract_role(self, doc, text: str) -> Dict[str, Any]:
        """Extract role information."""
        # Try to find job title (usually in first few lines)
        first_lines = '\n'.join(text.split('\n')[:5])
        
        # Look for common title patterns
        title_pattern = r'(?i)(job title|position|role):\s*([^\n]+)'
        title_match = re.search(title_pattern, first_lines)
        
        title_raw = title_match.group(2).strip() if title_match else "Unknown"
        
        # Infer seniority
        seniority = self._infer_seniority(text)
        
        # Normalize role family
        role_family = self._normalize_role_family(title_raw)
        
        return {
            "titleRaw": title_raw,
            "roleFamily": role_family,
            "seniorityInferred": seniority,
            "relevantOccupation": None  # Would map to O*NET
        }
    
    def _infer_seniority(self, text: str) -> str:
        """Infer seniority level from text."""
        text_lower = text.lower()
        
        for level, keywords in self.seniority_keywords.items():
            for keyword in keywords:
                if keyword in text_lower:
                    return level.capitalize()
        
        # Check years of experience
        exp_match = re.search(r'(\d+)\+?\s*years?', text_lower)
        if exp_match:
            years = int(exp_match.group(1))
            if years >= 7:
                return "Senior"
            elif years >= 3:
                return "Mid"
            else:
                return "Junior"
        
        return "Mid"  # Default
    
    def _normalize_role_family(self, title: str) -> str:
        """Normalize job title to role family."""
        title_lower = title.lower()
        
        if any(kw in title_lower for kw in ["software", "engineer", "developer", "programmer"]):
            return "Software Engineer"
        elif any(kw in title_lower for kw in ["data scientist", "ml engineer", "machine learning"]):
            return "Data Scientist"
        elif any(kw in title_lower for kw in ["devops", "sre", "site reliability"]):
            return "DevOps/SRE"
        elif any(kw in title_lower for kw in ["product manager", "pm"]):
            return "Product Manager"
        elif any(kw in title_lower for kw in ["designer", "ux", "ui"]):
            return "Designer"
        else:
            return "Other"
    
    def _extract_employment(self, doc, text: str) -> Dict[str, Any]:
        """Extract employment type."""
        text_lower = text.lower()
        
        employment_types = []
        if "full-time" in text_lower or "full time" in text_lower:
            employment_types.append("FULL_TIME")
        if "part-time" in text_lower or "part time" in text_lower:
            employment_types.append("PART_TIME")
        if "contract" in text_lower:
            employment_types.append("CONTRACT")
        if "intern" in text_lower:
            employment_types.append("INTERN")
        
        return {
            "employmentType": employment_types if employment_types else ["FULL_TIME"],
            "workHours": None,
            "jobStartDate": None
        }
    
    def _extract_location(self, doc, text: str) -> Dict[str, Any]:
        """Extract location and remote policy."""
        text_lower = text.lower()
        
        # Check for remote
        is_remote = any(kw in text_lower for kw in ["remote", "work from home", "wfh"])
        is_hybrid = "hybrid" in text_lower
        
        # Extract locations using NER
        locations = []
        for ent in doc.ents:
            if ent.label_ in ["GPE", "LOC"]:
                locations.append({
                    "city": ent.text,
                    "region": None,
                    "country": None
                })
        
        return {
            "jobLocationType": "TELECOMMUTE" if is_remote else None,
            "applicantLocationRequirements": None,
            "jobLocation": locations[:3] if locations else None,
            "onsiteDaysPerWeek": 3 if is_hybrid else (0 if is_remote else 5),
            "travelPercent": None,
            "relocationOffered": "relocation" in text_lower
        }
    
    def _extract_compensation(self, doc, text: str) -> Dict[str, Any]:
        """Extract salary and compensation."""
        # Salary range pattern
        salary_pattern = r'\$(\d{1,3}(?:,\d{3})*(?:k|K)?)\s*-\s*\$(\d{1,3}(?:,\d{3})*(?:k|K)?)'
        match = re.search(salary_pattern, text)
        
        if match:
            min_sal = self._parse_salary(match.group(1))
            max_sal = self._parse_salary(match.group(2))
            
            return {
                "baseSalary": {
                    "currency": "USD",
                    "period": "YEAR",
                    "min": min_sal,
                    "max": max_sal
                },
                "bonus": None,
                "equity": "equity" in text.lower() or "stock" in text.lower(),
                "benefits": self._extract_benefits(text)
            }
        
        return {
            "baseSalary": None,
            "bonus": None,
            "equity": None,
            "benefits": self._extract_benefits(text)
        }
    
    def _parse_salary(self, salary_str: str) -> int:
        """Parse salary string to integer."""
        # Remove commas
        salary_str = salary_str.replace(',', '')
        
        # Handle 'k' suffix
        if salary_str.endswith('k') or salary_str.endswith('K'):
            return int(salary_str[:-1]) * 1000
        
        return int(salary_str)
    
    def _extract_benefits(self, text: str) -> List[str]:
        """Extract benefits mentioned."""
        benefits = []
        benefit_keywords = {
            "health": ["health insurance", "medical", "dental", "vision"],
            "401k": ["401k", "retirement", "pension"],
            "pto": ["pto", "paid time off", "vacation", "unlimited pto"],
            "equity": ["equity", "stock options", "rsu"],
            "bonus": ["bonus", "performance bonus"],
        }
        
        text_lower = text.lower()
        for benefit, keywords in benefit_keywords.items():
            if any(kw in text_lower for kw in keywords):
                benefits.append(benefit)
        
        return benefits
    
    def _extract_authorization(self, text: str) -> Dict[str, Any]:
        """Extract work authorization requirements."""
        text_lower = text.lower()
        
        work_auth_required = any(kw in text_lower for kw in [
            "authorized to work",
            "work authorization",
            "eligible to work"
        ])
        
        visa_sponsorship = None
        if "visa sponsorship" in text_lower:
            if "no visa" in text_lower or "not sponsor" in text_lower:
                visa_sponsorship = "No"
            else:
                visa_sponsorship = "Yes"
        
        return {
            "workAuthRequired": "Required" if work_auth_required else None,
            "visaSponsorship": visa_sponsorship,
            "securityClearance": "clearance" in text_lower
        }
    
    def _extract_education(self, doc, text: str) -> Dict[str, Any]:
        """Extract education requirements."""
        text_lower = text.lower()
        
        requirements = []
        
        # Check for degree levels
        if "bachelor" in text_lower or "bs" in text_lower or "ba" in text_lower:
            requirements.append({
                "level": "Bachelors",
                "field": self._extract_degree_fields(text)
            })
        
        if "master" in text_lower or "ms" in text_lower or "ma" in text_lower:
            requirements.append({
                "level": "Masters",
                "field": self._extract_degree_fields(text)
            })
        
        if "phd" in text_lower or "doctorate" in text_lower:
            requirements.append({
                "level": "PhD",
                "field": self._extract_degree_fields(text)
            })
        
        # Check for experience in place of education
        exp_in_place = "or equivalent experience" in text_lower
        
        return {
            "educationRequirements": requirements if requirements else None,
            "experienceInPlaceOfEducation": exp_in_place
        }
    
    def _extract_degree_fields(self, text: str) -> List[str]:
        """Extract degree fields."""
        fields = []
        field_keywords = [
            "computer science", "cs", "software engineering",
            "electrical engineering", "ee", "computer engineering",
            "mathematics", "physics", "related field"
        ]
        
        text_lower = text.lower()
        for field in field_keywords:
            if field in text_lower:
                fields.append(field.title())
        
        return fields if fields else ["Related Field"]
    
    def _extract_experience(self, doc, text: str) -> Dict[str, Any]:
        """Extract experience requirements."""
        # Pattern for years of experience
        patterns = [
            r'(\d+)\+?\s*years?',
            r'(\d+)-(\d+)\s*years?',
            r'minimum\s+(\d+)\s*years?'
        ]
        
        months_min = None
        for pattern in patterns:
            match = re.search(pattern, text.lower())
            if match:
                years = int(match.group(1))
                months_min = years * 12
                break
        
        return {
            "experienceRequirementsText": None,
            "monthsMin": months_min,
            "monthsPref": None
        }
    
    def _extract_skills(self, doc, text: str) -> Dict[str, Any]:
        """Extract required and preferred skills."""
        skills_explicit = []
        
        # Method 1: NER for tech entities
        for ent in doc.ents:
            if ent.label_ in ["PRODUCT", "ORG"] and len(ent.text) > 2:
                skills_explicit.append(ent.text)
        
        # Method 2: Pattern matching against taxonomy
        text_lower = text.lower()
        for skill in self.skill_patterns:
            # Match whole words only
            if re.search(rf'\b{re.escape(skill.lower())}\b', text_lower):
                skills_explicit.append(skill)
        
        # Deduplicate
        skills_explicit = list(set(skills_explicit))
        
        # Normalize skills
        skills_normalized = [
            {"name": skill, "type": self._classify_skill_type(skill)}
            for skill in skills_explicit
        ]
        
        return {
            "skillsExplicit": skills_explicit,
            "skillsNormalized": skills_normalized,
            "softSkills": self._extract_soft_skills(text)
        }
    
    def _classify_skill_type(self, skill: str) -> str:
        """Classify skill type."""
        skill_lower = skill.lower()
        
        if skill_lower in ["python", "java", "javascript", "typescript", "go", "rust", "c++", "c#"]:
            return "language"
        elif skill_lower in ["react", "angular", "vue", "django", "flask", "spring", "express"]:
            return "framework"
        elif skill_lower in ["aws", "azure", "gcp", "google cloud"]:
            return "cloud"
        elif skill_lower in ["postgresql", "mysql", "mongodb", "redis", "dynamodb"]:
            return "database"
        elif skill_lower in ["docker", "kubernetes", "jenkins", "gitlab", "terraform"]:
            return "devops"
        else:
            return "tool"
    
    def _extract_soft_skills(self, text: str) -> List[str]:
        """Extract soft skills."""
        soft_skills = []
        soft_skill_keywords = [
            "communication", "collaboration", "teamwork", "leadership",
            "problem solving", "critical thinking", "adaptability",
            "time management", "creativity"
        ]
        
        text_lower = text.lower()
        for skill in soft_skill_keywords:
            if skill in text_lower:
                soft_skills.append(skill.title())
        
        return soft_skills
    
    def _extract_responsibilities(self, text: str) -> List[str]:
        """Extract job responsibilities."""
        # Find responsibilities section
        resp_match = re.search(
            r'(?i)(responsibilities|what you\'ll do|duties):\s*\n((?:[-•]\s*.+\n?)+)',
            text
        )
        
        if resp_match:
            resp_text = resp_match.group(2)
            # Split by bullet points
            bullets = re.findall(r'[-•]\s*(.+)', resp_text)
            return [b.strip() for b in bullets if len(b.strip()) > 10]
        
        return []
    
    def _extract_internship(self, text: str) -> Dict[str, Any]:
        """Extract internship-specific info."""
        text_lower = text.lower()
        is_intern = "intern" in text_lower
        
        return {
            "isInternRole": is_intern,
            "durationWeeks": None,
            "startWindow": None,
            "expectedGraduationWindow": None,
            "gpaRequired": None,
            "returnOfferLanguage": None
        }
    
    def _extract_application(self, text: str) -> Dict[str, Any]:
        """Extract application requirements."""
        text_lower = text.lower()
        
        materials = []
        if "resume" in text_lower or "cv" in text_lower:
            materials.append("Resume")
        if "cover letter" in text_lower:
            materials.append("Cover Letter")
        if "portfolio" in text_lower:
            materials.append("Portfolio")
        if "transcript" in text_lower:
            materials.append("Transcript")
        
        return {
            "materials": materials if materials else None,
            "screeningQuestions": None,
            "portal": None
        }
    
    def _extract_company(self, doc, text: str) -> Dict[str, Any]:
        """Extract company information."""
        # Extract organization names
        orgs = [ent.text for ent in doc.ents if ent.label_ == "ORG"]
        
        return {
            "hiringOrganization": orgs[0] if orgs else None,
            "department": None,
            "industry": None,
            "employerOverview": None
        }
    
    def _assess_quality(self, text: str) -> Dict[str, Any]:
        """Assess posting quality."""
        return {
            "expired": False,
            "duplicateOf": None,
            "incompleteDescription": len(text) < 200,
            "keywordStuffing": False,
            "locationMismatch": False
        }
    
    def _calculate_confidence(self, parsed: Dict[str, Any]) -> float:
        """Calculate extraction confidence."""
        confidence = 0.5  # Base confidence
        
        # Boost for extracted fields
        if parsed["role"]["titleRaw"] != "Unknown":
            confidence += 0.1
        if parsed["skills"]["skillsExplicit"]:
            confidence += 0.1
        if parsed["experience"]["monthsMin"]:
            confidence += 0.1
        if parsed["location"]["jobLocation"]:
            confidence += 0.1
        if parsed["compensation"]["baseSalary"]:
            confidence += 0.1
        
        return min(confidence, 1.0)
    
    def _load_skill_taxonomy(self) -> List[str]:
        """Load common tech skills."""
        return [
            # Languages
            "Python", "Java", "JavaScript", "TypeScript", "Go", "Rust",
            "C++", "C#", "Ruby", "PHP", "Swift", "Kotlin", "Scala",
            
            # Frameworks
            "React", "Angular", "Vue", "Django", "Flask", "FastAPI",
            "Spring", "Express", "Node.js", "Next.js", "Rails",
            
            # Cloud
            "AWS", "Azure", "GCP", "Google Cloud", "Heroku", "DigitalOcean",
            
            # Databases
            "PostgreSQL", "MySQL", "MongoDB", "Redis", "DynamoDB",
            "Cassandra", "Elasticsearch", "Neo4j",
            
            # DevOps
            "Docker", "Kubernetes", "Jenkins", "GitLab", "CircleCI",
            "Terraform", "Ansible", "Prometheus", "Grafana",
            
            # Tools
            "Git", "GitHub", "Jira", "Confluence", "Slack",
            
            # Data/ML
            "TensorFlow", "PyTorch", "Pandas", "NumPy", "Scikit-learn",
            "Spark", "Hadoop", "Kafka", "Airflow",
            
            # More...
            "REST", "GraphQL", "gRPC", "Microservices", "Agile", "Scrum"
        ]

