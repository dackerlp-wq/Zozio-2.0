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

// DejaVu Sans (statické TTF) – plná podpora české diakritiky. Variabilní fonty
// v @react-pdf/renderer ořezávají první písmena, proto statické řezy.
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

const C = {
  ink: "#2C1810",
  muted: "#6B5346",
  line: "#D9CBBA",
  accent: "#E8634A",
};

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
  brand: { fontSize: 20, fontWeight: 700, color: C.ink },
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
  label: { width: 160, color: C.muted },
  value: { flex: 1, fontWeight: 700 },
  hr: { borderBottomWidth: 1, borderBottomColor: C.line, marginVertical: 14 },
  signRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 48 },
  signBox: { width: "44%" },
  signLine: { borderTopWidth: 1, borderTopColor: C.ink, paddingTop: 4, marginTop: 36 },
  signLabel: { fontSize: 9, color: C.muted },
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

export interface IntakeRecordData {
  recordNumber: string;
  dateLabel: string;
  institution: {
    name: string;
    address?: string | null;
    ico?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  animal: {
    name: string;
    species?: string | null;
    breed?: string | null;
    sex?: string | null;
    color?: string | null;
    chip?: string | null;
  };
  intake: {
    typeLabel: string;
    dateLabel?: string | null;
    foundDate?: string | null;
    foundLocation?: string | null;
    legalStatusLabel: string;
    protectionUntil?: string | null;
    identification: string;
    chipCheck?: string | null;
    vetCare?: string | null;
    staff?: string | null;
    staffRole?: string | null;
    /** Zdroj dle způsobu příjmu (nálezce / majitel / instituce / orgán). */
    sourceLabel?: string | null;
    sourceValue?: string | null;
    kvsReportedAt?: string | null;
  };
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value && value.trim() ? value : "—"}</Text>
    </View>
  );
}

function IntakeDoc({ data }: { data: IntakeRecordData }) {
  const { institution: inst, animal, intake } = data;
  return (
    <Document title={`Doklad o příjmu ${data.recordNumber}`} author={inst.name}>
      <Page size="A4" style={s.page}>
        <Text style={s.brand}>
          zozio<Text style={s.brandDot}>.</Text>
        </Text>
        <Text style={s.docTitle}>Doklad o příjmu zvířete</Text>
        <Text style={s.subtitle}>
          evid. č. {data.recordNumber} · vystaveno {data.dateLabel}
        </Text>

        <Text style={s.sectionTitle}>Útulek</Text>
        <Field label="Název" value={inst.name} />
        <Field label="Adresa" value={inst.address} />
        <Field label="IČO" value={inst.ico} />
        <Field label="Kontakt" value={[inst.email, inst.phone].filter(Boolean).join(" · ")} />

        <Text style={s.sectionTitle}>Zvíře</Text>
        <Field label="Jméno" value={animal.name} />
        <Field label="Druh / plemeno" value={[animal.species, animal.breed].filter(Boolean).join(" · ")} />
        <Field label="Pohlaví / barva" value={[animal.sex, animal.color].filter(Boolean).join(" · ")} />
        <Field label="Identifikace" value={intake.identification} />
        <Field label="Číslo čipu" value={animal.chip} />
        <Field label="Ověření čipu" value={intake.chipCheck} />

        <Text style={s.sectionTitle}>Příjem</Text>
        <Field label="Způsob příjmu" value={intake.typeLabel} />
        <Field label="Datum příjmu" value={intake.dateLabel} />
        <Field label="Datum nálezu" value={intake.foundDate} />
        <Field label="Místo / okolnosti" value={intake.foundLocation} />
        {intake.sourceLabel ? (
          <Field label={intake.sourceLabel} value={intake.sourceValue} />
        ) : null}
        <Field label="Přijal" value={[intake.staff, intake.staffRole].filter(Boolean).join(" · ")} />
        <Field label="Potřeba vet. péče" value={intake.vetCare} />

        <Text style={s.sectionTitle}>Právní stav</Text>
        <Field label="Stav" value={intake.legalStatusLabel} />
        <Field label="Konec ochranné lhůty" value={intake.protectionUntil} />
        <Field label="Nahlášeno na KVS" value={intake.kvsReportedAt} />

        <View style={s.signRow}>
          <View style={s.signBox}>
            <View style={s.signLine}>
              <Text style={s.signLabel}>Za útulek — {inst.name}</Text>
            </View>
          </View>
          <View style={s.signBox}>
            <View style={s.signLine}>
              <Text style={s.signLabel}>Předávající</Text>
            </View>
          </View>
        </View>

        <Text style={s.footer} fixed>
          Vygenerováno systémem Zozio (zozio.cz) · {data.dateLabel} · evid. č.{" "}
          {data.recordNumber}
        </Text>
      </Page>
    </Document>
  );
}

/** Vyrenderuje doklad o příjmu do PDF bufferu. */
export async function renderIntakeRecord(
  data: IntakeRecordData,
): Promise<Buffer> {
  return renderToBuffer(<IntakeDoc data={data} />);
}
