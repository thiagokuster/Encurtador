import { restoreBackup } from "../src/server/backup.ts";

const source = process.argv[2];
if (!source) {
  console.error("Informe o arquivo de backup. Exemplo: npm run restore -- data/backups/encurtador-....sqlite");
  process.exit(1);
}

await restoreBackup(source);
console.log("Banco restaurado. A aplicação precisa estar parada durante a restauração.");
