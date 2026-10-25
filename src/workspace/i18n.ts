/**
 * Workspace-local UI dictionary (uk default, en secondary).
 * Kept separate from the engine's i18n system so the frozen odontogram
 * surface and its parity goldens stay untouched.
 */

type Dict = Record<string, string>;

const uk: Dict = {
  "app.title": "MedCanvas",
  "app.subtitle": "Робочий простір клініки",
  "login.title": "Вхід до MedCanvas",
  "login.email": "Електронна пошта",
  "login.password": "Пароль",
  "login.submit": "Увійти",
  "login.invalid": "Невірна пошта або пароль",
  "login.selectClinic": "Виберіть клініку",
  "login.onboardingLink": "Створити нову клініку",
  "login.submitting": "Входимо…",
  "onboarding.title": "Створення клініки",
  "onboarding.clinicName": "Назва клініки",
  "onboarding.identifier": "Ідентифікатор клініки",
  "onboarding.email": "Електронна пошта адміністратора",
  "onboarding.fullName": "ПІБ адміністратора",
  "onboarding.password": "Пароль адміністратора",
  "onboarding.timezone": "Часовий пояс",
  "onboarding.submit": "Створити клініку",
  "onboarding.backToLogin": "Назад до входу",
  "nav.staff": "Персонал",
  "nav.settings": "Налаштування",
  "nav.profile": "Профіль",
  "nav.logout": "Вийти",
  "role.ClinicAdmin": "Адміністратор",
  "role.Clinician": "Лікар",
  "role.Assistant": "Асистент",
  "role.Viewer": "Спостерігач",
  "staff.title": "Персонал клініки",
  "staff.add": "Додати працівника",
  "staff.email": "Електронна пошта",
  "staff.fullName": "ПІБ",
  "staff.role": "Роль",
  "staff.status": "Статус",
  "staff.active": "Активний",
  "staff.revoked": "Доступ відкликано",
  "staff.revoke": "Відкликати",
  "staff.activate": "Відновити",
  "staff.changeRole": "Змінити роль",
  "staff.empty": "Поки немає жодного працівника, крім вас",
  "staff.password": "Початковий пароль",
  "staff.confirmRevoke": "Відкликати доступ цього працівника?",
  "staff.selfNote": "Власний обліковий запис",
  "settings.title": "Налаштування клініки",
  "settings.name": "Назва",
  "settings.identifier": "Ідентифікатор (лише читання)",
  "settings.timezone": "Часовий пояс (IANA)",
  "settings.save": "Зберегти",
  "settings.saved": "Збережено",
  "settings.adminOnly": "Налаштування доступні лише адміністратору",
  "profile.title": "Профіль",
  "profile.name": "ПІБ",
  "profile.email": "Електронна пошта",
  "profile.role": "Роль",
  "profile.clinic": "Активна клініка",
  "clinic.switch": "Змінити клініку",
  "clinic.switching": "Перемикання…",
  "common.loading": "Завантаження…",
  "common.error": "Помилка запиту. Спробуйте ще раз.",
  "common.cancel": "Скасувати",
  "common.retry": "Повторити",
  "common.saveError": "Не вдалося зберегти",
  "unauthorized.title": "Доступ обмежено",
  "unauthorized.body": "У вас недостатньо прав для цієї сторінки.",
};

const en: Dict = {
  "app.title": "MedCanvas",
  "app.subtitle": "Clinic workspace",
  "login.title": "Sign in to MedCanvas",
  "login.email": "Email",
  "login.password": "Password",
  "login.submit": "Sign in",
  "login.invalid": "Invalid email or password",
  "login.selectClinic": "Choose a clinic",
  "login.onboardingLink": "Create a new clinic",
  "login.submitting": "Signing in…",
  "onboarding.title": "Clinic onboarding",
  "onboarding.clinicName": "Clinic name",
  "onboarding.identifier": "Clinic identifier",
  "onboarding.email": "Administrator email",
  "onboarding.fullName": "Administrator full name",
  "onboarding.password": "Administrator password",
  "onboarding.timezone": "Time zone",
  "onboarding.submit": "Create clinic",
  "onboarding.backToLogin": "Back to sign in",
  "nav.staff": "Staff",
  "nav.settings": "Settings",
  "nav.profile": "Profile",
  "nav.logout": "Sign out",
  "role.ClinicAdmin": "Administrator",
  "role.Clinician": "Clinician",
  "role.Assistant": "Assistant",
  "role.Viewer": "Viewer",
  "staff.title": "Clinic staff",
  "staff.add": "Add staff member",
  "staff.email": "Email",
  "staff.fullName": "Full name",
  "staff.role": "Role",
  "staff.status": "Status",
  "staff.active": "Active",
  "staff.revoked": "Access revoked",
  "staff.revoke": "Revoke",
  "staff.activate": "Restore",
  "staff.changeRole": "Change role",
  "staff.empty": "No staff members yet besides you",
  "staff.password": "Initial password",
  "staff.confirmRevoke": "Revoke this member's access?",
  "staff.selfNote": "Your own account",
  "settings.title": "Clinic settings",
  "settings.name": "Name",
  "settings.identifier": "Identifier (read-only)",
  "settings.timezone": "Time zone (IANA)",
  "settings.save": "Save",
  "settings.saved": "Saved",
  "settings.adminOnly": "Settings are available to administrators only",
  "profile.title": "Profile",
  "profile.name": "Full name",
  "profile.email": "Email",
  "profile.role": "Role",
  "profile.clinic": "Active clinic",
  "clinic.switch": "Switch clinic",
  "clinic.switching": "Switching…",
  "common.loading": "Loading…",
  "common.error": "Request failed. Please try again.",
  "common.cancel": "Cancel",
  "common.retry": "Retry",
  "common.saveError": "Could not save",
  "unauthorized.title": "Access restricted",
  "unauthorized.body": "You do not have permission to view this page.",
};

export type WorkspaceLanguage = "uk" | "en";

const STORAGE_KEY = "medcanvas.workspace.lang";

export function getWorkspaceLanguage(): WorkspaceLanguage {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "uk" || stored === "en") {
      return stored;
    }
  } catch {
    // localStorage unavailable — default below
  }
  return "uk";
}

export function setWorkspaceLanguage(lang: WorkspaceLanguage): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Best effort only
  }
}

export function workspaceT(lang: WorkspaceLanguage, key: string): string {
  const dict = lang === "en" ? en : uk;
  return dict[key] ?? uk[key] ?? key;
}
