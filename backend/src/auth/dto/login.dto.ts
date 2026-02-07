import { IsString, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  key!: string; // a chave de licença

  workspaceSlug?: string; // opcional, se multi-workspace
}
