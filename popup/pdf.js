function sanitizeFilename(name) {
  return (name || "summary")
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "summary";
}

function addPdfLines(doc, lines, x, startY, lineHeight, bottomMargin) {
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = startY;

  for (const line of lines) {
    if (y > pageHeight - bottomMargin) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, x, y);
    y += lineHeight;
  }

  return y;
}

function downloadSummaryPdf(item) {
  if (!window.jspdf?.jsPDF) {
    throw new Error("PDF library failed to load. Reload the extension.");
  }

  const doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
  const margin = 14;
  const maxWidth = 182;
  let y = 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  const titleLines = doc.splitTextToSize(item.title || "Summary", maxWidth);
  y = addPdfLines(doc, titleLines, margin, y, 8, 20) + 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);

  const metaLines = [
    `Saved: ${new Date(item.createdAt).toLocaleString()}`,
    `Source: ${item.url || "Unknown"}`,
  ];

  y = addPdfLines(doc, metaLines, margin, y, 5, 20) + 4;
  doc.setTextColor(0);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  y = addPdfLines(doc, ["Summary"], margin, y, 6, 20) + 2;

  doc.setFont("helvetica", "normal");
  const summaryLines = doc.splitTextToSize(item.summary || "", maxWidth);
  addPdfLines(doc, summaryLines, margin, y, 6, 20);

  doc.save(`${sanitizeFilename(item.title)}.pdf`);
}

window.PageSummarizerPdf = {
  downloadSummaryPdf,
};
