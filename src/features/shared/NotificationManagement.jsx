import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Send, RefreshCw, Search, Clock, CheckCircle, Users, Megaphone, AlertCircle, Trash2 } from 'lucide-react';
import { createNotification, getNotifications } from '../../services/notificationService';
import { getClubs } from '../../services/clubService';
import { getUsers } from '../../services/userService';
import { validateNoSpecialChars } from '../../utils/validator';

export default function NotificationManagement({ triggerNotification }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Auxiliary data
  const [clubs, setClubs] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [notificationType, setNotificationType] = useState('Thông báo chung');
  const [targetType, setTargetType] = useState('Toàn hệ thống');
  const [targetRole, setTargetRole] = useState('');
  const [selectedClubId, setSelectedClubId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Validation errors
  const [errors, setErrors] = useState({});

  const parseDateSafely = useCallback((dateStr) => {
    if (!dateStr) return new Date(0);
    let str = String(dateStr);
    // Backend returns UTC timestamps without 'Z' suffix — append it so JS parses correctly
    if (str.includes('T') && !str.includes('Z') && !/[+-]\d{2}:?\d{2}$/.test(str)) {
      str += 'Z';
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? new Date(0) : d;
  }, []);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getNotifications();
      const list = Array.isArray(res) ? res : (res?.data ?? []);
      // Admin & Manager không thấy thông báo nội bộ CLB (có clubId)
      const systemOnly = list.filter(n => !n.clubId);
      systemOnly.sort((a, b) => parseDateSafely(b.createdAt || b.sentAt) - parseDateSafely(a.createdAt || a.sentAt));
      setNotifications(systemOnly);
    } catch (err) {
      console.error('[NotificationManagement] Lỗi tải thông báo:', err);
      triggerNotification('Không tải được danh sách thông báo!', 'error');
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [triggerNotification, parseDateSafely]);

  // Load auxiliary lists (clubs and users)
  const loadAuxData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [clubsRes, usersRes] = await Promise.all([
        getClubs().catch(() => ({ data: [] })),
        getUsers().catch(() => ({ data: [] }))
      ]);
      setClubs(Array.isArray(clubsRes) ? clubsRes : (clubsRes?.data ?? []));
      setUsers(Array.isArray(usersRes) ? usersRes : (usersRes?.data ?? []));
    } catch (err) {
      console.error('[NotificationManagement] Lỗi tải danh sách CLB/User:', err);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    loadAuxData();
  }, [loadNotifications, loadAuxData]);

  const handleSend = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!title.trim()) {
      newErrors.title = 'Vui lòng nhập tiêu đề thông báo!';
    } else if (!validateNoSpecialChars(title)) {
      newErrors.title = 'Tiêu đề không được chứa ký tự lạ!';
    }

    if (!content.trim()) {
      newErrors.content = 'Vui lòng nhập nội dung thông báo!';
    } else if (!validateNoSpecialChars(content)) {
      newErrors.content = 'Nội dung không được chứa ký tự lạ!';
    }

    // Role, Club, User validations based on Backend requirements
    if (targetType === 'Theo role' && !targetRole) {
      newErrors.targetRole = 'Vui lòng chọn vai trò cụ thể!';
    }
    if (targetType === 'Theo CLB' && !selectedClubId) {
      newErrors.selectedClubId = 'Vui lòng chọn câu lạc bộ!';
    }
    if (targetType === 'Cá nhân' && !selectedUserId) {
      newErrors.selectedUserId = 'Vui lòng chọn người nhận cụ thể!';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      triggerNotification('❌ Vui lòng sửa các lỗi nhập liệu bên dưới!', 'warning');
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    try {
      let mappedRole = null;
      if (targetType === 'Theo role') {
        mappedRole = targetRole || null;
      }

      let mappedType = notificationType;
      if (notificationType === 'General') mappedType = 'Thông báo chung';
      if (notificationType === 'System') mappedType = 'Hệ thống';
      if (notificationType === 'Event') mappedType = 'Sự kiện';
      if (notificationType === 'Report') mappedType = 'Báo cáo';

      const dto = {
        title: title.trim(),
        content: content.trim(),
        notificationType: mappedType,
        targetType: targetType,
        targetRole: mappedRole,
        clubId: targetType === 'Theo CLB' ? Number(selectedClubId) : null,
        targetUserIds: targetType === 'Cá nhân' ? [Number(selectedUserId)] : null
      };

      console.log('[NotificationManagement] Gửi DTO:', dto);
      await createNotification(dto);
      triggerNotification('✅ Đã gửi thông báo thành công!', 'success');
      setTitle('');
      setContent('');
      setNotificationType('Thông báo chung');
      setTargetType('Toàn hệ thống');
      setTargetRole('');
      setSelectedClubId('');
      setSelectedUserId('');
      await loadNotifications();
    } catch (err) {
      console.error('[NotificationManagement] Lỗi gửi thông báo:', err?.response || err);
      const beMsg = err?.response?.data?.message 
        || err?.response?.data?.title 
        || (typeof err?.response?.data === 'string' ? err.response.data : null)
        || `Lỗi ${err?.response?.status || ''}: Gửi thông báo thất bại!`;
      triggerNotification(beMsg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredList = notifications.filter(n => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (n.title || '').toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q);
  });

  return (
    <div className="notification-management-container">
      <div className="dashboard-grid-2col">

        {/* Left: Form gửi thông báo */}
        <div className="glass-card">
          <div className="glass-card-header">
            <h3 className="glass-card-title"><Megaphone size={18} /> Gửi Thông báo mới</h3>
          </div>

          <form onSubmit={handleSend} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Tiêu đề thông báo *</label>
              <input
                type="text"
                className="input-field"
                value={title}
                onChange={e => {
                  setTitle(e.target.value);
                  if (errors.title) setErrors(prev => ({ ...prev, title: null }));
                }}
                placeholder="Ví dụ: Thông báo kế hoạch học kỳ mới..."
              />
              {errors.title && <span style={{ fontSize: '11px', color: 'var(--error, #ef4444)', marginTop: '4px', display: 'block' }}>{errors.title}</span>}
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Nội dung *</label>
              <textarea
                className="textarea-field"
                value={content}
                onChange={e => {
                  setContent(e.target.value);
                  if (errors.content) setErrors(prev => ({ ...prev, content: null }));
                }}
                placeholder="Nhập nội dung thông báo chi tiết..."
                rows={5}
              />
              {errors.content && <span style={{ fontSize: '11px', color: 'var(--error, #ef4444)', marginTop: '4px', display: 'block' }}>{errors.content}</span>}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>Loại thông báo</label>
                <select className="select-field" value={notificationType} onChange={e => setNotificationType(e.target.value)}>
                  <option value="Thông báo chung">Thông báo chung</option>
                  <option value="Hệ thống">Hệ thống</option>
                  <option value="Sự kiện">Sự kiện</option>
                  <option value="Báo cáo">Báo cáo</option>
                </select>
              </div>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>Đối tượng nhận</label>
                <select className="select-field" value={targetType} onChange={e => { setTargetType(e.target.value); setTargetRole(''); }}>
                  <option value="Toàn hệ thống">Toàn hệ thống</option>
                  <option value="Theo role">Theo vai trò</option>
                  <option value="Theo CLB">Theo CLB</option>
                  <option value="Cá nhân">Cá nhân</option>
                </select>
              </div>
            </div>

             {targetType === 'Theo role' && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Vai trò cụ thể *</label>
                <select className="select-field" value={targetRole} onChange={e => {
                  setTargetRole(e.target.value);
                  if (errors.targetRole) setErrors(prev => ({ ...prev, targetRole: null }));
                }}>
                  <option value="">-- Chọn vai trò --</option>
                  <option value="ADMIN">Quản trị viên (ADMIN)</option>
                  <option value="MANAGER">Quản lý hệ thống (MANAGER)</option>
                  <option value="LEADER">Trưởng Câu lạc bộ (LEADER)</option>
                  <option value="MEMBER">Thành viên (MEMBER)</option>
                </select>
                {errors.targetRole && <span style={{ fontSize: '11px', color: 'var(--error, #ef4444)', marginTop: '4px', display: 'block' }}>{errors.targetRole}</span>}
              </div>
            )}

            {targetType === 'Theo CLB' && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Chọn Câu lạc bộ nhận thông báo *</label>
                <select className="select-field" value={selectedClubId} onChange={e => {
                  setSelectedClubId(e.target.value);
                  if (errors.selectedClubId) setErrors(prev => ({ ...prev, selectedClubId: null }));
                }}>
                  <option value="">-- Chọn câu lạc bộ --</option>
                  {clubs.map(c => (
                    <option key={c.id || c.clubId} value={c.id || c.clubId}>
                      {c.name || c.clubName} ({c.code || c.clubCode})
                    </option>
                  ))}
                </select>
                {errors.selectedClubId && <span style={{ fontSize: '11px', color: 'var(--error, #ef4444)', marginTop: '4px', display: 'block' }}>{errors.selectedClubId}</span>}
              </div>
            )}

            {targetType === 'Cá nhân' && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Chọn Người nhận cụ thể *</label>
                <select className="select-field" value={selectedUserId} onChange={e => {
                  setSelectedUserId(e.target.value);
                  if (errors.selectedUserId) setErrors(prev => ({ ...prev, selectedUserId: null }));
                }}>
                  <option value="">-- Chọn người dùng --</option>
                  {users.map(u => (
                    <option key={u.id || u.userId} value={u.id || u.userId}>
                      {u.fullName || u.username} - {u.email || u.studentId}
                    </option>
                  ))}
                </select>
                {errors.selectedUserId && <span style={{ fontSize: '11px', color: 'var(--error, #ef4444)', marginTop: '4px', display: 'block' }}>{errors.selectedUserId}</span>}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              {isSubmitting ? (
                <><span className="login-spinner" style={{ width: '14px', height: '14px' }} /> Đang gửi...</>
              ) : (
                <><Send size={16} /> Gửi thông báo</>
              )}
            </button>
          </form>
        </div>

        {/* Right: Lịch sử thông báo đã gửi */}
        <div className="glass-card" style={{ maxHeight: '700px', display: 'flex', flexDirection: 'column' }}>
          <div className="glass-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="glass-card-title"><Bell size={18} /> Lịch sử Thông báo ({filteredList.length})</h3>
            <button
              className="btn btn-secondary btn-sm"
              onClick={loadNotifications}
              disabled={loading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} /> Làm mới
            </button>
          </div>

          {/* Search */}
          <div style={{ marginBottom: '12px', position: 'relative' }}>
            <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={14} />
            <input
              type="text"
              className="input-field"
              placeholder="Tìm kiếm thông báo..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '36px', fontSize: '12px' }}
            />
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div className="empty-state-view">
                <span className="login-spinner" style={{ width: '24px', height: '24px' }} />
                <p style={{ marginTop: '8px' }}>Đang tải...</p>
              </div>
            ) : filteredList.length === 0 ? (
              <div className="empty-state-view">
                <Bell className="empty-state-icon" />
                <p>Chưa có thông báo nào.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filteredList.map(n => {
                  const nId = n.id || n.notificationId;
                  const sentAt = n.createdAt || n.sentAt;
                  const nType = n.notificationType || n.type || 'General';
                  return (
                    <div key={nId} style={{
                      padding: '12px 14px', borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'rgba(255,255,255,0.01)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                        <strong style={{ fontSize: '13px', color: 'var(--text-heading)' }}>
                          {n.title}
                        </strong>
                        <span className={`badge ${
                           nType === 'Hệ thống' || nType === 'System' ? 'badge-admin' : 
                           nType === 'Sự kiện' || nType === 'Event' ? 'badge-active' : 
                           nType === 'Báo cáo' || nType === 'Report' ? 'badge-blocked' : 
                           'badge-member'
                         }`}
                          style={{ fontSize: '10px', flexShrink: 0, marginLeft: '8px' }}>
                          {nType}
                        </span>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'pre-line', marginBottom: '6px', lineHeight: 1.5 }}>
                        {n.content}
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', opacity: 0.7 }}>
                        <span>
                          {n.targetType === 'Role' ? `→ ${n.targetRole}` : n.targetType === 'Club' ? `→ CLB #${n.clubId}` : '→ Tất cả'}
                        </span>
                        <span>{sentAt ? parseDateSafely(sentAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : ''}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
