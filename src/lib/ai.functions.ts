import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const LOVABLE_AI = "https://ai.gateway.lovable.dev/v1";

async function callAi(body: unknown): Promise<any> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not set");
  const res = await fetch(`${LOVABLE_AI}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
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

// -------- CHAT ROUTER --------
const RouteInput = z.object({ text: z.string().min(1).max(4000) });

type RouterOutput = {
  kind: "task" | "list_item" | "event" | "note" | "reply";
  reply: string;
  task?: { title: string; due_at?: string | null; notes?: string | null; priority?: string };
  list_item?: { list_name: string; list_kind: "shopping" | "todo" | "custom"; items: string[] };
  event?: { title: string; start_at: string; notes?: string | null };
  reminder?: { title: string; remind_at: string } | null;
};

export const routeChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => RouteInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Save user message
    await supabase.from("chat_messages").insert({ user_id: userId, role: "user", content: data.text });

    const nowIso = new Date().toISOString();
    const system = `Ты — помощник в личном трекере. Пользователь пишет короткое сообщение на естественном языке. Классифицируй сообщение в один из типов и извлеки поля.

Типы:
- "task": одиночная задача/дело/напоминание с датой или без ("не забыть отправить отчёт", "позвонить маме завтра в 15:00")
- "list_item": добавление в список ("купить молоко и хлеб" → список покупок; "идеи: посмотреть фильм X" → список идей)
- "event": встреча/событие с конкретным временем ("встреча с Аней завтра 15:00 в офисе")
- "note": простая заметка без действия
- "reply": пользователь задал вопрос или ведёт диалог — просто ответить в reply

Правила:
- Сейчас: ${nowIso} (UTC). Часовой пояс пользователя: UTC. Все даты возвращай ISO 8601 в UTC.
- Если время неоднозначно ("завтра"), ставь 09:00 UTC.
- reply — короткое дружелюбное подтверждение на русском ("Записал задачу «...» на завтра в 15:00").
- Если событие с временем — kind="event". Если задача с дедлайном — kind="task".
- Для list_item: определи название списка. Кухня/еда → "Покупки" (shopping). Прочее → "Дела" (todo) или указанное имя.
- Если пользователь просит напоминание — заполни reminder с датой.
- Отвечай ТОЛЬКО валидным JSON без комментариев и \`\`\`.`;

    const aiRes = await callAi({
      model: "google/gemini-3.6-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: data.text },
      ],
      response_format: { type: "json_object" },
    });

    let parsed: RouterOutput;
    try {
      parsed = JSON.parse(aiRes.choices[0].message.content);
    } catch {
      parsed = { kind: "reply", reply: aiRes.choices[0].message.content ?? "Не понял, повторите?" };
    }

    const created: Record<string, any> = {};

    if (parsed.kind === "task" && parsed.task) {
      const { data: t } = await supabase.from("tasks").insert({
        user_id: userId,
        title: parsed.task.title,
        notes: parsed.task.notes ?? null,
        due_at: parsed.task.due_at ?? null,
        priority: parsed.task.priority ?? "normal",
        source: "chat",
      }).select().single();
      created.task = t;
      if (parsed.reminder && t) {
        await supabase.from("reminders").insert({
          user_id: userId, task_id: t.id, title: parsed.reminder.title,
          remind_at: parsed.reminder.remind_at, channels: ["browser"],
        });
      }
    } else if (parsed.kind === "event" && parsed.event) {
      const { data: t } = await supabase.from("tasks").insert({
        user_id: userId,
        title: parsed.event.title,
        notes: parsed.event.notes ?? null,
        due_at: parsed.event.start_at,
        source: "chat_event",
      }).select().single();
      created.event = t;
    } else if (parsed.kind === "list_item" && parsed.list_item) {
      // Find or create list
      const { data: existing } = await supabase.from("lists")
        .select("*").eq("user_id", userId).ilike("name", parsed.list_item.list_name).maybeSingle();
      let list = existing;
      if (!list) {
        const { data: nl } = await supabase.from("lists").insert({
          user_id: userId, name: parsed.list_item.list_name, kind: parsed.list_item.list_kind,
        }).select().single();
        list = nl;
      }
      if (list) {
        const rows = parsed.list_item.items.map((t, i) => ({
          list_id: list!.id, user_id: userId, text: t, position: i,
        }));
        await supabase.from("list_items").insert(rows);
        created.list = list;
        created.items = parsed.list_item.items;
      }
    }

    await supabase.from("chat_messages").insert({
      user_id: userId, role: "assistant", content: parsed.reply, meta: { kind: parsed.kind, created },
    });

    return { reply: parsed.reply, kind: parsed.kind, created };
  });

// -------- TRANSCRIBE --------
export const transcribeAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const isFormData = typeof FormData !== "undefined" && data instanceof FormData;
    if (!isFormData) throw new Error("Expected FormData");
    const fd = data as FormData;
    const file = fd.get("file");
    if (!file || typeof (file as Blob).arrayBuffer !== "function") throw new Error("Missing file");
    return { file: file as Blob };
  })
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY not set");
    const upstream = new FormData();
    upstream.append("model", "openai/gpt-4o-mini-transcribe");
    const blob = data.file;
    const name = (blob instanceof File && blob.name) || "recording.wav";
    upstream.append("file", blob, name);
    const res = await fetch(`${LOVABLE_AI}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: upstream,
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Transcription failed: ${res.status} ${t.slice(0, 200)}`);
    }
    const json = await res.json();
    return { text: json.text as string };
  });

// -------- REPORT GENERATION --------
const ReportInput = z.object({
  template_id: z.string().uuid(),
  source_text: z.string().min(1),
  title: z.string().optional(),
});

export const generateReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ReportInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: tpl, error: tplErr } = await supabase.from("report_templates")
      .select("*").eq("id", data.template_id).eq("user_id", userId).single();
    if (tplErr || !tpl) throw new Error("Шаблон не найден");

    const prompt = `Ты — помощник по отчётам. Возьми шаблон отчёта и заполни его на основе входных данных пользователя. Сохрани структуру и стиль шаблона, замени плейсхолдеры и подставь смысловые фрагменты. Если данных не хватает — оставь пометку [не указано].

--- ШАБЛОН ---
${tpl.body}

--- ДАННЫЕ ПОЛЬЗОВАТЕЛЯ ---
${data.source_text}

Верни ТОЛЬКО готовый текст отчёта, без комментариев и markdown-обёрток.`;

    const aiRes = await callAi({
      model: "google/gemini-3.6-flash",
      messages: [{ role: "user", content: prompt }],
    });
    const content = aiRes.choices[0].message.content ?? "";

    const { data: report } = await supabase.from("reports").insert({
      user_id: userId,
      template_id: data.template_id,
      title: data.title ?? `${tpl.name} — ${new Date().toLocaleDateString("ru-RU")}`,
      content,
      source_text: data.source_text,
    }).select().single();

    return report;
  });
