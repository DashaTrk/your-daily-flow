import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listTasks, toggleTask, deleteTask } from "@/lib/data.functions";
import { useServerFn } from "@tanstack/react-start";
import { weekDays, fmtShortDay, fmtTime, sameDay } from "@/lib/date-utils";
import { Check, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/week")({
  head: () => ({ meta: [{ title: "Неделя — Мой Ассистент" }, { name: "description", content: "Задачи и события на всю неделю." }] }),
  component: WeekPage,
});

function WeekPage() {
  const qc = useQueryClient();
  const fetchTasks = useServerFn(listTasks);
  const toggle = useServerFn(toggleTask);
  const del = useServerFn(deleteTask);
  const tasksQ = useQuery({ queryKey: ["tasks"], queryFn: () => fetchTasks() });
  const days = weekDays();
  const today = new Date();

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Неделя</h1>
        <p className="text-sm text-muted-foreground">Все задачи и события по дням.</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
        {days.map(d => {
          const items = (tasksQ.data ?? []).filter(t => t.due_at && sameDay(t.due_at, d));
          const isToday = sameDay(d, today);
          return (
            <div key={d.toISOString()} className={`glass rounded-2xl p-4 min-h-[240px] ${isToday ? "glow" : ""}`}>
              <div className="flex items-baseline justify-between mb-3">
                <h3 className={`font-display font-semibold capitalize ${isToday ? "text-primary" : "text-foreground"}`}>{fmtShortDay(d)}</h3>
                {isToday && <span className="text-[10px] uppercase tracking-widest text-primary">сегодня</span>}
              </div>
              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground">Пусто</p>
              ) : (
                <ul className="space-y-2">
                  {items.map(t => (
                    <li key={t.id} className="group rounded-lg bg-surface-2/60 p-2 flex items-start gap-2">
                      <button onClick={() => toggle({ data: { id: t.id, done: !t.done } }).then(() => qc.invalidateQueries({ queryKey: ["tasks"] }))}
                        className={`mt-0.5 h-4 w-4 shrink-0 rounded border transition flex items-center justify-center ${
                          t.done ? "bg-primary border-primary" : "border-border"
                        }`}>
                        {t.done && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs leading-tight ${t.done ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
                        {t.due_at && <p className="text-[10px] font-mono text-secondary mt-1">{fmtTime(t.due_at)}</p>}
                      </div>
                      <button onClick={() => del({ data: { id: t.id } }).then(() => qc.invalidateQueries({ queryKey: ["tasks"] }))}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
