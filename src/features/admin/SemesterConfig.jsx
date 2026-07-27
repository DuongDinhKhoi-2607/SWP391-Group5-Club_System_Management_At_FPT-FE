import React, { useState, useEffect, useCallback } from 'react';
import * as semesterService from '../../services/semesterService';
import { Calendar, Plus, Edit, X, Save } from 'lucide-react';

export default function SemesterConfig({ triggerNotification }) {
  const [semesters, setSemesters] = useState([]);
  const [loadingSemesters, setLoadingSemesters] = useState(false);
  const [isSubmittingSem, setIsSubmittingSem] = useState(false);

  const [newSem, setNewSem] = useState({ name: '', description: '', startDate: '', endDate: '' });

  // Edit semester
  const [showEditSemModal, setShowEditSemModal] = useState(false);
  const [editingSem, setEditingSem] = useState(null);
  const [isUpdatingSem, setIsUpdatingSem] = useState(false);

  // Load all semesters
  const loadSemesters = useCallback(async () => {
    setLoadingSemesters(true);
    try {
      const data = await semesterService.getSemesters();
      const sList = Array.isArray(data) ? data : (data?.data ?? []);
      setSemesters(sList);
    } catch (err) {
      setSemesters([]);
    } finally {
      setLoadingSemesters(false);
    }
  }, []);

  useEffect(() => {
    loadSemesters();
  }, [loadSemesters]);

  const handleUpdateSemester = async (e) => {
    e.preventDefault();
    if (!editingSem) return;
    setIsUpdatingSem(true);
    try {
      const payload = {
        semesterName: editingSem.semesterName,
        description: editingSem.description || null,
        startDate: editingSem.startDate ? editingSem.startDate.slice(0, 10) : '',
        endDate: editingSem.endDate ? editingSem.endDate.slice(0, 10) : '',
        status: editingSem.status || 'Planned'
      };
      
      await semesterService.updateSemester(editingSem.semesterId || editingSem.id, payload);
      triggerNotification(`Đã cập nhật học kỳ: ${editingSem.semesterName}`, 'success');
      setShowEditSemModal(false);
      setEditingSem(null);
      await loadSemesters();
    } catch (err) {
      console.error('[SemesterConfig] Lỗi cập nhật học kỳ:', err);
      const errors = err?.response?.data?.errors;
      let detailMsg = '';
      if (errors && typeof errors === 'object') {
        detailMsg = Object.entries(errors)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join('; ') : v}`)
          .join(', ');
      }
      const serverMsg = detailMsg || err?.response?.data?.message || err?.response?.data?.title;
      triggerNotification(`Cập nhật học kỳ thất bại: ${serverMsg || err.message || 'Lỗi không xác định'}`, 'error');
    } finally {
      setIsUpdatingSem(false);
    }
  };

  const handleCreateSemester = async (e) => {
    e.preventDefault();
    const now = new Date();
    if (!newSem.name.trim()) {
      triggerNotification('❌ Vui lòng nhập Tên học kỳ!', 'warning');
      return;
    }
    if (!newSem.startDate) {
      triggerNotification('❌ Vui lòng chọn Ngày bắt đầu học kỳ!', 'warning');
      return;
    }
    if (new Date(newSem.startDate) < now) {
      triggerNotification('❌ Ngày bắt đầu học kỳ không được là ngày trong quá khứ!', 'warning');
      return;
    }
    if (!newSem.endDate) {
      triggerNotification('❌ Vui lòng chọn Ngày kết thúc học kỳ!', 'warning');
      return;
    }
    if (newSem.endDate <= newSem.startDate) {
      triggerNotification('❌ Ngày kết thúc phải sau ngày bắt đầu!', 'warning');
      return;
    }
    
    setIsSubmittingSem(true);
    try {
      await semesterService.createSemester({
        semesterName: newSem.name.trim(),
        description: newSem.description || null,
        startDate: newSem.startDate,
        endDate: newSem.endDate
      });
      triggerNotification(`✅ Đã thiết lập học kỳ mới: ${newSem.name}`, 'success');
      setNewSem({ name: '', description: '', startDate: '', endDate: '' });
      await loadSemesters();
    } catch (err) {
      console.error('[SemesterConfig] Lỗi tạo học kỳ:', err);
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.message || err?.response?.data?.title;
      if (status === 400) triggerNotification(`❌ Dữ liệu không hợp lệ: ${serverMsg || 'Kiểm tra lại thông tin!'}`, 'error');
      else if (status === 403) triggerNotification('❌ Bạn không có quyền thực hiện thao tác này!', 'error');
      else triggerNotification(`❌ Tạo học kỳ thất bại: ${serverMsg || 'Lỗi máy chủ, vui lòng thử lại!'}`, 'error');
    } finally {
      setIsSubmittingSem(false);
    }
  };

  const getSemesterStatus = (s) => {
    if (!s) return 'Planned';
    // Support Vietnamese and English active statuses from Backend
    const st = String(s.status || '').trim().toLowerCase();
    if (st === 'đang diễn ra' || st === 'active' || st === 'open') return 'Active';
    if (st === 'đã kết thúc' || st === 'finished' || st === 'closed') return 'Finished';
    
    // Otherwise, compute based on dates
    if (s.startDate && s.endDate) {
      const now = new Date();
      const start = new Date(s.startDate);
      const end = new Date(s.endDate);
      start.setHours(0,0,0,0);
      end.setHours(23,59,59,999);
      
      if (now >= start && now <= end) return 'Active';
      if (now > end) return 'Finished';
    }
    return s.status || 'Planned';
  };

  const activeSemester = semesters.find(s => {
    const st = String(s.status || '').trim().toLowerCase();
    return st === 'đang diễn ra' || st === 'active' || st === 'open' || getSemesterStatus(s) === 'Active';
  }) || semesters[0];

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('vi-VN');
    } catch {
      return dateString;
    }
  };

  // ── EDIT SEMESTER VIEW ─────────────────────────────────────────────────────
  if (showEditSemModal && editingSem) {
    return (
      <div style={{ animation: 'fadeIn 0.2s ease' }}>
        <div className="glass-card" style={{ marginBottom: '20px', padding: '12px 20px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => { setShowEditSemModal(false); setEditingSem(null); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}
          >
            <X size={16} /> Quay lại Cấu hình Học kỳ
          </button>
        </div>
        <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div className="glass-card-header" style={{ marginBottom: '16px' }}>
            <h3 className="glass-card-title"><Edit size={18} style={{ marginRight: '6px' }} /> Sửa Học kỳ</h3>
          </div>
          <form onSubmit={handleUpdateSemester} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Tên học kỳ *</label>
              <input type="text" className="input-field" value={editingSem.semesterName}
                onChange={e => setEditingSem({ ...editingSem, semesterName: e.target.value })} required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Mô tả</label>
              <input type="text" className="input-field" value={editingSem.description || ''}
                onChange={e => setEditingSem({ ...editingSem, description: e.target.value })} />
            </div>
            <div className="form-row">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Ngày bắt đầu *</label>
                <input type="date" className="input-field" value={editingSem.startDate?.slice(0,10) || ''}
                  onChange={e => setEditingSem({ ...editingSem, startDate: e.target.value })} required />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Ngày kết thúc *</label>
                <input type="date" className="input-field" value={editingSem.endDate?.slice(0,10) || ''}
                  onChange={e => setEditingSem({ ...editingSem, endDate: e.target.value })} required />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Trạng thái</label>
              <select className="select-field" value={editingSem.status || 'Planned'}
                onChange={e => setEditingSem({ ...editingSem, status: e.target.value })}>
                <option value="Planned">Chưa diễn ra (Planned)</option>
                <option value="Active">Đang diễn ra (Active)</option>
                <option value="Finished">Đã kết thúc (Finished)</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '10px' }} disabled={isUpdatingSem}>
                <Save size={16} style={{ marginRight: '6px' }} /> {isUpdatingSem ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
              <button type="button" className="btn btn-secondary" style={{ padding: '10px 20px' }} onClick={() => { setShowEditSemModal(false); setEditingSem(null); }}>Hủy</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="semester-config-container">
      <div className="stats-grid" style={{ maxWidth: '800px', margin: '0 auto 24px' }}>
        <div className="stats-card">
          <div className="stats-icon-box"><Calendar size={20} /></div>
          <div className="stats-info">
            <span className="stats-label">Học kỳ Hiện tại</span>
            <span className="stats-value">
              {activeSemester ? (activeSemester.semesterName || activeSemester.name) : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Create Semester Form & List */}
        <div className="glass-card">
          <div className="glass-card-header">
            <h3 className="glass-card-title"><Calendar size={18} /> Danh sách Học kỳ</h3>
          </div>
          
          <form onSubmit={handleCreateSemester} style={{ marginBottom: '24px' }}>
            <div className="form-row">
              <div className="form-group">
                <label>Tên học kỳ *</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={newSem.name} 
                  onChange={e => setNewSem({ ...newSem, name: e.target.value })} 
                  placeholder="Summer 2026"
                  required
                />
              </div>
              <div className="form-group">
                <label>Mô tả học kỳ</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={newSem.description} 
                  onChange={e => setNewSem({ ...newSem, description: e.target.value })} 
                  placeholder="Mô tả kỳ học..."
                />
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>Ngày bắt đầu *</label>
                <input 
                  type="date" 
                  className="input-field" 
                  value={newSem.startDate} 
                  onChange={e => setNewSem({ ...newSem, startDate: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Ngày kết thúc *</label>
                <input 
                  type="date" 
                  className="input-field" 
                  value={newSem.endDate} 
                  onChange={e => setNewSem({ ...newSem, endDate: e.target.value })}
                  required
                />
              </div>
            </div>
            
            <button type="submit" className="btn btn-primary" disabled={isSubmittingSem}>
              <Plus size={16} /> {isSubmittingSem ? 'Đang thêm...' : 'Thêm học kỳ'}
            </button>
          </form>

          {loadingSemesters ? (
            <div style={{ textAlign: 'center', padding: '24px' }}>
              <div className="login-spinner" style={{ margin: '0 auto' }}></div>
            </div>
          ) : (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Tên học kỳ</th>
                    <th>Bắt đầu</th>
                    <th>Kết thúc</th>
                    <th>Trạng thái</th>
                    <th style={{ textAlign: 'center' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {semesters.map(s => (
                    <tr key={s.semesterId || s.id}>
                      <td><strong>{s.semesterId || s.id}</strong></td>
                      <td>{s.semesterName || s.name}</td>
                      <td>{formatDate(s.startDate)}</td>
                      <td>{formatDate(s.endDate)}</td>
                      <td>
                        <span className={`badge ${
                          getSemesterStatus(s) === 'Active' || s.status === 'Open' ? 'badge-active' : getSemesterStatus(s) === 'Finished' ? 'badge-blocked' : 'badge-pending'
                        }`}>
                          {getSemesterStatus(s) === 'Active' || s.status === 'Open' ? 'Đang diễn ra' : getSemesterStatus(s) === 'Finished' ? 'Đã kết thúc' : 'Chưa diễn ra'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => { setEditingSem({ ...s, semesterName: s.semesterName || s.name }); setShowEditSemModal(true); }}
                        >
                          <Edit size={12} /> Sửa
                        </button>
                      </td>
                    </tr>
                  ))}
                  {semesters.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Chưa có học kỳ nào được thiết lập.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
