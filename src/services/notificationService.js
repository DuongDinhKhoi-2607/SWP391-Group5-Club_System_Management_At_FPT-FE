import apiClient from '../utils/apiClient';

/**
 * Notification Service
 * Tương ứng với /api/notifications trong Swagger
 */

/**
 * Tạo/gửi thông báo mới
 * POST /api/notifications
 * @param {Object} dto - CreateNotificationDto
 *   { title, content, notificationType, targetType, targetRole, clubId, targetUserIds, eventId, clubReportId, reportPeriodId }
 */
export async function createNotification(dto) {
  const response = await apiClient.post('/api/notifications', dto);
  return response.data;
}

/**
 * Lấy danh sách thông báo chung
 * GET /api/notifications
 */
export async function getNotifications() {
  const response = await apiClient.get('/api/notifications');
  return response.data;
}

/**
 * Lấy danh sách thông báo của tôi (cá nhân)
 * GET /api/notifications/my
 */
export async function getMyNotifications(clubId) {
  let url = '/api/notifications/my';
  if (clubId) {
    url += `?clubId=${clubId}`;
  }
  const response = await apiClient.get(url);
  return response.data;
}

/**
 * Đánh dấu thông báo đã đọc
 * PATCH /api/notifications/{notificationId}/read
 */
export async function markAsRead(notificationId) {
  const response = await apiClient.patch(`/api/notifications/${notificationId}/read`);
  return response.data;
}
