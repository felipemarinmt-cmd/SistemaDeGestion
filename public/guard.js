// guard.js - Middleware de control de acceso

import { initAuth, supabase } from './api.js';

async function verifyAccess() {
    const { data: { session } } = await initAuth();
    
    // Si no hay sesión, siempre pedir credenciales
    if (!session) {
        const path = window.location.pathname;
        if (!path.includes('login.html')) {
            window.location.href = '/login.html';
        }
        return;
    }

    try {
        const { data: userData, error } = await supabase
            .from('usuarios')
            .select('rol')
            .eq('id', session.user.id)
            .single();

        // Rol por defecto si no está seteado ("mesero")
        const rol = (userData && userData.rol) ? userData.rol : 'mesero'; 
        const path = window.location.pathname.toLowerCase();

        // Si estamos en la raíz o en login ya autenticados, ruteamos a su dashboard correspondiente
        if (path === '/' || path.includes('index.html') || path.includes('login.html')) {
            if (rol === 'admin') window.location.href = '/admin.html';
            else if (rol === 'cocinero') window.location.href = '/cocina.html';
            else window.location.href = '/comandas.html';
            return;
        }

        // Reglas de protección de rutas directas
        if (path.includes('admin.html') && rol !== 'admin') {
            window.location.href = '/comandas.html';
        }
        
        if (path.includes('cocina.html') && rol !== 'cocinero' && rol !== 'admin') {
            window.location.href = '/comandas.html';
        }
        
        if (path.includes('comandas.html') && rol !== 'mesero' && rol !== 'admin') {
            window.location.href = '/admin.html';
        }
        
        // El script acaba y permite renderizar la página HTML
        document.body.style.display = 'block';

    } catch (error) {
        console.error("Error verificando permisos:", error);
    }
}

// Listener persistente: detecta sesión expirada o cierre de sesión en otra pestaña
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
        window.location.href = '/login.html';
    }
    if (event === 'TOKEN_REFRESHED' && !session) {
        window.location.href = '/login.html';
    }
});

// Ejecutar automáticamente
verifyAccess();

