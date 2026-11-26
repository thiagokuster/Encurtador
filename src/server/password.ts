import bcrypt from "bcryptjs";

const COST = 12;
let dummyHash: Promise<string> | null = null;

export function hashPassword(password: string) {
  return bcrypt.hash(password, COST);
}

export function placeholderPasswordHash() {
  if (!dummyHash) {
    dummyHash = bcrypt.hash("encurtador-placeholder-password", COST).catch((error: unknown) => {
      dummyHash = null;
      throw error;
    });
  }
  return dummyHash;
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
