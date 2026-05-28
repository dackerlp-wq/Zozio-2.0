"use server";

import { revalidatePath } from "next/cache";

import { requireSuperadmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

type Result = { error: string } | { ok: true };

const ALLOWED_ROLES = [
  "superadmin",
  "owner",
  "admin",
  "staff",
  "visitor",
] as const;
type AssignableRole = (typeof ALLOWED_ROLES)[number];

export async function setUserRole(
  userId: string,
  role: string,
): Promise<Result> {
  const me = await requireSuperadmin();

  if (!ALLOWED_ROLES.includes(role as AssignableRole)) {
    return { error: "Neplatná role." };
  }
  if (userId === me.id && role !== "superadmin") {
    return { error: "Nemůžeš si odebrat vlastní superadmin roli." };
  }

  const service = createServiceClient();
  const { data: target } = await service.auth.admin.getUserById(userId);
  if (!target.user) return { error: "Uživatel nenalezen." };

  const { error } = await service.auth.admin.updateUserById(userId, {
    user_metadata: { ...target.user.user_metadata, role },
  });
  if (error) return { error: error.message };

  revalidatePath("/superadmin/users");
  return { ok: true };
}
