import { useState, useEffect } from "react";
import {
  Download,
  Smartphone,
  Laptop,
  Share,
  PlusSquare,
  X,
  Sparkles,
  CheckCircle2,
  Info,
} from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 1. Detectar si ya está corriendo como app instalada (standalone)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone ===
          true ||
        document.referrer.includes("android-app://");
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();

    // 2. Detectar si el usuario está en iOS (iPhone / iPad)
    const ua = window.navigator.userAgent.toLowerCase();
    const isAppleDevice =
      /iphone|ipad|ipod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIos(isAppleDevice);

    // 3. Revisar si el usuario lo descartó previamente en esta sesión
    const dismissedSession = sessionStorage.getItem("pwa_banner_dismissed");
    if (dismissedSession === "true") {
      setIsDismissed(true);
    }

    // 4. Capturar el evento estándar de instalación del navegador
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // 5. Detectar cuando se instaló con éxito
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setTimeout(() => {
        setIsDismissed(true);
      }, 3000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // Si ya está dentro de la app instalada o el usuario lo cerró, no mostrar
  if (isStandalone || isDismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Navegadores compatibles (Chrome en Android/PC, Edge, etc.)
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setIsInstalled(true);
          setDeferredPrompt(null);
        }
      } catch (err) {
        console.error("Error al disparar instalación PWA:", err);
        setShowGuideModal(true);
      }
    } else {
      // Si es iOS o navegador sin prompt directo, mostrar guía paso a paso
      setShowGuideModal(true);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem("pwa_banner_dismissed", "true");
  };

  return (
    <>
      {/* Alerta flotante destacada para PC y Móviles */}
      <aside
        aria-label="Instalación de la aplicación"
        className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md z-[9999] animate-in fade-in slide-in-from-bottom-6 duration-300"
      >
        <div className="relative overflow-hidden rounded-3xl bg-slate-900/95 border-2 border-amber-500/80 shadow-[0_20px_60px_-15px_rgba(245,158,11,0.3)] backdrop-blur-xl p-4 sm:p-5 text-white">
          {/* Luz de acento superior */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600" />

          {/* Botón cerrar X */}
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition active:scale-95"
            aria-label="Cerrar notificación"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>

          {isInstalled ? (
            <div className="flex items-center gap-3 py-1">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-emerald-400">
                  ¡Aplicación Instalada con Éxito!
                </h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  Ya puedes abrir "La Negra POS" directamente desde tu inicio.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Encabezado con logo y badge */}
              <div className="flex items-start gap-3 pr-6">
                <div className="relative shrink-0">
                  <img
                    src="/pwa-192x192.png"
                    alt="Logo La Negra"
                    className="w-12 h-12 rounded-2xl bg-black border border-slate-700 object-contain shadow-md"
                  />
                  <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 items-center justify-center text-[9px] font-black text-slate-950">
                      ⚡
                    </span>
                  </span>
                </div>

                <div className="space-y-0.5 overflow-hidden">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-extrabold uppercase tracking-wide">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      App Disponible
                    </span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Smartphone className="w-3 h-3" />
                      <span>Celular &</span>
                      <Laptop className="w-3 h-3" />
                      <span>PC</span>
                    </span>
                  </div>
                  <h3 className="font-extrabold text-sm sm:text-base text-white tracking-tight">
                    Instalar "En que la Negra POS"
                  </h3>
                  <p className="text-xs text-slate-300 leading-snug">
                    Úsala a pantalla completa como una app nativa, más rápida y sin barra del navegador.
                  </p>
                </div>
              </div>

              {/* Botón de acción principal */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-500/25 active:scale-98 transition transform hover:-translate-y-0.5 cursor-pointer"
                >
                  <Download className="w-4 h-4 stroke-[2.5]" />
                  <span>Descargar / Instalar App</span>
                </button>

                <button
                  type="button"
                  onClick={handleDismiss}
                  className="py-3 px-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition"
                >
                  Más tarde
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Modal Guía Paso a Paso (para iOS o navegadores que no auto-disparan el prompt) */}
      {showGuideModal && (
        <div className="fixed inset-0 z-[10000] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 text-white w-full max-w-md rounded-3xl p-6 shadow-2xl relative space-y-5 animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowGuideModal(false)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition"
              aria-label="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
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
                <p className="text-xs text-slate-400 mt-0.5">
                  Sigue estos 2 sencillos pasos para agregar la app a tu pantalla
                </p>
              </div>
            </div>

            {isIos ? (
              <div className="space-y-3 bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60 text-xs text-slate-200">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center text-xs shrink-0 mt-0.5">
                    1
                  </span>
                  <div>
                    <p className="font-bold text-white flex items-center gap-1.5">
                      Toca el botón Compartir <Share className="w-4 h-4 text-amber-400 inline" />
                    </p>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      En la barra inferior (o superior) de Safari.
                    </p>
                  </div>
                </div>

                <div className="h-px bg-slate-700/50" />

                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center text-xs shrink-0 mt-0.5">
                    2
                  </span>
                  <div>
                    <p className="font-bold text-white flex items-center gap-1.5">
                      Selecciona "Añadir a pantalla de inicio" <PlusSquare className="w-4 h-4 text-emerald-400 inline" />
                    </p>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      Desliza hacia abajo en el menú y pulsa <strong>"Añadir"</strong> arriba a la derecha.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60 text-xs text-slate-200">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center text-xs shrink-0 mt-0.5">
                    1
                  </span>
                  <div>
                    <p className="font-bold text-white">
                      En la barra de direcciones de tu navegador:
                    </p>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      Busca el icono de <strong>Instalar 💻</strong> (a la derecha junto a la estrella) o en el menú de 3 puntos (⋮).
                    </p>
                  </div>
                </div>

                <div className="h-px bg-slate-700/50" />

                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center text-xs shrink-0 mt-0.5">
                    2
                  </span>
                  <div>
                    <p className="font-bold text-white">
                      Haz clic en "Instalar En que la Negra"
                    </p>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      Se creará un acceso directo en tu escritorio o menú de aplicaciones.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition"
            >
              ¡Entendido!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
