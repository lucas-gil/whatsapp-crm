import * as fs from 'fs';
import * as path from 'path';

export interface StorageConfig {
  provider: 'local' | 's3' | 'minio';
  path?: string; // para local
  bucket?: string; // para s3/minio
  accessKey?: string;
  secretKey?: string;
  endpoint?: string; // para minio
}

export class StorageUtil {
  constructor(private config: StorageConfig) {}

  async saveFile(
    buffer: Buffer,
    fileName: string,
    subfolder?: string,
  ): Promise<{ path: string; url: string }> {
    if (this.config.provider === 'local') {
      return this.saveLocal(buffer, fileName, subfolder);
    }
    // TODO: implementar S3/MinIO
    throw new Error('Provider não implementado');
  }

  private saveLocal(
    buffer: Buffer,
    fileName: string,
    subfolder?: string,
  ): { path: string; url: string } {
    const basePath = this.config.path || './storage';
    const folder = subfolder ? path.join(basePath, subfolder) : basePath;

    // Criar pasta se não existir
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }

    const filePath = path.join(folder, fileName);
    fs.writeFileSync(filePath, buffer);

    return {
      path: filePath,
      url: `/storage/${subfolder ? subfolder + '/' : ''}${fileName}`,
    };
  }

  async getFile(filePath: string): Promise<Buffer> {
    if (this.config.provider === 'local') {
      return fs.readFileSync(filePath);
    }
    throw new Error('Provider não implementado');
  }

  async deleteFile(filePath: string): Promise<void> {
    if (this.config.provider === 'local') {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }
}
