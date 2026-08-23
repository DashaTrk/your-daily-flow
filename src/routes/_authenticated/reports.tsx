import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listTemplates, upsertTemplate, deleteTemplate, listReports } from "@/lib/data.functions";
import { generateReport } from "@/lib/ai.functions";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Trash2, FileText, Sparkles, Copy, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fmtDate } from "@/lib/date-utils";
import { OffersFunnel } from "@/components/OffersFunnel";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Отчёты — Мой Ассистент" }, { name: "description", content: "Шаблоны отчётов и AI-помощник." }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const qc = useQueryClient();
  const fetchTpl = useServerFn(listTemplates);
  const fetchRep = useServerFn(listReports);
  const save = useServerFn(upsertTemplate);
  const del = useServerFn(deleteTemplate);
  const gen = useServerFn(generateReport);

  const tplQ = useQuery({ queryKey: ["templates"], queryFn: () => fetchTpl() });
  const repQ = useQuery({ queryKey: ["reports"], queryFn: () => fetchRep() });

  const [editing, setEditing] = useState<any | null>(null);
  const [selectedTplId, setSelectedTplId] = useState<string | "">("");
  const [source, setSource] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [tab, setTab] = useState<"reports" | "offers">("reports");

  const saveMut = useMutation({
    mutationFn: async (t: { id?: string; name: string; body: string }) => save({ data: t }),
    onSuccess: () => { setEditing(null); qc.invalidateQueries({ queryKey: ["templates"] }); toast.success("Шаблон сохранён"); },
    onError: (e: any) => toast.error(e.message),
  });

  const genMut = useMutation({
    mutationFn: async () => gen({ data: { template_id: selectedTplId, source_text: source } }),
    onSuccess: () => { setSource(""); qc.invalidateQueries({ queryKey: ["reports"] }); toast.success("Отчёт готов"); },
    onError: (e: any) => toast.error(e.message),
  });

  const copy = (id: string, text: string) => { navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(null), 1500); };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Отчёты</h1>
        <p className="text-sm text-muted-foreground">Наговорите или напишите — AI заполнит ваш шаблон.</p>
      </header>

      <nav className="flex gap-1 p-1 rounded-xl bg-surface-2/60 w-fit">
        {([["reports", "Отчёты"], ["offers", "Офферы"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`text-sm px-4 py-1.5 rounded-lg transition ${tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {label}
          </button>
        ))}
      </nav>

      {tab === "offers" && <OffersFunnel />}

      {tab === "reports" && (<>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Templates */}
        <section className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-secondary" />Шаблоны</h2>
            <button onClick={() => setEditing({ name: "", body: "" })}
              className="text-xs bg-primary/15 text-primary rounded-lg px-3 py-1.5 flex items-center gap-1 hover:bg-primary/25">
              <Plus className="h-3 w-3" />Новый
            </button>
          </div>

          {editing && (
            <div className="mb-4 space-y-2 rounded-xl bg-surface-2/60 p-3">
              <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
                placeholder="Название шаблона" className="w-full bg-input/40 rounded-lg px-3 py-2 text-sm outline-none border border-border focus:border-primary" />
              <textarea value={editing.body} onChange={e => setEditing({ ...editing, body: e.target.value })}
                placeholder="Текст шаблона с плейсхолдерами, например:&#10;&#10;Отчёт за день:&#10;- Что сделано: [список]&#10;- Проблемы: [если есть]&#10;- Планы на завтра: [список]"
                rows={8} className="w-full bg-input/40 rounded-lg px-3 py-2 text-sm outline-none border border-border focus:border-primary font-mono" />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditing(null)} className="text-sm px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground">Отмена</button>
                <button disabled={!editing.name || !editing.body} onClick={() => saveMut.mutate(editing)}
                  className="text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">Сохранить</button>
              </div>
            </div>
          )}

          <ul className="space-y-2">
            {(tplQ.data ?? []).length === 0 && !editing && (
              <p className="text-sm text-muted-foreground py-4 text-center">Шаблонов пока нет.</p>
            )}
            {(tplQ.data ?? []).map((t: any) => (
              <li key={t.id} className="group rounded-lg bg-surface-2/60 p-3 flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{t.name}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1 whitespace-pre-wrap">{t.body}</p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => setEditing(t)} className="text-xs text-primary hover:underline">ред.</button>
                  <button onClick={() => del({ data: { id: t.id } }).then(() => qc.invalidateQueries({ queryKey: ["templates"] }))}
                    className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Generator */}
        <section className="glass rounded-2xl p-5">
          <h2 className="font-display font-semibold flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-primary" />Сгенерировать отчёт
          </h2>
          <select value={selectedTplId} onChange={e => setSelectedTplId(e.target.value)}
            className="w-full bg-input/40 rounded-lg px-3 py-2 text-sm outline-none border border-border focus:border-primary mb-3">
            <option value="">Выберите шаблон…</option>
            {(tplQ.data ?? []).map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <textarea value={source} onChange={e => setSource(e.target.value)}
            placeholder="Напишите или наговорите информацию для отчёта…"
            rows={8} className="w-full bg-input/40 rounded-lg px-3 py-2 text-sm outline-none border border-border focus:border-primary" />
          <button disabled={!selectedTplId || !source.trim() || genMut.isPending}
            onClick={() => genMut.mutate()}
            className="mt-3 w-full bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 glow">
            {genMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Сгенерировать
          </button>
        </section>
      </div>

      {/* History */}
      <section>
        <h2 className="font-display font-semibold mb-3">История отчётов</h2>
        {(repQ.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Ещё нет ни одного.</p>
        ) : (
          <div className="space-y-3">
            {(repQ.data ?? []).map((r: any) => (
              <div key={r.id} className="glass rounded-2xl p-5">
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="font-semibold">{r.title}</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground font-mono">{fmtDate(r.created_at)}</span>
                    <button onClick={() => copy(r.id, r.content)} className="text-xs text-secondary hover:underline flex items-center gap-1">
                      {copied === r.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copied === r.id ? "скопировано" : "копировать"}
                    </button>
                  </div>
                </div>
                <pre className="whitespace-pre-wrap text-sm text-foreground/90 font-sans">{r.content}</pre>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
