// Endpoint invocado desde el botón CTA de los emails.
// 1) Identifica al lead (por itemId o por email).
// 2) Actualiza su estado y campaña según el parámetro `c` del enlace
//    (sin `c` → mailing de admisión, estado "Acción comercial").
//    Para la JPA (`c=jpa`), el parámetro `h` indica la franja horaria elegida:
//    el lead pasa a "Visita agendada" y se rellena la fecha/hora de visita.
// 3) Redirige al lead a la página de gracias correspondiente.
//
// Nunca muestra error al usuario: pase lo que pase, redirige. Los fallos
// quedan registrados en los logs de Vercel para poder revisarlos.

const MONDAY_API = "https://api.monday.com/v2";

// Campañas seleccionables desde el enlace del email vía `c`. Se mapean aquí
// (y no como texto libre en la URL) para que nadie pueda crear labels
// arbitrarios en Monday. Un valor desconocido cae en la campaña por defecto.
const CAMPAIGNS = {
  jpa: {
    label: "Mailing JPA 17/7/26",
    status: "Visita Agendada", // así, con mayúscula: es el label exacto del tablero
    redirect: "/gracias-jpa.html",
    visitDate: "2026-07-17",
    // Monday interpreta la hora en UTC. Estas son las franjas de 10:30,
    // 12:00 y 13:30 hora de Sevilla (CEST, UTC+2, vigente el 17/7/2026).
    slots: { 1030: "08:30:00", 1200: "10:00:00", 1330: "11:30:00" },
    // Sobrescribe el origen original del lead (TikTok, Google…): decidido así
    // para atribuir a la JPA los leads que reservan visita desde este mail.
    originColumnId: "color_mm3qd8bq",
    originLabel: "JPA",
    // "Ubicación visita" → Presencial se envía en una mutación aparte y en
    // último lugar: su cambio dispara un automatismo en Monday que necesita
    // el resto de columnas ya rellenas.
    locationColumnId: "color_mm3qyqsn",
    locationLabel: "Presencial",
  },
};

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
    MONDAY_CAMPAIGN_LABEL = "Mailing Admisión 17/7/26", // se crea solo si no existe (create_labels_if_missing)
    MONDAY_VISIT_COLUMN_ID = "date_mm3qtz5n", // "Fecha y hora inicio visita" (verificado vía API)

    CLICK_SECRET,
    REDIRECT_URL = "/gracias.html",
  } = process.env;

  const { itemId, email, k, c, h } = req.query;

  const campaign =
    typeof c === "string" && Object.hasOwn(CAMPAIGNS, c)
      ? CAMPAIGNS[c]
      : { label: MONDAY_CAMPAIGN_LABEL, status: MONDAY_STATUS_LABEL, redirect: REDIRECT_URL };

  // Franja horaria elegida (solo en campañas con visita, p. ej. la JPA).
  const slotTime =
    campaign.slots && typeof h === "string" && Object.hasOwn(campaign.slots, h)
      ? campaign.slots[h]
      : null;

  // Redirige siempre para no romper la experiencia del lead. La página de
  // gracias de la JPA muestra la franja elegida si va en la query.
  const redirect = () =>
    res.redirect(302, slotTime ? `${campaign.redirect}?h=${h}` : campaign.redirect);

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
      [MONDAY_STATUS_COLUMN_ID]: { label: campaign.status },
      [MONDAY_CAMPAIGN_COLUMN_ID]: { labels: [campaign.label] },
    };
    if (campaign.originColumnId) {
      values[campaign.originColumnId] = { label: campaign.originLabel };
    }
    if (slotTime) {
      if (MONDAY_VISIT_COLUMN_ID) {
        values[MONDAY_VISIT_COLUMN_ID] = { date: campaign.visitDate, time: slotTime };
      } else {
        console.warn("MONDAY_VISIT_COLUMN_ID no configurado: la franja elegida no se guarda en Monday.");
      }
    }
    await updateLead(MONDAY_BOARD_ID, id, values);
    if (slotTime && campaign.locationColumnId) {
      await updateLead(MONDAY_BOARD_ID, id, {
        [campaign.locationColumnId]: { label: campaign.locationLabel },
      });
    }
    console.log(
      `Lead ${id}: estado "${campaign.status}", campaña "${campaign.label}"` +
        (slotTime ? `, visita ${campaign.visitDate} ${slotTime} (${campaign.locationLabel}).` : ".")
    );
  } catch (err) {
    console.error("Error actualizando Monday:", err);
  }

  return redirect();
}
