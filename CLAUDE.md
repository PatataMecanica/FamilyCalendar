# Calendario S&A

App de calendario compartido para dos personas, una con Android y otra con iPhone. Es una PWA estática servida por GitHub Pages. Los datos viven en un calendario de Google compartido entre las dos cuentas, al que la app accede con la API de Google Calendar. No hay servidor propio. Todo el texto de la interfaz, los comentarios y la documentación están en español.

- Qué debe hacer y por qué: [`REQUIREMENTS.md`](REQUIREMENTS.md)
- Puesta en marcha (Google Cloud, Pages, instalación): [`SETUP.md`](SETUP.md)
- Presentación para los usuarios: [`README.md`](README.md)

## Estructura

| Archivo | Contenido |
|---|---|
| `index.html` | Esqueleto: iconos SVG, cabecera, vista, barra de navegación y contenedores de hojas y avisos. Carga `js/boot-design.js` en la cabecera |
| `css/styles.css` | Todos los estilos. Componentes con variables; cada estilo (Pastel, Neón, Ochentas) las redefine para claro y oscuro |
| `js/boot-design.js` | Script normal, no módulo: pone modo y estilo antes del primer pintado |
| `js/app.js` | Arranque: sesión, elección de calendario, pestañas, contador de tareas, pastilla de estado y sincronización en segundo plano |
| `js/auth.js` | OAuth 2.0 por redirección (`response_type=token`): pedir, recoger, renovar en silencio y revocar el token |
| `js/api.js` | Llamadas REST a Google Calendar v3 (`googleApi`) |
| `js/demo.js` | Backend en memoria con la misma interfaz que `googleApi` (`?demo=1`) |
| `js/data.js` | Estado compartido (`state`), bus de eventos, caché de rangos, altas, ediciones, borrados y copia sin conexión |
| `js/model.js` | Conversión entre eventos de Google y elementos de la app (`fromGoogle` / `toGoogle`), colores y avisos predefinidos |
| `js/reminders-sync.js` | Avisos «Para los dos» |
| `js/quickadd.js` | Intérprete del alta rápida en español (pestaña Tareas) |
| `js/tasks.js` | Agrupación de la pestaña Tareas (sin DOM, con pruebas) |
| `js/recurrence.js` | Reglas `RRULE`: construir, leer y describir |
| `js/dates.js` | Fechas en hora local, semana empezando en lunes, nombres en español |
| `js/store.js` | `localStorage` con prefijo `sa-cal:`, tolerante a fallos |
| `js/ui/` | `dom.js` (`h()` e `icon()`), `sheet.js` (hojas inferiores), `toast.js`, `editor.js` (formulario, detalle y `openNew` para el «+»), `search.js` (hoja de búsqueda, desde la lupa de Calendario), `swipe.js` (deslizar entre pestañas) |
| `js/views/` | `upcoming.js`, `calendar.js` (Mes/Semana/Día), `tasks.js`, `settings.js` (incluye `applyDesign`), `common.js` (fila de evento o tarea) |
| `js/config.js` | `CLIENT_ID` de OAuth y permisos pedidos |
| `sw.js` | Service worker: guarda la app para abrirla sin conexión |
| `manifest.webmanifest`, `icons/` | Instalación en la pantalla de inicio |
| `fonts/` | Fraunces, DM Sans y Chakra Petch en woff2, incluidas en el repo |
| `tests/` | Pruebas con `node:test` |

No hay dependencias ni compilación. JavaScript (módulos ES) y CSS sin frameworks; mantenerlo así. `package.json` solo existe para `npm test`.

## Ejecutar y probar

```bash
python3 -m http.server 8080   # y abrir http://localhost:8080/?demo=1
npm test                      # intérprete de alta rápida, recurrencia, modelo y agrupación de tareas
node --check js/app.js        # comprobación de sintaxis (repetir por archivo)
```

- **Modo demo** (`?demo=1`): usa `js/demo.js`, con datos de ejemplo relativos a hoy. Sirve para revisar la interfaz sin cuenta; los cambios se pierden al recargar. Si se cambia cómo se llama a la API, actualizar `demoApi` para que siga imitándola. Esto incluye:
  - la expansión de repetidos;
  - el filtro `sharedExtendedProperty`;
  - el `patch` de una instancia.
