import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/oauth/google-calendar/return")({
  ssr: false,
  head: () => ({ meta: [{ title: "Подключение Google Календаря — Мой Ассистент" }] }),
  component: OAuthReturn,
});

function OAuthReturn() {
  const [message, setMessage] = useState("Завершаем подключение…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const post = (payload: Record<string, unknown>) => {
      window.opener?.postMessage(
        { connectorId: "google_calendar", ...payload },
        window.location.origin,
      );
      window.close();
    };

    if (params.get("success") !== "true") {
      setMessage(params.get("error") ?? "Подключение не завершилось.");
      post({ type: "appUserConnectorOAuthFailed" });
      return;
    }
    const code = params.get("code");
    if (!code) {
      if (params.get("offline_access_allowed") === "false") {
        post({ type: "appUserConnectorOAuthComplete" });
        return;
      }
      setMessage("OAuth завершился без кода обмена.");
      post({ type: "appUserConnectorOAuthFailed" });
      return;
    }
    // The popup has no access to the app session in the sandboxed preview,
    // so the opener performs the authenticated code exchange.
    setMessage("Готово, можно закрыть окно.");
    post({ type: "appUserConnectorOAuthCode", code });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
