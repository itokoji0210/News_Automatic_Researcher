import { pathToFileURL } from "node:url";
import {
  TRENDS_PATH,
  SOCIAL_SIGNALS_PATH,
  normalizeText,
  readJson,
  stableId,
  writeJson
} from "./trend-utils.js";

const DEFAULT_SOURCES = [
  {
    name: "Google News 写真向き時事",
    type: "news-search",
    url: "https://news.google.com/rss/search?q=%E6%B0%B4%E4%B8%8D%E8%B6%B3%20OR%20%E7%8C%9B%E6%9A%91%20OR%20%E3%82%AF%E3%83%9E%20OR%20%E7%81%BD%E5%AE%B3%20OR%20%E5%BE%A9%E6%97%A7%20OR%20%E5%86%8D%E9%96%8B%E7%99%BA&hl=ja&gl=JP&ceid=JP:ja"
  },
  {
    name: "Google News 花・季節",
    type: "news-search",
    url: "https://news.google.com/rss/search?q=%E8%A6%8B%E9%A0%83%20OR%20%E8%8A%B1%20OR%20%E7%94%B0%E6%A4%8D%E3%81%88%20OR%20%E5%88%9D%E7%89%A9%20OR%20%E5%87%BA%E8%8D%B7%20OR%20%E6%B0%B4%E6%8F%9A%E3%81%92&hl=ja&gl=JP&ceid=JP:ja"
  },
  {
    name: "Google News 観光・人出",
    type: "news-search",
    url: "https://news.google.com/rss/search?q=%E8%A6%B3%E5%85%89%20OR%20%E3%82%A4%E3%83%B3%E3%83%90%E3%82%A6%E3%83%B3%E3%83%89%20OR%20%E8%A1%8C%E5%88%97%20OR%20%E6%B7%B7%E9%9B%91%20OR%20%E8%A6%B3%E5%85%89%E5%85%AC%E5%AE%B3&hl=ja&gl=JP&ceid=JP:ja"
  },
  {
    name: "Google News 地方現場",
    type: "news-search",
    url: "https://news.google.com/rss/search?q=%E5%9C%B0%E6%96%B9%20OR%20%E8%87%AA%E6%B2%BB%E4%BD%93%20OR%20%E5%95%86%E5%BA%97%E8%A1%97%20OR%20%E9%A7%85%E5%89%8D%20OR%20%E6%B8%AF%20OR%20%E7%A9%BA%E3%81%8D%E5%AE%B6&hl=ja&gl=JP&ceid=JP:ja"
  },
  {
    name: "Google News PR TIMES 地域・観光",
    type: "pr-search",
    url: "https://news.google.com/rss/search?q=site%3Aprtimes.jp%20%28%E8%A6%B3%E5%85%89%20OR%20%E8%87%AA%E6%B2%BB%E4%BD%93%20OR%20%E8%8A%B1%20OR%20%E3%82%A4%E3%83%99%E3%83%B3%E3%83%88%29&hl=ja&gl=JP&ceid=JP:ja"
  },
  {
    name: "Google News @Press 地域",
    type: "pr-search",
    url: "https://news.google.com/rss/search?q=site%3Aatpress.ne.jp%20%28%E8%A6%B3%E5%85%89%20OR%20%E8%87%AA%E6%B2%BB%E4%BD%93%20OR%20%E8%8A%B1%20OR%20%E5%9C%B0%E5%9F%9F%29&hl=ja&gl=JP&ceid=JP:ja"
  },
  {
    name: "Google News みん経",
    type: "local-business",
    url: "https://news.google.com/rss/search?q=site%3Aminkei.net%20%28%E9%96%8B%E5%BA%97%20OR%20%E9%96%89%E5%BA%97%20OR%20%E8%A6%B3%E5%85%89%20OR%20%E8%8A%B1%20OR%20%E5%9C%B0%E5%9F%9F%29&hl=ja&gl=JP&ceid=JP:ja"
  },
  {
    name: "Google News 災害",
    type: "news-search",
    url: "https://news.google.com/rss/search?q=%E7%81%BD%E5%AE%B3%20OR%20%E5%BE%A9%E6%97%A7%20OR%20%E6%B0%B4%E4%B8%8D%E8%B6%B3&hl=ja&gl=JP&ceid=JP:ja"
  },
  {
    name: "Google News 観光・地域",
    type: "news-search",
    url: "https://news.google.com/rss/search?q=%E8%A6%B3%E5%85%89%20OR%20%E8%8A%B1%20OR%20%E5%86%8D%E9%96%8B%E7%99%BA%20OR%20%E9%96%89%E5%BA%97&hl=ja&gl=JP&ceid=JP:ja"
  }
];

