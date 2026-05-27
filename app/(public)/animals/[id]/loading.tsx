import { PawLoader } from "@/components/zozio/paw-loader";

export default function AnimalLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <PawLoader label="Načítám profil…" />
    </div>
  );
}
