import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import path from "node:path";

const FONT_REGULAR = path.join(process.cwd(), "lib/pdf/fonts/DejaVuSans.ttf");
const FONT_BOLD = path.join(process.cwd(), "lib/pdf/fonts/DejaVuSans-Bold.ttf");
Font.register({
  family: "Doc",
  fonts: [
    { src: FONT_REGULAR, fontWeight: 400 },
    { src: FONT_BOLD, fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

const C = { ink: "#2C1810", muted: "#6B5346", line: "#D9CBBA", accent: "#E8634A" };

const s = StyleSheet.create({
  page: {
    fontFamily: "Doc",
    fontSize: 10.5,
    lineHeight: 1.5,
    color: C.ink,
    paddingTop: 48,
    paddingBottom: 64,
    paddingHorizontal: 54,
  },
  brand: { fontSize: 20, fontWeight: 700 },
  brandDot: { color: C.accent },
  docTitle: { fontSize: 16, fontWeight: 700, marginTop: 18, marginBottom: 2 },
  subtitle: { fontSize: 9, color: C.muted, marginBottom: 18 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginTop: 16,
    marginBottom: 6,
    color: C.accent,
  },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { width: 150, color: C.muted },
  value: { flex: 1, fontWeight: 700 },
  listItem: { flexDirection: "row", marginBottom: 3 },
  bullet: { width: 12, color: C.accent },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 54,
    right: 54,
    fontSize: 8,
    color: C.muted,
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 6,
  },
});

export type HealthDocVariant = "owner" | "full";

export interface HealthRecordData {
  variant: HealthDocVariant;
  dateLabel: string;
  institution: { name: string };
  animal: {
    name: string;
    species?: string | null;
    breed?: string | null;
    sex?: string | null;
    chip?: string | null;
    neutered?: string | null;
    lastWeight?: string | null;
  };
  vaccines: { name: string; validUntil: string | null; status: string }[];
  conditions: string[];
  /** Jen pro variantu „full" (kontrola). */
  treatments?: { name: string; type: string; period: string; vet: string | null; notes: string | null }[];
  vetRecords?: { title: string; date: string; vet: string | null; notes: string | null }[];
  weights?: { weight: string; date: string }[];
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value && value.trim() ? value : "—"}</Text>
    </View>
  );
}

function HealthDoc({ data }: { data: HealthRecordData }) {
  const { animal, vaccines, conditions } = data;
  const full = data.variant === "full";
  return (
    <Document title={`Zdravotní karta — ${animal.name}`} author={data.institution.name}>
      <Page size="A4" style={s.page}>
        <Text style={s.brand}>
          zozio<Text style={s.brandDot}>.</Text>
        </Text>
        <Text style={s.docTitle}>
          {full ? "Zdravotní karta — kompletní" : "Zdravotní karta zvířete"}
        </Text>
        <Text style={s.subtitle}>
          {data.institution.name} · vystaveno {data.dateLabel}
          {full ? " · pro veterinární kontrolu" : " · pro nového majitele"}
        </Text>

        <Text style={s.sectionTitle}>Identifikace</Text>
        <Field label="Jméno" value={animal.name} />
        <Field label="Druh / plemeno" value={[animal.species, animal.breed].filter(Boolean).join(" · ")} />
        <Field label="Pohlaví" value={animal.sex} />
        <Field label="Číslo čipu" value={animal.chip} />
        <Field label="Kastrace / sterilizace" value={animal.neutered} />
        <Field label="Poslední váha" value={animal.lastWeight} />

        <Text style={s.sectionTitle}>Očkování</Text>
        {vaccines.length === 0 ? (
          <Text style={{ color: C.muted }}>Žádné evidované očkování.</Text>
        ) : (
          vaccines.map((v, i) => (
            <View key={i} style={s.listItem}>
              <Text style={s.bullet}>•</Text>
              <Text style={{ flex: 1 }}>
                <Text style={{ fontWeight: 700 }}>{v.name}</Text>
                {v.validUntil ? ` — platné do ${v.validUntil}` : ""} ({v.status})
              </Text>
            </View>
          ))
        )}

        <Text style={s.sectionTitle}>Chronické stavy & speciální potřeby</Text>
        {conditions.length === 0 ? (
          <Text style={{ color: C.muted }}>Žádné evidované.</Text>
        ) : (
          conditions.map((c, i) => (
            <View key={i} style={s.listItem}>
              <Text style={s.bullet}>•</Text>
              <Text style={{ flex: 1 }}>{c}</Text>
            </View>
          ))
        )}

        {full && (
          <>
            <Text style={s.sectionTitle}>Léčby & medikace</Text>
            {data.treatments && data.treatments.length > 0 ? (
              data.treatments.map((t, i) => (
                <View key={i} style={s.listItem}>
                  <Text style={s.bullet}>•</Text>
                  <Text style={{ flex: 1 }}>
                    <Text style={{ fontWeight: 700 }}>{t.name}</Text>
                    {` (${t.type})`}
                    {t.period ? ` — ${t.period}` : ""}
                    {t.vet ? ` · ${t.vet}` : ""}
                    {t.notes ? ` — ${t.notes}` : ""}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={{ color: C.muted }}>Žádné evidované.</Text>
            )}

            <Text style={s.sectionTitle}>Veterinární záznamy</Text>
            {data.vetRecords && data.vetRecords.length > 0 ? (
              data.vetRecords.map((r, i) => (
                <View key={i} style={s.listItem}>
                  <Text style={s.bullet}>•</Text>
                  <Text style={{ flex: 1 }}>
                    <Text style={{ fontWeight: 700 }}>{r.date}</Text> — {r.title}
                    {r.vet ? ` · ${r.vet}` : ""}
                    {r.notes ? ` — ${r.notes}` : ""}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={{ color: C.muted }}>Žádné evidované.</Text>
            )}

            <Text style={s.sectionTitle}>Záznamy vážení</Text>
            {data.weights && data.weights.length > 0 ? (
              data.weights.map((w, i) => (
                <View key={i} style={s.listItem}>
                  <Text style={s.bullet}>•</Text>
                  <Text style={{ flex: 1 }}>
                    {w.date} — {w.weight}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={{ color: C.muted }}>Žádné evidované.</Text>
            )}
          </>
        )}

        <Text style={s.footer} fixed>
          Vygenerováno systémem Zozio (zozio.cz) · {data.dateLabel} · {animal.name}
        </Text>
      </Page>
    </Document>
  );
}

/** Vyrenderuje zdravotní kartu do PDF bufferu (KVS / nový majitel). */
export async function renderHealthRecord(data: HealthRecordData): Promise<Buffer> {
  return renderToBuffer(<HealthDoc data={data} />);
}
