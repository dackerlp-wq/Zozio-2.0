"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email/send";
import { NewCommentEmail } from "@/lib/email/templates/new-comment";

const ANON_COOKIE = "zoz_anon";

type Source = "shelter" | "zozio";

function colFor(source: Source): "content_item_id" | "magazine_post_id" {
  return source === "shelter" ? "content_item_id" : "magazine_post_id";
}

/** Vrátí (a případně založí) anonymní token návštěvníka pro idempotentní líbí. */
async function getAnonToken(create: boolean): Promise<string | null> {
  const jar = await cookies();
  const existing = jar.get(ANON_COOKIE)?.value;
  if (existing) return existing;
  if (!create) return null;
  const token = randomUUID();
  jar.set(ANON_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return token;
}

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export interface ToggleResult {
  liked: boolean;
  count: number;
}

/** Přepne líbí u článku (přihlášený přes user_id, host přes anon token). Idempotentní. */
export async function toggleArticleLike(input: {
  source: Source;
  id: string;
}): Promise<ToggleResult> {
  const service = createServiceClient();
  const col = colFor(input.source);
  const userId = await currentUserId();
  const anon = userId ? null : await getAnonToken(true);
  if (!userId && !anon) return { liked: false, count: 0 };

  const match = service.from("article_likes").select("id").eq(col, input.id);
  const { data: existing } = userId
    ? await match.eq("user_id", userId).maybeSingle()
    : await match.eq("anon_token", anon!).maybeSingle();

  if (existing) {
    await service.from("article_likes").delete().eq("id", (existing as { id: string }).id);
  } else {
    await service.from("article_likes").insert({
      content_item_id: input.source === "shelter" ? input.id : null,
      magazine_post_id: input.source === "zozio" ? input.id : null,
      user_id: userId,
      anon_token: userId ? null : anon,
    });
  }

  const { count } = await service
    .from("article_likes")
    .select("id", { count: "exact", head: true })
    .eq(col, input.id);

  return { liked: !existing, count: count ?? 0 };
}

/** Přepne líbí u komentáře + přepočítá like_count. */
export async function toggleCommentLike(commentId: string): Promise<ToggleResult> {
  const service = createServiceClient();
  const userId = await currentUserId();
  const anon = userId ? null : await getAnonToken(true);
  if (!userId && !anon) return { liked: false, count: 0 };

  const match = service.from("comment_likes").select("id").eq("comment_id", commentId);
  const { data: existing } = userId
    ? await match.eq("user_id", userId).maybeSingle()
    : await match.eq("anon_token", anon!).maybeSingle();

  if (existing) {
    await service.from("comment_likes").delete().eq("id", (existing as { id: string }).id);
  } else {
    await service.from("comment_likes").insert({
      comment_id: commentId,
      user_id: userId,
      anon_token: userId ? null : anon,
    });
  }

  const { count } = await service
    .from("comment_likes")
    .select("id", { count: "exact", head: true })
    .eq("comment_id", commentId);

  const likeCount = count ?? 0;
  await service.from("article_comments").update({ like_count: likeCount }).eq("id", commentId);

  return { liked: !existing, count: likeCount };
}

export type CommentResult =
  | { ok: true; status: "approved" | "pending" }
  | { error: string };

/** Přidá komentář. Přihlášený → approved, host → pending. Antispam: honeypot, rate limit, duplicity. */
export async function submitComment(input: {
  source: Source;
  id: string;
  parentId?: string | null;
  body: string;
  guestName?: string;
  website?: string; // honeypot
  revalidate?: string;
}): Promise<CommentResult> {
  // Honeypot — boti vyplní skryté pole; tváříme se úspěšně, ale nic neukládáme.
  if (input.website && input.website.trim()) return { ok: true, status: "pending" };

  const body = (input.body ?? "").trim();
  if (body.length < 2) return { error: "Napiš prosím komentář." };
  if (body.length > 2000) return { error: "Komentář je příliš dlouhý (max 2000 znaků)." };

  const col = colFor(input.source);
  const service = createServiceClient();
  const userId = await currentUserId();

  // Host musí uvést jméno.
  const guestName = (input.guestName ?? "").trim();
  if (!userId && guestName.length < 2) return { error: "Vyplň prosím své jméno." };

  // Identita pro rate limit / duplicity.
  const anon = userId ? null : await getAnonToken(true);

  // Rate limit — max 5 komentářů za 10 minut z jedné identity.
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const rl = service.from("article_comments").select("id", { count: "exact", head: true }).gte("created_at", since);
  const { count: recent } = userId
    ? await rl.eq("user_id", userId)
    : await rl.eq("guest_name", guestName);
  if ((recent ?? 0) >= 5) {
    return { error: "Příliš mnoho komentářů za krátkou dobu. Zkus to prosím později." };
  }

  // Kontrola duplicit — stejný text na stejném článku za poslední hodinu.
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const { data: dup } = await service
    .from("article_comments")
    .select("id")
    .eq(col, input.id)
    .eq("body", body)
    .gte("created_at", hourAgo)
    .limit(1);
  if (dup && dup.length > 0) return { error: "Tenhle komentář už jsi přidal." };

  const status: "approved" | "pending" = userId ? "approved" : "pending";

  const { error } = await service.from("article_comments").insert({
    content_item_id: input.source === "shelter" ? input.id : null,
    magazine_post_id: input.source === "zozio" ? input.id : null,
    parent_id: input.parentId ?? null,
    user_id: userId,
    guest_name: userId ? null : guestName,
    body,
    status,
  });
  if (error) return { error: "Komentář se nepodařilo uložit." };

  // Notifikace autora článku (jen u článků útulku — má e-mail).
  if (input.source === "shelter") {
    void notifyShelter(input.id, userId ? "Přihlášený uživatel" : guestName, body, status === "pending");
  }

  if (input.revalidate) revalidatePath(input.revalidate);
  return { ok: true, status };
}

async function notifyShelter(
  contentItemId: string,
  authorName: string,
  body: string,
  needsApproval: boolean,
): Promise<void> {
  try {
    const service = createServiceClient();
    const { data: item } = await service
      .from("content_items")
      .select("title, institution:institutions(email, name)")
      .eq("id", contentItemId)
      .maybeSingle();
    const row = item as unknown as
      | { title: string; institution: { email: string | null; name: string } | null }
      | null;
    const email = row?.institution?.email;
    if (!email) return;

    await sendEmail({
      to: email,
      subject: `💬 Nový komentář — ${row!.title}`,
      react: NewCommentEmail({
        articleTitle: row!.title,
        authorName,
        body,
        needsApproval,
        moderationUrl: "/admin/content",
      }),
    });
  } catch {
    // Notifikace je best-effort — chybu ignorujeme.
  }
}
