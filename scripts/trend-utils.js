import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DATA_DIR = path.resolve("data");
export const TRENDS_PATH = path.join(DATA_DIR, "trends.json");
export const FEEDBACK_PATH = path.join(DATA_DIR, "feedback.json");
export const SCORED_TOPICS_PATH = path.join(DATA_DIR, "scored-topics.json");
export const SOCIAL_SIGNALS_PATH = path.join(DATA_DIR, "social-signals.json");

export async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

export async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

export async function writeJson(filePath, value) {
  await ensureDataDir();
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function decodeHtmlEntities(text = "") {
  return text
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, num) => String.fromCodePoint(parseInt(num, 10)));
}

export function normalizeText(text = "") {
  const decoded = decodeHtmlEntities(String(text));
  return decoded
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\b(?:href|https|http|target|blank|nbsp|font|color|style|class|rel|src|alt)\b/gi, " ")
    .replace(/\b(?:google|news|rss|articles|article|com|www|html|xml|f6f6f6)\b/gi, " ")
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0xfee0)
    )
    .replace(/[!"#$%&'()*+,./:;<=>?@[\\\]^_`{|}~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stableId(input) {
  let hash = 2166136261;
  for (const char of input) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `topic-${(hash >>> 0).toString(36)}`;
}

export function daysBetween(a, b = new Date()) {
  return Math.floor((b.getTime() - new Date(a).getTime()) / 86400000);
}
