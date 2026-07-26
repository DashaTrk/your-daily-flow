import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getList, addListItem, toggleItem, deleteItem } from "@/lib/data.functions";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Trash2, Check, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/lists/$id")({
  head: () => ({ meta: [{ title: "Список — Flow" }, { name: "description", content: "Элементы списка." }] }),
  component: ListDetail,
});

function ListDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const fetch = useServerFn(getList);
  const add = useServerFn(addListItem);
  const toggle = useServerFn(toggleItem);
  const del = useServerFn(deleteItem);
  const q = useQuery({ queryKey: ["list", id], queryFn: () => fetch({ data: { id } }) });
  const [text, setText] = useState("");

  const addMut = useMutation({
    mutationFn: async () => add({ data: { list_id: id, text } }),
    onSuccess: () => { setText(""); qc.invalidateQueries({ queryKey: ["list", id] }); qc.invalidateQueries({ queryKey: ["lists"] }); },
  });

  const list = q.data?.list;
  const items = q.data?.items ?? [];

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <Link to="/lists" className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 mb-4">
        <ChevronLeft className="h-4 w-4" />Все списки
      </Link>
      <header className="mb-6">
        <h1 className="text-3xl font-bold">{list?.name ?? "…"}</h1>
        <p className="text-sm text-muted-foreground">{items.length} элементов</p>
      </header>

      <div className="glass rounded-2xl p-3 flex gap-2 mb-4">
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Добавить элемент…"
          onKeyDown={e => e.key === "Enter" && text.trim() && addMut.mutate()}
          className="flex-1 bg-transparent px-3 py-2 text-sm outline-none" />
        <button disabled={!text.trim() || addMut.isPending} onClick={() => addMut.mutate()}
          className="bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1 glow">
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-center text-muted-foreground text-sm py-10">Пусто. Добавьте первый элемент.</p>
      ) : (
        <ul className="glass rounded-2xl divide-y divide-border">
          {items.map((it: any) => (
            <li key={it.id} className="group flex items-center gap-3 p-3">
              <button onClick={() => toggle({ data: { id: it.id, checked: !it.checked } }).then(() => qc.invalidateQueries({ queryKey: ["list", id] }))}
                className={`h-5 w-5 shrink-0 rounded-md border flex items-center justify-center ${
                  it.checked ? "bg-primary border-primary" : "border-border hover:border-primary"
                }`}>
                {it.checked && <Check className="h-3 w-3 text-primary-foreground" />}
              </button>
              <span className={`flex-1 text-sm ${it.checked ? "line-through text-muted-foreground" : ""}`}>{it.text}</span>
              <button onClick={() => del({ data: { id: it.id } }).then(() => qc.invalidateQueries({ queryKey: ["list", id] }))}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
