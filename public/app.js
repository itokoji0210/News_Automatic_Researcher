const els = {
  generatedAt: document.querySelector("#generatedAt"),
  sourceStatus: document.querySelector("#sourceStatus"),
  newsTrends: document.querySelector("#newsTrends"),
  risingWords: document.querySelector("#risingWords"),
  topics: document.querySelector("#topics"),
  learnedTopics: document.querySelector("#learnedTopics"),
  watchLater: document.querySelector("#watchLater"),
  hiddenOrCovered: document.querySelector("#hiddenOrCovered"),
  analyzeButton: document.querySelector("#analyzeButton"),
  template: document.querySelector("#topicTemplate")
};

const FEEDBACK_KEY = "press-news-research-feedback";
let staticMode = false;
let latestData = { trends: {}, scored: {} };

function formatDate(value) {
  if (!value) return "未更新";
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function empty(target, message) {
  target.innerHTML = `<p class="empty">${message}</p>`;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function fetchJson(url, fallback = {}) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return fallback;
    return await response.json();
  } catch {
    return fallback;
  }
}

function readLocalFeedback() {
  try {
    return JSON.parse(localStorage.getItem(FEEDBACK_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeLocalFeedback(items) {
  localStorage.setItem(FEEDBACK_KEY, JSON.stringify(items));
}

function latestFeedbackMap(items) {
  const map = new Map();
  for (const item of items) {
    const previous = map.get(item.topicId);
    if (!previous || new Date(item.createdAt) > new Date(previous.createdAt)) {
      map.set(item.topicId, item);
    }
  }
  return map;
}

function applyLocalFeedback(scored) {
  const feedback = readLocalFeedback();
  const latest = latestFeedbackMap(feedback);
  const visible = [];
  const watchLater = [...(scored.watchLater || [])];
  const hiddenOrCovered = [...(scored.hiddenOrCovered || [])];

  for (const topic of scored.topics || []) {
    const action = latest.get(topic.id)?.action;
    const enriched = {
      ...topic,
      userStatus: action || topic.userStatus,
      requiresVerification: action === "verify" || topic.requiresVerification
    };

    if (action === "hidden" || action === "covered") {
      hiddenOrCovered.push(enriched);
    } else if (action === "later") {
      watchLater.push(enriched);
      visible.push(enriched);
    } else if (action === "weak") {
      visible.push({ ...enriched, score: (enriched.score || 0) - 20 });
    } else if (action === "usable") {
      visible.unshift({ ...enriched, score: (enriched.score || 0) + 20 });
    } else {
      visible.push(enriched);
    }
  }

  return {
    ...scored,
    topics: visible.sort((a, b) => (b.score || 0) - (a.score || 0)),
    watchLater,
    hiddenOrCovered
  };
}

function renderNews(items = []) {
  els.newsTrends.innerHTML = "";
  const grounded = items.filter((item) => item.url).slice(0, 12);
  if (!grounded.length) {
    empty(els.newsTrends, "まだニュースがありません。GitHub Actionsの更新後に表示されます。");
    return;
  }

  for (const item of grounded) {
    const article = document.createElement("article");
    article.className = "newsItem";
    article.innerHTML = `
      <h3>${escapeHtml(item.title)}</h3>
      <p class="muted">${escapeHtml(item.source || "")}</p>
      <a class="evidence" href="${item.url}" target="_blank" rel="noreferrer">根拠URL</a>
    `;
    els.newsTrends.append(article);
  }
}

function renderRising(words = []) {
  els.risingWords.innerHTML = "";
  const grounded = words.filter((word) => word.evidenceUrls?.length).slice(0, 24);
  if (!grounded.length) {
    empty(els.risingWords, "急上昇ワードはまだありません。");
    return;
  }
  for (const word of grounded) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = `${word.word} ${word.count}`;
    els.risingWords.append(chip);
  }
}

function renderTopicList(target, topics = [], compact = false) {
  target.innerHTML = "";
  const grounded = topics.filter((topic) => topic.evidenceUrl);
  if (!grounded.length) {
    empty(target, "表示できる根拠URL付き候補はありません。");
    return;
  }

  for (const topic of grounded) {
    target.append(compact ? renderMiniTopic(topic) : renderTopic(topic));
  }
}

function renderMiniTopic(topic) {
  const article = document.createElement("article");
  article.className = "miniItem";
  article.innerHTML = `
    <h3>${escapeHtml(topic.title)}</h3>
    <p class="muted">${escapeHtml(topic.trendWord)} / ${escapeHtml(topic.source || "")}</p>
    <a class="evidence" href="${topic.evidenceUrl}" target="_blank" rel="noreferrer">根拠URL</a>
  `;
  return article;
}

function renderTopic(topic) {
  const node = els.template.content.firstElementChild.cloneNode(true);
  node.dataset.topicId = topic.id;
  node.querySelector(".word").textContent = topic.trendWord;
  node.querySelector(".source").textContent = topic.source || "source";
  node.querySelector("h3").textContent = topic.title;

  const list = node.querySelector(".candidateList");
  list.innerHTML = "";
  for (const candidate of topic.photoCandidates || []) {
    const li = document.createElement("li");
    li.textContent = candidate;
    list.append(li);
  }

  const evidence = node.querySelector(".evidence");
  evidence.href = topic.evidenceUrl;
  evidence.textContent = topic.evidenceTitle || topic.evidenceUrl;

  const badges = node.querySelector(".badges");
  badges.innerHTML = "";
  for (const label of [
    ...(topic.categories || []),
    ...(topic.regions || []),
    topic.droneSuitable ? "ドローン向き" : "",
    topic.flowerTopic ? "花ネタ" : "",
    topic.requiresVerification ? "確認待ち" : ""
  ].filter(Boolean)) {
    const badge = document.createElement("span");
    badge.className = `badge${label === "確認待ち" ? " verify" : ""}`;
    badge.textContent = label;
    badges.append(badge);
  }

  node.querySelectorAll("button[data-action]").forEach((button) => {
    button.addEventListener("click", () => submitFeedback(topic.id, button.dataset.action));
  });

  return node;
}

function renderLearned(scored) {
  const learned = (scored.topics || [])
    .filter((topic) => topic.userStatus === "usable")
    .slice(0, 8);
  renderTopicList(els.learnedTopics, learned, true);
}

async function submitFeedback(topicId, action) {
  if (staticMode) {
    const items = readLocalFeedback();
    items.push({ topicId, action, createdAt: new Date().toISOString() });
    writeLocalFeedback(items);
    await load();
    return;
  }

  const response = await fetch("api/feedback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ topicId, action })
  });
  if (!response.ok) {
    alert("評価を保存できませんでした。");
    return;
  }
  await load();
}

async function runAnalyze() {
  if (staticMode) {
    alert("GitHub Pages版では自動更新はGitHub Actionsが行います。Actionsの手動実行か、次回の定期更新を待ってください。");
    return;
  }

  els.analyzeButton.disabled = true;
  els.analyzeButton.textContent = "更新中";
  try {
    const response = await fetch("api/analyze", { method: "POST" });
    if (!response.ok) throw new Error("analyze failed");
    await load();
  } catch {
    alert("トレンド更新に失敗しました。通信設定やRSSの状態を確認してください。");
  } finally {
    els.analyzeButton.disabled = false;
    els.analyzeButton.textContent = "今日のトレンドを更新";
  }
}

async function loadFromApi() {
  const response = await fetch("api/data", { cache: "no-store" });
  if (!response.ok) throw new Error("api unavailable");
  return response.json();
}

async function loadStaticData() {
  staticMode = true;
  const trends = await fetchJson("data/trends.json", {});
  const scoredRaw = await fetchJson("data/scored-topics.json", {});
  return {
    trends,
    scored: applyLocalFeedback(scoredRaw)
  };
}

async function load() {
  try {
    latestData = await loadFromApi();
    staticMode = false;
  } catch {
    latestData = await loadStaticData();
  }

  const { trends = {}, scored = {} } = latestData;
  els.generatedAt.textContent = `更新: ${formatDate(scored.generatedAt || trends.generatedAt)}`;
  const sourceCount = (trends.sources || []).filter((source) => !source.error).length;
  els.sourceStatus.textContent = staticMode
    ? `GitHub Pages版 / ${sourceCount}/${(trends.sources || []).length} ソース取得`
    : `${sourceCount}/${(trends.sources || []).length} ソース取得`;

  els.analyzeButton.textContent = staticMode ? "GitHub Actionsで更新" : "今日のトレンドを更新";

  renderNews(trends.newsTrends || []);
  renderRising(trends.risingWords || []);
  renderTopicList(els.topics, scored.topics || trends.topics || []);
  renderLearned(scored);
  renderTopicList(els.watchLater, scored.watchLater || [], true);
  renderTopicList(els.hiddenOrCovered, scored.hiddenOrCovered || [], true);
}

els.analyzeButton.addEventListener("click", runAnalyze);
load();
