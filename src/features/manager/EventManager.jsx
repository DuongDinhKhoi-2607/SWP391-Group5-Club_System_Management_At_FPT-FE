import React, { useState, useEffect, useCallback } from 'react';
import { createEvent, getEventsByClub, cancelEvent, updateEvent, getEventParticipants, getEventEvidences } from '../../services/eventService';
import { Calendar, Plus, MapPin, AlertTriangle, Edit, X, Save, XCircle, Users, CheckCircle, Clock, Search, Paperclip, FileText, Download, Eye } from 'lucide-react';
import { parseDateVN, toLocalISOString, formatDateVN } from '../../utils/validator';
import VietnameseDateTimePicker from '../../components/VietnameseDateTimePicker';

export default function EventManager({ selectedClubId, triggerNotification }) {

  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create event modal state
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Edit event
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Cancel event confirm
  const [cancelTargetId, setCancelTargetId] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Participant list & Evidence status for event modal
  const [participants, setParticipants] = useState([]);
  const [eventEvidences, setEventEvidences] = useState([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState('details'); // 'details' | 'participants'
  const [participantSearch, setParticipantSearch] = useState('');

  const [newEvent, setNewEvent] = useState({
    eventName: '',
    startTime: '',
    endTime: '',
    location: '',
    planBudget: '',
    targetParticipants: '',
    description: '',
    files: []
  });
  const [selectedEventId, setSelectedEventId] = useState(null);
  const selectedEvent = events.find(e => String(e.id || e.eventId || e.clubEventId) === String(selectedEventId));
  
  // Validation errors state
  const [errors, setErrors] = useState({});
  const [editErrors, setEditErrors] = useState({});

  const backendClubId = selectedClubId;

  // Regex helper for special characters
  const validateNoSpecialChars = (text) => {
    if (!text) return true;
    // Allow unicode letters, digits, whitespace, and basic punctuation: - . , ( ) / + ? ! : # ' " @ _
    const regex = /^[\p{L}\p{N}\s\-.,()\/+?!:#$'"@_]*$/u;
    return regex.test(text);
  };

  // Load events từ API khi selectedClubId thay đổi
  const loadEvents = useCallback(async () => {
    if (!selectedClubId) return;
    setLoadingEvents(true);
    try {
      const data = await getEventsByClub(backendClubId);
      setEvents(Array.isArray(data) ? data : (data?.data ?? []));
    } catch (err) {
      console.error('[EventManager] Lỗi tải sự kiện:', err);
      triggerNotification?.('Không tải được danh sách sự kiện!', 'error');
      setEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  }, [backendClubId, triggerNotification]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    if (!selectedEventId) {
      setParticipants([]);
      setEventEvidences([]);
      setActiveModalTab('details');
      setParticipantSearch('');
      return;
    }

    const fetchParticipantsAndEvidences = async () => {
      setLoadingParticipants(true);
      try {
        const [pRes, eRes] = await Promise.allSettled([
          getEventParticipants(selectedEventId),
          getEventEvidences(selectedEventId)
        ]);

        if (pRes.status === 'fulfilled') {
          const raw = pRes.value;
          setParticipants(Array.isArray(raw) ? raw : (raw?.data ?? []));
        } else {
          setParticipants([]);
        }

        if (eRes.status === 'fulfilled') {
          const raw = eRes.value;
          setEventEvidences(Array.isArray(raw) ? raw : (raw?.data ?? []));
        } else {
          setEventEvidences([]);
        }
      } catch (err) {
        console.error('[EventManager] Error loading participants:', err);
      } finally {
        setLoadingParticipants(false);
      }
    };

    fetchParticipantsAndEvidences();
  }, [selectedEventId]);

  const getParticipantEvidenceStatus = (p) => {
    const pId = p.participantId || p.id;
    const uId = p.userId;
    const sCode = (p.studentId || p.studentCode || '').toLowerCase();

    const matched = eventEvidences.find(ev => {
      if (pId && String(ev.participantId) === String(pId)) return true;
      if (uId && String(ev.userId || ev.studentId) === String(uId)) return true;
      if (sCode && (ev.studentCode || ev.studentId || '').toLowerCase() === sCode) return true;
      return false;
    });

    if (!matched) {
      return { status: 'none', label: 'Chưa nộp minh chứng', isManagerApproved: false, color: 'var(--text-muted)' };
    }

    const isV = matched.isVerified || matched.status || '';
    if (isV === 'Đã duyệt' || isV === 'Hợp lệ' || isV === 'Approved') {
      return { status: 'approved', label: 'Đã phê duyệt (Có)', isManagerApproved: true, color: '#22c55e' };
    }
    if (isV === 'Chờ Manager duyệt') {
      return { status: 'pending_manager', label: 'Chờ Manager duyệt', isManagerApproved: false, color: '#f59e0b' };
    }
    if (isV === 'Đang chờ' || isV === 'Pending' || isV === 'Đang chờ Leader duyệt') {
      return { status: 'pending_leader', label: 'Chờ Leader duyệt', isManagerApproved: false, color: '#3b82f6' };
    }
    if (isV === 'Từ chối' || isV === 'Không hợp lệ' || isV === 'Rejected') {
      return { status: 'rejected', label: 'Minh chứng bị từ chối', isManagerApproved: false, color: '#ef4444' };
    }

    return { status: 'submitted', label: isV, isManagerApproved: false, color: 'var(--text-main)' };
  };

  const validateStartTime = (val) => {
    if (!val) return 'Vui lòng chọn Thời gian bắt đầu!';
    const selected = new Date(val);
    const now = new Date();
    if (selected <= now) {
      return 'Thời gian bắt đầu phải là thời điểm trong tương lai!';
    }
    return null;
  };

  const validateEndTime = (startVal, endVal) => {
    if (!endVal) return null;
    const start = startVal ? new Date(startVal) : null;
    const end = new Date(endVal);
    if (start && end <= start) {
      return 'Thời gian kết thúc phải sau thời gian bắt đầu!';
    }
    return null;
  };

  const handleStartTimeChange = (val) => {
    setNewEvent(prev => {
      const updated = { ...prev, startTime: val };
      const startErr = validateStartTime(val);
      const endErr = validateEndTime(val, prev.endTime);
      setErrors(errs => ({
        ...errs,
        startTime: startErr,
        endTime: endErr !== undefined ? endErr : errs.endTime
      }));
      return updated;
    });
  };

  const handleEndTimeChange = (val) => {
    setNewEvent(prev => {
      const updated = { ...prev, endTime: val };
      const endErr = validateEndTime(prev.startTime, val);
      setErrors(errs => ({
        ...errs,
        endTime: endErr
      }));
      return updated;
    });
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    const now = new Date();
    const newErrors = {};

    // --- Validation logic ---
    if (!newEvent.eventName.trim()) {
      newErrors.eventName = 'Vui lòng nhập Tên chương trình / sự kiện!';
    } else if (!validateNoSpecialChars(newEvent.eventName)) {
      newErrors.eventName = 'Tên chương trình không được chứa ký tự lạ!';
    }

    if (!newEvent.startTime) {
      newErrors.startTime = 'Vui lòng chọn Thời gian bắt đầu!';
    } else if (new Date(newEvent.startTime) <= now) {
      newErrors.startTime = 'Thời gian bắt đầu phải là thời điểm trong tương lai!';
    }

    if (newEvent.endTime && new Date(newEvent.endTime) <= new Date(newEvent.startTime)) {
      newErrors.endTime = 'Thời gian kết thúc phải sau thời gian bắt đầu!';
    }

    if (!newEvent.location.trim()) {
      newErrors.location = 'Vui lòng nhập Địa điểm tổ chức!';
    } else if (!validateNoSpecialChars(newEvent.location)) {
      newErrors.location = 'Địa điểm tổ chức không được chứa ký tự lạ!';
    }

    if (newEvent.description && !validateNoSpecialChars(newEvent.description)) {
      newErrors.description = 'Mô tả chương trình không được chứa ký tự lạ!';
    }

    const budgetNum = Number(String(newEvent.planBudget).replace(/,/g, ''));
    if (!newEvent.planBudget) {
      newErrors.planBudget = 'Vui lòng nhập Ngân sách dự trù!';
    } else if (isNaN(budgetNum) || budgetNum < 0) {
      newErrors.planBudget = 'Ngân sách không hợp lệ (phải là số không âm)!';
    }

    const participantsNum = Number(newEvent.targetParticipants);
    if (newEvent.targetParticipants && (isNaN(participantsNum) || participantsNum <= 0)) {
      newErrors.targetParticipants = 'Số người dự kiến phải là số nguyên lớn hơn 0!';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      triggerNotification('❌ Vui lòng sửa các lỗi nhập liệu dưới đây!', 'warning');
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    try {
      // Build multipart/form-data
      const formData = new FormData();
      formData.append('ClubId', backendClubId);
      formData.append('EventName', newEvent.eventName.trim());
      formData.append('Description', newEvent.description || '');
      formData.append('Location', newEvent.location.trim());
      formData.append('PlanBudget', String(newEvent.planBudget).replace(/,/g, ''));
      formData.append('TargetParticipants', newEvent.targetParticipants || 0);
      formData.append('StartTime', toLocalISOString(newEvent.startTime));
      formData.append('EndTime', newEvent.endTime ? toLocalISOString(newEvent.endTime) : toLocalISOString(newEvent.startTime));
      
      // Save file list & data URLs for Manager preview & download
      const fileDataList = [];
      if (newEvent.files && newEvent.files.length > 0) {
        for (let i = 0; i < newEvent.files.length; i++) {
          const file = newEvent.files[i];
          formData.append('Files', file);
          try {
            const dataUrl = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = e => resolve(e.target.result);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            fileDataList.push({
              name: file.name,
              size: file.size,
              type: file.type,
              url: dataUrl
            });
          } catch (err) {
            console.warn('Could not read attached file:', file.name);
          }
        }
      }

      if (fileDataList.length > 0) {
        try {
          localStorage.setItem(`fpt_event_files_${newEvent.eventName.trim()}`, JSON.stringify(fileDataList));
        } catch (e) {
          console.warn('Could not set localStorage for event files', e);
        }
      }

      const result = await createEvent(formData);
      const createdId = result?.eventId || result?.id || result;
      if (createdId && fileDataList.length > 0) {
        try {
          localStorage.setItem(`fpt_event_files_${createdId}`, JSON.stringify(fileDataList));
        } catch (e) {}
      }

      triggerNotification(`✅ Đã tạo kế hoạch sự kiện: ${newEvent.eventName}`, 'success');
      setNewEvent({
        eventName: '',
        startTime: '',
        endTime: '',
        location: '',
        planBudget: '',
        targetParticipants: '',
        description: '',
        files: []
      });
      setShowCreateModal(false);
      // Reload danh sách sự kiện sau khi tạo
      await loadEvents();
    } catch (err) {
      console.error('[EventManager] Lỗi tạo sự kiện:', err);
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.message || err?.response?.data?.title;
      if (status === 400) {
        triggerNotification(`❌ Dữ liệu không hợp lệ: ${serverMsg || 'Kiểm tra lại các trường nhập liệu!'}`, 'error');
      } else if (status === 401) {
        triggerNotification('❌ Phiên đăng nhập hết hạn. Vui lòng đăng xuất và đăng nhập lại!', 'error');
      } else if (status === 403) {
        triggerNotification('❌ Bạn không có quyền tạo sự kiện cho CLB này!', 'error');
      } else {
        triggerNotification(`❌ Tạo sự kiện thất bại: ${serverMsg || 'Lỗi máy chủ, vui lòng thử lại!'}`, 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelEvent = async () => {
    if (!cancelTargetId) return;
    setIsCancelling(true);
    try {
      await cancelEvent(cancelTargetId);
      triggerNotification('Sự kiện đã được hủy thành công!', 'success');
      setCancelTargetId(null);
      await loadEvents();
    } catch (err) {
      triggerNotification(err?.response?.data?.message || 'Hủy sự kiện thất bại!', 'error');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleUpdateEvent = async (e) => {
    e.preventDefault();
    if (!editingEvent) return;
    const now = new Date();
    const newErrors = {};

    if (!editingEvent.eventName?.trim()) {
      newErrors.eventName = 'Vui lòng nhập Tên chương trình / sự kiện!';
    } else if (!validateNoSpecialChars(editingEvent.eventName)) {
      newErrors.eventName = 'Tên chương trình không được chứa ký tự lạ!';
    }

    if (!editingEvent.startTime) {
      newErrors.startTime = 'Vui lòng chọn Thời gian bắt đầu!';
    }

    if (editingEvent.endTime && new Date(editingEvent.endTime) <= new Date(editingEvent.startTime)) {
      newErrors.endTime = 'Thời gian kết thúc phải sau thời gian bắt đầu!';
    }

    if (!editingEvent.location?.trim()) {
      newErrors.location = 'Vui lòng nhập Địa điểm!';
    } else if (!validateNoSpecialChars(editingEvent.location)) {
      newErrors.location = 'Địa điểm không được chứa ký tự lạ!';
    }

    if (editingEvent.description && !validateNoSpecialChars(editingEvent.description)) {
      newErrors.description = 'Mô tả không được chứa ký tự lạ!';
    }

    const budgetNum = Number(String(editingEvent.planBudget).replace(/,/g, ''));
    if (!editingEvent.planBudget) {
      newErrors.planBudget = 'Vui lòng nhập Ngân sách!';
    } else if (isNaN(budgetNum) || budgetNum < 0) {
      newErrors.planBudget = 'Ngân sách không hợp lệ!';
    }

    const participantsNum = Number(editingEvent.targetParticipants);
    if (editingEvent.targetParticipants && (isNaN(participantsNum) || participantsNum <= 0)) {
      newErrors.targetParticipants = 'Số người dự kiến phải là số lớn hơn 0!';
    }

    if (Object.keys(newErrors).length > 0) {
      setEditErrors(newErrors);
      triggerNotification('❌ Vui lòng sửa các lỗi nhập liệu dưới đây!', 'warning');
      return;
    }

    setEditErrors({});
    setIsUpdating(true);
    try {
      await updateEvent(editingEvent.id || editingEvent.eventId, {
        eventName: editingEvent.eventName.trim(),
        description: editingEvent.description || '',
        location: editingEvent.location.trim(),
        planBudget: String(editingEvent.planBudget).replace(/,/g, ''),
        targetParticipants: Number(editingEvent.targetParticipants) || 0,
        startTime: toLocalISOString(editingEvent.startTime),
        endTime: editingEvent.endTime ? toLocalISOString(editingEvent.endTime) : toLocalISOString(editingEvent.startTime)
      });
      triggerNotification(`Cập nhật sự kiện: ${editingEvent.eventName} thành công!`, 'success');
      setShowEditModal(false);
      setEditingEvent(null);
      await loadEvents();
    } catch (err) {
      triggerNotification(err?.response?.data?.message || 'Cập nhật sự kiện thất bại!', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  // ── CREATE VIEW ────────────────────────────────────────────────────────────
  if (showCreateModal) {
    return (
      <div className="event-manager-container" style={{ animation: 'fadeIn 0.2s ease' }}>
        <div className="glass-card" style={{ marginBottom: '20px', padding: '12px 20px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowCreateModal(false)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}
          >
            <X size={16} /> Quay lại Danh sách Sự kiện
          </button>
        </div>
        <div className="glass-card">
          <div className="glass-card-header">
            <h3 className="glass-card-title"><Plus size={18} style={{ marginRight: '6px' }} /> Lập kế hoạch sự kiện mới</h3>
          </div>
          <form onSubmit={handleCreateEvent} noValidate style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="form-group">
              <label>Tên chương trình / sự kiện <span style={{ color: 'var(--error, #ef4444)' }}>*</span></label>
              <input
                type="text"
                className="input-field"
                value={newEvent.eventName}
                onChange={e => {
                  setNewEvent({ ...newEvent, eventName: e.target.value });
                  if (errors.eventName) setErrors(prev => ({ ...prev, eventName: null }));
                }}
                placeholder="Workshop, Đại hội, Teambuilding..."
              />
              {errors.eventName && <span style={{ fontSize: '11px', color: 'var(--error, #ef4444)', marginTop: '4px', display: 'block' }}>{errors.eventName}</span>}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Thời gian bắt đầu <span style={{ color: 'var(--error, #ef4444)' }}>*</span></label>
                <VietnameseDateTimePicker
                  value={newEvent.startTime}
                  onChange={val => handleStartTimeChange(val)}
                  onBlur={val => handleStartTimeChange(val)}
                  error={!!errors.startTime}
                  placeholder="dd/mm/yyyy --:--"
                />
                {errors.startTime && <span style={{ fontSize: '11px', color: 'var(--error, #ef4444)', marginTop: '4px', display: 'block' }}>{errors.startTime}</span>}
              </div>
              <div className="form-group">
                <label>Thời gian kết thúc</label>
                <VietnameseDateTimePicker
                  value={newEvent.endTime}
                  min={newEvent.startTime || undefined}
                  onChange={val => handleEndTimeChange(val)}
                  onBlur={val => handleEndTimeChange(val)}
                  error={!!errors.endTime}
                  placeholder="dd/mm/yyyy --:--"
                />
                {errors.endTime && <span style={{ fontSize: '11px', color: 'var(--error, #ef4444)', marginTop: '4px', display: 'block' }}>{errors.endTime}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Ngân sách dự trù (VNĐ) <span style={{ color: 'var(--error, #ef4444)' }}>*</span></label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="input-field"
                  value={newEvent.planBudget}
                  onChange={e => {
                    const cleaned = e.target.value.replace(/[^0-9]/g, '');
                    setNewEvent({ ...newEvent, planBudget: cleaned });
                    if (errors.planBudget) setErrors(prev => ({ ...prev, planBudget: null }));
                  }}
                  placeholder="1500000"
                />
                {errors.planBudget && <span style={{ fontSize: '11px', color: 'var(--error, #ef4444)', marginTop: '4px', display: 'block' }}>{errors.planBudget}</span>}
              </div>
              <div className="form-group">
                <label>Số lượng tham gia dự kiến</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="input-field"
                  value={newEvent.targetParticipants}
                  onChange={e => {
                    const cleaned = e.target.value.replace(/[^0-9]/g, '');
                    setNewEvent({ ...newEvent, targetParticipants: cleaned });
                    if (errors.targetParticipants) setErrors(prev => ({ ...prev, targetParticipants: null }));
                  }}
                  placeholder="50"
                />
                {errors.targetParticipants && <span style={{ fontSize: '11px', color: 'var(--error, #ef4444)', marginTop: '4px', display: 'block' }}>{errors.targetParticipants}</span>}
              </div>
            </div>

            <div className="form-group">
              <label>Địa điểm tổ chức <span style={{ color: 'var(--error, #ef4444)' }}>*</span></label>
              <select
                className="select-field"
                value={newEvent.location}
                onChange={e => {
                  setNewEvent({ ...newEvent, location: e.target.value });
                  if (errors.location) setErrors(prev => ({ ...prev, location: null }));
                }}
              >
                <option value="">-- Chọn địa điểm --</option>
                <option value="Sân thượng">Sân thượng (~ 100 - 150 người)</option>
                <option value="Hội trường A">Hội trường A (~ 200 - 300 người)</option>
                <option value="Hội trường B">Hội trường B (~ 150 - 300 người)</option>
                <option value="Sảnh trống đồng">Sảnh trống đồng (~ 50 - 100 người)</option>
                <option value="Sân trường 1">Sân trường 1 (~ 300 - 400 người)</option>
                <option value="Sân trường 2">Sân trường 2 (~ 300 - 400 người)</option>
                <option value="Sân bóng">Sân bóng (~ 100 - 150 người)</option>
              </select>
              {errors.location && <span style={{ fontSize: '11px', color: 'var(--error, #ef4444)', marginTop: '4px', display: 'block' }}>{errors.location}</span>}
            </div>

            <div className="form-group">
              <label>Mô tả ngắn gọn chương trình</label>
              <textarea
                className="textarea-field"
                value={newEvent.description}
                onChange={e => {
                  setNewEvent({ ...newEvent, description: e.target.value });
                  if (errors.description) setErrors(prev => ({ ...prev, description: null }));
                }}
                placeholder="Nội dung, kế hoạch chạy truyền thông..."
                rows={4}
              />
              {errors.description && <span style={{ fontSize: '11px', color: 'var(--error, #ef4444)', marginTop: '4px', display: 'block' }}>{errors.description}</span>}
            </div>

            <div className="form-group">
              <label>Đính kèm tài liệu (Files, tuỳ chọn)</label>
              <input
                type="file"
                className="input-field"
                multiple
                onChange={e => setNewEvent({ ...newEvent, files: e.target.files })}
                style={{ padding: '8px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="login-spinner" />
                ) : (
                  <><Calendar size={16} /> Lên lịch &amp; Đăng ký sự kiện</>
                )}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Hủy bỏ</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ── DETAIL VIEW ────────────────────────────────────────────────────────────
  if (selectedEventId && selectedEvent) {
    return (
      <div className="event-manager-container" style={{ animation: 'fadeIn 0.2s ease' }}>
        <div className="glass-card" style={{ marginBottom: '20px', padding: '12px 20px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setSelectedEventId(null)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}
          >
            <X size={16} /> Quay lại Danh sách Sự kiện
          </button>
        </div>

        <div className="glass-card">
          <div className="glass-card-header" style={{ marginBottom: '16px' }}>
            <h3 className="glass-card-title"><Calendar size={18} style={{ marginRight: '6px' }} /> Chi tiết &amp; Thành viên Tham gia</h3>
          </div>

          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '16px' }}>
            <button
              className={`btn btn-sm ${activeModalTab === 'details' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveModalTab('details')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Calendar size={14} /> Thông tin Kế hoạch
            </button>
            <button
              className={`btn btn-sm ${activeModalTab === 'participants' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveModalTab('participants')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Users size={14} /> Danh sách Tham gia ({participants.length})
            </button>
          </div>

          {activeModalTab === 'details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h4 style={{ fontSize: '18px', color: 'var(--text-heading)', fontWeight: 700, borderBottom: '1px solid var(--border)', paddingBottom: '10px', margin: 0 }}>
                {selectedEvent.eventName || selectedEvent.name}
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  ['Ngày bắt đầu', selectedEvent.startTime ? formatDateVN(selectedEvent.startTime) : 'N/A'],
                  ['Ngày kết thúc', selectedEvent.endTime ? formatDateVN(selectedEvent.endTime) : 'N/A'],
                  ['Địa điểm', selectedEvent.location || 'N/A'],
                  ['Ngân sách dự toán', selectedEvent.planBudget || selectedEvent.budget ? `${Number(selectedEvent.planBudget || selectedEvent.budget).toLocaleString('vi-VN')} VNĐ` : 'N/A'],
                  ['Số lượng dự kiến', selectedEvent.targetParticipants ? `${selectedEvent.targetParticipants} người` : 'N/A'],
                  ['Trạng thái phê duyệt', (() => {
                    const eStatus = selectedEvent.status || selectedEvent.approvalStatus || 'Pending';
                    if (eStatus === 'Approved' || eStatus === 'Đã duyệt') return <span className="badge badge-success">ĐÃ DUYỆT</span>;
                    if (eStatus === 'Rejected' || eStatus === 'Từ chối' || eStatus === 'Bị từ chối') return <span className="badge badge-blocked">BỊ TỪ CHỐI / YÊU CẦU SỬA</span>;
                    if (eStatus === 'Cancelled' || eStatus === 'Đã hủy') return <span className="badge badge-blocked" style={{ filter: 'grayscale(0.6)' }}>ĐÃ HỦY</span>;
                    return <span className="badge badge-pending">CHỜ DUYỆT</span>;
                  })()],
                  ['Mô tả chi tiết', selectedEvent.description || 'Không có mô tả chi tiết']
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
                    <span style={{ minWidth: '160px', fontSize: '13px', color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
                    <span style={{ fontSize: '14px', color: 'var(--text-main)', wordBreak: 'break-all' }}>{value}</span>
                  </div>
                ))}
              </div>

              {(selectedEvent.rejectReason || selectedEvent.approvalRemark) && (
                <div style={{ padding: '12px', background: 'rgba(239,68,68,0.08)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)', fontSize: '13px', color: 'var(--text-muted)' }}>
                  <strong style={{ color: '#ef4444' }}>Lý do / Phản hồi từ Manager:</strong> {selectedEvent.rejectReason || selectedEvent.approvalRemark}
                </div>
              )}

              {/* Attachments */}
              {(() => {
                const eId = selectedEvent.id || selectedEvent.eventId;
                const eName = selectedEvent.eventName || selectedEvent.name;
                let attachedFiles = selectedEvent.files || selectedEvent.documents || selectedEvent.attachments || [];
                if (typeof attachedFiles === 'string') {
                  try {
                    const parsed = JSON.parse(attachedFiles);
                    attachedFiles = Array.isArray(parsed) ? parsed : [parsed];
                  } catch {
                    attachedFiles = [{ url: attachedFiles, name: 'Tài liệu đính kèm' }];
                  }
                }
                if (!Array.isArray(attachedFiles) || attachedFiles.length === 0) {
                  const byId = localStorage.getItem(`fpt_event_files_${eId}`);
                  const byName = localStorage.getItem(`fpt_event_files_${eName}`);
                  const str = byId || byName;
                  if (str) {
                    try { 
                      const parsed = JSON.parse(str);
                      attachedFiles = Array.isArray(parsed) ? parsed : [parsed];
                    } catch {}
                  }
                }

                if (!Array.isArray(attachedFiles) || attachedFiles.length === 0) return null;

                const isImageFile = (file) => {
                  const name = (file.name || file.fileName || file.url || file.path || '').toLowerCase();
                  const type = (file.type || '').toLowerCase();
                  return type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
                };

                return (
                  <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <strong style={{ fontSize: '14px', color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                      <Paperclip size={16} style={{ color: 'var(--primary)' }} /> Tài liệu &amp; Hình ảnh đính kèm ({attachedFiles.length}):
                    </strong>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {attachedFiles.map((file, idx) => {
                        const fileName = file.name || file.fileName || `Tài_liệu_${idx + 1}`;
                        const fileSize = file.size ? `${(file.size / 1024).toFixed(1)} KB` : '';
                        const fileUrl = file.url || file.fileUrl || file.path;
                        const isImg = isImageFile(file);

                        const handleDownload = () => {
                          if (!fileUrl) { alert('Không tìm thấy đường dẫn file!'); return; }
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
                                <span style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 600 }}>🖼️ {fileName}</span>
                                {fileUrl && (
                                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleDownload} style={{ fontSize: '12px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <Download size={14} /> Tải ảnh
                                  </button>
                                )}
                              </div>
                              {fileUrl && (
                                <div style={{ textAlign: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '12px' }}>
                                  <img src={fileUrl} alt={fileName} style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '6px', objectFit: 'contain' }} />
                                </div>
                              )}
                            </div>
                          );
                        }

                        return (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                              <FileText size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                              <span style={{ fontSize: '13px', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {fileName} {fileSize && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>({fileSize})</span>}
                              </span>
                            </div>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={handleDownload} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px', padding: '4px 12px', flexShrink: 0 }}>
                              <Download size={14} /> Tải về
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {activeModalTab === 'participants' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div className="search-input-wrapper" style={{ flex: 1, minWidth: '220px' }}>
                  <Search className="search-icon" size={18} />
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Tìm theo tên, MSSV..."
                    value={participantSearch}
                    onChange={e => setParticipantSearch(e.target.value)}
                    style={{ padding: '8px 12px 8px 40px', fontSize: '14px' }}
                  />
                </div>
                <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                  Tổng: <strong>{participants.length}</strong> tham gia (Manager đã duyệt: <strong>{participants.filter(p => getParticipantEvidenceStatus(p).isManagerApproved).length}</strong>)
                </div>
              </div>

              {loadingParticipants ? (
                <div className="empty-state-view" style={{ padding: '40px' }}>
                  <span className="login-spinner" style={{ width: '32px', height: '32px' }} />
                  <p style={{ fontSize: '14px', marginTop: '12px' }}>Đang tải danh sách tham gia...</p>
                </div>
              ) : participants.length === 0 ? (
                <div className="empty-state-view" style={{ padding: '40px' }}>
                  <Users className="empty-state-icon" style={{ width: '48px', height: '48px' }} />
                  <p style={{ fontSize: '14px', marginTop: '12px' }}>Chưa có sinh viên nào đăng ký tham gia sự kiện này.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="custom-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>STT</th>
                        <th>Họ và Tên</th>
                        <th>MSSV</th>
                        <th>Vai trò</th>
                        <th>Trạng thái Minh chứng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {participants
                        .filter(p => {
                          const q = participantSearch.toLowerCase();
                          return !q || (p.fullName || p.name || '').toLowerCase().includes(q) || (p.studentId || p.studentCode || '').toLowerCase().includes(q);
                        })
                        .map((p, idx) => {
                          const evInfo = getParticipantEvidenceStatus(p);
                          return (
                            <tr key={p.participantId || p.id || idx}>
                              <td>{idx + 1}</td>
                              <td style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{p.fullName || p.name || 'Sinh viên'}</td>
                              <td>{p.studentId || p.studentCode || 'N/A'}</td>
                              <td>{p.roleInEvent || 'Thành viên'}</td>
                              <td>
                                <span
                                  className="badge"
                                  style={{
                                    background: evInfo.isManagerApproved ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
                                    color: evInfo.color,
                                    border: `1px solid ${evInfo.color}40`,
                                    fontSize: '12px',
                                    padding: '4px 10px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                  }}
                                >
                                  {evInfo.isManagerApproved ? <CheckCircle size={12} /> : null}
                                  {evInfo.label}
                                </span>
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

          <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setSelectedEventId(null)} style={{ padding: '8px 20px', fontWeight: 600 }}>Đóng</button>
          </div>
        </div>
      </div>
    );
  }

  // ── CANCEL CONFIRM VIEW ────────────────────────────────────────────────────
  if (cancelTargetId) {
    return (
      <div className="event-manager-container" style={{ animation: 'fadeIn 0.2s ease' }}>
        <div className="glass-card" style={{ marginBottom: '20px', padding: '12px 20px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setCancelTargetId(null)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}
          >
            <X size={16} /> Quay lại Danh sách Sự kiện
          </button>
        </div>
        <div className="glass-card" style={{ maxWidth: '500px', margin: '0 auto' }}>
          <div className="modal-header" style={{ marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
            <h3 className="modal-title" style={{ color: 'var(--error)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <XCircle size={20} /> Xác nhận Hủy Sự kiện
            </h3>
          </div>
          <p style={{ fontSize: '14px', lineHeight: 1.6, margin: '20px 0', color: 'var(--text-main)' }}>
            Bạn có chắc chắn muốn hủy sự kiện này không? Hành động này <strong>không thể hoàn tác</strong>.
          </p>
          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button
              className="btn btn-danger"
              style={{ flex: 1, padding: '10px' }}
              onClick={handleCancelEvent}
              disabled={isCancelling}
            >
              {isCancelling ? 'Đang hủy...' : 'Đồng ý Hủy sự kiện'}
            </button>
            <button className="btn btn-secondary" style={{ flex: 1, padding: '10px' }} onClick={() => setCancelTargetId(null)}>Không, quay lại</button>
          </div>
        </div>
      </div>
    );
  }

  // ── LIST VIEW (DEFAULT) ────────────────────────────────────────────────────
  return (
    <div className="event-manager-container" style={{ animation: 'fadeIn 0.2s ease' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
        {/* Top Header Card with Action Button */}
        <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={20} /> Quản lý Sự kiện CLB
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              Theo dõi danh sách sự kiện và lập kế hoạch chương trình mới cho câu lạc bộ
            </p>
          </div>
          <button
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontWeight: 700 }}
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={18} /> Lập kế hoạch sự kiện mới
          </button>
        </div>

        {/* Events Directory */}
        <div className="glass-card">
          <div className="glass-card-header">
            <h3 className="glass-card-title"><Calendar size={18} /> Danh sách Sự kiện của CLB</h3>
          </div>

          {loadingEvents ? (
            <div className="empty-state-view">
              <span className="login-spinner" style={{ width: '28px', height: '28px' }} />
              <p style={{ marginTop: '10px' }}>Đang tải...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="empty-state-view">
              <Calendar className="empty-state-icon" />
              <p>Chưa có sự kiện nào được tạo.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {events.map(e => {
                const eId = e.id || e.eventId;
                const eName = e.eventName || e.name;
                const eLocation = e.location || 'Chưa cập nhật';
                const eBudget = e.planBudget;
                const eStatus = e.status || e.approvalStatus || 'Pending';
                
                const isPending = eStatus === 'Pending' || eStatus === 'Chờ duyệt';
                const isApproved = eStatus === 'Approved' || eStatus === 'Đã duyệt';
                const isRejected = eStatus === 'Rejected' || eStatus === 'Từ chối';
                const isCancelled = eStatus === 'Cancelled' || eStatus === 'Đã hủy';

                return (
                  <div key={eId} className="glass-card" style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', marginBottom: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <h4 style={{ margin: 0, fontWeight: 700, fontSize: '16px', color: 'var(--text-heading)' }}>{eName}</h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '10px', fontSize: '13px', color: 'var(--text-muted)' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <MapPin size={14} /> {eLocation}
                          </span>
                          {eBudget && (
                            <span>💰 Ngân sách: {Number(eBudget).toLocaleString('vi-VN')} VNĐ</span>
                          )}
                        </div>
                        {e.startTime && (
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                            ⏱ {formatDateVN(e.startTime)}
                            {e.endTime && ` - ${formatDateVN(e.endTime)}`}
                          </div>
                        )}
                      </div>

                      <div>
                        {isPending && <span className="badge badge-pending">CHỜ DUYỆT</span>}
                        {isApproved && <span className="badge badge-success">ĐÃ DUYỆT</span>}
                        {isRejected && <span className="badge badge-blocked">BỊ TỪ CHỐI</span>}
                        {isCancelled && <span className="badge badge-blocked" style={{ filter: 'grayscale(0.6)' }}>ĐÃ HỦỶ</span>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.03)', marginTop: '14px', paddingTop: '10px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '6px 14px' }}
                        onClick={() => setSelectedEventId(eId)}
                      >
                        <Eye size={14} style={{ marginRight: '6px' }} /> Xem chi tiết
                      </button>
                      {!isCancelled && (
                        <>
                          <button
                            className="btn btn-sm"
                            title="Hủy sự kiện"
                            style={{ padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
                            onClick={() => setCancelTargetId(eId)}
                          >
                            <XCircle size={14} /> Hủy
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
