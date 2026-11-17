# Calendario S&A

Calendario compartido para dos, sobre **Google Calendar**, más directo que la app de Google.
Es una web instalable (PWA) para Android e iPhone, con estética industrial y minimalista y tema claro y oscuro automático.

**Puesta en marcha → [SETUP.md](SETUP.md)** · Demo sin cuenta: añade `?demo=1` a la URL.

## Qué hace

- **Próximos**: agenda de los próximos días, con eventos y tareas diferenciados:
  - **Eventos**: tarjeta sólida con barra de color.
  - **Tareas**: borde discontinuo y casilla para completarlas al instante, con opción de deshacer.
  - **Tareas vencidas**: aparecen arriba, con franjas de señalización.
- **Calendario**: vistas Mes, Semana y Día. Se desliza a los lados para cambiar de periodo, y tocar un hueco crea algo a esa hora.
- **Botón +**:
  - **Alta rápida** en español: «cena con Laura viernes 21h», «tarea pagar seguro el 25», «gimnasio de 18 a 19:30».
  - **Plantillas** de un toque.
  - **Formulario completo**.
- **Formulario**: evento o tarea, todo el día, repetición (diaria, semanal por días, mensual o anual, con fin opcional), hasta 5 avisos, 11 colores, ubicación y notas.
- **Avisos «Para los dos»**: en Google los avisos son personales. La app los guarda en el evento y los aplica también a la cuenta de la otra persona cuando abre la app.
- **Buscar**: por título, lugar o notas.
- **Ajustes**: elegir calendario, **enlace de configuración** para el otro móvil, plantillas, avisos por defecto y tema.
- **Sin conexión**: la app abre al instante y muestra la última copia de las próximas semanas, en solo lectura.

## Privacidad

- La única configuración en el código es el *ID de cliente OAuth* (`js/config.js`). Es público por diseño y Google solo lo acepta desde vuestra URL.
- El ID del calendario, el email (para renovar la sesión) y las preferencias se guardan **solo en el dispositivo**.
- No hay servidor propio ni analítica, y las tipografías van incluidas en el repo. La web solo habla con `googleapis.com`.
- Una política de seguridad de contenidos (CSP) bloquea scripts y conexiones a otros dominios.

## Técnica

- HTML, CSS y JavaScript (módulos ES) sin dependencias ni compilación. GitHub Pages sirve el repositorio tal cual.
- Inicio de sesión OAuth 2.0 por redirección (`response_type=token`), fiable en apps instaladas de iOS y Android.
- Google Calendar API v3 por REST. Las tareas son eventos con `extendedProperties.shared.fcType = task`.
- Pruebas: `npm test`. Usan `node:test` sin dependencias y cubren el intérprete de alta rápida, la recurrencia y el modelo de datos.

```
index.html  manifest.webmanifest  sw.js
css/   tokens · base · components · views
js/    app · auth · api · data · model · dates · quickadd · recurrence · reminders-sync · templates · store · demo
js/ui/     dom · sheet · toast · editor · quick
js/views/  upcoming · calendar · search · settings · common
```

Tipografías: Barlow, Barlow Condensed e IBM Plex Mono (licencia SIL OFL, ver `fonts/LICENSE-OFL.txt`).
