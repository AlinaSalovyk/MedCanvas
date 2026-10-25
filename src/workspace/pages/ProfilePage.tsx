import type { ReactNode } from "react";
import { useAuth } from "../AuthContext";

export function ProfilePage(): ReactNode {
  const { session, t } = useAuth();
  if (!session) {
    return null;
  }

  return (
    <section>
      <h1>{t("profile.title")}</h1>
      <dl className="ws-profile">
        <dt>{t("profile.name")}</dt>
        <dd>{session.fullName}</dd>
        <dt>{t("profile.email")}</dt>
        <dd>{session.email}</dd>
        <dt>{t("profile.role")}</dt>
        <dd>{t(`role.${session.role}`)}</dd>
        <dt>{t("profile.clinic")}</dt>
        <dd>{session.clinicName}</dd>
      </dl>
    </section>
  );
}
