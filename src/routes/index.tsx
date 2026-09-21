import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const go = (to: "/today" | "/auth") => {
      if (!cancelled) navigate({ to, replace: true });
    };
    // Never let a hanging/failing session lookup leave a blank screen.
    const fallback = setTimeout(() => go("/auth"), 5000);
    supabase.auth
      .getUser()
      .then(({ data }) => {
        clearTimeout(fallback);
        go(data.user ? "/today" : "/auth");
      })
      .catch(() => {
        clearTimeout(fallback);
        go("/auth");
      });
    return () => {
      cancelled = true;
      clearTimeout(fallback);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <div className="h-10 w-10 rounded-xl glass glow flex items-center justify-center animate-pulse">
        <Sparkles className="h-5 w-5 text-primary" />
      </div>
      <p className="text-sm text-muted-foreground">Загружаем…</p>
    </div>
  );
}