const STOP_WORDS = new Set([
  "こと", "これ", "ため", "よう", "さん", "する", "した", "して", "から", "まで",
  "など", "より", "ニュース", "発表", "開催", "開始", "公開", "今回", "日本",
  "東京", "一覧", "写真", "動画", "href", "https", "http", "target", "blank", "nbsp",
  "font", "color", "google", "news", "rss", "articles", "article", "com", "www",
  "Yahoo", "NEWS"
]);

const ALLOWED_ASCII_WORDS = new Set(["AI", "DX", "SNS", "PR", "WBS", "GX"]);

const REGION_WORDS = [
  "北海道", "青森", "岩手", "宮城", "秋田", "山形", "福島", "茨城", "栃木", "群馬",
  "埼玉", "千葉", "東京", "神奈川", "新潟", "富山", "石川", "福井", "山梨", "長野",
  "岐阜", "静岡", "愛知", "三重", "滋賀", "京都", "大阪", "兵庫", "奈良", "和歌山",
  "鳥取", "島根", "岡山", "広島", "山口", "徳島", "香川", "愛媛", "高知", "福岡",
  "佐賀", "長崎", "熊本", "大分", "宮崎", "鹿児島", "沖縄"
];

const SEASON_WORDS = [
  "猛暑", "酷暑", "梅雨", "台風", "紅葉", "桜", "花見", "花の見頃", "田植え",
  "稲刈り", "雪", "初雪", "海開き", "祭り"
];

const DISASTER_WORDS = [
  "地震", "津波", "豪雨", "洪水", "浸水", "土砂災害", "山火事", "火災",
  "災害復旧", "復旧", "断水", "水不足", "渇水", "避難"
];

const SOCIAL_WORDS = [
  "物価高", "インバウンド", "観光公害", "閉店", "再開発", "空き家", "人手不足",
  "少子化", "高齢化", "文化財保存", "巨大行列", "クマ", "鳥獣被害"
];

const PHOTO_PRIORITY_WORDS = [
  ...SEASON_WORDS,
  ...DISASTER_WORDS,
  ...SOCIAL_WORDS,
  "ダム", "水田", "給水車", "商店街", "駅前", "観光地", "港", "河川",
  "棚田", "文化財", "行列", "跡地", "工事", "ドローン"
];

function getSources() {
  const configured = process.env.TREND_SOURCES_JSON;
  if (!configured) return DEFAULT_SOURCES;
  try {
    const parsed = JSON.parse(configured);
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_SOURCES;
  } catch {
    return DEFAULT_SOURCES;
  }
}

