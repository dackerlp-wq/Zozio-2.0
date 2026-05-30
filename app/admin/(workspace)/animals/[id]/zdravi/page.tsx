import { TabPlaceholder } from "../tab-placeholder";

export const metadata = { title: "Zdraví — Zozio Admin" };

export default function AnimalHealthPage() {
  return (
    <TabPlaceholder
      icon="🩺"
      title="Zdraví & veterina"
      description="Očkování, léčba, veterinární záznamy a vývoj váhy. Brzy tu budeš moct vést kompletní zdravotní kartu zvířete."
    />
  );
}
