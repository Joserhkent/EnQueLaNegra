const DEV_SECRET = 'en-que-la-negra-pos-secret-key-2026';

// En producción es obligatorio definir JWT_SECRET: con el valor por defecto
// (que está en el repositorio) cualquiera podría firmar tokens válidos.
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Falta la variable de entorno JWT_SECRET');
  }
  return DEV_SECRET;
}
