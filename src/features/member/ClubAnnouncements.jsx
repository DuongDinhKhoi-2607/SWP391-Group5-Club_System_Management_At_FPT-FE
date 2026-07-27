import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Bell, Megaphone, Search, User, Clock, Send, RefreshCw } from 'lucide-react';
import { createNotification, getMyNotifications } from '../../services/notificationService';

/**
 * ClubAnnouncements
 * - Lấy danh sách thông báo: GET /api/notifications/my (thông báo của tôi)
 * - Tạo thông báo mới (Leader): POST /api/notifications
 */
export default function ClubAnnouncements({ selectedClubId, triggerNotification, isLeader }) {
  const { currentUser } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [importance, setImportance] = useState('Normal');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parseDateSafely = useCallback((dateStr) => {
    if (!dateStr) return new Date(0);
    let str = String(dateStr);
    if (str.includes('T') && !str.includes('Z') && !/\+\d{2}(:\d{2})?$/.test(str) && !/-\d{2}(:\d{2})?$/.test(str)) {
      str += 'Z';
    }
    return new Date(str);
  }, []);

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyNotifications(selectedClubId);
      const list = Array.isArray(data) ? data : (data?.data ?? []);
      // Lọc thông báo theo CLB hiện tại hoặc thông báo hệ thống (không có clubId)
      const filtered = list.filter(n =>
        !n.clubId || String(n.clubId) === String(selectedClubId)
      );
      filtered.sort((a, b) => parseDateSafely(b.createdAt || b.sentAt) - parseDateSafely(a.createdAt || a.sentAt));
      setAnnouncements(filtered);
    } catch (err) {
      console.error('[ClubAnnouncements] Lỗi tải thông báo:', err);
      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  }, [selectedClubId, parseDateSafely]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      triggerNotification('Vui lòng nhập đầy đủ tiêu đề và nội dung!', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      await createNotification({
        title: title.trim(),
        content: content.trim(),
        notificationType: 'Thông báo chung',
        targetType: 'Theo CLB',
        targetRole: null,
        clubId: selectedClubId ? Number(selectedClubId) : null,
        targetUserIds: null,
        eventId: null,
        clubReportId: null,
        reportPeriodId: null,
      });

      triggerNotification('✅ Phát hành thông báo CLB thành công!', 'success');
      setTitle('');
      setContent('');
      setImportance('Normal');
      await loadAnnouncements();
    } catch (err) {
      console.error('[ClubAnnouncements] Lỗi đăng thông báo:', err);
      const serverMsg = err?.response?.data?.message || err?.response?.data?.title || err?.response?.data || err?.message || 'Đăng thông báo thất bại!';
      const displayMsg = typeof serverMsg === 'object' ? JSON.stringify(serverMsg) : String(serverMsg);
      triggerNotification(`Đăng thông báo thất bại: ${displayMsg.substring(0, 120)}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredList = announcements.filter(ann => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (ann.title || '').toLowerCase().includes(q) || (ann.content || '').toLowerCase().includes(q);
  });

  return (
    <div className="club-announcements-container">

      {/* 1. Leader-only Announcement Creator */}
      {isLeader && (
        <div className="glass-card" style={{ marginBottom: '28px' }}>
          <div className="glass-card-header">
            <h3 className="glass-card-title">
              <Megaphone size={18} style={{ color: 'var(--primary)' }} /> Phát hành Thông báo CLB
            </h3>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '18px' }}>
            Đăng tin tức, lịch họp hoặc nhắc nhở công việc tới toàn thể thành viên trong câu lạc bộ.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-row">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Tiêu đề thông báo *</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Nhập tiêu đề ngắn gọn..."
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Độ quan trọng</label>
                <select
                  className="select-field"
                  value={importance}
                  onChange={e => setImportance(e.target.value)}
                >
                  <option value="Normal">Thường</option>
                  <option value="High">Quan trọng 🚨</option>
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Nội dung thông báo *</label>
              <textarea
                className="textarea-field"
                placeholder="Nhập nội dung chi tiết gửi tới thành viên..."
                rows={4}
                value={content}
                onChange={e => setContent(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
                style={{ minWidth: '160px' }}
              >
                {isSubmitting ? (
                  <span className="login-spinner" />
                ) : (
                  <><Send size={15} /> Đăng thông báo</>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2. Search & Announcements List */}
      <div className="glass-card">
        <div className="glass-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="glass-card-title"><Bell size={18} /> Bảng tin Thông báo</h3>
          <button className="btn btn-secondary btn-sm" onClick={loadAnnouncements} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={13} /> Làm mới
          </button>
        </div>

        <div className="search-filter-row" style={{ marginTop: '16px' }}>
          <div className="search-input-wrapper" style={{ flex: 1 }}>
            <Search className="search-icon" size={18} />
            <input
              type="text"
              className="input-field"
              placeholder="Tìm kiếm thông báo..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="empty-state-view">
            <span className="login-spinner" style={{ width: '28px', height: '28px' }} />
          </div>
        ) : filteredList.length === 0 ? (
          <div className="empty-state-view" style={{ padding: '40px 0' }}>
            <Bell className="empty-state-icon" style={{ opacity: 0.3 }} />
            <p>Không có thông báo nào được tìm thấy.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '18px' }}>
            {filteredList.map((ann, idx) => {
              const isSystem = !ann.clubId;
              const isHighImportance = ann.notificationType === 'Important' || ann.importance === 'High';
              const ts = ann.createdAt || ann.sentAt;
              return (
                <div
                  key={ann.notificationId || ann.id || idx}
                  className="glass-card"
                  style={{
                    padding: '18px',
                    marginBottom: 0,
                    borderLeft: isSystem
                      ? '4px solid #a855f7'
                      : isHighImportance
                      ? '4px solid var(--error)'
                      : '4px solid var(--primary)',
                    background: 'rgba(255, 255, 255, 0.01)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-heading)', margin: 0 }}>
                          {ann.title}
                        </h4>
                        {isSystem ? (
                          <span className="badge badge-admin" style={{ fontSize: '9px' }}>HỆ THỐNG</span>
                        ) : (
                          <span className="badge badge-member" style={{ fontSize: '9px' }}>NỘI BỘ CLB</span>
                        )}
                        {isHighImportance && (
                          <span className="badge badge-blocked" style={{ fontSize: '9px', fontWeight: 700 }}>QUAN TRỌNG</span>
                        )}
                      </div>

                      <p style={{ fontSize: '13px', color: 'var(--text-main)', margin: '10px 0', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                        {ann.content}
                      </p>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '11px', color: 'var(--text-muted)', marginTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.03)', paddingTop: '8px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <User size={12} /> {ann.senderName || ann.authorName || 'Hệ thống'}
                        </span>
                        {ts && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={12} /> {parseDateSafely(ts).toLocaleString('vi-VN')}
                          </span>
                        )}
                      </div>
                    </div>
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
