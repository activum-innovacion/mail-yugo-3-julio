// TEMPORAL — solo para descubrir el ID de la columna "Fecha y hora visita
// inicio" y los labels de "Estado Lead". Se elimina tras usarlo.

export default async function handler(req, res) {
  try {
    const r = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: process.env.MONDAY_API_TOKEN,
        "API-Version": "2024-10",
      },
      body: JSON.stringify({
        query: `query {
          boards(ids: [${process.env.MONDAY_BOARD_ID || "5098228821"}]) {
            columns { id title type settings_str }
          }
        }`,
      }),
    });
    const json = await r.json();
    const columns = (json.data?.boards?.[0]?.columns || []).map((col) => ({
      id: col.id,
      title: col.title,
      type: col.type,
      // Solo interesan los labels de las columnas de estado/dropdown.
      settings: ["status", "dropdown"].includes(col.type) ? col.settings_str : undefined,
    }));
    res.status(200).json({ columns, errors: json.errors });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
