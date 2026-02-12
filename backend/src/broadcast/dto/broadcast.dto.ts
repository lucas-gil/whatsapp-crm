import { IsString, IsOptional, IsArray, IsNumber, IsDateString, IsEnum, IsObject } from 'class-validator';

export enum BroadcastStatusEnum {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  PAUSED = 'PAUSED',
}

export class CreateBroadcastDto {
  @IsString()
  readonly name!: string;

  @IsString()
  readonly message!: string;

  @IsOptional()
  @IsString()
  readonly templateId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  readonly tagFilter?: string[];

  @IsOptional()
  @IsString()
  readonly stageFilter?: string;

  @IsOptional()
  @IsNumber()
  readonly messagesPerMinute?: number;

  @IsOptional()
  @IsDateString()
  readonly scheduledFor?: string;

  @IsOptional()
  @IsObject()
  readonly scheduleConfig?: Record<string, any>;

  @IsOptional()
  @IsString()
  readonly scheduleTimezone?: string;
}

export class UpdateBroadcastDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsNumber()
  messagesPerMinute?: number;

  @IsOptional()
  @IsDateString()
  scheduledFor?: string;

  @IsOptional()
  @IsObject()
  scheduleConfig?: Record<string, any>;

  @IsOptional()
  @IsString()
  scheduleTimezone?: string;
}

export class AddBroadcastRecipientsDto {
  @IsArray()
  @IsString({ each: true })
  readonly phoneNumbers!: string[];
}

export class BroadcastQueryDto {
  @IsOptional()
  @IsEnum(BroadcastStatusEnum)
  status?: string;

  @IsOptional()
  @IsNumber()
  limit?: number;

  @IsOptional()
  @IsNumber()
  offset?: number;
}
