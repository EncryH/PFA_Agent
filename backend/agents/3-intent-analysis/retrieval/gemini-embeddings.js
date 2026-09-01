const DEFAULT_MODEL = "gemini-embedding-001";
const DEFAULT_DIMENSIONS = 768;

const modelName = (model) => model.startsWith("models/") ? model : `models/${model}`;

const endpoint = (model, method) =>
  `https://generativelanguage.googleapis.com/v1beta/${modelName(model)}:${method}`;

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function retryDelay(response, attempt) {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1_000;
  return 500 * 2 ** attempt;
}

async function postEmbedding(url, payload, apiKey, retries) {
  if (!apiKey) throw new Error("Gemini 임베딩 API 키가 없습니다");

  let response;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) return response.json();
    if (![429, 503].includes(response.status) || attempt === retries) break;
    await wait(retryDelay(response, attempt));
  }

  throw new Error(`Gemini Embedding ${response.status}: ${(await response.text()).slice(0, 300)}`);
}

export function normalizeEmbedding(values = []) {
  const vector = values.map(Number);
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!magnitude) throw new Error("Gemini 임베딩 벡터가 비어 있습니다");
  return vector.map((value) => value / magnitude);
}

export function embeddingConfig() {
  return {
    model: process.env.GEMINI_EMBEDDING_MODEL || DEFAULT_MODEL,
    dimensions: Number(process.env.GEMINI_EMBEDDING_DIMENSIONS) || DEFAULT_DIMENSIONS,
  };
}

export async function embedQuery(text, apiKey, {
  model = embeddingConfig().model,
  dimensions = embeddingConfig().dimensions,
} = {}) {
  const data = await postEmbedding(endpoint(model, "embedContent"), {
    model: modelName(model),
    taskType: "RETRIEVAL_QUERY",
    outputDimensionality: dimensions,
    content: { parts: [{ text: String(text || "") }] },
  }, apiKey, 1);

  return normalizeEmbedding(data?.embedding?.values);
}

export async function embedDocuments(texts, apiKey, {
  model = embeddingConfig().model,
  dimensions = embeddingConfig().dimensions,
  retries = 4,
} = {}) {
  if (!Array.isArray(texts) || !texts.length) return [];

  const data = await postEmbedding(endpoint(model, "batchEmbedContents"), {
    requests: texts.map((text) => ({
      model: modelName(model),
      taskType: "RETRIEVAL_DOCUMENT",
      outputDimensionality: dimensions,
      content: { parts: [{ text: String(text || "") }] },
    })),
  }, apiKey, retries);

  const embeddings = data?.embeddings || [];
  if (embeddings.length !== texts.length) {
    throw new Error(`Gemini 임베딩 개수 불일치: 요청 ${texts.length}, 응답 ${embeddings.length}`);
  }
  return embeddings.map((embedding) => normalizeEmbedding(embedding.values));
}
