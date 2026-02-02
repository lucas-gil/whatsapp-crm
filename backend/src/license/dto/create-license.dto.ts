import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export enum LicenseTypeEnum {
  TEMPORARY_12MIN = 'TEMPORARY_12MIN',
  TEMPORARY_30DAYS = 'TEMPORARY_30DAYS',
  ADMIN_INFINITE = 'ADMIN_INFINITE',
}

export class CreateLicenseDto {
  @IsNotEmpty()
  @IsEnum(LicenseTypeEnum, { message: 'type deve ser um dos seguintes valores: TEMPORARY_12MIN, TEMPORARY_30DAYS, ADMIN_INFINITE' })
  type!: LicenseTypeEnum;
}
