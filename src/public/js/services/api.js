// Centralized API Service
import { handleSessionExpired, isSessionExpiredHandled } from './session.js';

const BASE_URL = '/api';

function getHeaders(customHeaders = {}) {
  const headers = { ...customHeaders };
  const token = localStorage.getItem('forge_jwt_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function requestApi(endpoint, options = {}) {
  const url =
    endpoint.startsWith('/api') || endpoint.startsWith('http')
      ? endpoint
      : `${BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: getHeaders(options.headers || {})
  });

  let data;
  try {
    data = await response.json();
  } catch (_) {
    data = { success: false, error: 'Server returned an invalid or empty response' };
  }

  if (!response.ok) {
    // An expired or invalid session is not an "API error" the user can act on —
    // tear the session down once and let the login view explain what happened.
    // Every other in-flight 401 is swallowed so we never stack duplicate toasts.
    if (response.status === 401) {
      const alreadyHandled = isSessionExpiredHandled();
      handleSessionExpired();
      const err = new Error('Session expired');
      err.status = 401;
      err.handled = true;
      err.silent = alreadyHandled;
      throw err;
    }

    let errorMsg = data.error || data.message || `Request failed with status ${response.status}`;
    if (Array.isArray(data.details)) {
      const detailStr = data.details.map(d => `${d.path ? d.path.join('.') + ': ' : ''}${d.message}`).join(', ');
      if (detailStr) errorMsg += ` (${detailStr})`;
    }

    try {
      const { showToast } = await import('../components/toast.js');
      showToast({ title: 'Something went wrong', message: errorMsg, type: 'error' });
    } catch (_) {}

    const err = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

export async function fetchCurrentUser() {
  return requestApi('/auth/me');
}

export async function loginUser(identifier, password) {
  return requestApi('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password })
  });
}

export async function registerUser(userData) {
  return requestApi('/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
}

export async function changePassword(currentPassword, newPassword) {
  return requestApi('/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword })
  });
}

export async function fetchDevSettings() {
  return requestApi('/dev/settings');
}

export async function updateDevSettings(settings) {
  return requestApi('/dev/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  });
}

export async function fetchAllUsers() {
  return requestApi('/users');
}

export async function updateUserProfile(targetUserId, profileData) {
  return requestApi(`/users/${targetUserId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profileData)
  });
}

export async function deleteUser(targetUserId) {
  return requestApi(`/users/${targetUserId}`, {
    method: 'DELETE'
  });
}

export async function fetchTasks() {
  return requestApi('/tasks');
}

export async function filterTasks(params = {}) {
  const query = new URLSearchParams();
  if (params.status) query.append('status', params.status);
  if (params.difficulty) query.append('difficulty', params.difficulty);
  if (params.task_type) query.append('task_type', params.task_type);
  if (params.assigned_to) query.append('assigned_to', params.assigned_to);
  if (params.search) query.append('search', params.search);

  const queryString = query.toString();
  return requestApi(`/tasks${queryString ? '?' + queryString : ''}`);
}

export async function fetchTaskDetails(taskId) {
  return requestApi(`/tasks/${taskId}`);
}

export async function createTask(taskData) {
  return requestApi('/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(taskData)
  });
}

export async function updateTask(taskId, taskData) {
  return requestApi(`/tasks/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(taskData)
  });
}

export async function updateTaskStatus(taskId, status) {
  return requestApi(`/tasks/${taskId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
}

export async function deleteTask(taskId) {
  return requestApi(`/tasks/${taskId}`, {
    method: 'DELETE'
  });
}

export async function suggestTask({ title, description, total_points, task_type, mode, user_id }) {
  return requestApi('/tasks/suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description, total_points, task_type, mode, user_id })
  });
}

export async function upvoteTask(taskId) {
  return requestApi(`/tasks/${taskId}/upvote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function assignTask(taskId, { team_id, user_id, task_type, assigned_by }) {
  return requestApi(`/tasks/${taskId}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ team_id, user_id, task_type, assigned_by })
  });
}

