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
  kind: "task" | "list_item" | "event" | "note" | "reply" | "update";
  reply: string;
  task?: { title: string; due_at?: string | null; notes?: string | null; priority?: string };
  list_item?: { list_name: string; list_kind: "shopping" | "todo" | "custom"; items: string[] };
  event?: { title: string; start_at: string; duration_minutes?: number | null; notes?: string | null };
  reminder?: { title: string; remind_at: string } | null;
  update?: { target: "last_task"; new_due_at?: string | null; new_title?: string | null };
};

export const routeChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => RouteInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Save user message
    await supabase.from("chat_messages").insert({ user_id: userId, role: "user", content: data.text });

    // Pull last few messages for follow-up context (e.g. "сегодня а не завтра")
    const { data: history } = await supabase
      .from("chat_messages")
      .select("role, content, meta, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(8);
    const contextMsgs = (history ?? []).reverse();

    const nowIso = new Date().toISOString();
    const nowLocal = new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow", weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
    const system = `Ты — помощник в личном трекере. Классифицируй сообщение и извлеки поля.

Типы (kind):
- "task": задача/дело ("не забыть отправить отчёт", "позвонить маме завтра в 15:00", "проверка деклараций в 10")
- "list_item": явное добавление В СПИСОК ("добавь в список покупок молоко", "в список дел на понедельник: X", "купить хлеб")
- "event": СОБЫТИЕ КАЛЕНДАРЯ. Ставь этот тип, если есть фразы "в календарь", "внеси в календарь", "добавь событие", "запиши в календарь" и подобные, ИЛИ если это встреча с конкретным временем ("встреча с Аней завтра 15:00").
- "update": КОРРЕКЦИЯ последнего действия ("сегодня а не завтра", "перенеси на 11", "нет, назови иначе")
- "reply": вопрос или диалог без действия
- "note": заметка без действия

КРИТИЧНО:
- Если пользователь ЯВНО говорит "в список дел / покупок / …" — это list_item, а не task. list_name бери из фразы ("Дела", "Покупки"). Дату/день (понедельник) вставь в текст элемента списка.
- Если сообщение — правка предыдущего ("сегодня а не завтра", "перенеси на …") — kind="update" и заполни update.new_due_at (ISO UTC) или new_title. НЕ отвечай "переношу" без update-объекта.
- reply — честное подтверждение того, что реально сделано. Если kind="reply", не пиши "записал/добавил".
- Для event: событие РАЗОВОЕ, без повторов. duration_minutes бери из фразы ("на 2 часа" → 120, "на 30 минут" → 30). Если длительность не названа — 60. Название события делай коротким и с заглавной буквы ("маникюр" → "Маникюр"), без слов-команд ("внеси в календарь").
- Сейчас: ${nowIso} UTC (${nowLocal} Мск). Даты возвращай ISO 8601 UTC. Если время не указано — 09:00 локального (06:00 UTC).
- Отвечай ТОЛЬКО валидным JSON.`;

    const aiRes = await callAi({
      model: "google/gemini-3.6-flash",
      messages: [
        { role: "system", content: system },
        ...contextMsgs.slice(0, -1).map((m: any) => ({ role: m.role, content: m.content })),
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
    let actionOk = false;

    try {
      if (parsed.kind === "task" && parsed.task) {
        const { data: t, error } = await supabase.from("tasks").insert({
          user_id: userId,
          title: parsed.task.title,
          notes: parsed.task.notes ?? null,
          due_at: parsed.task.due_at ?? null,
          priority: parsed.task.priority ?? "normal",
          source: "chat",
        }).select().single();
        if (error) throw error;
        created.task = t;
        actionOk = true;
        if (parsed.reminder && t) {
          await supabase.from("reminders").insert({
            user_id: userId, task_id: t.id, title: parsed.reminder.title,
            remind_at: parsed.reminder.remind_at, channels: ["browser"],
          });
        }
      } else if (parsed.kind === "event" && parsed.event) {
        const { data: t, error } = await supabase.from("tasks").insert({
          user_id: userId,
          title: parsed.event.title,
          notes: parsed.event.notes ?? null,
          due_at: parsed.event.start_at,
          duration_minutes: parsed.event.duration_minutes && parsed.event.duration_minutes > 0 ? parsed.event.duration_minutes : 60,
          source: "chat_event",
        }).select().single();
        if (error) throw error;
        created.event = t;
        actionOk = true;
      } else if (parsed.kind === "list_item" && parsed.list_item) {
        const { data: existing } = await supabase.from("lists")
          .select("*").eq("user_id", userId).ilike("name", parsed.list_item.list_name).maybeSingle();
        let list = existing;
        if (!list) {
          const { data: nl, error } = await supabase.from("lists").insert({
            user_id: userId, name: parsed.list_item.list_name, kind: parsed.list_item.list_kind,
          }).select().single();
          if (error) throw error;
          list = nl;
        }
        if (list) {
          const rows = parsed.list_item.items.map((t, i) => ({
            list_id: list!.id, user_id: userId, text: t, position: i,
          }));
          const { error } = await supabase.from("list_items").insert(rows);
          if (error) throw error;
          created.list = list;
          created.items = parsed.list_item.items;
          actionOk = true;
        }
      } else if (parsed.kind === "update" && parsed.update) {
        // Find last task created via chat by this user
        const { data: last } = await supabase.from("tasks")
          .select("*").eq("user_id", userId)
          .in("source", ["chat", "chat_event"])
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (last) {
          const patch: { due_at?: string; title?: string } = {};
          if (parsed.update.new_due_at) patch.due_at = parsed.update.new_due_at;
          if (parsed.update.new_title) patch.title = parsed.update.new_title;
          if (Object.keys(patch).length) {
            const { data: upd, error } = await supabase.from("tasks")
              .update(patch).eq("id", last.id).select().single();
            if (error) throw error;
            created.updated = upd;
            actionOk = true;
          }
        }
        if (!actionOk) {
          parsed.reply = "Не нашёл, что править — уточните, пожалуйста.";
        }
      }
    } catch (e: any) {
      parsed.reply = `Не удалось сохранить: ${e?.message ?? "ошибка"}`;
      parsed.kind = "reply";
    }

    // Guard: if the model chose "reply" but its text sounds like a confirmation, correct it.
    if (!actionOk && /запис|добав|создал|перенес|принял|готово/i.test(parsed.reply) && parsed.kind !== "reply") {
      parsed.reply = "Не совсем понял — переформулируйте, пожалуйста.";
    }

    await supabase.from("chat_messages").insert({
      user_id: userId, role: "assistant", content: parsed.reply, meta: { kind: parsed.kind, created, actionOk },
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
