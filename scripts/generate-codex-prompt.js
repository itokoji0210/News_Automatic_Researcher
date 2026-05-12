import { writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  DATA_DIR,
  SCORED_TOPICS_PATH,
  TRENDS_PATH,
  readJson,
  writeJson
} from "./trend-utils.js";

const PROMPT_MD_PATH = path.join(DATA_DIR, "codex-prompt.md");
const PROMPT_JSON_PATH = path.join(DATA_DIR, "codex-prompt.json");

function todayLabel(date = new Date()) {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "full",
    timeZone: "Asia/Tokyo"
  }).format(date);
}

function line(value, fallback = "未確認") {
  return value || fallback;
}

function topicBlock(topic, index) {
  const candidates = (topic.photoCandidates || [])
    .map((candidate) => `  - ${candidate}`)
    .join("\n");
  const categories = [...(topic.categories || []), ...(topic.regions || [])].join(", ") || "未分類";
  const flags = [
    topic.droneSuitable ? "ドローン向き" : "",
    topic.flowerTopic ? "花ネタ" : "",
    topic.requiresVerification ? "確認待ち" : ""
  ]
    .filter(Boolean)
    .join(", ");

  return `### 候補${index}: ${line(topic.title)}
- トレンドワード: ${line(topic.trendWord)}
- 分類/地域: ${categories}
- 情報源: ${line(topic.source)} / ${line(topic.sourceType)}
- 根拠記事: ${line(topic.evidenceTitle)}
- 根拠URL: ${line(topic.evidenceUrl)}
- 画像サムネイル: ${line(topic.thumbnailUrl || topic.imageUrl)}
- スコア: ${line(topic.score)}
- 信頼度: ${line(topic.trust)}
- フラグ: ${flags || "なし"}
- 撮れそうな画:
${candidates || "  - 未生成"}
`;
}

function makePrompt({ trends, scored }) {
  const topics = (scored.topics || [])
    .filter((topic) => topic.evidenceUrl)
    .slice(0, 30);
  const risingWords = (trends.risingWords || [])
    .filter((word) => word.evidenceUrls?.length)
    .slice(0, 12)
    .map((word) => `${word.word}(${word.count})`)
    .join("、");
  const newsTrends = (trends.newsTrends || [])
    .filter((item) => item.url)
    .slice(0, 12)
    .map((item, index) => `${index + 1}. ${item.title}\n   ${item.url}`)
    .join("\n");

  return `あなたは新聞社・テレビ局の報道デスクを支援するAIリサーチャーです。

以下は、ニュースRSS、地方/PR/官公庁/イベント系ソースから機械抽出した「根拠URL付き」の時事ネタ候補です。
この入力内の候補とURLを主材料にし、必要な場合だけ追加確認を行ってください。
架空のネタ、根拠URLのないネタ、単なる連想だけのネタは出力しないでください。

## 今日
${todayLabel()}

## 目的
翌日以降おおむね1か月以内に現地取材できる、写真・動画・ドローンで絵になるニュースネタを選ぶ。
全国的な知名度がある場所・施設・産地・イベントは優先するが、最優先は「一目で強い画」と「今行く意味」。

## 今日の急上昇ワード
${risingWords || "未取得"}

## 今日のニュース傾向
${newsTrends || "未取得"}

## 入力候補
${topics.map(topicBlock).join("\n")}

## 選定ルール
- 根拠URLのある候補だけを扱う
- 公式情報、報道ソース、自治体/施設/企業発表を優先する
- 70点未満の候補は原則落とす
- 単なるグルメ、物産イベント、PR色のみ、夜間のみ、撮影許可が現実的でないものは除外する
- 写真・テレビ映像で成立する現場を最優先する
- ドローンは、上空から規模や変化が分かる場合だけ高評価にする
- 既報でも、後追いできる現場、別角度、定点比較、翌日以降も追えるものは残してよい

## 採点軸
各候補を100点満点で採点してください。
1. 色彩・光
2. スケール感
3. 動体・変化
4. ドローン付加価値
5. 感情誘起
6. 時間限定性
7. 社会課題接続性
8. 独自性
9. 継続取材適性
10. 取材実現性

## 出力してほしい内容
日本語で、以下の構成にしてください。

1. 今日の時事ワード 3〜8個
2. 今日すぐ電話すべき上位10件
3. 上位10件の取材設計書
4. 日付順の取材候補カレンダー 3週間分
5. 上位3件の取材班向け指示書
6. 落とした候補と理由
7. 追加で確認すべき公式URL/問い合わせ先

各取材設計書には必ず以下を入れてください。
- ネタ名
- 場所
- なぜ今か
- 撮れる絵 3カット以上
- ドローン適性 ◎○△× と規制/許可の注意
- 撮影時間帯
- 追いかけ価値
- スコア /100 と軸別コメント
- 競合状況
- 取材許可・申請先
- 推奨機材
- 見逃しリスク
- 関連キーワード
- 参考ニュース・SNSリンク
- 展開アイデア
`;
}

export async function generateCodexPrompt() {
  const trends = await readJson(TRENDS_PATH, {});
  const scored = await readJson(SCORED_TOPICS_PATH, {});
  const prompt = makePrompt({ trends, scored });
  const output = {
    generatedAt: new Date().toISOString(),
    topicCount: (scored.topics || []).filter((topic) => topic.evidenceUrl).length,
    prompt
  };

  await writeFile(PROMPT_MD_PATH, prompt, "utf8");
  await writeJson(PROMPT_JSON_PATH, output);
  return output;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  generateCodexPrompt()
    .then((result) => {
      console.log(`Saved Codex prompt with ${result.topicCount} grounded topics`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
