// TEMPORAL: lee las columnas del tablero para verificar los IDs correctos.
// Se elimina tras la verificación. Protegido por token en la query.
export default async function handler(req, res) {
  if (req.query.token !== "diag-yugo-2026") {
    return res.status(403).json({ error: "forbidden" });
  }
  const boardId = process.env.MONDAY_BOARD_ID || "5098228821";
  const query = `query ($b: [ID!]) { boards(ids: $b) { name columns { id title type settings_str } } }`;
  try {
    const r = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: process.env.MONDAY_API_TOKEN,
        "API-Version": "2024-10",
      },
      body: JSON.stringify({ query, variables: { b: [boardId] } }),
    });
    const j = await r.json();
    return res.status(200).json(j);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