- **Pruebas con Playwright**:
  - El service worker se registra también en `localhost`. Hay que crear el contexto con `serviceWorkers: 'block'`; si no, las rutas interceptadas no se aplican a partir de la segunda carga.
  - Para probar el camino real de Google sin cuenta:
    - interceptar `js/config.js` con un `CLIENT_ID` falso;
    - responder a `accounts.google.com` con una redirección a `redirect_uri#access_token=…&state=…`;
    - simular `www.googleapis.com/calendar/v3/...`.
- **Para revisar el diseño sin pulsar nada**: poner en el `localStorage`, antes de cargar, `sa-cal:estilo` (`"pastel"`, `"neon"` o `"retro"`) y `sa-cal:tema` (`"auto"`, `"light"` o `"dark"`). Son cadenas JSON, con comillas.
- **Cambios en `js/quickadd.js`**: añadir siempre casos a `tests/quickadd.test.mjs`. Las pruebas fijan «ahora» en el martes 17 de noviembre de 2026 a las 10:00.

## Despliegue

- **App**: GitHub Pages sirve la raíz de `main`. Fusionar en `main` es publicar.
- **Caché**: al cambiar cualquier archivo de la app, subir `VERSION` en `sw.js` (`sa-cal-vX.Y.Z`) y `APP_VERSION` en `js/views/settings.js`.
  - Si se añade o renombra un archivo, ponerlo también en la lista `SHELL` de `sw.js`. Si falta uno, la instalación del service worker falla entera.
  - La versión nueva se ve en la segunda apertura.
- **Google Cloud**: se configura a mano (ver `SETUP.md`).
  - La URL de redirección autorizada debe coincidir exactamente con la de la app, con la barra final.
  - Si se cambian los permisos (`SCOPES` en `js/config.js`), hay que añadirlos también en la pantalla de consentimiento. Avisar al usuario.

## Reglas que no hay que romper

- **Ningún dato personal en el repositorio**, que es público: ni ID del calendario, ni emails, ni nombres, ni eventos. El único valor propio es `CLIENT_ID`, que es público por diseño.
  - Lo personal va en el `localStorage` de cada móvil, a través de `store`.
  - Lo que se pasa de un móvil a otro va en el enlace `#setup=…` de Ajustes, que no se guarda en el historial.
- **Política de seguridad (CSP) de `index.html`**:
  - Nada de scripts en línea ni de otros dominios (`script-src 'self'`).
  - Solo se conecta con `www.googleapis.com` y `oauth2.googleapis.com`.
  - Las tipografías se sirven desde el propio repo.
  - Si hace falta otro dominio, cambiar la CSP a propósito y explicarlo.
- **Construir el DOM con `h()`**, nunca con `innerHTML` sobre datos. Las notas de Google pueden traer HTML; se convierten a texto con `DOMParser` (`stripHtml` en `js/ui/editor.js`).
- **El formato de los datos en Google es un contrato**: lo leen el otro móvil y Google Calendar.
  - Una tarea es un evento con `extendedProperties.shared.fcType = 'task'` y `fcDone` a `'0'` o `'1'`. El título va con «☐ » o «☑ » delante y la app lo quita al mostrarlo.
  - Los avisos compartidos van en `fcRem` (`popup:30,popup:1440`), `fcRemBoth` y `fcRemV`.
  - No renombrar estas claves ni cambiar su formato sin migrar los eventos existentes.
- **Los avisos de Google son de cada cuenta.** `reminders-sync.js` aplica los de `fcRem` a la cuenta que abre la app.
  - En los eventos repetidos, el parche va al evento principal (`recurringEventId`), nunca a una instancia, para no crear excepciones.
  - Lo ya aplicado se guarda en `remApplied` por versión, para no pisar cambios hechos a mano.
