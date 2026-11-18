# Requisitos

Qué tiene que hacer Calendario S&A y qué se decidió dejar fuera. Es una capa más directa y amable sobre Google Calendar, del que se usaba menos de la mitad de las funciones y que abrumaba.

## Contexto

Dos personas comparten un calendario de Google para organizar la casa y los planes comunes. Cada una tiene su propia cuenta de Google y el calendario está compartido entre las dos con permiso para hacer cambios.

La app la usan los dos desde su móvil, uno con Android (instalada desde Chrome) y otra con iPhone (instalada desde Safari). Desde la app se tiene que poder manejar el calendario entero.

## Reglas de negocio

| N.º | Regla |
|---|---|
| R1 | Se trabaja sobre un único calendario de Google ya existente y compartido entre las dos cuentas. Cada móvil lo elige una vez. |
| R2 | Google Calendar es la única fuente de datos. Lo que se cambia en la app se ve en Google Calendar y al revés; no hay otra base de datos. |
| R3 | Las tareas son comunes a los dos, así que se guardan como eventos del calendario compartido, marcados como tarea y con su estado (pendiente o hecha). En Google Calendar se ven con «☐» o «☑» delante del título. |
| R4 | Una tarea tiene fecha límite y, opcionalmente, hora. Está vencida si no está hecha y ya pasó su día (o su hora). Las vencidas se muestran aparte, hasta 90 días atrás. |
| R5 | En Google los avisos son de cada cuenta. Con «Para los dos», los avisos de un evento se aplican también a la cuenta de la otra persona la próxima vez que abra la app, para los eventos de los próximos 60 días. Cada versión de los avisos se aplica una sola vez, para no pisar lo que alguien cambie a mano. |
| R6 | Los colores de evento son los 11 que admite Google más el color del calendario. Cada estilo de la app los muestra con sus propios tonos; en Google Calendar se ven con su color de Google. |
| R7 | Un evento repetido se edita o se borra «Solo este» o «Toda la serie». Al editar la serie se conserva su fecha de inicio y se aplican la hora y la duración nuevas. |
| R8 | La semana empieza en lunes y las horas son las de la zona horaria del móvil. |

## Funciones

### Próximos (pantalla de inicio)
- F1. Ver el día de hoy, con el siguiente evento y cuántos eventos, tareas pendientes y tareas vencidas hay.
- F2. Ver las tareas vencidas aparte, arriba del todo.
- F3. Ver la agenda de los próximos 14 días agrupada por día, ampliable de 14 en 14. Hoy se muestra siempre, aunque esté vacío, con un acceso para añadir algo.
- F4. Distinguir eventos y tareas a simple vista (forma y color), y ver una marca de «ahora» entre los eventos de hoy.
- F5. Completar o reabrir una tarea con un toque en su casilla, con opción de deshacer.

### Añadir
- F6. Botón «+» siempre visible, que abre una hoja con el alta rápida, las plantillas y el formulario completo de evento o de tarea.
- F7. Alta rápida escribiendo en español: entiende hoy, mañana, pasado mañana, días de la semana, «el próximo…», «el 25», «3 de diciembre», «25/12», horas («21h», «a las 9:30», «de 18 a 20», «a las 9 de la mañana») y la palabra «tarea». Antes de crear muestra cómo lo ha entendido.
- F8. Plantillas de un toque (por defecto: Compra, Gimnasio, Cena fuera y Médico) con tipo, color, duración, hora fija opcional y avisos. Se crean, editan y borran en Ajustes.
- F9. Formulario con:
  - tipo (evento o tarea), título, todo el día o con hora, inicio y fin;
  - repetición (diaria, semanal eligiendo días, mensual o anual; sin fin, hasta una fecha o un número de veces);
  - avisos, color, ubicación y notas.
- F10. Hasta 5 avisos por evento:
  - atajos (al empezar, 10 y 30 min, 1 y 2 h, 1 y 2 días, 1 semana);
  - en eventos de día completo, «el día antes a las 9:00» y similares;
  - uno personalizado en minutos, horas, días o semanas;
  - interruptor «Para los dos».

### Calendario
- F11. Vistas Mes, Semana y Día, con botón «Hoy» y flechas para cambiar de periodo. El periodo no se cambia deslizando: ese gesto es para pasar de pestaña (F27).
- F12. Mes: rejilla de lunes a domingo con los elementos de cada día. Al tocar un día se ve su agenda debajo; al tocarlo otra vez se abre su vista Día.
- F13. Semana y Día: rejilla horaria con una fila de «todo el día», línea de «ahora» y eventos solapados uno al lado del otro. Tocar un hueco crea algo a esa hora.

### Detalle y edición
- F14. Al tocar un elemento se ve su detalle: cuándo, ubicación (enlace a mapas), repetición, avisos, notas y color.
- F15. Desde el detalle se edita, se borra (con «Deshacer» si no es repetido) o, si es tarea, se marca hecha o se reabre.

