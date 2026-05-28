/**
 * Připojí (nebo vytvoří) uživatele jako OWNER existujícího útulku.
 * Pro dev testování admin rozhraní.
 *
 *   npx tsx scripts/seed-owner.ts <email> [institution-slug]
 *
 * Default slug: utulek-hostivar
 */
import { createClient } from "@supabase/supabase-js";

async function main() {
  const email = process.argv[2];
  const slug = process.argv[3] ?? "utulek-hostivar";
  if (!email) {
    console.error("Usage: tsx scripts/seed-owner.ts <email> [slug]");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Najdi útulek
  const { data: inst } = await supabase
    .from("institutions")
    .select("id, name")
    .eq("slug", slug)
    .single();
  if (!inst) {
    console.error(`✗ Útulek "${slug}" nenalezen`);
    process.exit(1);
  }

  // 2. Najdi nebo vytvoř uživatele
  let userId: string | undefined;
  const { data: list } = await supabase.auth.admin.listUsers();
  const existing = list?.users.find((u) => u.email === email);

  if (existing) {
    userId = existing.id;
    console.log(`→ Uživatel ${email} už existuje`);
    await supabase.auth.admin.updateUserById(userId, {
      user_metadata: { ...existing.user_metadata, role: "owner" },
    });
  } else {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { role: "owner" },
    });
    if (error || !created.user) {
      console.error("✗ Nepodařilo se vytvořit uživatele:", error?.message);
      process.exit(1);
    }
    userId = created.user.id;
    console.log(`→ Uživatel ${email} vytvořen`);
  }

  // 3. Membership
  const { data: member } = await supabase
    .from("institution_members")
    .select("id")
    .eq("institution_id", inst.id)
    .eq("user_id", userId!)
    .maybeSingle();

  if (member) {
    await supabase
      .from("institution_members")
      .update({ role: "owner" })
      .eq("id", member.id);
    console.log(`→ Membership aktualizováno na owner`);
  } else {
    await supabase
      .from("institution_members")
      .insert({ institution_id: inst.id, user_id: userId!, role: "owner" });
    console.log(`→ Membership vytvořeno (owner)`);
  }

  console.log(
    `\n✓ ${email} je teď owner útulku "${inst.name}".\n` +
      `  Přihlas se magic linkem na /auth/login a běž na /admin/dashboard.`,
  );
}

main();
