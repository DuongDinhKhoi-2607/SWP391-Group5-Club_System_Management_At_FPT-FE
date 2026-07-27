import React, { useState, useEffect, useCallback } from 'react';
import { Search, ShieldAlert, GraduationCap, RefreshCw, UserPlus, Lock, Unlock, X, Eye } from 'lucide-react';
import * as userService from '../../services/userService';
import { validateNoSpecialChars } from '../../utils/validator';

export default function UserManagement({ triggerNotification }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState('staff');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    username: '',
    fullName: '',
    email: '',
    password: '',
    role: 'MANAGER'
  });
  
  // Validation errors
  const [formErrors, setFormErrors] = useState({});

  // User detail modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [userDetail, setUserDetail] = useState(null);
  const [activityHistory, setActivityHistory] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Load users
  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await userService.getUsers();
      const list = Array.isArray(data) ? data : (data?.data ?? []);
      setUsers(list);
    } catch (err) {
      console.error('[UserManagement] Lỗi tải users từ Backend:', err);
      triggerNotification('Không tải được danh sách người dùng từ máy chủ!', 'error');
    } finally {
      setLoading(false);
    }
  }, [triggerNotification]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // 1. Tạo tài khoản cán bộ (ADMIN / MANAGER)
  const handleCreateUser = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!createForm.username.trim()) {
      newErrors.username = 'Vui lòng nhập Tên đăng nhập!';
    } else if (!validateNoSpecialChars(createForm.username)) {
      newErrors.username = 'Username không được chứa ký tự lạ!';
    }

    if (!createForm.password) {
      newErrors.password = 'Vui lòng nhập Mật khẩu khởi tạo!';
    } else if (createForm.password.length < 6) {
      newErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự!';
    }

    if (Object.keys(newErrors).length > 0) {
      setFormErrors(newErrors);
      triggerNotification('❌ Vui lòng sửa các lỗi nhập liệu bên dưới!', 'warning');
      return;
    }

    setFormErrors({});
    try {
      await userService.createStaff({
        username: createForm.username.trim(),
        password: createForm.password,
        systemRole: createForm.role
      });
      triggerNotification(`✅ Đã tạo thành công tài khoản cán bộ: ${createForm.username}`, 'success');
      setShowCreateModal(false);
      setCreateForm({ username: '', fullName: '', email: '', password: '', role: 'MANAGER' });
      await loadUsers();
    } catch (err) {
      console.error('[UserManagement] Lỗi tạo user:', err);
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.message || err?.response?.data?.title;
      if (status === 400) triggerNotification(`❌ Dữ liệu không hợp lệ: ${serverMsg || 'Tên đăng nhập có thể đã tồn tại!'}`, 'error');
      else if (status === 403) triggerNotification('❌ Bạn không có quyền tạo tài khoản!', 'error');
      else if (status === 409) triggerNotification(`❌ Tên đăng nhập “${createForm.username}” đã tồn tại trong hệ thống!`, 'error');
      else triggerNotification(`❌ Tạo tài khoản thất bại: ${serverMsg || 'Lỗi máy chủ, vui lòng thử lại!'}`, 'error');
    }
  };

  // 2. Khóa / Mở khóa user
  const handleToggleStatus = async (user) => {
    const uid = user.userId || user.id || user.studentId || user.username;
    const currentStatus = user.status || 'Active';
    const nextStatus = currentStatus === 'Active' ? 'Blocked' : 'Active';
    try {
      if (nextStatus === 'Blocked') {
        await userService.blockUser(uid);
      } else {
        await userService.unblockUser(uid);
      }
      triggerNotification(`Đã cập nhật trạng thái sang: ${nextStatus === 'Active' ? 'Hoạt động' : 'Bị khóa'}`, 'success');
      await loadUsers();
    } catch (err) {
      console.error('[UserManagement] Lỗi cập nhật trạng thái:', err);
      triggerNotification(err?.response?.data?.message || 'Cập nhật trạng thái thất bại!', 'error');
    }
  };

  const handleViewDetail = async (user) => {
    const uid = user.userId || user.id;
    if (!uid) return;
    setShowDetailModal(true);
    setLoadingDetail(true);
    setUserDetail(null);
    setActivityHistory([]);
    try {
      const data = await userService.getUserDetail(uid);
      setUserDetail(data?.data ?? data);
      
      try {
        const historyData = await userService.getUserActivityHistory(uid);
        setActivityHistory(Array.isArray(historyData) ? historyData : (historyData?.data ?? []));
      } catch (histErr) {
        console.error('[UserManagement] Lỗi tải lịch sử hoạt động:', histErr);
        setActivityHistory([]);
      }
    } catch (err) {
      setUserDetail(user);
    } finally {
      setLoadingDetail(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      (user.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.studentId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.schoolEmail || user.email || '').toLowerCase().includes(searchQuery.toLowerCase());

    const role = (user.role || user.systemRole || '').toUpperCase();
    if (activeView === 'student') {
      return matchesSearch && (role === 'MEMBER' || role === 'STUDENT');
    }
    return matchesSearch && (role === 'ADMIN' || role === 'MANAGER');
  });

  // ── CREATE STAFF VIEW ──────────────────────────────────────────────────────
  if (showCreateModal) {
    return (
      <div style={{ animation: 'fadeIn 0.2s ease' }}>
        <div className="glass-card" style={{ marginBottom: '20px', padding: '12px 20px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowCreateModal(false)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}
          >
            <X size={16} /> Quay lại Quản lý Người dùng
          </button>
        </div>
        <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div className="glass-card-header" style={{ marginBottom: '16px' }}>
            <h3 className="glass-card-title"><UserPlus size={18} style={{ marginRight: '6px' }} /> Thêm Tài khoản Cán bộ</h3>
          </div>
          <form onSubmit={handleCreateUser} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Username *</label>
              <input
                type="text"
                className="input-field"
                value={createForm.username}
                onChange={e => {
                  setCreateForm({ ...createForm, username: e.target.value });
                  if (formErrors.username) setFormErrors(prev => ({ ...prev, username: null }));
                }}
                placeholder="Ví dụ: manager02"
              />
              {formErrors.username && <span style={{ fontSize: '12px', color: 'var(--error, #ef4444)', marginTop: '4px', display: 'block', fontWeight: 500 }}>{formErrors.username}</span>}
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Mật khẩu khởi tạo *</label>
              <input
                type="password"
                className="input-field"
                value={createForm.password}
                onChange={e => {
                  setCreateForm({ ...createForm, password: e.target.value });
                  if (formErrors.password) setFormErrors(prev => ({ ...prev, password: null }));
                }}
                placeholder="Nhập mật khẩu..."
              />
              {formErrors.password && <span style={{ fontSize: '12px', color: 'var(--error, #ef4444)', marginTop: '4px', display: 'block', fontWeight: 500 }}>{formErrors.password}</span>}
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Vai trò hệ thống</label>
              <select
                className="select-field"
                value={createForm.role}
                onChange={e => setCreateForm({ ...createForm, role: e.target.value })}
              >
                <option value="MANAGER">MANAGER (Quản lý cấp trường)</option>
                <option value="ADMIN">ADMIN (Quản trị hệ thống)</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '10px' }}>Tạo tài khoản</button>
              <button type="button" className="btn btn-secondary" style={{ padding: '10px 20px' }} onClick={() => setShowCreateModal(false)}>Hủy</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ── USER DETAIL VIEW ───────────────────────────────────────────────────────
  if (showDetailModal) {
    return (
      <div style={{ animation: 'fadeIn 0.2s ease' }}>
        <div className="glass-card" style={{ marginBottom: '20px', padding: '12px 20px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => { setShowDetailModal(false); setUserDetail(null); setActivityHistory([]); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}
          >
            <X size={16} /> Quay lại Quản lý Người dùng
          </button>
        </div>
        <div className="glass-card">
          <div className="glass-card-header" style={{ marginBottom: '16px' }}>
            <h3 className="glass-card-title"><Eye size={18} style={{ marginRight: '6px' }} /> Chi tiết Người dùng & Lịch sử</h3>
          </div>
          {loadingDetail ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div className="login-spinner" style={{ margin: '0 auto', width: '32px', height: '32px' }}></div>
              <p style={{ marginTop: '12px', color: 'var(--text-muted)' }}>Đang tải thông tin...</p>
            </div>
          ) : userDetail ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ fontSize: '15px', color: 'var(--text-heading)', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '4px' }}>Thông tin cơ bản</h4>
                {[
                  ['Username', userDetail.username || 'N/A'],
                  ['Họ & Tên', userDetail.fullName || userDetail.name || 'N/A'],
                  ['Email', userDetail.schoolEmail || userDetail.email || 'N/A'],
                  ['Vai trò', (userDetail.role || userDetail.systemRole || 'N/A').toUpperCase()],
                  ['Trạng thái', userDetail.status === 'Active' ? 'Hoạt động' : userDetail.status || 'N/A'],
                  ['MSSV', userDetail.studentId || 'N/A'],
                  ['Khóa', userDetail.cohort || 'N/A'],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', gap: '16px', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '10px' }}>
                    <span style={{ minWidth: '100px', fontSize: '13px', color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
                    <span style={{ fontSize: '14px', color: 'var(--text-main)', wordBreak: 'break-all', fontWeight: 500 }}>
                      {label === 'Trạng thái' ? (
                        <span className={`badge ${value === 'Hoạt động' ? 'badge-active' : 'badge-blocked'}`}>{value}</span>
                      ) : value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Activity History Timeline */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(0,0,0,0.1)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <h4 style={{ fontSize: '15px', color: 'var(--text-heading)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📅 Lịch sử Hoạt động <span className="badge" style={{ fontSize: '11px' }}>{activityHistory.length}</span>
                </h4>
                {activityHistory.length === 0 ? (
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', textAlign: 'center' }}>
                    Chưa ghi nhận hoạt động hoặc lịch sử rỗng.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto', paddingRight: '8px', paddingBottom: '8px' }} className="custom-scrollbar">
                    {activityHistory.map((act, index) => (
                      <div key={act.id || index} style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', color: 'var(--text-heading)', fontWeight: 600, gap: '12px' }}>
                          <span style={{ fontSize: '13px' }}>{act.activityName || act.title || 'Hoạt động'}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>
                            {act.timestamp ? new Date(act.timestamp).toLocaleString('vi-VN') : ''}
                          </span>
                        </div>
                        {act.description && <div style={{ color: 'var(--text-muted)', marginTop: '8px', fontSize: '12px', lineHeight: 1.5 }}>{act.description}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>Không tải được thông tin người dùng.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="user-management-container">
      <div className="glass-card">
        <div className="glass-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h3 className="glass-card-title">
            {activeView === 'staff' ? <ShieldAlert size={18} /> : <GraduationCap size={18} />}
            Quản lý Người dùng
          </h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowCreateModal(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <UserPlus size={14} /> Thêm cán bộ
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={loadUsers}
              disabled={loading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} /> Làm mới
            </button>
          </div>
        </div>

        {/* View Switcher */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', padding: '4px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <button
            className={`role-switch-btn ${activeView === 'staff' ? 'active' : ''}`}
            onClick={() => setActiveView('staff')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flex: 1, justifyContent: 'center' }}
          >
            <ShieldAlert size={14} /> Cán bộ (Admin/Manager)
          </button>
          <button
            className={`role-switch-btn ${activeView === 'student' ? 'active' : ''}`}
            onClick={() => setActiveView('student')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flex: 1, justifyContent: 'center' }}
          >
            <GraduationCap size={14} /> Sinh viên (Member)
          </button>
        </div>

        {/* Search */}
        <div style={{ marginBottom: '16px', position: 'relative' }}>
          <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={16} />
          <input
            type="text"
            className="input-field"
            placeholder="Tìm kiếm theo tên, ID/Username, email..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '38px' }}
          />
        </div>

        {/* Table */}
        {loading ? (
          <div className="empty-state-view">
            <span className="login-spinner" style={{ width: '28px', height: '28px' }} />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state-view">
            <GraduationCap className="empty-state-icon" />
            <p>Không tìm thấy người dùng nào.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Username / MSSV</th>
                  <th>Họ tên</th>
                  <th>Email</th>
                  <th>Vai trò</th>
                  <th>Trạng thái</th>
                  <th style={{ textAlign: 'center' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => {
                  const uid = user.userId || user.id || user.studentId || user.username;
                  const role = (user.role || user.systemRole || '').toUpperCase();
                  const status = user.status || 'Active';
                  return (
                    <tr key={uid}>
                      <td><strong>{user.username || uid}</strong></td>
                      <td>{user.fullName || '—'}</td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{user.schoolEmail || user.email || '—'}</td>
                      <td>
                        <span className={`badge ${role === 'ADMIN' ? 'badge-admin' : role === 'MANAGER' ? 'badge-manager' : 'badge-member'}`}>
                          {role}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${status === 'Hoạt động' || status === 'Active' ? 'badge-active' : 'badge-blocked'}`}>
                          {status === 'Active' ? 'Hoạt động' : status === 'Hoạt động' ? 'Hoạt động' : 'Đã khóa'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Xem chi tiết"
                            onClick={() => handleViewDetail(user)}
                            style={{ padding: '6px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Eye size={12} /> Chi tiết
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            title={status === 'Active' || status === 'Hoạt động' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                            onClick={() => handleToggleStatus(user)}
                            style={{ padding: '6px' }}
                          >
                            {status === 'Active' || status === 'Hoạt động'
                              ? <Lock size={12} style={{ color: 'var(--error)' }} />
                              : <Unlock size={12} style={{ color: 'var(--success)' }} />}
                          </button>
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
  );
}
