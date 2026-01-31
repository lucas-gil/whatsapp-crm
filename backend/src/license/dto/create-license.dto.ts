import { IsEnum } from 'class-validator';
import { LicenseType } from '@prisma/client';

export class CreateLicenseDto {
  @IsEnum(LicenseType)
  type: LicenseType;
}
