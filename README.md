# Indicadores de mantenimiento (relleno-gráficos)

Aplicación estática (HTML, CSS, JavaScript) para captura de indicadores y gráficos. Los datos viven en `localStorage` del navegador.

## Antes de publicar en internet

La página de captura incluye acceso por usuario/contraseña en el propio código (`capture.js`). **Cualquiera que vea el repositorio o las herramientas de desarrollador puede verlo.** Para un entorno real conviene sustituirlo por autenticación en servidor o al menos variables/secretos no commiteados.

## Subir el proyecto a GitHub

1. **Instala Git** (si no lo tienes): [Git for Windows](https://git-scm.com/download/win).
2. Abre **PowerShell** o **Git Bash** en la carpeta del proyecto (`relleno-graficos`).
3. Crea el repositorio local y el primer commit:

```powershell
git init
git add .
git status
git commit -m "Initial commit: indicadores de mantenimiento"
```

4. En [github.com](https://github.com): **New repository** → nombre (por ejemplo `relleno-graficos`) → **sin** README ni `.gitignore` (ya los tienes aquí) → Create.
5. Enlaza el remoto y sube (sustituye `TU_USUARIO`):

```powershell
git branch -M main
git remote add origin https://github.com/TU_USUARIO/relleno-graficos.git
git push -u origin main
```

Si GitHub pide login, usa un **Personal Access Token** como contraseña o la CLI `gh auth login`.

## Desplegar en Render (sitio estático)

1. Entra en [render.com](https://render.com) e inicia sesión (puedes usar **Sign in with GitHub**).
2. **New +** → **Static Site**.
3. Conecta el repositorio `relleno-graficos` y autoriza a Render si te lo pide.
4. Ajustes recomendados:
   - **Branch**: `main`
   - **Root Directory**: vacío (raíz del repo)
   - **Build Command**: déjalo vacío, o pon `echo "No build"` (debe coincidir con lo que esperes; no hace falta `npm install` para servir el sitio)
   - **Publish directory**: `.` (un punto = raíz del repositorio)
5. **Create Static Site**. En unos minutos tendrás una URL `https://relleno-graficos.onrender.com` (o el nombre que elijas).

### Usar el `render.yaml` del repo

Alternativa: **New +** → **Blueprint** → selecciona el mismo repositorio. Render leerá `render.yaml` y creará el servicio. Puedes editar el nombre del servicio dentro de ese archivo antes.

### Archivo Excel de plantilla

La plantilla `assets/plantilla-importacion-indicadores.xlsx` debe estar **commiteada** en Git para que el enlace “Descargar plantilla” funcione en producción. Si la regeneras en tu PC:

```powershell
npm install
npm run build:template
```

Luego `git add assets/plantilla-importacion-indicadores.xlsx` y commit.

## Desarrollo local

Abre `index.html` con un servidor local simple (evita `file://` por posibles límites del navegador):

```powershell
npx --yes serve .
```

Visita la URL que muestre la terminal (por ejemplo `http://localhost:3000`).
