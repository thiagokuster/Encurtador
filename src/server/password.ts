import bcrypt from "bcryptjs";

function passwordCost() {
  if (process.env.NODE_ENV === "production") return 12;
  const raw = Number(process.env.BCRYPT_COST);
  if (Number.isInteger(raw) && raw >= 4 && raw <= 12) return raw;
  return 12;
}

const COST = passwordCost();
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
