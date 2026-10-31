import { useEffect, useState } from "react";

// true mientras la consulta CSS se cumpla; se actualiza al girar o redimensionar.
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

// Celular o tablet: pantalla táctil o ventana angosta. En la PC (mouse y pantalla
// ancha) se mantiene la ventana clásica con catálogo, cuenta y cobros juntos.
export const QUERY_TACTIL = "(pointer: coarse), (max-width: 1023px)";
