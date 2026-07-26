import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// TASKS
export const listTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("tasks")
      .select("*").eq("user_id", context.userId).order("due_at", { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data ?? [];
  });

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    title: z.string().min(1), notes: z.string().nullable().optional(),
    due_at: z.string().nullable().optional(), priority: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: t, error } = await context.supabase.from("tasks")
      .insert({ ...data, user_id: context.userId, source: "manual" }).select().single();
    if (error) throw error;
    return t;
  });

export const toggleTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), done: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("tasks")
      .update({ done: data.done }).eq("id", data.id).eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("tasks").delete().eq("id", data.id).eq("user_id", context.userId);
    return { ok: true };
  });

// LISTS
export const listLists = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("lists")
      .select("*, list_items(count)").eq("user_id", context.userId).order("created_at", { ascending: false });
    return data ?? [];
  });

export const createList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    name: z.string().min(1), kind: z.string().optional(), color: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: l, error } = await context.supabase.from("lists")
      .insert({ ...data, user_id: context.userId, kind: data.kind ?? "custom" }).select().single();
    if (error) throw error;
    return l;
  });

export const deleteList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("lists").delete().eq("id", data.id).eq("user_id", context.userId);
    return { ok: true };
  });

export const getList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: list } = await context.supabase.from("lists")
      .select("*").eq("id", data.id).eq("user_id", context.userId).single();
    const { data: items } = await context.supabase.from("list_items")
      .select("*").eq("list_id", data.id).order("position", { ascending: true });
    return { list, items: items ?? [] };
  });

export const addListItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ list_id: z.string().uuid(), text: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: it, error } = await context.supabase.from("list_items")
      .insert({ list_id: data.list_id, user_id: context.userId, text: data.text }).select().single();
    if (error) throw error;
    return it;
  });

export const toggleItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), checked: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("list_items").update({ checked: data.checked })
      .eq("id", data.id).eq("user_id", context.userId);
    return { ok: true };
  });

export const deleteItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("list_items").delete().eq("id", data.id).eq("user_id", context.userId);
    return { ok: true };
  });

// CHAT
export const listChatMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("chat_messages")
      .select("*").eq("user_id", context.userId).order("created_at", { ascending: true }).limit(200);
    return data ?? [];
  });

export const clearChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.from("chat_messages").delete().eq("user_id", context.userId);
    return { ok: true };
  });

// REPORT TEMPLATES
export const listTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("report_templates")
      .select("*").eq("user_id", context.userId).order("created_at", { ascending: false });
    return data ?? [];
  });

export const upsertTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1), body: z.string().min(1),
  }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { data: t } = await context.supabase.from("report_templates")
        .update({ name: data.name, body: data.body })
        .eq("id", data.id).eq("user_id", context.userId).select().single();
      return t;
    }
    const { data: t } = await context.supabase.from("report_templates")
      .insert({ name: data.name, body: data.body, user_id: context.userId }).select().single();
    return t;
  });

export const deleteTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("report_templates").delete().eq("id", data.id).eq("user_id", context.userId);
    return { ok: true };
  });

export const listReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("reports")
      .select("*").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(100);
    return data ?? [];
  });

// REMINDERS
export const listReminders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("reminders")
      .select("*").eq("user_id", context.userId).order("remind_at", { ascending: true });
    return data ?? [];
  });

export const createReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    title: z.string().min(1), remind_at: z.string(),
    channels: z.array(z.string()).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.from("reminders")
      .insert({ ...data, user_id: context.userId, channels: data.channels ?? ["browser"] })
      .select().single();
    if (error) throw error;
    return r;
  });

// PROFILE
export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("profiles").select("*").eq("id", context.userId).maybeSingle();
    return data;
  });
