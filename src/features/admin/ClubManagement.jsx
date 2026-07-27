import React, { useState, useEffect, useCallback } from 'react';
import * as clubService from '../../services/clubService';
import apiClient from '../../utils/apiClient';
import { PlusCircle, Landmark, Image, Link, Tag, UserCheck, List, Info, RefreshCw, Edit2, Lock, Unlock, X, Save, Eye, Trash2, BarChart2 } from 'lucide-react';
import VietnameseDatePicker from '../../components/VietnameseDatePicker';

export default function ClubManagement({ triggerNotification }) {
  const [activeView, setActiveView] = useState('list');
  const [form, setForm] = useState({
    clubName: '',
    clubCode: '',
    description: '',
    fanpageUrl: '',
    logoImage: '',
    foundedDate: '',
    managerStudentId: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastCreated, setLastCreated] = useState(null);

    // Clubs từ API thật
  const [clubs, setClubs] = useState([]);
  const [loadingClubs, setLoadingClubs] = useState(false);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingClub, setEditingClub] = useState(null);
  const [editForm, setEditForm] = useState({
    clubName: '',
    clubCode: '',
    description: '',
    fanpageUrl: '',
    logoImage: '',
    foundedDate: '',
  });

  // Detail modal state
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [clubDetail, setClubDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [clubStats, setClubStats] = useState(null);

  // Dissolve confirm state
  const [dissolveConfirm, setDissolveConfirm] = useState(null); // club object or null
  const [dissolving, setDissolving] = useState(false);

  const loadClubs = useCallback(async () => {
    setLoadingClubs(true);
    try {
      const data = await clubService.getClubs();
      const list = Array.isArray(data) ? data : (data?.data ?? []);
      setClubs(list);
    } catch (err) {
      console.error('[ClubManagement] Lỗi tải CLB:', err);
      triggerNotification('Không tải được danh sách câu lạc bộ từ máy chủ!', 'error');
    } finally {
      setLoadingClubs(false);
    }
  }, [triggerNotification]);

  useEffect(() => {
    loadClubs();
  }, [loadClubs]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  // 1. Tạo CLB mới
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.clubName.trim()) {
      triggerNotification('❌ Vui lòng nhập Tên câu lạc bộ!', 'warning');
      return;
    }
    if (form.clubName.trim().length < 3) {
      triggerNotification('❌ Tên câu lạc bộ phải có ít nhất 3 ký tự!', 'warning');
      return;
    }
    if (form.clubCode && !/^[A-Z0-9_-]{2,10}$/i.test(form.clubCode.trim())) {
      triggerNotification('❌ Mã CLB chỉ gồm chữ, số, gạch dưới, dài 2–10 ký tự (ví dụ: MCC, FPT_CHESS)!', 'warning');
      return;
    }
    if (form.fanpageUrl && !/^https?:\/\//.test(form.fanpageUrl.trim())) {
      triggerNotification('❌ Đường dẫn Fanpage không hợp lệ, phải bắt đầu bằng http:// hoặc https://!', 'warning');
      return;
    }
    setIsSubmitting(true);
    try {
      await clubService.createClub({
        clubName: form.clubName.trim(),
        clubCode: form.clubCode?.trim() || null,
        description: form.description || null,
        fanpageUrl: form.fanpageUrl?.trim() || null,
        logoImage: null,
        foundedDate: form.foundedDate || null,
        managerStudentId: form.managerStudentId?.trim() || null,
      });
      triggerNotification(`✅ Đã tạo câu lạc bộ "${form.clubName}" thành công!`, 'success');
      setForm({ clubName: '', clubCode: '', description: '', fanpageUrl: '', logoImage: '', foundedDate: '', managerStudentId: '' });
      await loadClubs();
      setActiveView('list');
    } catch (err) {
      console.error('[ClubManagement] Lỗi tạo CLB:', err);
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.message || err?.response?.data?.title;
      if (status === 400) triggerNotification(`❌ Dữ liệu không hợp lệ: ${serverMsg || 'Kiểm tra lại thông tin!'}`, 'error');
      else if (status === 409) triggerNotification(`❌ Tên hoặc mã CLB đã tồn tại trong hệ thống!`, 'error');
      else if (status === 403) triggerNotification('❌ Bạn không có quyền tạo câu lạc bộ!', 'error');
      else triggerNotification(`❌ Tạo câu lạc bộ thất bại: ${serverMsg || 'Lỗi máy chủ!'}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Cập nhật thông tin CLB
  const handleEditClick = (club) => {
    setEditingClub(club);
    setEditForm({
      clubName: club.clubName || club.name || '',
      clubCode: club.clubCode || club.code || '',
      description: club.description || '',
      fanpageUrl: club.fanpageUrl || '',
      logoImage: '',
      foundedDate: club.foundedDate || '',
    });
    setShowEditModal(true);
  };

  const handleUpdateClub = async (e) => {
    e.preventDefault();
    if (!editForm.clubName.trim()) {
      triggerNotification('❌ Vui lòng nhập Tên câu lạc bộ!', 'warning');
      return;
    }
    if (editForm.clubName.trim().length < 3) {
      triggerNotification('❌ Tên câu lạc bộ phải có ít nhất 3 ký tự!', 'warning');
      return;
    }
    if (editForm.fanpageUrl && !/^https?:\/\//.test(editForm.fanpageUrl.trim())) {
      triggerNotification('❌ Đường dẫn Fanpage không hợp lệ, phải bắt đầu bằng http:// hoặc https://!', 'warning');
      return;
    }

    const cId = editingClub.id || editingClub.clubId;
    setIsSubmitting(true);
    try {
      await clubService.updateClub(cId, { ...editForm, logoImage: null });
      triggerNotification(`Cập nhật thông tin CLB "${editForm.clubName}" thành công!`, 'success');
      setShowEditModal(false);
      await loadClubs();
    } catch (err) {
      console.error('[ClubManagement] Lỗi cập nhật CLB:', err);
      triggerNotification(err?.response?.data?.message || 'Cập nhật CLB thất bại!', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Đổi trạng thái Đang hoạt động / Tạm dừng
  const handleToggleStatus = async (club) => {
    const cId = club.id || club.clubId;
    const isCurrentlyActive = club.status === 'Active' || club.status === 'Hoạt động' || club.status === 'Đang hoạt động' || club.status === 'active';
    const nextStatus = isCurrentlyActive ? 'Tạm dừng' : 'Đang hoạt động';

    try {
      await clubService.updateClubStatus(cId, nextStatus);
      triggerNotification(`Cập nhật trạng thái CLB sang: ${nextStatus}`, 'success');
      await loadClubs();
    } catch (err) {
      console.error('[ClubManagement] Lỗi đổi trạng thái CLB:', err);
      triggerNotification('Thay đổi trạng thái CLB thất bại!', 'error');
    }
  };

  // 4. Xem chi tiết CLB (bao gồm stats)
  const handleViewDetail = async (club) => {
    const cId = club.id || club.clubId;
    if (!cId) return;
    setShowDetailModal(true);
    setLoadingDetail(true);
    setClubDetail(null);
    setClubStats(null);
    try {
      const [detailRes, statsRes] = await Promise.allSettled([
        clubService.getClubDetail(cId),
        clubService.getClubStats(cId)
      ]);
      setClubDetail(detailRes.status === 'fulfilled' ? (detailRes.value?.data ?? detailRes.value) : club);
      setClubStats(statsRes.status === 'fulfilled' ? (statsRes.value?.data ?? statsRes.value) : null);
    } catch (err) {
      console.error('[ClubManagement] Lỗi tải chi tiết CLB:', err);
      setClubDetail(club);
    } finally {
      setLoadingDetail(false);
    }
  };

  // 5. Giải thể CLB (Soft Delete)
  const handleDissolve = async () => {
    if (!dissolveConfirm) return;
    const cId = dissolveConfirm.id || dissolveConfirm.clubId;
    const cName = dissolveConfirm.clubName || dissolveConfirm.name;
    setDissolving(true);
    try {
      await clubService.dissolveClub(cId);
      triggerNotification(`🏳️ Đã giải thể CLB "${cName}" thành công!`, 'success');
      setDissolveConfirm(null);
      await loadClubs();
    } catch (err) {
      console.error('[ClubManagement] Lỗi giải thể CLB:', err);
      triggerNotification(err?.response?.data?.message || 'Giải thể CLB thất bại!', 'error');
    } finally {
      setDissolving(false);
    }
  };

  // ── EDIT VIEW ──────────────────────────────────────────────────────────────
  if (showEditModal && editingClub) {
    return (
      <div style={{ animation: 'fadeIn 0.2s ease' }}>
        <div className="glass-card" style={{ marginBottom: '20px', padding: '12px 20px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowEditModal(false)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}
          >
            <X size={16} /> Quay lại Danh sách Sự kiện
          </button>
        </div>
        <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div className="glass-card-header" style={{ marginBottom: '16px' }}>
            <h3 className="glass-card-title"><Edit2 size={18} style={{ marginRight: '6px' }} /> Chỉnh sửa thông tin CLB</h3>
          </div>
          <form onSubmit={handleUpdateClub} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Tên Câu Lạc Bộ *</label>
              <input type="text" className="input-field" value={editForm.clubName} onChange={e => setEditForm({ ...editForm, clubName: e.target.value })} required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Mã CLB (Club Code)</label>
              <input type="text" className="input-field" value={editForm.clubCode} onChange={e => setEditForm({ ...editForm, clubCode: e.target.value })} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Link Fanpage Facebook</label>
              <input type="text" className="input-field" value={editForm.fanpageUrl} onChange={e => setEditForm({ ...editForm, fanpageUrl: e.target.value })} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Ngày thành lập (Ngày / Tháng / Năm)</label>
              <VietnameseDatePicker value={editForm.foundedDate} onChange={val => setEditForm({ ...editForm, foundedDate: val })} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Mô tả hoạt động CLB</label>
              <textarea className="textarea-field" rows={4} value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} disabled={isSubmitting}>
                <Save size={16} /> {isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
              <button type="button" className="btn btn-secondary" style={{ padding: '8px 20px' }} onClick={() => setShowEditModal(false)}>Hủy</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ── DETAIL VIEW ────────────────────────────────────────────────────────────
  if (showDetailModal) {
    return (
      <div style={{ animation: 'fadeIn 0.2s ease' }}>
        <div className="glass-card" style={{ marginBottom: '20px', padding: '12px 20px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => { setShowDetailModal(false); setClubDetail(null); setClubStats(null); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}
          >
            <X size={16} /> Quay lại Danh sách Sự kiện
          </button>
        </div>
        <div className="glass-card">
          <div className="glass-card-header" style={{ marginBottom: '16px' }}>
            <h3 className="glass-card-title"><Landmark size={18} style={{ marginRight: '6px' }} /> Chi tiết Câu lạc bộ</h3>
          </div>
          {loadingDetail ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div className="login-spinner" style={{ margin: '0 auto', width: '32px', height: '32px' }}></div>
              <p style={{ marginTop: '12px', color: 'var(--text-muted)' }}>Đang tải thông tin...</p>
            </div>
          ) : clubDetail ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '20px' }}>
                {clubDetail.logoImage ? (
                  <img src={clubDetail.logoImage} alt="Logo" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }} onError={e => { e.target.style.display = 'none'; }} />
                ) : (
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg,var(--primary),var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '32px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    {(clubDetail.clubName || clubDetail.name || 'C').charAt(0)}
                  </div>
                )}
                <div>
                  <h4 style={{ fontSize: '22px', color: 'var(--text-heading)', fontWeight: 700, margin: '0 0 6px 0' }}>{clubDetail.clubName || clubDetail.name}</h4>
                  <span className="badge" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', display: 'inline-block', fontSize: '13px' }}>
                    Mã CLB: <strong style={{ color: 'var(--text-main)' }}>{clubDetail.clubCode || clubDetail.code || 'N/A'}</strong>
                  </span>
                </div>
              </div>

              {/* Club Stats */}
              {clubStats && (
                <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '20px' }}>
                  <div style={{ fontSize: '14px', color: 'var(--text-heading)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                    <BarChart2 size={16} /> Thống kê hoạt động
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                    {[
                      ['Thành viên', clubStats.totalMembers ?? clubStats.memberCount ?? '—'],
                      ['Sự kiện đã duyệt', clubStats.approvedEvents ?? clubStats.totalApprovedEvents ?? '—'],
                      ['Sự kiện chờ duyệt', clubStats.pendingEvents ?? clubStats.totalPendingEvents ?? '—'],
                      ['Minh chứng chờ duyệt', clubStats.pendingEvidences ?? clubStats.totalPendingEvidences ?? '—'],
                    ].map(([label, val]) => (
                      <div key={label} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '10px', padding: '16px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{label}</div>
                        <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-heading)', marginTop: '4px' }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {[
                  ['Ngày thành lập', clubDetail.foundedDate ? new Date(clubDetail.foundedDate).toLocaleDateString('vi-VN') : 'N/A'],
                  ['Người quản lý (Student ID)', clubDetail.managerStudentId || clubDetail.leaderStudentId || clubDetail.managerUserId || clubDetail.leaderUserId || 'N/A'],
                  ['Fanpage Facebook', clubDetail.fanpageUrl ? <a href={clubDetail.fanpageUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>{clubDetail.fanpageUrl}</a> : 'N/A'],
                  ['Trạng thái', (() => {
                    const isDetailActive = clubDetail.status === 'Active' || clubDetail.status === 'Hoạt động' || clubDetail.status === 'Đang hoạt động' || clubDetail.status === 'active';
                    return <span className={`badge ${isDetailActive ? 'badge-active' : 'badge-blocked'}`}>{isDetailActive ? 'Đang hoạt động' : 'Tạm dừng'}</span>;
                  })()],
                  ['Mô tả hoạt động', clubDetail.description || 'Không có mô tả chi tiết']
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', gap: '16px', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '12px' }}>
                    <span style={{ minWidth: '180px', fontSize: '13px', color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
                    <span style={{ fontSize: '14px', color: 'var(--text-main)', wordBreak: 'break-all' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>Không tải được thông tin câu lạc bộ.</p>
          )}
        </div>
      </div>
    );
  }

  // ── DISSOLVE CONFIRM VIEW ──────────────────────────────────────────────────
  if (dissolveConfirm) {
    return (
      <div style={{ animation: 'fadeIn 0.2s ease' }}>
        <div className="glass-card" style={{ marginBottom: '20px', padding: '12px 20px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setDissolveConfirm(null)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}
          >
            <X size={16} /> Quay lại Danh sách Sự kiện
          </button>
        </div>
        <div className="glass-card" style={{ maxWidth: '500px', margin: '0 auto' }}>
          <div className="glass-card-header" style={{ marginBottom: '16px' }}>
            <h3 className="glass-card-title" style={{ color: 'var(--error)' }}><Trash2 size={18} style={{ marginRight: '6px' }} /> Xác nhận Giải thể Câu lạc bộ</h3>
          </div>
          <div style={{ padding: '10px 0' }}>
            <p style={{ color: 'var(--text-main)', marginBottom: '12px', fontSize: '14px' }}>
              Bạn có chắc chắn muốn <strong style={{ color: 'var(--error)' }}>giải thể</strong> câu lạc bộ:
            </p>
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '16px', marginBottom: '20px', textAlign: 'center' }}>
              <strong style={{ color: 'var(--text-heading)', fontSize: '16px' }}>{dissolveConfirm.clubName || dissolveConfirm.name}</strong>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.6 }}>
              ⚠️ Thao tác này sẽ đổi trạng thái CLB sang <strong>"Giải thể"</strong>. Toàn bộ lịch sử dữ liệu vẫn được giữ lại, tuy nhiên người dùng sẽ không thể thao tác thêm với CLB này. Hành động này không thể hoàn tác sau khi xác nhận.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className="btn btn-danger"
                style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px' }}
                onClick={handleDissolve}
                disabled={dissolving}
              >
                <Trash2 size={16} /> {dissolving ? 'Đang xử lý...' : 'Đồng ý Giải thể'}
              </button>
              <button className="btn btn-secondary" style={{ flex: 1, padding: '10px' }} onClick={() => setDissolveConfirm(null)} disabled={dissolving}>Không, quay lại</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* View Switcher */}
      <div className="glass-card" style={{ marginBottom: '24px', padding: '6px' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            className={`role-switch-btn ${activeView === 'list' ? 'active' : ''}`}
            onClick={() => setActiveView('list')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flex: 1, justifyContent: 'center' }}
          >
            <List size={14} /> Danh sách CLB
          </button>
          <button
            className={`role-switch-btn ${activeView === 'create' ? 'active' : ''}`}
            onClick={() => setActiveView('create')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flex: 1, justifyContent: 'center' }}
          >
            <PlusCircle size={14} /> Tạo CLB mới
          </button>
        </div>
      </div>

      {/* List View */}
      {activeView === 'list' && (
        <div className="glass-card">
          <div className="glass-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="glass-card-title"><Landmark size={18} /> Danh sách Câu lạc bộ</h3>
            <button
              className="btn btn-secondary btn-sm"
              onClick={loadClubs}
              disabled={loadingClubs}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} className={loadingClubs ? 'spin' : ''} /> Làm mới
            </button>
          </div>

          {loadingClubs ? (
            <div className="empty-state-view">
              <span className="login-spinner" style={{ width: '28px', height: '28px' }} />
            </div>
          ) : clubs.length === 0 ? (
            <div className="empty-state-view">
              <Landmark className="empty-state-icon" />
              <p>Chưa có câu lạc bộ nào trong hệ thống.</p>
              <button className="btn btn-primary" style={{ marginTop: '12px' }} onClick={() => setActiveView('create')}>
                <PlusCircle size={14} /> Tạo CLB đầu tiên
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Tên CLB</th>
                    <th>Mã CLB</th>
                    <th>Ngày tạo</th>
                    <th>Trạng thái</th>
                    <th style={{ textAlign: 'center' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {clubs.map(club => {
                    const cId = club.id || club.clubId;
                    const cName = club.clubName || club.name;
                    const cCode = club.clubCode || club.code;
                    const status = club.status || 'Đang hoạt động';
                    const isDissolvedClub = status === 'Đã giải thể' || status === 'Giải thể' || status === 'Dissolved' || status === 'dissolved';
                    const isSuspendedClub = !isDissolvedClub && (status === 'Tạm dừng' || status === 'Suspended' || status === 'suspended');
                    const isActiveClub = !isDissolvedClub && !isSuspendedClub;
                    return (
                      <tr key={cId}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {club.logoImage ? (
                              <img src={club.logoImage} alt={cName} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', filter: isDissolvedClub ? 'grayscale(80%)' : 'none' }} onError={e => { e.target.style.display = 'none'; }} />
                            ) : (
                              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: isDissolvedClub ? 'rgba(100,100,100,0.3)' : 'linear-gradient(135deg,var(--primary),var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '13px', flexShrink: 0 }}>
                                {(cName || 'C').charAt(0)}
                              </div>
                            )}
                            <div>
                              <div style={{ fontWeight: 600, color: isDissolvedClub ? 'var(--text-muted)' : 'var(--text-heading)' }}>{cName}</div>
                              {club.description && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{club.description.substring(0, 60)}...</div>}
                            </div>
                          </div>
                        </td>
                        <td>{cCode && <span className="badge" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)' }}>{cCode}</span>}</td>
                        <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {club.createdAt ? new Date(club.createdAt).toLocaleDateString('vi-VN') : '—'}
                        </td>
                        <td>
                          {isDissolvedClub ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.35)' }}>
                              ✕ Đã giải thể
                            </span>
                          ) : isSuspendedClub ? (
                            <span className="badge badge-blocked">⏸ Tạm dừng</span>
                          ) : (
                            <span className="badge badge-active">● Đang hoạt động</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              title="Xem chi tiết CLB"
                              onClick={() => handleViewDetail(club)}
                              style={{ padding: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Eye size={12} /> Chi tiết
                            </button>
                            {!isDissolvedClub && (
                              <button
                                className="btn btn-secondary btn-sm"
                                title={isActiveClub ? 'Tạm dừng hoạt động' : 'Kích hoạt trở lại'}
                                onClick={() => handleToggleStatus(club)}
                                style={{ padding: '6px' }}
                              >
                                {isActiveClub ? <Lock size={12} style={{ color: 'var(--error)' }} /> : <Unlock size={12} style={{ color: 'var(--success)' }} />}
                              </button>
                            )}
                            {!isDissolvedClub && (
                              <button
                                className="btn btn-danger btn-sm"
                                title="Giải thể CLB"
                                onClick={() => setDissolveConfirm(club)}
                                style={{ padding: '6px' }}
                              >
                                <Trash2 size={12} />
                              </button>
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
      )}

      {/* Create View */}
      {activeView === 'create' && (
        <div className="dashboard-grid-2col">
          {/* Left: Create Form */}
          <div className="glass-card">
            <div className="glass-card-header">
              <h3 className="glass-card-title"><PlusCircle size={18} /> Tạo Câu lạc bộ mới</h3>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label><Landmark size={14} /> Tên Câu Lạc Bộ <span style={{ color: 'var(--error)' }}>*</span></label>
                <input type="text" className="input-field" placeholder="Ví dụ: FPT Guitar Club" value={form.clubName} onChange={e => handleChange('clubName', e.target.value)} required />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label><Tag size={14} /> Mã CLB (Club Code)</label>
                <input type="text" className="input-field" placeholder="Ví dụ: GUITAR" value={form.clubCode} onChange={e => handleChange('clubCode', e.target.value)} />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label><Link size={14} /> Link Fanpage Facebook</label>
                <input type="text" className="input-field" placeholder="https://facebook.com/club..." value={form.fanpageUrl} onChange={e => handleChange('fanpageUrl', e.target.value)} />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Ngày thành lập (Ngày / Tháng / Năm)</label>
                <VietnameseDatePicker value={form.foundedDate} onChange={val => handleChange('foundedDate', val)} />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label><UserCheck size={14} /> MSSV Người quản lý (Student ID)</label>
                <input type="text" className="input-field" placeholder="Ví dụ: se180001" value={form.managerStudentId} onChange={e => handleChange('managerStudentId', e.target.value)} />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>Nhập username của người sẽ được bổ nhiệm làm quản lý CLB.</span>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Mô tả / Giới thiệu CLB</label>
                <textarea className="textarea-field" rows={4} placeholder="Giới thiệu ngắn về tôn chỉ hoạt động, mục tiêu của CLB..." value={form.description} onChange={e => handleChange('description', e.target.value)} />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  {isSubmitting ? <span className="login-spinner" /> : <><PlusCircle size={16} /> Tạo Câu lạc bộ</>}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setActiveView('list')}>Hủy</button>
              </div>
            </form>
          </div>

          {/* Right: Info Panel */}
          <div className="glass-card" style={{ height: 'fit-content' }}>
            <div className="glass-card-header">
              <h3 className="glass-card-title"><Landmark size={18} /> Hướng dẫn tạo CLB</h3>
            </div>
            <div style={{ fontSize: '13px', lineHeight: 1.7, color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p>Điền đầy đủ thông tin bên trái để đăng ký một câu lạc bộ mới vào hệ thống.</p>
              <ul style={{ paddingLeft: '16px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <li><strong>Tên CLB</strong> là trường bắt buộc.</li>
                <li><strong>Mã CLB</strong> dùng để định danh ngắn (vd: GUITAR, FCODE).</li>
                <li><strong>MSSV Người quản lý</strong>: nếu để trống, CLB sẽ chưa có quản lý.</li>
              </ul>

              {lastCreated && (
                <div style={{ marginTop: '8px', padding: '16px', background: 'rgba(34,197,94,0.08)', borderRadius: '10px', border: '1px solid rgba(34,197,94,0.25)' }}>
                  <div style={{ fontWeight: 700, color: 'var(--success)', marginBottom: '6px' }}>✓ CLB vừa tạo thành công</div>
                  <div style={{ fontSize: '14px', color: 'var(--text-heading)' }}>{lastCreated.clubName}</div>
                  {lastCreated.id && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>ID: <strong>{lastCreated.id}</strong></div>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
