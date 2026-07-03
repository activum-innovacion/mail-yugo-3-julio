# Yugo La Cartuja — email de admisiones + webhook CRM

Email interactivo para leads de Monday. El botón **"Estoy interesado"** llama a
una función serverless en Vercel que cambia el estado del lead a
**Acción comercial** en el tablero de Monday y redirige a una página de gracias.

## Estructura

```
yugo-cartuja-admisiones.html   → el email (no se despliega, es el HTML a enviar)
api/interesado.js              → función serverless que actualiza Monday
public/gracias.html            → página de gracias (post-click)
package.json                   → config del proyecto
```

## Despliegue (GitHub + Vercel)

1. **Sube esta carpeta a un repo de GitHub.**
2. En [vercel.com](https://vercel.com) → **Add New → Project** → importa el repo.
   Framework preset: **Other** (no hace falta build).
3. Añade las **variables de entorno** (Settings → Environment Variables):

   | Variable | Obligatoria | Valor |
   |---|---|---|
   | `MONDAY_API_TOKEN` | ✅ | Token de la API de Monday (Perfil → Developers → My Access Tokens) |
   | `CLICK_SECRET` | Recomendada | Una clave inventada, ej. `yugo-2026-x7q2`. Debe coincidir con la del enlace del email |
   | `REDIRECT_URL` | Opcional | A dónde redirigir tras el click. Por defecto `/gracias.html`. Puedes poner directamente tu enlace de reserva de visita |
   | `MONDAY_BOARD_ID` | Opcional | Por defecto `5098228821` |
   | `MONDAY_STATUS_COLUMN_ID` | Opcional | ID de la columna de estado. Por defecto `status` (⚠️ verifícalo, ver abajo) |
   | `MONDAY_EMAIL_COLUMN_ID` | Opcional | ID de la columna de email. Por defecto `email` (⚠️ verifícalo) |
   | `MONDAY_STATUS_LABEL` | Opcional | Por defecto `Acción comercial` |

4. **Deploy.** Vercel te da una URL tipo `https://tu-proyecto.vercel.app`.

## Conectar el email

En `yugo-cartuja-admisiones.html`, el botón "Estoy interesado" apunta a:

```
https://TU-PROYECTO.vercel.app/api/interesado?email={{email}}&k=TU_CLAVE_SECRETA
```

- Cambia `TU-PROYECTO` por tu dominio real de Vercel.
- Cambia `TU_CLAVE_SECRETA` por el valor de `CLICK_SECRET`.
- `{{email}}` es el **token de personalización de Monday** (ajústalo al que uséis al enviar; también sirve `{{item_id}}` usando el parámetro `itemId=` en vez de `email=`).

## ⚠️ Verificar los IDs de columna de Monday

Los valores por defecto (`status`, `email`) pueden no coincidir con los reales del
tablero. Para obtener los IDs correctos, en la API de Monday:

```graphql
query {
  boards(ids: 5098228821) {
    columns { id title type }
  }
}
```

Copia el `id` de la columna de estado y de la de email a las variables de entorno.
También asegúrate de que existe el label **"Acción comercial"** en la columna de
estado (si no, el endpoint lo crea automáticamente).

## Cómo funciona

1. El lead pulsa "Estoy interesado" en el email.
2. Vercel recibe `email` (o `itemId`) y la clave `k`.
3. Si la clave es válida, busca el item en Monday y pone su estado en **Acción comercial**.
4. Redirige al lead a la página de gracias (o al enlace de visita).
