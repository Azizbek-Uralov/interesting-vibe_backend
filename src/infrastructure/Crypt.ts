import { hash, compare } from 'bcrypt';
import { createHash } from 'crypto';

export class Crypt {
  static async hash(data: string) {
    return hash(data, 12);
  }

  static async compare(data: string, hashedData: string) {
    return compare(data, hashedData);
  }

  static hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
