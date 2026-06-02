import { Link, Section, Text } from "@react-email/components";

import { COLORS, SITE_URL } from "../config";
import { EmailLayout, styles } from "./base";

export interface DigestTask {
  id: string;
  title: string;
  typeLabel: string;
  dueLabel: string | null;
  isOverdue: boolean;
  animalId: string | null;
  animalName: string | null;
}

interface TaskDigestEmailProps {
  institutionName: string;
  overdue: DigestTask[];
  today: DigestTask[];
  upcoming: DigestTask[];
}

function taskHref(t: DigestTask): string {
  return t.animalId
    ? `${SITE_URL}/admin/animals/${t.animalId}`
    : `${SITE_URL}/admin/tasks`;
}

function TaskGroup({ label, tasks, accent }: {
  label: string;
  tasks: DigestTask[];
  accent: string;
}) {
  if (tasks.length === 0) return null;
  return (
    <Section style={{ margin: "0 0 20px" }}>
      <Text
        style={{
          fontSize: "13px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          color: accent,
          margin: "0 0 8px",
        }}
      >
        {label} ({tasks.length})
      </Text>
      {tasks.map((t) => (
        <Section
          key={t.id}
          style={{
            borderLeft: `3px solid ${accent}`,
            padding: "4px 0 4px 12px",
            margin: "0 0 8px",
          }}
        >
          <Link href={taskHref(t)} style={{ ...styles.link, textDecoration: "none" }}>
            <span style={{ fontSize: "15px", fontWeight: 700, color: COLORS.espresso }}>
              {t.title}
            </span>
          </Link>
          <Text style={{ fontSize: "13px", color: COLORS.ink400, margin: "2px 0 0" }}>
            {t.typeLabel}
            {t.animalName ? ` · ${t.animalName}` : ""}
            {t.dueLabel ? ` · ${t.dueLabel}` : ""}
          </Text>
        </Section>
      ))}
    </Section>
  );
}

export function TaskDigestEmail({
  institutionName,
  overdue,
  today,
  upcoming,
}: TaskDigestEmailProps) {
  const total = overdue.length + today.length + upcoming.length;
  const preview =
    overdue.length > 0
      ? `${overdue.length} úkolů po termínu`
      : `${total} úkolů k vyřízení`;

  return (
    <EmailLayout preview={preview}>
      <Text style={styles.heading}>Denní přehled úkolů</Text>
      <Text style={styles.paragraph}>
        {institutionName} — máte {total}{" "}
        {total === 1 ? "úkol" : total >= 2 && total <= 4 ? "úkoly" : "úkolů"} k
        vyřízení.
      </Text>

      <TaskGroup label="Po termínu" tasks={overdue} accent={COLORS.coral} />
      <TaskGroup label="Dnes" tasks={today} accent={COLORS.amber} />
      <TaskGroup label="Nadcházející" tasks={upcoming} accent={COLORS.teal} />

      <Section style={{ margin: "24px 0 0" }}>
        <Link href={`${SITE_URL}/admin/tasks`} style={styles.button}>
          Otevřít úkoly
        </Link>
      </Section>

      <Text style={styles.muted}>
        Tento přehled chodí jednou denně. Spravovat upozornění můžete v
        nastavení útulku.
      </Text>
    </EmailLayout>
  );
}

export default TaskDigestEmail;
