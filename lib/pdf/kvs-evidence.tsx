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

const C = {
  ink: "#2C1810",
  muted: "#6B5346",
  line: "#D9CBBA",
  accent: "#E8634A",
  head: "#F5E6D3",
};

const s = StyleSheet.create({
  page: {
    fontFamily: "Doc",
    fontSize: 8.5,
    lineHeight: 1.4,
    color: C.ink,
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 40,
  },
  brand: { fontSize: 16, fontWeight: 700, color: C.ink },
  brandDot: { color: C.accent },
  docTitle: { fontSize: 14, fontWeight: 700, marginTop: 12 },
  subtitle: { fontSize: 9, color: C.muted, marginBottom: 2 },
  instLine: { fontSize: 9, color: C.muted, marginBottom: 10 },
  table: { marginTop: 10, borderWidth: 1, borderColor: C.line },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.line },
  th: {
    backgroundColor: C.head,
    fontWeight: 700,
    padding: 4,
    fontSize: 8,
  },
  td: { padding: 4, fontSize: 8 },
  cell: { borderRightWidth: 1, borderRightColor: C.line },
  stampRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 36,
  },
  stampBox: {
    width: "44%",
    borderWidth: 1,
    borderColor: C.line,
    borderStyle: "dashed",
    height: 90,
    padding: 8,
  },
  stampLabel: { fontSize: 8, color: C.muted },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 7.5,
    color: C.muted,
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 6,
  },
});

export interface KvsEvidenceData {
  institution: {
    name: string;
    legalName?: string | null;
    ico?: string | null;
    address?: string | null;
  };
  periodLabel: string;
  generatedLabel: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  /** Šířkové váhy sloupců (volitelné), jinak rovnoměrně. */
  widths?: number[];
}

function KvsDoc({ data }: { data: KvsEvidenceData }) {
  const { institution: inst, headers, rows } = data;
  const widths = data.widths ?? headers.map(() => 1);
  return (
    <Document title="Evidenční kniha zvířat" author={inst.name}>
      <Page size="A4" orientation="landscape" style={s.page}>
        <Text style={s.brand}>
          zozio<Text style={s.brandDot}>.</Text>
        </Text>
        <Text style={s.docTitle}>Evidenční kniha zvířat</Text>
        <Text style={s.subtitle}>
          dle §25 zákona č. 246/1992 Sb., na ochranu zvířat proti týrání
        </Text>
        <Text style={s.instLine}>
          {[inst.legalName || inst.name, inst.ico ? `IČO ${inst.ico}` : null, inst.address]
            .filter(Boolean)
            .join(" · ")}{" "}
          · období: {data.periodLabel}
        </Text>

        <View style={s.table}>
          <View style={s.tr} fixed>
            {headers.map((h, i) => (
              <Text
                key={i}
                style={[
                  s.th,
                  i < headers.length - 1 ? s.cell : {},
                  { flex: widths[i] },
                ]}
              >
                {h}
              </Text>
            ))}
          </View>
          {rows.map((r, ri) => (
            <View key={ri} style={s.tr} wrap={false}>
              {headers.map((_, ci) => (
                <Text
                  key={ci}
                  style={[
                    s.td,
                    ci < headers.length - 1 ? s.cell : {},
                    { flex: widths[ci] },
                  ]}
                >
                  {r[ci] === null || r[ci] === undefined ? "" : String(r[ci])}
                </Text>
              ))}
            </View>
          ))}
          {rows.length === 0 && (
            <View style={s.tr}>
              <Text style={[s.td, { flex: 1, color: C.muted }]}>
                Žádné záznamy za zvolené období.
              </Text>
            </View>
          )}
        </View>

        <View style={s.stampRow}>
          <View style={s.stampBox}>
            <Text style={s.stampLabel}>Razítko a podpis odpovědné osoby</Text>
          </View>
          <View style={s.stampBox}>
            <Text style={s.stampLabel}>Za útulek — {inst.name}</Text>
          </View>
        </View>

        <Text style={s.footer} fixed>
          Vygenerováno systémem Zozio (zozio.cz) · {data.generatedLabel} · počet
          záznamů: {rows.length}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderKvsEvidence(data: KvsEvidenceData): Promise<Buffer> {
  return renderToBuffer(<KvsDoc data={data} />);
}
