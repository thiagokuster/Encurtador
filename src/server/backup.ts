import fs from "fs";
import path from "path";
import { backup, DatabaseSync } from "node:sqlite";
import { readLockPid } from "@/server/instance-lock";
import { dataDirectory } from "@/server/paths";

export function databaseFile() {
  return path.join(dataDirectory(), "encurtador.sqlite");
}

export function backupDirectory() {
  return path.join(dataDirectory(), "backups");
}

function alive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

export function otherRunningInstance(directory = dataDirectory()) {
  const pid = readLockPid(path.join(directory, "encurtador.lock"));
  if (!pid || pid === process.pid || !alive(pid)) return null;
  return pid;
}

export async function createBackup(directory = backupDirectory()) {
  const sourcePath = databaseFile();
  if (!fs.existsSync(sourcePath)) throw new Error("Não há banco para copiar.");
  fs.mkdirSync(directory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const destination = path.join(directory, `encurtador-${stamp}.sqlite`);
  const source = new DatabaseSync(sourcePath);
  try {
    await backup(source, destination);
  } finally {
    source.close();
  }
  return destination;
}

export async function restoreBackup(sourcePath: string, destination = databaseFile()) {
  const holder = otherRunningInstance(path.dirname(destination));
  if (holder) {
    throw new Error(`Pare a instância ${holder} antes de restaurar o banco.`);
  }
  if (!fs.existsSync(sourcePath)) throw new Error("Backup não encontrado.");
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.rmSync(`${destination}-wal`, { force: true });
  fs.rmSync(`${destination}-shm`, { force: true });
  const source = new DatabaseSync(sourcePath, { readOnly: true });
  try {
    await backup(source, destination);
  } finally {
    source.close();
  }
}
