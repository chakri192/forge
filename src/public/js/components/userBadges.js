export function updateUserBadges(user) {
  const userTagBadge = document.getElementById('userTagBadge');
  const drawerUserName = document.getElementById('drawerUserName');
  const drawerUserTag = document.getElementById('drawerUserTag');
  const devLink = document.getElementById('drawerDevLink');
  const settingsLink = document.getElementById('drawerSettingsLink');
  const loginLink = document.getElementById('drawerLoginLink');
  const signUpLink = document.getElementById('drawerSignUpLink');
  const logoutBtn = document.getElementById('drawerLogoutBtn');

  if (!user) {
    if (userTagBadge) userTagBadge.textContent = 'Guest (Not Signed In)';
    if (drawerUserName) drawerUserName.textContent = 'Guest';
    if (drawerUserTag) drawerUserTag.textContent = 'Not Signed In';

    if (devLink) devLink.classList.add('hidden');
    if (settingsLink) settingsLink.classList.add('hidden');
    if (logoutBtn) logoutBtn.classList.add('hidden');
    if (loginLink) loginLink.classList.remove('hidden');
    if (signUpLink) signUpLink.classList.remove('hidden');
    return;
  }

  if (userTagBadge) {
    userTagBadge.textContent = `${user.name} (${user.tag || user.public_role || user.role})`;
  }
  if (drawerUserName) drawerUserName.textContent = user.name;
  if (drawerUserTag) drawerUserTag.textContent = `${user.tag || user.public_role || user.role}`;

  if (devLink) {
    if (['DEV_STEALTH', 'admin', 'teacher', 'TEACHER'].includes(user.role)) {
      devLink.classList.remove('hidden');
    } else {
      devLink.classList.add('hidden');
    }
  }


  if (settingsLink) settingsLink.classList.remove('hidden');
  if (logoutBtn) logoutBtn.classList.remove('hidden');
  if (loginLink) loginLink.classList.add('hidden');
  if (signUpLink) signUpLink.classList.add('hidden');
}
