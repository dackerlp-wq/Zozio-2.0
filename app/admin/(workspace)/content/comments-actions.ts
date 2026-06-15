"use server";

import { revalidatePath } from "next/cache";

import { ensurePermission } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import type { CommentStatus } from "@/types/database";

type Result = { error: string } | { ok: true };

export interface PendingComment {
  id: string;
  articleTitle: string;
  articleSlug: string;
  authorName: string;
  isGuest: boolean;
  body: string;
  createdAt: string;
}

/** Komentáře čekající na schválení napříč články daného útulku. */
export async function listPendingComments(): Promise<PendingComment[]> {
  const perm = await ensurePermission("web");
  if (!perm.ok) return [];
  const service = createServiceClient();

  const { data: items } = await service
    .from("content_items")
    .select("id, title, slug")
    .eq("institution_id", perm.membership.institutionId);
  const articles = new Map(
    ((items ?? []) as { id: string; title: string; slug: string }[]).map((i) => [i.id, i]),
  );
  if (articles.size === 0) return [];

  const { data: comments } = await service
    .from("article_comments")
    .select("id, content_item_id, user_id, guest_name, body, created_at")
    .in("content_item_id", [...articles.keys()])
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  return ((comments ?? []) as {
    id: string;
    content_item_id: string;
    user_id: string | null;
    guest_name: string | null;
    body: string;
    created_at: string;
  }[]).map((c) => {
    const art = articles.get(c.content_item_id);
    return {
      id: c.id,
      articleTitle: art?.title ?? "Článek",
      articleSlug: art?.slug ?? "",
      authorName: c.guest_name ?? "Uživatel",
      isGuest: !c.user_id,
      body: c.body,
      createdAt: c.created_at,
    };
  });
}

/** Schválí / skryje / označí komentář jako spam (jen u článků vlastního útulku). */
export async function moderateComment(
  id: string,
  action: "approve" | "hide" | "spam",
): Promise<Result> {
  const perm = await ensurePermission("web");
  if (!perm.ok) return { error: perm.error };
  const service = createServiceClient();

  // Ověř, že komentář patří k článku tohoto útulku.
  const { data: comment } = await service
    .from("article_comments")
    .select("id, content_item_id")
    .eq("id", id)
    .maybeSingle();
  const contentItemId = (comment as { content_item_id: string | null } | null)?.content_item_id;
  if (!contentItemId) return { error: "Komentář nelze moderovat." };

  const { data: item } = await service
    .from("content_items")
    .select("id")
    .eq("id", contentItemId)
    .eq("institution_id", perm.membership.institutionId)
    .maybeSingle();
  if (!item) return { error: "Tento komentář nepatří tvému útulku." };

  const status: CommentStatus = action === "approve" ? "approved" : action === "spam" ? "spam" : "hidden";
  const { error } = await service
    .from("article_comments")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/content");
  return { ok: true };
}
