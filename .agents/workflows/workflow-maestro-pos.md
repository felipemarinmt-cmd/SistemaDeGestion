---
description: Escalado de sistema POS restaurante
---

---
name: escalado-sistema-pos-restaurante
description: Workflow integral de 4 fases para refactorizar, asegurar y escalar el sistema POS y KDS usando Vanilla JS, HTML, CSS y Supabase.
---

# Workflow: Escalado y Refactorización del Sistema POS

## Objetivo General
Evolucionar el MVP actual a un sistema de gestión de restaurantes robusto, modular y en tiempo real. El agente debe ejecutar el código por fases, priorizando la seguridad (RLS), la sincronización en tiempo real y la modularidad del código Vanilla JS.

---

## Fase 1: Arquitectura, Seguridad y Refactorización (Cimientos)
**Instrucciones para el Agente:**
1. **Modularización:** Analiza el archivo principal de JavaScript y divídelo en módulos lógicos: `api.js` (solo llamadas a Supabase), `ui.js` (manipulación del DOM), y `state.js` (estado global de la app).
2. **Autenticación:** Genera la vista `login.html` y el script para iniciar sesión con `supabase.auth.signInWithPassword()`.
3. **Control de Accesos (Middleware):** Crea un script `guard.js` que verifique la sesión y el rol del usuario (Admin, Mesero, Cocinero). Redirige al usuario a su panel correspondiente (`admin.html`, `pos.html`, `cocina.html`) y bloquea accesos no autorizados.
4. **Seguridad RLS:** Genera un script SQL con las políticas de Row Level Security (RLS) para asegurar que:
   - Solo los administradores puedan modificar inventario y finanzas.
   - Los meseros solo puedan crear y leer comandas.

---

## Fase 2: Robustez del Flujo en Tiempo Real
**Instrucciones para el Agente:**
1. **Suscripciones Supabase:** Implementa `supabase.channel()` en las vistas de Cocina (KDS) y Dashboard. El sistema debe escuchar los eventos `INSERT` y `UPDATE` de la tabla `comandas` para renderizar los nuevos pedidos sin recargar la página.
2. **Máquina de Estados para Mesas:** Refactoriza la lógica de las mesas en el POS. Implementa los estados: `Disponible`, `Ocupada` (al crear orden), `Esperando Comida` (al enviar a cocina), `Por Pagar` (al pedir la cuenta) y `Limpiando`.
3. **Modo Offline Básico:** Envuelve las funciones de envío de comandas en bloques `try/catch`. Si la petición a Supabase falla (por pérdida de red), guarda la comanda en `localStorage` y muestra un banner de advertencia (UI) indicando que la orden está pendiente de sincronización.

---

## Fase 3: Features Core Restantes (Facturación y Cierre)
**Instrucciones para el Agente:**
1. **Módulo de Pagos:** Crea la interfaz y la lógica en el POS para "Cerrar Cuenta". Debe incluir la capacidad de dividir el pago (ej. tarjeta de crédito y efectivo) y calcular el cambio a devolver.
2. **Control de Caja:** Genera un módulo administrativo para registrar la apertura de caja (base de efectivo inicial) y ejecutar el "Corte Z" (sumatoria de ventas, métodos de pago y cálculo de descuadres al final del turno).
3. **Impresión de Tickets:** Integra la librería `Print.js` o genera una plantilla HTML oculta optimizada para impresoras térmicas (formato ticket 80mm o 58mm). Debe formatear la orden de la cocina y el recibo del cliente.

---

## Fase 4: Despliegue y Pruebas
**Instrucciones para el Agente:**
1. **Script de Semillas (Seed Data):** Crea un script de JavaScript que inyecte datos falsos de prueba en Supabase (50 comandas concurrentes, múltiples estados) para simular estrés y probar el rendimiento del Dashboard.
2. **Configuración de Despliegue:** Genera los archivos de configuración necesarios (como `vercel.json` o `netlify.toml` si aplica) y un archivo `.env.example` detallando las variables de entorno requeridas (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) para evitar exponer credenciales en producción.