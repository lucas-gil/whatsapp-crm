import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class SectionOptionDto {
  @IsString()
  label!: string;

  @IsOptional()
  @IsNumber()
  nextSection?: number | null;

  @IsOptional()
  @IsString()
  replyTitle?: string;

  @IsOptional()
  @IsString()
  replyInfo?: string;

  @IsOptional()
  @IsString()
  replyMessage?: string;
}

class SectionDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  info?: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsString()
  question!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionOptionDto)
  options!: SectionOptionDto[];
}

export class CreatePollDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  introTitle?: string;

  @IsOptional()
  @IsString()
  introInfo?: string;

  @IsOptional()
  @IsString()
  introMessage?: string;

  @IsOptional()
  @IsString()
  question?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  followUps?: Record<string, { question: string; options: string[] }>

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionDto)
  sections?: SectionDto[];

  @IsOptional()
  @IsBoolean()
  useNative?: boolean;

  @IsOptional()
  @IsBoolean()
  autoStart?: boolean;
}

export class SendPollDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  phoneNumbers?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  groupIds?: string[];
}
