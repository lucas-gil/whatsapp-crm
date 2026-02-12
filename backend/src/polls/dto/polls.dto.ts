import { IsArray, IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePollDto {
  @IsString()
  name!: string;

  @IsString()
  question!: string;

  @IsArray()
  @IsString({ each: true })
  options!: string[];

  @IsOptional()
  followUps?: Record<string, { question: string; options: string[] }>

  @IsOptional()
  @IsBoolean()
  useNative?: boolean;
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
