-- ==========================================
-- FASE 1: Políticas RLS RESTAURANTE POS
-- ==========================================

-- 1. Crear tabla de perfiles/usuarios para manejar roles (si no existe)
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    nombre TEXT,
    rol TEXT CHECK (rol IN ('admin', 'mesero', 'cocinero')) DEFAULT 'mesero',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Habilitar RLS en la tabla de usuarios
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede leer su propio perfil
CREATE POLICY "Un usuario puede ver su perfil" 
ON public.usuarios FOR SELECT 
USING (auth.uid() = id);

-- Solo los administradores pueden ver todos los perfiles o actualizarlos
CREATE POLICY "Admins pueden ver todos los perfiles" 
ON public.usuarios FOR SELECT 
USING (
    EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND rol = 'admin')
);

CREATE POLICY "Admins pueden actualizar perfiles" 
ON public.usuarios FOR UPDATE 
USING (
    EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND rol = 'admin')
);


-- ==========================================
-- TABLA: mesas
-- ==========================================
ALTER TABLE public.mesas ENABLE ROW LEVEL SECURITY;

-- Todos pueden ver las mesas (meseros las ven ocupadas, cocineros referencian, admins ven reporte)
CREATE POLICY "Todos pueden ver el estado de las mesas"
ON public.mesas FOR SELECT 
TO authenticated 
USING (true);

-- Solo Meseros y Admins pueden actualizar estado de las mesas
CREATE POLICY "Meseros y Admins pueden actualizar mesas"
ON public.mesas FOR UPDATE 
TO authenticated 
USING (
    EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND rol IN ('admin', 'mesero'))
);


-- ==========================================
-- TABLA: menu (inventario/productos)
-- ==========================================
ALTER TABLE public.menu ENABLE ROW LEVEL SECURITY;

-- Todos pueden ver los productos en venta
CREATE POLICY "Todos pueden ver el menu"
ON public.menu FOR SELECT 
TO authenticated 
USING (true);

-- Solo Admins pueden modificar el catálogo
CREATE POLICY "Solo admins modifican menu"
ON public.menu FOR ALL 
TO authenticated 
USING (
    EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND rol = 'admin')
);


-- ==========================================
-- TABLA: comandas
-- ==========================================
ALTER TABLE public.comandas ENABLE ROW LEVEL SECURITY;

-- Meseros, cocineros y admins pueden ver comandas
CREATE POLICY "Todos ven todas las comandas"
ON public.comandas FOR SELECT 
TO authenticated 
USING (true);

-- Meseros pueden crear comandas
CREATE POLICY "Meseros pueden insertar comandas"
ON public.comandas FOR INSERT 
TO authenticated 
WITH CHECK (
    EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND rol IN ('admin', 'mesero'))
);

-- Cocineros y Meseros pueden actualizar (cambiar de pendiente -> lista -> entregada)
CREATE POLICY "Empleados pueden actualizar estados de comanda"
ON public.comandas FOR UPDATE 
TO authenticated 
USING (
    EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND rol IN ('admin', 'mesero', 'cocinero'))
);

-- Solo Admins pueden borrar ventas o comandas
CREATE POLICY "Solo admins pueden borrar comandas"
ON public.comandas FOR DELETE 
TO authenticated 
USING (
    EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND rol = 'admin')
);