- **Eventos repetidos**: se listan expandidos (`singleEvents=true`).
  - Editar «Solo este» parchea solo esa instancia, que no puede llevar regla propia.
  - Editar «Toda la serie» parchea el evento principal conservando su fecha de inicio y aplicando la hora y duración nuevas (`updateItem` en `js/data.js`).
  - «Deshacer» un borrado solo se ofrece en eventos no repetidos.
- **Fechas en hora local** con las funciones de `js/dates.js`:
  - En los eventos de día completo, `end` es exclusivo (el día siguiente al último) y se envía como `date`.
  - Los eventos con hora se envían con `toRFC3339`, que lleva el desfase horario, y con `timeZone`.
  - No usar `toISOString()` para fechas de día completo: pasa a UTC y puede cambiar de día.
- **Sesión**:
  - Una respuesta 401 lanza `AuthError` y emite `auth-required`.
  - La renovación silenciosa (`prompt=none`) se intenta como mucho cada 2 minutos (`canTrySilent`), para no entrar en bucle de redirecciones.
  - El token y el email (`loginHint`) solo se guardan en el móvil.
- **Gesto lateral**: deslizar en horizontal es solo para cambiar de pestaña (`js/ui/swipe.js`). No añadir otros gestos horizontales en las vistas; lo que tenga desplazamiento horizontal propio queda fuera del gesto automáticamente.
  - La pestaña vecina se pinta con las mismas funciones que la de verdad (`paintView` en `js/app.js`) dentro de una página `.peek` inerte. Las vistas no deben depender de ids ni dejar efectos al pintarse.
- **Hojas inferiores y botón «atrás»**: `js/ui/sheet.js` mantiene una entrada en el historial mientras hay hojas abiertas. No llamar a `history.back()` ni `pushState` por otro lado.
- **Colores de evento**: son los 11 `colorId` de Google más el del calendario.
  - En JavaScript solo se usa `colorHex(id)`, que devuelve `var(--ev-N)`. El tono lo pone cada estilo en `css/styles.css`.
  - No escribir colores sueltos en el código.
- **Eventos y tareas se distinguen siempre a simple vista**: el evento lleva la hora y una barrita de su color; la tarea, una casilla redonda y un fondo más suave. Es un requisito.

## Diseño

Importa mucho. Es el mismo sistema de diseño que Gastos S&A (repositorio `PatataMecanica/GastosApp`); si allí cambian variables o componentes, valorar copiarlos aquí. Hay tres estilos, elegibles en Ajustes junto con el modo (sistema, claro u oscuro):

- **Pastel** (por defecto): elegante, colores pastel o mate. Fraunces para títulos y cifras, DM Sans para el texto.
- **Neón**: futurista, verdes y azules de neón con detalles en rosa. Chakra Petch para títulos y cifras. Vive bajo `[data-style="neon"]` en `css/styles.css`.
- **Ochentas** (`retro`): estridente y muy colorido a propósito, con sombras duras de colores y fondo de topos (claro) o de rejilla (oscuro). Bajo `[data-style="retro"]`, después del Neón.

Cómo está montado:
- El aspecto depende de `data-style` y `data-theme` en `<html>`. Los pone `js/boot-design.js` antes de pintar y `applyDesign()` (`js/views/settings.js`) al cambiarlos. `applyDesign()` también copia `--bg` a las etiquetas `theme-color`.
- El CSS no usa `prefers-color-scheme`.
- Los componentes se escriben una vez con variables (`--bg`, `--surface`, `--ink`, `--accent`, `--shadow`, `--ev-N`…). Un estilo es otro juego de valores más unos pocos remates al final del archivo.
- **Para añadir un estilo**:
  1. Añadirlo a `ESTILOS` en `js/views/settings.js` y a la comprobación de `js/boot-design.js`.
  2. Escribir sus variables para claro y oscuro, colores de evento incluidos.
  3. Añadir una muestra `.sw.clave`. El selector es una rejilla de tres columnas; con un cuarto estilo habría que rehacerlo.

Usar las variables de `css/styles.css` en lugar de colores sueltos. Comprobar siempre los tres estilos en claro y oscuro a ancho de móvil (390 px): Próximos, las tres vistas del calendario, el formulario, el detalle, Tareas, la hoja de búsqueda, Ajustes y la pantalla de acceso.
