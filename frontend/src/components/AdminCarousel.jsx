import React, { useState, useEffect, useRef } from 'react';

const API = '';

export default function AdminCarousel({ token, onRefresh, showMessage }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);
  const fileRef = useRef(null);
  const galleryRef = useRef(null);

  const [form, setForm] = useState({
    title: '', description: '', image_url: '', button_text: 'Saber Más',
    redirect_url: '#', is_active: true, order_index: 0,
    start_date: '', end_date: ''
  });

  const loadItems = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/carousel/all`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setItems(data);
    } catch { showMessage?.('Error al cargar carrusel', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadItems(); }, []);

  const resetForm = () => {
    setForm({
      title: '', description: '', image_url: '', button_text: 'Saber Más',
      redirect_url: '#', is_active: true, order_index: items.length + 1,
      start_date: '', end_date: ''
    });
    setEditingId(null);
    setShowForm(false);
    setPreviewMode(false);
  };

  const openEdit = (item) => {
    if (!item) { resetForm(); setShowForm(true); return; }
    setEditingId(item.id);
    setForm({
      title: item.title || '',
      description: item.description || '',
      image_url: item.image_url || '',
      button_text: item.button_text || 'Saber Más',
      redirect_url: item.redirect_url || '#',
      is_active: item.is_active !== false,
      order_index: item.order_index || 0,
      start_date: item.start_date ? item.start_date.substring(0, 16) : '',
      end_date: item.end_date ? item.end_date.substring(0, 16) : ''
    });
    setShowForm(true);
  };

  const handleImageUpload = async (file, isMain = true) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch(`${API}/carousel/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: fd
      });
      const data = await res.json();
      if (res.ok) {
        if (isMain) {
          setForm(prev => ({ ...prev, image_url: data.url }));
        } else if (editingId) {
          const fd2 = new FormData();
          fd2.append('image', file);
          const imgRes = await fetch(`${API}/carousel/${editingId}/images`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: fd2
          });
          if (imgRes.ok) {
            showMessage?.('Imagen agregada', 'success');
            loadItems();
          }
        }
        showMessage?.('Imagen subida', 'success');
      } else throw new Error(data.error);
    } catch (err) { showMessage?.(err.message, 'error'); }
    finally { setUploading(false); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const isNew = !editingId;
      const url = isNew ? `${API}/carousel` : `${API}/carousel/${editingId}`;
      const method = isNew ? 'POST' : 'PUT';
      const body = { ...form };
      if (!body.start_date) body.start_date = null;
      if (!body.end_date) body.end_date = null;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showMessage?.(isNew ? 'Carrusel creado' : 'Carrusel actualizado', 'success');
      resetForm();
      loadItems();
    } catch (err) { showMessage?.(err.message, 'error'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este item del carrusel?')) return;
    try {
      const res = await fetch(`${API}/carousel/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showMessage?.('Item eliminado', 'success');
      loadItems();
    } catch (err) { showMessage?.(err.message, 'error'); }
  };

  const handleToggle = async (id) => {
    try {
      const res = await fetch(`${API}/carousel/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error((await res.json()).error);
      loadItems();
    } catch (err) { showMessage?.(err.message, 'error'); }
  };

  const handleDeleteImage = async (itemId, imageId) => {
    if (!confirm('¿Eliminar esta imagen?')) return;
    try {
      const res = await fetch(`${API}/carousel/${itemId}/images/${imageId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showMessage?.('Imagen eliminada', 'success');
      loadItems();
    } catch (err) { showMessage?.(err.message, 'error'); }
  };

  const handleDragStart = (index) => setDragIndex(index);

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const newItems = [...items];
    const [moved] = newItems.splice(dragIndex, 1);
    newItems.splice(index, 0, moved);
    setItems(newItems.map((item, i) => ({ ...item, order_index: i + 1 })));
    setDragIndex(index);
  };

  const handleDragEnd = async () => {
    setDragIndex(null);
    try {
      await fetch(`${API}/carousel/reorder/batch`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          items: items.map((item, i) => ({ id: item.id, order_index: i + 1 }))
        })
      });
    } catch { showMessage?.('Error al guardar orden', 'error'); }
  };

  const sortedItems = [...items].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="headline-md" style={{ fontFamily: 'var(--font-headline)' }}>Carrusel Principal</h2>
          <p style={{ color: 'var(--color-on-surface-variant)' }}>Gestiona los banners del carrusel con programación y múltiples imágenes</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`btn-secondary ${previewMode ? 'active' : ''}`}
            style={{ width: 'auto', background: previewMode ? 'var(--color-primary)' : '', color: previewMode ? '#fff' : '' }}
            onClick={() => setPreviewMode(!previewMode)}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>visibility</span>
            Vista Previa
          </button>
          <button className="btn-primary" style={{ width: 'auto' }} onClick={() => openEdit(null)}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
            Nuevo Banner
          </button>
        </div>
      </div>

      {previewMode && (
        <div className="hero-carousel" style={{ marginBottom: 'var(--space-lg)' }}>
          {sortedItems.filter(i => i.is_active).length === 0 ? (
            <div className="hero-slide" style={{ justifyContent: 'center', color: '#fff' }}>
              <p>No hay banners activos</p>
            </div>
          ) : (
            <div className="hero-slide">
              <div className="hero-content">
                <h1>{sortedItems.filter(i => i.is_active)[0]?.title || 'Sin título'}</h1>
                <p>{sortedItems.filter(i => i.is_active)[0]?.description || ''}</p>
                <button className="hero-cta">
                  {sortedItems.filter(i => i.is_active)[0]?.button_text || 'Saber Más'}
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
                </button>
              </div>
              <div className="hero-image">
                {sortedItems.filter(i => i.is_active)[0]?.image_url ? (
                  <img src={sortedItems.filter(i => i.is_active)[0].image_url} alt="preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--radius-lg)' }} />
                ) : (
                  <span className="material-symbols-outlined" style={{ fontSize: 80 }}>image</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSave}
          style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24, padding: 'var(--space-lg)', background: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-field">
              <label>Título</label>
              <input className="form-input" value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })} required placeholder="Título del banner" />
            </div>
            <div className="form-field">
              <label>Orden</label>
              <input className="form-input" type="number" value={form.order_index}
                onChange={e => setForm({ ...form, order_index: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="form-field">
            <label>Descripción</label>
            <textarea className="form-input" rows={2} value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Descripción del banner..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-field">
              <label>Texto del Botón</label>
              <input className="form-input" value={form.button_text}
                onChange={e => setForm({ ...form, button_text: e.target.value })} placeholder="Saber Más" />
            </div>
            <div className="form-field">
              <label>Enlace</label>
              <input className="form-input" value={form.redirect_url}
                onChange={e => setForm({ ...form, redirect_url: e.target.value })} placeholder="/productos" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-field">
              <label>Fecha de inicio</label>
              <input className="form-input" type="datetime-local" value={form.start_date}
                onChange={e => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Fecha de finalización</label>
              <input className="form-input" type="datetime-local" value={form.end_date}
                onChange={e => setForm({ ...form, end_date: e.target.value })} />
            </div>
          </div>
          <div className="form-field">
            <label>Imagen Principal</label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="file" ref={fileRef} accept="image/*" style={{ display: 'none' }}
                onChange={e => { if (e.target.files[0]) handleImageUpload(e.target.files[0], true); }} />
              <button type="button" className="btn-secondary" style={{ width: 'auto' }}
                onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? 'Subiendo...' : 'Subir Imagen'}
              </button>
              {form.image_url && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <img src={form.image_url} alt="preview"
                    style={{ width: 120, height: 60, borderRadius: 'var(--radius-md)', objectFit: 'cover' }} />
                  <button type="button" style={{ background: 'none', border: 'none', color: 'var(--color-error)', cursor: 'pointer' }}
                    onClick={() => setForm({ ...form, image_url: '' })}>Quitar</button>
                </div>
              )}
            </div>
          </div>

          {editingId && (
            <div className="form-field">
              <label>Galería de Imágenes ({items.find(i => i.id === editingId)?.images?.length || 0})</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8, marginBottom: 12 }}>
                {(items.find(i => i.id === editingId)?.images || []).map(img => (
                  <div key={img.id} style={{ position: 'relative', width: '100%', paddingBottom: '100%' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: '#f3f4f6' }}>
                      <img src={img.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button type="button"
                        style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}
                        onClick={() => handleDeleteImage(editingId, img.id)}>×</button>
                    </div>
                  </div>
                ))}
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', paddingBottom: '100%', borderRadius: 'var(--radius-md)', border: '2px dashed var(--color-outline-variant)', cursor: 'pointer', position: 'relative' }}>
                  <input type="file" ref={galleryRef} accept="image/*" style={{ display: 'none' }}
                    onChange={e => { if (e.target.files[0] && editingId) handleImageUpload(e.target.files[0], false); }} multiple />
                  <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--color-outline)', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>add_a_photo</span>
                </label>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.is_active}
                onChange={e => setForm({ ...form, is_active: e.target.checked })} />
              Banner activo
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn-primary" style={{ width: 'auto' }}>
              {editingId ? 'Guardar Cambios' : 'Crear Banner'}
            </button>
            <button type="button" className="btn-secondary" style={{ width: 'auto' }} onClick={resetForm}>Cancelar</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="loading-container"><div className="spinner" /><span>Cargando carrusel...</span></div>
      ) : sortedItems.length === 0 ? (
        <div className="empty-state"><span className="material-symbols-outlined">view_carousel</span><p>No hay banners. Crea el primero.</p></div>
      ) : (
        <div className="dashboard-section">
          <div style={{ overflowX: 'auto' }}>
            <table className="campaign-table">
              <thead>
                <tr>
                  <th style={{ width: 30 }}></th>
                  <th>Vista Previa</th>
                  <th>Orden</th>
                  <th>Título</th>
                  <th>Programación</th>
                  <th>Imágenes</th>
                  <th>Estado</th>
                  <th style={{ width: 200 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item, index) => (
                  <tr key={item.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    style={{ cursor: 'grab', opacity: dragIndex === index ? 0.5 : 1 }}>
                    <td><span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--color-outline)' }}>drag_indicator</span></td>
                    <td>
                      <div style={{ width: 80, height: 45, borderRadius: 'var(--radius-sm)', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {item.image_url ? <img src={item.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--color-outline)' }}>image</span>}
                      </div>
                    </td>
                    <td><span className="action-badge category">{item.order_index}</span></td>
                    <td style={{ fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</td>
                    <td>
                      <div style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>
                        {item.start_date ? `Inicio: ${new Date(item.start_date).toLocaleDateString()}` : 'Sin fecha'}
                        {item.end_date ? <br /> : ''}
                        {item.end_date ? `Fin: ${new Date(item.end_date).toLocaleDateString()}` : ''}
                      </div>
                    </td>
                    <td><span className="action-badge category">{(item.images || []).length} imgs</span></td>
                    <td>
                      <button onClick={() => handleToggle(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <span className={`campaign-status ${item.is_active ? 'active' : 'draft'}`}>
                          {item.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn-secondary" style={{ width: 'auto', padding: '4px 10px', fontSize: 12 }} onClick={() => openEdit(item)}>Editar</button>
                        <button className="btn-secondary" style={{ width: 'auto', padding: '4px 10px', fontSize: 12, background: 'var(--color-error-container)', color: 'var(--color-error)', borderColor: 'transparent' }}
                          onClick={() => handleDelete(item.id)}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '8px 16px', fontSize: 12, color: 'var(--color-on-surface-variant)', borderTop: '1px solid var(--color-outline-variant)' }}>
            Arrastra las filas para reordenar los banners
          </div>
        </div>
      )}
    </div>
  );
}
