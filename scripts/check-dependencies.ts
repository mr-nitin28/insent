/**
 * Dependency & Architectural Integrity Checker.
 * Verifies:
 * 1. Zero circular dependencies across the entire src/ tree.
 * 2. Core domain isolation: src/core/ imports nothing from channels, destinations, modules, or app.
 * 3. File line limits: No source file exceeds 250 lines.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative, dirname, join } from "node:path";

const SRC_DIR = resolve(process.cwd(), "src");
const FILE_EXTS = [".ts", ".tsx"];

function getAllSourceFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllSourceFiles(fullPath));
    } else if (FILE_EXTS.some((ext) => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }

  return files;
}

function resolveImportPath(importerPath: string, importSpec: string): string | null {
  let targetPath = "";
  if (importSpec.startsWith("@/")) {
    targetPath = join(SRC_DIR, importSpec.slice(2));
  } else if (importSpec.startsWith(".")) {
    targetPath = resolve(dirname(importerPath), importSpec);
  } else {
    return null; // External package
  }

  for (const ext of FILE_EXTS) {
    const withExt = targetPath + ext;
    try {
      if (statSync(withExt).isFile()) return withExt;
    } catch {}
  }

  const indexWithExt = join(targetPath, "index.ts");
  try {
    if (statSync(indexWithExt).isFile()) return indexWithExt;
  } catch {}

  return null;
}

function buildDependencyGraph(files: string[]): Map<string, string[]> {
  const graph = new Map<string, string[]>();

  for (const file of files) {
    const content = readFileSync(file, "utf8");
    const imports: string[] = [];
    const importRegex = /(?:import|export)\s+(?:.*?from\s+)?['"](.*?)['"]/g;
    let match: RegExpExecArray | null;

    while ((match = importRegex.exec(content)) !== null) {
      const spec = match[1];
      if (spec) {
        const resolved = resolveImportPath(file, spec);
        if (resolved && !imports.includes(resolved)) {
          imports.push(resolved);
        }
      }
    }

    graph.set(file, imports);
  }

  return graph;
}

function findCycle(graph: Map<string, string[]>): string[] | null {
  const visited = new Set<string>();
  const recStack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): boolean {
    visited.add(node);
    recStack.add(node);
    path.push(node);

    const neighbors = graph.get(node) ?? [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recStack.has(neighbor)) {
        path.push(neighbor);
        return true;
      }
    }

    recStack.delete(node);
    path.pop();
    return false;
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      if (dfs(node)) {
        const cycleStart = path[path.length - 1];
        if (cycleStart) {
          const startIndex = path.indexOf(cycleStart);
          return path.slice(startIndex).map((p) => relative(process.cwd(), p).replace(/\\/g, "/"));
        }
      }
    }
  }

  return null;
}

function checkCoreIsolation(files: string[]): string[] {
  const violations: string[] = [];
  const coreFiles = files.filter((f) => f.includes(join("src", "core")));

  for (const file of coreFiles) {
    const content = readFileSync(file, "utf8");
    const importRegex = /(?:import|from)\s+['"](.*?)['"]/g;
    let match: RegExpExecArray | null;

    while ((match = importRegex.exec(content)) !== null) {
      const spec = match[1];
      if (
        spec &&
        (spec.includes("/channels") ||
          spec.includes("/destinations") ||
          spec.includes("/modules") ||
          spec.includes("/app"))
      ) {
        violations.push(
          `${relative(process.cwd(), file)} imports forbidden outer module '${spec}'`,
        );
      }
    }
  }

  return violations;
}

function checkLineLimits(files: string[]): string[] {
  const violations: string[] = [];
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    const lines = content.split("\n").length;
    if (lines > 250) {
      violations.push(`${relative(process.cwd(), file)} exceeds 250 lines (${lines} lines)`);
    }
  }
  return violations;
}

function main() {
  console.log("🔍 Checking project architecture and dependency boundaries...");
  const files = getAllSourceFiles(SRC_DIR);
  const graph = buildDependencyGraph(files);

  // 1. Check circular dependencies
  const cycle = findCycle(graph);
  if (cycle) {
    console.error("❌ Circular dependency detected:\n  " + cycle.join(" -> "));
    process.exit(1);
  }
  console.log(`✅ Zero circular dependencies found across ${files.length} source files.`);

  // 2. Check core isolation
  const coreViolations = checkCoreIsolation(files);
  if (coreViolations.length > 0) {
    console.error(
      "❌ Core domain purity violations:\n" + coreViolations.map((v) => `  - ${v}`).join("\n"),
    );
    process.exit(1);
  }
  console.log("✅ Core domain is 100% pure (0 forbidden outer imports).");

  // 3. Check line limits
  const lineViolations = checkLineLimits(files);
  if (lineViolations.length > 0) {
    console.error(
      "❌ File line limit violations:\n" + lineViolations.map((v) => `  - ${v}`).join("\n"),
    );
    process.exit(1);
  }
  console.log("✅ All source files are strictly under 250 lines.");
}

main();