function decodeEntities(value = "") {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function absoluteUrl(url, baseUrl) {
  if (!url) return "";
  try {
    return new URL(decodeEntities(url), baseUrl).href;
  } catch {
    return "";
  }
}

function extractTagBlocks(xml, tag) {
  return [...xml.matchAll(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`, "gi"))].map(
    (match) => match[0]
  );
}

function tagValue(block, tag) {
  const match = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? normalizeText(match[1].replace(/<!\\[CDATA\\[|\\]\\]>/g, "")) : "";
}

function attrValue(block, tagPattern, attr) {
  const tag = block.match(new RegExp(`<${tagPattern}\\b[^>]*>`, "i"))?.[0] || "";
  return tag.match(new RegExp(`${attr}=["']([^"']+)["']`, "i"))?.[1] || "";
}

function extractFeedImage(block, baseUrl) {
  const candidates = [
    attrValue(block, "media:thumbnail", "url"),
    attrValue(block, "media:content", "url"),
    attrValue(block, "enclosure", "url"),
    tagValue(block, "image"),
    tagValue(block, "url"),
    block.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1]
  ];
  return candidates.map((url) => absoluteUrl(url, baseUrl)).find(Boolean) || "";
}

function safeIsoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function fetchOgImage(url) {
  if (!url || url.includes("news.google.com/")) return "";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "press-sns-trend-analyzer/1.0" }
    });
    if (!response.ok) return "";
    const html = await response.text();
    const og =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)?.[1];
    return absoluteUrl(og, url);
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

async function addMissingThumbnails(articles) {
  const targets = articles.filter((article) => !article.thumbnailUrl).slice(0, 80);
  await Promise.allSettled(
    targets.map(async (article) => {
      article.thumbnailUrl = await fetchOgImage(article.url);
    })
  );
  return articles;
}

function parseFeed(xml, source) {
  const itemBlocks = extractTagBlocks(xml, "item");
  const entryBlocks = extractTagBlocks(xml, "entry");
  const blocks = itemBlocks.length ? itemBlocks : entryBlocks;

  return blocks
    .map((block) => {
      const rawLink = tagValue(block, "link");
      const href = attrValue(block, "link", "href");
      const url = href || rawLink;
      const title = tagValue(block, "title");
      const summary =
        tagValue(block, "description") || tagValue(block, "summary") || tagValue(block, "content");
      const publishedAt = tagValue(block, "pubDate") || tagValue(block, "updated");
      return {
        source: source.name,
        sourceType: source.type,
        title,
        summary,
        url,
        thumbnailUrl: extractFeedImage(block, source.url),
        publishedAt: safeIsoDate(publishedAt)
      };
    })
    .filter((item) => item.title && item.url);
}

async function fetchSource(source) {
  try {
    const response = await fetch(source.url, {
      headers: { "user-agent": "press-sns-trend-analyzer/1.0" }
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const xml = await response.text();
    return { source, items: parseFeed(xml, source), error: null };
  } catch (error) {
    return { source, items: [], error: error.cause?.code || error.message };
  }
}

async function readSocialSignals() {
  const data = await readJson(SOCIAL_SIGNALS_PATH, { items: [] });
  return (data.items || [])
    .map((item) => ({
      source: item.source || "SNS",
      sourceType: "social",
      title: normalizeText(item.title || item.text || ""),
      summary: normalizeText(item.summary || ""),
      url: item.url,
      thumbnailUrl: item.thumbnailUrl || item.imageUrl || "",
      publishedAt: safeIsoDate(item.publishedAt)
    }))
    .filter((item) => item.title && item.url);
}

function tokenize(text) {
  const normalized = normalizeText(text);
  const explicit = [
    ...REGION_WORDS,
    ...SEASON_WORDS,
    ...DISASTER_WORDS,
    ...SOCIAL_WORDS,
    ...PHOTO_PRIORITY_WORDS
  ].filter((word) => normalized.includes(word));

  const chunks =
    normalized.match(/[一-龠ぁ-んァ-ヶー]{2,12}|[A-Za-z][A-Za-z0-9-]{2,}/g) || [];
  const tokens = chunks
    .map((word) => word.trim())
    .filter((word) => {
      if (word.length < 2 || STOP_WORDS.has(word) || /^[0-9]+$/.test(word)) return false;
      if (/^[A-Za-z0-9-]+$/.test(word) && !ALLOWED_ASCII_WORDS.has(word.toUpperCase())) {
        return false;
      }
      return true;
    });
  return [...new Set([...explicit, ...tokens])];
}

function classifyWord(word) {
  const categories = [];
  if (REGION_WORDS.includes(word)) categories.push("地域名");
  if (SEASON_WORDS.includes(word)) categories.push("季節語");
  if (DISASTER_WORDS.includes(word)) categories.push("災害語");
  if (SOCIAL_WORDS.includes(word)) categories.push("社会問題語");
  if (PHOTO_PRIORITY_WORDS.some((keyword) => word.includes(keyword) || keyword.includes(word))) {
    categories.push("写真ネタ化");
  }
  return categories.length ? categories : ["一般"];
}

function photoScore(word, count, articles) {
  const categoryBoost = classifyWord(word).includes("写真ネタ化") ? 12 : 0;
  const sourceDiversity = new Set(articles.map((item) => item.source)).size;
  const hasLocal = articles.some((item) =>
    ["local", "local-business", "government"].includes(item.sourceType)
  );
  const imageBoost = articles.some((item) => item.thumbnailUrl) ? 5 : 0;
  return count * 4 + sourceDiversity * 3 + categoryBoost + imageBoost + (hasLocal ? 4 : 0);
}

function buildPhotoAngles(word, article) {
  const text = `${article.title} ${article.summary}`;
  const angles = [];

  if (/水不足|渇水|断水|ダム|水田/.test(text)) angles.push("水位・農地・給水対応など、影響が見える現場");
  if (/クマ|鳥獣被害/.test(text)) angles.push("注意喚起の掲示、出没地点周辺、住民生活への影響");
  if (/猛暑|酷暑|熱中症/.test(text)) angles.push("暑さ対策、屋外作業、街なかの温度表示や避暑行動");
  if (/田植え|稲|農/.test(text)) angles.push("田植え、用水、農作業、天候影響が分かる風景");
  if (/インバウンド|観光|行列|観光公害/.test(text)) angles.push("観光地の混雑、行列、案内表示、地域側の対応");
  if (/物価高|値上げ|価格/.test(text)) angles.push("価格表示、商店街、生活者や事業者への影響");
  if (/花|見頃|桜|紅葉/.test(text)) angles.push("見頃の花、来訪者、管理する人、周辺交通や混雑");
  if (/山火事|火災|災害|復旧|避難|土砂|洪水|浸水/.test(text)) angles.push("被害箇所、復旧作業、避難情報、支援や交通影響");
  if (/閉店|再開発|跡地|工事/.test(text)) angles.push("店舗外観、駅前や商店街の変化、工事・解体・告知掲示");
  if (/文化財|保存/.test(text)) angles.push("文化財の外観、保存作業、地域の利用風景");

  if (!angles.length) angles.push(`「${word}」が記事中で示す現場、告知、関係者の動き`);
  return [...new Set(angles)].slice(0, 3);
}

function makeTopics(words, articleMatches) {
  const topics = [];
  for (const word of words) {
    const articles = articleMatches.get(word.word) || [];
    for (const article of articles.slice(0, 4)) {
      topics.push({
        id: stableId(`${word.word}|${article.url}`),
        trendWord: word.word,
        title: `「${word.word}」を写真で追う: ${article.title}`,
        photoCandidates: buildPhotoAngles(word.word, article),
        evidenceUrl: article.url,
        evidenceTitle: article.title,
        thumbnailUrl: article.thumbnailUrl || "",
        imageUrl: article.thumbnailUrl || "",
        source: article.source,
        sourceType: article.sourceType,
        publishedAt: article.publishedAt,
        categories: word.categories,
        regions: REGION_WORDS.filter((region) =>
          `${article.title} ${article.summary}`.includes(region)
        ),
        keywords: [word.word],
        trust: article.sourceType === "news-search" ? 0.72 : 0.86,
        droneSuitable: /ドローン|山火事|災害|復旧|再開発|ダム|田植え|水田|観光地/.test(
          `${word.word} ${article.title} ${article.summary}`
        ),
        flowerTopic: /花|見頃|桜|紅葉/.test(`${word.word} ${article.title} ${article.summary}`),
        createdAt: new Date().toISOString()
      });
    }
  }
  return topics;
}

async function readPreviousWords() {
  const previous = await readJson(TRENDS_PATH, { words: [] });
  return new Map((previous.words || []).map((item) => [item.word, item.count || 0]));
}

export async function analyzeTrends() {
  const sources = getSources();
  const results = await Promise.all(sources.map(fetchSource));
  const socialSignals = await readSocialSignals();
  for (const result of results) {
    const status = result.error ? `ERROR ${result.error}` : `${result.items.length} items`;
    console.log(`[source] ${result.source.name}: ${status}`);
  }
  const articles = await addMissingThumbnails(
    [...results.flatMap((result) => result.items), ...socialSignals].slice(0, 600)
  );
  const previousCounts = await readPreviousWords();
  const counts = new Map();
  const articleMatches = new Map();

  for (const article of articles) {
    const text = `${article.title} ${article.summary}`;
    for (const token of tokenize(text)) {
      counts.set(token, (counts.get(token) || 0) + 1);
      if (!articleMatches.has(token)) articleMatches.set(token, []);
      articleMatches.get(token).push(article);
    }
  }

  const words = [...counts.entries()]
    .map(([word, count]) => {
      const articlesForWord = articleMatches.get(word) || [];
      const previous = previousCounts.get(word) || 0;
      return {
        word,
        count,
        previousCount: previous,
        rise: previous ? (count - previous) / previous : count,
        categories: classifyWord(word),
        score: photoScore(word, count, articlesForWord),
        evidenceUrls: articlesForWord.slice(0, 5).map((item) => item.url)
      };
    })
    .filter((item) => item.count >= 1 && item.evidenceUrls.length)
    .sort((a, b) => b.score - a.score)
    .slice(0, 80);

  const risingWords = [...words]
    .filter((item) => item.rise > 0)
    .sort((a, b) => b.rise - a.rise || b.score - a.score)
    .slice(0, 20);

  const priorityWords = words
    .filter((item) => item.categories.includes("写真ネタ化"))
    .slice(0, 30);

  const output = {
    generatedAt: new Date().toISOString(),
    sources: results.map((result) => ({
      name: result.source.name,
      type: result.source.type,
      url: result.source.url,
      itemCount: result.items.length,
      error: result.error
    })).concat({
      name: "SNS signals",
      type: "social",
      url: SOCIAL_SIGNALS_PATH,
      itemCount: socialSignals.length,
      error: null
    }),
    newsTrends: articles.slice(0, 40),
    words,
    risingWords,
    topics: makeTopics(priorityWords, articleMatches)
  };

  await writeJson(TRENDS_PATH, output);
  return output;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  analyzeTrends()
    .then((result) => {
      console.log(
        `Saved ${result.words.length} trend words and ${result.topics.length} grounded topics to ${TRENDS_PATH}`
      );
      if (!result.words.length) {
        console.log("No trend words were extracted. Check [source] lines above for RSS fetch or parse failures.");
      }
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
