// Endpoint invocado desde el botón "Estoy interesado" del email.
// 1) Identifica al lead (por itemId o por email).
// 2) Pone su estado en "Acción comercial" y la campaña en "Mailing Admisión 6/7/26".
// 3) Redirige al lead a la página de gracias / reserva de visita.
//
// Nunca muestra error al usuario: pase lo que pase, redirige. Los fallos
// quedan registrados en los logs de Vercel para poder revisarlos.

const MONDAY_API = "https://api.monday.com/v2";

async function mondayRequest(query, variables) {
  const res = await fetch(MONDAY_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: process.env.MONDAY_API_TOKEN,
      "API-Version": "2024-10",
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error(JSON.stringify(json.errors));
  }
  return json.data;
}

// Busca el id del item a partir del email (columna de email del tablero).
async function findItemIdByEmail(boardId, emailColumnId, email) {
  const query = `
    query ($boardId: ID!, $columnId: String!, $value: String!) {
      items_page_by_column_values(
        board_id: $boardId,
        limit: 1,
        columns: [{ column_id: $columnId, column_values: [$value] }]
      ) {
        items { id }
      }
    }`;
  const data = await mondayRequest(query, {
    boardId,
    columnId: emailColumnId,
    value: email,
  });
  const items = data?.items_page_by_column_values?.items || [];
  return items[0]?.id || null;
}

// Actualiza varias columnas del item en una sola operación (estado + campaña).
// `values` es un objeto { columnId: valorSegunTipo }.
async function updateLead(boardId, itemId, values) {
  const query = `
    mutation ($boardId: ID!, $itemId: ID!, $values: JSON!) {
      change_multiple_column_values(
        board_id: $boardId,
        item_id: $itemId,
        column_values: $values,
        create_labels_if_missing: true
      ) {
        id
      }
    }`;
  return mondayRequest(query, { boardId, itemId, values: JSON.stringify(values) });
}

export default async function handler(req, res) {
  const {
    MONDAY_BOARD_ID = "5098228821",
    // IDs reales del tablero "Leads" (verificados vía API).
    MONDAY_STATUS_COLUMN_ID = "color_mm3qa08v", // "Estado Lead"
    MONDAY_EMAIL_COLUMN_ID = "email_mm3q9xk", // "E-mail"
    MONDAY_STATUS_LABEL = "Acción comercial", // ya existe como label en la columna
    MONDAY_CAMPAIGN_COLUMN_ID = "dropdown_mm50d5ca", // "Campaña" (dropdown)
    MONDAY_CAMPAIGN_LABEL = "Mailing Admisión 6/7/26", // ya existe como opción del dropdown

    CLICK_SECRET,
    REDIRECT_URL = "/gracias.html",
  } = process.env;

  const { itemId, email, k } = req.query;

  // Redirige siempre para no romper la experiencia del lead.
  const redirect = () => res.redirect(302, REDIRECT_URL);

  try {
    // Clave compartida: evita que cualquiera dispare el endpoint a lo bruto.
    if (CLICK_SECRET && k !== CLICK_SECRET) {
      console.warn("Clave inválida o ausente en la petición.");
      return redirect();
    }

    let id = itemId;
    if (!id && email) {
      id = await findItemIdByEmail(MONDAY_BOARD_ID, MONDAY_EMAIL_COLUMN_ID, email);
    }
    if (!id) {
      console.warn("No se pudo identificar el lead (ni itemId ni email válidos).");
      return redirect();
    }

    const values = {
      [MONDAY_STATUS_COLUMN_ID]: { label: MONDAY_STATUS_LABEL },
      [MONDAY_CAMPAIGN_COLUMN_ID]: { labels: [MONDAY_CAMPAIGN_LABEL] },
    };
    await updateLead(MONDAY_BOARD_ID, id, values);
    console.log(`Lead ${id}: estado "${MONDAY_STATUS_LABEL}", campaña "${MONDAY_CAMPAIGN_LABEL}".`);
  } catch (err) {
    console.error("Error actualizando Monday:", err);
  }

  return redirect();
}
