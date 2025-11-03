/**
 * Create Interview DTO
 */

import {
  IsString,
  IsOptional,
  IsArray,
  IsObject,
  IsNumber,
  ValidateNested,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class InterviewPhaseDto {
  @IsString()
  phaseId!: string;

  @IsEnum(['behavioral', 'technical', 'coding', 'system-design'])
  type!: 'behavioral' | 'technical' | 'coding' | 'system-design';

  @IsNumber()
  @Min(1)
  duration!: number; // minutes

  @IsEnum(['easy', 'medium', 'hard'])
  difficulty!: 'easy' | 'medium' | 'hard';

  @IsNumber()
  @Min(1)
  questionCount!: number;

  @IsOptional()
  @IsString()
  promptOverride?: string;

  @IsOptional()
  @IsObject()
  config?: {
    allowPause?: boolean;
    allowSkip?: boolean;
    maxFollowupsPerQuestion?: number;
  };
}

export class InterviewConfigDto {
  @IsOptional()
  allowPause?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPauseDuration?: number | null; // null = unlimited

  @IsOptional()
  allowSkip?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxSkips?: number | null; // null = unlimited

  @IsNumber()
  @Min(1)
  totalTimeLimit!: number; // minutes - total interview time limit
}

export class ScoringRubricDto {
  @IsObject()
  overall!: {
    weights: {
      behavioral?: number;
      technical?: number;
      coding?: number;
      systemDesign?: number;
    };
  };

  @IsOptional()
  @IsObject()
  byPhase?: Record<
    string,
    {
      criteria: string[];
      weights?: Record<string, number>;
    }
  >;
}

export class CreateInterviewDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InterviewPhaseDto)
  phases!: InterviewPhaseDto[];

  @ValidateNested()
  @Type(() => InterviewConfigDto)
  config!: InterviewConfigDto;

  @ValidateNested()
  @Type(() => ScoringRubricDto)
  rubric!: ScoringRubricDto;
}
