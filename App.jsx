import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const BACKEND_URL = 'https://bolsa-backend-tjib.onrender.com';
const socket = io(BACKEND_URL);

export default function App() {
  const [activos, setActivos] = useState([]);
  const [noticias, setNoticias] = useState([]);
  const [saldoARS, setSaldoARS] = useState(1000000); // $1.000.000 inicial
  const [saldoUSD, setSaldoUSD] = useState(1000);    // US$ 1.000 inicial
  const [cartera, setCartera] = useState({});        // { YPFD: { cantidad: 10, costoPromedio: 32000 } }
  const [segundosRestantes, setSegundosRestantes] = useState(180);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/mercado`)
      .then(res => res.json())
      .then(data => {
        setActivos(data.activos);
        setNoticias(data.noticias);
      });

    socket.on('actualizacion_mercado', (data) => {
      setActivos(data.activos);
      setNoticias(data.noticias);
      setSegundosRestantes(180);
    });

    const timer = setInterval(() => {
      setSegundosRestantes(prev => (prev > 0 ? prev - 1 : 180));
    }, 1000);

    return () => {
      socket.off('actualizacion_mercado');
      clearInterval(timer);
    };
  }, []);

  const operar = (activo, tipoOperacion) => {
    const precio = parseFloat(activo.precio_actual);
    const esPesos = activo.moneda === 'ARS';

    if (tipoOperacion === 'COMPRAR') {
      if (esPesos && saldoARS < precio) return alert('Saldo en pesos insuficiente');
      if (!esPesos && saldoUSD < precio) return alert('Saldo en dólares insuficiente');

      esPesos ? setSaldoARS(s => s - precio) : setSaldoUSD(s => s - precio);

      setCartera(prev => {
        const actual = prev[activo.ticker] || { cantidad: 0, totalInvertido: 0 };
        const nuevaCant = actual.cantidad + 1;
        const nuevoTotal = actual.totalInvertido + precio;
        return {
          ...prev,
          [activo.ticker]: {
            cantidad: nuevaCant,
            totalInvertido: nuevoTotal,
            costoPromedio: nuevoTotal / nuevaCant
          }
        };
      });
    } else {
      const actual = cartera[activo.ticker];
      if (!actual || actual.cantidad <= 0) return alert('No tenés este activo en cartera');

      esPesos ? setSaldoARS(s => s + precio) : setSaldoUSD(s => s + precio);

      setCartera(prev => {
        const nuevaCant = actual.cantidad - 1;
        return {
          ...prev,
          [activo.ticker]: {
            ...actual,
            cantidad: nuevaCant,
            totalInvertido: actual.costoPromedio * nuevaCant
          }
        };
      });
    }
  };

  const formatTiempo = (seg) => `${Math.floor(seg / 60)}:${(seg % 60).toString().padStart(2, '0')}`;

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: '1100px', margin: '0 auto', padding: '20px', backgroundColor: '#f4f6f9' }}>
      {/* Encabezado y Billetera */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b', color: 'white', padding: '20px', borderRadius: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px' }}>Simulador Bursátil BYMA & Wall Street</h1>
          <p style={{ margin: '5px 0 0', color: '#94a3b8' }}>Próxima rueda en: <strong>{formatTiempo(segundosRestantes)}</strong></p>
        </div>
        <div style={{ display: 'flex', gap: '20px', textAlign: 'right' }}>
          <div>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>DISPONIBLE ARS</span>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#4ade80' }}>${saldoARS.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
          </div>
          <div>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>DISPONIBLE USD</span>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#38bdf8' }}>US$ {saldoUSD.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
      </header>

      {/* Panel de Noticias de Último Momento */}
      <section style={{ marginTop: '20px', background: '#fff3cd', borderLeft: '5px solid #f59e0b', padding: '15px', borderRadius: '8px' }}>
        <h3 style={{ margin: '0 0 10px', color: '#92400e' }}>📰 Noticias del Mercado (Impactan en el próximo cierre de 3 min)</h3>
        {noticias.length === 0 ? <p>Esperando apertura de noticias...</p> : (
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {noticias.map(n => (
              <li key={n.id} style={{ marginBottom: '5px' }}>
                <strong>[{n.ticker_afectado || 'MERCADO'}]</strong> {n.titular}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Panel de Cotizaciones */}
      <section style={{ marginTop: '20px', background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
        <h2>Panel de Cotizaciones</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>
              <th style={{ padding: '10px' }}>Ticker</th>
              <th>Instrumento</th>
              <th>Tipo</th>
              <th>Cotización</th>
              <th>Variación</th>
              <th>En Cartera</th>
              <th>Operar</th>
            </tr>
          </thead>
          <tbody>
            {activos.map(a => {
              const actual = parseFloat(a.precio_actual);
              const anterior = parseFloat(a.precio_anterior);
              const varPct = (((actual - anterior) / anterior) * 100).toFixed(2);
              const tenencia = cartera[a.ticker]?.cantidad || 0;

              return (
                <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 10px', fontWeight: 'bold' }}>{a.ticker}</td>
                  <td>{a.nombre}</td>
                  <td><span style={{ background: '#e2e8f0', padding: '3px 8px', borderRadius: '12px', fontSize: '12px' }}>{a.tipo}</span></td>
                  <td style={{ fontWeight: 'bold' }}>{a.moneda === 'ARS' ? '$' : 'US$'} {actual.toLocaleString('es-AR')}</td>
                  <td style={{ color: varPct >= 0 ? '#16a34a' : '#dc2626', fontWeight: 'bold' }}>
                    {varPct >= 0 ? `+${varPct}%` : `${varPct}%`}
                  </td>
                  <td>{tenencia} unid.</td>
                  <td>
                    <button onClick={() => operar(a, 'COMPRAR')} style={{ background: '#16a34a', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', marginRight: '5px' }}>Comprar</button>
                    <button onClick={() => operar(a, 'VENDER')} style={{ background: '#dc2626', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>Vender</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
