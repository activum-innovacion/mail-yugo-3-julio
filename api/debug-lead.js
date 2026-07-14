// TEMPORAL — inspecciona las columnas de un lead por email para verificar la
// prueba del mail JPA. Se elimina tras usarlo.

export default async function handler(req, res) {
  try {
    const email = String(req.query.email || "");
    const r = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: process.env.MONDAY_API_TOKEN,
        "API-Version": "2024-10",
      },
      body: JSON.stringify({
        query: `query ($boardId: ID!, $value: String!) {
          items_page_by_column_values(
            board_id: $boardId,
            limit: 1,
            columns: [{ column_id: "email_mm3q9xk", column_values: [$value] }]
          ) {
            items {
              id
              name
              column_values(ids: ["color_mm3qa08v", "date_mm3qtz5n", "dropdown_mm50d5ca"]) {
                id
                text
              }
            }
          }
        }`,
        variables: { boardId: process.env.MONDAY_BOARD_ID || "5098228821", value: email },
      }),
    });
    const json = await r.json();
    res.status(200).json({
      items: json.data?.items_page_by_column_values?.items ?? [],
      errors: json.errors,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
