-- ==========================================
-- FASE VENDIBLE: Gestión de Usuarios
-- ==========================================
-- Ejecutar en: Supabase Dashboard > SQL Editor > New Query

-- 1. Tabla de perfiles de usuario (complementa auth.users)
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'mesero' CHECK (rol IN ('admin', 'mesero', 'cocinero')),
    activo BOOLEAN NOT NULL DEFAULT true,
    nombre TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Forzar inyección si la tabla ya existía de antes y carencia de columnas
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS nombre TEXT DEFAULT '';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS rol TEXT NOT NULL DEFAULT 'mesero';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 2. Trigger: auto-crear perfil al registrar un usuario en auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.usuarios (id, email, rol)
    VALUES (NEW.id, NEW.email, 'mesero')
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Función auxiliar para verificar rol admin (evita recursión infinita en RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.usuarios
        WHERE id = auth.uid() AND rol = 'admin'
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 4. RLS: Usa la función SECURITY DEFINER para evitar recursión
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Limpieza agresiva de políticas antiguas que causaban el 'infinite recursion'
DROP POLICY IF EXISTS "Un usuario puede ver su perfil" ON usuarios;
DROP POLICY IF EXISTS "Admins pueden ver todos los perfiles" ON usuarios;
DROP POLICY IF EXISTS "Admins pueden actualizar perfiles" ON usuarios;

DROP POLICY IF EXISTS "Admin read usuarios" ON usuarios;
CREATE POLICY "Admin read usuarios" ON usuarios
    FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admin update usuarios" ON usuarios;
CREATE POLICY "Admin update usuarios" ON usuarios
    FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "Admin insert usuarios" ON usuarios;
CREATE POLICY "Admin insert usuarios" ON usuarios
    FOR INSERT WITH CHECK (public.is_admin());

-- 5. Cada usuario puede leer su propio perfil (para guard.js)
DROP POLICY IF EXISTS "User read own profile" ON usuarios;
CREATE POLICY "User read own profile" ON usuarios
    FOR SELECT USING (id = auth.uid());

-- 6. Índices
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol);
CREATE INDEX IF NOT EXISTS idx_usuarios_activo ON usuarios(activo);

-- 7. Insertar al usuario admin actual (Cambia EL CORREO por el que usas en Supabase)
INSERT INTO usuarios (id, email, rol, nombre)
SELECT id, email, 'admin', 'Administrador'
FROM auth.users
WHERE email = 'felipemarinmt@gmail.com'
ON CONFLICT (id) DO UPDATE SET rol = 'admin';
