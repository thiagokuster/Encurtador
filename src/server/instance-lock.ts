import fs from "fs";
import path from "path";

function sleepSync(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function isAlive(pid: number) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

export function readLockPid(file: string) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as { pid?: unknown };
    const pid = Number(parsed.pid);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

export function acquireInstanceLock(file: string, pid = process.pid) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const payload = JSON.stringify({ pid });
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const fd = fs.openSync(file, "wx");
      fs.writeFileSync(fd, payload);
      fs.closeSync(fd);
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    const current = readLockPid(file);
    if (current === pid) {
      fs.writeFileSync(file, payload);
      return;
    }
    if (!current || !isAlive(current)) {
      fs.writeFileSync(file, payload);
      return;
    }
    sleepSync(100);
  }
  const holder = readLockPid(file);
  throw new Error(
    `O banco já está aberto pelo processo ${holder ?? "desconhecido"}. Rode apenas uma instância do Encurtador.`,
  );
}

export function releaseInstanceLock(file: string, pid = process.pid) {
  if (readLockPid(file) !== pid) return;
  fs.rmSync(file, { force: true });
}
