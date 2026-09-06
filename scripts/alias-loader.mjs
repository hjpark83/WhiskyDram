/**
 * `@/…` 임포트를 src/ 로 이어주는 Node 로더.
 * 앱 코드를 Next 없이 그대로 불러와 검증할 때 써요 (scripts/ai-check.ts).
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SRC = path.join(process.cwd(), "src");
const EXTS = [".ts", ".tsx", ".mts", ".js", ".mjs"];

function resolveFile(base) {
  if (existsSync(base) && !existsSync(path.join(base, "package.json"))) {
    // 디렉터리면 index 로
    try {
      if (!path.extname(base)) {
        for (const ext of EXTS) {
          const idx = path.join(base, `index${ext}`);
          if (existsSync(idx)) return idx;
        }
      }
    } catch {
      /* 무시 */
    }
    if (path.extname(base)) return base;
  }
  for (const ext of EXTS) {
    const candidate = `${base}${ext}`;
    if (existsSync(candidate)) return candidate;
  }
  for (const ext of EXTS) {
    const idx = path.join(base, `index${ext}`);
    if (existsSync(idx)) return idx;
  }
  return null;
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const file = resolveFile(path.join(SRC, specifier.slice(2)));
    if (file) return next(pathToFileURL(file).href, context);
  }
  return next(specifier, context);
}
