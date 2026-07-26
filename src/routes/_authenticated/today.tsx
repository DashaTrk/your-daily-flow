import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listTasks, listChatMessages, toggleTask, deleteTask } from "@/lib/data.functions";
import { routeChatMessage } from "@/lib/ai.functions";
import { useServerFn } from "@tanstack/react-start";
import { ChatComposer } from "@/components/ChatComposer";
import { toast } from "sonner";
import { Check, Trash2, CalendarClock, ListChecks, Sparkles } from "lucide-react";
import { fmtTime, sameDay } from "@/lib/date-utils";
import { useEffect, useRef } from "react";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({ meta: [{ title: "Сегодня — Flow" }, { name: "description", content: "Чат-ассистент и задачи на сегодня." }] }),
  component: TodayPage,
});

function TodayPage() {
  const qc = useQueryClient();
  const fetchTasks = useServerFn(listTasks);
  const fetchMsgs = useServerFn(listChatMessages);
  const routeMsg = useServerFn(routeChatMessage);
  const toggle = useServerFn(toggleTask);
  const del = useServerFn(deleteTask);

  const tasksQ = useQuery({ queryKey: ["tasks"], queryFn: () => fetchTasks() });
  const msgsQ = useQuery({ queryKey: ["chat"], queryFn: () => fetchMsgs() });

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgsQ.data?.length]);

  const sendMut = useMutation({
    mutationFn: async (text: string) => routeMsg({ data: { text } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["lists"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Ошибка"),
  });

  const today = new Date();
  const todaysTasks = (tasksQ.data ?? []).filter(t => t.due_at && sameDay(t.due_at, today));
  const noDate = (tasksQ.data ?? []).filter(t => !t.due_at && !t.done).slice(0, 5);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-4rem)]">
        <header className="mb-4">
          <h1 className="text-3xl font-bold">Сегодня</h1>
          <p className="text-sm text-muted-foreground">Наговорите или напишите — я разложу по полочкам.</p>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-1 pb-4">
          {(msgsQ.data ?? []).length === 0 && (
            <div className="glass rounded-2xl p-6 text-center">
              <Sparkles className="h-6 w-6 mx-auto mb-2 text-primary" />
              <p className="text-sm text-muted-foreground">
                Попробуйте: «завтра в 15:00 встреча с Аней», «купить молоко и хлеб», «не забыть отправить отчёт в пятницу».
              </p>
            </div>
          )}
          {(msgsQ.data ?? []).map(m => (
            <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "glass text-foreground rounded-bl-sm"
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {sendMut.isPending && (
            <div className="flex justify-start">
              <div className="glass rounded-2xl px-4 py-2.5 text-sm text-muted-foreground animate-pulse">Думаю…</div>
            </div>
          )}
        </div>

        <ChatComposer onSend={async t => { await sendMut.mutateAsync(t); }} disabled={sendMut.isPending} />
      </section>

      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock className="h-4 w-4 text-secondary" />
            <h2 className="font-display font-semibold">Задачи на сегодня</h2>
          </div>
          {todaysTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Пока пусто. Ваш день чист.</p>
          ) : (
            <ul className="space-y-2">
              {todaysTasks.map(t => (
                <TaskRow key={t.id} task={t} onToggle={() => toggle({ data: { id: t.id, done: !t.done } }).then(() => qc.invalidateQueries({ queryKey: ["tasks"] }))}
                  onDelete={() => del({ data: { id: t.id } }).then(() => qc.invalidateQueries({ queryKey: ["tasks"] }))} />
              ))}
            </ul>
          )}
        </div>
        {noDate.length > 0 && (
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <ListChecks className="h-4 w-4 text-secondary" />
              <h2 className="font-display font-semibold">Без даты</h2>
            </div>
            <ul className="space-y-2">
              {noDate.map(t => (
                <TaskRow key={t.id} task={t} onToggle={() => toggle({ data: { id: t.id, done: !t.done } }).then(() => qc.invalidateQueries({ queryKey: ["tasks"] }))}
                  onDelete={() => del({ data: { id: t.id } }).then(() => qc.invalidateQueries({ queryKey: ["tasks"] }))} />
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}

function TaskRow({ task, onToggle, onDelete }: { task: any; onToggle: () => void; onDelete: () => void }) {
  return (
    <li className="group flex items-start gap-3">
      <button onClick={onToggle}
        className={`mt-0.5 h-5 w-5 shrink-0 rounded-md border transition flex items-center justify-center ${
          task.done ? "bg-primary border-primary" : "border-border hover:border-primary"
        }`}>
        {task.done && <Check className="h-3 w-3 text-primary-foreground" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${task.done ? "line-through text-muted-foreground" : "text-foreground"}`}>{task.title}</p>
        {task.due_at && <p className="text-xs text-muted-foreground mt-0.5">{fmtTime(task.due_at)}</p>}
      </div>
      <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition">
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}
