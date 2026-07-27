import React, { useState, useEffect, useCallback } from 'react';
import { getAllEvents, approveEvent, rejectEvent, requestEditEvent } from '../../services/eventService';
import { CheckCircle, XCircle, Clock, Calendar, MapPin, DollarSign, Building, Search, RefreshCw, Edit3, X, Paperclip, FileText, Download } from 'lucide-react';
import { parseDateVN, formatDateVN } from '../../utils/validator';

const statusConfig = {
  Approved: { label: 'Đã duyệt', className: 'badge-active', icon: <CheckCircle size={12} /> },
  Rejected: { label: 'Từ chối', className: 'badge-blocked', icon: <XCircle size={12} /> },
  Pending:  { label: 'Chờ duyệt', className: 'badge-member', icon: <Clock size={12} /> },
};

const statusMapFEtoBE = {
  Pending: 'Chờ duyệt',
  Approved: 'Đã duyệt',
  Rejected: 'Bị từ chối',
};

const statusMapBEtoFE = {
  'Chờ duyệt': 'Pending',
  'Đã duyệt': 'Approved',
  'Bị từ chối': 'Rejected',
  'Đã hủy': 'Cancelled',
  'Pending': 'Pending',
  'Approved': 'Approved',
  'Rejected': 'Rejected',
};