export async function submitTaskProof(taskId, formData) {
  return requestApi(`/tasks/${taskId}/submit`, {
    method: 'POST',
    body: formData
  });
}

export async function approveTask(taskId, { submission_id, reviewed_by } = {}) {
  return requestApi(`/tasks/${taskId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ submission_id, reviewed_by })
  });
}

export async function fetchTeams() {
  return requestApi('/teams');
}

export async function createTeam({ name, captain_id, member_ids, task_id, created_by }) {
  return requestApi('/teams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, captain_id, member_ids, task_id, created_by })
  });
}

export async function overridePoints(teamId, userId, customPointShare) {
  return requestApi(`/teams/${teamId}/points/override`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, custom_point_share: customPointShare })
  });
}

export async function dissolveTeam(teamId, reason = 'MANUAL') {
  return requestApi(`/teams/${teamId}/dissolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason })
  });
}

export async function fetchHallOfFame() {
  return requestApi('/hall-of-fame');
}

export async function awardTitle(data) {
  return requestApi('/hall-of-fame/award', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

// Notification Engine API Service
export async function fetchNotifications(unreadOnly = false) {
  return requestApi(`/notifications?unreadOnly=${unreadOnly}`);
}

export async function fetchUnreadNotificationCount() {
  return requestApi('/notifications/count');
}

export async function markNotificationAsRead(id) {
  return requestApi(`/notifications/${id}/read`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function markAllNotificationsAsRead() {
  return requestApi('/notifications/read-all', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function triggerTestNotification(title, message, type = 'INFO') {
  return requestApi('/notifications/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, message, type })
  });
}

// Activity Logging API Service
export async function fetchGlobalActivity(params = {}) {
  const query = new URLSearchParams();
  if (params.type) query.append('type', params.type);
  if (params.user || params.userId) query.append('user', params.user || params.userId);
  if (params.startDate) query.append('startDate', params.startDate);
  if (params.endDate) query.append('endDate', params.endDate);
  if (params.limit) query.append('limit', params.limit);
  if (params.offset) query.append('offset', params.offset);

  return requestApi(`/activity?${query.toString()}`);
}

export async function fetchUserActivity(userId, params = {}) {
  const query = new URLSearchParams();
  if (params.type) query.append('type', params.type);
  if (params.startDate) query.append('startDate', params.startDate);
  if (params.endDate) query.append('endDate', params.endDate);
  if (params.limit) query.append('limit', params.limit);
  if (params.offset) query.append('offset', params.offset);

  return requestApi(`/activity/user/${userId}?${query.toString()}`);
}

// --- Messaging (Channels) ---

export async function fetchChannels() {
  return requestApi('/channels');
}

export async function createChannel(channelData) {
  return requestApi('/channels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(channelData)
  });
}

export async function fetchChannelMessages(channelId, limit = 50) {
  return requestApi(`/channels/${channelId}/messages?limit=${limit}`);
}

export async function sendChannelMessage(channelId, content) {
  return requestApi(`/channels/${channelId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content })
  });
}

export async function editChannelMessage(messageId, content) {
  return requestApi(`/messages/${messageId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content })
  });
}

export async function deleteChannelMessage(messageId) {
  return requestApi(`/messages/${messageId}`, { method: 'DELETE' });
}

// --- Announcements ---

export async function fetchAnnouncements() {
  return requestApi('/announcements');
}

export async function createAnnouncement(announcementData) {
  return requestApi('/announcements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(announcementData)
  });
}

export async function updateAnnouncement(announcementId, fields) {
  return requestApi(`/announcements/${announcementId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields)
  });
}

export async function deleteAnnouncement(announcementId) {
  return requestApi(`/announcements/${announcementId}`, { method: 'DELETE' });
}

// --- Progression ---

export async function fetchProgression() {
  return requestApi('/progression/me');
}

export async function fetchAchievements() {
  return requestApi('/progression/achievements');
}

// --- Forum & voting ---

export async function fetchThreads(params = {}) {
  const query = new URLSearchParams();
  if (params.category) query.append('category', params.category);
  if (params.sort) query.append('sort', params.sort);
  const qs = query.toString();
  return requestApi(`/forum/threads${qs ? '?' + qs : ''}`);
}

export async function fetchThread(threadId) {
  return requestApi(`/forum/threads/${threadId}`);
}

export async function createThread(data) {
  return requestApi('/forum/threads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

export async function replyToThread(threadId, content) {
  return requestApi(`/forum/threads/${threadId}/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content })
  });
}

