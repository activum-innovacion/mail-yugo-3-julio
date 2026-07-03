// TEMPORAL: verificación de solo lectura. Se elimina tras validar.
// - sin ?email: devuelve algunos items con su email (para tener uno real).
// - con ?email=...: prueba la búsqueda por columna de email (misma que usa interesado.js).
const BOARD = "5098228821";
const EMAIL_COL = "email_mm3q9xk";

async function md(query, variables) {
  const r = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: process.env.MONDAY_API_TOKEN,
      "API-Version": "2024-10",
    },
    body: JSON.stringify({ query, variables }),
  });
  return r.json();
}

export default async function handler(req, res) {
  if (req.query.token !== "diag-yugo-2026") {
    return res.status(403).json({ error: "forbidden" });
  }
  try {
    if (req.query.email) {
      const q = `query ($v: String!) {
        items_page_by_column_values(board_id: ${BOARD}, limit: 5, columns: [{ column_id: "${EMAIL_COL}", column_values: [$v] }]) {
          items { id name }
        }
      }`;
      const j = await md(q, { v: req.query.email });
      return res.status(200).json(j);
    }
    const q = `query {
      boards(ids: ${BOARD}) {
        items_page(limit: 5) {
          items { id name column_values(ids: ["${EMAIL_COL}"]) { text } }
        }
      }
    }`;
    const j = await md(q, {});
    return res.status(200).json(j);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
