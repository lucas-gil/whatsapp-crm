import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

export class HashUtil {
  static async hash(text: string): Promise<string> {
    console.log(`🔐 HashUtil.hash: Gerando hash bcrypt com SALT_ROUNDS=${SALT_ROUNDS}...`);
    const hash = await bcrypt.hash(text, SALT_ROUNDS);
    console.log(`✅ Hash gerado: ${hash.substring(0, 30)}...`);
    return hash;
  }

  static async compare(text: string, hash: string): Promise<boolean> {
    console.log(`🔍 HashUtil.compare: Comparando...`);
    console.log(`   Texto: ${text.substring(0, 20)}...`);
    console.log(`   Hash: ${hash.substring(0, 30)}...`);
    const result = await bcrypt.compare(text, hash);
    console.log(`   Resultado: ${result ? '✅ MATCH' : '❌ SEM MATCH'}`);
    return result;
  }

  static generateKeyPreview(key: string): string {
    const start = key.substring(0, 8);
    const end = key.substring(key.length - 4);
    return `${start}...${end}`;
  }
}
