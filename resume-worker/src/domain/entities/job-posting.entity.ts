import { Types } from 'mongoose';

/**
 * Job Posting - Parsed structured data from a job posting
 * Based on schema.org JobPosting + custom fields
 */

export interface JobPostingMetadata {
  url?: string;
  source?: string; // "LinkedIn" | "Indeed" | "Company Website"
  language: string;
  dateScraped: Date;
  datePosted?: string;
  validThrough?: string;
  directApply?: boolean;
  htmlRaw?: string;
  textRaw: string;
  checksumSha256: string;
  sectionSpans?: Array<{
    name: string; // "Responsibilities" | "Qualifications" | "Benefits"
    start: number;
    end: number;
  }>;
}

export interface JobPostingRole {
  titleRaw: string;
  roleFamily?: string; // "Software Engineer"
  seniorityInferred?: string; // "Senior" | "Mid" | "Junior"
  relevantOccupation?: {
    name: string;
    taxonomy: string; // "O*NET-SOC"
    code: string;
  };
}

export interface JobPostingEmployment {
  employmentType: string[]; // ["FULL_TIME"]
  workHours?: string;
  jobStartDate?: string;
}

export interface JobPostingLocation {
  jobLocationType?: string; // "TELECOMMUTE"
  applicantLocationRequirements?: string[]; // ["USA", "Canada"]
  jobLocation?: Array<{
    city?: string;
    region?: string;
    country?: string;
  }>;
  onsiteDaysPerWeek?: number;
  travelPercent?: number;
  relocationOffered?: boolean;
}

export interface JobPostingCompensation {
  baseSalary?: {
    currency: string;
    period: string; // "YEAR" | "MONTH" | "HOUR"
    min?: number;
    max?: number;
  };
  bonus?: string;
  equity?: string;
  ote?: string;
  benefits?: string[];
}

export interface JobPostingAuthorization {
  workAuthRequired?: string;
  visaSponsorship?: string; // "Yes" | "No" | "Not stated"
  securityClearance?: string;
}

export interface JobPostingEducation {
  educationRequirements?: Array<{
    level: string; // "Bachelors" | "Masters"
    field?: string[];
  }>;
  experienceInPlaceOfEducation?: boolean;
}

export interface JobPostingExperience {
  experienceRequirementsText?: string;
  monthsMin?: number;
  monthsPref?: number;
}

export interface JobPostingSkills {
  skillsExplicit: string[]; // As written in posting
  skillsNormalized?: Array<{
    name: string;
    id?: string; // Lightcast/O*NET ID
    type?: string; // "language" | "framework" | "cloud"
  }>;
  softSkills?: string[];
}

export interface JobPostingInternship {
  isInternRole: boolean;
  durationWeeks?: number;
  startWindow?: string;
  expectedGraduationWindow?: string;
  gpaRequired?: number;
  returnOfferLanguage?: string;
}

export interface JobPostingApplication {
  materials?: string[]; // ["Resume", "Cover Letter"]
  screeningQuestions?: string[];
  portal?: string;
}

export interface JobPostingCompany {
  hiringOrganization?: string;
  department?: string;
  industry?: string;
  employerOverview?: string;
}

export interface JobPostingQuality {
  expired: boolean;
  duplicateOf?: Types.ObjectId;
  incompleteDescription: boolean;
  keywordStuffing: boolean;
  locationMismatch: boolean;
}

export interface JobPostingProvenance {
  field: string; // "experience.monthsMin"
  section: string; // "Minimum Qualifications"
  charStart: number;
  charEnd: number;
  snippet: string;
}

export interface JobPostingParsed {
  metadata: JobPostingMetadata;
  role: JobPostingRole;
  employment: JobPostingEmployment;
  location: JobPostingLocation;
  compensation: JobPostingCompensation;
  authorization: JobPostingAuthorization;
  education: JobPostingEducation;
  experience: JobPostingExperience;
  skills: JobPostingSkills;
  responsibilities?: string[];
  internship: JobPostingInternship;
  application: JobPostingApplication;
  company: JobPostingCompany;
  quality: JobPostingQuality;
  provenance?: JobPostingProvenance[];
}

/**
 * Job Posting Entity
 */
export interface JobPosting {
  id: Types.ObjectId;
  userId: string;
  url?: string;
  rawText: string;
  rawHtml?: string;
  parsed: JobPostingParsed;
  extractionMethod: 'nlp-only' | 'llm-assisted';
  confidence: number; // 0-1
  createdAt: Date;
  updatedAt: Date;
}

export type JobPostingDocument = JobPosting & Document;
