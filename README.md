# ENTRE LÍNEAS: Fotógrafo de la Liga Tica — versión Windows

> *El partido lo juegan ellos. La historia la capturás vos.*

Esta es la versión de escritorio para **Windows 10/11 (64 bits)**. Tiene todo lo de la versión de Mac: modo carrera, modo arcade, La Cueva, el Morera Soto, el Fello Meza, ciclo día/noche, primera persona, control de PS5, ceremonia previa con sorteo de moneda, caídas tipo muñeco de trapo y tarjetas del árbitro.

## Novedades

- **Llegar horas antes:** elegís llegar 1, 2 o 3 h antes. El estadio se va llenando y la luz cambia con la hora.
- **Teléfono** (`H` / panel táctil):
  - Chats con tu familia y tus amigos.
  - Red social *Lente* para publicar tus fotos.
  - Entradas de cortesía para regalar: tu familia aparece en la gradería con un rótulo.
  - Reloj para esperar el partido.
- **Público más vivo:** te saluda, te pide fotos, posa cuando le apuntás con la cámara y la barra canta.
- **Puerta de seguridad:** puerta de vidrio transparente y corrediza.
- **Modo dron / tráiler** (`K`): 7 tomas, cámara lenta y franjas de cine. `R` graba un video con sonido, que queda en `Videos\Entre Lineas`.
- **Pulpería, soda y bar** con interior: se entra caminando y lo que comprés tiene efecto en el juego.
- **Copa Centroamericana**, **fotógrafo oficial** (vestuario y palco VIP), **parqueo de prensa** con aguja y **fuera de juego**.
- **Grabá con tu celular** en vertical (9:16) u horizontal (16:9), con cámara trasera o selfie. Los videos quedan en `Videos\Entre Lineas`.
- **Desde tu casa hasta el estadio:** manejá tu carro, tomá el bus o pedí un taxi o un Uber desde el teléfono.
- **Trifulcas, entrevista al jugador del partido y zona de comidas** en todos los estadios.
- **Personalizá a tu fotógrafo:** hombre o mujer, tono de piel, peinado, color de pelo, barba y ropa, con vista previa 3D.
- **Más cámaras y lentes**, conversaciones más largas en el teléfono, caras y peinados más realistas, vallas LED y resolución dinámica para mantener los FPS.

## Descargar el juego (sin programar nada)

1. En GitHub, abrí la pestaña **Actions** → **Compilar para Windows** → la ejecución más reciente.
2. Abajo, en **Artifacts**, descargá **EntreLineas-Windows**.
3. Adentro vienen dos opciones:
   - `EntreLineas-Instalador-0.6.0.exe`: instalador con acceso directo en el escritorio.
   - `EntreLineas-0.6.0-Windows-x64.zip`: versión portátil. Descomprimila y abrí `EntreLineas.exe`.

Si Windows muestra **"Windows protegió su PC"**, hacé clic en *Más información* y luego en *Ejecutar de todas formas*. El aviso sale porque el ejecutable no está firmado.

## Optimización para Windows

- La primera vez que abrís el juego, elige la calidad según tu tarjeta gráfica (integrada → Bajo/Medio, dedicada → Alto/Ultra).
- En portátiles con dos tarjetas gráficas usa la dedicada.
- El juego no se frena en segundo plano (se desactiva el *throttling*).
- Solo se puede abrir una ventana a la vez.
- Las partidas se guardan aunque reinstales el juego (el origen local es fijo).
- **F11** cambia a pantalla completa. Las fotos exportadas van a `Imágenes\Entre Lineas`.

## Tus sonidos

Los audios no van en el repositorio. Copialos a la carpeta `audio` que está junto a `EntreLineas.exe`: `menu.m4a`, `cueva_1.m4a`, `alajuela_1.m4a`, `cartago_1.m4a`, `estadio_1.m4a`, etc. Los nombres válidos están en `audio/LEEME.txt`.

## Compilar en una PC con Windows

```bat
npm install
npm run app        :: probar
npm run dist:win   :: genera el instalador y el zip en release\
```
