import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listLists, createList, deleteList } from "@/lib/data.functions";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Trash2, ListChecks, ShoppingCart, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/lists")({
  head: () => ({ meta: [{ title: "Списки — Flow" }, { name: "description", content: "Все ваши списки в одном месте." }] }),
  component: ListsPage,
});

function ListsPage() {
  const qc = useQueryClient();
  const fetch = useServerFn(listLists);
  const create = useServerFn(createList);
  const del = useServerFn(deleteList);
  const q = useQuery({ queryKey: ["lists"], queryFn: () => fetch() });
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"todo" | "shopping" | "custom">("todo");

  const createMut = useMutation({
    mutationFn: async () => create({ data: { name, kind } }),
    onSuccess: () => { setName(""); qc.invalidateQueries({ queryKey: ["lists"] }); toast.success("Список создан"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Списки</h1>
        <p className="text-sm text-muted-foreground">Покупки, дела, идеи — всё вместе.</p>
      </header>

      <div className="glass rounded-2xl p-4 mb-6 flex flex-col sm:flex-row gap-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Название нового списка"
          onKeyDown={e => e.key === "Enter" && name.trim() && createMut.mutate()}
          className="flex-1 bg-input/40 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" />
        <select value={kind} onChange={e => setKind(e.target.value as any)}
          className="bg-input/40 border border-border rounded-lg px-3 py-2 text-sm outline-none">
          <option value="todo">Дела</option>
          <option value="shopping">Покупки</option>
          <option value="custom">Другое</option>
        </select>
        <button disabled={!name.trim() || createMut.isPending} onClick={() => createMut.mutate()}
          className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50 glow">
          <Plus className="h-4 w-4" />Создать
        </button>
      </div>

      {q.isLoading ? (
        <p className="text-muted-foreground text-sm">Загрузка…</p>
      ) : (q.data ?? []).length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center">
          <ListChecks className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Списков пока нет. Создайте первый или наговорите в чат «купить молоко и хлеб».</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(q.data ?? []).map((l: any) => {
            const Icon = l.kind === "shopping" ? ShoppingCart : l.kind === "custom" ? Sparkles : ListChecks;
            const count = l.list_items?.[0]?.count ?? 0;
            return (
              <div key={l.id} className="glass rounded-2xl p-5 group hover:glow transition relative">
                <button onClick={() => del({ data: { id: l.id } }).then(() => qc.invalidateQueries({ queryKey: ["lists"] }))}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition">
                  <Trash2 className="h-4 w-4" />
                </button>
                <Link to="/lists/$id" params={{ id: l.id }} className="block">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                      {l.kind === "shopping" ? "покупки" : l.kind === "custom" ? "список" : "дела"}
                    </span>
                  </div>
                  <h3 className="font-display font-semibold text-lg mb-1">{l.name}</h3>
                  <p className="text-xs text-muted-foreground">{count} эл.</p>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
