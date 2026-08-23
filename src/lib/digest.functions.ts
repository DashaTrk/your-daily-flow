import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { addDaysISO, mondayOf, renderDigest, SECTION_KEYS, TRACKS } from "@/lib/digest-shared";

const trackSchema = z.enum(TRACKS);
const sectionSchema = z.enum(SECTION_KEYS as [string, ...string[]]);

export const getDigestBoard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: weeks } = await supabase.from("digest_weeks").select("*").eq("user_id", userId);
    const weekByTrack: Record<string, string> = {};
    for (const t of TRACKS) {
      weekByTrack[t] = weeks?.find((w: any) => w.track === t)?.week_start ?? mondayOf();
    }

    const { data: entries, error } = await supabase
      .from("digest_entries")
      .select("*")
      .eq("user_id", userId)
      .is("archived_at", null)
      .order("created_at", { ascending: true });
    if (error) throw error;

    return { weeks: weekByTrack, entries: entries ?? [] };
  });

export const setDigestWeek = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ track: trackSchema, week_start: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("digest_weeks")
      .upsert(
        { user_id: context.userId, track: data.track, week_start: data.week_start },
        { onConflict: "user_id,track" },
      );
    if (error) throw error;
    return { ok: true };
  });

export const addDigestEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        track: trackSchema,
        section: sectionSchema,
        student_name: z.string().min(1),
        comment: z.string().default(""),
        flagged: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: wk } = await supabase
      .from("digest_weeks")
      .select("week_start")
      .eq("user_id", userId)
      .eq("track", data.track)
      .maybeSingle();
    const weekStart = wk?.week_start ?? mondayOf();

    const { data: row, error } = await supabase
      .from("digest_entries")
      .insert({ ...data, user_id: userId, week_start: weekStart })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const updateDigestEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        section: sectionSchema.optional(),
        student_name: z.string().min(1).optional(),
        comment: z.string().optional(),
        flagged: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { data: row, error } = await context.supabase
      .from("digest_entries")
      .update(patch)
      .eq("id", id)
      .eq("user_id", context.userId)
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deleteDigestEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("digest_entries")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

/** Archives the current digest for a track and rolls the week forward by 7 days. */
export const markDigestSent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ track: trackSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: wk } = await supabase
      .from("digest_weeks")
      .select("week_start")
      .eq("user_id", userId)
      .eq("track", data.track)
      .maybeSingle();
    const weekStart = wk?.week_start ?? mondayOf();

    const { data: entries } = await supabase
      .from("digest_entries")
      .select("*")
      .eq("user_id", userId)
      .eq("track", data.track)
      .is("archived_at", null)
      .order("created_at", { ascending: true });

    const content = renderDigest(data.track, weekStart, (entries ?? []) as any);

    const { data: report, error } = await supabase
      .from("digest_reports")
      .insert({
        user_id: userId,
        track: data.track,
        week_start: weekStart,
        week_end: addDaysISO(weekStart, 6),
        content,
      })
      .select()
      .single();
    if (error) throw error;

    await supabase
      .from("digest_entries")
      .update({ archived_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("track", data.track)
      .is("archived_at", null);

    await supabase
      .from("digest_weeks")
      .upsert(
        { user_id: userId, track: data.track, week_start: addDaysISO(weekStart, 7) },
        { onConflict: "user_id,track" },
      );

    return report;
  });

export const listDigestReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("digest_reports")
      .select("*")
      .eq("user_id", context.userId)
      .order("sent_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });
