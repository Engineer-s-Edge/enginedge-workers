/**
 * Start Interview Session DTO
 */

import { IsString, IsEnum } from 'class-validator';

export class StartSessionDto {
  @IsString()
  interviewId!: string;

  @IsString()
  candidateId!: string;

  @IsEnum(['voice', 'text'])
  communicationMode!: 'voice' | 'text';
}
