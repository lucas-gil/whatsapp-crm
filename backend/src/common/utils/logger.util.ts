export class Logger {
  constructor(private context: string) {}

  info(message: string, data?: any) {
    console.log(`[${this.context}] ℹ️  ${message}`, data || '');
  }

  error(message: string, error?: any) {
    console.error(`[${this.context}] ❌ ${message}`, error || '');
  }

  warn(message: string, data?: any) {
    console.warn(`[${this.context}] ⚠️  ${message}`, data || '');
  }

  debug(message: string, data?: any) {
    if (process.env.DEBUG === 'true') {
      console.debug(`[${this.context}] 🐛 ${message}`, data || '');
    }
  }
}
