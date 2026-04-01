// utils.js - Funciones utilitarias generales

/**
 * Retrasa la ejecución de una función hasta que haya pasado un tiempo sin ser llamada.
 * Evita re-renders masivos si llegan muchos eventos en poco tiempo (ej. Supabase Realtime).
 * @param {Function} func Función a ejecutar
 * @param {number} wait Tiempo de espera en milisegundos
 * @returns {Function} Función debounced
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Lógica pura de cobro sin DOM, para ser testeada con Vitest
 * @param {number} total Total consumido (sin propina)
 * @param {number} propina Propina añadida
 * @param {number} efectivo Dinero dado en efectivo
 * @param {number} tarjeta Dinero dado en tarjeta
 * @returns {number} Cambio a devolver. Lanza Error si faltan fondos o montos negativos.
 */
export function calcularCambio(total, propina, efectivo, tarjeta) {
    if (efectivo < 0 || tarjeta < 0 || propina < 0) {
        throw new Error('Los montos no pueden ser negativos.');
    }
    const totalConPropina = total + propina;
    const pagado = efectivo + tarjeta;
    
    if (pagado < totalConPropina) {
        throw new Error(`Monto insuficiente. Faltan $${(totalConPropina - pagado).toFixed(2)} por cubrir.`);
    }

    if (pagado > 999999) {
        throw new Error('El monto ingresado es demasiado alto. Verifica los datos.');
    }

    return pagado - totalConPropina;
}
