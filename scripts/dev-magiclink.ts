/**
 * Dev-only: zajistí uživatele jako OWNER útulku a vygeneruje magic-link
 * token_hash (přihlášení bez hesla). Vytiskne hotovou callback URL.
 *
 *   npx dotenvx run -f .env.local -- npx tsx scripts/dev-magiclink.ts <email> [slug]
 */
import { createClient } from "@supabase/supabase-js";

async function main() {
  const email = process.argv[2];
  const slug = process.argv[3] ?? "utulek-hostivar";
  if (!email) {
    console.error("Usage: tsx scripts/dev-magiclink.ts <email> [slug]");
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

  // Zajisti uživatele (owner) + membership.
  const { data: list } = await supabase.auth.admin.listUsers();
  const existing = list?.users.find((u) => u.email === email);
  let userId = existing?.id;
  if (existing) {
    await supabase.auth.admin.updateUserById(existing.id, {
      email_confirm: true,
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
  }

  const { data: member } = await supabase
    .from("institution_members")
    .select("id")
    .eq("institution_id", inst.id)
    .eq("user_id", userId!)
    .maybeSingle();
  if (member) {
    await supabase.from("institution_members").update({ role: "owner" }).eq("id", member.id);
  } else {
    await supabase
      .from("institution_members")
      .insert({ institution_id: inst.id, user_id: userId!, role: "owner" });
  }

  const { data: link, error: linkErr } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr || !link?.properties?.hashed_token) {
    console.error("✗ generateLink selhal:", linkErr?.message);
    process.exit(1);
  }

  const callback = `http://localhost:3000/auth/callback?token_hash=${link.properties.hashed_token}&type=magiclink&next=/admin/dashboard`;
  console.log("MAGICLINK_URL=" + callback);
}

main();
