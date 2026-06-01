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

// DejaVu Sans (statické TTF) – plná podpora české diakritiky. Vestavěné PDF
// fonty (Helvetica) háčky/čárky neumí; variabilní fonty zase v
// @react-pdf/renderer ořezávají první písmena — proto statické řezy DejaVu.
const FONT_REGULAR = path.join(process.cwd(), "lib/pdf/fonts/DejaVuSans.ttf");
const FONT_BOLD = path.join(process.cwd(), "lib/pdf/fonts/DejaVuSans-Bold.ttf");
Font.register({
  family: "Doc",
  fonts: [
    { src: FONT_REGULAR, fontWeight: 400 },
    { src: FONT_BOLD, fontWeight: 700 },
  ],
});
// Vypni dělení slov (jinak react-pdf láme uprostřed slov).
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
  label: { width: 150, color: C.muted },
  value: { flex: 1, fontWeight: 700 },
  paragraph: { marginBottom: 8, textAlign: "justify" },
  listItem: { flexDirection: "row", marginBottom: 4 },
  bullet: { width: 14, color: C.accent },
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

export interface AdoptionContractData {
  contractNumber: string;
  dateLabel: string;
  institution: {
    name: string;
    address?: string | null;
    ico?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  adopter: {
    name: string;
    address?: string | null;
    email?: string | null;
    phone?: string | null;
    idNumber?: string | null;
  };
  animal: {
    name: string;
    species?: string | null;
    breed?: string | null;
    sex?: string | null;
    color?: string | null;
    chip?: string | null;
    recordNumber?: string | null;
  };
  feeLabel: string;
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value && value.trim() ? value : "…………………………"}</Text>
    </View>
  );
}

function ContractDoc({ data }: { data: AdoptionContractData }) {
  const { institution: inst, adopter, animal } = data;
  return (
    <Document
      title={`Adopční smlouva ${data.contractNumber}`}
      author={inst.name}
    >
      <Page size="A4" style={s.page}>
        <Text style={s.brand}>
          zozio<Text style={s.brandDot}>.</Text>
        </Text>
        <Text style={s.docTitle}>Smlouva o adopci zvířete</Text>
        <Text style={s.subtitle}>
          č. {data.contractNumber} · sjednáno {data.dateLabel}
        </Text>

        <Text style={s.sectionTitle}>Smluvní strany</Text>
        <Field label="Útulek (předávající)" value={inst.name} />
        <Field label="Adresa" value={inst.address} />
        <Field label="IČO" value={inst.ico} />
        <Field label="Kontakt" value={[inst.email, inst.phone].filter(Boolean).join(" · ")} />
        <View style={{ height: 6 }} />
        <Field label="Adoptant (přebírající)" value={adopter.name} />
        <Field label="Adresa" value={adopter.address} />
        <Field label="Doklad totožnosti" value={adopter.idNumber} />
        <Field label="Kontakt" value={[adopter.email, adopter.phone].filter(Boolean).join(" · ")} />

        <Text style={s.sectionTitle}>Předmět smlouvy — zvíře</Text>
        <Field label="Jméno" value={animal.name} />
        <Field label="Druh / plemeno" value={[animal.species, animal.breed].filter(Boolean).join(" · ")} />
        <Field label="Pohlaví / barva" value={[animal.sex, animal.color].filter(Boolean).join(" · ")} />
        <Field label="Číslo čipu" value={animal.chip} />
        <Field label="Evidenční číslo" value={animal.recordNumber} />
        <Field label="Adopční příspěvek" value={data.feeLabel} />

        <Text style={s.sectionTitle}>Ujednání</Text>
        <Text style={s.paragraph}>
          1. Útulek předává adoptantovi výše uvedené zvíře do trvalé péče.
          Adoptant prohlašuje, že je seznámen se zdravotním stavem, povahou a
          potřebami zvířete a přebírá ho do svého vlastnictví.
        </Text>
        <Text style={s.paragraph}>
          2. Adoptant se zavazuje zajistit zvířeti řádnou péči, výživu,
          veterinární ošetření a podmínky odpovídající jeho druhu a potřebám v
          souladu se zákonem č. 246/1992 Sb., na ochranu zvířat proti týrání.
        </Text>
        <Text style={s.paragraph}>
          3. Adoptant nesmí zvíře využívat k chovu pro zisk, prodat ho ani
          předat třetí osobě bez vědomí útulku. Nemůže-li o zvíře dále pečovat,
          přednostně ho vrátí útulku.
        </Text>
        <Text style={s.paragraph}>
          4. Útulek je oprávněn ověřit podmínky, v nichž zvíře žije, a v případě
          porušení této smlouvy si vyhrazuje právo zvíře odebrat.
        </Text>
        <Text style={s.paragraph}>
          5. Adopční příspěvek slouží na úhradu nákladů spojených s péčí o
          zvíře a další činnost útulku.
        </Text>

        <View style={s.signRow}>
          <View style={s.signBox}>
            <View style={s.signLine}>
              <Text style={s.signLabel}>Za útulek — {inst.name}</Text>
            </View>
          </View>
          <View style={s.signBox}>
            <View style={s.signLine}>
              <Text style={s.signLabel}>Adoptant — {adopter.name}</Text>
            </View>
          </View>
        </View>

        <Text style={s.footer} fixed>
          Vygenerováno systémem Zozio (zozio.cz) · {data.dateLabel} · smlouva č.{" "}
          {data.contractNumber}
        </Text>
      </Page>
    </Document>
  );
}

/** Vyrenderuje adopční smlouvu do PDF bufferu (pro e-mailovou přílohu). */
export async function renderAdoptionContract(
  data: AdoptionContractData,
): Promise<Buffer> {
  return renderToBuffer(<ContractDoc data={data} />);
}
