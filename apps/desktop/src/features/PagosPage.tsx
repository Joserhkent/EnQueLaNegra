import { useState, useEffect, useMemo } from "react";
import { usePosStore } from "../store/usePosStore";
import {
  QrCode,
  Lock,
  Unlock,
  Search,
  X,
  Coins,
  AlertCircle,
  AlertTriangle,
  User,
  ArrowRight,
} from "lucide-react";

export default function PagosPage() {
  const {
    cajaEstado,
    fetchCajaEstado,
    cobrosSesionActiva,
    fetchCobrosSesionActiva,
    abrirCaja,
    cerrarCajaSesion,
    currentUser,
  } = usePosStore();

  useEffect(() => {
    fetchCajaEstado();
  }, [fetchCajaEstado]);

  useEffect(() => {
    if (cajaEstado?.isOpen) {
      fetchCobrosSesionActiva();
    }
  }, [cajaEstado?.isOpen, fetchCobrosSesionActiva]);

  const [searchQuery, setSearchQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("all");

  // Abrir Caja Modal
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [openingAmount, setOpeningAmount] = useState<string>("0");
  const [openingNotes, setOpeningNotes] = useState("");
  const [isSubmittingOpen, setIsSubmittingOpen] = useState(false);

  // Cerrar Caja Modal (Arqueo)
  const [isCloseShiftOpen, setIsCloseShiftOpen] = useState(false);
  const [countedCash, setCountedCash] = useState<string>("");
  const [fondoQueQueda, setFondoQueQueda] = useState<string>("0");
  const [forzarCierreConPendientes, setForzarCierreConPendientes] = useState(false);
  const [shiftNotes, setShiftNotes] = useState("");
  const [isSubmittingClose, setIsSubmittingClose] = useState(false);
  const [errorCierre, setErrorCierre] = useState<string | null>(null);

  // Rol del usuario actual
  const esJefe = currentUser?.role === "jefe";

  const isCajaOpen = Boolean(cajaEstado?.isOpen);
  const activeSession = cajaEstado?.sesion;
  const resumen = cajaEstado?.resumenActual;

  // FUENTE DE VERDAD: El resumen calculado por el backend para la sesión activa
  const totalSales = isCajaOpen ? (resumen?.totalVendido ?? 0) : 0;
  const montoInicial = isCajaOpen ? (resumen?.montoInicial ?? 0) : 0;
  const cashSales = isCajaOpen ? (resumen?.efectivoVentas ?? 0) : 0;
  const yapePlinSales = isCajaOpen ? (resumen?.yapePlin ?? 0) : 0;
  const tarjetaSales = isCajaOpen ? (resumen?.tarjeta ?? 0) : 0;
  const expectedCashInDrawer = isCajaOpen
    ? (resumen?.efectivoEsperado ?? montoInicial)
    : 0;
  const cantidadPedidos = isCajaOpen ? (resumen?.cantidadPedidos ?? 0) : 0;

  // Apertura modal
  const handleOpenAbrirModal = () => {
    const sugerido = cajaEstado?.lastSession?.fondoQueQueda;
    // Si no hay lastSession o fondoQueQueda <= 0 (o sin dato de sesión legacy), no asumir 100
    setOpeningAmount(sugerido && sugerido > 0 ? String(sugerido) : "0");
    setOpeningNotes("");
    setIsOpenShiftModalOpen(true);
  };

  const handleConfirmOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(openingAmount);
    if (isNaN(amount) || amount < 0) {
      alert("Por favor ingresa un monto inicial válido (mayor o igual a 0).");
      return;
    }
    setIsSubmittingOpen(true);
    const ok = await abrirCaja(amount, openingNotes);
    setIsSubmittingOpen(false);
    if (ok) {
      setIsOpenShiftModalOpen(false);
      setOpeningNotes("");
    }
  };

  // Cierre modal
  const handleOpenCloseModal = () => {
    setCountedCash(expectedCashInDrawer.toFixed(2));
    // Proponer como fondo que queda lo que había de montoInicial (o 0 si contado < montoInicial)
    const fondoInicialSesion = montoInicial;
    setFondoQueQueda(
      expectedCashInDrawer >= fondoInicialSesion
        ? fondoInicialSesion.toFixed(2)
        : expectedCashInDrawer.toFixed(2)
    );
    setShiftNotes("");
    setForzarCierreConPendientes(false);
    setErrorCierre(null);
    setIsCloseShiftOpen(true);
  };

  // Cálculos reactivos del arqueo en centavos
  const numCounted = countedCash !== "" ? parseFloat(countedCash) || 0 : expectedCashInDrawer;
  const numFondoQueda = fondoQueQueda !== "" ? parseFloat(fondoQueQueda) || 0 : 0;
  const diffCash = Math.round((numCounted - expectedCashInDrawer) * 100) / 100;
  const efectivoRetirado = Math.max(
    0,
    Math.round((numCounted - numFondoQueda) * 100) / 100
  );

  const hayDiferencia = Math.abs(diffCash) >= 0.01;

  const handleConfirmCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorCierre(null);

    if (numCounted < 0) {
      setErrorCierre("El efectivo contado no puede ser negativo.");
      return;
    }

    if (numFondoQueda < 0 || numFondoQueda > numCounted) {
      setErrorCierre(
        `El fondo a dejar (S/ ${numFondoQueda.toFixed(2)}) debe estar entre 0 y el efectivo contado (S/ ${numCounted.toFixed(2)}).`
      );
      return;
    }

    if (hayDiferencia && (!shiftNotes || shiftNotes.trim().length < 3)) {
      setErrorCierre(
        "El arqueo presenta una diferencia (faltante o sobrante). Ingrese obligatoriamente una nota que explique el descuadre (mínimo 3 caracteres)."
      );
      return;
    }

    if (forzarCierreConPendientes && (!shiftNotes || shiftNotes.trim().length < 5)) {
      setErrorCierre(
        "Para forzar el cierre con comandas activas es obligatorio ingresar el motivo en las notas de cierre (mínimo 5 caracteres)."
      );
      return;
    }

    setIsSubmittingClose(true);
    const ok = await cerrarCajaSesion({
      efectivoReal: numCounted,
      fondoQueQueda: numFondoQueda,
      notas: shiftNotes.trim() || undefined,
      forzarCierreConPendientes,
    });
    setIsSubmittingClose(false);

    if (ok) {
      setIsCloseShiftOpen(false);
      setShiftNotes("");
      setCountedCash("");
      setFondoQueQueda("0");
    }
  };

  // Filtrado de la tabla de cobros
  const cobrosFiltrados = useMemo(() => {
    if (!isCajaOpen) return [];

    return cobrosSesionActiva.filter((c) => {
      // Filtro por método
      let matchesMethod = true;
      if (methodFilter === "Efectivo") {
        matchesMethod = c.metodos.includes("EFECTIVO") && c.metodos.length === 1;
      } else if (methodFilter === "Yape/Plin") {
        matchesMethod =
          (c.metodos.includes("YAPE_PLIN") || c.metodos.includes("TARJETA")) &&
          c.metodos.length === 1;
      } else if (methodFilter === "Mixto") {
        matchesMethod = c.metodos.length > 1;
      }

      // Filtro por búsqueda
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        c.code.toLowerCase().includes(q) ||
        c.customer.toLowerCase().includes(q);

      return matchesMethod && matchesSearch;
    });
  }, [isCajaOpen, cobrosSesionActiva, methodFilter, searchQuery]);

  const formatHoraLima = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString("es-PE", {
        timeZone: "America/Lima",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch {
      return "--:--";
    }
  };

  const formatFechaLima = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("es-PE", {
        timeZone: "America/Lima",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch {
      return "----/--/--";
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="text-3xl font-display text-slate-900 tracking-tight">Caja</h1>
            {isCajaOpen ? (
              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-900 text-xs font-bold rounded flex items-center gap-1.5 border border-emerald-300">
                <Unlock className="w-3.5 h-3.5 text-emerald-700" /> Abierta por {activeSession?.usuarioApertura || "turno activo"}
              </span>
            ) : (
              <span className="px-2.5 py-1 bg-rose-100 text-rose-900 text-xs font-bold rounded flex items-center gap-1.5 border border-rose-300">
                <Lock className="w-3.5 h-3.5 text-rose-700" /> Cerrada
              </span>
            )}
            {isCajaOpen && activeSession?.fechaNegocio && (
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded">
                Jornada: {activeSession.fechaNegocio}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isCajaOpen ? (
            <button
              onClick={handleOpenCloseModal}
              className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2.5 rounded-md text-sm transition-colors active:scale-95 shrink-0 shadow-sm"
            >
              <Lock className="w-4 h-4" />
              Cerrar caja
            </button>
          ) : (
            <button
              onClick={handleOpenAbrirModal}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-md text-sm transition-colors active:scale-95 shrink-0 shadow-sm"
            >
              <Unlock className="w-4 h-4" />
              Abrir caja
            </button>
          )}
        </div>
      </div>

      {/* AVISO DE SESIÓN OLVIDADA (NO bloquea ventas ni fuerza modal; informativo) */}
      {isCajaOpen && cajaEstado?.esSesionOlvidada && (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-amber-950 text-sm">
              Aviso: Turno activo de una jornada anterior
            </h4>
            <p className="text-xs text-amber-900 mt-1">
              Esta caja pertenece a la fecha de negocio <strong>{activeSession?.fechaNegocio || cajaEstado.fechaNegocio}</strong> y ha superado la hora de corte de las 06:00 a.m.
              Se recomienda realizar el arqueo y cierre correspondiente para iniciar la nueva jornada.
            </p>
          </div>
        </div>
      )}

      {/* Banner si la caja está cerrada */}
      {!isCajaOpen && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 font-bold">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-amber-950 text-sm">Caja cerrada</h3>
              <p className="text-xs text-amber-900 mt-0.5">
                Ábrela ingresando el fondo inicial en gaveta para empezar a cobrar pedidos del turno.
              </p>
            </div>
          </div>
          <button
            onClick={handleOpenAbrirModal}
            className="bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs px-5 py-2.5 rounded-lg shrink-0 transition"
          >
            Abrir caja
          </button>
        </div>
      )}

      {/* Cifras del turno actual (gobernadas 100% por el backend) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        {/* Total vendido del turno */}
        <div className="col-span-2 lg:col-span-1 bg-slate-900 p-4">
          <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Total vendido</span>
          <div className="text-3xl font-display text-white mt-1">S/ {totalSales.toFixed(2)}</div>
          <span className="text-xs text-slate-300 mt-1 block">
            {isCajaOpen
              ? `${cantidadPedidos} ${cantidadPedidos === 1 ? "pedido cobrado" : "pedidos cobrados"}`
              : "Caja cerrada"}
          </span>
        </div>

        {/* Fondo inicial */}
        <div className="bg-white p-4">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Fondo inicial</span>
          <div className="text-2xl font-display text-slate-900 mt-1">S/ {montoInicial.toFixed(2)}</div>
          <span className="text-xs text-slate-600 mt-1 block">
            {isCajaOpen ? `Abrió ${activeSession?.usuarioApertura || "Cajero"}` : "Sin sesión activa"}
          </span>
        </div>

        {/* Ventas en Efectivo */}
        <div className="bg-white p-4">
          <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Efectivo cobrado</span>
          <div className="text-2xl font-display text-slate-900 mt-1">S/ {cashSales.toFixed(2)}</div>
          <span className="text-xs text-slate-600 mt-1 block">
            {totalSales > 0 ? `${((cashSales / totalSales) * 100).toFixed(0)}% del total` : "S/ 0.00 en ventas"}
          </span>
        </div>

        {/* Yape / Plin / Tarjeta */}
        <div className="bg-white p-4">
          <span className="text-xs font-semibold text-purple-800 uppercase tracking-wider">Yape / Plin / Tarjeta</span>
          <div className="text-2xl font-display text-slate-900 mt-1">S/ {(yapePlinSales + tarjetaSales).toFixed(2)}</div>
          <span className="text-xs text-slate-600 mt-1 block">
            {totalSales > 0 ? `${(((yapePlinSales + tarjetaSales) / totalSales) * 100).toFixed(0)}% del total` : "S/ 0.00 digital"}
          </span>
        </div>

        {/* Debe haber en gaveta = Fondo + Efectivo ventas */}
        <div className="bg-emerald-50/90 p-4 border-l border-emerald-200">
          <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Debe haber en gaveta</span>
          <div className="text-2xl font-display text-emerald-950 mt-1">S/ {expectedCashInDrawer.toFixed(2)}</div>
          <span className="text-xs text-emerald-800 mt-1 block">
            Fondo S/ {montoInicial.toFixed(2)} + Efectivo S/ {cashSales.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Tabla de Cobros de la Sesión */}
      <div className="bg-white p-4 sm:p-5 rounded-lg border border-slate-200 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-display text-slate-900">Cobros del Turno</h2>
            <p className="text-xs text-slate-600 mt-0.5">
              {isCajaOpen
                ? `Mostrando cobros registrados en la sesión activa (${cobrosFiltrados.length})`
                : "La caja se encuentra cerrada. Abre una sesión para registrar cobros."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filtro método de pago */}
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-300 text-xs font-bold">
              {[
                { key: "all", label: "Todos" },
                { key: "Efectivo", label: "Efectivo" },
                { key: "Yape/Plin", label: "Digital" },
                { key: "Mixto", label: "Mixto" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setMethodFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-md transition ${
                    methodFilter === tab.key
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Búsqueda */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por #ORD o cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 w-56"
              />
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100 text-slate-700 font-bold text-[11px] border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Comanda</th>
                <th className="py-3 px-4">Cliente / Mesa</th>
                <th className="py-3 px-4">Método</th>
                <th className="py-3 px-4">Desglose cobrado</th>
                <th className="py-3 px-4">Hora</th>
                <th className="py-3 px-4 text-right">Cobrado en turno</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {!isCajaOpen ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500 font-semibold">
                    Caja cerrada. Abre una nueva sesión para visualizar los cobros del turno.
                  </td>
                </tr>
              ) : cobrosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500 font-semibold">
                    Sin cobros registrados en esta sesión bajo el filtro seleccionado.
                  </td>
                </tr>
              ) : (
                cobrosFiltrados.map((item) => {
                  const tieneEfectivo = item.montoEfectivo > 0;
                  const tieneDigital = item.montoDigital > 0;
                  const esMixto = tieneEfectivo && tieneDigital;

                  return (
                    <tr key={item.orderId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900 text-[12px]">
                        {item.code}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-800">
                        {item.customer}
                        {item.tableNumber !== null && (
                          <span className="ml-2 px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-semibold">
                            Mesa {item.tableNumber}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold border ${
                            esMixto
                              ? "bg-amber-50 text-amber-900 border-amber-300"
                              : tieneEfectivo
                              ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                              : "bg-purple-50 text-purple-900 border-purple-300"
                          }`}
                        >
                          {tieneEfectivo && !tieneDigital && <Coins className="w-3 h-3 text-emerald-700" />}
                          {!tieneEfectivo && tieneDigital && <QrCode className="w-3 h-3 text-purple-700" />}
                          {esMixto && "🔀"}
                          {esMixto ? "MIXTO" : tieneEfectivo ? "EFECTIVO" : "DIGITAL"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {esMixto ? (
                          <div className="flex flex-col gap-0.5 text-[11px]">
                            <span>
                              Efectivo: <strong className="text-slate-800">S/ {item.montoEfectivo.toFixed(2)}</strong>
                            </span>
                            <span>
                              Digital: <strong className="text-slate-800">S/ {item.montoDigital.toFixed(2)}</strong>
                            </span>
                          </div>
                        ) : tieneEfectivo ? (
                          <span>Efectivo: S/ {item.montoEfectivo.toFixed(2)}</span>
                        ) : (
                          <span>Digital: S/ {item.montoDigital.toFixed(2)}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 text-[11px]">
                        <span className="font-semibold text-slate-800">{formatHoraLima(item.createdAt)}</span>
                        <span className="block text-[10px] text-slate-500">{formatFechaLima(item.createdAt)}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-slate-900 text-sm">
                        S/ {item.totalCobradoEnSesion.toFixed(2)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL APERTURA DE CAJA */}
      {isOpenShiftModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-lg shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center font-bold">
                  <Unlock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Abrir caja</h3>
                  <p className="text-xs text-slate-300">Registro de fondo inicial del turno</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpenShiftModalOpen(false)}
                className="p-2 rounded-md bg-white/10 text-slate-300 hover:text-white hover:bg-white/20 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmOpenShift} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Fondo de sencillo en gaveta (S/)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-500 text-sm">S/</span>
                  <input
                    type="number"
                    min="0"
                    step="0.10"
                    required
                    value={openingAmount}
                    onChange={(e) => setOpeningAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-lg text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                {/* Sugerencias de fondo anterior */}
                {cajaEstado?.lastSession?.fondoQueQueda !== undefined &&
                  cajaEstado.lastSession.fondoQueQueda !== null &&
                  cajaEstado.lastSession.fondoQueQueda > 0 && (
                    <p className="text-[11px] text-emerald-800 font-semibold mt-1">
                      Fondo que quedó del turno anterior: S/ {cajaEstado.lastSession.fondoQueQueda.toFixed(2)}
                    </p>
                  )}
                {/* Atajos rápidos */}
                <div className="flex gap-2 mt-2">
                  {[0, 50, 100, 150, 200].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setOpeningAmount(String(v))}
                      className="flex-1 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 rounded-md text-xs font-bold text-slate-700 transition border border-slate-200"
                    >
                      S/ {v}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Notas de apertura (opcional)
                </label>
                <textarea
                  rows={2}
                  value={openingNotes}
                  onChange={(e) => setOpeningNotes(e.target.value)}
                  placeholder="Ej: Billetes de 10 y monedas para cambio."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="bg-emerald-50 p-3.5 rounded-lg border border-emerald-300 text-xs text-emerald-950 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                  <User className="w-3.5 h-3.5" />
                  Responsable: {currentUser?.name || "Cajero POS"}
                </div>
                <p className="text-[11px] text-emerald-800">
                  Todo cobro en efectivo registrado en el turno se acumula sobre este fondo.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsOpenShiftModalOpen(false)}
                  className="px-5 py-2.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOpen}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-xs transition active:scale-95 disabled:opacity-50 shadow-sm"
                >
                  {isSubmittingOpen ? "Abriendo..." : "Abrir caja"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CERRAR CAJA (ARQUEO Y DISTRIBUCIÓN) */}
      {isCloseShiftOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-lg shadow-xl border border-slate-200 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-rose-500 text-white flex items-center justify-center font-bold">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Arqueo y Cierre de Caja</h3>
                  <p className="text-xs text-slate-300">Turno activo: {activeSession?.fechaNegocio || "Hoy"}</p>
                </div>
              </div>
              <button
                onClick={() => setIsCloseShiftOpen(false)}
                className="p-2 rounded-md bg-white/10 text-slate-300 hover:text-white hover:bg-white/20 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmCloseShift} className="p-6 space-y-4">
              {errorCierre && (
                <div className="bg-rose-50 border border-rose-300 rounded-lg p-3 text-xs text-rose-900 font-bold flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                  <span>{errorCierre}</span>
                </div>
              )}

              {/* Desglose del sistema */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-300 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-700">
                  <span>Fondo inicial</span>
                  <strong className="text-slate-900 font-bold">S/ {montoInicial.toFixed(2)}</strong>
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span>+ Ventas en efectivo</span>
                  <span className="font-bold text-emerald-800">S/ {cashSales.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-300 pt-2 font-bold text-slate-900 text-sm">
                  <span>= Debe haber en gaveta (Esperado)</span>
                  <span className="text-emerald-800 whitespace-nowrap">S/ {expectedCashInDrawer.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-700 pt-1 border-t border-slate-200">
                  <span>Yape / Plin / Tarjeta (Digital)</span>
                  <span className="font-bold text-purple-800">S/ {(yapePlinSales + tarjetaSales).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span>Total vendido en el turno</span>
                  <span className="font-extrabold text-slate-900">S/ {totalSales.toFixed(2)}</span>
                </div>
              </div>

              {/* Conteo físico en gaveta */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  1. Efectivo contado en gaveta (S/) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.10"
                  required
                  value={countedCash}
                  onChange={(e) => setCountedCash(e.target.value)}
                  placeholder={expectedCashInDrawer.toFixed(2)}
                  className="w-full px-4 py-2.5 bg-white border-2 border-slate-300 rounded-lg text-lg font-bold text-slate-900 focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Indicador de Cuadre */}
              <div
                className={`p-3 rounded-lg border text-xs font-bold flex items-center justify-between ${
                  !hayDiferencia
                    ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                    : diffCash > 0
                    ? "bg-blue-50 text-blue-900 border-blue-300"
                    : "bg-rose-50 text-rose-900 border-rose-300"
                }`}
              >
                <span>Cuadre del turno:</span>
                <span>
                  {!hayDiferencia
                    ? "Cuadre exacto (S/ 0.00)"
                    : diffCash > 0
                    ? `Sobrante: +S/ ${diffCash.toFixed(2)}`
                    : `Faltante: -S/ ${Math.abs(diffCash).toFixed(2)}`}
                </span>
              </div>

              {/* Fondo que queda para siguiente turno y efectivo retirado */}
              <div className="p-4 bg-slate-50 border border-slate-300 rounded-lg space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    2. Fondo que queda en gaveta para el siguiente turno (S/) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={numCounted}
                    step="0.10"
                    required
                    value={fondoQueQueda}
                    onChange={(e) => setFondoQueQueda(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-base font-bold text-slate-900 focus:outline-none focus:border-slate-500"
                  />
                  <span className="text-[11px] text-slate-600 mt-1 block">
                    Debe ser entre S/ 0.00 y el efectivo contado (S/ {numCounted.toFixed(2)}).
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <ArrowRight className="w-4 h-4 text-emerald-700" />
                    <span>Efectivo a retirar (llevar a sobre / bóveda):</span>
                  </div>
                  <span className="text-base font-display font-extrabold text-emerald-800">
                    S/ {efectivoRetirado.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Checkbox forzar cierre si es Jefe */}
              {esJefe && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="forzarCierre"
                    checked={forzarCierreConPendientes}
                    onChange={(e) => setForzarCierreConPendientes(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                  />
                  <label htmlFor="forzarCierre" className="text-xs text-amber-950 font-medium">
                    <strong className="font-bold">Forzar cierre con comandas activas en cocina</strong> (Rol Jefe autorizado). Requiere justificación en notas.
                  </label>
                </div>
              )}

              {/* Notas de cierre */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Notas de cierre
                  {hayDiferencia && (
                    <span className="text-rose-700 font-bold ml-1">* Obligatorio por descuadre</span>
                  )}
                  {forzarCierreConPendientes && (
                    <span className="text-amber-800 font-bold ml-1">* Obligatorio por comandas pendientes</span>
                  )}
                </label>
                <textarea
                  rows={2}
                  value={shiftNotes}
                  onChange={(e) => setShiftNotes(e.target.value)}
                  placeholder={
                    hayDiferencia
                      ? "Explica aquí el motivo del faltante o sobrante detectado..."
                      : "Notas opcionales del turno..."
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCloseShiftOpen(false)}
                  className="px-5 py-2.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingClose}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-lg text-xs transition active:scale-95 disabled:opacity-50 shadow-sm"
                >
                  {isSubmittingClose ? "Cerrando..." : "Confirmar Cierre"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
