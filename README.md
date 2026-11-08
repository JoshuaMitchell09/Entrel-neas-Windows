# ENTRE LÍNEAS: Fotógrafo de la Liga Tica — versión Windows

> *El partido lo juegan ellos. La historia la capturás vos.*

Esta es la versión de escritorio para **Windows 10/11 (64 bits)**. Tiene todo lo de la versión de Mac: modo carrera, modo arcade, La Cueva, el Morera Soto, el Fello Meza, ciclo día/noche, primera persona, control de PS5, ceremonia previa con sorteo de moneda, caídas tipo muñeco de trapo y tarjetas del árbitro.

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
