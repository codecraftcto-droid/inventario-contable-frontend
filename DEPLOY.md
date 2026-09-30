# Despliegue del frontend en Dokploy

Proyecto de Dokploy: **Inventario Contable RyR Consulting**
Dominio: **https://inventariocontable.codecraft.net.pe**
API: **https://inventariocontable-backend.codecraft.net.pe/api/v1**

## 1. Crear la aplicación

1. En el proyecto: **Create Service → Application**, nombre `frontend`.
2. **Provider:** GitHub, repositorio `codecraftcto-droid/inventario-contable-frontend`, rama `main`.
3. **Build Type:** `Dockerfile` (ruta `Dockerfile`, contexto `.`).
4. Activa **Autodeploy** si quieres que cada push a `main` despliegue.

## 2. URL de la API (se fija al compilar)

El `Dockerfile` ya trae por defecto `https://inventariocontable-backend.codecraft.net.pe/api/v1`.
Si cambia el dominio del backend, defínelo en **Environment → Build-time Arguments**:

```
VITE_API_BASE_URL=https://<dominio-del-backend>/api/v1
```

Vite incrusta esta URL en el código al compilar: si la cambias, hay que **redesplegar** (no basta con reiniciar).

## 3. Dominio

Pestaña **Domains → Add Domain**:

- Host: `inventariocontable.codecraft.net.pe`
- Path: `/`
- Container port: `80`
- HTTPS: activado, certificado **Let's Encrypt**

En el DNS de `codecraft.net.pe` crea un registro **A** `inventariocontable` → IP del servidor.

## 4. Verificación

- Abre `https://inventariocontable.codecraft.net.pe` → pantalla de login.
- Si el login falla con error de red/CORS: revisa en el backend que `FRONTEND_URL` sea exactamente
  `https://inventariocontable.codecraft.net.pe` (sin `/` al final) y redespliega el backend.
