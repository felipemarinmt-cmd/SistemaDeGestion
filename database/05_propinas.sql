-- ==========================================
-- FASE VENDIBLE: Propinas y Cierre de Caja
-- ==========================================
-- Ejecutar en: Supabase Dashboard > SQL Editor > New Query

-- 1. Añadir columna de propina a la tabla de comandas
ALTER TABLE public.comandas 
ADD COLUMN IF NOT EXISTS propina NUMERIC(10,2) DEFAULT 0;

-- 2. Añadir columna de acumulación de propinas a la tabla de turnos para el Corte Z
ALTER TABLE public.turnos 
ADD COLUMN IF NOT EXISTS propinas_cierre NUMERIC(10,2) DEFAULT 0;
