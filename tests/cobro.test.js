import { describe, it, expect } from 'vitest';
import { calcularCambio } from '../public/utils.js';

describe('Flujo de Cobro: calcularCambio()', () => {
    
    it('Pago exacto en efectivo sin propina', () => {
        // total: 100, propina: 0, efectivo: 100, tarjeta: 0
        expect(calcularCambio(100, 0, 100, 0)).toBe(0);
    });

    it('Pago con cambio en efectivo y propina', () => {
        // total: 200, propina: 20 (10%), efectivo: 250, tarjeta: 0 => cambio: 30
        expect(calcularCambio(200, 20, 250, 0)).toBe(30);
    });

    it('Pago mixto exacto con propina', () => {
        // total: 500, propina: 50, efectivo: 200, tarjeta: 350 => cambio: 0
        expect(calcularCambio(500, 50, 200, 350)).toBe(0);
    });

    it('Pago mixto con cambio a devolver', () => {
        // total: 100, propina: 15, efectivo: 100, tarjeta: 50 => pagado: 150. Cambio: 35
        expect(calcularCambio(100, 15, 100, 50)).toBe(35);
    });

    it('Falla si el monto pagado es insuficiente', () => {
        // total: 100, propina: 10, pagado: 100 (faltan 10)
        expect(() => calcularCambio(100, 10, 50, 50)).toThrow(/Monto insuficiente/);
    });

    it('Falla si se introducen montos negativos', () => {
        expect(() => calcularCambio(100, -10, 100, 0)).toThrow(/negativos/);
        expect(() => calcularCambio(100, 0, -50, 150)).toThrow(/negativos/);
    });

    it('Falla si el monto es absurdamente alto (prevención de errores de dedo)', () => {
        expect(() => calcularCambio(100, 0, 1000000, 0)).toThrow(/demasiado alto/);
    });
});
