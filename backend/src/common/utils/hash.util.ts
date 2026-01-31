import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

export class HashUtil {
  static async hash(text: string): Promise<string> {
    return bcrypt.hash(text, SALT_ROUNDS);
  }

  static async compare(text: string, hash: string): Promise<boolean> {
    return bcrypt.compare(text, hash);
  }

  static generateKeyPreview(key: string): string {
    const start = key.substring(0, 8);
    const end = key.substring(key.length - 4);
    return `${start}...${end}`;
  }
}
