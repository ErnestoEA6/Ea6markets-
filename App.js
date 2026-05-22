// 🏢 EA6MARKETS SAAS - V17 (CAPITAL TOTAL ESTIMADO RESTAURADO EN DASHBOARD)
import React, { useState, useEffect, useRef } from "react"; 
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, Platform, StatusBar, ActivityIndicator, Image, Animated, Modal } from "react-native"; 
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import firebase from "firebase";

// Credenciales
const firebaseConfig = {
  apiKey: "AIzaSyDxGjHLMMQayU5_tVrRLHBb1_u133KZTyo",
  authDomain: "ea6markets-2be9c.firebaseapp.com",
  projectId: "ea6markets-2be9c",
  storageBucket: "ea6markets-2be9c.appspot.com",
  messagingSenderId: "147064241789",
  appId: "1:147064241789:web:829c71be7ac200680b7b14"
};

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const auth = firebase.auth();
const db = firebase.firestore();

db.enablePersistence({ synchronizeTabs: true }).catch(() => {});

const increment = firebase.firestore.FieldValue.increment;
const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp;

export default function App() { return ( <SafeAreaProvider><EA6MarketsMain /></SafeAreaProvider> ); }

function EA6MarketsMain() { 
  const [userAuth, setUserAuth] = useState(null); 
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [role, setRole] = useState(null);
  const [screen, setScreen] = useState("ventas"); 
  const [productos, setProductos] = useState([]); 
  const [historialRaw, setHistorialRaw] = useState([]); 
  
  const [showCount, setShowCount] = useState(50); 
  const [caja, setCaja] = useState({ dineroEfectivo: 0, dineroBanco: 0, usdEfectivo: 0, usdBanco: 0 });
  const [carrito, setCarrito] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [montoCaja, setMontoCaja] = useState("");
  const [motivoCaja, setMotivoCaja] = useState("");
  const [usuarioActivo, setUsuarioActivo] = useState("");
  const [showPinScreen, setShowPinScreen] = useState(false);
  const [isCajaBanco, setIsCajaBanco] = useState(false);
  const [monedaCaja, setMonedaCaja] = useState("CUP"); 
  const [loadingVenta, setLoadingVenta] = useState(false); 
  const [filtroHistorial, setFiltroHistorial] = useState("exitosas"); 

  // 🟢 CONFIGURACIÓN GLOBAL
  const [tasaGlobal, setTasaGlobal] = useState("330");
  const [recargoBanco, setRecargoBanco] = useState("15"); 
  const [gananciaBase, setGananciaBase] = useState(0); 
  
  const [gestores, setGestores] = useState([]);
  const [nuevoGestor, setNuevoGestor] = useState("");
  
  // 🟢 MODALES
  const [gestorModal, setGestorModal] = useState(null); 
  const [saleModalConfig, setSaleModalConfig] = useState(null); 

  const [dataCargada, setDataCargada] = useState(false);
  const [statusNube, setStatusNube] = useState("Verificando...");

  const [successModal, setSuccessModal] = useState({ visible: false, title: "", msg: "" });
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const writeTimeouts = useRef({}); 

  const triggerSuccessAnimation = (title, msg) => {
    setSuccessModal({ visible: true, title, msg });
    Animated.spring(scaleAnim, { toValue: 1, friction: 4, useNativeDriver: true }).start();
    setTimeout(() => { Animated.timing(scaleAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => { setSuccessModal({ visible: false, title: "", msg: "" }); }); }, 2500);
  };

  const safeNum = (v) => parseFloat(String(v).replace(',', '.')) || 0;
  const formatSeguro = (num) => Number(num).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  useEffect(() => {
    const emergencyTimer = setTimeout(() => { if (!dataCargada) { setStatusNube("Reconectando..."); setDataCargada(true); } }, 4000);
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      clearTimeout(emergencyTimer); 
      if (user) { setUserAuth(user); setRole('admin'); setUsuarioActivo(user.email.split('@')[0].toUpperCase()); setStatusNube("Sincronizando..."); } 
      else { setUserAuth(null); setRole(null); }
      setDataCargada(true); 
    });
    return () => { clearTimeout(emergencyTimer); unsubscribeAuth(); };
  }, []);

  useEffect(() => { 
    if (!userAuth && role !== 'dependiente') return; 
    try {
        const unsubProductos = db.collection("productos").onSnapshot(snap => setProductos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        const haceDosMeses = new Date(); haceDosMeses.setDate(haceDosMeses.getDate() - 60);
        const unsubHistorial = db.collection("historial").where("fecha", ">=", haceDosMeses).orderBy("fecha", "desc").onSnapshot(snap => setHistorialRaw(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        
        const unsubConfig = db.collection("config").doc("global").onSnapshot(docSnap => {
            if (docSnap.exists) {
                const d = docSnap.data();
                setCaja({ dineroEfectivo: safeNum(d.dineroEfectivo), dineroBanco: safeNum(d.dineroBanco), usdEfectivo: safeNum(d.usdEfectivo), usdBanco: safeNum(d.usdBanco) });
                setTasaGlobal(d.tasaGlobal || "330"); 
                setRecargoBanco(d.recargoBanco !== undefined ? String(d.recargoBanco) : "15");
                setGananciaBase(safeNum(d.gananciaBase)); 
                setStatusNube("Online");
            } else { db.collection("config").doc("global").set({ dineroEfectivo: 0, dineroBanco: 0, usdEfectivo: 0, usdBanco: 0, tasaGlobal: "330", recargoBanco: 15, gananciaBase: 0 }); }
        });

        const unsubGestores = db.collection("gestores").onSnapshot(snap => setGestores(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        return () => { unsubProductos(); unsubHistorial(); unsubConfig(); unsubGestores(); };
    } catch (error) { Alert.alert("Error BD", "Fallo al conectar."); }
  }, [userAuth, role]); 

  const handleLogin = async () => {
      if(!email || !password) return Alert.alert("Error", "Llena todos los campos.");
      setIsLoggingIn(true);
      try { await auth.signInWithEmailAndPassword(email.trim(), password); setShowPinScreen(false); setEmail(""); setPassword(""); } 
      catch (error) { Alert.alert("Acceso Denegado", "Correo o contraseña incorrectos."); } 
      finally { setIsLoggingIn(false); }
  };

  const handleLogout = async () => { if (userAuth) await auth.signOut(); setRole(null); setUsuarioActivo(""); setScreen("ventas"); };
  const forzarSincronizacion = async () => { setStatusNube("Actualizando..."); try { await db.collection("config").doc("global").get(); setStatusNube("Online"); triggerSuccessAnimation("Nube Actualizada", "Datos en tiempo real."); } catch(e) { setStatusNube("Modo Offline"); Alert.alert("Aviso", "Sin internet. Operando con caché local."); } };

  const update = (id, field, value) => { 
    let localVal = value; if (field !== "nombre" && typeof value === 'string') localVal = value.replace(',', '.');
    setProductos(prev => prev.map(p => p.id === id ? { ...p, [field]: localVal } : p)); 
    if (writeTimeouts.current[`${id}_${field}`]) clearTimeout(writeTimeouts.current[`${id}_${field}`]);
    writeTimeouts.current[`${id}_${field}`] = setTimeout(() => { let valToSave = localVal; if (field !== "nombre") valToSave = Number(localVal) || 0; db.collection("productos").doc(id).update({ [field]: valToSave }).catch(()=>{}); }, 1000);
  };

  const handleVentaUsdChange = (id, valUsd, tasaVentaActual) => {
    const val = typeof valUsd === 'string' ? valUsd.replace(',', '.') : valUsd;
    const nuevoCUP = String(safeNum(val) * safeNum(tasaVentaActual));
    setProductos(prev => prev.map(p => p.id === id ? { ...p, precioVentaUsd: val, precioVentaCup: nuevoCUP } : p));
    if (writeTimeouts.current[`${id}_ventaUsd`]) clearTimeout(writeTimeouts.current[`${id}_ventaUsd`]);
    writeTimeouts.current[`${id}_ventaUsd`] = setTimeout(() => { db.collection("productos").doc(id).update({ precioVentaUsd: Number(val) || 0, precioVentaCup: Number(nuevoCUP) || 0 }).catch(()=>{}); }, 1000);
  };

  const handleMayoristaUsdChange = (id, valUsd, tasaVentaActual) => {
    const val = typeof valUsd === 'string' ? valUsd.replace(',', '.') : valUsd;
    const nuevoCUP = String(safeNum(val) * safeNum(tasaVentaActual));
    setProductos(prev => prev.map(p => p.id === id ? { ...p, precioMayoristaUsd: val, precioMayoristaCup: nuevoCUP } : p));
    if (writeTimeouts.current[`${id}_mayorUsd`]) clearTimeout(writeTimeouts.current[`${id}_mayorUsd`]);
    writeTimeouts.current[`${id}_mayorUsd`] = setTimeout(() => { db.collection("productos").doc(id).update({ precioMayoristaUsd: Number(val) || 0, precioMayoristaCup: Number(nuevoCUP) || 0 }).catch(()=>{}); }, 1000);
  };

  const handleTasaChange = (id, nuevaTasa, ventaUsdActual, mayorUsdActual) => {
    const valTasa = typeof nuevaTasa === 'string' ? nuevaTasa.replace(',', '.') : nuevaTasa;
    let updates = { tasaDolar: Number(valTasa) || 0 }; 
    if (safeNum(ventaUsdActual) > 0) updates.precioVentaCup = Number(String(safeNum(ventaUsdActual) * safeNum(valTasa))) || 0; 
    if (safeNum(mayorUsdActual) > 0) updates.precioMayoristaCup = Number(String(safeNum(mayorUsdActual) * safeNum(valTasa))) || 0; 
    
    setProductos(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    if (writeTimeouts.current[`${id}_tasaProd`]) clearTimeout(writeTimeouts.current[`${id}_tasaProd`]);
    writeTimeouts.current[`${id}_tasaProd`] = setTimeout(() => { db.collection("productos").doc(id).update(updates).catch(()=>{}); }, 1000);
  };

  const addProducto = async () => { await db.collection("productos").add({ nombre: "Nuevo", costoUsd: 0, costoCup: 0, libras: 0, precioLibraUsd: 0, tasaCosto: safeNum(tasaGlobal), tasaDolar: safeNum(tasaGlobal), precioVentaUsd: 0, precioVentaCup: 0, precioMayoristaUsd: 0, precioMayoristaCup: 0, comisionGestorCup: 0, stock: 0 }); };

  const openSaleModal = (p, esGestor, gestorId = null, gestorNombre = null) => {
      setSaleModalConfig({
          producto: p,
          cantidad: 1,
          tipoPrecio: 'normal',
          metodoPago: 'cup_efectivo',
          esGestor, gestorId, gestorNombre
      });
  };

  const confirmAddToCart = () => {
    const { producto, cantidad, tipoPrecio, metodoPago, esGestor, gestorId, gestorNombre } = saleModalConfig;
    const stockDisponible = parseFloat(producto.stock) || 0;
    
    const totalEnCarritoPrevio = carrito.filter(i => i.id === producto.id).reduce((acc, curr) => acc + curr.cantidad, 0);
    if (totalEnCarritoPrevio + cantidad > stockDisponible) return Alert.alert("Agotado", `Solo quedan ${stockDisponible - totalEnCarritoPrevio} en stock.`);

    const cartItemId = `${producto.id}_${tipoPrecio}_${metodoPago}_${gestorId||'yo'}`;
    const existeIndex = carrito.findIndex(i => i.cartItemId === cartItemId);
    
    if (existeIndex >= 0) {
        let nuevoCarrito = [...carrito];
        nuevoCarrito[existeIndex].cantidad += cantidad;
        setCarrito(nuevoCarrito);
    } else {
        setCarrito([...carrito, { 
            ...producto, 
            cartItemId, 
            cantidad, 
            tipoPrecio, 
            metodoPago, 
            esGestor, 
            gestorId, 
            gestorNombre 
        }]);
    }
    setSaleModalConfig(null);
  };

  const removeFromCart = (cartItemId) => {
    setCarrito(carrito.filter(i => i.cartItemId !== cartItemId));
  };

  let sEfeTxPre = 0; let sBanTxPre = 0; let sUsdEfeTxPre = 0; let sUsdBanTxPre = 0; let recargoTotalPre = 0;
  carrito.forEach(item => {
      const isUSD = item.metodoPago.startsWith('usd');
      const isBanco = item.metodoPago.includes('banco');
      
      const precioBase = isUSD ? 
            (item.tipoPrecio === 'mayor' ? safeNum(item.precioMayoristaUsd) : safeNum(item.precioVentaUsd)) : 
            (item.tipoPrecio === 'mayor' ? safeNum(item.precioMayoristaCup) : safeNum(item.precioVentaCup));
      
      let totalCobradoItem = precioBase * item.cantidad;
      let recargoMonto = 0;

      if (!isUSD && isBanco) {
          recargoMonto = totalCobradoItem * (safeNum(recargoBanco) / 100);
          totalCobradoItem += recargoMonto;
          recargoTotalPre += recargoMonto;
      }

      if (item.metodoPago === 'cup_efectivo') sEfeTxPre += totalCobradoItem;
      if (item.metodoPago === 'cup_banco') sBanTxPre += totalCobradoItem;
      if (item.metodoPago === 'usd_efectivo') sUsdEfeTxPre += totalCobradoItem;
      if (item.metodoPago === 'usd_banco') sUsdBanTxPre += totalCobradoItem;
  });

  const finalizarVenta = async () => { 
    if (carrito.length === 0 || loadingVenta) return;
    setLoadingVenta(true); 
    try {
        await db.runTransaction(async (transaction) => {
            const snapshots = [];
            for (let item of carrito) {
                const ref = db.collection("productos").doc(item.id);
                const snap = await transaction.get(ref);
                if (!snap.exists) throw `Producto borrado: ${item.nombre}`;
                snapshots.push({ item, ref, snap });
            }

            let sEfeTx = 0; let sBanTx = 0; let sUsdEfeTx = 0; let sUsdBanTx = 0;
            let gananciaTotalCUP = 0; 
            let saldoGestoresAumentar = {};
            let resumenNombres = [];

            for (let { item, ref, snap } of snapshots) {
                const data = snap.data();
                const stockActual = safeNum(data.stock);
                if (stockActual < item.cantidad) throw `¡Alguien más acaba de vender ${item.nombre}! Quedan: ${stockActual}`;

                transaction.update(ref, { stock: Number(stockActual - item.cantidad) });

                const tCostoParaGanancia = data.tasaCosto !== undefined ? safeNum(data.tasaCosto) : safeNum(data.tasaDolar);
                const costCUP = ((safeNum(data.costoUsd) + (safeNum(data.libras) * safeNum(data.precioLibraUsd))) * tCostoParaGanancia) + safeNum(data.costoCup);
                const comision = item.esGestor ? safeNum(data.comisionGestorCup) : 0;
                
                if (item.esGestor && item.gestorId && item.gestorId !== 'anonimo') {
                    saldoGestoresAumentar[item.gestorId] = (saldoGestoresAumentar[item.gestorId] || 0) + (comision * item.cantidad);
                }

                const isUSD = item.metodoPago.startsWith('usd');
                const isBanco = item.metodoPago.includes('banco');
                
                const precioBase = isUSD ? 
                      (item.tipoPrecio === 'mayor' ? safeNum(data.precioMayoristaUsd) : safeNum(data.precioVentaUsd)) : 
                      (item.tipoPrecio === 'mayor' ? safeNum(data.precioMayoristaCup) : safeNum(data.precioVentaCup));
                
                let precioCobradoFisico = precioBase * item.cantidad;
                let recargoCUPItem = 0;

                if (!isUSD && isBanco) {
                    recargoCUPItem = precioCobradoFisico * (safeNum(recargoBanco) / 100);
                    precioCobradoFisico += recargoCUPItem; 
                }

                if (item.metodoPago === 'cup_efectivo') sEfeTx += precioCobradoFisico;
                if (item.metodoPago === 'cup_banco') sBanTx += precioCobradoFisico;
                if (item.metodoPago === 'usd_efectivo') sUsdEfeTx += precioCobradoFisico;
                if (item.metodoPago === 'usd_banco') sUsdBanTx += precioCobradoFisico;

                const precioEquivCUP = isUSD ? (precioBase * safeNum(tasaGlobal)) : precioBase;
                gananciaTotalCUP += ((precioEquivCUP - costCUP - comision) * item.cantidad) + recargoCUPItem;

                let etiquetaMetodo = "";
                if(item.metodoPago === 'cup_efectivo') etiquetaMetodo = "CUP Efe";
                if(item.metodoPago === 'cup_banco') etiquetaMetodo = "CUP Transf";
                if(item.metodoPago === 'usd_efectivo') etiquetaMetodo = "USD Efe";
                if(item.metodoPago === 'usd_banco') etiquetaMetodo = "USD Transf";

                resumenNombres.push(`▪️ ${item.cantidad}x ${item.nombre} [${etiquetaMetodo}]${item.tipoPrecio === 'mayor' ? ' (Mayor)' : ''}${item.esGestor ? ` (G: ${item.gestorNombre})` : ''}`);
            }

            transaction.update(db.collection("config").doc("global"), {
                dineroEfectivo: increment(sEfeTx), dineroBanco: increment(sBanTx),
                usdEfectivo: increment(sUsdEfeTx), usdBanco: increment(sUsdBanTx)
            });

            for (let gId in saldoGestoresAumentar) { transaction.update(db.collection("gestores").doc(gId), { saldo: increment(saldoGestoresAumentar[gId]) }); }

            const ventaId = `${Date.now()}_${usuarioActivo.trim().replace(/\s+/g, '')}`;

            transaction.set(db.collection("historial").doc(ventaId), {
                nombre: resumenNombres.join("\n") + `\n👤 Cajero: ${usuarioActivo.trim()}`,
                montoCUP: sEfeTx + sBanTx, montoUSD: sUsdEfeTx + sUsdBanTx, 
                montoEfectivoCUP: sEfeTx, montoBancoCUP: sBanTx,
                montoEfectivoUSD: sUsdEfeTx, montoBancoUSD: sUsdBanTx,
                ganancia: gananciaTotalCUP, 
                operador: usuarioActivo.trim(), tipo: "venta", items: carrito,
                fecha: serverTimestamp(), metodo: "mixto", moneda: "MIXTO", estado: "completado"
            });
        });

        setCarrito([]); setScreen("dashboard");
        triggerSuccessAnimation("¡Venta Exitosa!", `Completada con éxito.`);
    } catch (e) { Alert.alert("Venta Detenida", String(e)); } finally { setLoadingVenta(false); }
  };

  const registrarCaja = async (tipo) => {
    const monto = parseFloat(montoCaja.replace(',', '.'));
    if (!monto || !motivoCaja) return Alert.alert("Error", "Ingresa motivo y monto.");
    try {
        const val = tipo === "entrada" ? monto : -monto;
        let campoDB = "";
        if (monedaCaja === "CUP" && !isCajaBanco) campoDB = "dineroEfectivo";
        if (monedaCaja === "CUP" && isCajaBanco) campoDB = "dineroBanco";
        if (monedaCaja === "USD" && !isCajaBanco) campoDB = "usdEfectivo";
        if (monedaCaja === "USD" && isCajaBanco) campoDB = "usdBanco";

        await db.runTransaction(async (t) => {
            t.update(db.collection("config").doc("global"), { [campoDB]: increment(val) });
            const cajaId = `C_${Date.now()}_${usuarioActivo.trim()}`;
            t.set(db.collection("historial").doc(cajaId), {
                tipo, metodo: isCajaBanco ? "banco" : "efectivo", moneda: monedaCaja,
                montoCUP: monedaCaja === "CUP" ? monto : 0, montoUSD: monedaCaja === "USD" ? monto : 0,
                montoEfectivoCUP: monedaCaja === "CUP" && !isCajaBanco ? monto : 0,
                montoBancoCUP: monedaCaja === "CUP" && isCajaBanco ? monto : 0,
                montoEfectivoUSD: monedaCaja === "USD" && !isCajaBanco ? monto : 0,
                montoBancoUSD: monedaCaja === "USD" && isCajaBanco ? monto : 0,
                ganancia: 0, nombre: `Ajuste (${monedaCaja}): ${motivoCaja}\n👤 Operador: ${usuarioActivo.trim()}`,
                fecha: serverTimestamp(), estado: "completado"
            });
        });
        setMontoCaja(""); setMotivoCaja(""); triggerSuccessAnimation("Caja Registrada", "Dinero actualizado.");
    } catch (e) { Alert.alert("Error", "Revisa conexión."); }
  };

  const revertirMovimiento = async (mov) => {
    if (mov.estado === "revertido") return Alert.alert("Aviso", "Este movimiento ya fue revertido.");
    Alert.alert("Anular Operación", "¿Seguro que quieres anular este movimiento? El dinero y el stock regresarán a como estaban.", [
        {text: "Cancelar", style: "cancel"}, 
        {text: "SÍ, ANULAR", style: "destructive", onPress: async () => {
            try {
                const batch = db.batch();
                let efeCUPRestar = 0; let banCUPRestar = 0; let efeUSDRestar = 0; let banUSDRestar = 0;
                
                if (mov.montoEfectivoCUP !== undefined) {
                    efeCUPRestar = -safeNum(mov.montoEfectivoCUP);
                    banCUPRestar = -safeNum(mov.montoBancoCUP);
                    efeUSDRestar = -safeNum(mov.montoEfectivoUSD);
                    banUSDRestar = -safeNum(mov.montoBancoUSD);
                } else {
                    const monedaOrig = mov.moneda || 'CUP';
                    const montoCUP = safeNum(mov.montoCUP || mov.monto);
                    const montoUSD = safeNum(mov.montoUSD);
                    if (monedaOrig === 'CUP') {
                        if (mov.metodo === 'cup_efectivo' || mov.metodo === 'efectivo' || !mov.metodo) efeCUPRestar = -montoCUP;
                        if (mov.metodo === 'cup_banco' || mov.metodo === 'banco') banCUPRestar = -montoCUP;
                        if (mov.metodo === 'mixto') { efeCUPRestar = -safeNum(mov.montoEfectivo); banCUPRestar = -safeNum(mov.montoBanco); }
                    } else if (monedaOrig === 'USD') {
                        if (mov.metodo === 'usd_efectivo' || mov.metodo === 'efectivo') efeUSDRestar = -montoUSD;
                        if (mov.metodo === 'usd_banco' || mov.metodo === 'banco') banUSDRestar = -montoUSD;
                    }
                }
                
                if (mov.tipo === 'salida') {
                    efeCUPRestar = Math.abs(efeCUPRestar); banCUPRestar = Math.abs(banCUPRestar);
                    efeUSDRestar = Math.abs(efeUSDRestar); banUSDRestar = Math.abs(banUSDRestar);
                }

                batch.update(db.collection("config").doc("global"), { 
                    dineroEfectivo: increment(efeCUPRestar), dineroBanco: increment(banCUPRestar),
                    usdEfectivo: increment(efeUSDRestar), usdBanco: increment(banUSDRestar)
                });

                if (mov.tipo === "venta" && mov.items) {
                    for (let item of mov.items) {
                        batch.set(db.collection("productos").doc(item.id), { stock: increment(item.cantidad) }, { merge: true });
                        if (item.esGestor && item.gestorId && item.gestorId !== 'anonimo') {
                            batch.set(db.collection("gestores").doc(item.gestorId), { saldo: increment(-(safeNum(item.comisionGestorCup) * item.cantidad)) }, { merge: true });
                        }
                    }
                }

                if (mov.tipo === "salida" && mov.gestorId) { batch.set(db.collection("gestores").doc(mov.gestorId), { saldo: increment(safeNum(mov.montoCUP)) }, { merge: true }); }
                
                batch.update(db.collection("historial").doc(mov.id), { estado: "revertido", revertidoPor: usuarioActivo.trim(), fechaReversion: serverTimestamp() });
                await batch.commit();
                setTimeout(() => triggerSuccessAnimation("Anulado", "Operación revertida con éxito."), 400);
            } catch (e) { setTimeout(() => Alert.alert("Error", "Detalle: " + String(e)), 500); }
        }}
    ]);
  };

  const crearGestor = async () => { if(!nuevoGestor.trim()) return; await db.collection("gestores").add({ nombre: nuevoGestor.trim(), saldo: 0 }); setNuevoGestor(""); };
  const pagarGestor = async (gestorId, nombre, saldoGestor, metodoPago) => {
    if (saldoGestor <= 0) return Alert.alert("Aviso", "No hay comisiones.");
    Alert.alert("Pago en CUP", `Saldar ${formatSeguro(saldoGestor)} CUP a ${nombre} usando ${metodoPago === 'banco' ? 'Banco' : 'Efectivo'}.`, [
      {text: "Cancelar"}, {text: "PAGAR", onPress: async () => {
          try {
              await db.runTransaction(async (t) => {
                  t.update(db.collection("gestores").doc(gestorId), { saldo: 0 });
                  t.update(db.collection("config").doc("global"), { dineroEfectivo: increment(metodoPago === 'efectivo' ? -saldoGestor : 0), dineroBanco: increment(metodoPago === 'banco' ? -saldoGestor : 0) });
                  const pagoId = `P_${Date.now()}_${usuarioActivo.trim()}`;
                  t.set(db.collection("historial").doc(pagoId), {
                      tipo: "salida", metodo: metodoPago, montoCUP: saldoGestor, montoUSD: 0, moneda: "CUP", ganancia: 0,
                      montoEfectivoCUP: metodoPago === 'efectivo' ? saldoGestor : 0, montoBancoCUP: metodoPago === 'banco' ? saldoGestor : 0,
                      nombre: `Pago Comisión: ${nombre}\n👤 Pagó: ${usuarioActivo.trim()}`,
                      gestorId: gestorId, fecha: serverTimestamp(), estado: "completado"
                  });
              });
              triggerSuccessAnimation("Cuenta Saldada", "Comisiones pagadas.");
          } catch(e) { Alert.alert("Error", "Fallo al pagar."); }
      }}
    ]);
  };
  const borrarGestor = async (id, saldo) => { if(saldo > 0) return Alert.alert("Error", "Paga sus comisiones primero."); await db.collection("gestores").doc(id).delete(); };

  const historialFiltrado = historialRaw.filter(h => filtroHistorial === "exitosas" ? h.estado !== 'revertido' : h.estado === 'revertido');
  const historialValido = historialRaw.filter(h => h.estado !== "revertido"); 
  
  const isSameDay = (dateObj1, dateObj2 = new Date()) => {
    if (!dateObj1) return false; const d1 = dateObj1.toDate ? dateObj1.toDate() : new Date(dateObj1); const d2 = dateObj2;
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
  };

  const ventasHoyCUP = historialValido.filter(h => h.tipo === 'venta' && isSameDay(h.fecha)).reduce((acc, h) => acc + safeNum(h.montoCUP || h.monto), 0);
  const ventasHoyUSD = historialValido.filter(h => h.tipo === 'venta' && isSameDay(h.fecha)).reduce((acc, h) => acc + safeNum(h.montoUSD), 0);
  
  const gananciaHoy = historialValido.filter(h => h.tipo === 'venta' && isSameDay(h.fecha)).reduce((acc, h) => acc + safeNum(h.ganancia), 0);
  const gananciaGlobal = historialValido.filter(h => h.tipo === 'venta').reduce((acc, h) => acc + safeNum(h.ganancia), 0) + gananciaBase;

  const chart = (() => {
    const dias = []; const data = [];
    for(let i=6; i>=0; i--) {
      const targetDate = new Date(); targetDate.setDate(targetDate.getDate() - i); dias.push(targetDate.getDate());
      data.push(historialValido.filter(h => h.tipo === 'venta' && isSameDay(h.fecha, targetDate)).reduce((acc, h) => acc + safeNum(h.montoCUP || h.monto) + (safeNum(h.montoUSD || 0) * safeNum(tasaGlobal)), 0));
    }
    return { dias, data, maxVal: Math.max(...data, 1) };
  })();

  if (!dataCargada) {
    return ( <SafeAreaView style={styles.loginContainerLoad}><ActivityIndicator size="large" color="#3b82f6" /><Text style={{color: 'white', marginTop: 15, fontWeight: 'bold'}}>{statusNube}</Text></SafeAreaView> );
  }

  if (!role) {
    if (showPinScreen) {
      return (
        <SafeAreaView style={styles.loginContainer}>
          <Ionicons name="lock-closed" size={60} color="#3b82f6" style={{ alignSelf: 'center', marginBottom: 20 }} />
          <Text style={styles.loginTitle}>ACCESO ADMIN</Text>
          <Text style={{color: '#94a3b8', textAlign: 'center', marginBottom: 30}}>Ingresa tu correo y contraseña</Text>
          <TextInput style={[styles.nameInput, {marginBottom: 10, textTransform: 'none'}]} placeholder="Correo electrónico" placeholderTextColor="#64748b" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <TextInput style={styles.nameInput} placeholder="Contraseña" placeholderTextColor="#64748b" secureTextEntry value={password} onChangeText={setPassword} />
          <TouchableOpacity style={[styles.blueBtn, styles.shadow]} onPress={handleLogin} disabled={isLoggingIn}>
            {isLoggingIn ? <ActivityIndicator color="white" /> : <Text style={styles.btnTextWhite}>ENTRAR SEGURO</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={{padding: 20}} onPress={() => setShowPinScreen(false)}><Text style={{color: '#ef4444', textAlign: 'center', fontWeight: 'bold'}}>Volver</Text></TouchableOpacity>
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={styles.loginContainer}>
        <Image source={require('./logonuevo.png')} style={{ width: 280, height: 120, resizeMode: 'contain', alignSelf: 'center', marginBottom: 30, borderRadius: 15 }} />
        <TouchableOpacity style={[styles.blueBtn, styles.shadow]} onPress={() => setShowPinScreen(true)}>
          <FontAwesome5 name="shield-alt" size={18} color="white" style={{marginRight: 10}} />
          <Text style={styles.btnTextWhite}>ENTRAR COMO DUEÑO</Text>
        </TouchableOpacity>
        <View style={{height: 1, backgroundColor: '#1e293b', marginVertical: 30}} />
        <Text style={{color: '#94a3b8', textAlign: 'center', marginBottom: 10, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1}}>Acceso Rápido Ventas:</Text>
        <TextInput style={styles.nameInput} placeholder="Nombre del dependiente..." placeholderTextColor="#64748b" value={usuarioActivo} onChangeText={setUsuarioActivo} />
        <TouchableOpacity style={[styles.darkBtn, styles.shadow]} onPress={() => { 
          if(!usuarioActivo.trim()) return Alert.alert("Atención", "Por favor ingresa tu nombre.");
          setRole('dependiente'); setScreen('ventas'); 
        }}>
          <Ionicons name="storefront" size={18} color="white" style={{marginRight: 10}} />
          <Text style={styles.btnTextWhite}>ENTRAR A VENDER</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerBar}>
        <Image source={require('./logonuevo.png')} style={{ width: 80, height: 25, resizeMode: 'contain' }} />
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <TouchableOpacity onPress={forzarSincronizacion} style={{marginRight: 15, flexDirection: 'row', alignItems: 'center'}}>
                <Ionicons name={statusNube.includes("Online") || statusNube.includes("Sincro") ? "cloud-done" : "cloud-offline"} size={18} color={statusNube.includes("Online") || statusNube.includes("Sincro") ? "#22c55e" : "#ef4444"} />
            </TouchableOpacity>
            <Text style={{color: '#3b82f6', fontSize: 12, fontWeight: 'bold'}}><FontAwesome5 name={userAuth ? "user-shield" : "user-circle"} size={12} /> {usuarioActivo}</Text>
        </View>
      </View>

      <View style={styles.nav}>
        {role === 'admin' && <Tab icon="chart-bar" title="Métricas" active={screen==="dashboard"} onPress={()=>setScreen("dashboard")}/>}
        <Tab icon="shopping-bag" title="Vender" active={screen==="ventas"} onPress={()=>setScreen("ventas")}/>
        <Tab icon="shopping-cart" title={`Carro (${carrito.length})`} active={screen==="carrito"} onPress={()=>setScreen("carrito")}/>
        {role === 'admin' && <Tab icon="boxes" title="Stock" active={screen==="inventario"} onPress={()=>setScreen("inventario")}/>}
        {role === 'admin' && <Tab icon="wallet" title="Caja" active={screen==="caja"} onPress={()=>setScreen("caja")}/>}
        {role === 'admin' && <Tab icon="users" title="Team" active={screen==="team"} onPress={()=>setScreen("team")}/>}
        {role === 'admin' && <Tab icon="cog" title="Ajustes" active={screen==="config"} onPress={()=>setScreen("config")}/>}
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Ionicons name="exit-outline" size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        
        {screen === "config" && role === 'admin' && (
           <ScrollView showsVerticalScrollIndicator={false}>
             <View style={[styles.invCard, styles.shadow]}>
                <Text style={styles.sectionLabel}><FontAwesome5 name="cog" /> Ajustes Globales</Text>
                
                <Text style={{color: '#94a3b8', fontSize: 13, marginBottom: 5}}>Dólar de Referencia (Para Métricas)</Text>
                <TextInput style={styles.search} keyboardType="numeric" value={tasaGlobal} onChangeText={(t) => {
                    setTasaGlobal(t); if(writeTimeouts.current['tasa']) clearTimeout(writeTimeouts.current['tasa']);
                    writeTimeouts.current['tasa'] = setTimeout(()=> db.collection("config").doc("global").update({tasaGlobal: t}), 1500);
                }} />

                <Text style={{color: '#94a3b8', fontSize: 13, marginBottom: 5}}>Recargo Transferencia CUP (%)</Text>
                <TextInput style={styles.search} keyboardType="numeric" value={recargoBanco} onChangeText={(t) => {
                    setRecargoBanco(t); if(writeTimeouts.current['recargo']) clearTimeout(writeTimeouts.current['recargo']);
                    writeTimeouts.current['recargo'] = setTimeout(()=> db.collection("config").doc("global").update({recargoBanco: Number(t) || 0}), 1500);
                }} />

                <Text style={{color: '#3b82f6', fontSize: 12, marginTop: 10}}><Ionicons name="information-circle" /> Estos valores se aplican a todo el sistema automáticamente y se guardan en la nube.</Text>
             </View>
           </ScrollView>
        )}

        {screen === "dashboard" && role === 'admin' && (
          <ScrollView showsVerticalScrollIndicator={false}>
            
            {/* 🟢 BLOQUE DE CAPITAL TOTAL RESTAURADO Y MEJORADO 🟢 */}
            <View style={[styles.usdContainer, styles.shadow, {alignItems: 'center', marginBottom: 20}]}>
              <Text style={{color: '#94a3b8', fontWeight: 'bold', fontSize: 12, marginBottom: 5, letterSpacing: 1}}><FontAwesome5 name="globe" /> CAPITAL TOTAL ESTIMADO</Text>
              <Text style={{color: '#22c55e', fontSize: 26, fontWeight: 'bold'}}>${((caja.dineroEfectivo + caja.dineroBanco) / safeNum(tasaGlobal) + caja.usdEfectivo + caja.usdBanco).toFixed(2)} USD</Text>
              <Text style={{color: '#64748b', fontSize: 11, marginTop: 5}}>Calculado a la tasa global de {tasaGlobal} CUP</Text>
            </View>

            <View style={{flexDirection: 'row', gap: 10, marginBottom: 10}}>
              <View style={{flex: 1}}><Card icon="money-bill-wave" title="Efectivo CUP" value={`${formatSeguro(caja.dineroEfectivo)}`} color="#22c55e"/></View>
              <View style={{flex: 1}}><Card icon="university" title="Banco CUP" value={`${formatSeguro(caja.dineroBanco)}`} color="#8b5cf6"/></View>
            </View>

            <View style={{flexDirection: 'row', gap: 10, marginBottom: 15}}>
              <View style={{flex: 1}}><Card icon="money-bill-wave" title="Efectivo USD" value={`$${formatSeguro(caja.usdEfectivo)}`} color="#10b981"/></View>
              <View style={{flex: 1}}><Card icon="university" title="Banco USD" value={`$${formatSeguro(caja.usdBanco)}`} color="#3b82f6"/></View>
            </View>

            <View style={{flexDirection: 'row', gap: 10, marginBottom: 10}}>
              <View style={{flex: 1}}><Card icon="chart-bar" title="Recaudado Hoy CUP" value={`${formatSeguro(ventasHoyCUP)}`} color="#3b82f6"/></View>
              <View style={{flex: 1}}><Card icon="chart-bar" title="Recaudado Hoy USD" value={`$${formatSeguro(ventasHoyUSD)}`} color="#3b82f6"/></View>
            </View>

            <View style={{flexDirection: 'row', gap: 10, marginBottom: 20}}>
              <View style={{flex: 1}}><Card icon="calendar-day" title="Ganancia Hoy" value={`${formatSeguro(gananciaHoy)} CUP`} color="#f59e0b"/></View>
              <View style={{flex: 1}}><Card icon="globe" title="Ganancia Global" value={`${formatSeguro(gananciaGlobal)} CUP`} color="#f59e0b"/></View>
            </View>

            <View style={[styles.chartContainer, styles.shadow]}>
              <Text style={styles.sectionLabel}>Ventas Últimos 7 Días (Equiv. CUP)</Text>
              <View style={styles.chartArea}>
                {chart.data.map((val, i) => (
                  <View key={i} style={styles.barCol}>
                    <Text style={styles.barValue}>{val > 0 ? (val > 999 ? (val/1000).toFixed(1)+'k' : val.toFixed(0)) : ''}</Text>
                    <View style={[styles.bar, {height: (val / chart.maxVal) * 100 + 2}]} />
                    <Text style={styles.barDay}>{chart.dias[i]}</Text>
                  </View>
                ))}
              </View>
            </View>

            <Text style={styles.sectionLabel}><FontAwesome5 name="history" /> Auditoría General</Text>
            
            <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, backgroundColor: '#0f172a', padding: 5, borderRadius: 10, borderWidth: 1, borderColor: '#1e293b'}}>
               <TouchableOpacity style={[styles.toggleBtn, filtroHistorial === 'exitosas' && {backgroundColor: '#3b82f6', borderColor: '#3b82f6'}]} onPress={()=>setFiltroHistorial('exitosas')}>
                 <Text style={[styles.btnTextWhite, filtroHistorial !== 'exitosas' && {color: '#64748b'}]}><Ionicons name="checkmark-circle" /> Completadas</Text>
               </TouchableOpacity>
               <TouchableOpacity style={[styles.toggleBtn, filtroHistorial === 'anuladas' && {backgroundColor: '#ef4444', borderColor: '#ef4444'}]} onPress={()=>setFiltroHistorial('anuladas')}>
                 <Text style={[styles.btnTextWhite, filtroHistorial !== 'anuladas' && {color: '#64748b'}]}><Ionicons name="close-circle" /> Anuladas</Text>
               </TouchableOpacity>
            </View>

            {historialFiltrado.slice(0, showCount).map(h => {
              const isRevertido = h.estado === 'revertido';
              const iconMetodo = h.metodo === 'banco' || h.metodo === 'cup_banco' || h.metodo === 'usd_banco' ? 'university' : 'money-bill-wave';
              let dispName = (h.nombre || "Sin Detalle").replace(/, /g, "\n");
              const mCUP = safeNum(h.montoCUP || h.monto); 
              return (
                <View key={h.id} style={[styles.histItem, isRevertido && {backgroundColor: '#0f172a', borderRadius: 8, padding: 10, marginBottom: 8, borderBottomWidth: 0, borderWidth: 1, borderColor: '#334155'}]}>
                  <View style={{flex: 1}}>
                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4}}>
                       <FontAwesome5 name={iconMetodo} size={10} color={isRevertido ? '#ef4444' : '#64748b'} />
                       <Text style={{color: isRevertido ? '#ef4444' : '#64748b', fontSize: 10}}>{h.fecha ? new Date(h.fecha.toDate ? h.fecha.toDate() : h.fecha).toLocaleDateString() : ''} {h.moneda || 'CUP'}</Text>
                    </View>
                    <Text style={{color: isRevertido ? '#94a3b8' : 'white', textDecorationLine: isRevertido ? 'line-through' : 'none', fontSize: 13}}>{dispName}</Text>
                    {isRevertido && h.revertidoPor && <Text style={{color: '#ef4444', fontSize: 11, marginTop: 4}}><Ionicons name="warning" /> Anulado por: {h.revertidoPor}</Text>}
                  </View>
                  <View style={{alignItems: 'flex-end', justifyContent: 'center'}}>
                      {mCUP > 0 && <Text style={{color: isRevertido ? '#64748b' : '#22c55e', fontWeight:'bold', textDecorationLine: isRevertido ? 'line-through' : 'none'}}>{h.tipo==='salida'?'-':'+'} {formatSeguro(mCUP)} CUP</Text>}
                      {safeNum(h.montoUSD) > 0 && <Text style={{color: isRevertido ? '#64748b' : '#3b82f6', fontWeight:'bold', textDecorationLine: isRevertido ? 'line-through' : 'none'}}>{h.tipo==='salida'?'-':'+'} ${formatSeguro(h.montoUSD)} USD</Text>}
                      
                      {h.tipo === 'venta' && !isRevertido && safeNum(h.ganancia) > 0 && (
                        <Text style={{color: '#f59e0b', fontSize: 11, marginTop: 4, fontWeight: 'bold'}}>Ganancia: {formatSeguro(h.ganancia)}</Text>
                      )}

                      {!isRevertido && (
                        <TouchableOpacity onPress={() => revertirMovimiento(h)} style={{padding: 5, marginTop: 5}}>
                           <Text style={{color: '#ef4444', fontSize: 12, fontWeight: 'bold'}}><Ionicons name="close-circle" /> Anular</Text>
                        </TouchableOpacity>
                      )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}

        {screen === "ventas" && (
          <View style={{flex:1}}>
            <View style={{position: 'relative', marginBottom: 15}}>
              <Ionicons name="search" size={20} color="#64748b" style={{position: 'absolute', top: 15, left: 15, zIndex: 1}} />
              <TextInput style={[styles.search, {paddingLeft: 45}]} placeholder="Buscar mercancía..." placeholderTextColor="#64748b" value={busqueda} onChangeText={setBusqueda} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {productos.filter(p => (p.nombre || "").toLowerCase().includes(busqueda.toLowerCase())).map(p => (
                <View key={p.id} style={[styles.saleCard, styles.shadow]}>
                  <View style={{flexDirection:'row', justifyContent:'space-between', alignItems: 'center'}}>
                    <Text style={styles.saleName}>{p.nombre || "Nuevo"}</Text>
                    <View style={{alignItems:'flex-end'}}>
                        <Text style={{color: "#3b82f6", fontSize: 16, fontWeight: 'bold'}}>${formatSeguro(p.precioVentaUsd||0)}</Text>
                        <Text style={{color: "#22c55e", fontSize: 12, fontWeight: 'bold'}}>{formatSeguro(p.precioVentaCup||0)} CUP</Text>
                    </View>
                  </View>
                  <Text style={{color:'#94a3b8', fontSize:12, marginBottom:12, marginTop: 4}}><FontAwesome5 name="box-open" size={10}/> Disp: {p.stock || 0}</Text>
                  
                  {parseFloat(p.stock) > 0 ? (
                    <View style={{flexDirection:'row', gap:10}}>
                      <TouchableOpacity style={[styles.blueBtnSmall, styles.shadow]} onPress={()=>openSaleModal(p, false)}>
                        <Text style={styles.btnTextWhite}><Ionicons name="add-circle" size={14}/> Yo</Text>
                      </TouchableOpacity>
                      {role === 'admin' && (
                        <TouchableOpacity style={[styles.gestorBtnSmall, styles.shadow]} onPress={() => setGestorModal(p)}>
                          <Text style={styles.btnTextWhite}><FontAwesome5 name="user-tag" size={12}/> Gestor</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : <Text style={{color: '#ef4444', fontWeight: 'bold', letterSpacing: 1}}><Ionicons name="warning" /> AGOTADO</Text>}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {screen === "carrito" && (
          <View style={{flex:1}}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {carrito.length === 0 && (
                <View style={{alignItems: 'center', marginTop: 80}}>
                  <Ionicons name="cart-outline" size={80} color="#1e293b" />
                  <Text style={{color: '#64748b', fontSize: 16, marginTop: 10}}>El carrito está vacío</Text>
                </View>
              )}
              {carrito.map((i, idx) => {
                  let etiquetaMetodo = ""; let iconM = "money-bill-wave"; let colM = "#22c55e";
                  if(i.metodoPago === 'cup_efectivo'){ etiquetaMetodo = "CUP Físico"; iconM="money-bill-wave"; colM="#22c55e"; }
                  if(i.metodoPago === 'cup_banco'){ etiquetaMetodo = "CUP Banco"; iconM="university"; colM="#8b5cf6"; }
                  if(i.metodoPago === 'usd_efectivo'){ etiquetaMetodo = "USD Físico"; iconM="dollar-sign"; colM="#10b981"; }
                  if(i.metodoPago === 'usd_banco'){ etiquetaMetodo = "USD Transf"; iconM="university"; colM="#3b82f6"; }
                  
                  return (
                  <View key={idx} style={[styles.cartItem, styles.shadow]}>
                    <View style={{flex: 1}}>
                      <Text style={{color:'white', fontSize: 14}}><Text style={{fontWeight: 'bold', color: '#3b82f6'}}>{i.cantidad}x</Text> {i.nombre}</Text>
                      <View style={{flexDirection: 'row', gap: 10, marginTop: 4, alignItems: 'center'}}>
                          {i.tipoPrecio === 'mayor' && <Text style={{color: '#f59e0b', fontSize: 10, fontWeight: 'bold'}}>MAYORISTA</Text>}
                          <Text style={{color: colM, fontSize: 10, fontWeight: 'bold'}}><FontAwesome5 name={iconM} /> {etiquetaMetodo}</Text>
                      </View>
                      {i.esGestor && <Text style={{color: '#94a3b8', fontSize: 11, marginTop: 4}}>👤 {i.gestorNombre}</Text>}
                    </View>
                    <TouchableOpacity onPress={()=>removeFromCart(i.cartItemId)} style={styles.delBtn}>
                      <Ionicons name="trash" size={16} color="white" />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
            
            {carrito.length > 0 && (
              <View style={[styles.footer, styles.shadow]}>
                
                <View style={{marginBottom: 15, backgroundColor: '#0f172a', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#1e293b'}}>
                  {recargoTotalPre > 0 && (
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5}}>
                      <Text style={{color: '#f59e0b', fontSize: 13}}><Ionicons name="warning" /> Recargo Transferencia ({recargoBanco}%):</Text>
                      <Text style={{color: '#f59e0b', fontWeight: 'bold'}}>+ {formatSeguro(recargoTotalPre)} CUP</Text>
                    </View>
                  )}
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5}}>
                      <Text style={{color: 'white', fontSize: 14}}>TOTAL USD:</Text>
                      <Text style={{color: '#3b82f6', fontSize: 16, fontWeight: 'bold'}}>${formatSeguro(sUsdEfeTxPre + sUsdBanTxPre)}</Text>
                  </View>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                      <Text style={{color: 'white', fontSize: 14}}>TOTAL CUP:</Text>
                      <Text style={{color: '#22c55e', fontSize: 16, fontWeight: 'bold'}}>{formatSeguro(sEfeTxPre + sBanTxPre)}</Text>
                  </View>
                </View>
                
                <TouchableOpacity disabled={loadingVenta} style={[styles.greenBtn, styles.shadow, {paddingVertical: 18, opacity: loadingVenta ? 0.5 : 1}]} onPress={finalizarVenta}>
                  {loadingVenta ? <ActivityIndicator color="white" /> : <Text style={[styles.btnTextWhite, {fontSize: 16, letterSpacing: 1}]}><Ionicons name="checkmark-circle" size={18}/> CONFIRMAR VENTA MIXTA</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {screen === "inventario" && role === 'admin' && (
          <ScrollView showsVerticalScrollIndicator={false}>
            <TouchableOpacity onPress={addProducto} style={[styles.blueBtn, styles.shadow]}><Text style={styles.btnTextWhite}><FontAwesome5 name="plus" /> NUEVO PRODUCTO</Text></TouchableOpacity>
            {productos.map(p => {
              const cU = parseFloat(p.costoUsd) || 0; 
              const cCUP = parseFloat(p.costoCup) || 0; 
              const lb = parseFloat(p.libras) || 0; 
              const pL = parseFloat(p.precioLibraUsd) || 0; 
              const tCosto = parseFloat(p.tasaCosto !== undefined ? p.tasaCosto : p.tasaDolar) || 0; 
              const pV = parseFloat(p.precioVentaCup) || 0;
              
              const costoTotalInversionCUP = (((cU + (lb * pL)) * tCosto) + cCUP); 
              const ganancia = pV - costoTotalInversionCUP;

              return (
                <View key={p.id} style={[styles.invCard, styles.shadow]}>
                  <TextInput style={styles.invTitle} placeholder="Nombre Mercancía" placeholderTextColor="#64748b" value={p.nombre} onChangeText={t=>update(p.id,"nombre",t)} />
                  
                  <View style={{flexDirection:'row', marginTop:15}}>
                    <MiniInp label="Costo USD" val={p.costoUsd} onChange={t=>update(p.id,"costoUsd",t)} />
                    <MiniInp label="Costo CUP" val={p.costoCup} onChange={t=>update(p.id,"costoCup",t)} />
                    <MiniInp label="Lbs" val={p.libras} onChange={t=>update(p.id,"libras",t)} />
                    <MiniInp label="Env/Lb" val={p.precioLibraUsd} onChange={t=>update(p.id,"precioLibraUsd",t)} />
                  </View>
                  
                  <View style={{flexDirection:'row', marginTop:10}}>
                    <MiniInp label="Tasa COSTO" val={p.tasaCosto !== undefined ? p.tasaCosto : p.tasaDolar} onChange={t=>update(p.id,"tasaCosto",t)} />
                    <MiniInp label="Tasa VENTA" val={p.tasaDolar} onChange={t=>handleTasaChange(p.id, t, p.precioVentaUsd, p.precioMayoristaUsd)} />
                    <MiniInp label="Venta $" val={p.precioVentaUsd} onChange={t=>handleVentaUsdChange(p.id, t, p.tasaDolar)} />
                    <MiniInp label="Venta CUP" val={p.precioVentaCup} onChange={t=>update(p.id,"precioVentaCup",t)} />
                  </View>

                  <View style={{flexDirection:'row', marginTop:10}}>
                    <MiniInp label="MAYOR $" val={p.precioMayoristaUsd} onChange={t=>handleMayoristaUsdChange(p.id, t, p.tasaDolar)} />
                    <MiniInp label="MAYOR CUP" val={p.precioMayoristaCup} onChange={t=>update(p.id,"precioMayoristaCup",t)} />
                    <MiniInp label="Comisión G." val={p.comisionGestorCup} onChange={t=>update(p.id,"comisionGestorCup",t)} />
                    <MiniInp label="Stock" val={p.stock} onChange={t=>update(p.id,"stock",t)} />
                  </View>

                  <View style={styles.summaryBox}>
                    <Text style={{color:'#f59e0b', fontSize:12, fontWeight:'bold', marginBottom: 6}}><FontAwesome5 name="chart-pie" /> Inversión Total: {formatSeguro(costoTotalInversionCUP)} CUP</Text>
                    <Text style={{color:'#22c55e', fontSize:12, fontWeight:'bold'}}><FontAwesome5 name="chart-line" /> Ganancia (P. Normal): {formatSeguro(ganancia)} CUP</Text>
                  </View>

                  <TouchableOpacity style={{marginTop: 15, alignSelf: 'flex-end'}} onPress={() => Alert.alert("Borrar", "¿Eliminar para siempre?", [{text:"No"}, {text:"Sí", onPress:()=> db.collection("productos").doc(p.id).delete() }])}>
                    <Text style={{color:'#ef4444', fontSize:11, fontWeight: 'bold'}}><Ionicons name="trash" size={12}/> ELIMINAR</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        )}

        {screen === "caja" && role === 'admin' && (
          <ScrollView>
            <View style={[styles.invCard, styles.shadow]}>
              <Text style={styles.sectionLabel}><FontAwesome5 name="cash-register" /> Ajuste Manual de Cajas</Text>
              
              <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10}}>
                 <TouchableOpacity style={[styles.toggleBtn, monedaCaja === 'CUP' && {backgroundColor: '#22c55e', borderColor: '#22c55e'}]} onPress={()=>setMonedaCaja('CUP')}>
                   <Text style={[styles.btnTextWhite, monedaCaja !== 'CUP' && {color: '#64748b'}]}>Pesos (CUP)</Text>
                 </TouchableOpacity>
                 <TouchableOpacity style={[styles.toggleBtn, monedaCaja === 'USD' && {backgroundColor: '#3b82f6', borderColor: '#3b82f6'}]} onPress={()=>setMonedaCaja('USD')}>
                   <Text style={[styles.btnTextWhite, monedaCaja !== 'USD' && {color: '#64748b'}]}>Dólares (USD)</Text>
                 </TouchableOpacity>
              </View>

              <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20}}>
                 <TouchableOpacity style={[styles.toggleBtn, !isCajaBanco && {backgroundColor: '#334155', borderColor: 'white'}]} onPress={()=>setIsCajaBanco(false)}>
                   <Text style={[styles.btnTextWhite, isCajaBanco && {color: '#64748b'}]}><FontAwesome5 name="money-bill-wave" /> Efectivo Físico</Text>
                 </TouchableOpacity>
                 <TouchableOpacity style={[styles.toggleBtn, isCajaBanco && {backgroundColor: '#334155', borderColor: 'white'}]} onPress={()=>setIsCajaBanco(true)}>
                   <Text style={[styles.btnTextWhite, !isCajaBanco && {color: '#64748b'}]}><FontAwesome5 name="university" /> Cuenta / Banco</Text>
                 </TouchableOpacity>
              </View>

              <TextInput style={styles.search} placeholder="Motivo (Gasto, Inversión...)" placeholderTextColor="#64748b" value={motivoCaja} onChangeText={setMotivoCaja} />
              <TextInput style={styles.search} placeholder={`Monto en ${monedaCaja}`} placeholderTextColor="#64748b" keyboardType="decimal-pad" value={montoCaja} onChangeText={setMontoCaja} />
              <View style={{flexDirection: 'row', gap: 10, marginTop: 10}}>
                <TouchableOpacity style={[styles.greenBtn, styles.shadow, {flex: 1}]} onPress={()=>registrarCaja("entrada")}><Text style={styles.btnTextWhite}><Ionicons name="arrow-down-circle" size={16}/> Ingresar</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.delBtn, styles.shadow, {flex: 1, height: 'auto', padding: 15, borderRadius: 12}]} onPress={()=>registrarCaja("salida")}><Text style={styles.btnTextWhite}><Ionicons name="arrow-up-circle" size={16}/> Retirar</Text></TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        )}

        {screen === "team" && role === 'admin' && (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={[styles.invCard, styles.shadow]}>
               <Text style={styles.sectionLabel}><FontAwesome5 name="medal" /> Gestión de Comisiones</Text>
               <View style={{flexDirection: 'row', gap: 10, marginBottom: 20}}>
                 <TextInput style={[styles.search, {flex: 1, marginBottom: 0}]} placeholder="Nombre del gestor" placeholderTextColor="#64748b" value={nuevoGestor} onChangeText={setNuevoGestor} />
                 <TouchableOpacity style={[styles.blueBtn, {marginBottom: 0, paddingHorizontal: 20}]} onPress={crearGestor}><FontAwesome5 name="plus" size={16} color="white" /></TouchableOpacity>
               </View>

               {gestores.map(g => (
                 <View key={g.id} style={{backgroundColor: '#0f172a', padding: 15, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#334155'}}>
                   <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10}}>
                     <Text style={{color: 'white', fontSize: 18, fontWeight: 'bold'}}><FontAwesome5 name="user-tie" color="#3b82f6" /> {g.nombre}</Text>
                     <TouchableOpacity onPress={()=>borrarGestor(g.id, g.saldo)}><Ionicons name="trash" size={18} color="#ef4444" /></TouchableOpacity>
                   </View>
                   <Text style={{color: '#94a3b8', marginBottom: 10}}>Por cobrar: <Text style={{color: '#22c55e', fontWeight: 'bold', fontSize: 16}}>{formatSeguro(g.saldo || 0)} CUP</Text></Text>
                   
                   {g.saldo > 0 && (
                     <View style={{flexDirection: 'row', gap: 10}}>
                       <TouchableOpacity style={[styles.greenBtn, {flex: 1, padding: 12}]} onPress={() => pagarGestor(g.id, g.nombre, g.saldo, 'efectivo')}>
                         <Text style={[styles.btnTextWhite, {fontSize: 12}]}><FontAwesome5 name="money-bill-wave" /> Pagar Efect.</Text>
                       </TouchableOpacity>
                       <TouchableOpacity style={[styles.greenBtn, {flex: 1, backgroundColor: '#8b5cf6', padding: 12}]} onPress={() => pagarGestor(g.id, g.nombre, g.saldo, 'banco')}>
                         <Text style={[styles.btnTextWhite, {fontSize: 12}]}><FontAwesome5 name="university" /> Pagar Transf.</Text>
                       </TouchableOpacity>
                     </View>
                   )}
                 </View>
               ))}
            </View>
          </ScrollView>
        )}
      </View>

      {/* 🟢 MODAL DE VENTA POR PRODUCTO (CANTIDAD Y MÉTODO DE PAGO) 🟢 */}
      {saleModalConfig && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={{color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 5, textAlign: 'center'}}>{saleModalConfig.producto.nombre}</Text>
            {saleModalConfig.esGestor && <Text style={{color: '#94a3b8', textAlign: 'center', marginBottom: 15}}>👤 Gestor: {saleModalConfig.gestorNombre}</Text>}
            
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 20, backgroundColor: '#0f172a', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#334155'}}>
                <TouchableOpacity onPress={() => setSaleModalConfig({...saleModalConfig, cantidad: Math.max(1, saleModalConfig.cantidad - 1)})} style={styles.qtyBtn}>
                    <Ionicons name="remove" size={24} color="white" />
                </TouchableOpacity>
                <Text style={{color: 'white', fontSize: 24, fontWeight: 'bold'}}>{saleModalConfig.cantidad}</Text>
                <TouchableOpacity onPress={() => setSaleModalConfig({...saleModalConfig, cantidad: saleModalConfig.cantidad + 1})} style={styles.qtyBtn}>
                    <Ionicons name="add" size={24} color="white" />
                </TouchableOpacity>
            </View>

            <Text style={{color: '#94a3b8', fontSize: 12, marginBottom: 8, textAlign: 'center'}}>TIPO DE PRECIO:</Text>
            <View style={{flexDirection: 'row', gap: 10, marginBottom: 20}}>
                <TouchableOpacity style={[styles.toggleBtn, saleModalConfig.tipoPrecio === 'normal' && {backgroundColor: '#3b82f6', borderColor: '#3b82f6'}]} onPress={()=>setSaleModalConfig({...saleModalConfig, tipoPrecio: 'normal'})}>
                    <Text style={[styles.btnTextWhite, saleModalConfig.tipoPrecio !== 'normal' && {color: '#64748b'}]}>Normal</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.toggleBtn, saleModalConfig.tipoPrecio === 'mayor' && {backgroundColor: '#f59e0b', borderColor: '#f59e0b'}]} onPress={()=>setSaleModalConfig({...saleModalConfig, tipoPrecio: 'mayor'})}>
                    <Text style={[styles.btnTextWhite, saleModalConfig.tipoPrecio !== 'mayor' && {color: '#64748b'}]}>Mayorista</Text>
                </TouchableOpacity>
            </View>

            <Text style={{color: '#94a3b8', fontSize: 12, marginBottom: 8, textAlign: 'center'}}>MÉTODO DE PAGO PARA ESTE PRODUCTO:</Text>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20}}>
                <TouchableOpacity style={[styles.toggleBtn, saleModalConfig.metodoPago === 'cup_efectivo' && {backgroundColor: '#22c55e', borderColor: '#22c55e'}]} onPress={()=>setSaleModalConfig({...saleModalConfig, metodoPago: 'cup_efectivo'})}>
                    <Text style={[styles.btnTextWhite, saleModalConfig.metodoPago !== 'cup_efectivo' && {color: '#64748b'}]}><FontAwesome5 name="money-bill-wave" /> CUP Efect.</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.toggleBtn, saleModalConfig.metodoPago === 'cup_banco' && {backgroundColor: '#8b5cf6', borderColor: '#8b5cf6'}]} onPress={()=>setSaleModalConfig({...saleModalConfig, metodoPago: 'cup_banco'})}>
                    <Text style={[styles.btnTextWhite, saleModalConfig.metodoPago !== 'cup_banco' && {color: '#64748b'}]}><FontAwesome5 name="university" /> CUP Banco</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.toggleBtn, saleModalConfig.metodoPago === 'usd_efectivo' && {backgroundColor: '#10b981', borderColor: '#10b981'}]} onPress={()=>setSaleModalConfig({...saleModalConfig, metodoPago: 'usd_efectivo'})}>
                    <Text style={[styles.btnTextWhite, saleModalConfig.metodoPago !== 'usd_efectivo' && {color: '#64748b'}]}><FontAwesome5 name="dollar-sign" /> USD Efect.</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.toggleBtn, saleModalConfig.metodoPago === 'usd_banco' && {backgroundColor: '#3b82f6', borderColor: '#3b82f6'}]} onPress={()=>setSaleModalConfig({...saleModalConfig, metodoPago: 'usd_banco'})}>
                    <Text style={[styles.btnTextWhite, saleModalConfig.metodoPago !== 'usd_banco' && {color: '#64748b'}]}><FontAwesome5 name="university" /> USD Transf.</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.greenBtn, styles.shadow, {marginBottom: 10}]} onPress={confirmAddToCart}>
                <Text style={styles.btnTextWhite}><Ionicons name="cart" size={18}/> AGREGAR AL CARRITO</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{padding: 15}} onPress={() => setSaleModalConfig(null)}>
              <Text style={{color: '#ef4444', textAlign: 'center', fontWeight: 'bold'}}>CANCELAR</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* --- MODAL DE GESTORES CON SCROLL FIJO --- */}
      {gestorModal && !saleModalConfig && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={{color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center'}}><FontAwesome5 name="user-tag" /> Selecciona Gestor</Text>
            {gestores.length === 0 && <Text style={{color: '#94a3b8', textAlign: 'center'}}>No hay gestores creados. Ve a la pestaña TEAM.</Text>}
            <ScrollView style={{ maxHeight: 250 }} showsVerticalScrollIndicator={true}>
              {gestores.map(g => (
                <TouchableOpacity key={g.id} style={[styles.blueBtn, styles.shadow, {marginBottom: 12}]} onPress={() => { openSaleModal(gestorModal, true, g.id, g.nombre); setGestorModal(null); }}>
                  <Text style={styles.btnTextWhite}>{g.nombre}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={{marginTop: 15, padding: 15}} onPress={() => setGestorModal(null)}>
              <Text style={{color: '#ef4444', textAlign: 'center', fontWeight: 'bold'}}>CANCELAR</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* --- MODAL ANIMADO DE ÉXITO --- */}
      <Modal transparent={true} visible={successModal.visible} animationType="fade">
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalContent, { transform: [{ scale: scaleAnim }], alignItems: 'center', backgroundColor: '#0f172a', borderColor: '#22c55e', borderWidth: 2 }]}>
            <Ionicons name="checkmark-circle" size={80} color="#22c55e" style={{marginBottom: 15}} />
            <Text style={{color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 10}}>{successModal.title}</Text>
            <Text style={{color: '#94a3b8', fontSize: 16, textAlign: 'center'}}>{successModal.msg}</Text>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const Tab = ({title, onPress, active, icon}) => (
  <TouchableOpacity onPress={onPress} style={[styles.tab, active && {borderBottomColor: '#3b82f6'}]}>
    <FontAwesome5 name={icon} size={16} color={active ? '#3b82f6' : '#64748b'} style={{marginBottom: 4}} />
    <Text style={[styles.btnText, {fontSize:9}, active && {color: '#3b82f6'}]}>{title}</Text>
  </TouchableOpacity>
);

const Card = ({title, value, color, icon}) => (
  <View style={[styles.infoCard, styles.shadow, {borderLeftColor: color}]}>
    <Text style={{color: '#94a3b8', fontSize: 11, marginBottom: 5}}><FontAwesome5 name={icon} /> {title}</Text>
    <Text style={{color: 'white', fontSize: 18, fontWeight: 'bold'}}>{value}</Text>
  </View>
);

const MiniInp = ({label, val, onChange}) => (
  <View style={{flex:1, marginHorizontal:2}}>
    <Text style={{color:'#94a3b8', fontSize:9, marginBottom: 4}}>{label}</Text>
    <TextInput style={styles.miniInput} keyboardType="decimal-pad" value={(val === 0 || val === "0") ? "" : String(val || "")} onChangeText={onChange} />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020617" }, 
  headerBar: { backgroundColor: '#020617', paddingVertical: 10, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#0f172a' },
  loginContainer: { flex: 1, justifyContent: 'center', padding: 35, backgroundColor: "#020617" },
  loginContainerLoad: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: "#020617" },
  loginTitle: { color: 'white', fontSize: 26, fontWeight: 'bold', textAlign: 'center', letterSpacing: 2 },
  nameInput: { backgroundColor: '#0f172a', color: 'white', padding: 18, borderRadius: 12, marginBottom: 20, textAlign: 'center', fontSize: 18, borderWidth: 1, borderColor: '#334155' },
  nav: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 12, backgroundColor: "#0f172a", borderTopWidth: 1, borderTopColor: '#1e293b' },
  tab: { paddingVertical: 5, borderBottomWidth: 2, borderBottomColor: 'transparent', flex: 1, alignItems: 'center' },
  logoutBtn: { padding: 10, justifyContent: 'center' },
  content: { flex: 1, padding: 15 },
  shadow: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 6 },
  infoCard: { backgroundColor: "#1e293b", padding: 15, borderRadius: 14, marginBottom: 0, borderLeftWidth: 4 },
  usdContainer: { backgroundColor: '#1e293b', padding: 20, borderRadius: 14, marginBottom: 15, borderWidth: 1, borderColor: '#22c55e' },
  usdInput: { backgroundColor: '#0f172a', color: 'white', padding: 8, borderRadius: 8, width: 90, textAlign: 'center', fontWeight: 'bold', fontSize: 16 },
  toggleBtn: { flex: 0.48, padding: 12, alignItems: 'center', borderRadius: 8, flexDirection: 'row', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#334155', backgroundColor: '#0f172a' },
  chartContainer: { backgroundColor: '#1e293b', padding: 20, borderRadius: 14, marginBottom: 20 },
  chartArea: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 110, marginTop: 15 },
  barCol: { alignItems: 'center', width: 35 },
  bar: { backgroundColor: '#3b82f6', width: 18, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barValue: { color: '#22c55e', fontSize: 9, marginBottom: 4, fontWeight: 'bold' },
  barDay: { color: '#94a3b8', fontSize: 10, marginTop: 6 },
  invCard: { backgroundColor: "#1e293b", padding: 20, borderRadius: 14, marginBottom: 15 },
  saleCard: { backgroundColor: "#1e293b", padding: 18, borderRadius: 14, marginBottom: 15 },
  saleName: { color: "white", fontSize: 18, fontWeight: 'bold' },
  blueBtnSmall: { backgroundColor: '#3b82f6', padding: 12, borderRadius: 10, flex:1, alignItems:'center', flexDirection: 'row', justifyContent: 'center', gap: 5 },
  gestorBtnSmall: { backgroundColor: '#f59e0b', padding: 12, borderRadius: 10, flex:1, alignItems:'center', flexDirection: 'row', justifyContent: 'center', gap: 5 },
  cartItem: { flexDirection: 'row', backgroundColor: '#1e293b', padding: 15, borderRadius: 14, marginBottom: 10, alignItems:'center' },
  delBtn: { backgroundColor: '#ef4444', width: 35, height: 35, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  footer: { padding: 20, backgroundColor: '#020617', borderTopWidth: 1, borderColor: '#1e293b' },
  totalText: { color: 'white', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginVertical: 15 },
  search: { backgroundColor: '#1e293b', color: 'white', padding: 15, borderRadius: 12, marginBottom: 15, fontSize: 16 },
  invTitle: { color: 'white', fontSize: 18, fontWeight: 'bold', borderBottomWidth:1, borderBottomColor:'#334155', paddingBottom:10 },
  miniInput: { backgroundColor: '#0f172a', color: 'white', padding: 8, borderRadius: 8, fontSize: 13, borderWidth: 1, borderColor: '#334155' },
  blueBtn: { backgroundColor: "#3b82f6", padding: 18, borderRadius: 12, alignItems: 'center', marginBottom: 15, flexDirection: 'row', justifyContent: 'center', gap: 10 },
  greenBtn: { backgroundColor: "#22c55e", padding: 18, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10 },
  darkBtn: { backgroundColor: "#1e293b", padding: 18, borderRadius: 12, alignItems: 'center', marginBottom: 15, borderWidth: 1, borderColor: '#334155', flexDirection: 'row', justifyContent: 'center', gap: 10 },
  btnTextWhite: { color: "white", fontWeight: 'bold', textAlign:'center', fontSize: 14 },
  sectionLabel: { color: '#94a3b8', fontSize: 13, fontWeight: 'bold', marginVertical: 15, textTransform: 'uppercase', letterSpacing: 1 },
  histItem: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth:1, borderBottomColor:'#1e293b' },
  summaryBox: { backgroundColor: '#0f172a', padding: 15, borderRadius: 10, marginTop: 15, borderWidth: 1, borderColor: '#1e293b' },
  modalOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20, zIndex: 100 },
  modalContent: { backgroundColor: '#1e293b', padding: 30, borderRadius: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 10 },
  qtyBtn: { backgroundColor: '#334155', width: 45, height: 45, borderRadius: 10, justifyContent: 'center', alignItems: 'center' }
});
