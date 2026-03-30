-- Fase 3: Módulos de Facturación y Cierre Z

-- 1. Crear tabla de turnos de caja para registrar la "apertura" del local
CREATE TABLE IF NOT EXISTS public.turnos (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    cajero_id UUID REFERENCES public.usuarios(id),
    base_efectivo NUMERIC(10,2) DEFAULT 0,
    efectivo_cierre NUMERIC(10,2) DEFAULT 0,
    tarjeta_cierre NUMERIC(10,2) DEFAULT 0,
    estado TEXT CHECK (estado IN ('Abierto', 'Cerrado')) DEFAULT 'Abierto',
    fecha_apertura TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    fecha_cierre TIMESTAMP WITH TIME ZONE
);

-- 2. Alterar tabla de comandas agregando detalles de facturación formal
ALTER TABLE public.comandas 
ADD COLUMN IF NOT EXISTS pago_efectivo NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS pago_tarjeta NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS metodo_pago TEXT CHECK (metodo_pago IN ('Efectivo', 'Tarjeta', 'Mixto')),
ADD COLUMN IF NOT EXISTS turno_id UUID REFERENCES public.turnos(id);

-- 3. Políticas RLS para los Turnos (Corte Z)
ALTER TABLE public.turnos ENABLE ROW LEVEL SECURITY;

-- Los Admins pueden abrir, leer, actualizar y hacer Cortes Z 
CREATE POLICY "Admins gestionan los turnos completos de caja"
ON public.turnos FOR ALL
TO authenticated
USING ( 
    (SELECT rol FROM public.usuarios WHERE id = auth.uid()) = 'admin' 
)
WITH CHECK ( 
    (SELECT rol FROM public.usuarios WHERE id = auth.uid()) = 'admin' 
);
