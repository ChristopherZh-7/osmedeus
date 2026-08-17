import { readFile, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";

import { parse as parseYAML } from "yaml";

export const CYBERSTRIKE_SKILL_PROVIDER = "cyberstrike-index";
export const CYBERSTRIKE_SKILL_NOTICE = "> **Osmedeus DSH adaptation:** Load `osmedeus-pentest` first and keep every action inside its authorized asset allowlist. Treat CyberStrike-specific tool names as methodology references unless the tool is actually available. Obtain explicit operator approval before destructive, persistence, denial-of-service, credential-spraying, or data-exfiltration actions.";

const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 50;
const MAX_SKILL_BYTES = 1024 * 1024;
const FRONTMATTER = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

function abortIfRequested(signal) {
  if (typeof signal?.throwIfAborted === "function") signal.throwIfAborted();
  if (signal?.aborted) throw signal.reason ?? new Error("CyberStrike Skill indexing was aborted");
}

function stringList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function stringRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [String(key), String(item)]),
  );
}

function normalizedOptional(value) {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text || undefined;
}

export function isCyberStrikeSkillName(value) {
  const name = String(value || "").trim();
  return name.length > 0 && name.length <= 512 && !/[\u0000-\u001F\u007F]/.test(name);
}

export function parseCyberStrikeSkill(text, location = "SKILL.md") {
  const normalized = String(text).replace(/^\uFEFF/, "");
  const match = normalized.match(FRONTMATTER);
  if (!match) throw new Error(`${location} has no valid YAML frontmatter`);
  const metadata = parseYAML(match[1]);
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error(`${location} has invalid YAML frontmatter`);
  }
  const name = normalizedOptional(metadata.name);
  const description = normalizedOptional(metadata.description);
  if (!name || !isCyberStrikeSkillName(name)) throw new Error(`${location} has an invalid Skill name`);
  if (!description) throw new Error(`${location} has no Skill description`);
  return {
    name,
    description,
    category: normalizedOptional(metadata.category),
    owasp_id: normalizedOptional(metadata.owasp_id),
    cis_id: normalizedOptional(metadata.cis_id),
    version: normalizedOptional(metadata.version),
    author: normalizedOptional(metadata.author),
    verified: normalizedOptional(metadata.verified),
    tags: stringList(metadata.tags),
    tech_stack: stringList(metadata.tech_stack),
    cwe_ids: stringList(metadata.cwe_ids),
    chains_with: stringList(metadata.chains_with),
    prerequisites: stringList(metadata.prerequisites),
    severity_boost: stringRecord(metadata.severity_boost),
    content: normalized.slice(match[0].length).trim(),
  };
}

export function defaultCyberStrikeSkillRoot(env = process.env) {
  if (String(env.OSM_CYBERSTRIKE_SKILLS_DIR || "").trim()) {
    return resolve(String(env.OSM_CYBERSTRIKE_SKILLS_DIR).trim());
  }
  const dshHome = resolve(String(
    env.DSH_HOME || join(homedir(), "osmedeus-base", "agent-harness", "dsh-home"),
  ));
  return join(dshHome, "osmedeus", "cyberstrike-skills");
}

async function directoryExists(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function collectSkillFiles(root, signal) {
  const files = [];
  const visit = async (directory) => {
    abortIfRequested(signal);
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      abortIfRequested(signal);
      if (entry.isSymbolicLink()) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && entry.name === "SKILL.md") files.push(path);
    }
  };
  await visit(root);
  return files;
}

async function parseIndexedFile(root, path, signal) {
  const info = await stat(path);
  if (info.size > MAX_SKILL_BYTES) {
    throw new Error(`${path} exceeds the ${MAX_SKILL_BYTES}-byte Skill limit`);
  }
  const parsed = parseCyberStrikeSkill(
    await readFile(path, { encoding: "utf8", signal }),
    path,
  );
  return {
    name: parsed.name,
    description: parsed.description,
    category: parsed.category,
    owasp_id: parsed.owasp_id,
    cis_id: parsed.cis_id,
    version: parsed.version,
    author: parsed.author,
    verified: parsed.verified,
    tags: parsed.tags,
    tech_stack: parsed.tech_stack,
    cwe_ids: parsed.cwe_ids,
    chains_with: parsed.chains_with,
    prerequisites: parsed.prerequisites,
    severity_boost: parsed.severity_boost,
    relativePath: relative(root, path).split(sep).join("/"),
  };
}

