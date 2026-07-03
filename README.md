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
   | `MONDAY_BOARD_ID` | Opcional | Por defecto `5098228821` (tablero "Leads") |
   | `MONDAY_STATUS_COLUMN_ID` | Opcional | Por defecto `color_mm3qa08v` ("Estado Lead") ✅ verificado |
   | `MONDAY_EMAIL_COLUMN_ID` | Opcional | Por defecto `email_mm3q9xk` ("E-mail") ✅ verificado |
   | `MONDAY_STATUS_LABEL` | Opcional | Por defecto `Acción comercial` (ya existe como label) |

   > Los IDs por defecto están verificados contra el tablero real, así que **solo necesitas
   > `MONDAY_API_TOKEN` y `CLICK_SECRET`**. Las demás son opcionales.

4. **Deploy.** Vercel te da una URL tipo `https://tu-proyecto.vercel.app`.

## Conectar el email

En `yugo-cartuja-admisiones.html`, el botón "Estoy interesado" apunta a:

```
https://mail-yugo-3-julio.vercel.app/api/interesado?email={pulse.marketing_contact_email}&k=TU_CLAVE_SECRETA
```

- Cambia `TU_CLAVE_SECRETA` por el valor de `CLICK_SECRET`.
- `{pulse.marketing_contact_email}` es el token de Monday con el email del lead, y `{pulse.name}` (usado en el saludo) con su nombre.

## IDs de columna de Monday (verificados)

Ya están fijados en `api/interesado.js`, no hace falta configurarlos:

- Estado: `color_mm3qa08v` ("Estado Lead"), label objetivo **"Acción comercial"** (ya existe).
- Email: `email_mm3q9xk` ("E-mail").

## Cómo funciona

1. El lead pulsa "Estoy interesado" en el email.
2. Vercel recibe el email (`{pulse.marketing_contact_email}`) y la clave `k`.
3. Si la clave es válida, busca el item por email en Monday y pone "Estado Lead" en **Acción comercial**.
4. Redirige al lead a la página de gracias (o al enlace de visita).
