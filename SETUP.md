# Puesta en marcha · Calendario S&A

Guía paso a paso (unos 15 minutos). Solo hay que hacerlo **una vez**.
Lo haces tú desde tu cuenta de Google; tu pareja solo tendrá que abrir un enlace e instalar la app.

> **Privacidad.** En el repositorio solo va el *ID de cliente* de Google, que es público por diseño:
> Google únicamente lo acepta desde la dirección de vuestra web. El ID del calendario, los emails y las
> preferencias se guardan **solo en cada móvil** (almacenamiento local), nunca en GitHub.

En los pasos se usa como ejemplo esta dirección: `https://patatamecanica.github.io/FamilyCalendar/`.
Si tu usuario o tu repositorio se llaman distinto, usa la tuya: siempre `https://<usuario>.github.io/<repositorio>/`, con la barra final.

---

## 1. Publicar la web en GitHub Pages

1. Fusiona esta rama en `main`. Otra opción es publicar directamente desde la rama de trabajo.
2. En GitHub, ve a **Settings → Pages**.
3. En **Build and deployment → Source**, elige *Deploy from a branch*.
4. Elige la rama `main` y la carpeta `/ (root)`, y pulsa **Save**.
5. Al cabo de un minuto la web estará en `https://patatamecanica.github.io/FamilyCalendar/`.
   Al abrirla verás la pantalla «Configuración pendiente». Es normal.

> GitHub Pages gratuito necesita que el repositorio sea **público**. No pasa nada: el código no contiene datos vuestros.

## 2. Crear el proyecto en Google Cloud

1. Entra en <https://console.cloud.google.com/> con tu cuenta de Google.
2. Arriba, en el selector de proyectos, pulsa **Nuevo proyecto**. Llámalo, por ejemplo, `Calendario SA` y pulsa **Crear**.
3. Comprueba que el proyecto nuevo está seleccionado en la barra superior.

## 3. Activar la API de Google Calendar

1. Ve al menú **APIs y servicios → Biblioteca**.
2. Busca **Google Calendar API**, ábrela y pulsa **Habilitar**.

## 4. Configurar la pantalla de consentimiento (OAuth)

Ve a **APIs y servicios → Pantalla de consentimiento de OAuth**. En la consola nueva se llama *Google Auth Platform*.

1. **Tipo de usuario**: *Externo*.
2. **Nombre de la app**: `Calendario S&A`. **Correo de asistencia** y **correo de contacto del desarrollador**: el tuyo.
3. **Permisos** (*Scopes* o *Acceso a datos*): añade estos dos:
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/calendar.calendarlist.readonly`
4. **Usuarios de prueba** (*Audiencia*): añade **tu email y el de tu pareja**.
5. **Estado de publicación**. Hay dos opciones:
   - **En prueba**: funciona para los usuarios de prueba, pero Google puede volver a pedir el permiso cada 7 días.
   - **En producción** (recomendado, botón *Publicar app*): no hace falta enviarla a verificación para un uso personal. Al entrar la primera vez, Google mostrará el aviso de *app no verificada*; pulsa **Configuración avanzada → Ir a Calendario S&A**. Después no vuelve a salir.

## 5. Crear el ID de cliente

1. Ve a **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**. En la consola nueva: *Clientes → Crear cliente*.
2. **Tipo de aplicación**: *Aplicación web*. **Nombre**: `Calendario S&A web`.
3. **Orígenes de JavaScript autorizados**: añade `https://patatamecanica.github.io`
4. **URIs de redirección autorizados**: añade `https://patatamecanica.github.io/FamilyCalendar/`. Con la barra final, exactamente así. Si alguna vez entras por `.../FamilyCalendar/index.html`, añade también esa URL.
5. Pulsa **Crear** y copia el **ID de cliente**. Tiene esta forma: `1234567890-abc123.apps.googleusercontent.com`.

> Para probar en tu ordenador con `python3 -m http.server 8080`, añade también el origen `http://localhost:8080` y la redirección `http://localhost:8080/`.

## 6. Pegar el ID de cliente en el código

Edita `js/config.js` (puedes hacerlo desde la web de GitHub) y sustituye el texto de ejemplo:

```js
CLIENT_ID: '1234567890-abc123.apps.googleusercontent.com',
```

Guarda el cambio (*commit*) en la rama publicada. En uno o dos minutos la web ya mostrará **Continuar con Google**.

## 7. Primer inicio de sesión (tú)

1. Abre la web en el móvil y pulsa **Continuar con Google**.
2. Acepta los permisos.
3. Elige vuestro **calendario compartido** en la lista. Queda recordado en el móvil.
4. Ve a **Ajustes → Enlace de configuración** y envíaselo a tu pareja por WhatsApp o Mensajes.
   El enlace lleva el calendario elegido, así que su móvil queda configurado sin copiar nada.
   El enlace no da acceso a nadie: hace falta iniciar sesión con una cuenta que ya tenga permiso sobre el calendario.

> Requisito: el calendario debe estar compartido con la cuenta de tu pareja con el permiso **Hacer cambios en eventos**. Se configura en Google Calendar → Configuración del calendario → Compartir con determinadas personas.

## 8. Instalar la app en el móvil

**Android (Chrome)**
1. Abre la web en Chrome.
2. Abre el menú **⋮** y pulsa **Instalar aplicación** (o *Añadir a pantalla de inicio*).

**iPhone (Safari)**
1. Abre la web **en Safari**. Desde otros navegadores no se puede instalar.
2. Pulsa el botón **Compartir** (el cuadrado con la flecha) y luego **Añadir a pantalla de inicio**.
3. Abre la app **desde el icono** e inicia sesión dentro de ella. En iPhone, la app instalada tiene su propia sesión, distinta de la de Safari.

## 9. Recibir los avisos en el móvil

Los avisos los envía **Google Calendar**, no esta web (una web sin servidor no puede mandar notificaciones). Por eso:

- Tened instalada la app oficial de **Google Calendar**, con las notificaciones activadas y vuestra cuenta añadida.
- En Google Calendar, comprobad que el calendario compartido está visible (marcado) y con las notificaciones activadas.
- **«Para los dos»**: en Google, cada aviso es personal. Si al crear un evento activas «Para los dos», la app guarda los avisos dentro del evento. La próxima vez que tu pareja abra la app, se aplican automáticamente a su cuenta (y viceversa).
  Límite: a la otra persona solo le llegan después de abrir la app al menos una vez desde que se creó el evento. Se aplican a los eventos de los próximos 60 días.

## Preguntas frecuentes

- **¿Por qué a veces pide «Continuar»?** Google da a las apps web sin servidor un acceso que dura 1 hora. Al caducar, la app intenta renovarlo sola. Si no puede, basta un toque en *Continuar*, sin contraseña.
- **¿Qué ve el otro en Google Calendar?** Todo aparece igual. Las tareas se ven como eventos de día completo con «☐» delante, o «☑» cuando están hechas.
- **¿Y los colores?** La app usa los 11 colores de Google con tonos propios de cada estilo. En Google Calendar se ven con el color equivalente de Google.
- **¿Puedo probarla sin cuenta?** Sí: abre la web con `?demo=1` al final de la dirección.
- **Error `redirect_uri_mismatch`**: la URL autorizada en el paso 5 no coincide exactamente con la de la app. Revisa la barra final y si usas `index.html`. En la pantalla «Configuración pendiente» la app muestra la URL exacta que espera.
- **Error `access_denied` o «app bloqueada»**: comprueba que vuestros emails están en *Usuarios de prueba*, o que la app está *En producción*.
