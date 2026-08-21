// Löst erweiterungslose relative Importe auf .ts auf — das tun sonst nur
// Bundler (Next/Metro). Nur für den lokalen e2e-Lauf.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as pres } from "node:path";

export async function resolve(specifier, context, next) {
  if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    const base = dirname(fileURLToPath(context.parentURL));
    for (const cand of [specifier + ".ts", specifier + "/index.ts", specifier + ".tsx"]) {
      const p = pres(base, cand);
      if (existsSync(p)) return next(pathToFileURL(p).href, context);
    }
  }
  return next(specifier, context);
}
