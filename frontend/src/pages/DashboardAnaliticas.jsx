import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { getAnaliticasDashboard } from "../services/analiticasService";

// --- COMPONENTE AUXILIAR PARA TARJETAS KPI (Versión Robustecida) ---
const KpiCard = ({ title, value, unit, iconColor, icon }) => {
  // SEGURIDAD: Si el valor es null o vacío, mostramos un guion para que no quede en blanco
  const valorAMostrar = (value === null || value === undefined || value === '') ? '-' : value;
  
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
      <div className={`p-3 rounded-full ${iconColor} bg-opacity-10 text-xl`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-900">
          {valorAMostrar} <span className="text-base font-normal text-gray-600">{unit}</span>
        </p>
      </div>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL DEL DASHBOARD ---
const DashboardAnaliticas = () => {
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const obtenerDatos = async () => {
      try {
        const json = await getAnaliticasDashboard();
        setData(json);
      } catch (err) {
        setError(err.message);
      } finally {
        setCargando(false);
      }
    };
    obtenerDatos();
  }, []);

  if (cargando) return <div className="p-8 text-center text-gray-500 font-medium">Cargando métricas de la almazara... ⚙️</div>;
  if (error) return <div className="p-8 text-center text-red-600 font-medium">Hubo un problema: {error}</div>;
  
  // SEGURIDAD: Verificamos que el backend mandó la estructura completa
  if (!data || !data.kpis || !data.produccionSemanal || !data.tendenciaRendimiento) {
      return <div className="p-8 text-center text-gray-500 font-medium">El backend respondió con datos incompletos o vacíos. Revisar API.</div>;
  }

  return (
    <div className="p-6 md:p-8 bg-gray-50 min-h-screen">
      {/* Encabezado */}
      <div className="mb-8">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard de Analíticas</h1>
          <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full border border-blue-200">
            Temporada 2026
          </span>
        </div>
        <p className="text-gray-600 mt-1">
          Monitoreo en tiempo real de la producción acumulada y el estado actual de la planta.
        </p>
      </div>

      {/* 1. SECCIÓN KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <KpiCard title="Total Oliva Ingresada" value={data.kpis?.totalOliva} unit="kg" iconColor="text-green-600" icon="🍃" />
        <KpiCard title="Aceite Producido" value={data.kpis?.totalAceite} unit="L" iconColor="text-yellow-600" icon="🛢️" />
        <KpiCard title="Rendimiento Promedio" value={data.kpis?.rendimientoPromedio} unit="%" iconColor="text-blue-600" icon="📈" />
        <KpiCard title="Lotes Activos" value={data.kpis?.lotesActivos} unit="lotes" iconColor="text-orange-600" icon="🏭" />
      </div>

      {/* 2. SECCIÓN GRÁFICOS */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        
        {/* Gráfico A: Barras Ingreso vs Producción */}
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Ingreso vs. Producción</h2>
          <p className="text-sm text-gray-500 mb-6">Comparativa semanal de kilos ingresados y litros extraídos.</p>
          <div className="h-80">
            {data.produccionSemanal.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400 font-medium bg-gray-50 rounded-lg">No hay datos de producción semanal.</div>
            ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.produccionSemanal} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    {/* ACA ESTÁ LA MAGIA: Lee la variable "semana" que manda el backend */}
                    <XAxis dataKey="semana" />
                    <YAxis tick={{fontSize: 12, fill: '#6b7280'}} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{border: 'none', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                    <Legend iconType="circle" wrapperStyle={{paddingTop: '20px', fontSize: '14px'}} />
                    <Bar dataKey="oliva" name="Oliva (kg)" fill="#16a34a" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="aceite" name="Aceite (L)" fill="#ca8a04" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Gráfico B: Líneas Evolución Rendimiento */}
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Evolución del Rendimiento</h2>
          <p className="text-sm text-gray-500 mb-6">Porcentaje de extracción a lo largo de las semanas.</p>
          <div className="h-80">
            {data.tendenciaRendimiento.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400 font-medium bg-gray-50 rounded-lg">No hay datos de tendencia de rendimiento.</div>
            ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.tendenciaRendimiento} margin={{ top: 10, right: 30, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    {/* ACA ESTÁ LA MAGIA: Lee la variable "semana" que manda el backend */}
                    <XAxis dataKey="semana" />
                    <YAxis domain={['auto', 'auto']} tick={{fontSize: 12, fill: '#6b7280'}} axisLine={false} tickLine={false} unit="%" />
                    <Tooltip contentStyle={{border: 'none', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} unit="%" />
                    <Legend iconType="circle" wrapperStyle={{paddingTop: '20px', fontSize: '14px'}} />
                    <Line type="monotone" dataKey="rendimiento" name="Rendimiento (%)" stroke="#2563eb" strokeWidth={3} dot={{ r: 5, strokeWidth: 3, fill: 'white' }} activeDot={{ r: 6, stroke: '#2563eb', fill: 'white' }} />
                  </LineChart>
                </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default DashboardAnaliticas;