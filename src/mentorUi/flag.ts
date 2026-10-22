// Trial switch for Mentor visual cards. On by default; a device can turn it off with
// localStorage.setItem('mentor_rich_ui', '0') (server-side kill switch: env MENTOR_RICH_UI_OFF=1).
const KEY = 'mentor_rich_ui';

export function richMentorEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch {
    return true;
  }
}