export async function buildCyberStrikeSkillIndex(rootInput, { signal, concurrency = 32 } = {}) {
  const root = resolve(rootInput);
  if (!(await directoryExists(root))) {
    return {
      available: false,
      root,
      entries: [],
      byName: new Map(),
      duplicateNames: [],
      skipped: 0,
    };
  }

  const files = await collectSkillFiles(root, signal);
  const parsed = new Array(files.length);
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(Number(concurrency) || 1, files.length || 1));
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (cursor < files.length) {
      const index = cursor;
      cursor += 1;
      abortIfRequested(signal);
      try {
        parsed[index] = await parseIndexedFile(root, files[index], signal);
      } catch (error) {
        if (signal?.aborted) throw error;
        parsed[index] = undefined;
      }
    }
  }));

  const entries = [];
  const byName = new Map();
  const duplicateNames = new Set();
  for (const entry of parsed.filter(Boolean)) {
    if (byName.has(entry.name)) {
      duplicateNames.add(entry.name);
      continue;
    }
    byName.set(entry.name, entry);
    entries.push(entry);
  }
  entries.sort((left, right) => left.name.localeCompare(right.name));
  return {
    available: true,
    root,
    entries,
    byName,
    duplicateNames: [...duplicateNames].sort(),
    skipped: files.length - parsed.filter(Boolean).length,
  };
}

function normalizedSet(values) {
  return new Set(stringList(values).map((value) => value.toLowerCase()));
}

function containsAny(values, required) {
  if (!required.size) return true;
  const available = normalizedSet(values);
  return [...required].some((value) => available.has(value));
}

function queryScore(entry, query) {
  if (!query) return 1;
  const q = query.toLowerCase();
  const name = entry.name.toLowerCase();
  const tags = entry.tags.map((tag) => tag.toLowerCase());
  let score = 0;
  if (name === q) score += 100;
  else if (name.startsWith(q)) score += 50;
  else if (name.includes(q)) score += 20;
  if (tags.some((tag) => tag === q)) score += 40;
  else if (tags.some((tag) => tag.includes(q))) score += 15;
  if (entry.owasp_id?.toLowerCase().includes(q)) score += 30;
  if (entry.cis_id?.toLowerCase().includes(q)) score += 30;
  if (entry.category?.toLowerCase().includes(q)) score += 10;
  if (entry.description.toLowerCase().includes(q)) score += 5;
  if (entry.cwe_ids.some((cwe) => cwe.toLowerCase().includes(q))) score += 20;
  if (entry.tech_stack.some((tech) => tech.toLowerCase().includes(q))) score += 15;
  return score;
}

function skillSummary(entry) {
  return {
    name: entry.name,
    description: entry.description,
    category: entry.category ?? "",
    owasp_id: entry.owasp_id ?? "",
    cis_id: entry.cis_id ?? "",
    tags: entry.tags,
    tech_stack: entry.tech_stack,
    cwe_ids: entry.cwe_ids,
    prerequisites: entry.prerequisites,
    chains_with: entry.chains_with,
  };
}

