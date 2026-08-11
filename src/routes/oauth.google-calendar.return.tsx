import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { completeGoogleCalendarConnection } from "@/lib/gcal.functions";

export const Route = createFileRoute("/oauth/google-calendar/return")({
  ssr: false,
  head: () => ({ meta: [{ title: "Подключение Google Календаря — Мой Ассистент" }] }),
  component: OAuthReturn,
});

function OAuthReturn() {
  const [message, setMessage] = useState("Завершаем подключение…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const notify = (type: "appUserConnectorOAuthComplete" | "appUserConnectorOAuthFailed") => {
      window.opener?.postMessage({ type, connectorId: "google_calendar" }, window.location.origin);
      window.close();
    };
    if (params.get("success") !== "true") {
      setMessage(params.get("error") ?? "Подключение не завершилось.");
      notify("appUserConnectorOAuthFailed");
      return;
    }
    const code = params.get("code");
    if (!code) {
      if (params.get("offline_access_allowed") === "false") { notify("appUserConnectorOAuthComplete"); return; }
      setMessage("OAuth завершился без кода обмена.");
      notify("appUserConnectorOAuthFailed");
      return;
    }
    void completeGoogleCalendarConnection({ data: { code } })
      .then(() => notify("appUserConnectorOAuthComplete"))
      .catch(() => {
        setMessage("Не удалось завершить подключение.");
        notify("appUserConnectorOAuthFailed");
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
