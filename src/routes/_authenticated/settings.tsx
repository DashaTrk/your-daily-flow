import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, CalendarClock, LogOut, User } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Настройки — Flow" }, { name: "description", content: "Уведомления, интеграции, профиль." }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  async function requestPerm() {
    if (typeof Notification === "undefined") { toast.error("Ваш браузер не поддерживает уведомления"); return; }
    const p = await Notification.requestPermission();
    setPermission(p);
    if (p === "granted") { new Notification("Flow", { body: "Уведомления включены ✨" }); toast.success("Готово"); }
  }

  async function signOut() {
    await supabase.auth.signOut(); navigate({ to: "/auth" });
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Настройки</h1>
        <p className="text-sm text-muted-foreground">Аккаунт, уведомления, интеграции.</p>
      </header>

      <section className="glass rounded-2xl p-5">
        <h2 className="font-display font-semibold flex items-center gap-2 mb-4"><User className="h-4 w-4 text-secondary" />Аккаунт</h2>
        <p className="text-sm text-muted-foreground mb-1">Вы вошли как</p>
        <p className="font-mono text-sm mb-4">{email}</p>
        <button onClick={signOut} className="text-sm bg-surface-2 hover:bg-surface border border-border rounded-lg px-4 py-2 flex items-center gap-2">
          <LogOut className="h-4 w-4" />Выйти
        </button>
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="font-display font-semibold flex items-center gap-2 mb-4"><Bell className="h-4 w-4 text-secondary" />Уведомления</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Разрешение браузера: <span className="font-mono text-foreground">{permission}</span>
        </p>
        {permission !== "granted" ? (
          <button onClick={requestPerm} className="text-sm bg-primary text-primary-foreground rounded-lg px-4 py-2 hover:bg-primary/90 glow">
            Разрешить уведомления
          </button>
        ) : (
          <p className="text-sm text-success">Уведомления браузера включены.</p>
        )}
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="font-display font-semibold flex items-center gap-2 mb-2"><CalendarClock className="h-4 w-4 text-secondary" />Google Календарь</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Синхронизация событий с личным Google Календарём. Требуется подключение через App User Connector — я подскажу шаги.
        </p>
        <button disabled className="text-sm bg-surface-2 border border-border rounded-lg px-4 py-2 opacity-70">
          Подключение будет доступно после настройки OAuth-клиента
        </button>
      </section>
    </div>
  );
}
