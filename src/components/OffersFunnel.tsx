import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Trash2, Check, ChevronLeft, ChevronRight, Loader2, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { fmtDate } from "@/lib/date-utils";
import { STAGES, STAGE_ORDER, type StageKey } from "@/lib/offer-stages";
import {
  listOffers,
  createOffer,
  updateOffer,
  toggleOfferTask,
  deleteOffer,
} from "@/lib/offers.functions";

export const TRACKS = ["C#", "Java", "Golang"] as const;
export type TrackKey = (typeof TRACKS)[number];

const TRACK_STYLES: Record<TrackKey, string> = {
  "C#": "border-primary/50 bg-primary/15 text-primary",
  Java: "border-secondary/50 bg-secondary/15 text-secondary",
  Golang: "border-success/50 bg-success/15 text-success",
};

export function OffersFunnel() {
  const qc = useQueryClient();
  const fetchOffers = useServerFn(listOffers);
  const add = useServerFn(createOffer);
  const upd = useServerFn(updateOffer);
  const toggle = useServerFn(toggleOfferTask);
  const del = useServerFn(deleteOffer);

  const offersQ = useQuery({ queryKey: ["offers"], queryFn: () => fetchOffers() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["offers"] });

  const [adding, setAdding] = useState<StageKey | null>(null);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [track, setTrack] = useState<TrackKey | null>(null);

  const addMut = useMutation({
    mutationFn: async (stage: StageKey) =>
      add({ data: { student_name: name.trim(), company: company.trim() || null, track, stage } }),
    onSuccess: () => {
      setName("");
      setCompany("");
      setTrack(null);
      setAdding(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: async (v: { id: string; key: string; done: boolean }) => toggle({ data: v }),
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message),
  });

  const updMut = useMutation({
    mutationFn: async (v: { id: string; stage?: StageKey; start_date?: string | null; track?: TrackKey | null }) =>
      upd({ data: v }),
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => del({ data: { id } }),
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message),
  });

  const offers = (offersQ.data ?? []) as any[];

  return (
    <section className="space-y-4">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Офферы</h2>
          <p className="text-sm text-muted-foreground">
            Воронка учеников — от первых новостей до выхода на работу. Можно добавлять здесь или
            через ассистента: «Владислав Орехов получил оффер Java».
          </p>
        </div>
        {offersQ.isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </header>

      {/* Воронка: этапы идут слева направо */}
      <div className="grid gap-4 md:grid-cols-3 items-start">
        {STAGES.map((stage) => {
          const stageOffers = offers.filter((o) => o.stage === stage.key);
          return (
            <div key={stage.key} className="w-full space-y-3">
              {/* Заголовок этапа — равная рамка */}
              <div className="rounded-xl border border-border bg-surface-2/60 p-3 h-20 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm leading-tight truncate">{stage.title}</h3>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground mt-0.5">
                    {stage.hint} · {stageOffers.length}
                  </p>
                </div>
                <button
                  onClick={() => setAdding(adding === stage.key ? null : stage.key)}
                  className="shrink-0 rounded-lg bg-primary/15 text-primary p-1.5 hover:bg-primary/25"
                  aria-label="Добавить ученика"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              {adding === stage.key && (
                <div className="space-y-2 rounded-xl bg-surface-2/60 p-3 border border-border">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Имя ученика"
                    className="w-full bg-input/40 rounded-lg px-3 py-2 text-sm outline-none border border-border focus:border-primary"
                  />
                  <input
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Компания / направление"
                    className="w-full bg-input/40 rounded-lg px-3 py-2 text-sm outline-none border border-border focus:border-primary"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {TRACKS.map((t) => (
                      <button
                        key={t}
                        onClick={() => setTrack(track === t ? null : t)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold border transition ${
                          track === t ? TRACK_STYLES[t] : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setAdding(null)}
                      className="text-sm px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground"
                    >
                      Отмена
                    </button>
                    <button
                      disabled={!name.trim() || addMut.isPending}
                      onClick={() => addMut.mutate(stage.key)}
                      className="text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
                    >
                      Добавить
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                  {stageOffers.length === 0 && (
                    <p className="text-xs text-muted-foreground py-6 text-center">Пусто</p>
                  )}
                  {stageOffers.map((o) => {
                    const tasks = (o.tasks ?? {}) as Record<string, string>;
                    const doneCount = stage.tasks.filter((t) => tasks[t.key]).length;
                    const stageIdx = STAGE_ORDER.indexOf(o.stage);
                    return (
                      <article key={o.id} className="group rounded-xl bg-surface-2/60 border border-border p-3">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{o.student_name}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-1">
                              {TRACKS.map((t) => {
                                const active = o.track === t;
                                return (
                                  <button
                                    key={t}
                                    onClick={() =>
                                      updMut.mutate({ id: o.id, track: active ? null : t })
                                    }
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border transition ${
                                      active
                                        ? TRACK_STYLES[t]
                                        : "border-border text-muted-foreground/60 hover:text-foreground"
                                    } ${o.track && !active ? "hidden group-hover:inline-flex" : ""}`}
                                  >
                                    {t}
                                  </button>
                                );
                              })}
                            </div>
                            {o.company && (
                              <p className="mt-1 text-xs text-muted-foreground truncate">{o.company}</p>
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                            {doneCount}/{stage.tasks.length}
                          </span>
                          <button
                            onClick={() => delMut.mutate(o.id)}
                            className="opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-destructive"
                            aria-label="Удалить"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <ul className="mt-3 space-y-1.5">
                          {stage.tasks.map((t) => {
                            const at = tasks[t.key];
                            return (
                              <li key={t.key}>
                                <button
                                  onClick={() => toggleMut.mutate({ id: o.id, key: t.key, done: !at })}
                                  className="w-full flex items-start gap-2 text-left group/task"
                                >
                                  <span
                                    className={`mt-0.5 h-4 w-4 shrink-0 rounded-md border flex items-center justify-center transition ${
                                      at
                                        ? "bg-success/20 border-success text-success"
                                        : "border-border text-transparent group-hover/task:border-primary"
                                    }`}
                                  >
                                    <Check className="h-3 w-3" />
                                  </span>
                                  <span className="min-w-0">
                                    <span
                                      className={`block text-xs leading-snug ${
                                        at ? "text-muted-foreground line-through" : "text-foreground/90"
                                      }`}
                                    >
                                      {t.label}
                                    </span>
                                    {at && (
                                      <span className="block text-[10px] font-mono text-success/80 mt-0.5">
                                        {fmtDate(at)}
                                      </span>
                                    )}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>

                        {(stage.key === "got" || o.start_date) && (
                          <label className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                            <CalendarDays className="h-3.5 w-3.5 text-secondary shrink-0" />
                            <span className="shrink-0">Дата выхода</span>
                            <input
                              type="date"
                              value={o.start_date ?? ""}
                              onChange={(e) =>
                                updMut.mutate({ id: o.id, start_date: e.target.value || null })
                              }
                              className="flex-1 min-w-0 bg-input/40 rounded-md px-2 py-1 text-xs border border-border focus:border-primary outline-none"
                            />
                          </label>
                        )}

                        <div className="mt-3 flex items-center justify-between">
                          <button
                            disabled={stageIdx <= 0}
                            onClick={() => updMut.mutate({ id: o.id, stage: STAGE_ORDER[stageIdx - 1] })}
                            className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-30 flex items-center gap-0.5"
                          >
                            <ChevronLeft className="h-3 w-3" />
                            назад
                          </button>
                          <button
                            disabled={stageIdx >= STAGE_ORDER.length - 1}
                            onClick={() => updMut.mutate({ id: o.id, stage: STAGE_ORDER[stageIdx + 1] })}
                            className="text-[11px] text-primary hover:underline disabled:opacity-30 flex items-center gap-0.5"
                          >
                            дальше
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }
