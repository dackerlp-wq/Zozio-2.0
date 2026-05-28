/**
 * Nastaví uživateli roli superadmin (přístup do /superadmin).
 *
 *   npx tsx --env-file=.env.local scripts/make-superadmin.ts <email>
 */
import { createClient } from "@supabase/supabase-js";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: tsx scripts/make-superadmin.ts <email>");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: list } = await supabase.auth.admin.listUsers();
  const user = list?.users.find((u) => u.email === email);
  if (!user) {
    console.error(`✗ Uživatel "${email}" nenalezen. Nejdřív se zaregistruj.`);
    process.exit(1);
  }

  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, role: "superadmin" },
  });
  if (error) {
    console.error("✗ Nepodařilo se nastavit roli:", error.message);
    process.exit(1);
  }

  console.log(
    `\n✓ ${email} je teď superadmin.\n` +
      `  Odhlas se a znovu přihlas, pak běž na /superadmin.`,
  );
}

main();
