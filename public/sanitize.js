// sanitize.js — Utilidad de seguridad para prevenir XSS
// Se DEBE usar en TODO punto donde se interpole data dinámica dentro de innerHTML.

/**
 * Escapa caracteres HTML peligrosos para prevenir inyección XSS.
 * @param {string|number} str - El texto a sanitizar
 * @returns {string} Texto seguro para insertar en innerHTML
 */
export function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const text = String(str);
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
