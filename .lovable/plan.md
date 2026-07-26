
# План: Рабочее пространство для трекинга задач

Персональный AI-помощник, который принимает текстовые и голосовые сообщения и автоматически превращает их в задачи, события календаря, покупки, дела или отчёты. Тёмная техно-эстетика, мобильная адаптация.

## Что будет уметь приложение

1. **Единый чат-ввод (текст/голос)** — вводите одну фразу, AI сам определяет тип и создаёт нужную сущность:
   - "завтра в 15:00 встреча с Аней" → событие в Google Календаре
   - "купить молоко и хлеб" → добавляет в список покупок
   - "не забыть отправить отчёт в пятницу" → задача с напоминанием
   - "запиши в отчёт: сегодня закрыл 3 сделки…" → передаёт в помощника отчётов
2. **Голосовой ввод** — микрофон в чате, распознавание речи на сервере.
3. **Дашборд недели** — задачи и события на каждый день, синхронизированные с личным Google Календарём пользователя.
4. **Списки** — создавайте произвольные списки (покупки, идеи, дела), потом настроите их вид.
5. **Помощник отчётов** — вы добавляете шаблоны (произвольный текст с плейсхолдерами), AI заполняет шаблон вашим сообщением и возвращает готовый отчёт.
6. **Напоминания** — браузерные push-уведомления + email; расписание проверяется на сервере.
7. **Мобильная версия** — адаптивный интерфейс с нижней навигацией на телефоне.

## Экраны

```text
/auth                  вход/регистрация (email+пароль, Google)
/                      Сегодня: чат + задачи/события дня
/week                  Неделя: 7 колонок, задачи + события Google Календаря
/lists                 Списки (все) + создание нового
/lists/$id             Один список
/reports               Помощник отчётов: шаблоны + сгенерированные отчёты
/settings              Google Календарь, уведомления, e-mail
```

## Дизайн

Тёмная техно-палитра из выбранного варианта:
- Фон `#0A0A0F`, текст `#F5F5F7`
- Акценты: фиолетовый `#7C5CFF` (primary), циан `#22D3EE` (secondary)
- Шрифты: Space Grotesk (заголовки) + Inter (текст), моно-акценты JetBrains Mono
- Стеклянные карточки с тонкой границей, лёгкое свечение на активных элементах, аккуратная анимация появления сообщений

Все цвета — семантические токены в `src/styles.css` (oklch), никаких хардкод-классов.

## Стек и архитектура (техническая часть)

- **TanStack Start** + Lovable Cloud (Supabase) для БД и аутентификации.
- **AI**: Lovable AI Gateway
  - Чат-роутер и генерация отчётов — `google/gemini-3.6-flash` с structured output (`Output.object`) для классификации ввода и извлечения полей (тип, заголовок, дата/время, элементы списка, …).
  - Голос → текст: `openai/gpt-4o-mini-transcribe` через `/v1/audio/transcriptions` (запись WAV на клиенте через Web Audio API).
- **Google Calendar** — App User Connector (`google_calendar`): каждый пользователь подключает свой аккаунт; ключ подключения шифруется и хранится в `app_user_connections`. Серверные функции читают события недели и создают новые события.
- **Email-напоминания** — Lovable Emails (домен пользователя). Браузерные уведомления — Web Notifications API + Service Worker; серверный планировщик через `pg_cron`, вызывающий публичный роут `/api/public/reminders/tick`, который рассылает подошедшие напоминания.
- **Чат-история**: один общий чат (по требованию). Сообщения хранятся в таблице `chat_messages`, вся история передаётся модели каждый ход.
- **UI**: AI Elements (`conversation`, `message`, `prompt-input`, `shimmer`) + shadcn/ui + Tailwind v4.

### Схема БД (Lovable Cloud)

```text
profiles(id, display_name, email, timezone)
chat_messages(id, user_id, role, content, parts_jsonb, created_at)
tasks(id, user_id, title, notes, due_at, done, source, gcal_event_id)
lists(id, user_id, name, kind)                 -- kind: shopping | todo | custom
list_items(id, list_id, text, checked, position)
report_templates(id, user_id, name, body)      -- body = текст-шаблон
reports(id, user_id, template_id, content, created_at)
reminders(id, user_id, task_id?, title, remind_at, channels[], sent_at)
notification_subscriptions(id, user_id, endpoint, keys_jsonb)  -- Web Push
app_user_connections(id, user_id, connector_id, connection_key_ciphertext) -- Google
```

RLS: все таблицы — доступ только `user_id = auth.uid()`. GRANT'ы на роль `authenticated`.

### Серверные функции (`createServerFn`)

- `routeChatMessage({text})` — прогоняет сообщение через AI-роутер, создаёт задачу/событие/список/отчёт, возвращает ассистент-ответ + созданные объекты.
- `transcribeAudio(file)` — проксирует WAV в Lovable AI STT.
- `createTask`, `createListItem`, `createReport` — прямые действия из UI.
- `getWeek({from,to})` — задачи + события Google (`/calendar/v3/calendars/primary/events`).
- `createGCalEvent(...)`, `connectGoogleCalendar(code)`, `disconnectGoogleCalendar()`.
- `sendReminderTick()` — вызывается из cron-роута, разослать подошедшие напоминания.

### Публичные роуты

- `src/routes/api/chat.ts` — стриминг ассистента (`streamText` + `toUIMessageStreamResponse`).
- `src/routes/api/public/reminders/tick.ts` — cron.
- `src/routes/oauth/google/return.tsx` — landing для OAuth Google.

## Порядок реализации

1. Включить Lovable Cloud; настроить auth (email/пароль + Google) и профили.
2. Дизайн-токены (тёмная техно) в `src/styles.css`, установить AI Elements.
3. Миграция БД (все таблицы выше + RLS + GRANT).
4. Роут-каркас: `_authenticated` layout, `/auth`, главные экраны + мобильная нижняя навигация.
5. Чат-роутер: серверная функция + стрим-роут `/api/chat`, structured output, запись сообщений.
6. Голосовой ввод: запись WAV, серверная транскрипция, вставка текста в композер.
7. CRUD: задачи, списки, элементы списков.
8. Google Calendar (App User Connector): подключение, получение недели, создание событий из чата.
9. Отчёты: CRUD шаблонов + генерация отчёта из шаблона + сообщения.
10. Напоминания: подписка на Web Push, email через Lovable Emails, cron-роут + `pg_cron`.
11. Настройки: подключение Google, email, часовой пояс, разрешение уведомлений.
12. Полировка мобильной версии и микро-анимаций.

## Что понадобится от вас позже

- Одобрить подключение **Google Calendar (App User Connector)** — откроется форма для настройки OAuth-клиента.
- Подтвердить **email-домен** для рассылки напоминаний (иначе будут только браузерные).
- Дать разрешение браузера на уведомления и микрофон при первом входе.

Готов начать реализацию — жмите **Implement plan**.
