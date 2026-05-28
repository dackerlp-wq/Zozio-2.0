/**
 * Dev-only seed. Naseeduje uživatele jako OWNER útulku a nastaví mu heslo
 * (admin API → email_confirm bez ověřovacího mailu). Pak se přihlásíš přes
 * /auth/login e-mailem + heslem.
 *
 *   npx tsx scripts/dev-login.ts <email> [institution-slug] [password]
 *
 * Default slug: utulek-hostivar, default heslo: zozio-dev-123
 */
import { createClient } from "@supabase/supabase-js";

async function main() {
  const email = process.argv[2];
  const slug = process.argv[3] ?? "utulek-hostivar";
  const password = process.argv[4] ?? "zozio-dev-123";
  if (!email) {
    console.error("Usage: tsx scripts/dev-login.ts <email> [slug] [password]");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: inst } = await supabase
    .from("institutions")
    .select("id, name")
    .eq("slug", slug)
    .single();
  if (!inst) {
    console.error(`✗ Útulek "${slug}" nenalezen`);
    process.exit(1);
  }

  // Najdi nebo vytvoř uživatele (email_confirm = bez ověřovacího mailu)
  let userId: string | undefined;
  const { data: list } = await supabase.auth.admin.listUsers();
  const existing = list?.users.find((u) => u.email === email);

  if (existing) {
    userId = existing.id;
    await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: { ...existing.user_metadata, role: "owner" },
    });
  } else {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "owner" },
    });
    if (error || !created.user) {
      console.error("✗ Nepodařilo se vytvořit uživatele:", error?.message);
      process.exit(1);
    }
    userId = created.user.id;
  }

  // Membership = owner
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
  } else {
    await supabase
      .from("institution_members")
      .insert({ institution_id: inst.id, user_id: userId!, role: "owner" });
  }

  console.log(`\n✓ ${email} je owner útulku "${inst.name}".`);
  console.log("\nPřihlas se na http://localhost:3000/auth/login");
  console.log(`  E-mail: ${email}`);
  console.log(`  Heslo:  ${password}`);
  console.log("");
}

main();
