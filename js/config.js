// Configuración pública de la app.
//
// CLIENT_ID: el "ID de cliente OAuth" de Google Cloud (ver SETUP.md).
// NO es un secreto: Google solo lo acepta desde las URLs autorizadas en tu proyecto
// (p. ej. https://<usuario>.github.io/<repo>/), así que es seguro tenerlo en un repositorio público.
//
// No pongas aquí el ID del calendario, emails ni nombres: la app los pide tras iniciar sesión
// y los guarda solo en el dispositivo.

export const CONFIG = {
  CLIENT_ID: 'PEGA_AQUI_TU_CLIENT_ID.apps.googleusercontent.com',

  // Permisos mínimos: gestionar eventos + ver la lista de calendarios para elegir el compartido.
  SCOPES: [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  ],
};