### Tareas
- F28. Pestaña con todas las tareas pendientes, agrupadas en vencidas, hoy, esta semana (hasta el domingo) y más adelante (hasta un año). De una tarea que se repite solo se ve la próxima vez. Las hechas de los últimos 30 días van al final, plegadas.
- F29. Alta rápida de tareas arriba de la lista, con el mismo intérprete que F7. Sin fecha, la tarea queda para hoy.
- F30. El icono de la pestaña lleva un contador de tareas vencidas y pendientes de hoy, en rojo si hay alguna vencida.

### Buscar
- F16. Buscar por título, lugar o notas desde hace un año hasta dentro de dos, separando próximos y pasados. Se abre con la lupa de Calendario.

### Navegación
- F27. Pasar a la pestaña de al lado deslizando el dedo a izquierda o derecha, como en Gastos S&A. La vecina asoma mientras se arrastra; si no se llega a la mitad ni se lanza con impulso, vuelve a su sitio.

### Ajustes
- F17. Elegir o cambiar el calendario de la lista de calendarios en los que la cuenta puede escribir.
- F18. Generar un enlace de configuración (con el calendario elegido y las plantillas) para dejar el otro móvil listo sin copiar nada.
- F19. Elegir los avisos por defecto de los eventos con hora y de los de día completo, y si «Para los dos» viene activado.
- F20. Sincronizar a mano y cerrar sesión.

### Diseño
- F21. Elegir el modo: el del sistema, claro u oscuro.
- F22. Elegir el estilo visual entre «Pastel», «Neón» y «Ochentas», los mismos que Gastos S&A. Todos funcionan en claro y en oscuro.
- F23. Modo, estilo, plantillas y avisos por defecto son de cada móvil y se conservan al cerrar la app.

### Sesión y conexión
- F24. Iniciar sesión con Google. Al caducar el acceso, la app intenta renovarlo sola y, si no puede, pide un solo toque en «Continuar».
- F25. Sin conexión, la app abre y muestra la última copia guardada de las próximas semanas, en solo lectura, con la pastilla «Sin conexión».
- F26. Modo demostración sin cuenta (`?demo=1`).

## Requisitos no funcionales

- **Multiplataforma**: una sola web instalable en la pantalla de inicio de Android e iPhone, sin tiendas de aplicaciones.
- **Sin coste**: GitHub Pages y la API de Google Calendar, sin servidor propio ni servicios de pago.
- **Privacidad**: el repositorio es público, así que no contiene la dirección del calendario, emails, nombres ni eventos. Lo personal se guarda solo en cada móvil. La app solo habla con Google.
- **Comodidad**: no hay que recordar ni copiar la dirección del calendario; se elige de una lista o llega con el enlace de configuración.
- **Sesión**: sin servidor, el acceso de Google dura 1 hora. Se acepta un toque en «Continuar» cuando no se pueda renovar en silencio.
- **Utilidad**: más directa que Google Calendar. Solo las funciones que se usan, a uno o dos toques.
- **Diseño**: es un requisito de primer orden, no un adorno. Mismo sistema de diseño que Gastos S&A, cuidado en claro y oscuro.
- **Idioma**: español, con fechas y horas en formato español.
- **Mantenimiento**: sin dependencias ni compilación, para que cualquier cambio sea editar un archivo y fusionar.

## Fuera de alcance

Decidido expresamente; no añadir sin preguntar.

- Asignar eventos o tareas a una persona: todo es común.
- Usar Google Tasks: sus listas no se pueden compartir entre dos cuentas.
- Un servidor propio para mantener la sesión abierta (por ejemplo, un Cloudflare Worker con refresh tokens).
- Notificaciones propias de la app: los avisos los envía Google Calendar, así que los dos tienen instalada su app oficial.
- Colores de evento fuera de los 11 de Google.
- La estética industrial de la primera versión: se sustituyó por el sistema de diseño de Gastos S&A.

## No incluido por ahora

No se ha pedido ni descartado; preguntar antes de añadirlo.

- Editar o borrar «Este y los siguientes» en eventos repetidos.
- Invitados, videollamadas y adjuntos.
- Ver varios calendarios a la vez.
- Crear o editar sin conexión.

## Pendiente de comprobar

- «Para los dos» con las dos cuentas reales: que la cuenta que no creó el evento reciba los avisos tras abrir la app, también en eventos repetidos.
- Renovación silenciosa de la sesión en el iPhone con la app instalada, y si Google vuelve a pedir el permiso cada 7 días con la app «En prueba».
- Que el alta rápida entienda las frases que usáis de verdad. Ampliar las pruebas con los casos que fallen.
- El modo sin conexión en los móviles reales.
- Los estilos «Neón» y «Ochentas» en los móviles reales: solo se han revisado en capturas a 390 px de ancho.
- Los colores de evento de cada estilo no se han validado para daltonismo.
