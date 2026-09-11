# Cómo desplegar el chat con IA (Edge Function)

El código de la función ya está escrito en `index.ts`, en esta misma carpeta.
Estos pasos los corrés vos en tu propia terminal — la clave de Claude
(Anthropic) nunca me la pasás a mí, ni queda en ningún archivo del proyecto.

Corré todo esto en PowerShell, con la carpeta del proyecto como ubicación
(`C:\Users\kevin\OneDrive\Escritorio\Pagina Web`).

## 1. Instalar la CLI de Supabase (no hace falta Node/npm)

Opción recomendada, con [Scoop](https://scoop.sh) (gestor de paquetes de Windows):

```powershell
irm get.scoop.sh | iex
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

Si el primer comando da un error de "execution policy", corré antes:
```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```
y confirmá con "S" (Sí) cuando pregunte.

**Alternativa sin Scoop**: descargá el .zip para Windows desde
https://github.com/supabase/cli/releases (el archivo que dice
`supabase_windows_amd64.zip`), descomprimilo en cualquier carpeta, y usá
`.\supabase.exe` en vez de `supabase` en todos los comandos de abajo.

Verificá que quedó instalada:
```powershell
supabase --version
```

## 2. Iniciar sesión con tu cuenta de Supabase

```powershell
supabase login
```
Esto abre una pestaña del navegador — iniciá sesión con la cuenta dueña
del proyecto y hacé clic en "Authorize".

## 3. Inicializar la carpeta del proyecto para la CLI

```powershell
supabase init
```
Esto agrega un archivo `supabase/config.toml` — no toca ni borra los
archivos `.sql` que ya tenés ahí.

## 4. Conectar con tu proyecto real de Supabase

```powershell
supabase link --project-ref vkglwajqvxizxfcqfdsd
```
Puede llamarte por la contraseña de la base de datos (la que se generó al
crear el proyecto). Si no la tenés a mano, se puede resetear desde el
Dashboard de Supabase → Project Settings → Database → "Reset database
password".

## 5. Guardar tu clave de Claude (Anthropic) como secret (nunca en un archivo)

```powershell
supabase secrets set ANTHROPIC_API_KEY=pegá_aquí_tu_clave_real_de_anthropic
```
Este comando la manda directo a Supabase de forma segura — no queda
guardada en ningún archivo de este proyecto ni en tu historial de git.

Si antes tenías cargado `GEMINI_API_KEY` (de cuando el chat usaba Gemini),
ya no hace falta — podés borrarlo si querés con
`supabase secrets unset GEMINI_API_KEY`.

## 6. Desplegar la función

```powershell
supabase functions deploy chat-assistant
```
Al terminar, la función queda funcionando en:
`https://vkglwajqvxizxfcqfdsd.supabase.co/functions/v1/chat-assistant`
— exactamente la URL a la que ya apunta el chat en `index.html`.

## 7. Probarla (opcional, antes de probar en el sitio)

Reemplazá `TU_ANON_KEY` por la clave anon que ya está en `index.html`
(buscá `supabaseAnonKey` en ese archivo):

```powershell
curl -X POST "https://vkglwajqvxizxfcqfdsd.supabase.co/functions/v1/chat-assistant" `
  -H "Content-Type: application/json" `
  -H "apikey: TU_ANON_KEY" `
  -H "Authorization: Bearer TU_ANON_KEY" `
  -d '{\"message\": \"hola\", \"history\": []}'
```
Si todo está bien, la respuesta es algo como `{"reply": "..."}`.

## 8. Probar en el sitio

Abrí `index.html`, hacé clic en la burbuja de chat (abajo a la derecha) y
escribí algo como *"busco un iPhone bueno y barato"*. Debería responder
usando el catálogo real de la tabla `products`.

---

## Si en el futuro querés cambiar de proveedor de nuevo

Hoy el chat usa la API de Claude (Anthropic). Para cambiar a otro proveedor
más adelante, solo hace falta tocar `index.ts`: reescribir el contenido de
la función `callAiProvider()` (llamar a la API del nuevo proveedor) y
guardar la nueva clave con `supabase secrets set NOMBRE_DEL_SECRET=...`.
Después, volver a correr `supabase functions deploy chat-assistant`. Nada
en `index.html` necesita cambiar — sigue hablando con el mismo endpoint de
siempre.
