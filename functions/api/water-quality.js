import * as XLSX from "xlsx";

const REPORT_URL =
  "https://adem.alabama.gov/Programs/coastalbeaches/WQsummary_13.xls";

export async function onRequest() {
  try {
    const response = await fetch(REPORT_URL);

    if (!response.ok) {
      return Response.json(
        {
          error: "Failed to fetch ADEM water quality report",
          status: response.status
        },
        { status: 502 }
      );
    }

    const arrayBuffer = await response.arrayBuffer();

    const workbook = XLSX.read(arrayBuffer, {
      type: "array",
      cellDates: true
    });

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: ""
    });

    const parsedRows = rows
      .filter(row => row.some(cell => String(cell).trim() !== ""))
      .map(row => row.map(cell => String(cell).trim()));

    return Response.json(
      {
        source: "Alabama Department of Environmental Management",
        reportUrl: REPORT_URL,
        sheetName,
        updatedAt: new Date().toISOString(),
        rows: parsedRows
      },
      {
        headers: {
          "Cache-Control": "public, max-age=3600"
        }
      }
    );
  } catch (error) {
    return Response.json(
      {
        error: "Unable to parse water quality report",
        message: error.message
      },
      { status: 500 }
    );
  }
}
