const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1";

function requireAiKey() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not set");
  return key;
}

export async function callAi(body: unknown): Promise<any> {
  const res = await fetch(`${LOVABLE_AI_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${requireAiKey()}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 402) throw new Error("Кредиты AI закончились. Пополните баланс в настройках.");
    if (res.status === 429) throw new Error("Слишком много запросов. Подождите немного.");
    throw new Error(`AI error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export async function transcribeAudioBlob(blob: Blob) {
  const upstream = new FormData();
  upstream.append("model", "openai/gpt-4o-mini-transcribe");
  const name = blob instanceof File && blob.name ? blob.name : "recording.wav";
  upstream.append("file", blob, name);
  const res = await fetch(`${LOVABLE_AI_URL}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${requireAiKey()}` },
    body: upstream,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Transcription failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { text?: string };
  return { text: json.text ?? "" };
}