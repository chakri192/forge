// Centralized API Service

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
  const url = endpoint.startsWith('/') ? endpoint : `${BASE_URL}/${endpoint}`;
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
    let errorMsg = data.error || data.message || `Request failed with status ${response.status}`;
    if (Array.isArray(data.details)) {
      const detailStr = data.details.map(d => `${d.path ? d.path.join('.') + ': ' : ''}${d.message}`).join(', ');
      if (detailStr) errorMsg += ` (${detailStr})`;
    }

    try {
      const { showToast } = await import('../components/toast.js');
      showToast({ title: 'API Error', message: errorMsg, type: 'error' });
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
