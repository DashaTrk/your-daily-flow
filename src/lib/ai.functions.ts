import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// -------- CHAT ROUTER --------
const RouteInput = z.object({ text: z.string().min(1).max(4000) });

type RouterOutput = {
  kind: "task" | "list_item" | "event" | "note" | "reply" | "update" | "offer" | "digest" | "digest_sent";
  reply: string;
  task?: { title: string; due_at?: string | null; notes?: string | null; priority?: string };
  list_item?: { list_name: string; list_kind: "shopping" | "todo" | "custom"; items: string[] };
  event?: { title: string; start_at: string; duration_minutes?: number | null; notes?: string | null };
  reminder?: { title: string; remind_at: string } | null;
  update?: { target: "last_task"; new_due_at?: string | null; new_title?: string | null };
  offer?: {
    student_name: string;
    stage?: "maybe" | "got" | "working" | null;
    company?: string | null;
    start_date?: string | null;
    track?: "C#" | "Java" | "Golang" | null;
    note?: string | null;
  };
  digest?: {
    student_name: string;
    track: "C#" | "Java" | "Golang";
    section: "declarations" | "interviews" | "legend" | "cards";
    comment?: string | null;
    flagged?: boolean | null;
  };
  digest_sent?: { track: "C#" | "Java" | "Golang" };
};

