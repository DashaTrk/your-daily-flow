import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Copy, Check, Send, Archive, Flag } from "lucide-react";
import {
  addDigestEntry,
  deleteDigestEntry,
  getDigestBoard,
  listDigestReports,
  markDigestSent,
  setDigestWeek,
} from "@/lib/digest.functions";
import {
  DIGEST_SECTIONS,
  TRACKS,
  renderDigest,
  weekRangeLabel,
  type DigestEntry,
  type Track,
} from "@/lib/digest-shared";

const trackStyles: Record<string, string> = {
  Java: "border-orange-400/40 bg-orange-400/10 text-orange-300",
  "C#": "border-primary/40 bg-primary/10 text-primary",
  Golang: "border-secondary/40 bg-secondary/10 text-secondary",
};

/** Renders **bold** markers as real bold text. */
function RichLine({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i} className="font-semibold text-foreground">
            {p.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function DigestPanel() {
  const qc = useQueryClient();
  const fetchBoard = useServerFn(getDigestBoard);
  const fetchArchive = useServerFn(listDigestReports);
  const add = useServerFn(addDigestEntry);
  const del = useServerFn(deleteDigestEntry);
  const setWeek = useServerFn(setDigestWeek);
  const send = useServerFn(markDigestSent);

  const boardQ = useQuery({ queryKey: ["digest"], queryFn: () => fetchBoard() });
  const archQ = useQuery({ queryKey: ["digest-archive"], queryFn: () => fetchArchive() });

  const [track, setTrack] = useState<Track>("Java");
  const [showArchive, setShowArchive] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState({ section: DIGEST_SECTIONS[0].key as string, student_name: "", comment: "", flagged: false });

  const weekStart: string = boardQ.data?.weeks?.[track] ?? "";
  const entries = useMemo(
    () => ((boardQ.data?.entries ?? []) as DigestEntry[]).filter((e) => e.track === track),
    [boardQ.data, track],
  );
  const text = weekStart ? renderDigest(track, weekStart, entries) : "";

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["digest"] });
    qc.invalidateQueries({ queryKey: ["digest-archive"] });
  };

  const addMut = useMutation({
    mutationFn: async () =>
      add({ data: { track, section: form.section as any, student_name: form.student_name.trim(), comment: form.comment.trim(), flagged: form.flagged } }),
    onSuccess: () => {
      setForm({ section: form.section, student_name: "", comment: "", flagged: false });
      refresh();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const sendMut = useMutation({
    mutationFn: async () => send({ data: { track } }),
    onSuccess: () => {
      refresh();
      toast.success("Отчёт отправлен и перенесён в архив");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const copy = (id: string, value: string) => {
    navigator.clipboard.writeText(value.replace(/\*\*/g, ""));
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {TRACKS.map((t) => (
          <button
            key={t}
            onClick={() => setTrack(t)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
              track === t ? trackStyles[t] : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
        <button
          onClick={() => setShowArchive((v) => !v)}
          className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Archive className="h-3.5 w-3.5" />
          {showArchive ? "К дайджесту" : `Архив (${archQ.data?.length ?? 0})`}
        </button>
      </div>

      {showArchive ? (
        <section className="space-y-3">
          {(archQ.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Архив пока пуст.</p>}
          {(archQ.data ?? []).map((r: any) => (
            <div key={r.id} className="glass rounded-2xl p-5">
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h3 className="font-semibold">
                  {r.track} · {weekRangeLabel(r.week_start)}
                </h3>
                <button onClick={() => copy(r.id, r.content)} className="flex items-center gap-1 text-xs text-secondary hover:underline">
                  {copied === r.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied === r.id ? "скопировано" : "копировать"}
                </button>
              </div>
              <div className="whitespace-pre-wrap text-sm text-foreground/90">
                {r.content.split("\n").map((l: string, i: number) => (
                  <div key={i}>{l ? <RichLine text={l} /> : <br />}</div>
                ))}
              </div>
            </div>
          ))}
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Editor */}
          <section className="glass rounded-2xl p-5 space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Неделя (понедельник)</label>
              <input
                type="date"
                value={weekStart}
                onChange={(e) =>
                  setWeek({ data: { track, week_start: e.target.value } }).then(refresh)
                }
                className="mt-1 w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-2 rounded-xl bg-surface-2/60 p-3">
              <div>
                <p className="mb-1.5 text-xs uppercase tracking-wide text-muted-foreground">Раздел отчёта</p>
                <div className="flex flex-wrap gap-1.5">
                  {DIGEST_SECTIONS.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setForm({ ...form, section: s.key })}
                      className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                        form.section === s.key
                          ? "border-primary/50 bg-primary/15 text-primary"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {s.title.replace(":", "")}
                    </button>
                  ))}
                </div>
              </div>

              <input
                value={form.student_name}
                onChange={(e) => setForm({ ...form, student_name: e.target.value })}
                placeholder="Фамилия Имя"
                className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <textarea
                value={form.comment}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
                placeholder="Комментарий"
                rows={2}
                className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setForm({ ...form, flagged: !form.flagged })}
                  className={`flex items-center gap-1.5 text-xs ${form.flagged ? "text-destructive" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Flag className="h-3.5 w-3.5" /> особое внимание
                </button>
                <button
                  disabled={!form.student_name.trim() || addMut.isPending}
                  onClick={() => addMut.mutate()}
                  className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" /> Добавить
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {DIGEST_SECTIONS.map((s) => {
                const rows = entries.filter((e) => e.section === s.key);
                if (!rows.length) return null;
                return (
                  <div key={s.key}>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {s.title.replace(":", "")}
                    </p>
                    <ul className="space-y-1">
                      {rows.map((r) => (
                        <li key={r.id} className="group flex items-start gap-2 rounded-lg bg-surface-2/50 px-3 py-2">
                          <span className="flex-1 text-sm">
                            <span className="font-medium">{r.student_name}</span>
                            {r.comment ? <span className="text-foreground/80"> — {r.comment}</span> : null}
                            {r.flagged ? <span className="ml-1">🔴</span> : null}
                          </span>
                          <button
                            onClick={() => del({ data: { id: r.id } }).then(refresh)}
                            className="text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              {entries.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Записей нет. Добавьте вручную или напишите ассистенту: «Полина Бабякина пропуск декларации Java в дайджест».
                </p>
              )}
            </div>
          </section>

          {/* Preview */}
          <section className="glass rounded-2xl p-5 flex flex-col">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display font-semibold">Готовый текст</h3>
              <button onClick={() => copy("current", text)} className="flex items-center gap-1 text-xs text-secondary hover:underline">
                {copied === "current" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied === "current" ? "скопировано" : "копировать"}
              </button>
            </div>
            <div className="flex-1 whitespace-pre-wrap rounded-xl bg-surface-2/50 p-4 text-sm text-foreground/90">
              {text.split("\n").map((l, i) => (
                <div key={i}>{l ? <RichLine text={l} /> : <br />}</div>
              ))}
            </div>
            <button
              disabled={entries.length === 0 || sendMut.isPending}
              onClick={() => sendMut.mutate()}
              className="glow mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" /> Отчёт отправлен
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
