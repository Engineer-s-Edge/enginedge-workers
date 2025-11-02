/**
 * Submit Response DTO
 */

import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class SubmitResponseDto {
  @IsString()
  questionId!: string;

  @IsString()
  candidateResponse!: string;

  @IsOptional()
  @IsBoolean()
  skipped?: boolean;
}

