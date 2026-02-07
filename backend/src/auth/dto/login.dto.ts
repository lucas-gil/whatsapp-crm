import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(1)
  key!: string; // a chave de licença

  workspaceSlug?: string; // opcional, se multi-workspace
}