export const routeChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => RouteInput.parse(data))
  .handler(async ({ data, context }) => {
    const { callAi } = await import("@/server/ai-runtime.server");
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
- "offer": сообщение про УЧЕНИКА и его трудоустройство ("Владислав Орехов получил оффер Java", "Аня возможно получит оффер", "Петров вышел на работу", "у Орехова дата выхода 1 сентября"). Заполни offer.student_name (ФИО как названо), offer.stage: "maybe" (возможно получит / собеседование / ждём ответ), "got" (получил оффер), "working" (вышел на работу). offer.company — направление/компания, если названо ("Java"). offer.start_date — дата выхода в формате YYYY-MM-DD, если названа. offer.track — направление обучения строго одно из "C#", "Java", "Golang", если оно упомянуто (например «получил оффер Java» → track: "Java", «шарпы»/«си шарп»/«C#» → "C#", «го»/«golang» → "Golang").
- "digest": комментарий про студента ДЛЯ ЕЖЕНЕДЕЛЬНОГО ДАЙДЖЕСТА. Ставь этот тип, если есть приписка «в дайджест», «дайджест» ИЛИ сообщение описывает статус студента по учебному процессу (карточки, декларации, собеседования/отклики, легенда/резюме). Заполни digest.student_name (Фамилия Имя как названо), digest.track строго "Java" | "C#" | "Golang", digest.section:
  • "cards" — КАРТОЧКИ: количество сделанных карточек/блоков за неделю и причины. Обычно формат «Имя Фамилия - N, причина» или «N карточек». Примеры: «Полина Бабякина 1 карточка, была занята, Java» → comment="1 карточка, была занята"; «Михаил Соболь - 2, не успел по личным причинам»; «Хайрулин Аухадий - 3, так как проходил мок»; «Вячеслав Сысков - 0, был в отпуске»; «Дмитрий Макаров - 3, +другие задания»; «Андрей Багмут - 0, переходит к описанию опыта»; «Александр Зотов - делает практику+мок»; «Ангелина Литовкина - просит отпуск, контроль, чтобы не вышло за пределы 4 недель».
  • "declarations" — ДЕКЛАРАЦИИ: пропуск, пропуски подряд, опоздание, «декларации нет», «не прислал декларацию». Примеры: «Тарачев Никита - пропуск»; «Максим Рахманов - опоздал»; «Андрей Пересыпкин - 2 пропуска подряд» (flagged=true); «Ринат Хаертдинов - вернулся с исключения, декларации нет».
  • "interviews" — СОБЕСЕДОВАНИЯ: отклики (мало/не вносит/не обновил), конверсия, отказы, приглашения, скрининги, тестовые, фильтры откликов, бот. Примеры: «Александр Порфирьев - мало откликов»; «Иван Алимский - конверсия не очень и после собеседований отказы»; «Бледных Александр - нет скринингов»; «Константин Киселев - постоянно пропадает, никак не пройдет моки, взять на контроль» (flagged=true).
  • "legend" — ЛЕГЕНДА/РЕЗЮМЕ: «N-я неделя на легенде/резюме», подготовка к мокам, долго делает легенду/резюме, молчит по резюме. Примеры: «Илья Яковлев - третья неделя на легенде»; «Никита Котов - четвертая неделя на резюме, молчит, декларации тоже нет»; «Шубин Илья - ставили сроки, выполнил, держать на контроле дальше, чтобы также оперативно сделал резюме».
  ВАЖНО: «мок» сам по себе не определяет раздел — смотри контекст: «3, так как проходил мок» → cards; «долго готовится к мокам» → legend.
  digest.comment — короткий комментарий БЕЗ имени и без слова «в дайджест», сохраняй формулировку пользователя почти дословно. digest.flagged=true, если сказано «критично», «важно», «особое внимание», «красный флаг», «взять на контроль», «2 пропуска подряд» или стоит ❗️.

- "digest_sent": пользователь сообщает, что ОТПРАВИЛ дайджест ("отправила отчёт по Java", "дайджест Golang отправлен"). Заполни digest_sent.track.


КРИТИЧНО:
- Если пользователь ЯВНО говорит "в список дел / покупок / …" — это list_item, а не task. list_name бери из фразы ("Дела", "Покупки"). Дату/день (понедельник) вставь в текст элемента списка.
- Если сообщение — правка предыдущего ("сегодня а не завтра", "перенеси на …") — kind="update" и заполни update.new_due_at (ISO UTC) или new_title. НЕ отвечай "переношу" без update-объекта.
- reply — честное подтверждение того, что реально сделано. Если kind="reply", не пиши "записал/добавил".
- Для event: событие РАЗОВОЕ, без повторов. duration_minutes бери из фразы ("на 2 часа" → 120, "на 30 минут" → 30). Если длительность не названа — 60. Название события делай коротким и с заглавной буквы ("маникюр" → "Маникюр"), без слов-команд ("внеси в календарь").
- Запись времени без минут однозначна: "в 12", "в 12 дня", "в 10 утра" означают 12:00, 12:00 и 10:00. Это НЕ причина просить переформулировать.
- Пример: "в календарь маникюр завтра в 12" → kind="event", event.title="Маникюр", завтра 12:00 Мск, duration_minutes=60.
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

    const explicitCalendarCommand = /(?:внес|добав|запиш|постав|созда|в\s+календар|событи)/iu.test(data.text)
      && /(?:календар|событи)/iu.test(data.text);
    if (explicitCalendarCommand && (parsed.kind !== "event" || !parsed.event)) {
      const retry = await callAi({
        model: "google/gemini-3.6-flash",
        messages: [
          {
            role: "system",
            content: `${system}\nПользователь явно приказал создать событие. Верни kind="event" и объект event. Время вида "в 12" означает 12:00.`,
          },
          { role: "user", content: data.text },
        ],
        response_format: { type: "json_object" },
      });
      try {
        const reparsed = JSON.parse(retry.choices[0].message.content) as RouterOutput;
        if (reparsed.kind === "event" && reparsed.event) parsed = reparsed;
      } catch {
        // The normal validation below will avoid claiming an action succeeded.
      }
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
        const durationMinutes = parsed.event.duration_minutes && parsed.event.duration_minutes > 0 ? parsed.event.duration_minutes : 60;
        const { data: t, error } = await supabase.from("tasks").insert({
          user_id: userId,
          title: parsed.event.title,
          notes: parsed.event.notes ?? null,
          due_at: parsed.event.start_at,
          duration_minutes: durationMinutes,
          source: "chat_event",
        }).select().single();
        if (error) throw error;
        created.event = t;
        actionOk = true;
        try {
          const { createGoogleCalendarEvent } = await import("@/server/appUserConnections.server");
          const gcalId = await createGoogleCalendarEvent({
            userId,
            title: parsed.event.title,
            startAt: parsed.event.start_at,
            durationMinutes,
            description: parsed.event.notes ?? null,
          });
          if (gcalId && t) {
            await supabase.from("tasks").update({ gcal_event_id: gcalId }).eq("id", t.id);
            created.gcal = true;
          } else {
            created.gcal = false;
            parsed.reply = `${parsed.reply} Google Календарь не подключён — событие сохранено только здесь. Подключите его в Настройках.`;
          }
        } catch (e: any) {
          console.error("Google Calendar sync failed", e);
          created.gcal = false;
          created.gcalError = e?.message ?? "error";
          parsed.reply = `${parsed.reply} Не удалось записать в Google Календарь: ${created.gcalError}. Проверьте подключение в Настройках.`;
        }

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
      } else if (parsed.kind === "offer" && parsed.offer?.student_name) {
        const o = parsed.offer;
        const { data: existing } = await supabase.from("offers")
          .select("*").eq("user_id", userId).ilike("student_name", o.student_name).maybeSingle();

        const patch: { stage?: string; company?: string; track?: string; note?: string; start_date?: string; tasks?: Record<string, string> } = {};
        if (o.stage) patch.stage = o.stage;
        if (o.company) patch.company = o.company;
        if (o.track) patch.track = o.track;
        if (o.note) patch.note = o.note;
        if (o.start_date) {
          patch.start_date = o.start_date;
          const tasks = { ...((existing?.tasks as Record<string, string>) ?? {}) };
          if (!tasks.start_date) tasks.start_date = new Date().toISOString();
          patch.tasks = tasks;
        }

        if (existing) {
          const { data: upd, error } = await supabase.from("offers")
            .update(patch).eq("id", existing.id).eq("user_id", userId).select().single();
          if (error) throw error;
          created.offer = upd;
        } else {
          const { data: ins, error } = await supabase.from("offers").insert({
            user_id: userId,
            student_name: o.student_name,
            stage: o.stage ?? "maybe",
            company: o.company ?? null,
            track: o.track ?? null,
            note: o.note ?? null,
            start_date: o.start_date ?? null,
            tasks: patch.tasks ?? {},
          }).select().single();
          if (error) throw error;
          created.offer = ins;
        }
        actionOk = true;
      } else if (parsed.kind === "digest" && parsed.digest?.student_name && parsed.digest?.track) {
        const { mondayOf, sectionTitle } = await import("@/lib/digest-shared");
        const d = parsed.digest;
        const { data: wk } = await supabase.from("digest_weeks")
          .select("week_start").eq("user_id", userId).eq("track", d.track).maybeSingle();
        const weekStart = wk?.week_start ?? mondayOf();
        const { data: row, error } = await supabase.from("digest_entries").insert({
          user_id: userId,
          track: d.track,
          section: d.section ?? "declarations",
          student_name: d.student_name,
          comment: d.comment ?? "",
          flagged: !!d.flagged,
          week_start: weekStart,
        }).select().single();
        if (error) throw error;
        created.digest = row;
        actionOk = true;
        parsed.reply = `Добавила в дайджест ${d.track}: ${d.student_name} — ${sectionTitle(d.section ?? "declarations").replace(":", "")}.`;
      } else if (parsed.kind === "digest_sent" && parsed.digest_sent?.track) {
        const { mondayOf, addDaysISO, renderDigest, weekRangeLabel } = await import("@/lib/digest-shared");
        const track = parsed.digest_sent.track;
        const { data: wk } = await supabase.from("digest_weeks")
          .select("week_start").eq("user_id", userId).eq("track", track).maybeSingle();
        const weekStart = wk?.week_start ?? mondayOf();
        const { data: entries } = await supabase.from("digest_entries")
          .select("*").eq("user_id", userId).eq("track", track).is("archived_at", null)
          .order("created_at", { ascending: true });
        const content = renderDigest(track, weekStart, (entries ?? []) as any);
        const { error } = await supabase.from("digest_reports").insert({
          user_id: userId, track, week_start: weekStart,
          week_end: addDaysISO(weekStart, 6), content,
        });
        if (error) throw error;
        await supabase.from("digest_entries").update({ archived_at: new Date().toISOString() })
          .eq("user_id", userId).eq("track", track).is("archived_at", null);
        await supabase.from("digest_weeks").upsert(
          { user_id: userId, track, week_start: addDaysISO(weekStart, 7) },
          { onConflict: "user_id,track" },
        );
        created.digest_sent = { track, weekStart };
        actionOk = true;
        parsed.reply = `Дайджест ${track} за ${weekRangeLabel(weekStart)} перенесён в архив. Новая неделя начата.`;
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
    const { transcribeAudioBlob } = await import("@/server/ai-runtime.server");
    return transcribeAudioBlob(data.file);
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
    const { callAi } = await import("@/server/ai-runtime.server");
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
