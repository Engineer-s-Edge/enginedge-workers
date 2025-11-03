"""
Resume Parser

Parses resume PDFs and extracts structured data.

Extracts:
- Contact information
- Experience sections with bullets
- Education
- Skills
- Projects
- Layout metadata (for ATS checks)
"""

import fitz  # PyMuPDF
import re
from typing import Dict, List, Any, Optional

class ResumeParser:
    def __init__(self):
        pass
    
    def parse_pdf(self, pdf_bytes: bytes) -> Dict[str, Any]:
        """
        Parse resume PDF and extract structured data.
        
        Returns:
            {
                "metadata": {...},
                "sections": {...},
                "rawText": "..."
            }
        """
        # Open PDF from bytes
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        result = {
            "metadata": self._extract_metadata(doc),
            "sections": self._extract_sections(doc),
            "rawText": self._extract_text(doc)
        }
        
        doc.close()
        return result
    
    def _extract_metadata(self, doc) -> Dict[str, Any]:
        """Extract PDF metadata and layout info."""
        return {
            "pages": len(doc),
            "fontsMinPt": self._get_min_font_size(doc),
            "layoutFlags": self._detect_layout_issues(doc)
        }
    
    def _get_min_font_size(self, doc) -> float:
        """Get minimum font size used."""
        min_size = 100.0
        
        for page in doc:
            blocks = page.get_text("dict")["blocks"]
            for block in blocks:
                if "lines" in block:
                    for line in block["lines"]:
                        for span in line["spans"]:
                            size = span.get("size", 12)
                            min_size = min(min_size, size)
        
        return min_size
    
    def _detect_layout_issues(self, doc) -> Dict[str, bool]:
        """Detect ATS-unfriendly layout features."""
        issues = {
            "tables": False,
            "columns": False,
            "icons": False,
            "images": False
        }
        
        for page in doc:
            # Detect tables (multiple vertical lines)
            paths = page.get_drawings()
            vertical_lines = [p for p in paths if self._is_vertical_line(p)]
            if len(vertical_lines) > 3:
                issues["tables"] = True
            
            # Detect columns (text in multiple vertical regions)
            blocks = page.get_text("dict")["blocks"]
            if self._has_multiple_columns(blocks):
                issues["columns"] = True
            
            # Detect images/icons
            images = page.get_images()
            if len(images) > 0:
                issues["icons"] = True
                issues["images"] = True
        
        return issues
    
    def _is_vertical_line(self, path: Dict) -> bool:
        """Check if path is a vertical line."""
        if "items" not in path or len(path["items"]) < 2:
            return False
        
        # Simple heuristic: check if y-coordinates change more than x
        items = path["items"]
        if len(items) >= 2:
            x_diff = abs(items[0][1].x - items[-1][1].x)
            y_diff = abs(items[0][1].y - items[-1][1].y)
            return y_diff > x_diff * 3
        
        return False
    
    def _has_multiple_columns(self, blocks: List[Dict]) -> bool:
        """Detect if text is in multiple columns."""
        # Group blocks by x-coordinate
        x_positions = []
        for block in blocks:
            if "bbox" in block:
                x_positions.append(block["bbox"][0])
        
        if not x_positions:
            return False
        
        # Check for distinct x-coordinate clusters
        x_positions.sort()
        gaps = []
        for i in range(len(x_positions) - 1):
            gap = x_positions[i + 1] - x_positions[i]
            if gap > 100:  # Significant gap
                gaps.append(gap)
        
        return len(gaps) >= 1  # At least one major gap = columns
    
    def _extract_text(self, doc) -> str:
        """Extract all text from PDF."""
        text = ""
        for page in doc:
            text += page.get_text()
        return text
    
    def _extract_sections(self, doc) -> Dict[str, Any]:
        """Extract resume sections."""
        text = self._extract_text(doc)
        
        return {
            "contact": self._extract_contact(text),
            "experience": self._extract_experience_section(text),
            "education": self._extract_education_section(text),
            "skills_raw": self._extract_skills_section(text),
            "projects": self._extract_projects_section(text)
        }
    
    def _extract_contact(self, text: str) -> Dict[str, Any]:
        """Extract contact information."""
        # Email
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        email_match = re.search(email_pattern, text)
        email = email_match.group(0) if email_match else None
        
        # Phone
        phone_pattern = r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}'
        phone_match = re.search(phone_pattern, text)
        phone = phone_match.group(0) if phone_match else None
        
        # LinkedIn
        linkedin_pattern = r'linkedin\.com/in/[\w-]+'
        linkedin_match = re.search(linkedin_pattern, text, re.IGNORECASE)
        linkedin = linkedin_match.group(0) if linkedin_match else None
        
        # GitHub
        github_pattern = r'github\.com/[\w-]+'
        github_match = re.search(github_pattern, text, re.IGNORECASE)
        github = github_match.group(0) if github_match else None
        
        # Name (assume first line or first capitalized words)
        lines = text.split('\n')
        name = None
        for line in lines[:5]:
            line = line.strip()
            if len(line) > 3 and line[0].isupper() and not '@' in line:
                name = line
                break
        
        return {
            "name": name,
            "email": email,
            "phone": phone,
            "linkedin": linkedin,
            "github": github
        }
    
    def _extract_experience_section(self, text: str) -> List[Dict[str, Any]]:
        """Extract experience section with bullets."""
        # Find experience section
        exp_match = re.search(
            r'(?i)(EXPERIENCE|WORK HISTORY|EMPLOYMENT)\s*\n',
            text
        )
        
        if not exp_match:
            return []
        
        # Get text after experience header
        exp_start = exp_match.end()
        
        # Find next major section
        next_section = re.search(
            r'(?i)\n(EDUCATION|SKILLS|PROJECTS|CERTIFICATIONS)\s*\n',
            text[exp_start:]
        )
        
        exp_end = exp_start + next_section.start() if next_section else len(text)
        exp_text = text[exp_start:exp_end]
        
        # Parse individual jobs
        jobs = []
        
        # Pattern: Company | Title | Dates
        job_pattern = r'([A-Z][^\n|]+)\s*\|\s*([^\n|]+)\s*\|\s*([^\n]+)'
        
        for match in re.finditer(job_pattern, exp_text):
            company = match.group(1).strip()
            title = match.group(2).strip()
            dates = match.group(3).strip()
            
            # Extract bullets for this job
            job_end = match.end()
            next_job = re.search(job_pattern, exp_text[job_end:])
            bullets_end = job_end + next_job.start() if next_job else len(exp_text)
            bullets_text = exp_text[job_end:bullets_end]
            
            bullets = self._extract_bullets(bullets_text)
            
            jobs.append({
                "org": company,
                "title": title,
                "dates": dates,
                "start": self._parse_date(dates, True),
                "end": self._parse_date(dates, False),
                "bullets": bullets
            })
        
        return jobs
    
    def _extract_bullets(self, text: str) -> List[str]:
        """Extract bullet points from text."""
        # Match lines starting with bullet characters or dashes
        bullet_pattern = r'^[\s]*[-•▪▸→]\s*(.+)$'
        
        bullets = []
        for line in text.split('\n'):
            match = re.match(bullet_pattern, line.strip())
            if match:
                bullet = match.group(1).strip()
                if len(bullet) > 10:  # Filter out short/empty bullets
                    bullets.append(bullet)
        
        return bullets
    
    def _parse_date(self, date_str: str, is_start: bool) -> Optional[str]:
        """Parse date from string."""
        # Simple parsing: look for month/year patterns
        date_pattern = r'(\w+)\s+(\d{4})'
        matches = re.findall(date_pattern, date_str)
        
        if matches:
            if is_start:
                return f"{matches[0][0]} {matches[0][1]}"
            else:
                if len(matches) > 1:
                    return f"{matches[1][0]} {matches[1][1]}"
                elif "present" in date_str.lower():
                    return "Present"
        
        return None
    
    def _extract_education_section(self, text: str) -> List[Dict[str, Any]]:
        """Extract education section."""
        # Find education section
        edu_match = re.search(r'(?i)(EDUCATION)\s*\n', text)
        
        if not edu_match:
            return []
        
        edu_start = edu_match.end()
        
        # Find next section
        next_section = re.search(
            r'(?i)\n(EXPERIENCE|SKILLS|PROJECTS|CERTIFICATIONS)\s*\n',
            text[edu_start:]
        )
        
        edu_end = edu_start + next_section.start() if next_section else len(text)
        edu_text = text[edu_start:edu_end]
        
        # Parse education entries
        education = []
        
        # Pattern: School | Degree | Date
        edu_pattern = r'([A-Z][^\n|]+)\s*\|\s*([^\n|]+)\s*\|\s*([^\n]+)'
        
        for match in re.finditer(edu_pattern, edu_text):
            school = match.group(1).strip()
            degree = match.group(2).strip()
            date = match.group(3).strip()
            
            education.append({
                "school": school,
                "degree": degree,
                "grad": date
            })
        
        return education
    
    def _extract_skills_section(self, text: str) -> str:
        """Extract skills section."""
        # Find skills section
        skills_match = re.search(r'(?i)(SKILLS|TECHNICAL SKILLS)\s*\n', text)
        
        if not skills_match:
            return ""
        
        skills_start = skills_match.end()
        
        # Find next section
        next_section = re.search(
            r'(?i)\n(EXPERIENCE|EDUCATION|PROJECTS|CERTIFICATIONS)\s*\n',
            text[skills_start:]
        )
        
        skills_end = skills_start + next_section.start() if next_section else len(text)
        skills_text = text[skills_start:skills_end].strip()
        
        return skills_text
    
    def _extract_projects_section(self, text: str) -> List[Dict[str, Any]]:
        """Extract projects section."""
        # Find projects section
        proj_match = re.search(r'(?i)(PROJECTS)\s*\n', text)
        
        if not proj_match:
            return []
        
        proj_start = proj_match.end()
        
        # Find next section
        next_section = re.search(
            r'(?i)\n(EXPERIENCE|EDUCATION|SKILLS|CERTIFICATIONS)\s*\n',
            text[proj_start:]
        )
        
        proj_end = proj_start + next_section.start() if next_section else len(text)
        proj_text = text[proj_start:proj_end]
        
        # Parse projects
        projects = []
        
        # Pattern: Project Name | Description
        proj_pattern = r'([A-Z][^\n|]+)\s*\|\s*([^\n]+)'
        
        for match in re.finditer(proj_pattern, proj_text):
            name = match.group(1).strip()
            description = match.group(2).strip()
            
            # Extract bullets
            proj_end_match = match.end()
            next_proj = re.search(proj_pattern, proj_text[proj_end_match:])
            bullets_end = proj_end_match + next_proj.start() if next_proj else len(proj_text)
            bullets_text = proj_text[proj_end_match:bullets_end]
            
            bullets = self._extract_bullets(bullets_text)
            
            projects.append({
                "name": name,
                "description": description,
                "bullets": bullets
            })
        
        return projects

