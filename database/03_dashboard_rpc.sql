-- ==========================================
-- FASE AUDIT: Función RPC para Dashboard
-- ==========================================
-- Mueve los cálculos pesados del navegador al servidor PostgreSQL.
-- Ejecuta este script en: Supabase Dashboard > SQL Editor > New Query

CREATE OR REPLACE FUNCTION dashboard_resumen()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    resultado JSON;
BEGIN
    SELECT json_build_object(
        'ventasTotales', COALESCE(
            (SELECT SUM(total) FROM comandas 
             WHERE estado IN ('Pagada', 'Lista') 
             AND created_at >= CURRENT_DATE), 0),
        'totalComandas', COALESCE(
            (SELECT COUNT(*) FROM comandas 
             WHERE created_at >= CURRENT_DATE), 0),
        'mesasOcupadas', COALESCE(
            (SELECT COUNT(*) FROM mesas 
             WHERE estado != 'Disponible'), 0),
        'mesasDisponibles', COALESCE(
            (SELECT COUNT(*) FROM mesas 
             WHERE estado = 'Disponible'), 0),
        'itemsVendidos', COALESCE(
            (SELECT json_agg(row_to_json(items)) FROM (
                SELECT 
                    m.nombre,
                    COUNT(*) as cantidad,
                    SUM(m.precio) as ingresos
                FROM comandas c,
                     LATERAL unnest(c.productos::int[]) AS pid
                JOIN menu m ON m.id = pid
                WHERE c.created_at >= CURRENT_DATE
                GROUP BY m.nombre
                ORDER BY cantidad DESC
                LIMIT 10
            ) items), '[]'::json)
    ) INTO resultado;
    
    RETURN resultado;
END;
$$;
