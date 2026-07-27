import React, { useState, useEffect, useCallback } from 'react';
import { Check, X, Eye, FileText, CheckCircle, Image as ImageIcon, AlertCircle, AlertTriangle, Clock, Search, RefreshCw } from 'lucide-react';
import { 
  reviewEvidence, 
  reviewEvidenceLeader,
  getPendingEvidences, 
  getPendingEvidencesLeader,
  getEventEvidences,
  getAllEvents,
  getEventsByClub
} from '../../services/eventService';

export default function EvidenceApproval({ triggerNotification, selectedClubId }) {
  const [evidences, setEvidences] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [remarkMap, setRemarkMap] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const saveReviewedEvidence = (item) => {
    try {
      const stored = localStorage.getItem('fpt_reviewed_evidences');
      const list = stored ? JSON.parse(stored) : [];
      const idKey = String(item.id || item.evidenceId);
      const existingIdx = list.findIndex(x => String(x.id || x.evidenceId) === idKey);
      if (existingIdx >= 0) {
        list[existingIdx] = { ...list[existingIdx], ...item };
      } else {
        list.push(item);
      }
      localStorage.setItem('fpt_reviewed_evidences', JSON.stringify(list));
    } catch (e) {
      console.warn('[EvidenceApproval] Local storage save error:', e);
    }
  };

  const loadEvidences = useCallback(async () => {
    setLoading(true);
    try {
      let rawList = [];
      if (selectedClubId) {
        // Leader: Dùng API GET /api/events/evidences/pending-leader?clubId=...
        const res = await getPendingEvidencesLeader(selectedClubId);
        rawList = Array.isArray(res) ? res : (res?.data ?? []);
      } else {
        // Manager/Admin: Dùng API GET /api/events/evidences/pending
        const res = await getPendingEvidences();
        rawList = Array.isArray(res) ? res : (res?.data ?? []);
      }

      // Merge evidences from events to get approved and rejected items as well
      try {
        const eventsData = selectedClubId ? await getEventsByClub(selectedClubId) : await getAllEvents();
        const eventsList = Array.isArray(eventsData) ? eventsData : (eventsData?.data ?? []);
        const validEvents = eventsList.filter(e => e && (e.id || e.eventId || e.clubEventId)).slice(0, 30);

        const eventEvidencesLists = await Promise.allSettled(
          validEvents.map(e => getEventEvidences(e.id || e.eventId || e.clubEventId))
        );

        const existingMap = new Map();
        rawList.forEach(item => {
          const idKey = String(item.id || item.evidenceId);
          existingMap.set(idKey, item);
        });

        eventEvidencesLists.forEach(resObj => {
          if (resObj.status === 'fulfilled' && resObj.value) {
            const list = Array.isArray(resObj.value) ? resObj.value : (resObj.value?.data ?? []);
            list.forEach(item => {
              const idKey = String(item.id || item.evidenceId);
              if (!existingMap.has(idKey)) {
                existingMap.set(idKey, item);
              }
            });
          }
        });

        // Merge local reviewed items history
        try {
          const stored = localStorage.getItem('fpt_reviewed_evidences');
          if (stored) {
            const localList = JSON.parse(stored);
            if (Array.isArray(localList)) {
              localList.forEach(item => {
                const idKey = String(item.id || item.evidenceId);
                const existing = existingMap.get(idKey);
                if (existing) {
                  existingMap.set(idKey, { ...existing, ...item });
                } else {
                  existingMap.set(idKey, item);
                }
              });
            }
          }
        } catch (e) {}

        rawList = Array.from(existingMap.values());
      } catch (mergeErr) {
        console.warn('[EvidenceApproval] Could not merge event evidences:', mergeErr);
      }

      const allEvs = rawList.map(ev => {
        const rawStatus = String(ev.isVerified || ev.status || ev.rawStatus || 'Pending').trim();
        let normStatus = 'Pending';
        if (rawStatus === 'Hợp lệ' || rawStatus === 'Approved' || rawStatus === 'Đã duyệt' || rawStatus === 'ManagerApproved') {
          normStatus = 'Approved';
        } else if (rawStatus === 'Không hợp lệ' || rawStatus === 'Rejected' || rawStatus === 'Từ chối' || rawStatus === 'Đã từ chối') {
          normStatus = 'Rejected';
        } else {
          normStatus = 'Pending';
        }

        return {
          id: ev.id || ev.evidenceId,
          userId: ev.studentId || ev.studentCode || ev.userId || 'N/A',
          userFullName: ev.participantName || ev.studentName || ev.userFullName || ev.fullName || 'Sinh viên',
          clubId: ev.clubId || selectedClubId,
          clubName: ev.clubName || 'CLB',
          eventName: ev.eventName || ev.name || 'Sự kiện',
          evidenceType: ev.evidenceType || 'Check-in Photo',
          fileUrl: ev.fileUrl || ev.url || ev.filePath || ev.imagePath || '',
          description: ev.feedback || ev.description || '',
          submittedAt: ev.uploadedAt || ev.submittedAt || ev.createdAt || new Date().toISOString(),
          status: normStatus,
          rawStatus
        };
      });

      setEvidences(allEvs);
    } catch (err) {
      console.error('[EvidenceApproval] Lỗi tải minh chứng:', err);
      triggerNotification('Không tải được danh sách minh chứng từ hệ thống!', 'error');
      setEvidences([]);
    } finally {
      setLoading(false);
    }
  }, [selectedClubId, triggerNotification]);

  useEffect(() => {
    loadEvidences();
  }, [loadEvidences]);

  const handleApprove = async (ev) => {
    try {
      if (selectedClubId) {
        await reviewEvidenceLeader(ev.id, { status: 'Chờ Manager duyệt' });
        saveReviewedEvidence({ ...ev, status: 'Approved', rawStatus: 'Chờ Manager duyệt' });
      } else {
        await reviewEvidence(ev.id, { status: 'Đã duyệt' });
        saveReviewedEvidence({ ...ev, status: 'Approved', rawStatus: 'Đã duyệt' });
      }
      triggerNotification(`✅ Đã duyệt chứng nhận của ${ev.userFullName}!`, 'success');
      await loadEvidences();
    } catch (err) {
      console.error('[EvidenceApproval] Lỗi duyệt chứng nhận:', err);
      triggerNotification(err?.response?.data?.message || 'Xét duyệt chứng nhận thất bại!', 'error');
    }
    setExpandedId(null);
  };

  const handleReject = async (ev) => {
    const remark = remarkMap[ev.id] || '';
    if (!remark.trim()) {
      triggerNotification('Vui lòng nhập lý do từ chối!', 'warning');
      return;
    }
    try {
      if (selectedClubId) {
        await reviewEvidenceLeader(ev.id, { status: 'Từ chối' });
      } else {
        await reviewEvidence(ev.id, { status: 'Từ chối' });
      }
      saveReviewedEvidence({ ...ev, status: 'Rejected', rawStatus: 'Từ chối', rejectReason: remark });
      triggerNotification(`❌ Đã từ chối chứng nhận của ${ev.userFullName}!`, 'success');
      await loadEvidences();
    } catch (err) {
      console.error('[EvidenceApproval] Lỗi từ chối chứng nhận:', err);
      triggerNotification(err?.response?.data?.message || 'Xét duyệt chứng nhận thất bại!', 'error');
    }
    setExpandedId(null);
  };

  const filtered = evidences.filter(ev => {
    const matchClub = !selectedClubId || String(ev.clubId) === String(selectedClubId);
    
    let matchStatus = false;
    if (filterStatus === 'ALL') {
      matchStatus = true;
    } else if (filterStatus === 'Pending') {
      if (selectedClubId) {
        // Leader view: chỉ hiện những item đang chờ Leader duyệt
        matchStatus = ev.rawStatus === 'Đang chờ' || ev.rawStatus === 'Pending' || ev.rawStatus === 'Đang chờ Leader duyệt';
      } else {
        // Manager view: CHỈ HỆN những item đã được Leader thông qua (Chờ Manager duyệt)
        matchStatus = ev.rawStatus === 'Chờ Manager duyệt';
      }
    } else if (filterStatus === 'Approved') {
      matchStatus = ev.status === 'Approved' || ev.rawStatus === 'Hợp lệ' || ev.rawStatus === 'Đã duyệt';
    } else if (filterStatus === 'Rejected') {
      matchStatus = ev.status === 'Rejected' || ev.rawStatus === 'Không hợp lệ' || ev.rawStatus === 'Từ chối' || ev.rawStatus === 'Đã từ chối';
    }

    const q = searchQuery.toLowerCase();
    const matchSearch = !q || ev.userFullName.toLowerCase().includes(q) || ev.userId.toLowerCase().includes(q) || ev.eventName.toLowerCase().includes(q);
    return matchClub && matchStatus && matchSearch;
  });

  const pendingCount = evidences.filter(ev => {
    if (selectedClubId) {
      return ev.rawStatus === 'Đang chờ' || ev.rawStatus === 'Pending' || ev.rawStatus === 'Đang chờ Leader duyệt';
    }
    return ev.rawStatus === 'Chờ Manager duyệt';
  }).length;
  const approvedCount = evidences.filter(e => e.status === 'Approved' || e.rawStatus === 'Hợp lệ' || e.rawStatus === 'Đã duyệt').length;
  const rejectedCount = evidences.filter(e => e.status === 'Rejected' || e.rawStatus === 'Không hợp lệ' || e.rawStatus === 'Từ chối' || e.rawStatus === 'Đã từ chối').length;

  // ── EVIDENCE DETAIL VIEW ───────────────────────────────────────────────────
  if (expandedId) {
    const ev = evidences.find(e => String(e.id) === String(expandedId));
    if (ev) {
      const isWaitingLeader = !selectedClubId && ev.status === 'Pending' && ev.rawStatus !== 'Chờ Manager duyệt';
      return (
        <div style={{ animation: 'fadeIn 0.2s ease' }}>
          <div className="glass-card" style={{ marginBottom: '20px', padding: '12px 20px' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setExpandedId(null)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}
            >
              <X size={16} /> Quay lại Duyệt Minh chứng
            </button>
          </div>
          <div className="glass-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="glass-card-header" style={{ marginBottom: '16px' }}>
              <h3 className="glass-card-title"><FileText size={18} style={{ marginRight: '6px' }} /> Chi tiết & Phê duyệt Minh chứng</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                {[
                  ['Sinh viên nộp', `${ev.userFullName} (${ev.userId})`],
                  ['Câu lạc bộ', ev.clubName],
                  ['Sự kiện', ev.eventName],
                  ['Loại minh chứng', ev.evidenceType],
                  ['Thời điểm nộp', new Date(ev.submittedAt).toLocaleString('vi-VN')],
                  ['Trạng thái', (() => {
                    if (ev.status === 'Pending') {
                      return isWaitingLeader ? (
                        <span className="badge badge-warning" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                          <Clock size={10} style={{ marginRight: '4px' }}/> Chờ Trưởng CLB duyệt trước
                        </span>
                      ) : (
                        <span className="badge badge-member"><Clock size={10} style={{ marginRight: '4px' }}/> Đã qua Leader (Sẵn sàng duyệt)</span>
                      );
                    }
                    if (ev.status === 'Approved') return <span className="badge badge-active"><CheckCircle size={10} style={{ marginRight: '4px' }}/> Đã duyệt</span>;
                    return <span className="badge badge-blocked"><X size={10} style={{ marginRight: '4px' }}/> Từ chối</span>;
                  })()]
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '10px' }}>
                    <span style={{ minWidth: '130px', fontSize: '13px', color: 'var(--text-muted)' }}>{label}</span>
                    <span style={{ fontSize: '14px', color: 'var(--text-main)', fontWeight: 500 }}>{value}</span>
                  </div>
                ))}
              </div>

              {ev.description && (
                <div style={{ fontSize: '14px', color: 'var(--text-main)', fontStyle: 'italic', background: 'rgba(0,0,0,0.15)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                  <strong style={{ color: 'var(--text-heading)', display: 'block', marginBottom: '8px', fontStyle: 'normal' }}>Mô tả của sinh viên:</strong>
                  {ev.description}
                </div>
              )}

              {ev.rejectReason && (
                <div style={{ padding: '16px', background: 'rgba(239,68,68,0.08)', borderRadius: '10px', fontSize: '14px', color: 'var(--text-main)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <strong style={{ color: 'var(--error)' }}>Lý do từ chối trước đó:</strong> {ev.rejectReason}
                </div>
              )}

              {ev.fileUrl && (
                <div style={{ textAlign: 'center', marginTop: '10px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>Hình ảnh minh chứng: (Click để xem kích thước lớn)</div>
                  <img
                    src={ev.fileUrl}
                    alt="Evidence"
                    style={{ width: '100%', maxHeight: '400px', objectFit: 'contain', borderRadius: '10px', border: '1px solid var(--border)', cursor: 'pointer', background: 'rgba(0,0,0,0.2)' }}
                    onClick={() => setPreviewUrl(ev.fileUrl)}
                  />
                </div>
              )}

              {isWaitingLeader && (
                <div style={{ fontSize: '14px', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(245,158,11,0.2)' }}>
                  ⚠️ Minh chứng này đang ở trạng thái <strong>"Đang chờ"</strong>. Trưởng CLB (Leader) phải bấm duyệt trước thì Manager mới có thể phê duyệt cấp cuối!
                </div>
              )}

              {ev.status === 'Pending' ? (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '10px' }}>
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Lý do từ chối (bắt buộc nếu từ chối):</label>
                    <textarea
                      className="textarea-field"
                      rows={3}
                      placeholder="Nhập lý do từ chối chi tiết..."
                      value={remarkMap[ev.id] || ''}
                      onChange={e => setRemarkMap(m => ({ ...m, [ev.id]: e.target.value }))}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button className="btn btn-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 24px' }} onClick={() => { handleApprove(ev); setExpandedId(null); }}>
                      <Check size={16} /> Phê duyệt
                    </button>
                    <button className="btn btn-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 24px' }} onClick={() => { handleReject(ev); setExpandedId(null); }}>
                      <X size={16} /> Từ chối
                    </button>
                    <button className="btn btn-secondary" style={{ padding: '10px 24px' }} onClick={() => setExpandedId(null)}>Đóng</button>
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
    <div className="evidence-approval-container">

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stats-card" onClick={() => setFilterStatus('Pending')} style={{ cursor: 'pointer' }}>
          <div className="stats-icon-box" style={{ color: 'var(--warning)' }}><AlertCircle size={20} /></div>
          <div className="stats-info">
            <span className="stats-label">Chờ duyệt</span>
            <span className="stats-value" style={{ color: pendingCount > 0 ? 'var(--warning)' : undefined }}>{pendingCount}</span>
          </div>
        </div>
        <div className="stats-card" onClick={() => setFilterStatus('Approved')} style={{ cursor: 'pointer' }}>
          <div className="stats-icon-box" style={{ color: 'var(--success)' }}><CheckCircle size={20} /></div>
          <div className="stats-info">
            <span className="stats-label">Đã duyệt</span>
            <span className="stats-value">{approvedCount}</span>
          </div>
        </div>
        <div className="stats-card" onClick={() => setFilterStatus('Rejected')} style={{ cursor: 'pointer' }}>
          <div className="stats-icon-box" style={{ color: 'var(--error)' }}><X size={20} /></div>
          <div className="stats-info">
            <span className="stats-label">Đã từ chối</span>
            <span className="stats-value">{rejectedCount}</span>
          </div>
        </div>
      </div>

      <div className="glass-card">
        <div className="glass-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="glass-card-title"><FileText size={18} /> Duyệt Chứng nhận Tham gia</h3>
          <button className="btn btn-secondary btn-sm" onClick={() => setFilterStatus('Pending')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} /> Làm mới
          </button>
        </div>

        <div className="search-filter-row">
          <div className="search-input-wrapper" style={{ flex: 1 }}>
            <Search className="search-icon" size={18} />
            <input type="text" className="input-field" placeholder="Tìm theo tên, MSSV, tên sự kiện..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <select className="select-field" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: '150px' }}>
            <option value="ALL">Tất cả</option>
            <option value="Pending">Chờ duyệt</option>
            <option value="Approved">Đã duyệt</option>
            <option value="Rejected">Từ chối</option>
          </select>
        </div>

        {loading ? (
          <div className="empty-state-view">
            <span className="login-spinner" style={{ width: '28px', height: '28px' }} />
            <p style={{ marginTop: '10px' }}>Đang tải danh sách minh chứng...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state-view">
            <FileText className="empty-state-icon" />
            <p>Không có chứng nhận nào phù hợp.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
            {filtered.map(ev => {
              return (
                <div key={ev.id} className="glass-card" style={{ padding: '16px', marginBottom: 0, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ flex: 1 }} onClick={() => setExpandedId(ev.id)} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-heading)', fontSize: '14px' }}>{ev.userFullName}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>({ev.userId})</span>
                        {ev.status === 'Pending' && (
                          !selectedClubId && ev.rawStatus !== 'Chờ Manager duyệt' ? (
                            <span className="badge badge-warning" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                              <Clock size={10} /> Chờ Leader duyệt trước
                            </span>
                          ) : (
                            <span className="badge badge-member"><Clock size={10} /> Chờ duyệt</span>
                          )
                        )}
                        {(ev.status === 'Approved' || ev.status === 'Hợp lệ' || ev.status === 'Đã duyệt') && <span className="badge badge-active"><CheckCircle size={10} /> Đã duyệt</span>}
                        {(ev.status === 'Rejected' || ev.status === 'Không hợp lệ' || ev.status === 'Đã từ chối') && <span className="badge badge-blocked"><X size={10} /> Từ chối</span>}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-main)', marginBottom: '4px' }}>
                        <strong>Sự kiện:</strong> {ev.eventName} · <strong>Loại:</strong> {ev.evidenceType}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Nộp lúc: {new Date(ev.submittedAt).toLocaleString('vi-VN')}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setExpandedId(ev.id)}>
                        {ev.status === 'Pending' ? 'Xem xét' : 'Chi tiết'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>


      {/* Image Preview Modal */}
      {previewUrl && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={() => setPreviewUrl(null)}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img src={previewUrl} alt="Preview" style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: '12px', objectFit: 'contain' }} />
            <button
              onClick={() => setPreviewUrl(null)}
              style={{ position: 'absolute', top: '-12px', right: '-12px', background: 'var(--error)', color: '#fff', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >×</button>
          </div>
        </div>
      )}
    </div>
  );
}
