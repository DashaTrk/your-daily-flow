import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listChatMessages } from "@/lib/data.functions";
import { routeChatMessage } from "@/lib/ai.functions";
import { useServerFn } from "@tanstack/react-start";
import { ChatComposer } from "@/components/ChatComposer";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({ meta: [{ title: "Ассистент — Мой Ассистент" }, { name: "description", content: "Чат с ассистентом: задачи, события, списки голосом или текстом." }] }),
  component: AssistantPage,
});

function AssistantPage() {
  const qc = useQueryClient();
  const fetchMsgs = useServerFn(listChatMessages);
  const routeMsg = useServerFn(routeChatMessage);

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
      qc.invalidateQueries({ queryKey: ["reminders"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Ошибка"),
  });

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 flex flex-col h-[calc(100vh-6rem)] md:h-screen">
      <header className="mb-4">
        <h1 className="text-3xl font-display font-bold">Ассистент</h1>
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
    </div>
  );
}
