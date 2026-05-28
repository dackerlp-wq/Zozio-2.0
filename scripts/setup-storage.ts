/**
 * Vytvoří Supabase Storage bucket pro fotky zvířat (public read).
 *   npx tsx scripts/setup-storage.ts
 */
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Chybí NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const bucket = "animals";
  const { data: existing } = await supabase.storage.getBucket(bucket);

  if (existing) {
    console.log(`✓ Bucket "${bucket}" už existuje`);
  } else {
    const { error } = await supabase.storage.createBucket(bucket, {
      public: true,
      fileSizeLimit: 8 * 1024 * 1024, // 8 MB
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
    });
    if (error) {
      console.error("✗ Nepodařilo se vytvořit bucket:", error.message);
      process.exit(1);
    }
    console.log(`✓ Bucket "${bucket}" vytvořen (public, max 8MB, jen obrázky)`);
  }
}

main();
