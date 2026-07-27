import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, ArrowLeftRight, Bell, BellDot, Check, CheckCheck, X } from 'lucide-react';
import { getMyNotifications, markAsRead } from '../services/notificationService';

export default function Header({ 
  currentRole, 
  isLeader = false,
  selectedClubId,
  dbData, 
  pageTitle,
  triggerNotification,
  onSwitchClub
}) {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  // Notification bell state
  const [notifications, setNotifications] = useState([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const notifRef = useRef(null);

  const parseDateSafely = (dateStr) => {
    if (!dateStr) return new Date(0);
    let str = String(dateStr);
    // Backend returns UTC timestamps without 'Z' suffix — append it so JS parses correctly
    if (str.includes('T') && !str.includes('Z') && !/[+-]\d{2}:?\d{2}$/.test(str)) {
      str += 'Z';
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? new Date(0) : d;
  };

  const unreadCount = notifications.filter(n => !n.isRead && !n.readAt).length;

  // Load notifications from API
  const loadNotifications = async () => {
    setLoadingNotifs(true);
    try {
      const isAdminOrManager = currentRole === 'ADMIN' || currentRole === 'MANAGER';
      const res = await getMyNotifications(!isAdminOrManager ? selectedClubId : null);
      const list = Array.isArray(res) ? res : (res?.data ?? []);
      let filtered;
      if (isAdminOrManager) {
        // Admin & Manager KHÔNG thấy thông báo nội bộ CLB (có clubId)
        filtered = list.filter(n => !n.clubId);
      } else {
        // Member/Leader chỉ thấy: thông báo hệ thống (không có clubId)
        // HOẶC thông báo của đúng CLB họ đang chọn
        filtered = list.filter(n =>
          !n.clubId || String(n.clubId) === String(selectedClubId)
        );
      }
      filtered.sort((a, b) => parseDateSafely(b.createdAt || b.sentAt) - parseDateSafely(a.createdAt || a.sentAt));
      setNotifications(filtered);
    } catch (err) {
      console.error('[Header] Lỗi tải thông báo:', err);
    } finally {
      setLoadingNotifs(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadNotifications();
      // Auto-refresh every 60 seconds
      const interval = setInterval(loadNotifications, 60000);
      return () => clearInterval(interval);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, selectedClubId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkRead = async (notifId) => {
    try {
      await markAsRead(notifId);
      setNotifications(prev => prev.map(n =>
        (n.id || n.notificationId) === notifId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
      ));
    } catch (err) {
      console.error('[Header] Lỗi đánh dấu đã đọc:', err);
    }
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter(n => !n.isRead && !n.readAt);
    for (const n of unread) {
      try {
        await markAsRead(n.id || n.notificationId);
      } catch {}
    }
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() })));
    triggerNotification('Đã đánh dấu tất cả thông báo là đã đọc!', 'success');
  };

  const handleLogout = () => {
    sessionStorage.removeItem('fpt_selected_club');
    logout();
    navigate('/login');
  };

  // Get current club name for display
  const selectedClub = dbData?.clubs?.find(c => c.id === selectedClubId);

  return (
    <header className="top-header">
      <div className="page-title-section">
        <h2>{pageTitle}</h2>
        {/* Show current club chip for MEMBER only */}
        {currentRole === 'MEMBER' && selectedClub && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <img
              src={selectedClub.logo}
              alt={selectedClub.name}
              style={{ width: '18px', height: '18px', borderRadius: '4px', objectFit: 'cover' }}
            />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {selectedClub.name.split(' - ')[0]}
            </span>
          </div>
        )}
      </div>

      <div className="header-actions">
        {/* Switch club button for MEMBER only */}
        {currentRole === 'MEMBER' && onSwitchClub && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={onSwitchClub}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', fontSize: '12px' }}
            title="Đổi câu lạc bộ"
          >
            <ArrowLeftRight size={13} /> Đổi CLB
          </button>
        )}

        {/* 🔔 Notification Bell */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setShowNotifDropdown(prev => !prev);
              if (!showNotifDropdown) loadNotifications();
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', position: 'relative', padding: '6px 10px' }}
            title="Thông báo của tôi"
          >
            {unreadCount > 0 ? <BellDot size={16} style={{ color: 'var(--warning)' }} /> : <Bell size={16} />}
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: '-4px', right: '-4px',
                background: 'var(--danger, #ef4444)', color: '#fff', borderRadius: '50%',
                fontSize: '10px', width: '16px', height: '16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
                lineHeight: 1,
              }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </button>

          {/* Notification Dropdown */}
          {showNotifDropdown && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              width: '290px', maxHeight: '420px',
              background: '#121214', border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.65)',
              zIndex: 1000, overflow: 'hidden', display: 'flex', flexDirection: 'column',
            }}>
              {/* Header */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                background: '#16161a',
              }}>
                <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-heading)' }}>
                  🔔 Thông báo {unreadCount > 0 && <span style={{ color: 'var(--warning)', fontSize: '11px' }}>({unreadCount})</span>}
                </span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {unreadCount > 0 && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={handleMarkAllRead}
                      style={{ fontSize: '10px', padding: '3px 7px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      title="Đánh dấu tất cả đã đọc"
                    >
                      <CheckCheck size={11} /> Đọc hết
                    </button>
                  )}
                  <button
                    onClick={() => setShowNotifDropdown(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* List */}
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {loadingNotifs ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    <span className="login-spinner" style={{ width: '20px', height: '20px', display: 'inline-block' }} />
                    <div style={{ marginTop: '8px' }}>Đang tải thông báo...</div>
                  </div>
                ) : notifications.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    <Bell size={28} style={{ opacity: 0.3, display: 'block', margin: '0 auto 8px' }} />
                    Chưa có thông báo nào.
                  </div>
                ) : (
                  notifications.slice(0, 20).map(n => {
                    const nId = n.id || n.notificationId;
                    const isRead = n.isRead || !!n.readAt;
                    const sentAt = n.createdAt || n.sentAt;
                    return (
                      <div
                        key={nId}
                        style={{
                          padding: '12px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                          background: isRead ? 'transparent' : 'rgba(255, 255, 255, 0.04)',
                          display: 'flex', gap: '10px', alignItems: 'flex-start',
                          transition: 'background 0.2s',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                            <div style={{ fontWeight: isRead ? 400 : 700, fontSize: '13px', color: 'var(--text-heading)' }}>
                              {n.title}
                            </div>
                            {(n.notificationType || n.type) && (
                              <span className={`badge ${
                                (n.notificationType || n.type) === 'Hệ thống' || (n.notificationType || n.type) === 'System' ? 'badge-admin' : 
                                (n.notificationType || n.type) === 'Sự kiện' || (n.notificationType || n.type) === 'Event' ? 'badge-active' : 
                                (n.notificationType || n.type) === 'Báo cáo' || (n.notificationType || n.type) === 'Report' ? 'badge-blocked' : 
                                'badge-member'
                              }`} style={{ fontSize: '8px', padding: '1px 4px', scale: '0.9', transformOrigin: 'left', fontWeight: 600 }}>
                                {n.notificationType || n.type}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'pre-line', wordBreak: 'break-word', marginBottom: '4px' }}>
                            {n.content}
                          </div>
                          {sentAt && (
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', opacity: 0.7 }}>
                              {parseDateSafely(sentAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                            </div>
                          )}
                        </div>
                        {!isRead && (
                          <button
                            onClick={() => handleMarkRead(nId)}
                            title="Đánh dấu đã đọc"
                            style={{
                              background: 'rgba(var(--primary-rgb, 99,102,241),0.15)', border: 'none',
                              borderRadius: '50%', cursor: 'pointer', color: 'var(--primary)',
                              width: '22px', height: '22px', flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'background 0.2s',
                            }}
                          >
                            <Check size={12} />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Current user info + Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {currentUser && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)' }}>
                {currentUser.fullName || currentUser.username || currentUser.studentId || currentUser.id || ''}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                <span className={`badge ${currentRole === 'ADMIN' ? 'badge-admin' : currentRole === 'MANAGER' ? 'badge-manager' : isLeader ? 'badge-leader' : 'badge-member'}`}
                  style={{ fontSize: '10px', padding: '2px 6px' }}>
                  {currentRole === 'ADMIN' ? 'Quản trị viên' : currentRole === 'MANAGER' ? 'Quản lý hệ thống' : isLeader ? 'Trưởng CLB' : 'Thành viên'}
                </span>
              </div>
            </div>
          )}
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleLogout}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
            title="Đăng xuất"
          >
            <LogOut size={14} /> Đăng xuất
          </button>
        </div>
      </div>
    </header>
  );
}
