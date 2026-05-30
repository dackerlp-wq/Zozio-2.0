import { TabPlaceholder } from "../tab-placeholder";

export const metadata = { title: "Historie — Zozio Admin" };

export default function AnimalHistoryPage() {
  return (
    <TabPlaceholder
      icon="🕓"
      title="Životní cyklus & historie"
      description="Časová osa změn stavu zvířete od příjmu po výstup. Brzy tu uvidíš celý příběh pobytu v útulku."
    />
  );
}