export async function acceptAnswer(threadId, postId) {
  return requestApi(`/forum/threads/${threadId}/accept/${postId}`, { method: 'POST' });
}

export async function castVote(targetType, targetId, value) {
  return requestApi('/votes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_type: targetType, target_id: targetId, value })
  });
}

// --- Marketplace ---

export async function fetchSuggestions() {
  return requestApi('/marketplace');
}

export async function createSuggestion(data) {
  return requestApi('/marketplace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

export async function promoteSuggestion(id, data = {}) {
  return requestApi(`/marketplace/${id}/promote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

// --- Subtasks ---

export async function fetchSubtasks(taskId) {
  return requestApi(`/tasks/${taskId}/subtasks`);
}

export async function createSubtask(taskId, title) {
  return requestApi(`/tasks/${taskId}/subtasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title })
  });
}

export async function toggleSubtask(id, isCompleted) {
  return requestApi(`/subtasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_completed: isCompleted })
  });
}

export async function deleteSubtask(id) {
  return requestApi(`/subtasks/${id}`, { method: 'DELETE' });
}

// --- Calendar ---

export async function fetchCalendar(params = {}) {
  const query = new URLSearchParams();
  if (params.from) query.append('from', params.from);
  if (params.to) query.append('to', params.to);
  const qs = query.toString();
  return requestApi(`/calendar${qs ? '?' + qs : ''}`);
}

export async function createCalendarEvent(data) {
  return requestApi('/calendar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

export async function deleteCalendarEvent(id) {
  return requestApi(`/calendar/${id}`, { method: 'DELETE' });
}

// --- Journal ---

export async function fetchJournal() {
  return requestApi('/journal');
}

export async function createJournalEntry(data) {
  return requestApi('/journal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

export async function deleteJournalEntry(id) {
  return requestApi(`/journal/${id}`, { method: 'DELETE' });
}

// --- Analytics ---

export async function fetchAnalytics() {
  return requestApi('/analytics');
}

// --- Quizzes & puzzles ---

export async function fetchQuizzes(kind) {
  return requestApi(`/quizzes${kind ? `?kind=${kind}` : ''}`);
}

export async function fetchQuiz(id) {
  return requestApi(`/quizzes/${id}`);
}

export async function fetchDailyPuzzle() {
  return requestApi('/quizzes/daily');
}

export async function submitQuiz(id, answers, durationSeconds) {
  return requestApi(`/quizzes/${id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers, duration_seconds: durationSeconds })
  });
}

export async function fetchQuizLeaderboard() {
  return requestApi('/quizzes/leaderboard');
}

// --- Review workflow ---

export async function fetchReviewQueue() {
  return requestApi('/reviews/queue');
}

export async function fetchReviewDetail(submissionId) {
  return requestApi(`/submissions/${submissionId}/review`);
}

export async function submitReview(submissionId, payload) {
  return requestApi(`/submissions/${submissionId}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function addReviewComment(submissionId, body) {
  return requestApi(`/submissions/${submissionId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body })
  });
}

export async function fetchRubric(taskId) {
  return requestApi(`/tasks/${taskId}/rubric`);
}

export async function defineRubric(taskId, criteria) {
  return requestApi(`/tasks/${taskId}/rubric`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ criteria })
  });
}

// --- Profile privacy ---

export async function fetchProfileSettings() {
  return requestApi('/profile/settings');
}

export async function updateProfileSettings(settings) {
  return requestApi('/profile/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  });
}

// --- Search ---

export async function search(query) {
  return requestApi(`/search?q=${encodeURIComponent(query)}`);
}
