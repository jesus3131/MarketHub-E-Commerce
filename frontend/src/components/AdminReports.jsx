import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line, Bar, Doughnut, Pie } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  ArcElement, Title, Tooltip, Legend, Filler);

const API = '';

const CHART_COLORS = ['#005bc0', '#10b981', '#d97706', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1'];
const STATUS_COLORS = { confirmed: '#10b981', pending: '#d97706', cancelled: '#ef4444', processing: '#3b82f6', shipped: '#8b5cf6' };

function dateRangePreset(preset) {
  const now = new Date();
  const end = now.toISOString().split('T')[0];
  let start;
  switch (preset) {
    case '7d': start = new Date(now.getTime() - 7 * 864e5).toISOString().split('T')[0]; break;
    case '30d': start = new Date(now.getTime() - 30 * 864e5).toISOString().split('T')[0]; break;
    case '90d': start = new Date(now.getTime() - 90 * 864e5).toISOString().split('T')[0]; break;
    case '12m': start = new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString().split('T')[0]; break;
    default: start = new Date(now.getTime() - 30 * 864e5).toISOString().split('T')[0];
  }
  return { startDate: start, endDate: end };
}

export default function AdminReports({ token, showMessage }) {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [preset, setPreset] = useState('30d');
  const [startDate, setStartDate] = useState(dateRangePreset('30d').startDate);
  const [endDate, setEndDate] = useState(dateRangePreset('30d').endDate);
  const [categoryId, setCategoryId] = useState('');
  const [granularity, setGranularity] = useState('day');
  const [categories, setCategories] = useState([]);

  const [dashboard, setDashboard] = useState(null);
  const [stats, setStats] = useState(null);
  const [trends, setTrends] = useState(null);
  const [salesByCat, setSalesByCat] = useState([]);
  const [productPerf, setProductPerf] = useState([]);
  const [orderStatus, setOrderStatus] = useState([]);
  const [summaryMetrics, setSummaryMetrics] = useState(null);

  const [csvText, setCsvText] = useState('');
  const [csvResult, setCsvResult] = useState(null);
  const [uploading, setUploading] = useState(false);

  const chartRef = useRef(null);

  const buildQuery = useCallback((base) => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (categoryId) params.set('categoryId', categoryId);
    if (granularity) params.set('granularity', granularity);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }, [startDate, endDate, categoryId, granularity]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [dash, stat, trend, sbc, pp, os, sm] = await Promise.all([
        fetch(`${API}/api/dashboard`, { headers }).then(r => r.json()).catch(() => ({})),
        fetch(`${API}/api/stats`, { headers }).then(r => r.json()).catch(() => ({})),
        fetch(`${API}/api/trends`, { headers }).then(r => r.json()).catch(() => ({})),
        fetch(buildQuery(`${API}/api/reports/sales-by-category`), { headers }).then(r => r.json()).catch(() => []),
        fetch(buildQuery(`${API}/api/reports/product-performance?limit=20`), { headers }).then(r => r.json()).catch(() => []),
        fetch(buildQuery(`${API}/api/reports/order-status`), { headers }).then(r => r.json()).catch(() => []),
        fetch(buildQuery(`${API}/api/reports/summary`), { headers }).then(r => r.json()).catch(() => null)
      ]);
      setDashboard(dash);
      setStats(stat);
      setTrends(trend);
      setSalesByCat(Array.isArray(sbc) ? sbc : []);
      setProductPerf(Array.isArray(pp) ? pp : []);
      setOrderStatus(Array.isArray(os) ? os : []);
      setSummaryMetrics(sm);
    } finally { setLoading(false); }
  }, [token, buildQuery]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  useEffect(() => {
    fetch(`${API}/categories`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setCategories(Array.isArray(d) ? d : d?.categories || []))
      .catch(() => {});
  }, [token]);

  const handlePresetChange = (p) => {
    setPreset(p);
    const r = dateRangePreset(p);
    setStartDate(r.startDate);
    setEndDate(r.endDate);
  };

  const handleExport = async (type, format) => {
    try {
      const res = await fetch(`${API}/api/export/${format}/${type}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error al exportar');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}.${format === 'csv' ? 'csv' : format === 'excel' ? 'xlsx' : 'pdf'}`;
      a.click();
      URL.revokeObjectURL(url);
      showMessage?.('Exportación completada', 'success');
    } catch (err) { showMessage?.(err.message, 'error'); }
  };

  const handleCsvUpload = async () => {
    if (!csvText.trim()) { showMessage?.('Pega el contenido CSV primero', 'warning'); return; }
    setUploading(true);
    try {
      const res = await fetch(`${API}/api/import/csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv', Authorization: `Bearer ${token}` },
        body: csvText
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setCsvResult(d);
      showMessage?.(`CSV importado: ${d.total} filas`, 'success');
    } catch (err) { showMessage?.(err.message, 'error'); }
    finally { setUploading(false); }
  };

  const trendLines = (trends?.weeklyTrend || [])
    .slice()
    .sort((a, b) => new Date(a.week) - new Date(b.week));

  const trendChartData = {
    labels: trendLines.map(d => d.week?.substring(5) || ''),
    datasets: [
      { label: 'Ingresos', data: trendLines.map(d => parseFloat(d.revenue) || 0),
        borderColor: '#005bc0', backgroundColor: 'rgba(0,91,192,0.08)',
        fill: true, tension: 0.3, pointRadius: 3, pointHoverRadius: 6 },
      { label: 'Órdenes', data: trendLines.map(d => d.orders || 0),
        borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.08)',
        fill: true, tension: 0.3, pointRadius: 3, pointHoverRadius: 6, yAxisID: 'y1' }
    ]
  };

  const monthly = (stats?.monthly || []).slice().sort((a, b) => a.month?.localeCompare(b.month));
  const monthlyChartData = {
    labels: monthly.map(d => d.month?.substring(5) || ''),
    datasets: [
      { label: 'Ingresos', data: monthly.map(d => parseFloat(d.total_revenue) || 0),
        backgroundColor: CHART_COLORS.map((_, i) => i === 0 ? CHART_COLORS[0] : `${CHART_COLORS[0]}40`),
        borderRadius: 4, borderSkipped: false },
      { label: 'Órdenes', data: monthly.map(d => d.total_orders || 0),
        backgroundColor: CHART_COLORS.map((_, i) => i === 0 ? CHART_COLORS[1] : `${CHART_COLORS[1]}40`),
        borderRadius: 4, borderSkipped: false }
    ]
  };

  const catChartData = {
    labels: salesByCat.map(d => d.category || 'Sin categoría'),
    datasets: [{
      data: salesByCat.map(d => parseFloat(d.revenue) || 0),
      backgroundColor: CHART_COLORS.slice(0, salesByCat.length),
      borderWidth: 0, hoverOffset: 8
    }]
  };

  const statusChartData = {
    labels: orderStatus.map(d => d.status),
    datasets: [{
      data: orderStatus.map(d => d.count || 0),
      backgroundColor: orderStatus.map(d => STATUS_COLORS[d.status] || '#6b7280'),
      borderWidth: 0, hoverOffset: 8
    }]
  };

  const productChartData = {
    labels: productPerf.slice(0, 10).map(d => d.name?.length > 15 ? d.name.substring(0, 15) + '…' : d.name),
    datasets: [{
      label: 'Ingresos',
      data: productPerf.slice(0, 10).map(d => parseFloat(d.revenue) || 0),
      backgroundColor: productPerf.slice(0, 10).map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
      borderRadius: 4, borderSkipped: false
    }]
  };

  const defaultOptions = (title) => ({
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top', labels: { usePointStyle: true, padding: 12, font: { size: 11 } } },
      tooltip: { backgroundColor: 'rgba(0,0,0,0.85)', titleFont: { size: 12 }, bodyFont: { size: 11 }, padding: 10, cornerRadius: 8 }
    },
    animation: { duration: 600, easing: 'easeOutQuart' }
  });

  if (loading) return <div className="loading-container" style={{ padding: 80, textAlign: 'center' }}><div className="spinner" /><span style={{ display: 'block', marginTop: 16 }}>Cargando reportes...</span></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="headline-md" style={{ fontFamily: 'var(--font-headline)' }}>Reportes Inteligentes</h2>
          <p style={{ color: 'var(--color-on-surface-variant)' }}>Estadísticas interactivas · Filtros en tiempo real · Actualización cada 30s</p>
        </div>
        <div className="chart-toggle">
          <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>Resumen</button>
          <button className={activeTab === 'trends' ? 'active' : ''} onClick={() => setActiveTab('trends')}>Tendencias</button>
          <button className={activeTab === 'categories' ? 'active' : ''} onClick={() => setActiveTab('categories')}>Categorías</button>
          <button className={activeTab === 'products' ? 'active' : ''} onClick={() => setActiveTab('products')}>Productos</button>
          <button className={activeTab === 'exports' ? 'active' : ''} onClick={() => setActiveTab('exports')}>Exportar</button>
          <button className={activeTab === 'import' ? 'active' : ''} onClick={() => setActiveTab('import')}>Importar CSV</button>
        </div>
      </div>

      <div className="dashboard-section" style={{ marginBottom: 'var(--space-lg)' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', padding: 'var(--space-md) var(--space-lg)' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-on-surface-variant)' }}>Filtros:</span>
          <div className="chart-toggle" style={{ marginRight: 8 }}>
            {[
              { key: '7d', label: '7 días' },
              { key: '30d', label: '30 días' },
              { key: '90d', label: '90 días' },
              { key: '12m', label: '12 meses' },
              { key: 'custom', label: 'Personalizado' }
            ].map(p => (
              <button key={p.key} className={preset === p.key ? 'active' : ''}
                onClick={() => handlePresetChange(p.key)} style={{ fontSize: 11, padding: '4px 10px' }}>
                {p.label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <>
              <input type="date" className="form-input" value={startDate}
                onChange={e => setStartDate(e.target.value)}
                style={{ width: 130, fontSize: 11, padding: '4px 8px' }} />
              <span style={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}>a</span>
              <input type="date" className="form-input" value={endDate}
                onChange={e => setEndDate(e.target.value)}
                style={{ width: 130, fontSize: 11, padding: '4px 8px' }} />
            </>
          )}
          <select className="form-input" value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
            style={{ width: 160, fontSize: 11, padding: '4px 8px' }}>
            <option value="">Todas las categorías</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {activeTab === 'trends' && (
            <select className="form-input" value={granularity}
              onChange={e => setGranularity(e.target.value)}
              style={{ width: 100, fontSize: 11, padding: '4px 8px' }}>
              <option value="day">Diario</option>
              <option value="week">Semanal</option>
              <option value="month">Mensual</option>
            </select>
          )}
        </div>
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="stats-grid" style={{ marginBottom: 'var(--space-lg)' }}>
            <div className="stat-card hover-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
                <div className="icon-bg tertiary"><span className="material-symbols-outlined" style={{ fontSize: 20 }}>payments</span></div>
                {summaryMetrics && <span className="stat-trend up">${parseFloat(summaryMetrics.total_revenue || 0).toLocaleString('es')}</span>}
              </div>
              <div className="stat-card-label">Ingresos</div>
              <div className="stat-card-value">${parseFloat(dashboard?.revenue || 0).toLocaleString('es', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="stat-card hover-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
                <div className="icon-bg secondary"><span className="material-symbols-outlined" style={{ fontSize: 20 }}>shopping_bag</span></div>
                <span className="stat-trend up">{dashboard?.newUsersLastWeek || 0} nuevos</span>
              </div>
              <div className="stat-card-label">Órdenes</div>
              <div className="stat-card-value">{dashboard?.orderCount || 0}</div>
            </div>
            <div className="stat-card hover-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
                <div className="icon-bg primary"><span className="material-symbols-outlined" style={{ fontSize: 20 }}>group</span></div>
                <span className="stat-trend up">Activos</span>
              </div>
              <div className="stat-card-label">Usuarios</div>
              <div className="stat-card-value">{dashboard?.userCount || 0}</div>
            </div>
            <div className="stat-card hover-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
                <div className="icon-bg surface"><span className="material-symbols-outlined" style={{ fontSize: 20 }}>inventory</span></div>
                <span style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>Valor: ${parseFloat(dashboard?.inventoryValue || 0).toLocaleString('es', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="stat-card-label">Productos</div>
              <div className="stat-card-value">{dashboard?.productCount || 0}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
            <div className="stat-card">
              <div className="stat-card-label">Tasa de Conversión</div>
              <div className="stat-card-value" style={{ fontSize: 24 }}>
                {parseFloat(trends?.conversionRate?.conversion_rate || 0).toFixed(1)}%
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>
                {trends?.conversionRate?.converted_users || 0} de {trends?.conversionRate?.total_users || 0} usuarios
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Valor Promedio de Orden</div>
              <div className="stat-card-value" style={{ fontSize: 24 }}>
                ${parseFloat(trends?.avgOrderValue?.avg_value || 0).toFixed(2)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>
                Máx: ${parseFloat(trends?.avgOrderValue?.max_value || 0).toFixed(2)}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Stock Bajo / Agotado</div>
              <div className="stat-card-value" style={{ fontSize: 24 }}>
                <span style={{ color: 'var(--color-error)' }}>{dashboard?.lowStockCount || 0}</span>
                <span style={{ fontSize: 14, color: 'var(--color-on-surface-variant)' }}> / </span>
                <span style={{ color: 'var(--color-error)' }}>{dashboard?.outOfStockCount || 0}</span>
              </div>
            </div>
          </div>

          {summaryMetrics && (
            <div className="dashboard-section" style={{ marginBottom: 'var(--space-lg)' }}>
              <div className="dashboard-section-header">
                <h3>Resumen del Período Seleccionado</h3>
                <span style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>
                  {startDate} → {endDate}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-md)', padding: 'var(--space-lg)' }}>
                <div><span style={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}>Ingresos</span><div style={{ fontSize: 18, fontWeight: 700 }}>${parseFloat(summaryMetrics.total_revenue || 0).toLocaleString('es', { minimumFractionDigits: 2 })}</div></div>
                <div><span style={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}>Órdenes</span><div style={{ fontSize: 18, fontWeight: 700 }}>{summaryMetrics.total_orders || 0}</div></div>
                <div><span style={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}>Clientes</span><div style={{ fontSize: 18, fontWeight: 700 }}>{summaryMetrics.total_customers || 0}</div></div>
                <div><span style={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}>Valor Promedio</span><div style={{ fontSize: 18, fontWeight: 700 }}>${parseFloat(summaryMetrics.avg_order_value || 0).toFixed(2)}</div></div>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
            <div className="dashboard-section">
              <div className="dashboard-section-header">
                <h3>Ventas Mensuales</h3>
                <span style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>{monthly.length} meses</span>
              </div>
              <div style={{ padding: 'var(--space-lg)', height: 220 }}>
                {monthly.length > 0 ? (
                  <Bar data={monthlyChartData} options={{ ...defaultOptions(''), scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } } } }} />
                ) : <div className="empty-state" style={{ height: 180 }}><span className="material-symbols-outlined">bar_chart</span><p>Sin datos</p></div>}
              </div>
            </div>
            <div className="dashboard-section">
              <div className="dashboard-section-header">
                <h3>Distribución de Órdenes</h3>
                <span style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>{orderStatus.length} estados</span>
              </div>
              <div style={{ padding: 'var(--space-lg)', height: 220 }}>
                {orderStatus.length > 0 ? (
                  <Doughnut data={statusChartData} options={{ ...defaultOptions(''), cutout: '60%', plugins: { ...defaultOptions('').plugins, legend: { position: 'right', labels: { usePointStyle: true, padding: 8, font: { size: 10 } } } } }} />
                ) : <div className="empty-state" style={{ height: 180 }}><span className="material-symbols-outlined">donut_small</span><p>Sin datos</p></div>}
              </div>
            </div>
          </div>

          {dashboard?.recentOrders?.length > 0 && (
            <div className="dashboard-section" style={{ marginBottom: 'var(--space-lg)' }}>
              <div className="dashboard-section-header">
                <h3>Órdenes Recientes</h3>
                <span style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>Últimas 5</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="activity-log-table">
                  <thead><tr><th>#</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Productos</th><th>Fecha</th></tr></thead>
                  <tbody>
                    {dashboard.recentOrders.map(o => (
                      <tr key={o.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: 13 }}>#{typeof o.id === 'string' ? o.id.substring(0, 8) : o.id}</td>
                        <td style={{ fontSize: 14 }}>{o.user_email}</td>
                        <td style={{ fontWeight: 500 }}>${parseFloat(o.total).toFixed(2)}</td>
                        <td><span className={`action-badge ${o.status === 'confirmed' ? 'success' : o.status === 'cancelled' ? 'canceled' : 'processing'}`}>{o.status}</span></td>
                        <td style={{ fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {o.items?.map(i => i.name).join(', ') || '-'}
                        </td>
                        <td style={{ fontSize: 13 }}>{new Date(o.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {dashboard?.recentActivities?.length > 0 && (
            <div className="dashboard-section">
              <div className="dashboard-section-header">
                <h3>Actividad Reciente</h3>
              </div>
              <div style={{ padding: 'var(--space-lg)' }}>
                {dashboard.recentActivities.map((a, i) => (
                  <div key={a.id || i} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: i < dashboard.recentActivities.length - 1 ? '1px solid var(--color-outline-variant)' : 'none' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-secondary)', marginTop: 6, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13 }}><strong>{a.user_name}</strong> - {a.action}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>{a.description}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-outline)' }}>{a.created_at ? new Date(a.created_at).toLocaleString() : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'trends' && (
        <div className="dashboard-section">
          <div className="dashboard-section-header">
            <h3>Tendencia de Ingresos y Órdenes</h3>
            <span style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>
              {granularity === 'day' ? 'Diario' : granularity === 'week' ? 'Semanal' : 'Mensual'} · {startDate} → {endDate}
            </span>
          </div>
          <div style={{ padding: 'var(--space-lg)', height: 320 }}>
            {trendLines.length > 0 ? (
              <Line data={trendChartData} options={{
                ...defaultOptions(''),
                scales: {
                  x: { grid: { display: false } },
                  y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, position: 'left', title: { display: true, text: 'Ingresos ($)' } },
                  y1: { beginAtZero: true, grid: { display: false }, position: 'right', title: { display: true, text: 'Órdenes' } }
                }
              }} />
            ) : <div className="empty-state" style={{ height: 260 }}><span className="material-symbols-outlined">trending_up</span><p>Sin datos en este período</p></div>}
          </div>
        </div>
      )}

      {activeTab === 'categories' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
            <div className="dashboard-section">
              <div className="dashboard-section-header">
                <h3>Ventas por Categoría</h3>
                <span style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>{salesByCat.length} categorías</span>
              </div>
              <div style={{ padding: 'var(--space-lg)', height: 280 }}>
                {salesByCat.length > 0 ? (
                  <Pie data={catChartData} options={{
                    ...defaultOptions(''),
                    plugins: {
                      ...defaultOptions('').plugins,
                      legend: { position: 'right', labels: { usePointStyle: true, padding: 8, font: { size: 10 } } }
                    }
                  }} />
                ) : <div className="empty-state" style={{ height: 240 }}><span className="material-symbols-outlined">pie_chart</span><p>Sin datos</p></div>}
              </div>
            </div>
            <div className="dashboard-section">
              <div className="dashboard-section-header">
                <h3>Distribución de Órdenes</h3>
                <span style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>{orderStatus.length} estados</span>
              </div>
              <div style={{ padding: 'var(--space-lg)', height: 280 }}>
                {orderStatus.length > 0 ? (
                  <Doughnut data={statusChartData} options={{
                    ...defaultOptions(''),
                    cutout: '55%',
                    plugins: {
                      ...defaultOptions('').plugins,
                      legend: { position: 'right', labels: { usePointStyle: true, padding: 8, font: { size: 10 } } }
                    }
                  }} />
                ) : <div className="empty-state" style={{ height: 240 }}><span className="material-symbols-outlined">donut_small</span><p>Sin datos</p></div>}
              </div>
            </div>
          </div>

          {salesByCat.length > 0 && (
            <div className="dashboard-section">
              <div className="dashboard-section-header">
                <h3>Detalle por Categoría</h3>
                <span style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>{startDate} → {endDate}</span>
              </div>
              <div style={{ padding: 'var(--space-lg)', overflowX: 'auto' }}>
                <table className="campaign-table" style={{ fontSize: 13 }}>
                  <thead><tr><th>Categoría</th><th>Productos</th><th>Órdenes</th><th>Unidades Vendidas</th><th>Ingresos</th></tr></thead>
                  <tbody>
                    {salesByCat.map((c, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{c.category || 'Sin categoría'}</td>
                        <td>{c.product_count}</td>
                        <td>{c.order_count}</td>
                        <td>{c.items_sold}</td>
                        <td style={{ fontWeight: 600 }}>${parseFloat(c.revenue).toLocaleString('es', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'products' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
            <div className="dashboard-section">
              <div className="dashboard-section-header">
                <h3>Top 10 Productos por Ingresos</h3>
                <span style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>{productPerf.length} productos</span>
              </div>
              <div style={{ padding: 'var(--space-lg)', height: 280 }}>
                {productPerf.length > 0 ? (
                  <Bar data={productChartData} options={{
                    ...defaultOptions(''),
                    indexAxis: 'y',
                    scales: {
                      x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                      y: { grid: { display: false } }
                    }
                  }} />
                ) : <div className="empty-state" style={{ height: 240 }}><span className="material-symbols-outlined">shopping_bag</span><p>Sin datos</p></div>}
              </div>
            </div>
            <div className="dashboard-section">
              <div className="dashboard-section-header">
                <h3>Ventas por Categoría</h3>
                <span style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>{salesByCat.length} categorías</span>
              </div>
              <div style={{ padding: 'var(--space-lg)', height: 280 }}>
                {salesByCat.length > 0 ? (
                  <Doughnut data={catChartData} options={{
                    ...defaultOptions(''),
                    cutout: '55%',
                    plugins: {
                      ...defaultOptions('').plugins,
                      legend: { position: 'right', labels: { usePointStyle: true, padding: 8, font: { size: 10 } } }
                    }
                  }} />
                ) : <div className="empty-state" style={{ height: 240 }}><span className="material-symbols-outlined">pie_chart</span><p>Sin datos</p></div>}
              </div>
            </div>
          </div>

          <div className="dashboard-section">
            <div className="dashboard-section-header">
              <h3>Rendimiento de Productos</h3>
              <span style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>
                {productPerf.length} productos · {startDate} → {endDate}
              </span>
            </div>
            <div style={{ padding: 'var(--space-lg)', overflowX: 'auto' }}>
              {productPerf.length === 0 ? (
                <div className="empty-state"><span className="material-symbols-outlined">shopping_bag</span><p>Sin datos</p></div>
              ) : (
                <table className="campaign-table" style={{ fontSize: 13 }}>
                  <thead><tr><th>#</th><th>Producto</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Vendidos</th><th>Órdenes</th><th>Ingresos</th></tr></thead>
                  <tbody>
                    {productPerf.map((p, i) => (
                      <tr key={p.id || i}>
                        <td style={{ fontWeight: 600 }}>{i + 1}</td>
                        <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {p.image_url && <img src={p.image_url} alt="" style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover' }} />}
                          <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                        </td>
                        <td style={{ fontSize: 12 }}>{p.category_name || p.category || '-'}</td>
                        <td>${parseFloat(p.price).toFixed(2)}</td>
                        <td style={{ color: p.stock <= 0 ? 'var(--color-error)' : p.stock <= 5 ? 'var(--color-tertiary)' : 'inherit' }}>{p.stock}</td>
                        <td>{p.units_sold}</td>
                        <td>{p.order_count}</td>
                        <td style={{ fontWeight: 600 }}>${parseFloat(p.revenue).toLocaleString('es', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'exports' && (
        <div className="dashboard-section">
          <div className="dashboard-section-header">
            <h3>Exportar Datos</h3>
            <span style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>CSV · Excel · PDF</span>
          </div>
          <div style={{ padding: 'var(--space-lg)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-md)' }}>
              {[
                { type: 'sales', label: 'Ventas', icon: 'payments', desc: 'Órdenes confirmadas, ingresos y clientes' },
                { type: 'products', label: 'Productos', icon: 'inventory_2', desc: 'Catálogo completo con precios y stock' },
                { type: 'orders', label: 'Órdenes', icon: 'receipt_long', desc: 'Historial completo de órdenes' },
                { type: 'activities', label: 'Actividades', icon: 'history', desc: 'Registro de acciones administrativas' },
                { type: 'dashboard', label: 'Dashboard Completo', icon: 'dashboard', desc: 'Todas las métricas en un solo reporte' }
              ].map(item => (
                <div key={item.type} style={{ padding: 'var(--space-lg)', border: '1px solid var(--color-outline-variant)', borderRadius: 'var(--radius-lg)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div className="icon-bg tertiary"><span className="material-symbols-outlined">{item.icon}</span></div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{item.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>{item.desc}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {item.type !== 'dashboard' && (
                      <button className="btn-secondary" style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }}
                        onClick={() => handleExport(item.type, 'csv')}>
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>table_rows</span> CSV
                      </button>
                    )}
                    <button className="btn-secondary" style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }}
                      onClick={() => handleExport(item.type === 'dashboard' ? 'dashboard' : item.type, 'excel')}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>grid_on</span> Excel
                    </button>
                    <button className="btn-secondary" style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }}
                      onClick={() => handleExport(item.type === 'dashboard' ? 'dashboard' : item.type, 'pdf')}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>picture_as_pdf</span> PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'import' && (
        <div className="dashboard-section">
          <div className="dashboard-section-header">
            <h3>Importar Datos CSV</h3>
            <span style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>Analiza datos externos</span>
          </div>
          <div style={{ padding: 'var(--space-lg)' }}>
            <textarea className="form-input" rows={4}
              value={csvText}
              onChange={e => setCsvText(e.target.value)}
              placeholder="Pega datos CSV (primera fila = encabezados)&#10;Ej: nombre,precio,stock&#10;Producto A,100,50&#10;Producto B,200,30"
              style={{ fontFamily: 'monospace', fontSize: 13, resize: 'vertical', width: '100%', marginBottom: 12 }} />
            <button className="btn-primary" style={{ width: 'auto' }} onClick={handleCsvUpload} disabled={uploading}>
              {uploading ? 'Procesando...' : 'Importar CSV'}
            </button>
            {csvResult && (
              <div style={{ marginTop: 12, padding: 12, background: 'var(--color-success)', color: '#fff', borderRadius: 'var(--radius-md)', fontSize: 13 }}>
                <strong>CSV importado:</strong> {csvResult.total} filas, {csvResult.headers?.length} columnas
                {csvResult.preview?.length > 0 && (
                  <div style={{ marginTop: 8, overflowX: 'auto' }}>
                    <table className="campaign-table" style={{ fontSize: 12 }}>
                      <thead><tr>{csvResult.headers.map(h => <th key={h}>{h}</th>)}</tr></thead>
                      <tbody>{csvResult.preview.map((r, i) => (
                        <tr key={i}>{csvResult.headers.map(h => <td key={h}>{r[h]}</td>)}</tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}