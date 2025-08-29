# Sincronía Flow v2

[![CI](https://github.com/sincroniauy-dot/sincronia-flow-v2/actions/workflows/ci.yml/badge.svg)](https://github.com/sincroniauy-dot/sincronia-flow-v2/actions)

CRM de cobranzas (Next.js 14 + TS + Firebase).
# Sincronía Flow v2 — Documentación del Proyecto

**Stack**: Next.js 14 (App Router) + TypeScript + Firebase (Auth, Firestore, Admin SDK).  
**Ruta local**: `C:\Users\Gamer\Development\Sincronia-Flow version 2 con chat gpt`

## 1) Estado a 28/Ago/2025
- ✅ Auth con Firebase + Custom Claims (roles: gestor, supervisor, admin).
- ✅ Admin SDK desde `FIREBASE_SERVICE_ACCOUNT` (JSON una línea).
- ✅ Endpoints activos:  
  - `GET /api/health` (sanidad)  
  - `GET /api/protected` (token/rol)  
  - `GET/POST /api/cases`  
  - `GET/POST /api/payments` (POST descuenta balance)
- 🚧 Próximos: `GET/PATCH /api/payments/[id]`, **Interacciones**, **Acuerdos/Cancelaciones**, **Auditoría**, **Seeds/Reglas/Índices**, **Tests/CI**.

## 2) Convenciones
- **App Router** en `app/api/**/route.ts` (evitar `src/pages/api/**`).
- Imports por alias: `@/lib/...`.
- Diagnóstico: `OPTIONS /api/<ruta>` para Allow + CORS.
- Consolas separadas: **CMD negro** para `npm run dev`; **PowerShell azul** para pruebas HTTP.

## 3) Modelo de datos (extracto)
- **cases**: `{id, debtorName, assignedTo, balance, status, createdAt, updatedAt}`
- **payments**: `{id, caseId, amount, method, date, createdBy, createdAt, reconciled?}`
  - `reconciled` (boolean) por defecto `false` (si falta, se asume `false` en server).

## 4) API actual y añadidos
- Actual: `/api/health`, `/api/protected`, `/api/cases`, `/api/payments`.
- **Añadidos planificados** (ver OpenAPI 1.2.0):  
  - `/interactions` (GET/POST)  
  - `/ops/summary` (GET)  
  - `/cases/{id}/documents/cancellation/(preview|issue)` (POST)  
  - `/documents/{docId}` (GET)  
  - `/surveys` (POST), `/surveys/{id}` (GET), `/surveys/{id}/responses` (POST)

> Base funcional y roadmap tomados del documento extendido del proyecto. (Documento en `./docs/Documentacion completa de deproyecto CRM - Sincronia Flow v.2.docx`). 

## 5) Seguridad y Reglas (resumen)
- Escrituras a Firestore desde servidor (Admin SDK).
- Reglas espejo para acceso cliente (lecturas limitadas; escrituras server).
- Storage: documentos de cancelación bajo `documents/cancellation/*.pdf` lectura **admin/supervisor**.

## 6) Runbook (rápido)
- **CMD**: `npm run dev`
- **PowerShell** (token y pruebas):
  - `GET /api/health` y `GET /api/protected` con Bearer.
  - Para POST/GET/OPTIONS ver `RUNBOOK.md` (si se agrega).

## 7) Changelog
- **2025-08-28**: Se integra documentación extendida (OpenAPI 1.2.0, DFD, ERD) y se alinea contrato de `PATCH /api/payments/[id]` a **solo supervisor/admin** y **no reconciliado**. 
