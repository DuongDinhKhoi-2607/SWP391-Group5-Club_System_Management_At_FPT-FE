import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Search, Clock, CheckCircle, XCircle, ChevronDown, ChevronUp, Star, Award, AlertTriangle, RefreshCw, X } from 'lucide-react';
import * as clubReportService from '../../services/clubReportService';

const getStatusConfig = (status) => {
  const s = String(status || '');
  if (s === 'Chờ Manager duyệt' || s === 'Submitted' || s === 'Pending' || s === 'Chờ duyệt') {
    return { label: 'Chờ Manager duyệt', className: 'badge-manager', icon: <Clock size={12} /> };
  }
  if (s === 'Chờ Admin duyệt') {
    return { label: 'Đã gửi Admin (Chờ duyệt)', className: 'badge-admin', icon: <Clock size={12} /> };
  }
  if (s === 'Đã duyệt' || s === 'Approved' || s === 'Appraised') {
    return { label: 'Đã duyệt hoàn toàn', className: 'badge-active', icon: <CheckCircle size={12} /> };
  }
  if (s === 'Từ chối' || s === 'Rejected' || s === 'Bị từ chối') {
    return { label: 'Bị từ chối', className: 'badge-blocked', icon: <XCircle size={12} /> };
  }
  return { label: s || 'Chờ duyệt', className: 'badge-member', icon: <Clock size={12} /> };
};
export default function ReviewClubReports({ triggerNotification }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [scoreMap, setScoreMap] = useState({});
  const [remarkMap, setRemarkMap] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [modalError, setModalError] = useState(null);
  const [modalSuccess, setModalSuccess] = useState(null);

  const syncReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await clubReportService.getClubReports();
      const list = Array.isArray(res) ? res : (res?.data ?? []);
      // Mới nhất lên đầu
      list.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
      setReports(list);
    } catch (err) {
      console.error('[ReviewClubReports] Lỗi tải báo cáo:', err);
      triggerNotification('Không tải được danh sách báo cáo hoạt động!', 'error');
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [triggerNotification]);

  useEffect(() => {
    syncReports();
  }, [syncReports]);

  const handleManagerReview = async (id, actionStatus) => {
    setModalError(null);
    const remark = remarkMap[id] || '';
    if (actionStatus === 'Từ chối' && !remark.trim()) {
      setModalError('❌ Vui lòng nhập lý do nhận xét khi từ chối báo cáo!');
      return;
    }

    try {
      await clubReportService.managerReviewClubReport(id, {
        status: actionStatus,
        managerNote: remark.trim() || 'Manager đã duyệt báo cáo.'
      });
      if (actionStatus === 'Chờ Admin duyệt') {
        setModalSuccess({
          title: 'Duyệt & Gửi Admin thành công!',
          desc: 'Báo cáo hoạt động của CLB đã được phê duyệt và chuyển tiếp lên Admin để duyệt cuối.'
        });
      } else {
        setModalSuccess({
          title: 'Từ chối duyệt báo cáo thành công!',
          desc: 'Báo cáo hoạt động đã bị từ chối duyệt thành công.'
        });
      }
      await syncReports();
    } catch (err) {
      console.error('[ReviewClubReports] Lỗi duyệt báo cáo:', err);
      setModalError(err?.response?.data?.message || 'Duyệt báo cáo thất bại!');
    }
  };

  const handleCloseModal = () => {
    setExpandedId(null);
    setModalError(null);
    setModalSuccess(null);
  };

  const filteredReports = reports.filter(r => {
    const isPending = r.status === 'Chờ Manager duyệt' || r.status === 'Submitted' || r.status === 'Pending' || r.status === 'Chờ duyệt';
    const isReviewed = r.status === 'Chờ Admin duyệt' || r.status === 'Đã duyệt' || r.status === 'Approved' || r.status === 'Appraised' || r.status === 'Từ chối' || r.status === 'Rejected';
    
    let matchesStatus = true;
    if (filterStatus === 'Submitted') {
      matchesStatus = isPending;
    } else if (filterStatus === 'Appraised') {
      matchesStatus = isReviewed;
    }

    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || 
      (r.clubName || '').toLowerCase().includes(q) || 
      (r.reportTitle || r.summaryContent || '').toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const pendingCount = reports.filter(r => r.status === 'Chờ Manager duyệt' || r.status === 'Submitted' || r.status === 'Pending' || r.status === 'Chờ duyệt').length;
  const reviewedCount = reports.filter(r => r.status === 'Chờ Admin duyệt' || r.status === 'Đã duyệt' || r.status === 'Approved' || r.status === 'Appraised' || r.status === 'Từ chối' || r.status === 'Rejected').length;

  // ── DETAIL & REVIEW REPORT VIEW ────────────────────────────────────────────
  if (expandedId) {
    const rep = reports.find(r => (r.clubReportId || r.id) === expandedId);
    if (rep) {
      const isPending = rep.status === 'Chờ Manager duyệt' || rep.status === 'Submitted' || rep.status === 'Pending' || rep.status === 'Chờ duyệt';
      const cfg = getStatusConfig(rep.status);
      return (
        <div style={{ animation: 'fadeIn 0.2s ease' }}>
          <div className="glass-card" style={{ marginBottom: '20px', padding: '12px 20px' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleCloseModal}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}
            >
              <X size={16} /> Quay lại Duyệt Báo cáo
            </button>
          </div>
          <div className="glass-card" style={{ maxWidth: '700px', margin: '0 auto' }}>
            <div className="glass-card-header" style={{ marginBottom: '16px' }}>
              <h3 className="glass-card-title"><ClipboardList size={18} style={{ marginRight: '6px' }} /> Chi tiết & Phê duyệt Báo cáo</h3>
            </div>
            
            {modalSuccess ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '32px 0', textAlign: 'center' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(34,197,94,0.1)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle size={36} />
                </div>
                <div>
                  <h4 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '8px' }}>{modalSuccess.title}</h4>
                  <p style={{ fontSize: '14px', color: 'var(--text-muted)', maxWidth: '420px', lineHeight: 1.6 }}>{modalSuccess.desc}</p>
                </div>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={handleCloseModal}
                  style={{ minWidth: '140px', marginTop: '12px' }}
                >
                  Đóng
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h4 style={{ fontSize: '18px', color: 'var(--text-heading)', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '12px' }}>
                  {rep.clubName}
                </h4>
                
                {modalError && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: '#f87171', fontSize: '14px' }}>
                    <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                    <span>{modalError}</span>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  {[
                    ['Học kỳ', rep.reportPeriodName || 'SU26'],
                    ['Số sự kiện tổ chức', rep.totalEventsHeld || 0],
                    ['Số dư tài chính (VND)', rep.financialBalance !== undefined ? rep.financialBalance.toLocaleString('vi-VN') : '0'],
                    ['Tiêu đề báo cáo', rep.reportTitle],
                    ['Trạng thái', <span className={`badge ${cfg.className}`}>{cfg.label}</span>],
                    ['Nộp lúc', rep.submittedAt ? new Date(rep.submittedAt).toLocaleString('vi-VN') : '—']
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '12px' }}>
                      <span style={{ minWidth: '140px', fontSize: '13px', color: 'var(--text-muted)' }}>{label}</span>
                      <span style={{ fontSize: '14px', color: 'var(--text-main)', fontWeight: 500 }}>{value}</span>
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: '14px', color: 'var(--text-main)', whiteSpace: 'pre-line', lineHeight: 1.6, background: 'rgba(0,0,0,0.15)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border)', maxHeight: '300px', overflowY: 'auto' }}>
                  <strong style={{ color: 'var(--text-heading)', display: 'block', marginBottom: '8px' }}>Nội dung tóm tắt:</strong>
                  {rep.summaryContent || rep.content}
                </div>

                {isPending ? (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '10px' }}>
                    <div className="form-group" style={{ marginBottom: '16px' }}>
                      <label style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Nhận xét / Phản hồi của Manager (bắt buộc khi Từ chối):</label>
                      <textarea
                        className="textarea-field"
                        placeholder="Nhập nhận xét hoặc lý do từ chối..."
                        rows={3}
                        value={remarkMap[expandedId] || ''}
                        onChange={e => {
                          setRemarkMap({ ...remarkMap, [expandedId]: e.target.value });
                          setModalError(null);
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '16px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-success"
                        style={{ padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                        onClick={() => handleManagerReview(expandedId, 'Chờ Admin duyệt')}
                      >
                        <CheckCircle size={16} /> Duyệt & Gửi Admin
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                        onClick={() => handleManagerReview(expandedId, 'Từ chối')}
                      >
                        <XCircle size={16} /> Từ chối
                      </button>
                      <button className="btn btn-secondary" style={{ padding: '10px 20px' }} onClick={handleCloseModal}>Đóng</button>
                    </div>
                  </div>
                ) : (
                  (rep.managerNote || rep.icpdpFeedback) && (
                    <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', fontSize: '14px', borderLeft: '4px solid var(--primary)', color: 'var(--text-main)', marginTop: '8px' }}>
                      <strong style={{ color: 'var(--text-heading)', display: 'block', marginBottom: '6px' }}>Nhận xét từ bạn:</strong>
                      {rep.managerNote || rep.icpdpFeedback}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      );
    }
  }

  return (
    <div className="user-management-container">
      {/* Stats Cards */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stats-card" onClick={() => setFilterStatus('Submitted')} style={{ cursor: 'pointer' }}>
          <div className="stats-icon-box" style={{ color: 'var(--warning)' }}><Clock size={20} /></div>
          <div className="stats-info">
            <span className="stats-label">Báo cáo chờ duyệt</span>
            <span className="stats-value">{pendingCount} báo cáo</span>
          </div>
        </div>
        <div className="stats-card" onClick={() => setFilterStatus('Appraised')} style={{ cursor: 'pointer' }}>
          <div className="stats-icon-box" style={{ color: 'var(--success)' }}><CheckCircle size={20} /></div>
          <div className="stats-info">
            <span className="stats-label">Đã xem xét</span>
            <span className="stats-value">{reviewedCount} báo cáo</span>
          </div>
        </div>
      </div>

      {/* Main Table/List */}
      <div className="glass-card">
        <div className="glass-card-header">
          <h3 className="glass-card-title"><ClipboardList size={18} /> Phê duyệt báo cáo hoạt động Câu lạc bộ</h3>
        </div>

        <div className="search-filter-row">
          <div className="search-input-wrapper" style={{ flex: 1 }}>
            <Search className="search-icon" size={18} />
            <input
              type="text"
              className="input-field"
              placeholder="Tìm theo tên CLB hoặc nội dung báo cáo..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div>
            <select className="select-field" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: '180px' }}>
              <option value="ALL">Tất cả trạng thái</option>
              <option value="Submitted">Chờ duyệt</option>
              <option value="Appraised">Đã xem xét</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="empty-state-view">
            <span className="login-spinner" style={{ width: '28px', height: '28px' }} />
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="empty-state-view">
            <ClipboardList className="empty-state-icon" />
            <p>Không tìm thấy báo cáo CLB nào.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
            {filteredReports.map(rep => {
              const repId = rep.clubReportId || rep.id;
              const isExpanded = expandedId === repId;
              const isPending = rep.status === 'Chờ Manager duyệt' || rep.status === 'Submitted' || rep.status === 'Pending' || rep.status === 'Chờ duyệt';
              const cfg = getStatusConfig(rep.status);
              
              return (
                <div key={repId} className="glass-card" style={{ padding: '16px', marginBottom: 0, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ flex: 1 }} onClick={() => setExpandedId(repId)} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-heading)', fontSize: '15px' }}>{rep.clubName}</span>
                        <span className={`badge ${cfg.className}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', padding: '2px 8px', ...cfg.style }}>
                          {cfg.icon} {cfg.label}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Học kỳ: {rep.reportPeriodName || 'SU26'} · Số sự kiện: {rep.totalEventsHeld || 0} · Tiêu đề: {rep.reportTitle}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Nộp lúc: {rep.submittedAt ? new Date(rep.submittedAt).toLocaleString('vi-VN') : '—'}
                      </div>
                    </div>

                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setExpandedId(repId)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      Xem &amp; Duyệt
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
