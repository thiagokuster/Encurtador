import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const src = fileURLToPath(new URL("../src/", import.meta.url));

function withTs(file) {
  if (existsSync(file) && statSync(file).isFile()) return file;
  if (existsSync(`${file}.ts`)) return `${file}.ts`;
  if (existsSync(`${file}.tsx`)) return `${file}.tsx`;
  return file;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    return nextResolve(pathToFileURL(withTs(path.join(src, specifier.slice(2)))).href, context);
  }
  const parent = context.parentURL || "";
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && parent.includes("/src/")) {
    const file = withTs(path.resolve(path.dirname(fileURLToPath(parent)), specifier));
    return nextResolve(pathToFileURL(file).href, context);
  }
  return nextResolve(specifier, context);
}
