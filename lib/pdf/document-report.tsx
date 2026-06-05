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
    fontSize: 10,
    lineHeight: 1.5,
    color: C.ink,
    paddingTop: 44,
    paddingBottom: 56,
    paddingHorizontal: 50,
  },
  brand: { fontSize: 16, fontWeight: 700 },
  brandDot: { color: C.accent },
  title: { fontSize: 18, fontWeight: 700, marginTop: 14 },
  sub: { fontSize: 9, color: C.muted, marginBottom: 6 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginTop: 16,
    marginBottom: 6,
    color: C.accent,
  },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { width: 170, color: C.muted },
  value: { flex: 1, fontWeight: 700 },
  empty: { color: C.muted, fontSize: 9 },
  table: { borderWidth: 1, borderColor: C.line, marginTop: 4 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.line },
  th: { backgroundColor: C.head, fontWeight: 700, padding: 3.5, fontSize: 8 },
  td: { padding: 3.5, fontSize: 8 },
  cellBorder: { borderRightWidth: 1, borderRightColor: C.line },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 50,
    right: 50,
    fontSize: 7.5,
    color: C.muted,
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 6,
  },
});

export type DocSection =
  | { title: string; kind: "fields"; fields: { label: string; value: string | null }[] }
  | {
      title: string;
      kind: "table";
      headers: string[];
      rows: (string | number | null | undefined)[][];
    };

export interface DocumentReportData {
  title: string;
  subtitle?: string;
  author: string;
  generatedLabel: string;
  sections: DocSection[];
}

function SectionView({ section }: { section: DocSection }) {
  if (section.kind === "fields") {
    return (
      <View>
        <Text style={s.sectionTitle}>{section.title}</Text>
        {section.fields.length === 0 ? (
          <Text style={s.empty}>—</Text>
        ) : (
          section.fields.map((f, i) => (
            <View key={i} style={s.row}>
              <Text style={s.label}>{f.label}</Text>
              <Text style={s.value}>{f.value && f.value.trim() ? f.value : "—"}</Text>
            </View>
          ))
        )}
      </View>
    );
  }
  return (
    <View>
      <Text style={s.sectionTitle}>{section.title}</Text>
      {section.rows.length === 0 ? (
        <Text style={s.empty}>Žádné záznamy.</Text>
      ) : (
        <View style={s.table}>
          <View style={s.tr}>
            {section.headers.map((h, i) => (
              <Text
                key={i}
                style={[s.th, i < section.headers.length - 1 ? s.cellBorder : {}, { flex: 1 }]}
              >
                {h}
              </Text>
            ))}
          </View>
          {section.rows.map((r, ri) => (
            <View key={ri} style={s.tr} wrap={false}>
              {section.headers.map((_, ci) => (
                <Text
                  key={ci}
                  style={[s.td, ci < section.headers.length - 1 ? s.cellBorder : {}, { flex: 1 }]}
                >
                  {r[ci] === null || r[ci] === undefined ? "" : String(r[ci])}
                </Text>
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function ReportDoc({ data }: { data: DocumentReportData }) {
  return (
    <Document title={data.title} author={data.author}>
      <Page size="A4" style={s.page}>
        <Text style={s.brand}>
          zozio<Text style={s.brandDot}>.</Text>
        </Text>
        <Text style={s.title}>{data.title}</Text>
        {data.subtitle && <Text style={s.sub}>{data.subtitle}</Text>}
        {data.sections.map((sec, i) => (
          <SectionView key={i} section={sec} />
        ))}
        <Text style={s.footer} fixed>
          Vygenerováno systémem Zozio (zozio.cz) · {data.generatedLabel}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderDocumentReport(
  data: DocumentReportData,
): Promise<Buffer> {
  return renderToBuffer(<ReportDoc data={data} />);
}
