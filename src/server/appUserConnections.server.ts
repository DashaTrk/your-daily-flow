import { encryptConnectionKey, decryptConnectionKey } from "@/server/connectionKeyCrypto";

export const GCAL_CONNECTOR_ID = "google_calendar";
export const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";

export async function saveConnectionKeyForUser(
  userId: string,
  connectorId: string,
  connectionAPIKey: string,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("app_user_connections").upsert(
    {
      user_id: userId,
      connector_id: connectorId,
      connection_key_ciphertext: encryptConnectionKey(connectionAPIKey),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,connector_id" },
  );
  if (error) throw error;
}

export async function getConnectionKeyForUser(userId: string, connectorId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("app_user_connections")
    .select("connection_key_ciphertext")
    .eq("user_id", userId)
    .eq("connector_id", connectorId)
    .maybeSingle();
  if (error) throw error;
  return data ? decryptConnectionKey(data.connection_key_ciphertext) : null;
}

export async function deleteConnectionForUser(userId: string, connectorId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("app_user_connections")
    .delete()
    .eq("user_id", userId)
    .eq("connector_id", connectorId);
}

/** Create a one-off (non-recurring) event in the user's primary Google Calendar. */
export async function createGoogleCalendarEvent(opts: {
  userId: string;
  title: string;
  startAt: string;
  durationMinutes: number;
  description?: string | null;
  timeZone?: string;
}): Promise<string | null> {
  const connectionAPIKey = await getConnectionKeyForUser(opts.userId, GCAL_CONNECTOR_ID);
  if (!connectionAPIKey) return null;

  const { callAsAppUser } = await import("@/integrations/lovable/appUserConnector");
  const start = new Date(opts.startAt);
  const end = new Date(start.getTime() + opts.durationMinutes * 60_000);
  const timeZone = opts.timeZone || "Europe/Moscow";

  const res = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey,
    connectorId: GCAL_CONNECTOR_ID,
    path: "/calendar/v3/calendars/primary/events",
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: opts.title,
        description: opts.description ?? undefined,
        start: { dateTime: start.toISOString(), timeZone },
        end: { dateTime: end.toISOString(), timeZone },
      }),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Google Calendar insert failed [${res.status}]: ${body}`);
    throw new Error(`Google Calendar: ${res.status} ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { id?: string };
  return json.id ?? null;
}
