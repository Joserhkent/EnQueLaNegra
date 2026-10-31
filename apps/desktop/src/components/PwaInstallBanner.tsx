import { useState, useEffect } from "react";
import {
  Download,
  Smartphone,
  Share,
  PlusSquare,
  X,
  Zap,
  Maximize2,
  CheckCircle2,
  Info,
  Loader2,
} from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Días que el banner queda oculto después de cerrarlo con la X
const DIAS_OCULTO = 7;

export default function PwaInstallBanner() {
  // Si index.html ya capturó el evento antes de montar React, se usa desde el inicio.
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(
      () =>
        (window as unknown as { deferredPwaPrompt?: BeforeInstallPromptEvent })
          .deferredPwaPrompt ?? null,
    );
  // Estos datos del navegador no cambian mientras la página está abierta: se leen
  // una vez al montar, como estado inicial, en vez de fijarlos dentro de un efecto.
  // 1. ¿Ya está corriendo como app instalada (standalone)?
  const [isStandalone] = useState(
    () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true ||
      document.referrer.includes("android-app://"),
  );
  // 3. ¿El usuario lo cerró en los últimos días? (si no, reaparecería en cada apertura)
  const [isDismissed, setIsDismissed] = useState(() => {
    try {
      const hasta = Number(localStorage.getItem("pwa_banner_oculto_hasta"));
      return hasta > Date.now();
    } catch {
      return false;
    }
  });
  const [showGuideModal, setShowGuideModal] = useState(false);
  // 2. ¿Está en iOS (iPhone / iPad)?
  const [isIos] = useState(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    return (
      /iphone|ipad|ipod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );
  });
  const [isInstalled, setIsInstalled] = useState(false);
  const [isPrompting, setIsPrompting] = useState(false);

  useEffect(() => {
    const onPromptReady = () => {
      const p = (
        window as unknown as { deferredPwaPrompt?: BeforeInstallPromptEvent }
      ).deferredPwaPrompt;
      if (p) setDeferredPrompt(p);
    };
    window.addEventListener("pwa-prompt-ready", onPromptReady);

    // 4. Capturar el evento estándar de instalación del navegador
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      (
        window as unknown as { deferredPwaPrompt?: BeforeInstallPromptEvent }
      ).deferredPwaPrompt = e as BeforeInstallPromptEvent;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // 5. Detectar cuando se instaló con éxito
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsPrompting(false);
      setDeferredPrompt(null);
      setTimeout(() => {
        setIsDismissed(true);
      }, 3500);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("pwa-prompt-ready", onPromptReady);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // Si ya está dentro de la app instalada o el usuario lo cerró, no mostrar
  if (isStandalone || isDismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    const promptToUse =
      deferredPrompt ||
      (window as unknown as { deferredPwaPrompt?: BeforeInstallPromptEvent })
        .deferredPwaPrompt;

    if (promptToUse) {
      setIsPrompting(true);
      try {
        await promptToUse.prompt();
        const choice = await promptToUse.userChoice;
        if (choice.outcome === "accepted") {
          setIsInstalled(true);
          setDeferredPrompt(null);
          (
            window as unknown as {
              deferredPwaPrompt?: BeforeInstallPromptEvent | null;
            }
          ).deferredPwaPrompt = null;
        }
      } catch (err) {
        console.error("Error al disparar instalación PWA:", err);
        setShowGuideModal(true);
      } finally {
        setIsPrompting(false);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem(
        "pwa_banner_oculto_hasta",
        String(Date.now() + DIAS_OCULTO * 24 * 60 * 60 * 1000),
      );
    } catch {
      // sin almacenamiento (modo privado): se oculta solo hasta recargar
    }
  };

  return (
    <>
      {/* Alerta flotante idéntica a PANCA para PC y Móviles */}
      <aside
        aria-label="Instalación de la aplicación"
        className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm z-40 animate-in fade-in slide-in-from-bottom-6 duration-300"
      >
        <div className="relative overflow-hidden rounded-lg bg-zinc-950/95 border border-zinc-800 p-3 sm:p-5 text-white">
          {/* Botón cerrar X en esquina superior derecha */}
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 sm:top-4 sm:right-4 p-1 rounded-lg text-zinc-500 hover:text-white transition active:scale-95"
            aria-label="Cerrar notificación"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>

          {isInstalled ? (
            <div className="flex items-center gap-3 py-1">
              <div className="w-11 h-11 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-emerald-400">
                  ¡Aplicación Instalada!
                </h4>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Ya puedes abrir "La Negra POS" directamente desde tu inicio.
                </p>
              </div>
            </div>
          ) : (
            <div className="sm:space-y-4">
              {/* Header: Logo + Título + Subtítulo (en celular, una sola fila compacta) */}
              <div className="flex items-center sm:items-start gap-3 sm:gap-3.5 pr-6">
                <img
                  src="/pwa-192x192.png"
                  alt="Logo En que la Negra"
                  className="w-11 h-11 rounded-lg bg-black border border-zinc-800 object-contain shrink-0"
                />

                <div className="space-y-0.5 min-w-0 flex-1">
                  <h3 className="font-extrabold text-sm sm:text-base text-white tracking-tight">
                    <span className="sm:hidden">Instalar la app</span>
                    <span className="hidden sm:inline">Instalar En que la Negra</span>
                  </h3>
                  <p className="text-xs text-zinc-400 leading-snug truncate sm:whitespace-normal">
                    Ábrela desde tu inicio, a pantalla completa
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleInstallClick}
                  disabled={isPrompting}
                  className="sm:hidden shrink-0 flex items-center gap-1.5 py-2 px-3 rounded-md bg-amber-500 active:scale-98 text-zinc-950 font-bold text-xs disabled:opacity-60"
                >
                  {isPrompting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 stroke-[2.5]" />
                  )}
                  Instalar
                </button>
              </div>

              {/* Botón de acción principal grande */}
              <button
                type="button"
                onClick={handleInstallClick}
                disabled={isPrompting}
                className="hidden w-full sm:flex items-center justify-center gap-2 py-3 px-4 rounded-md bg-amber-500 hover:bg-amber-400 active:scale-98 text-zinc-950 font-bold text-xs sm:text-sm transition transform cursor-pointer disabled:opacity-60"
              >
                {isPrompting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                    <span>Instalando...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 stroke-[2.5]" />
                    <span>Instalar aplicación</span>
                  </>
                )}
              </button>

              {/* Footer con 3 beneficios exactos a PANCA */}
              <div className="hidden sm:flex items-center justify-between pt-1 border-t border-zinc-900 text-[11px] text-zinc-400 font-medium px-1">
                <span className="flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-400" /> Más rápida
                </span>
                <span className="flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-400" /> En tu pantalla
                </span>
                <span className="flex items-center gap-1">
                  <Maximize2 className="w-3.5 h-3.5 text-blue-400" /> Pantalla completa
                </span>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Modal Guía Paso a Paso (para iOS o si no se abre nativo) */}
      {showGuideModal && (
        <div className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 text-white w-full max-w-md rounded-lg p-6 shadow-xl relative space-y-5">
            <button
              onClick={() => setShowGuideModal(false)}
              className="absolute top-4 right-4 p-2 rounded-md bg-zinc-900 text-zinc-400 hover:text-white transition"
              aria-label="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                {isIos ? (
                  <Smartphone className="w-6 h-6" />
                ) : (
                  <Info className="w-6 h-6" />
                )}
              </div>
              <div>
                <h3 className="font-extrabold text-base text-white">
                  {isIos
                    ? "Cómo instalar en tu iPhone / iPad"
                    : "Cómo instalar en tu Navegador"}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Sigue estos 2 sencillos pasos para agregar la app a tu pantalla
                </p>
              </div>
            </div>

            {isIos ? (
              <div className="space-y-3 bg-zinc-900/60 p-4 rounded-lg border border-zinc-800 text-xs text-zinc-200">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-amber-500 text-zinc-950 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                    1
                  </span>
                  <div>
                    <p className="font-bold text-white flex items-center gap-1.5">
                      Toca el botón Compartir{" "}
                      <Share className="w-4 h-4 text-amber-400 inline" />
                    </p>
                    <p className="text-zinc-400 text-[11px] mt-0.5">
                      En la barra de navegación de Safari.
                    </p>
                  </div>
                </div>

                <div className="h-px bg-zinc-800" />

                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-amber-500 text-zinc-950 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                    2
                  </span>
                  <div>
                    <p className="font-bold text-white flex items-center gap-1.5">
                      Selecciona "Añadir a pantalla de inicio"{" "}
                      <PlusSquare className="w-4 h-4 text-emerald-400 inline" />
                    </p>
                    <p className="text-zinc-400 text-[11px] mt-0.5">
                      Desliza hacia abajo y pulsa <strong>"Añadir"</strong>.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 bg-zinc-900/60 p-4 rounded-lg border border-zinc-800 text-xs text-zinc-200">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-amber-500 text-zinc-950 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                    1
                  </span>
                  <div>
                    <p className="font-bold text-white">
                      En la barra de direcciones de tu navegador:
                    </p>
                    <p className="text-zinc-400 text-[11px] mt-0.5">
                      Busca el icono de <strong>Instalar 💻</strong> (a la derecha) o en el menú de 3 puntos (⋮).
                    </p>
                  </div>
                </div>

                <div className="h-px bg-zinc-800" />

                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-amber-500 text-zinc-950 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                    2
                  </span>
                  <div>
                    <p className="font-bold text-white">
                      Haz clic en "Instalar En que la Negra"
                    </p>
                    <p className="text-zinc-400 text-[11px] mt-0.5">
                      Se creará un acceso directo en tu escritorio o aplicaciones.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-md text-xs transition"
            >
              ¡Entendido!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
