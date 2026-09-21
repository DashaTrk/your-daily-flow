import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Новый пароль — Мой Ассистент" },
      { name: "description", content: "Установите новый пароль для входа в Мой Ассистент." },
    ],
  }),
  ssr: false,
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (active && data.session) setReady(true);
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) setReady(true);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Пароли не совпадают");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Пароль обновлён");
      navigate({ to: "/today" });
    } catch (err: any) {
      toast.error(err?.message ?? "Не удалось обновить пароль");
    } finally {
      setLoading(false);
    }
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
          <h1 className="text-2xl font-bold mb-1">Новый пароль</h1>
          <p className="text-sm text-muted-foreground mb-6">
            {ready
              ? "Придумайте новый пароль для входа."
              : "Откройте эту страницу по ссылке из письма — тогда можно задать пароль."}
          </p>

          <form onSubmit={submit} className="space-y-3">
            <input
              type="password"
              required
              minLength={6}
              placeholder="Новый пароль"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-lg bg-input/40 border border-border px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
            <input
              type="password"
              required
              minLength={6}
              placeholder="Повторите пароль"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="w-full rounded-lg bg-input/40 border border-border px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
            <button
              disabled={loading || !ready}
              type="submit"
              className="w-full rounded-lg bg-primary text-primary-foreground font-medium py-2.5 hover:bg-primary/90 disabled:opacity-60 transition glow"
            >
              {loading ? "..." : "Сохранить пароль"}
            </button>
          </form>

          <Link
            to="/auth"
            className="block w-full text-center text-sm text-muted-foreground hover:text-foreground mt-4 transition"
          >
            Вернуться ко входу
          </Link>
        </div>
      </div>
    </div>
  );
}