export default function EventApproval({ triggerNotification, selectedClubId, mode = 'approval' }) {
  const clubs = React.useMemo(() => {
    try {
      const stored = sessionStorage.getItem('fpt_available_clubs');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.map(c => ({
          id: String(c.clubId || c.id || ''),
          name: c.clubName || c.name || `CLB #${c.clubId || c.id}`,
          logo: c.logoImage || c.logo || '',
        }));
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  }, []);

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState(mode === 'monitoring' ? 'ALL' : 'Pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [remarkMap, setRemarkMap] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [actionLoading, setActionLoading] = useState(null); // eventId đang xử lý

  // Load events từ API
  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      // Tải toàn bộ sự kiện để tính số lượng chính xác ở các thẻ stats
      const data = await getAllEvents();
      // BE có thể trả về array hoặc { data: [...] }
      const rawEvents = Array.isArray(data) ? data : (data?.data ?? []);
      
      // Chuẩn hóa status từ tiếng Việt sang tiếng Anh để hiển thị đúng badge
      const normalized = rawEvents.map(e => ({
        ...e,
        status: statusMapBEtoFE[e.status] || e.status || 'Pending'
      }));
      
      setEvents(normalized);
    } catch (err) {
      console.error('[EventApproval] Lỗi tải sự kiện:', err);
      triggerNotification('Không tải được danh sách sự kiện!', 'error');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [triggerNotification]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const filteredEvents = events.filter(ev => {
    // 1. Lọc theo trạng thái phê duyệt
    const matchesStatus = filterStatus === 'ALL' || ev.status === filterStatus;

    // 2. Lọc theo ô tìm kiếm
    const q = searchQuery.toLowerCase();
    const club = clubs.find(c => c.id === ev.clubId || c.id === String(ev.clubId));
    const matchesSearch = !q || (ev.name || ev.eventName || '').toLowerCase().includes(q) || (club?.name.toLowerCase().includes(q));

    // 3. Lọc theo selectedClubId
    const matchesClub = !selectedClubId || String(ev.clubId) === String(selectedClubId);

    return matchesStatus && matchesSearch && matchesClub;
  });

  const getClub = (clubId) => clubs.find(c => c.id === clubId || c.id === String(clubId));

  const handleApprove = async (ev) => {
    const eventId = ev.id || ev.eventId;
    setActionLoading(eventId);
    try {
      await approveEvent(eventId);
      triggerNotification(`Đã duyệt sự kiện: ${ev.name || ev.eventName}`, 'success');
      setExpandedId(null);
      await loadEvents();
    } catch (err) {
      console.error('[EventApproval] Lỗi duyệt sự kiện:', err);
      triggerNotification(
        err?.response?.data?.message || 'Duyệt sự kiện thất bại!',
        'error'
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (ev) => {
    const eventId = ev.id || ev.eventId;
    const remark = remarkMap[eventId] || '';
    if (!remark.trim()) {
      triggerNotification('Vui lòng nhập lý do từ chối!', 'warning');
      return;
    }
    setActionLoading(eventId);
    try {
      await rejectEvent(eventId, { rejectReason: remark });
      triggerNotification(`Đã từ chối sự kiện: ${ev.name || ev.eventName}`, 'error');
      setExpandedId(null);
      await loadEvents();
    } catch (err) {
      console.error('[EventApproval] Lỗi từ chối sự kiện:', err);
      triggerNotification(
        err?.response?.data?.message || 'Từ chối sự kiện thất bại!',
        'error'
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleRequestEdit = async (ev) => {
    const eventId = ev.id || ev.eventId;
    const remark = remarkMap[eventId] || '';
    if (!remark.trim()) {
      triggerNotification('Vui lòng nhập lý do yêu cầu chỉnh sửa!', 'warning');
      return;
    }
    setActionLoading(eventId);
    try {
      await requestEditEvent(eventId, { rejectReason: remark });
      triggerNotification(`Đã yêu cầu chỉnh sửa sự kiện: ${ev.name || ev.eventName}`, 'info');
      setExpandedId(null);
      await loadEvents();
    } catch (err) {
      console.warn('[EventApproval] requestEditEvent gặp lỗi BE DB constraint, chuyển sang fallback rejectEvent:', err);
      // Fallback: Sử dụng API reject (vốn đã được PostgreSQL DB cho phép) kèm tiền tố [Yêu cầu chỉnh sửa]
      try {
        await rejectEvent(eventId, { rejectReason: `[Yêu cầu chỉnh sửa] ${remark}` });
        triggerNotification(`Đã yêu cầu chỉnh sửa sự kiện: ${ev.name || ev.eventName}`, 'info');
        setExpandedId(null);
        await loadEvents();
      } catch (fallbackErr) {
        console.error('[EventApproval] Lỗi gửi yêu cầu chỉnh sửa:', fallbackErr);
        triggerNotification(fallbackErr?.response?.data?.message || 'Yêu cầu chỉnh sửa thất bại!', 'error');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const pendingCount  = events.filter(e => 
    (e.approvalStatus || e.status || 'Pending') === 'Pending' && 
    (!selectedClubId || String(e.clubId) === String(selectedClubId))
  ).length;
  const approvedCount = events.filter(e => 
    (e.approvalStatus || e.status) === 'Approved' && 
    (!selectedClubId || String(e.clubId) === String(selectedClubId))
  ).length;
  const rejectedCount = events.filter(e => 
    (e.approvalStatus || e.status) === 'Rejected' && 
    (!selectedClubId || String(e.clubId) === String(selectedClubId))
  ).length;

  // ── EVENT DETAIL VIEW ──────────────────────────────────────────────────────
  if (expandedId) {
    const ev = events.find(e => (e.id || e.eventId) === expandedId);
    if (ev) {
      const eventId = ev.id || ev.eventId;
      const eventName = ev.eventName || ev.name;
      const approvalStatus = ev.status || 'Pending';
      const cfg = statusConfig[approvalStatus] || { label: approvalStatus, className: 'badge-member', icon: <Clock size={12} /> };
      const club = getClub(ev.clubId);
      const eventTime = ev.dateTime || ev.startTime;
      const isProcessing = actionLoading === eventId;

      // Resolve attached files from event object or localStorage persistence
      let attachedFiles = ev.files || ev.documents || ev.attachments || [];
      if (!Array.isArray(attachedFiles) || attachedFiles.length === 0) {
        const byId = localStorage.getItem(`fpt_event_files_${eventId}`);
        const byName = localStorage.getItem(`fpt_event_files_${eventName}`);
        const str = byId || byName;
        if (str) {
          try { attachedFiles = JSON.parse(str); } catch {}
        }
      }

      return (
        <div style={{ animation: 'fadeIn 0.2s ease' }}>
          <div className="glass-card" style={{ marginBottom: '20px', padding: '12px 20px' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setExpandedId(null)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}
            >
              <X size={16} /> Quay lại Duyệt Sự kiện
            </button>
          </div>
          <div className="glass-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="glass-card-header" style={{ marginBottom: '16px' }}>
              <h3 className="glass-card-title"><Calendar size={18} style={{ marginRight: '6px' }} /> Chi tiết & Phê duyệt Sự kiện</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h4 style={{ fontSize: '20px', color: 'var(--text-heading)', fontWeight: 700, borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                {eventName}
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                {[
                  ['Câu lạc bộ', club ? club.name : `CLB #${ev.clubId}`],
                  ['Thời gian', eventTime ? formatDateVN(eventTime) : 'N/A'],
                  ['Địa điểm', ev.venue || ev.location || 'N/A'],
                  ['Ngân sách dự trù', ev.budget || ev.planBudget ? `${Number(ev.budget || ev.planBudget).toLocaleString('vi-VN')} VNĐ` : 'N/A'],
                  ['Số lượng dự kiến', ev.targetParticipants ? `${ev.targetParticipants} người` : 'N/A'],
                  ['Trạng thái', <span className={`badge ${cfg.className}`}>{cfg.label}</span>]
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '10px' }}>
                    <span style={{ minWidth: '130px', fontSize: '13px', color: 'var(--text-muted)' }}>{label}</span>
                    <span style={{ fontSize: '14px', color: 'var(--text-main)', fontWeight: 500 }}>{value}</span>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: '14px', color: 'var(--text-main)', whiteSpace: 'pre-line', lineHeight: 1.6, background: 'rgba(0,0,0,0.15)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <strong style={{ color: 'var(--text-heading)', display: 'block', marginBottom: '8px' }}>Mô tả sự kiện:</strong>
                {ev.description || 'Không có mô tả'}
              </div>

              {/* File đính kèm / Kế hoạch & Hình ảnh */}
              {attachedFiles && attachedFiles.length > 0 && (() => {
                const isImageFile = (file) => {
                  const name = (file.name || file.fileName || file.url || file.path || '').toLowerCase();
                  const type = (file.type || '').toLowerCase();
                  return type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
                };

                return (
                  <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                    <strong style={{ fontSize: '14px', color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                      <Paperclip size={16} style={{ color: 'var(--primary)' }} /> Tài liệu & Hình ảnh đính kèm ({attachedFiles.length}):
                    </strong>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
                      {attachedFiles.map((file, idx) => {
                        const fileName = file.name || file.fileName || `Tài_liệu_${idx + 1}`;
                        const fileSize = file.size ? `${(file.size / 1024).toFixed(1)} KB` : '';
                        const fileUrl = file.url || file.fileUrl || file.path;
                        const isImg = isImageFile(file);

                        const handleDownload = () => {
                          if (!fileUrl) {
                            alert('Không tìm thấy đường dẫn file!');
                            return;
                          }
                          const a = document.createElement('a');
                          a.href = fileUrl;
                          a.download = fileName;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                        };

                        if (isImg) {
                          return (
                            <div key={idx} style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🖼️ {fileName}</span>
                                {fileUrl && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={handleDownload}
                                    style={{ fontSize: '11px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    <Download size={12} />
                                  </button>
                                )}
                              </div>
                              {fileUrl && (
                                <div style={{ textAlign: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '8px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <img src={fileUrl} alt={fileName} style={{ maxWidth: '100%', maxHeight: '150px', borderRadius: '4px', objectFit: 'contain' }} />
                                </div>
                              )}
                            </div>
                          );
                        }

                        return (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                              <FileText size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                              <span style={{ fontSize: '13px', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {fileName} {fileSize && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({fileSize})</span>}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={handleDownload}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px', flexShrink: 0 }}
                            >
                              <Download size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {(ev.approvalRemark || ev.rejectReason) && (
                <div style={{ padding: '12px', background: approvalStatus === 'Approved' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', borderRadius: '8px', border: `1px solid ${approvalStatus === 'Approved' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, fontSize: '13px', color: 'var(--text-main)' }}>
                  <strong style={{ color: approvalStatus === 'Approved' ? 'var(--success)' : 'var(--error)' }}>Ghi chú trước đó:</strong> {ev.approvalRemark || ev.rejectReason}
                </div>
              )}

              {approvalStatus === 'Pending' && mode !== 'monitoring' ? (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '10px' }}>
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      Lý do từ chối / Yêu cầu chỉnh sửa (bắt buộc nếu từ chối hoặc yêu cầu sửa):
                    </label>
                    <textarea
                      className="textarea-field"
                      rows={3}
                      placeholder="Nhập lý do phản hồi chi tiết..."
                      value={remarkMap[eventId] || ''}
                      onChange={e => setRemarkMap(m => ({ ...m, [eventId]: e.target.value }))}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-success"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
                      onClick={() => handleApprove(ev)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? <span className="login-spinner" /> : <><CheckCircle size={16} /> Phê duyệt</>}
                    </button>
                    <button
                      className="btn"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 20px',
                        background: '#f59e0b',
                        color: '#000',
                        fontWeight: 600,
                        border: 'none',
                        boxShadow: '0 2px 4px rgba(245,158,11,0.3)',
                        cursor: isProcessing ? 'not-allowed' : 'pointer'
                      }}
                      onClick={() => handleRequestEdit(ev)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? <span className="login-spinner" /> : <><Edit3 size={16} /> Yêu cầu sửa</>}
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
                      onClick={() => handleReject(ev)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? <span className="login-spinner" /> : <><XCircle size={16} /> Từ chối</>}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <button className="btn btn-secondary" style={{ padding: '10px 24px' }} onClick={() => setExpandedId(null)}>Đóng</button>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="user-management-container">
      {/* Stats */}
      <div className="stats-grid">
        <div className="stats-card" onClick={() => setFilterStatus('Pending')} style={{ cursor: 'pointer' }}>
          <div className="stats-icon-box" style={{ color: 'var(--warning, #f59e0b)' }}><Clock size={20} /></div>
          <div className="stats-info">
            <span className="stats-label">Chờ duyệt</span>
            <span className="stats-value">{pendingCount} sự kiện</span>
          </div>
        </div>
        <div className="stats-card" onClick={() => setFilterStatus('Approved')} style={{ cursor: 'pointer' }}>
          <div className="stats-icon-box" style={{ color: 'var(--success)' }}><CheckCircle size={20} /></div>
          <div className="stats-info">
            <span className="stats-label">Đã duyệt</span>
            <span className="stats-value">{approvedCount} sự kiện</span>
          </div>
        </div>
        <div className="stats-card" onClick={() => setFilterStatus('Rejected')} style={{ cursor: 'pointer' }}>
          <div className="stats-icon-box" style={{ color: 'var(--error)' }}><XCircle size={20} /></div>
          <div className="stats-info">
            <span className="stats-label">Từ chối</span>
            <span className="stats-value">{rejectedCount} sự kiện</span>
          </div>
        </div>
      </div>

      <div className="glass-card">
        <div className="glass-card-header">
          <h3 className="glass-card-title"><Calendar size={18} /> Duyệt Sự kiện CLB</h3>
          <button
            className="btn btn-secondary btn-sm"
            onClick={loadEvents}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Làm mới
          </button>
        </div>

        <div className="search-filter-row">
          <div className="search-input-wrapper">
            <Search className="search-icon" size={18} />
            <input
              type="text"
              className="input-field"
              placeholder="Tìm theo tên sự kiện, tên CLB..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div>
            <select className="select-field" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: '160px' }}>
              <option value="ALL">Tất cả trạng thái</option>
              <option value="Pending">Chờ duyệt</option>
              <option value="Approved">Đã duyệt</option>
              <option value="Rejected">Từ chối</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="empty-state-view">
            <span className="login-spinner" style={{ width: '32px', height: '32px' }} />
            <p style={{ marginTop: '12px' }}>Đang tải danh sách sự kiện...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="empty-state-view">
            <Calendar className="empty-state-icon" />
            <p>Không có sự kiện nào phù hợp.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
            {filteredEvents.map(ev => {
              const eventId = ev.id || ev.eventId;
              const eventName = ev.name || ev.eventName;
              const club = getClub(ev.clubId);
              const approvalStatus = ev.approvalStatus || ev.status || 'Pending';
              const cfg = statusConfig[approvalStatus] || statusConfig.Pending;
              const isExpanded = expandedId === eventId;
              const isProcessing = actionLoading === eventId;

              // Chuẩn hóa thời gian (BE có thể trả dateTime hoặc startTime)
              const eventTime = ev.dateTime || ev.startTime;

              return (
                <div key={eventId} className="glass-card" style={{ padding: '16px', marginBottom: 0, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ flex: 1 }} onClick={() => setExpandedId(eventId)} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                        <h4 style={{ fontSize: '15px', color: 'var(--text-heading)', margin: 0 }}>{eventName}</h4>
                        <span className={`badge ${cfg.className}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {cfg.icon} {cfg.label}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--text-muted)' }}>
                        {club && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Building size={12} />
                            <img src={club.logo} alt={club.name} style={{ width: '14px', height: '14px', borderRadius: '3px', objectFit: 'cover' }} />
                            {club.name.split(' - ')[0]}
                          </span>
                        )}
                        {eventTime && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={12} />
                             {formatDateVN(eventTime)}
                          </span>
                        )}
                        {(ev.venue || ev.location) && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <MapPin size={12} /> {ev.venue || ev.location}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setExpandedId(eventId)}
                      disabled={isProcessing}
                    >
                      {approvalStatus === 'Pending' && mode !== 'monitoring' ? 'Xem xét' : 'Chi tiết'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
