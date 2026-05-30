import { TabPlaceholder } from "../tab-placeholder";

export const metadata = { title: "Úkoly — Zozio Admin" };

export default function AnimalTasksPage() {
  return (
    <TabPlaceholder
      icon="✅"
      title="Úkoly & připomínky"
      description="Úkoly a automatické připomínky (očkování, léčba, dlouhý pobyt). Brzy tu budeš mít vše, na co nesmíš zapomenout."
    />
  );
}
