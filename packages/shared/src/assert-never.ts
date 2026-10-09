/**
 * Garantiza en tiempo de compilación que un `switch` cubre todos los casos de una unión
 * (por ejemplo, los grupos de estado). Si en ejecución llega un valor inesperado, falla.
 */
export function assertNever(value: never): never {
  throw new Error(`Valor no contemplado: ${String(value)}`);
}
