import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JobPosting } from '../../domain/entities/job-posting.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class JobPostingService {
  private readonly logger = new Logger(JobPostingService.name);

  constructor(
    @InjectModel('JobPosting')
    private readonly jobPostingModel: Model<JobPosting>,
  ) {}

  /**
   * Extract structured data from job posting text.
   */
  async extractFromText(
    userId: string,
    text: string,
    url?: string,
    html?: string,
  ): Promise<JobPosting> {
    this.logger.log(`Extracting job posting for user ${userId}`);

    // Send to NLP service via Kafka
    const correlationId = uuidv4();

    // TODO: Implement Kafka producer/consumer pattern
    // Send to 'resume.posting.extract' topic
    // Wait for response on 'resume.posting.extract.response'

    // For now, create with placeholder data
    const jobPosting = new this.jobPostingModel({
      userId,
      url,
      rawText: text,
      rawHtml: html,
      parsed: {
        metadata: {
          language: 'en',
          dateScraped: new Date(),
          textRaw: text,
          htmlRaw: html,
          checksumSha256: 'placeholder',
          sectionSpans: [],
        },
        role: {
          titleRaw: 'Software Engineer',
          roleFamily: 'Software Engineer',
          seniorityInferred: 'Mid',
          relevantOccupation: null,
        },
        employment: {
          employmentType: ['FULL_TIME'],
          workHours: null,
          jobStartDate: null,
        },
        location: {
          jobLocationType: null,
          applicantLocationRequirements: null,
          jobLocation: null,
          onsiteDaysPerWeek: 5,
          travelPercent: null,
          relocationOffered: false,
        },
        compensation: {
          baseSalary: null,
          bonus: null,
          equity: null,
          benefits: [],
        },
        authorization: {
          workAuthRequired: null,
          visaSponsorship: null,
          securityClearance: false,
        },
        education: {
          educationRequirements: null,
          experienceInPlaceOfEducation: false,
        },
        experience: {
          experienceRequirementsText: null,
          monthsMin: null,
          monthsPref: null,
        },
        skills: {
          skillsExplicit: [],
          skillsNormalized: [],
          softSkills: [],
        },
        responsibilities: [],
        internship: {
          isInternRole: false,
          durationWeeks: null,
          startWindow: null,
          expectedGraduationWindow: null,
          gpaRequired: null,
          returnOfferLanguage: null,
        },
        application: {
          materials: null,
          screeningQuestions: null,
          portal: null,
        },
        company: {
          hiringOrganization: null,
          department: null,
          industry: null,
          employerOverview: null,
        },
        quality: {
          expired: false,
          duplicateOf: null,
          incompleteDescription: false,
          keywordStuffing: false,
          locationMismatch: false,
        },
        provenance: [],
      },
      extractionMethod: 'nlp',
      confidence: 0.75,
      createdAt: new Date(),
    });

    return jobPosting.save();
  }

  /**
   * Get job posting by ID.
   */
  async getById(id: string): Promise<JobPosting | null> {
    return this.jobPostingModel.findById(id).exec();
  }

  /**
   * Get all job postings for a user.
   */
  async getByUserId(userId: string): Promise<JobPosting[]> {
    return this.jobPostingModel.find({ userId }).sort({ createdAt: -1 }).exec();
  }

  /**
   * Delete job posting.
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.jobPostingModel.deleteOne({ _id: id }).exec();
    return result.deletedCount > 0;
  }
}
