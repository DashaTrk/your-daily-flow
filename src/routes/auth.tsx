import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Вход — Мой Ассистент" },
      { name: "description", content: "Вход в личный трекер Мой Ассистент." },
    ],
  }),
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (data.user) { navigate({ to: "/today" }); return; }
      // Stale/invalid session in storage breaks new sign-ins — clear it locally.
      if (error) supabase.auth.signOut({ scope: "local" }).catch(() => {});
    }).catch(() => {});
  }, [navigate]);


  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin, data: { display_name: name } },
        });
        if (error) throw error;
        toast.success("Аккаунт создан! Заходите.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/today" });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Ошибка");
    } finally { setLoading(false); }
  }

  async function google() {
    setLoading(true);
    try {
      // Drop any stale local session first: a dead refresh token makes the
      // client spam /token and can break the fresh OAuth session.
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (res.error) throw res.error;
      if (!res.redirected) {
        const { data } = await supabase.auth.getUser();
        if (!data.user) throw new Error("Сессия не установилась, попробуйте ещё раз");
        navigate({ to: "/today" });
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Не удалось войти через Google");
    } finally { setLoading(false); }
  }


  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="h-10 w-10 rounded-xl glass glow flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <span className="font-display text-2xl font-bold text-gradient">Мой Ассистент</span>
        </Link>

        <div className="glass rounded-2xl p-8">
          <h1 className="text-2xl font-bold mb-1">{mode === "signin" ? "С возвращением" : "Создать аккаунт"}</h1>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === "signin" ? "Войдите, чтобы продолжить" : "Пара шагов — и вперёд"}
          </p>

          <button onClick={google} disabled={loading}
            className="w-full rounded-lg border border-border bg-surface-2 hover:bg-surface py-2.5 px-4 text-sm font-medium flex items-center justify-center gap-2 transition mb-4">
            <GoogleIcon /> Продолжить с Google
          </button>

          <div className="flex items-center gap-3 my-4">
            <div className="h-px bg-border flex-1" />
            <span className="text-xs text-muted-foreground">или email</span>
            <div className="h-px bg-border flex-1" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <input type="text" placeholder="Как к вам обращаться" value={name} onChange={e => setName(e.target.value)}
                className="w-full rounded-lg bg-input/40 border border-border px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" />
            )}
            <input type="email" required placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full rounded-lg bg-input/40 border border-border px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" />
            <input type="password" required minLength={6} placeholder="Пароль" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full rounded-lg bg-input/40 border border-border px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" />
            <button disabled={loading} type="submit"
              className="w-full rounded-lg bg-primary text-primary-foreground font-medium py-2.5 hover:bg-primary/90 disabled:opacity-60 transition glow">
              {loading ? "..." : mode === "signin" ? "Войти" : "Создать аккаунт"}
            </button>
          </form>

          <button onClick={() => setMode(m => m === "signin" ? "signup" : "signin")}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground mt-4 transition">
            {mode === "signin" ? "Нет аккаунта? Создать" : "Уже есть аккаунт? Войти"}
          </button>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.4l6.7-6.7C35.6 2.4 30.2 0 24 0 14.7 0 6.6 5.4 2.6 13.3l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.7c-.6 3-2.3 5.6-4.9 7.3l7.6 5.9c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-2.9-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.4 0 20 0 24s1 7.6 2.6 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.6 42.6 14.7 48 24 48z"/></svg>
  );
}
