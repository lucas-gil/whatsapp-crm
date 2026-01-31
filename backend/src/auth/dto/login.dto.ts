import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(20)
  key: string; // a chave de licença (mínimo 20 caracteres)

  workspaceSlug?: string; // opcional, se multi-workspace
}
