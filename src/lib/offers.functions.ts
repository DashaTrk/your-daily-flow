import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Moves cards from "got" to "working" once their start_date has arrived. */
async function autoPromote(supabase: any, userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  await supabase
    .from("offers")
    .update({ stage: "working" })
    .eq("user_id", userId)
    .eq("stage", "got")
    .not("start_date", "is", null)
    .lte("start_date", today);
}

export const listOffers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await autoPromote(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("offers")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const createOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        student_name: z.string().min(1),
        company: z.string().nullable().optional(),
        note: z.string().nullable().optional(),
        start_date: z.string().nullable().optional(),
        stage: z.enum(["maybe", "got", "working"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: o, error } = await context.supabase
      .from("offers")
      .insert({ ...data, stage: data.stage ?? "maybe", user_id: context.userId })
      .select()
      .single();
    if (error) throw error;
    return o;
  });

export const updateOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        student_name: z.string().min(1).optional(),
        company: z.string().nullable().optional(),
        note: z.string().nullable().optional(),
        start_date: z.string().nullable().optional(),
        stage: z.enum(["maybe", "got", "working"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { data: o, error } = await context.supabase
      .from("offers")
      .update(patch)
      .eq("id", id)
      .eq("user_id", context.userId)
      .select()
      .single();
    if (error) throw error;
    return o;
  });

export const toggleOfferTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), key: z.string().min(1), done: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: current, error: readErr } = await context.supabase
      .from("offers")
      .select("tasks")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();
    if (readErr) throw readErr;

    const tasks = { ...((current?.tasks as Record<string, string | null>) ?? {}) };
    if (data.done) tasks[data.key] = new Date().toISOString();
    else delete tasks[data.key];

    const { data: o, error } = await context.supabase
      .from("offers")
      .update({ tasks })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select()
      .single();
    if (error) throw error;
    return o;
  });

export const deleteOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("offers")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });
