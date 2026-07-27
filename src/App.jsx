import React, { useState, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

import Sidebar from './layouts/Sidebar';
import Header from './layouts/Header';
import Toast from './components/Toast';
import ProtectedRoute from './routes/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import ClubSelectorPage from './pages/ClubSelectorPage';
import ConfirmActivationPage from './pages/ConfirmActivationPage';

// ── Admin Pages ────────────────────────────────────────────────────────────────
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import SemesterConfigPage from './pages/admin/SemesterConfigPage';
import ReportAppraisalPage from './pages/admin/ReportAppraisalPage';
import UserManagementPage from './pages/admin/UserManagementPage';
import ClubManagementPage from './pages/admin/ClubManagementPage';

// ── Manager Pages ──────────────────────────────────────────────────────────────
import ManagerDashboardPage from './pages/manager/ManagerDashboardPage';
import EventApprovalPage from './pages/admin/EventApprovalPage';
import ReviewMemberReportsPage from './pages/manager/ReviewMemberReportsPage';

// ── Member / Leader Pages ──────────────────────────────────────────────────────
import MemberDashboardPage from './pages/member/MemberDashboardPage';
import ClubInfoPage from './pages/manager/ClubInfoPage';
import DocumentArchivePage from './pages/manager/DocumentArchivePage';
import EventCalendarPage from './pages/member/EventCalendarPage';
import MemberWorkspacePage from './pages/member/MemberWorkspacePage';
import MemberSearchPage from './pages/member/MemberSearchPage';
import MemberManagementPage from './pages/manager/MemberManagementPage';
import EventManagerPage from './pages/manager/EventManagerPage';
import ClubAnnouncementsPage from './pages/member/ClubAnnouncementsPage';
import ClubReportPage from './pages/member/ClubReportPage';
import AlumniSearch from './features/member/AlumniSearch';

// Shared: Evidence Approval (for both Manager and Leader)
import EvidenceApprovalPage from './pages/admin/EvidenceApprovalPage';

// Shared: Notification Management (for both Admin and Manager)
import NotificationManagementPage from './pages/shared/NotificationManagementPage';

import { Bell } from 'lucide-react';

// ─── Shared Dashboard Layout ──────────────────────────────────────────────────
function DashboardLayout({ role, activeTab, setActiveTab, children, triggerNotification, selectedClubId, isLeader = false }) {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const getPageTitle = () => {
    // ADMIN
    if (role === 'ADMIN') {
      if (activeTab === 'dashboard') return 'Dashboard';
      if (activeTab === 'user-management') return 'Quản lý Người dùng';
      if (activeTab === 'club-management') return 'Quản lý CLB';
      if (activeTab === 'semester-config') return 'Quản lý Học kỳ';
      if (activeTab === 'report-appraisal') return 'Report Review';
      if (activeTab === 'notification-management') return 'Gửi Thông báo';
      if (activeTab === 'my-profile') return 'Hồ sơ cá nhân';
      return 'Dashboard';
    }
    // MANAGER
    if (role === 'MANAGER') {
      if (activeTab === 'dashboard') return 'Dashboard';
      if (activeTab === 'event-approval') return 'Duyệt Sự kiện';
      if (activeTab === 'event-monitoring') return 'Theo dõi Sự kiện';
      if (activeTab === 'evidence-review') return 'Kiểm tra Chứng nhận';
      if (activeTab === 'club-report-review') return 'Kiểm tra Báo cáo CLB';
      if (activeTab === 'notification-management') return 'Thông báo CLB';
      if (activeTab === 'my-profile') return 'Hồ sơ cá nhân';
      return 'Dashboard';
    }
    // MEMBER / LEADER
    if (activeTab === 'dashboard') return 'Dashboard';
    if (activeTab === 'club-info') return 'Thông tin CLB';
    if (activeTab === 'document-archive') return 'Tài liệu CLB';
    if (activeTab === 'document-upload') return 'Tài liệu CLB (Upload)';
    if (activeTab === 'member-search') return 'Thành viên CLB';
    if (activeTab === 'alumni-search') return 'Cựu thành viên';
    if (activeTab === 'event-calendar') return 'Sự kiện';
    if (activeTab === 'member-workspace') return 'Nộp minh chứng';
    if (activeTab === 'my-profile') return 'Hồ sơ cá nhân';
    if (activeTab === 'club-announcements') return 'Thông báo CLB';
    if (activeTab === 'member-management') return 'Quản lý Thành viên';
    if (activeTab === 'event-manager') return 'Quản lý Sự kiện';
    if (activeTab === 'evidence-review') return 'Kiểm tra Chứng nhận';
    if (activeTab === 'club-report') return 'Báo cáo Hoạt động CLB';
    return 'Dashboard';
  };

  const handleSwitchClub = () => {
    sessionStorage.removeItem('fpt_selected_club');
    navigate('/select-club');
  };

  return (
    <div className="app-container">
      <Sidebar
        currentRole={role}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUserProfile={currentUser}
        isLeader={isLeader}
      />
      <main className="main-viewport">
        <Header
          currentRole={role}
          isLeader={isLeader}
          selectedClubId={selectedClubId}
          dbData={{ clubs: [], memberships: [] }}
          pageTitle={getPageTitle()}
          triggerNotification={triggerNotification}
          onSwitchClub={handleSwitchClub}
        />
        <div className="content-wrapper">
          {children}
        </div>
      </main>
    </div>
  );
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────
function AdminDashboard({ triggerNotification }) {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  return (
    <DashboardLayout role="ADMIN" activeTab={activeTab} setActiveTab={setActiveTab} triggerNotification={triggerNotification}>
      {activeTab === 'dashboard' && <AdminDashboardPage triggerNotification={triggerNotification} />}
      {activeTab === 'user-management' && <UserManagementPage triggerNotification={triggerNotification} />}
      {activeTab === 'club-management' && <ClubManagementPage triggerNotification={triggerNotification} />}
      {activeTab === 'semester-config' && <SemesterConfigPage triggerNotification={triggerNotification} />}
      {activeTab === 'report-appraisal' && <ReportAppraisalPage triggerNotification={triggerNotification} />}
      {activeTab === 'notification-management' && <NotificationManagementPage triggerNotification={triggerNotification} />}
      {activeTab === 'my-profile' && <MemberWorkspacePage currentUserId={currentUser?.id || currentUser?.userId || currentUser?.username} triggerNotification={triggerNotification} selectedClubId={null} mode="profile" />}
    </DashboardLayout>
  );
}

// ─── Manager Dashboard ────────────────────────────────────────────────────────
function ManagerDashboard({ triggerNotification }) {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <DashboardLayout
      role="MANAGER"
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      triggerNotification={triggerNotification}
      selectedClubId={null}
      isLeader={false}
    >
      {activeTab === 'dashboard' && <ManagerDashboardPage triggerNotification={triggerNotification} />}
      {activeTab === 'event-approval' && <EventApprovalPage triggerNotification={triggerNotification} selectedClubId={null} mode="approval" />}
      {activeTab === 'event-monitoring' && <EventApprovalPage triggerNotification={triggerNotification} selectedClubId={null} mode="monitoring" />}
      {activeTab === 'evidence-review' && <EvidenceApprovalPage triggerNotification={triggerNotification} selectedClubId={null} />}
      {activeTab === 'club-report-review' && <ReviewMemberReportsPage triggerNotification={triggerNotification} />}
      {activeTab === 'notification-management' && <NotificationManagementPage triggerNotification={triggerNotification} />}
      {activeTab === 'my-profile' && <MemberWorkspacePage currentUserId={currentUser?.id || currentUser?.userId || currentUser?.username} triggerNotification={triggerNotification} selectedClubId={null} mode="profile" />}
    </DashboardLayout>
  );
}

// ─── Member Dashboard ─────────────────────────────────────────────────────────
function MemberDashboard({ triggerNotification }) {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  const savedClubId = sessionStorage.getItem('fpt_selected_club');
  const availableClubsStr = sessionStorage.getItem('fpt_available_clubs');
  const availableClubs = availableClubsStr ? JSON.parse(availableClubsStr) : null;

  let resolvedClubId = savedClubId;
  if (!resolvedClubId && availableClubs && availableClubs.length > 0) {
    resolvedClubId = String(availableClubs[0]?.clubId || availableClubs[0]?.id || '');
    if (resolvedClubId) sessionStorage.setItem('fpt_selected_club', resolvedClubId);
  }
  if (!resolvedClubId && currentUser?.clubId) {
    resolvedClubId = String(currentUser.clubId);
    sessionStorage.setItem('fpt_selected_club', resolvedClubId);
  }

  const [selectedClubId] = useState(resolvedClubId);

  if (!selectedClubId) return <Navigate to="/select-club" replace />;

  // Determine isLeader — ưu tiên fpt_club_role (lưu lúc chọn CLB)
  const storedClubRole = sessionStorage.getItem('fpt_club_role');
  let isLeader = storedClubRole ? ['LEADER', 'MANAGER', 'CHAIRMAN'].includes(storedClubRole.toUpperCase()) : false;

  // Fallback: tính từ availableClubs nếu chưa có fpt_club_role
  if (!storedClubRole && availableClubs) {
    const myClub = availableClubs.find(c => String(c.clubId || c.id) === String(selectedClubId));
    if (myClub) {
      const roleRaw = myClub.role || myClub.clubRole || myClub.roleName || myClub.memberRole || myClub.position || '';
      const role = roleRaw.toUpperCase();
      isLeader = role === 'LEADER' || role === 'MANAGER' || role === 'CHAIRMAN' || role === 'PRESIDENT';
      if (!isLeader && (myClub.isLeader === true || myClub.isChairman === true)) isLeader = true;
    }
  }
  if (!isLeader && currentUser?.role === 'MANAGER') isLeader = true;
  // Fallback: check sessionStorage nếu có lưu role CLB riêng
  if (!isLeader) {
    const storedClubRole = sessionStorage.getItem('fpt_club_role');
    if (storedClubRole) {
      const r = storedClubRole.toUpperCase();
      isLeader = r === 'LEADER' || r === 'MANAGER' || r === 'CHAIRMAN';
    }
  }

  return (
    <DashboardLayout
      role="MEMBER"
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      triggerNotification={triggerNotification}
      selectedClubId={selectedClubId}
      isLeader={isLeader}
    >
      {/* All Members */}
      {activeTab === 'dashboard' && <MemberDashboardPage selectedClubId={selectedClubId} triggerNotification={triggerNotification} />}
      {activeTab === 'club-info' && <ClubInfoPage selectedClubId={selectedClubId} triggerNotification={triggerNotification} readOnly={!isLeader} />}
      {activeTab === 'document-archive' && <DocumentArchivePage selectedClubId={selectedClubId} triggerNotification={triggerNotification} readOnly={!isLeader} />}
      {activeTab === 'member-search' && <MemberSearchPage currentUserId={currentUser.id} selectedClubId={selectedClubId} />}
      {activeTab === 'alumni-search' && <AlumniSearch selectedClubId={selectedClubId} />}
      {activeTab === 'event-calendar' && <EventCalendarPage currentUserId={currentUser.id} triggerNotification={triggerNotification} selectedClubId={selectedClubId} />}
      {activeTab === 'member-workspace' && <MemberWorkspacePage currentUserId={currentUser.id} triggerNotification={triggerNotification} selectedClubId={selectedClubId} mode="evidence" />}
      {activeTab === 'my-profile' && <MemberWorkspacePage currentUserId={currentUser.id} triggerNotification={triggerNotification} selectedClubId={selectedClubId} mode="profile" />}
      {activeTab === 'club-announcements' && <ClubAnnouncementsPage selectedClubId={selectedClubId} triggerNotification={triggerNotification} isLeader={isLeader} />}

      {/* Leader-only tabs */}
      {activeTab === 'member-management' && (
        <MemberManagementPage selectedClubId={selectedClubId} triggerNotification={triggerNotification} />
      )}
      {activeTab === 'event-manager' && (
        <EventManagerPage selectedClubId={selectedClubId} triggerNotification={triggerNotification} />
      )}
      {activeTab === 'evidence-review' && (
        <EvidenceApprovalPage triggerNotification={triggerNotification} selectedClubId={selectedClubId} />
      )}
      {activeTab === 'club-report' && (
        <ClubReportPage selectedClubId={selectedClubId} triggerNotification={triggerNotification} />
      )}
      {activeTab === 'document-upload' && (
        <DocumentArchivePage selectedClubId={selectedClubId} triggerNotification={triggerNotification} readOnly={false} />
      )}
    </DashboardLayout>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [toast, setToast] = useState(null);

  const triggerNotification = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/select-club" element={<ClubSelectorPage />} />
        <Route path="/confirm-activation" element={<ConfirmActivationPage />} />
        <Route path="/admin/*" element={
          <ProtectedRoute requiredRole="ADMIN">
            <AdminDashboard triggerNotification={triggerNotification} />
          </ProtectedRoute>
        } />
        <Route path="/manager/*" element={
          <ProtectedRoute requiredRole="MANAGER">
            <ManagerDashboard triggerNotification={triggerNotification} />
          </ProtectedRoute>
        } />
        <Route path="/member/*" element={
          <ProtectedRoute requiredRole="MEMBER">
            <MemberDashboard triggerNotification={triggerNotification} />
          </ProtectedRoute>
        } />
        {/* Default: redirect to login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>

      {toast && (
        <div className="toast-container">
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        </div>
      )}
    </>
  );
}
