import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listTasks, listReminders } from "@/lib/data.functions";
import { toggleTask, deleteTask } from "@/lib/data.functions";
import { useServerFn } from "@tanstack/react-start";
import { Check, Trash2, CalendarClock, ListChecks, Bell, MessageSquare, Sparkles } from "lucide-react";
import { fmtTime, sameDay } from "@/lib/date-utils";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({ meta: [{ title: "Сегодня — Мой Ассистент" }, { name: "description", content: "Дашборд задач и событий на сегодня." }] }),
  component: TodayPage,
});

function TodayPage() {
  const qc = useQueryClient();
  const fetchTasks = useServerFn(listTasks);
  const fetchReminders = useServerFn(listReminders);
  const toggle = useServerFn(toggleTask);
  const del = useServerFn(deleteTask);

  const tasksQ = useQuery({ queryKey: ["tasks"], queryFn: () => fetchTasks() });
  const remQ = useQuery({ queryKey: ["reminders"], queryFn: () => fetchReminders() });

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const today = now;
  const todaysAll = (tasksQ.data ?? []).filter(t => t.due_at && sameDay(t.due_at, today));
  const scheduled = todaysAll
    .filter(t => t.due_at)
    .sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime());
  const doneCount = scheduled.filter(t => t.done).length;
  const noDate = (tasksQ.data ?? []).filter(t => !t.due_at && !t.done);
  const upcoming = (remQ.data ?? []).filter(r => !r.sent_at && sameDay(r.remind_at, today))
    .sort((a, b) => new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime());

  const nextEvent = scheduled.find(t => !t.done && new Date(t.due_at!).getTime() > now.getTime());
  const progress = scheduled.length ? Math.round((doneCount / scheduled.length) * 100) : 0;

  const dateLabel = format(today, "EEEE, d MMMM", { locale: ru });
  const timeLabel = format(now, "HH:mm");

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground capitalize">{dateLabel}</p>
          <h1 className="text-4xl font-display font-bold mt-1">
            <span className="text-gradient">{timeLabel}</span>
          </h1>
        </div>
        <Link
          to="/assistant"
          className="glass glow rounded-xl px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-surface-2 transition"
        >
          <MessageSquare className="h-4 w-4 text-primary" />
          Открыть ассистента
        </Link>
      </header>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="glass rounded-2xl p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Запланировано</p>
          <p className="text-3xl font-display font-bold mt-1">{scheduled.length}</p>
          <div className="mt-3 h-1.5 rounded-full bg-surface-2 overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-2">{doneCount} из {scheduled.length} выполнено</p>
        </div>

        <div className="glass rounded-2xl p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Следующее</p>
          {nextEvent ? (
            <>
              <p className="text-lg font-medium mt-1 truncate">{nextEvent.title}</p>
              <p className="text-sm text-secondary mt-1">в {fmtTime(nextEvent.due_at!)}</p>
            </>
          ) : (
            <p className="text-muted-foreground mt-2 text-sm">На сегодня всё запланированное позади.</p>
          )}
        </div>

        <div className="glass rounded-2xl p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Без даты</p>
          <p className="text-3xl font-display font-bold mt-1">{noDate.length}</p>
          <p className="text-xs text-muted-foreground mt-2">Задач ждут своего часа</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Timeline */}
        <section className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <CalendarClock className="h-4 w-4 text-secondary" />
            <h2 className="font-display font-semibold">Расписание на сегодня</h2>
          </div>

          {scheduled.length === 0 ? (
            <EmptyState />
          ) : (
            <ol className="relative border-l border-border/50 pl-6 space-y-4">
              {scheduled.map(t => {
                const time = new Date(t.due_at!);
                const isPast = time.getTime() < now.getTime();
                const isCurrent = !t.done && !isPast && nextEvent?.id === t.id;
                return (
                  <li key={t.id} className="relative">
                    <span className={`absolute -left-[29px] top-1 h-3 w-3 rounded-full border-2 ${
                      t.done ? "bg-primary border-primary"
                        : isCurrent ? "bg-secondary border-secondary glow"
                        : isPast ? "bg-transparent border-muted"
                        : "bg-surface-2 border-border"
                    }`} />
                    <div className={`glass rounded-xl p-3 flex items-start gap-3 group ${isCurrent ? "ring-1 ring-secondary/40" : ""}`}>
                      <button onClick={() => toggle({ data: { id: t.id, done: !t.done } }).then(() => qc.invalidateQueries({ queryKey: ["tasks"] }))}
                        className={`mt-0.5 h-5 w-5 shrink-0 rounded-md border transition flex items-center justify-center ${
                          t.done ? "bg-primary border-primary" : "border-border hover:border-primary"
                        }`}>
                        {t.done && <Check className="h-3 w-3 text-primary-foreground" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className={`text-xs font-mono ${isCurrent ? "text-secondary" : "text-muted-foreground"}`}>
                            {fmtTime(t.due_at!)}
                            {t.source === "chat_event" && t.duration_minutes
                              ? `–${fmtTime(new Date(time.getTime() + t.duration_minutes * 60_000))}`
                              : ""}
                          </span>
                          {t.source === "chat_event" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/15 text-secondary uppercase tracking-wider">событие</span>}
                          {t.priority === "high" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/15 text-destructive uppercase tracking-wider">важно</span>}
                        </div>
                        <p className={`text-sm mt-0.5 ${t.done ? "line-through text-muted-foreground" : "text-foreground"}`}>{t.title}</p>
                        {t.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.notes}</p>}
                      </div>
                      <button onClick={() => del({ data: { id: t.id } }).then(() => qc.invalidateQueries({ queryKey: ["tasks"] }))}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* Sidebar */}
        <aside className="space-y-4">
          {upcoming.length > 0 && (
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Bell className="h-4 w-4 text-secondary" />
                <h2 className="font-display font-semibold">Напоминания</h2>
              </div>
              <ul className="space-y-2">
                {upcoming.map(r => (
                  <li key={r.id} className="text-sm flex items-baseline gap-2">
                    <span className="text-xs font-mono text-secondary">{fmtTime(r.remind_at)}</span>
                    <span className="truncate">{r.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <ListChecks className="h-4 w-4 text-secondary" />
              <h2 className="font-display font-semibold">Без даты</h2>
            </div>
            {noDate.length === 0 ? (
              <p className="text-sm text-muted-foreground">Все задачи распределены.</p>
            ) : (
              <ul className="space-y-2">
                {noDate.slice(0, 8).map(t => (
                  <li key={t.id} className="group flex items-start gap-2">
                    <button onClick={() => toggle({ data: { id: t.id, done: !t.done } }).then(() => qc.invalidateQueries({ queryKey: ["tasks"] }))}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border border-border hover:border-primary transition" />
                    <span className="text-sm flex-1 truncate">{t.title}</span>
                    <button onClick={() => del({ data: { id: t.id } }).then(() => qc.invalidateQueries({ queryKey: ["tasks"] }))}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-8">
      <Sparkles className="h-6 w-6 mx-auto mb-2 text-primary" />
      <p className="text-sm text-muted-foreground">На сегодня ничего не запланировано.</p>
      <Link to="/assistant" className="inline-flex items-center gap-1.5 mt-3 text-sm text-primary hover:underline">
        <MessageSquare className="h-3.5 w-3.5" /> Наговорить ассистенту
      </Link>
    </div>
  );
}
