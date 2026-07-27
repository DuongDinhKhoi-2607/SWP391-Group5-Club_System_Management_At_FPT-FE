import React, { useState, useEffect, useCallback } from 'react';
import { 
  uploadDocument, 
  getDocumentsByClub, 
  downloadDocument, 
  deleteDocument, 
  updateDocument, 
  getDocumentDetail,
  getDocumentsByEvent,
  getDocumentsByType
} from '../../services/documentService';
import { getEventsByClub } from '../../services/eventService';
import { Folder, Upload, FileText, Globe, Lock, Download, Trash2, RefreshCw, Edit, X, Save, Eye, Calendar } from 'lucide-react';

export default function DocumentArchive({ selectedClubId, triggerNotification, readOnly = false }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Upload form state
  const [docTypeId, setDocTypeId] = useState('1'); 
  const [uploadEventId, setUploadEventId] = useState('');
  const [accessLevel, setAccessLevel] = useState('Public');
  const [files, setFiles] = useState(null);

  // Edit document modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Detail document modal state
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [docDetail, setDocDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Folder navigation and Event filters
  const [activeFolder, setActiveFolder] = useState('ALL'); // ALL, 1, 2, 3, 4
  const [filterEventId, setFilterEventId] = useState('');
  const [clubEvents, setClubEvents] = useState([]);

  const backendClubId = selectedClubId;

  // Load events list for filtering & upload attachment
  const loadClubEvents = useCallback(async () => {
    if (!selectedClubId) return;
    try {
      const data = await getEventsByClub(selectedClubId);
      setClubEvents(Array.isArray(data) ? data : (data?.data ?? []));
    } catch (err) {
      console.error('[DocumentArchive] Lỗi tải sự kiện:', err);
    }
  }, [selectedClubId]);

  // Main loader for documents (handles type filter, event filter, or club view)
  const loadDocuments = useCallback(async () => {
    if (!selectedClubId) return;
    setLoading(true);
    try {
      let data;
      if (filterEventId) {
        // Query by Event ID API
        data = await getDocumentsByEvent(filterEventId);
      } else if (activeFolder !== 'ALL') {
        // Query by Document Type ID API
        data = await getDocumentsByType(Number(activeFolder));
      } else {
        // Query general club documents API
        data = await getDocumentsByClub(backendClubId);
      }
      
      const list = Array.isArray(data) ? data : (data?.data ?? []);
      
      // If we filtered by type or event, client-side restrict to this club if clubId exists in the items
      const clubFilteredList = list.filter(doc => 
        !doc.clubId || String(doc.clubId) === String(backendClubId)
      );
      
      setDocuments(clubFilteredList);
    } catch (err) {
      console.error('[DocumentArchive] Lỗi tải tài liệu:', err);
      triggerNotification('Không tải được danh sách tài liệu từ máy chủ!', 'error');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [backendClubId, activeFolder, filterEventId, triggerNotification]);

  useEffect(() => {
    loadClubEvents();
  }, [loadClubEvents]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleUploadDoc = async (e) => {
    e.preventDefault();
    if (!files || files.length === 0) {
      triggerNotification('Vui lòng chọn ít nhất một tệp tin để tải lên!', 'warning');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('ClubId', backendClubId);
      formData.append('DocumentTypeId', docTypeId);
      if (uploadEventId) formData.append('EventId', uploadEventId);
      formData.append('AccessLevel', accessLevel === 'Public' ? 'Công khai' : 'Nội bộ');
      Array.from(files).forEach(file => {
        formData.append('Files', file);
      });

      await uploadDocument(formData);
      triggerNotification(`Đã tải lên tài liệu thành công!`, 'success');

      // Reset form
      setDocTypeId('1');
      setUploadEventId('');
      setAccessLevel('Public');
      setFiles(null);
      const fileInput = document.getElementById('doc-file-input');
      if (fileInput) fileInput.value = '';

      await loadDocuments();
    } catch (err) {
      console.error('[DocumentArchive] Lỗi upload tài liệu:', err);
      triggerNotification(
        err?.response?.data?.message || 'Tải lên tài liệu thất bại. Vui lòng thử lại!',
        'error'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (doc) => {
    const docId = doc.id || doc.documentId;
    const fileUrl = doc.fileUrl || doc.url;
    if (fileUrl) {
      try {
        triggerNotification('Đang tải tệp tin...', 'success');
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error();
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', doc.name || doc.documentName || `document-${docId}`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        return;
      } catch (err) {
        console.warn('[DocumentArchive] Direct fetch failed, falling back to API:', err);
      }
    }
    try {
      const response = await downloadDocument(docId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.name || doc.documentName || `document-${docId}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      triggerNotification('Đang tải tệp tin...', 'success');
    } catch (err) {
      console.error('[DocumentArchive] Lỗi download:', err);
      triggerNotification('Không thể tải tài liệu. Vui lòng thử lại!', 'error');
    }
  };

  const handleDelete = async (doc) => {
    const docId = doc.id || doc.documentId;
    const docName = doc.name || doc.documentName;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa tài liệu "${docName}"?`)) return;
    try {
      await deleteDocument(docId);
      triggerNotification(`Đã xóa tài liệu: ${docName}`, 'success');
      await loadDocuments();
    } catch (err) {
      console.error('[DocumentArchive] Lỗi xóa tài liệu:', err);
      triggerNotification(
        err?.response?.data?.message || 'Xóa tài liệu thất bại!',
        'error'
      );
    }
  };

  const handleUpdateDocument = async (e) => {
    e.preventDefault();
    if (!editingDoc) return;
    setIsUpdating(true);
    try {
      await updateDocument(editingDoc.id || editingDoc.documentId, {
        documentName: editingDoc.documentName,
        documentTypeId: Number(editingDoc.documentTypeId),
        eventId: editingDoc.eventId ? Number(editingDoc.eventId) : null,
        accessLevel: editingDoc.accessLevel === 'Public' ? 'Công khai' : 'Nội bộ'
      });
      triggerNotification(`Đã cập nhật tài liệu thành công!`, 'success');
      setShowEditModal(false);
      setEditingDoc(null);
      await loadDocuments();
    } catch (err) {
      console.error('[DocumentArchive] Lỗi sửa tài liệu:', err);
      triggerNotification(err?.response?.data?.message || 'Cập nhật tài liệu thất bại!', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleViewDetail = async (doc) => {
    const docId = doc.id || doc.documentId;
    if (!docId) return;
    setShowDetailModal(true);
    setLoadingDetail(true);
    setDocDetail(null);
    try {
      const data = await getDocumentDetail(docId);
      setDocDetail(data?.data ?? data);
    } catch (err) {
      console.error('[DocumentArchive] Lỗi tải chi tiết tài liệu:', err);
      setDocDetail(doc);
    } finally {
      setLoadingDetail(false);
    }
  };

  const docTypeMap = {
    '1': 'Proposal (Kế hoạch)',
    '2': 'Script (Kịch bản)',
    '3': 'Report Template (Báo cáo)',
    '4': 'Khác (Other)',
  };

  const getDocTypeLabel = (doc) => {
    const typeId = String(doc.documentTypeId || doc.typeId || '4');
    return docTypeMap[typeId] || 'Other';
  };

  const folders = [
    { key: 'ALL', name: 'Tất cả tài liệu' },
    { key: '1', name: 'Thư mục Proposal (Kế hoạch)' },
    { key: '2', name: 'Thư mục Kịch bản mẫu (Script)' },
    { key: '3', name: 'Thư mục Báo cáo (Report)' },
    { key: '4', name: 'Khác (Other)' }
  ];

  // ── EDIT DOCUMENT VIEW ─────────────────────────────────────────────────────
  if (showEditModal && editingDoc) {
    return (
      <div style={{ animation: 'fadeIn 0.2s ease' }}>
        <div className="glass-card" style={{ marginBottom: '20px', padding: '12px 20px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => { setShowEditModal(false); setEditingDoc(null); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}
          >
            <X size={16} /> Quay lại Lưu trữ Tài liệu
          </button>
        </div>
        <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div className="glass-card-header" style={{ marginBottom: '16px' }}>
            <h3 className="glass-card-title"><Edit size={18} style={{ marginRight: '6px' }} /> Sửa thông tin tài liệu</h3>
          </div>
          <form onSubmit={handleUpdateDocument} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Tên tài liệu *</label>
              <input
                type="text"
                className="input-field"
                value={editingDoc.documentName}
                onChange={e => setEditingDoc({ ...editingDoc, documentName: e.target.value })}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Phân loại Thư mục</label>
              <select
                className="select-field"
                value={editingDoc.documentTypeId}
                onChange={e => setEditingDoc({ ...editingDoc, documentTypeId: e.target.value })}
              >
                <option value="1">Thư mục Proposal (Kế hoạch)</option>
                <option value="2">Thư mục Kịch bản mẫu (Script)</option>
                <option value="3">Thư mục Báo cáo (Report)</option>
                <option value="4">Khác (Other)</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Quyền truy cập (Access Level)</label>
              <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="edit-doc-access"
                    checked={editingDoc.accessLevel === 'Public'}
                    onChange={() => setEditingDoc({ ...editingDoc, accessLevel: 'Public' })}
                    style={{ accentColor: 'var(--primary)', transform: 'scale(1.2)' }}
                  />
                  <span>Công khai (Public)</span>
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="edit-doc-access"
                    checked={editingDoc.accessLevel === 'Internal'}
                    onChange={() => setEditingDoc({ ...editingDoc, accessLevel: 'Internal' })}
                    style={{ accentColor: 'var(--primary)', transform: 'scale(1.2)' }}
                  />
                  <span>Nội bộ (Internal)</span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px' }} disabled={isUpdating}>
                <Save size={16} /> {isUpdating ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
              <button type="button" className="btn btn-secondary" style={{ padding: '10px 24px' }} onClick={() => { setShowEditModal(false); setEditingDoc(null); }}>Hủy</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ── DETAIL DOCUMENT VIEW ───────────────────────────────────────────────────
  if (showDetailModal) {
    return (
      <div style={{ animation: 'fadeIn 0.2s ease' }}>
        <div className="glass-card" style={{ marginBottom: '20px', padding: '12px 20px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => { setShowDetailModal(false); setDocDetail(null); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}
          >
            <X size={16} /> Quay lại Lưu trữ Tài liệu
          </button>
        </div>
        <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div className="glass-card-header" style={{ marginBottom: '16px' }}>
            <h3 className="glass-card-title"><FileText size={18} style={{ marginRight: '6px' }} /> Chi tiết Tài liệu</h3>
          </div>
          {loadingDetail ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div className="login-spinner" style={{ margin: '0 auto', width: '32px', height: '32px' }}></div>
              <p style={{ marginTop: '12px', color: 'var(--text-muted)' }}>Đang tải thông tin...</p>
            </div>
          ) : docDetail ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                ['Tên tài liệu', docDetail.name || docDetail.documentName || 'N/A'],
                ['Mã tài liệu', docDetail.id || docDetail.documentId || 'N/A'],
                ['Phân loại thư mục', getDocTypeLabel(docDetail)],
                ['Cấp độ truy cập', (() => {
                  const isPub = docDetail.accessLevel === 'Public' || docDetail.accessLevel === 'Công khai' || docDetail.visibility === 'Public' || docDetail.visibility === 'Công khai';
                  return <span className={`badge ${isPub ? 'badge-active' : 'badge-blocked'}`}>{isPub ? 'Công khai' : 'Nội bộ'}</span>;
                })()],
                ['Ngày tải lên', docDetail.uploadedAt || docDetail.createdAt ? new Date(docDetail.uploadedAt || docDetail.createdAt).toLocaleString('vi-VN') : 'N/A'],
                ['Đính kèm sự kiện ID', docDetail.eventId || 'Không có']
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', gap: '16px', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '12px' }}>
                  <span style={{ minWidth: '150px', fontSize: '13px', color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
                  <span style={{ fontSize: '14px', color: 'var(--text-main)', wordBreak: 'break-word', fontWeight: 500 }}>{value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>Không tải được thông tin tài liệu.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="document-archive-container">
      <div className="dashboard-grid-2col">
        {/* Left Side: Folder explorer and document listing */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Folders navigation */}
          <div className="glass-card">
            <div className="glass-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="glass-card-title"><Folder size={18} /> Thư mục lưu trữ</h3>
              <button
                className="btn btn-secondary btn-sm"
                onClick={loadDocuments}
                disabled={loading}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCw size={14} className={loading ? 'spin' : ''} />
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {folders.map(f => (
                <div
                  key={f.key}
                  className={`nav-item ${activeFolder === f.key && !filterEventId ? 'active' : ''}`}
                  onClick={() => {
                    setFilterEventId('');
                    setActiveFolder(f.key);
                  }}
                  style={{ justifyContent: 'space-between', padding: '10px 14px', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Folder size={16} style={{ color: activeFolder === f.key && !filterEventId ? 'var(--primary)' : 'var(--text-muted)' }} />
                    <span>{f.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Filter by Event Card */}
          <div className="glass-card">
            <div className="glass-card-header">
              <h3 className="glass-card-title"><Calendar size={18} /> Lọc theo Sự kiện</h3>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <select 
                className="select-field" 
                value={filterEventId} 
                onChange={(e) => setFilterEventId(e.target.value)}
              >
                <option value="">-- Tất cả sự kiện --</option>
                {clubEvents.map(e => (
                  <option key={e.id || e.eventId} value={e.id || e.eventId}>
                    {e.eventName || e.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Document list */}
          <div className="glass-card">
            <div className="glass-card-header">
              <h3 className="glass-card-title"><FileText size={18} /> Tệp tin lưu trữ</h3>
            </div>

            {loading ? (
              <div className="empty-state-view">
                <span className="login-spinner" style={{ width: '28px', height: '28px' }} />
                <p style={{ marginTop: '10px' }}>Đang tải...</p>
              </div>
            ) : documents.length === 0 ? (
              <div className="empty-state-view">
                <FileText className="empty-state-icon" />
                <p>Thư mục trống. Không có tài liệu nào.</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Tên tài liệu</th>
                      <th>Ngày tải</th>
                      <th>Quyền hạn</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map(d => {
                      const dId = d.id || d.documentId;
                      const dName = d.name || d.documentName;
                      const dAccess = d.accessLevel || d.visibility;
                      const isPub = dAccess === 'Public' || dAccess === 'Công khai' || dAccess === 'public' || dAccess === 'công khai';
                      const dDate = d.uploadedAt || d.createdAt || '';
                      const dType = getDocTypeLabel(d);
                      return (
                        <tr key={dId}>
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <FileText size={14} style={{ color: 'var(--primary)' }} /> {dName}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Phân loại: {dType}</div>
                          </td>
                          <td>{dDate ? new Date(dDate).toLocaleDateString('vi-VN') : '—'}</td>
                          <td>
                            <span className={`badge ${isPub ? 'badge-public' : 'badge-internal'}`}>
                              {isPub ? (
                                <><Globe size={10} style={{ marginRight: '4px' }} /> Công khai</>
                              ) : (
                                <><Lock size={10} style={{ marginRight: '4px' }} /> Nội bộ</>
                              )}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '4px 8px' }}
                                onClick={() => handleViewDetail(d)}
                                title="Xem chi tiết"
                              >
                                <Eye size={12} />
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '4px 8px' }}
                                onClick={() => handleDownload(d)}
                                title="Tải về"
                              >
                                <Download size={12} />
                              </button>
                              {!readOnly && (
                                <>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    style={{ padding: '4px 8px' }}
                                    onClick={() => {
                                      setEditingDoc({
                                        id: dId,
                                        documentName: dName,
                                        documentTypeId: d.documentTypeId || d.typeId || 1,
                                        eventId: d.eventId || '',
                                        accessLevel: isPub ? 'Public' : 'Internal'
                                      });
                                      setShowEditModal(true);
                                    }}
                                    title="Chỉnh sửa"
                                  >
                                    <Edit size={12} />
                                  </button>
                                  <button
                                    className="btn btn-sm"
                                    style={{ padding: '4px 8px', background: 'rgba(239,68,68,0.15)', color: 'var(--error)', border: '1px solid rgba(239,68,68,0.3)' }}
                                    onClick={() => handleDelete(d)}
                                    title="Xóa"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Upload Form / Details Panel */}
        {readOnly ? (
          <div className="glass-card" style={{ height: 'fit-content' }}>
            <div className="glass-card-header">
              <h3 className="glass-card-title"><Lock size={18} /> Lưu ý Quyền hạn</h3>
            </div>
            <div style={{ padding: '8px 0', fontSize: '13px', lineHeight: 1.6, color: 'var(--text-main)' }}>
              <p>Kho tài liệu lưu trữ nội bộ của câu lạc bộ.</p>
              <p style={{ marginTop: '8px', color: 'var(--text-muted)' }}>
                * Chỉ <strong>Ban chủ nhiệm (Leader)</strong> của câu lạc bộ mới có quyền tải lên tài liệu mới hoặc thực hiện xóa tệp tin lưu trữ. Sinh viên là thành viên thông thường chỉ có quyền đọc trực tuyến hoặc tải xuống tài nguyên được chia sẻ.
              </p>
            </div>
          </div>
        ) : (
          <div className="glass-card" style={{ height: 'fit-content' }}>
            <div className="glass-card-header">
              <h3 className="glass-card-title"><Upload size={18} /> Tải tài liệu lên kho lưu trữ</h3>
            </div>

            <form onSubmit={handleUploadDoc}>
              <div className="form-group">
                <label>Phân loại Folder lưu trữ</label>
                <select
                  className="select-field"
                  value={docTypeId}
                  onChange={e => setDocTypeId(e.target.value)}
                >
                  <option value="1">Thư mục Proposal (Kế hoạch)</option>
                  <option value="2">Thư mục Kịch bản mẫu (Script)</option>
                  <option value="3">Thư mục Báo cáo (Report)</option>
                  <option value="4">Khác (Other)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Đính kèm vào Sự kiện (Tùy chọn)</label>
                <select
                  className="select-field"
                  value={uploadEventId}
                  onChange={e => setUploadEventId(e.target.value)}
                >
                  <option value="">-- Không đính kèm --</option>
                  {clubEvents.map(e => (
                    <option key={e.id || e.eventId} value={e.id || e.eventId}>
                      {e.eventName || e.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Quyền truy cập (Access Level)</label>
                <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="doc-access"
                      checked={accessLevel === 'Public'}
                      onChange={() => setAccessLevel('Public')}
                      style={{ accentColor: 'var(--primary)' }}
                    />
                    <span>Công khai (Public)</span>
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="doc-access"
                      checked={accessLevel === 'Internal'}
                      onChange={() => setAccessLevel('Internal')}
                      style={{ accentColor: 'var(--primary)' }}
                    />
                    <span>Nội bộ (Internal)</span>
                  </label>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
                  Tài liệu "Công khai" sẽ hiển thị trong thư viện tri thức chung dành cho toàn bộ sinh viên.
                </span>
              </div>

              <div className="form-group">
                <label>Tệp tin đính kèm <span style={{ color: 'var(--error)' }}>*</span></label>
                <input
                  id="doc-file-input"
                  type="file"
                  className="input-field"
                  multiple
                  onChange={e => setFiles(e.target.files)}
                  style={{ padding: '8px' }}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                disabled={isUploading}
              >
                {isUploading ? (
                  <span className="login-spinner" />
                ) : (
                  <><Upload size={16} /> Tải tài liệu lên hệ thống</>
                )}
              </button>
            </form>
          </div>
        )}
      </div>

    </div>
  );
}
