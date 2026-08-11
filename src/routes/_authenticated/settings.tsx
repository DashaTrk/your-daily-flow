import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, CalendarClock, LogOut, User } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { getGoogleCalendarStatus, startGoogleCalendarConnect, disconnectGoogleCalendar } from "@/lib/gcal.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Настройки — Мой Ассистент" }, { name: "description", content: "Уведомления, интеграции, профиль." }] }),
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
    if (p === "granted") { new Notification("Мой Ассистент", { body: "Уведомления включены ✨" }); toast.success("Готово"); }
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

      <GoogleCalendarSection />
    </div>
  );
}

function GoogleCalendarSection() {
  const [status, setStatus] = useState<{ configured: boolean; connected: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => getGoogleCalendarStatus().then(setStatus).catch(() => setStatus({ configured: false, connected: false }));
  useEffect(() => { void refresh(); }, []);

  function waitForOAuth(popup: Window) {
    return new Promise<void>((resolve, reject) => {
      let poll: number | undefined;
      const cleanup = () => { window.removeEventListener("message", onMessage); if (poll !== undefined) window.clearInterval(poll); };
      const onMessage = (event: MessageEvent) => {
        const type = event.data?.type;
        if (event.origin !== window.location.origin || event.data?.connectorId !== "google_calendar") return;
        if (type !== "appUserConnectorOAuthComplete" && type !== "appUserConnectorOAuthFailed") return;
        cleanup();
        if (type === "appUserConnectorOAuthComplete") { resolve(); return; }
        popup.close();
        reject(new Error("Не удалось подключить Google Календарь."));
      };
      window.addEventListener("message", onMessage);
      poll = window.setInterval(() => {
        if (!popup.closed) return;
        cleanup();
        reject(new Error("Окно закрыто до завершения подключения."));
      }, 500);
    });
  }

  async function connect() {
    const popup = window.open("", "lovable-oauth", "width=600,height=720");
    if (!popup) { toast.error("Разрешите всплывающие окна и попробуйте снова"); return; }
    setBusy(true);
    try {
      const { authorizationUrl } = await startGoogleCalendarConnect({
        data: { origin: window.location.origin },
      });

      const done = waitForOAuth(popup);
      popup.location.href = authorizationUrl;
      await done;
      await refresh();
      toast.success("Google Календарь подключён");
    } catch (e: any) {
      popup.close();
      toast.error(e?.message ?? "Ошибка подключения");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try { await disconnectGoogleCalendar(); await refresh(); toast.success("Отключено"); }
    catch (e: any) { toast.error(e?.message ?? "Ошибка"); }
    finally { setBusy(false); }
  }

  return (
    <section className="glass rounded-2xl p-5">
      <h2 className="font-display font-semibold flex items-center gap-2 mb-2"><CalendarClock className="h-4 w-4 text-secondary" />Google Календарь</h2>
      <p className="text-sm text-muted-foreground mb-4">
        События, которые вы диктуете ассистенту («внеси в календарь…»), будут создаваться в вашем личном Google Календаре.
      </p>
      {!status ? (
        <p className="text-sm text-muted-foreground">Проверяем статус…</p>
      ) : !status.configured ? (
        <p className="text-sm text-muted-foreground">Интеграция ещё не настроена в рабочем пространстве.</p>
      ) : status.connected ? (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-success">Подключено</span>
          <button onClick={disconnect} disabled={busy} className="text-sm bg-surface-2 hover:bg-surface border border-border rounded-lg px-4 py-2 disabled:opacity-60">Отключить</button>
          <button onClick={connect} disabled={busy} className="text-sm bg-surface-2 hover:bg-surface border border-border rounded-lg px-4 py-2 disabled:opacity-60">Переподключить</button>
        </div>
      ) : (
        <button onClick={connect} disabled={busy} className="text-sm bg-primary text-primary-foreground rounded-lg px-4 py-2 hover:bg-primary/90 glow disabled:opacity-60">
          {busy ? "Подключаем…" : "Подключить Google Календарь"}
        </button>
      )}
    </section>
  );
}
