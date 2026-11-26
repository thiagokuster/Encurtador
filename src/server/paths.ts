import path from "path";

export function dataDirectory() {
  const override = process.env.ENCURTADOR_DATA?.trim();
  if (override) return path.resolve(override);
  return path.join(process.cwd(), "data");
}
