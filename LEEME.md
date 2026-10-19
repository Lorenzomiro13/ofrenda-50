# Ofrenda 50 Aniversario — cómo publicarlo

```
ofrenda-netlify/
├── netlify.toml                 ← configuración (no tocar)
├── netlify/functions/api.mjs    ← puente seguro con Google Sheets
├── public/                      ← la web
│   ├── index.html   → formulario de inscripción
│   ├── tarjeta.html → tarjeta QR descargable
│   ├── lector.html  → entrega de ramos (comisión, con PIN)
│   └── panel.html   → panel de seguimiento (comisión, con PIN)
└── apps-script/Api.gs          ← archivo NUEVO para añadir al Apps Script
```

> **Importante:** sube la carpeta **completa** `ofrenda-netlify`, no solo `public`.
> Si arrastras solo `public` a Netlify Drop, la web se ve pero no guarda nada (falta la función `/api`).

---

## Paso 1 · Google Sheets (5 min) — NO se borra nada

1. Abre el Google Sheets → **Extensiones › Apps Script**. Deja `Código.gs` **tal como está**.
2. Pulsa **＋ › Secuencia de comandos**, llámalo `Api` y pega dentro `apps-script/Api.gs`. Guarda.
3. **Configuración del proyecto (rueda) › Propiedades del script › Añadir**:
   `API_KEY` = una clave de 32+ letras y números (apúntala, se pone igual en Netlify).
4. El PIN es el que ya usáis en el lector (menú 🌸 OFRENDA 50 › Configurar PIN del lector).
5. **Implementar › Gestionar implementaciones** → lápiz → Versión: **Nueva versión** → Implementar.
   Comprueba «Ejecutar como: Yo» y «Acceso: Cualquier persona». Copia la URL que acaba en `/exec`.

## Paso 2 · Netlify (5 min)

**Opción A — la más fácil, sin GitHub (Netlify CLI):**

```bash
cd ofrenda-netlify
npx netlify-cli login
npx netlify-cli deploy --prod
```
Elige «Create & configure a new project». Netlify sube la web **y** la función.

**Opción B — con GitHub:** sube esta carpeta a un repositorio y en Netlify pulsa *Add new project › Import from Git*. Cada cambio en GitHub se publica solo.

Después, en Netlify → **Project configuration › Environment variables**, añade:

| Variable | Valor |
|---|---|
| `APPS_SCRIPT_URL` | La URL `/exec` del paso 1 |
| `OFRENDA_API_KEY` | La clave API del paso 1 (exactamente igual) |

Y vuelve a desplegar (**Deploys › Trigger deploy**).

## Paso 3 · Que los correos apunten a Netlify

En la hoja **CONFIGURACION** añade una fila: `WEBAPP_URL` | `https://TU-SITIO.netlify.app` (sin barra final).
Las tarjetas de los correos se abrirán ya en la nueva web. Los enlaces antiguos siguen funcionando.

## Prueba rápida

1. Inscribe a una persona con flor → llega el correo con QR.
2. Abre `/lector.html`, entra con tu nombre y el PIN, escanea el QR → «Entregar ramo».
3. Vuelve a escanearlo → debe salir **«Ya entregado»**.
4. Abre `/panel.html` y comprueba las cifras.

## Qué ha cambiado en el diseño

- **Inscripción en 3 pasos**: buscador instantáneo (sin acentos, con filtro por grupo), botones grandes Sí/No, barra inferior con el resumen y el botón de enviar siempre a mano, pantalla de confirmación.
- **Tarjeta** tipo entrada, lista para guardar en PDF.
- **Lector**: el PIN y el nombre se piden una vez; contador de ramos entregados; lectura más rápida (lector nativo del móvil cuando existe); resultado en verde / ámbar / rojo y vibración al leer.
- **Panel**: barras de progreso, filtros, «Copiar lista» de pendientes y refresco automático cada 2 min.
- Los enlaces a Lector y Panel ya no aparecen en la página pública (solo un discreto «Acceso comisión» abajo).

Tu Apps Script actual **no cambia**: solo se añade `Api.gs`. QR, PIN y enlaces ya enviados siguen valiendo.

## Límites a tener en cuenta
- La inscripción es pública: cualquiera con el enlace ve la lista nominal y puede responder por otro. El enlace de edición del correo sí es privado.
- Los códigos de 6 cifras son cortos; por eso consultar y entregar exige PIN.
- Los QR se generan con quickchart.io (solo se envía el código, nunca nombres).
