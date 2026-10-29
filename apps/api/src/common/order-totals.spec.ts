import { itemLineTotal, splitIgv } from './order-totals';

describe('order-totals', () => {
  it('cobra los extras por cada unidad del plato', () => {
    // 2 arepas de 4.00 con un extra de 0.75 => (4 + 0.75) * 2
    expect(itemLineTotal(4, 2, [{ precioExtra: 0.75, cantidad: 1 }])).toBe(9.5);
  });

  it('ignora extras gratis y valores faltantes', () => {
    expect(itemLineTotal(3, 1, [{ precioExtra: 0 }, {}])).toBe(3);
    expect(itemLineTotal(3, 2)).toBe(6);
  });

  it('separa subtotal e IGV (18%) sin perder centavos', () => {
    const { total, subtotal, igv } = splitIgv(26);
    expect(total).toBe(26);
    expect(subtotal).toBe(22.03);
    expect(igv).toBe(3.97);
    expect(subtotal + igv).toBeCloseTo(total, 2);
  });
});
