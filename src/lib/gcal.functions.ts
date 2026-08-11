import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
const CONNECTOR_ID = "google_calendar";
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/calendar.events",
];

export const getGoogleCalendarStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getConnectionKeyForUser } = await import("@/server/appUserConnections.server");
    const configured = Boolean(process.env['GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY']);
    const key = configured ? await getConnectionKeyForUser(context.userId, CONNECTOR_ID) : null;
    return { configured, connected: Boolean(key) };
  });

export const startGoogleCalendarConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientAPIKey = process.env['GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY'];
    if (!clientAPIKey) throw new Error("Google Calendar connector client is not configured.");
    const request = getRequest();
    if (!request) throw new Error("OAuth must start from an app request.");
    const returnUrl = new URL("/oauth/google-calendar/return", request.url).toString();

    const { getConnectionKeyForUser } = await import("@/server/appUserConnections.server");
    const { authorizeAppUserOAuth } = await import("@/integrations/lovable/appUserConnector");
    const existing = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);

    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: CONNECTOR_ID,
      appUserId: context.userId,
      clientAPIKey,
      returnUrl,
      connectionAPIKey: existing ?? undefined,
      credentialsConfiguration: { scopes: GOOGLE_SCOPES },
    });
    return { authorizationUrl };
  });

export const completeGoogleCalendarConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => input)
  .handler(async ({ data, context }) => {
    const { exchangeAppUserOAuthCode } = await import("@/integrations/lovable/appUserConnector");
    const { saveConnectionKeyForUser } = await import("@/server/appUserConnections.server");
    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(GATEWAY_BASE_URL, data.code);
    if (connectorId !== CONNECTOR_ID) throw new Error("OAuth completion returned the wrong connector");
    await saveConnectionKeyForUser(context.userId, connectorId, connectionAPIKey);
    return { ok: true };
  });

export const disconnectGoogleCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getConnectionKeyForUser, deleteConnectionForUser } = await import(
      "@/server/appUserConnections.server"
    );
    const { disconnectAppUser } = await import("@/integrations/lovable/appUserConnector");
    const key = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    if (key) {
      try {
        await disconnectAppUser({
          gatewayBaseUrl: GATEWAY_BASE_URL,
          connectionAPIKey: key,
          connectorId: CONNECTOR_ID,
        });
      } catch (e) {
        console.error("Gateway disconnect failed", e);
      }
    }
    await deleteConnectionForUser(context.userId, CONNECTOR_ID);
    return { ok: true };
  });
