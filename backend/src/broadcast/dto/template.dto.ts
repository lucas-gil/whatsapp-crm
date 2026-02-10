import { IsString, IsOptional, IsArray, IsBoolean } from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  readonly name!: string;

  @IsString()
  readonly category!: string;

  @IsString()
  readonly content!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  readonly variables?: string[];

  @IsOptional()
  @IsString()
  readonly attachmentUrl?: string;

  @IsOptional()
  @IsBoolean()
  readonly isActive?: boolean;
}

export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  readonly name?: string;

  @IsOptional()
  @IsString()
  readonly category?: string;

  @IsOptional()
  @IsString()
  readonly content?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  readonly variables?: string[];

  @IsOptional()
  @IsString()
  readonly attachmentUrl?: string;

  @IsOptional()
  @IsBoolean()
  readonly isActive?: boolean;
}

export class TemplateQueryDto {
  @IsOptional()
  @IsString()
  readonly category?: string;

  @IsOptional()
  @IsBoolean()
  readonly isActive?: boolean;

  @IsOptional()
  @IsString()
  readonly search?: string;
}
