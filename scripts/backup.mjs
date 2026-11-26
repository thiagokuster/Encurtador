import { createBackup } from "../src/server/backup.ts";

const file = await createBackup();
console.log(`Backup salvo em ${file}`);