export function searchCyberStrikeSkillIndex(index, options = {}) {
  const query = String(options.query || "").trim().toLowerCase();
  const category = String(options.category || "").trim().toLowerCase();
  const cwe = String(options.cwe || "").trim().toLowerCase();
  const tag = String(options.tag || "").trim().toLowerCase();
  const technologies = normalizedSet(options.tech);
  const limit = Math.max(1, Math.min(MAX_SEARCH_LIMIT, Number(options.limit) || DEFAULT_SEARCH_LIMIT));
  const scored = [];
  for (const entry of index.entries) {
    if (category && entry.category?.toLowerCase() !== category) continue;
    if (cwe && !entry.cwe_ids.some((value) => value.toLowerCase() === cwe)) continue;
    if (tag && !entry.tags.some((value) => value.toLowerCase() === tag)) continue;
    if (!containsAny(entry.tech_stack, technologies)) continue;
    const score = queryScore(entry, query);
    if (score > 0) scored.push({ entry, score });
  }
  scored.sort((left, right) => right.score - left.score || left.entry.name.localeCompare(right.entry.name));
  return {
    total: scored.length,
    items: scored.slice(0, limit).map(({ entry }) => skillSummary(entry)),
  };
}

export class CyberStrikeSkillLibrary {
  constructor({ root, env = process.env } = {}) {
    this.configuredRoot = root;
    this.env = env;
    this.index = undefined;
    this.indexPromise = undefined;
  }

  root() {
    return this.configuredRoot ? resolve(this.configuredRoot) : defaultCyberStrikeSkillRoot(this.env);
  }

  async ensureIndex(signal) {
    const root = this.root();
    if (this.index?.root === root) return this.index;
    if (!this.indexPromise) {
      this.indexPromise = buildCyberStrikeSkillIndex(root, { signal })
        .then((index) => {
          this.index = index;
          return index;
        })
        .finally(() => {
          this.indexPromise = undefined;
        });
    }
    return this.indexPromise;
  }

  async refresh(signal) {
    this.index = undefined;
    this.indexPromise = undefined;
    return this.ensureIndex(signal);
  }

  async status(signal) {
    const index = await this.ensureIndex(signal);
    return {
      action: "status",
      provider: CYBERSTRIKE_SKILL_PROVIDER,
      available: index.available,
      indexed: index.entries.length,
      skipped: index.skipped,
      duplicate_names: index.duplicateNames,
    };
  }

  async search(options = {}, signal) {
    const index = await this.ensureIndex(signal);
    const result = searchCyberStrikeSkillIndex(index, options);
    return {
      action: "search",
      provider: CYBERSTRIKE_SKILL_PROVIDER,
      available: index.available,
      total: result.total,
      returned: result.items.length,
      items: result.items,
    };
  }

  async chains(name, signal) {
    const index = await this.ensureIndex(signal);
    const entry = index.byName.get(name);
    if (!entry) return undefined;
    return {
      action: "chain",
      provider: CYBERSTRIKE_SKILL_PROVIDER,
      name: entry.name,
      prerequisites: entry.prerequisites,
      chains_with: entry.chains_with.map((target) => ({
        target,
        severity_boost: entry.severity_boost[target] ?? "",
      })),
    };
  }

  async load(name, signal) {
    const index = await this.ensureIndex(signal);
    const entry = index.byName.get(name);
    if (!entry) return undefined;
    const path = resolve(index.root, entry.relativePath);
    const relativeToRoot = relative(index.root, path);
    if (!relativeToRoot || relativeToRoot.startsWith(`..${sep}`) || relativeToRoot === "..") {
      throw new Error("CyberStrike Skill path escaped the configured library root");
    }
    const info = await stat(path);
    if (!info.isFile() || info.size > MAX_SKILL_BYTES) {
      throw new Error(`CyberStrike Skill ${name} is not a loadable file`);
    }
    const parsed = parseCyberStrikeSkill(
      await readFile(path, { encoding: "utf8", signal }),
      path,
    );
    if (parsed.name !== name) {
      this.index = undefined;
      throw new Error(`CyberStrike Skill ${name} changed after indexing; refresh and retry`);
    }
    return {
      action: "load",
      provider: CYBERSTRIKE_SKILL_PROVIDER,
      name: parsed.name,
      description: parsed.description,
      resource_base: dirname(path),
      content: `${CYBERSTRIKE_SKILL_NOTICE}\n\n${parsed.content}`,
      prerequisites: parsed.prerequisites,
      chains_with: parsed.chains_with,
    };
  }
}
