import { IsEnum, IsNotEmpty, IsString, IsOptional, IsInt, IsObject } from 'class-validator';

export enum LicenseTypeEnum {
  TEMPORARY_12MIN = 'TEMPORARY_12MIN',
  TEMPORARY_30DAYS = 'TEMPORARY_30DAYS',
  ADMIN_INFINITE = 'ADMIN_INFINITE',
}

export class CreateLicenseDto {
  @IsNotEmpty()
  @IsEnum(LicenseTypeEnum, { message: 'type deve ser um dos seguintes valores: TEMPORARY_12MIN, TEMPORARY_30DAYS, ADMIN_INFINITE' })
  type!: LicenseTypeEnum;

  @IsOptional()
  @IsInt()
  // tempo de vida em segundos (se fornecido sobrepõe os tipos padrão)
  ttlSeconds?: number;

  @IsOptional()
  @IsObject()
  // options: objeto JSON com opções específicas salvas para esta chave
  options?: any;
}
