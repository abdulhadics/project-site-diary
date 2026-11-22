"use client";

import { Document, Image, Link, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import { resizePhoto } from "../diary/images";
import { captureTime, mapUrl, pdfLimit, reportDate, reportFilename, type Photo, type Project } from "../diary/model";

const mm = (millimetres: number) => millimetres * 72 / 25.4;
const margin = mm(20);
const styles = StyleSheet.create({
  // Fixed-height sheets preserve the A4 trim box with manual pagination.
  page: {
    minHeight: mm(297), maxHeight: mm(297), padding: margin,
    fontFamily: "Helvetica", fontSize: 11, color: "#000000", backgroundColor: "#ffffff",
  },
  header: { paddingBottom: 7, borderBottomWidth: 0.5, borderBottomColor: "#999999", marginBottom: 10 },
  title: { fontSize: 22, fontWeight: 700, lineHeight: 1.12, marginBottom: 3 },
  subtitle: { fontSize: 13, marginBottom: 3 },
  detail: { fontSize: 10, lineHeight: 1.2, marginBottom: 2 },
  label: { fontSize: 10, fontWeight: 700, marginBottom: 4 },
  box: { width: mm(170), borderWidth: 0.5, borderColor: "#c5c5c5", justifyContent: "center", alignItems: "center" },
  image: { width: "100%", height: "100%", objectFit: "contain" },
  description: { fontSize: 11, lineHeight: 1.4, marginTop: 5, marginBottom: 4, textAlign: "left" },
  location: { fontSize: 9, lineHeight: 1.15, color: "#595959" },
  link: { color: "#595959", textDecoration: "underline" },
  footer: {
    position: "absolute", bottom: margin, left: margin, right: margin, flexDirection: "row",
    alignItems: "flex-end", justifyContent: "space-between", fontSize: 9, color: "#595959", gap: 15,
  },
  footerTitle: { flexShrink: 1 },
  pageNumber: { flexShrink: 0 },
});

type PdfPhoto = { row: Photo; image: string };

function ReportDocument({ project, day, photos }: { project: Project; day: string; photos: PdfPhoto[] }) {
  const date = reportDate(day);
  const author = project.prepared_by ? "Prepared by " + project.prepared_by : "";
  const details = [author, project.company_name].filter(Boolean).join(" · ");
  const boxHeight = mm(project.name.length > 42 || details.length > 65 ? 67 : details ? 74 : 78);
  const pageCount = Math.ceil(photos.length / 2);

  return (
    <Document title={project.name + " · Daily Site Progress Report"} author={project.prepared_by ?? undefined}>
      {Array.from({ length: pageCount }, (_, page) => (
        <Page key={page} size="A4" orientation="portrait" wrap={false} style={styles.page}>
          {page === 0 && <View style={styles.header}>
            <Text style={styles.title}>{project.name}</Text>
            <Text style={styles.subtitle}>Daily Site Progress Report</Text>
            <Text style={styles.detail}>{date}</Text>
            {details && <Text style={styles.detail}>{details}</Text>}
            <Text style={styles.detail}>{photos.length + (photos.length === 1 ? " photo" : " photos")}</Text>
          </View>}
          {photos.slice(page * 2, page * 2 + 2).map(({ row, image }, index) => (
            <View key={row.id} wrap={false} style={{ marginBottom: index === 0 ? mm(10) : 0 }}>
              <Text style={styles.label}>{"Photo " + (page * 2 + index + 1) + " · " + captureTime(row.captured_at)}</Text>
              <View style={[styles.box, { height: boxHeight }]}>
                {/* react-pdf Image is drawn inside the fixed box with contain sizing. */}
                <Image src={image} style={styles.image} cache={false} />
              </View>
              <Text style={styles.description}>{row.description.replace(/\s+/g, " ")}</Text>
              <Text style={styles.location}>
                {"Location: " + row.lat.toFixed(6) + ", " + row.lng.toFixed(6) + " (accuracy ±" + Math.round(row.accuracy) + " m) · "}
                <Link src={mapUrl(row)} style={styles.link}>View on map</Link>
              </Text>
            </View>
          ))}
          <View style={styles.footer}>
            <Text style={styles.footerTitle}>{project.name + " · " + date}</Text>
            <Text style={styles.pageNumber}>{"Page " + (page + 1) + " of " + pageCount}</Text>
          </View>
        </Page>
      ))}
    </Document>
  );
}

export async function makeReport(
  project: Project, day: string, photos: Photo[], read: (path: string) => Promise<Blob>,
  progress: (message: string) => void,
): Promise<File> {
  if (!photos.length || photos.some((row) => !row.description.trim() || !row.description_approved_at)) {
    throw new Error("Approve an English description for every photo first.");
  }
  const prepared: PdfPhoto[] = [];
  const budget = 10 * 1024 * 1024 / photos.length;

  try {
    for (let index = 0; index < photos.length; index++) {
      const row = photos[index];
      progress("Preparing photo " + (index + 1) + " of " + photos.length + "…");
      const original = await read(row.storage_path);
      let image = await resizePhoto(original, 1200, 0.79);
      if (image.size > budget) image = await resizePhoto(original, 1100, 0.68);
      if (image.size > budget) image = await resizePhoto(original, 950, 0.62);
      prepared.push({ row, image: URL.createObjectURL(image) });
    }
    progress("Building the PDF…");
    const blob = await pdf(<ReportDocument project={project} day={day} photos={prepared} />).toBlob();
    if (blob.size > pdfLimit) {
      throw new Error("The PDF is over 15 MB. Try again with fewer photos in the report.");
    }
    return new File([blob], reportFilename(project.name, day), { type: "application/pdf" });
  } finally {
    for (const photo of prepared) URL.revokeObjectURL(photo.image);
  }
}
