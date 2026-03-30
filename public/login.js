import { loginWithEmail, initAuth } from './api.js';

let intentosFallidos = 0;
const MAX_INTENTOS = 5;
const COOLDOWN_MS = 30000;

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const btnSubmit = document.getElementById('btn-submit');
    const errorMessage = document.getElementById('error-message');

    // Comprobar si ya existe una sesión
    initAuth().then(({ data: { session } }) => {
        if (session) {
            window.location.href = '/index.html'; 
        }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Rate limiting client-side
        if (intentosFallidos >= MAX_INTENTOS) {
            errorMessage.textContent = 'Demasiados intentos. Espera 30 segundos.';
            errorMessage.style.display = 'block';
            return;
        }
        
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Verificando...';
        errorMessage.style.display = 'none';

        try {
            const { data, error } = await loginWithEmail(emailInput.value, passwordInput.value);
            
            if (error) {
                throw error;
            }
            
            intentosFallidos = 0;
            window.location.href = '/index.html';
        } catch (error) {
            intentosFallidos++;
            
            if (intentosFallidos >= MAX_INTENTOS) {
                errorMessage.textContent = 'Demasiados intentos. Espera 30 segundos.';
                errorMessage.style.display = 'block';
                btnSubmit.disabled = true;
                
                let restante = COOLDOWN_MS / 1000;
                const interval = setInterval(() => {
                    restante--;
                    btnSubmit.textContent = `Bloqueado (${restante}s)`;
                    if (restante <= 0) {
                        clearInterval(interval);
                        intentosFallidos = 0;
                        btnSubmit.disabled = false;
                        btnSubmit.textContent = 'Acceder';
                        errorMessage.style.display = 'none';
                    }
                }, 1000);
                return;
            }
            
            errorMessage.textContent = error.message || 'Error: Credenciales inválidas';
            errorMessage.style.display = 'block';
        } finally {
            if (intentosFallidos < MAX_INTENTOS) {
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'Acceder';
            }
        }
    });
});
