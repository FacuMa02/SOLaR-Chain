import XLSX from "xlsx-js-style";

function sanitizeFileName(name) {
    return String(name || "export")
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/_+/g, "_");
}

export function buildExcelBuffer({ sheetName = "Datos", rows = [] }) {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);

    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");
    const headerStyle = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { patternType: "solid", fgColor: { rgb: "6B8E23" } },
        alignment: { horizontal: "center", vertical: "center" },
    };

    for (let col = range.s.c; col <= range.e.c; col += 1) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        if (worksheet[cellAddress]) {
            worksheet[cellAddress].s = headerStyle;
        }
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

export function sendExcelFile(res, { buffer, fileName = "export.xlsx" }) {
    const safeName = sanitizeFileName(fileName);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    res.send(buffer);
}