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
  obs: { flexDirection: "row", marginBottom: 4, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: C.line },
  obsDate: { width: 110, color: C.muted, fontWeight: 700 },
  obsBody: { flex: 1 },
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

export interface QuarantineRecordData {
  dateLabel: string;
  institution: { name: string };
  animal: { name: string };
  episode: {
    kindLabel: string;
    reason: string | null;
    started: string;
    plannedUntil: string | null;
    ended: string | null;
    dayCount: number;
  };
  observations: { date: string; temp: string | null; flag: string; note: string | null }[];
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value && value.trim() ? value : "—"}</Text>
    </View>
  );
}

function QuarantineDoc({ data }: { data: QuarantineRecordData }) {
  const { animal, episode, observations } = data;
  return (
    <Document title={`Průběh dohledu — ${animal.name}`} author={data.institution.name}>
      <Page size="A4" style={s.page}>
        <Text style={s.brand}>
          zozio<Text style={s.brandDot}>.</Text>
        </Text>
        <Text style={s.docTitle}>Průběh veterinárního dohledu</Text>
        <Text style={s.subtitle}>
          {data.institution.name} · {animal.name} · vystaveno {data.dateLabel}
        </Text>

        <Text style={s.sectionTitle}>Epizoda</Text>
        <Field label="Typ dohledu" value={episode.kindLabel} />
        <Field label="Důvod" value={episode.reason} />
        <Field label="Začátek" value={episode.started} />
        <Field label="Doporučeno do" value={episode.plannedUntil} />
        <Field label="Ukončeno" value={episode.ended ?? "Probíhá"} />
        <Field label="Počet dní" value={`${episode.dayCount}`} />

        <Text style={s.sectionTitle}>Denní pozorování ({observations.length})</Text>
        {observations.length === 0 ? (
          <Text style={{ color: C.muted }}>Žádná pozorování.</Text>
        ) : (
          observations.map((o, i) => (
            <View key={i} style={s.obs}>
              <Text style={s.obsDate}>{o.date}</Text>
              <Text style={s.obsBody}>
                {o.temp ? <Text style={{ fontWeight: 700 }}>{o.temp} </Text> : null}
                {o.flag === "watch" ? "[sledovat] " : ""}
                {o.note ?? ""}
              </Text>
            </View>
          ))
        )}

        <Text style={s.footer} fixed>
          Vygenerováno systémem Zozio (zozio.cz) · {data.dateLabel} · {animal.name}
        </Text>
      </Page>
    </Document>
  );
}

/** Vyrenderuje průběh dohledu do PDF bufferu. */
export async function renderQuarantineRecord(
  data: QuarantineRecordData,
): Promise<Buffer> {
  return renderToBuffer(<QuarantineDoc data={data} />);
}
