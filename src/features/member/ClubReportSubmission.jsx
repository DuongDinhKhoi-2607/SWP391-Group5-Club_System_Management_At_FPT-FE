import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Plus, FileText, Send, Clock, CheckCircle, XCircle, RefreshCw, X, HelpCircle } from 'lucide-react';
import * as clubReportService from '../../services/clubReportService';
import * as reportPeriodService from '../../services/reportPeriodService';
import * as semesterService from '../../services/semesterService';

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

export default function ClubReportSubmission({ selectedClubId, triggerNotification }) {
  const [reports, setReports] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitSuccessMsg, setSubmitSuccessMsg] = useState(null);
  
  // Submit/Edit Form State
  const [editReportId, setEditReportId] = useState(null);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [reportTitle, setReportTitle] = useState('');
  const [summaryContent, setSummaryContent] = useState('');
  const [totalEvents, setTotalEvents] = useState('0');
  const [financialBalance, setFinancialBalance] = useState('0');
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const loadData = useCallback(async () => {
    if (!selectedClubId) return;
    setLoading(true);
    
    // 1. Fetch submitted reports of this club (using /api/club-reports/my-club)
    try {
      const reportsRes = await clubReportService.getMyClubReports();
      const reportsList = Array.isArray(reportsRes) ? reportsRes : (reportsRes?.data ?? []);
      // Sort newest first
      reportsList.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
      setReports(reportsList);
    } catch (err) {
      console.warn('[ClubReportSubmission] Lỗi tải lịch sử báo cáo CLB:', err?.response?.status, err?.response?.data?.message || err?.message);
      setReports([]);
    }

    // 2. Fetch report periods of active semesters
    try {
      const semestersRes = await semesterService.getSemesters();
      const semestersList = Array.isArray(semestersRes) ? semestersRes : (semestersRes?.data ?? []);
      let activeSemesterId = null;
      if (semestersList.length > 0) {
        const activeSem = semestersList.find(s => {
          const st = String(s.status || '').trim().toLowerCase();
          if (st === 'đang diễn ra' || st === 'active' || st === 'open') return true;
          if (s.startDate && s.endDate) {
            const now = new Date();
            const start = new Date(s.startDate);
            const end = new Date(s.endDate);
            start.setHours(0,0,0,0);
            end.setHours(23,59,59,999);
            return now >= start && now <= end;
          }
          return false;
        }) || semestersList[0];
        activeSemesterId = activeSem.id || activeSem.semesterId;
      }
      
      if (activeSemesterId) {
        const periodsRes = await reportPeriodService.getReportPeriods(activeSemesterId);
        const periodsList = Array.isArray(periodsRes) ? periodsRes : (periodsRes?.data ?? []);
        setPeriods(periodsList);
      } else {
        setPeriods([]);
      }
    } catch (err) {
      console.warn('[ClubReportSubmission] Lỗi tải đợt báo cáo:', err?.response?.status, err?.response?.data?.message || err?.message);
      setPeriods([]);
    } finally {
      setLoading(false);
    }
  }, [selectedClubId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenCreate = () => {
    setEditReportId(null);
    setSelectedPeriodId('');
    setReportTitle('');
    setSummaryContent('');
    setTotalEvents('0');
    setFinancialBalance('0');
    setFormErrors({});
    setShowSubmitModal(true);
  };

  const handleOpenEdit = (rep) => {
    setEditReportId(rep.clubReportId || rep.id);
    setSelectedPeriodId(String(rep.reportPeriodId || ''));
    setReportTitle(rep.reportTitle || '');
    setSummaryContent(rep.summaryContent || rep.content || '');
    setTotalEvents(String(rep.totalEventsHeld || 0));
    setFinancialBalance(String(rep.financialBalance || 0));
    setFormErrors({});
    setShowSubmitModal(true);
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!editReportId) {
      if (!selectedPeriodId) {
        errors.selectedPeriodId = 'Vui lòng chọn đợt báo cáo!';
      } else {
        const alreadySubmitted = reports.some(r => Number(r.reportPeriodId) === Number(selectedPeriodId));
        if (alreadySubmitted) {
          errors.selectedPeriodId = 'Đợt báo cáo này đã được nộp báo cáo trước đó!';
        }
      }
    }
    if (!reportTitle.trim()) errors.reportTitle = 'Tiêu đề báo cáo không được trống!';
    if (!summaryContent.trim()) errors.summaryContent = 'Nội dung tóm tắt không được trống!';
    
    if (totalEvents === '') {
      errors.totalEvents = 'Số lượng sự kiện không được trống và chỉ được nhập số!';
    } else if (isNaN(totalEvents) || parseInt(totalEvents, 10) < 0) {
      errors.totalEvents = 'Số lượng sự kiện phải là số nguyên không âm!';
    }

    if (financialBalance === '') {
      errors.financialBalance = 'Số dư tài chính không được trống và chỉ được nhập số!';
    } else if (isNaN(financialBalance) || parseFloat(financialBalance) < 0) {
      errors.financialBalance = 'Số dư tài chính phải là số không âm!';
    }


    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    setSubmitting(true);
    try {
      if (editReportId) {
        // Update existing report
        await clubReportService.updateClubReport(editReportId, {
          reportTitle: reportTitle.trim(),
          summaryContent: summaryContent.trim(),
          totalEventsHeld: parseInt(totalEvents, 10),
          financialBalance: parseFloat(financialBalance)
        });
        setSubmitSuccessMsg({
          title: 'Cập nhật báo cáo thành công!',
          desc: 'Các thay đổi trong báo cáo của bạn đã được cập nhật thành công.'
        });
      } else {
        // Submit new report
        await clubReportService.createClubReport({
          reportPeriodId: parseInt(selectedPeriodId, 10),
          reportTitle: reportTitle.trim(),
          summaryContent: summaryContent.trim(),
          totalEventsHeld: parseInt(totalEvents, 10),
          financialBalance: parseFloat(financialBalance)
        });
        setSubmitSuccessMsg({
          title: 'Gửi báo cáo thành công!',
          desc: 'Báo cáo hoạt động của bạn đã được nộp lên hệ thống thành công và đang chờ phê duyệt.'
        });
      }
      
      // Reset form fields
      setEditReportId(null);
      setSelectedPeriodId('');
      setReportTitle('');
      setSummaryContent('');
      setTotalEvents('0');
      setFinancialBalance('0');
      
      // Reload reports list immediately
      await loadData();
    } catch (err) {
      console.error('[ClubReportSubmission] Error submitting report:', err);
      triggerNotification(err?.response?.data?.message || 'Thao tác thất bại!', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── SUBMIT / EDIT REPORT VIEW ──────────────────────────────────────────────
  if (showSubmitModal) {
    return (
      <div style={{ animation: 'fadeIn 0.2s ease' }}>
        <div className="glass-card" style={{ marginBottom: '20px', padding: '12px 20px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => { setShowSubmitModal(false); setSubmitSuccessMsg(null); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}
          >
            <X size={16} /> Quay lại Báo cáo Hoạt động
          </button>
        </div>
        
        <div className="glass-card" style={{ maxWidth: '700px', margin: '0 auto' }}>
          <div className="glass-card-header" style={{ marginBottom: '16px' }}>
            <h3 className="glass-card-title"><FileText size={18} style={{ marginRight: '6px' }} /> {editReportId ? 'Chỉnh sửa Báo cáo Hoạt động' : 'Nộp Báo cáo Hoạt động mới'}</h3>
          </div>
          
          {submitSuccessMsg ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '32px 0', textAlign: 'center' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(34,197,94,0.1)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle size={36} />
              </div>
              <div>
                <h4 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '8px' }}>{submitSuccessMsg.title}</h4>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', maxWidth: '420px', lineHeight: 1.6 }}>{submitSuccessMsg.desc}</p>
              </div>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={() => {
                  setShowSubmitModal(false);
                  setSubmitSuccessMsg(null);
                }}
                style={{ minWidth: '140px', marginTop: '12px' }}
              >
                Đóng
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmitReport} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Đợt báo cáo *</label>
                <select 
                  className="select-field"
                  value={selectedPeriodId}
                  onChange={e => {
                    setSelectedPeriodId(e.target.value);
                    if (formErrors.selectedPeriodId) setFormErrors(prev => ({ ...prev, selectedPeriodId: null }));
                  }}
                  disabled={!!editReportId}
                  style={editReportId ? { opacity: 0.6 } : {}}
                >
                  <option value="">-- Chọn đợt báo cáo --</option>
                  {periods.map(p => {
                    const pId = p.reportPeriodId || p.id;
                    const isAlreadySubmitted = reports.some(r => Number(r.reportPeriodId) === Number(pId));
                    return (
                      <option key={pId} value={pId} disabled={isAlreadySubmitted}>
                        {p.periodName} (Hạn nộp: {p.deadline ? new Date(p.deadline).toLocaleDateString('vi-VN') : '—'}){isAlreadySubmitted ? ' - [Đã nộp]' : ''}
                      </option>
                    );
                  })}
                </select>
                {formErrors.selectedPeriodId && <span style={{ fontSize: '12px', color: 'var(--error)', marginTop: '4px', display: 'block' }}>{formErrors.selectedPeriodId}</span>}
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Tiêu đề báo cáo *</label>
                <input 
                  type="text"
                  className="input-field"
                  placeholder="Ví dụ: Báo cáo hoạt động JS Club tháng 6"
                  value={reportTitle}
                  onChange={e => {
                    setReportTitle(e.target.value);
                    if (formErrors.reportTitle) setFormErrors(prev => ({ ...prev, reportTitle: null }));
                  }}
                />
                {formErrors.reportTitle && <span style={{ fontSize: '12px', color: 'var(--error)', marginTop: '4px', display: 'block' }}>{formErrors.reportTitle}</span>}
              </div>

               <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Số lượng sự kiện đã tổ chức *</label>
                <input 
                  type="text"
                  className="input-field"
                  value={totalEvents}
                  onChange={e => {
                    const cleanVal = e.target.value.replace(/[^0-9]/g, '');
                    setTotalEvents(cleanVal);
                    if (formErrors.totalEvents) setFormErrors(prev => ({ ...prev, totalEvents: null }));
                  }}
                />
                {formErrors.totalEvents && <span style={{ fontSize: '12px', color: 'var(--error)', marginTop: '4px', display: 'block' }}>{formErrors.totalEvents}</span>}
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Số dư tài chính (VND) *</label>
                <input 
                  type="text"
                  className="input-field"
                  placeholder="Ví dụ: 5000000"
                  value={financialBalance}
                  onChange={e => {
                    const cleanVal = e.target.value.replace(/[^0-9]/g, '');
                    setFinancialBalance(cleanVal);
                    if (formErrors.financialBalance) setFormErrors(prev => ({ ...prev, financialBalance: null }));
                  }}
                />
                {formErrors.financialBalance && <span style={{ fontSize: '12px', color: 'var(--error)', marginTop: '4px', display: 'block' }}>{formErrors.financialBalance}</span>}
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Nội dung tóm tắt hoạt động *</label>
                <textarea 
                  className="textarea-field"
                  placeholder="Mô tả tóm tắt các hoạt động, sự kiện chính đã triển khai..."
                  rows={6}
                  value={summaryContent}
                  onChange={e => {
                    setSummaryContent(e.target.value);
                    if (formErrors.summaryContent) setFormErrors(prev => ({ ...prev, summaryContent: null }));
                  }}
                />
                {formErrors.summaryContent && <span style={{ fontSize: '12px', color: 'var(--error)', marginTop: '4px', display: 'block' }}>{formErrors.summaryContent}</span>}
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <button type="button" className="btn btn-secondary" style={{ padding: '10px 24px' }} onClick={() => { setShowSubmitModal(false); setSubmitSuccessMsg(null); }}>Đóng</button>
                <button type="submit" className="btn btn-primary" disabled={submitting} style={{ padding: '10px 24px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <Send size={16} /> {submitting ? 'Đang gửi...' : (editReportId ? 'Lưu thay đổi' : 'Nộp báo cáo')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="user-management-container">
      {/* Top action row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-heading)', margin: 0 }}>
          Báo cáo hoạt động CLB
        </h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary btn-sm" onClick={loadData} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <RefreshCw size={14} /> Làm mới
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleOpenCreate} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Plus size={14} /> Nộp Báo cáo mới
          </button>
        </div>
      </div>

      {/* Reports list */}
      <div className="glass-card">
        <div className="glass-card-header">
          <h3 className="glass-card-title"><ClipboardList size={18} /> Lịch sử Báo cáo Hoạt động</h3>
        </div>

        {loading ? (
          <div className="empty-state-view">
            <span className="login-spinner" style={{ width: '28px', height: '28px' }} />
          </div>
        ) : reports.length === 0 ? (
          <div className="empty-state-view">
            <ClipboardList className="empty-state-icon" />
            <p>Chưa có báo cáo hoạt động nào được nộp cho CLB này.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
            {reports.map((rep) => {
              const repId = rep.clubReportId || rep.id;
              const cfg = getStatusConfig(rep.status);
              const isEditable = rep.status === 'Chờ Manager duyệt' || rep.status === 'Từ chối' || rep.status === 'Submitted' || rep.status === 'Rejected' || rep.status === 'Chờ duyệt';
              
              return (
                <div key={repId} className="glass-card" style={{ padding: '16px', marginBottom: 0, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.01)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 650, color: 'var(--text-heading)', fontSize: '14px' }}>
                            {rep.reportTitle}
                          </span>
                          <span className={`badge ${cfg.className}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', padding: '2px 8px', ...cfg.style }}>
                            {cfg.icon} {cfg.label}
                          </span>
                        </div>
                        {isEditable && (
                          <button className="btn btn-secondary btn-sm" onClick={() => handleOpenEdit(rep)} style={{ padding: '3px 8px', fontSize: '11px', height: 'auto', display: 'inline-flex', alignItems: 'center' }}>
                            Chỉnh sửa
                          </button>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Đợt báo cáo: <span style={{ color: 'var(--text-main)' }}>{rep.reportPeriodName || rep.periodName || '—'}</span> · 
                        Số sự kiện tổ chức: <span style={{ color: 'var(--text-main)' }}>{rep.totalEventsHeld || 0}</span> ·
                        Số dư tài chính: <span style={{ color: 'var(--text-main)' }}>{rep.financialBalance !== undefined ? rep.financialBalance.toLocaleString('vi-VN') + ' đ' : '0 đ'}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Ngày nộp: {rep.submittedAt ? new Date(rep.submittedAt).toLocaleString('vi-VN') : '—'}
                      </div>

                      {/* Summary contents */}
                      <div style={{ background: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '6px', fontSize: '12.5px', marginTop: '10px', border: '1px dashed var(--border)', color: 'var(--text-main)' }}>
                        <strong>Nội dung tóm tắt:</strong><br />
                        {rep.summaryContent || rep.content}
                      </div>

                      {/* Notes / Feedback sent down from Manager / Admin */}
                      {(rep.managerNote || rep.icpdpFeedback) && (
                        <div style={{ background: 'rgba(249, 115, 22, 0.04)', padding: '10px', borderRadius: '6px', fontSize: '12px', marginTop: '10px', borderLeft: '3px solid var(--primary)', color: 'var(--text-muted)' }}>
                          <strong>Phản hồi từ Ban Quản lý:</strong> {rep.managerNote || rep.icpdpFeedback}
                        </div>
                      )}
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
