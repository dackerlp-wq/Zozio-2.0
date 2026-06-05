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
  success: "#1A7A45",
};

const s = StyleSheet.create({
  page: {
    fontFamily: "Doc",
    fontSize: 11,
    lineHeight: 1.5,
    color: C.ink,
    paddingTop: 48,
    paddingBottom: 64,
    paddingHorizontal: 54,
  },
  brand: { fontSize: 18, fontWeight: 700 },
  brandDot: { color: C.accent },
  title: { fontSize: 20, fontWeight: 700, marginTop: 16 },
  sub: { fontSize: 10, color: C.muted, marginBottom: 18 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginTop: 18,
    marginBottom: 8,
    color: C.accent,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: {
    width: "31%",
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 8,
    padding: 12,
  },
  statN: { fontSize: 20, fontWeight: 700 },
  statL: { fontSize: 9, color: C.muted, marginTop: 2 },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { width: 220, color: C.muted },
  value: { flex: 1, fontWeight: 700 },
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

export interface AnnualReportData {
  institution: { name: string; ico?: string | null };
  periodLabel: string;
  generatedLabel: string;
  stats: { value: string; label: string }[];
  details: { label: string; value: string }[];
}

function AnnualDoc({ data }: { data: AnnualReportData }) {
  const { institution: inst } = data;
  return (
    <Document title="Výroční zpráva" author={inst.name}>
      <Page size="A4" style={s.page}>
        <Text style={s.brand}>
          zozio<Text style={s.brandDot}>.</Text>
        </Text>
        <Text style={s.title}>Výroční zpráva</Text>
        <Text style={s.sub}>
          {inst.name}
          {inst.ico ? ` · IČO ${inst.ico}` : ""} · období {data.periodLabel}
        </Text>

        <Text style={s.sectionTitle}>Souhrn</Text>
        <View style={s.grid}>
          {data.stats.map((st, i) => (
            <View key={i} style={s.stat}>
              <Text style={s.statN}>{st.value}</Text>
              <Text style={s.statL}>{st.label}</Text>
            </View>
          ))}
        </View>

        <Text style={s.sectionTitle}>Podrobnosti</Text>
        {data.details.map((d, i) => (
          <View key={i} style={s.row}>
            <Text style={s.label}>{d.label}</Text>
            <Text style={s.value}>{d.value}</Text>
          </View>
        ))}

        <Text style={s.footer} fixed>
          Vygenerováno systémem Zozio (zozio.cz) · {data.generatedLabel}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderAnnualReport(
  data: AnnualReportData,
): Promise<Buffer> {
  return renderToBuffer(<AnnualDoc data={data} />);
}
