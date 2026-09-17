// Mapeo entre los nombres que usa el frontend (PedidosPage) y los insumoId reales del seed.
// Esto es lo que permite que las cremas y agregados SÍ descuenten stock en NestJS.

export const CREMA_INSUMO_MAP: Record<string, string> = {
  "Crema Tocineta": "crema_tocineta",
  "Mayonesa": "crema_mayonesa",
  "Mostaza": "crema_mostaza",
  "Ketchup": "crema_ketchup",
  "Crema de Rocoto": "crema_rocoto",
  "Crema de Huacatay": "crema_huacatay",
  "Crema de Aceituna": "crema_aceituna",
  "Salsa Tártara": "crema_tartara",
  "Salsa Golf": "crema_golf",
  "Crema de Ajo": "crema_ajo",
};

export const AGREGADO_INSUMO_MAP: Record<string, { insumoId: string; precio: number }> = {
  "Huevo": { insumoId: "huevo", precio: 1.5 },
  "Queso Suizo": { insumoId: "queso_suizo", precio: 1.5 },
  "Plátano": { insumoId: "platano", precio: 1.5 },
  "Piña": { insumoId: "piña", precio: 2.5 },
  "Tocino": { insumoId: "tocino", precio: 2.5 },
  "Hotdog": { insumoId: "frankfurter", precio: 2.5 },
  "Hamburguesa": { insumoId: "carne_hamburguesa", precio: 4.0 },
  "Pollo Deshilachado": { insumoId: "pollo_deshilachado", precio: 4.0 },
  "Chorizo Finas Hierbas": { insumoId: "chorizo_finas_hierbas", precio: 4.0 },
};