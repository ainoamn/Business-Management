import { useEffect, useState } from "react";
import { launchUrlForApp, type BhdApp } from "../../lib/bhd/apps";
import { useBhdCatalog } from "../../lib/identity/use-bhd-catalog";
import { BhdAppIcon } from "./BhdAppIcon";

/** شريط أيقونات حي من كتالوج الهوية — رأس الصفحة. */
export function BhdProgramsStrip({ locale = "ar" }: { locale?: "ar" | "en" }) {
  const apps = useBhdCatalog().filter((app) => app.enabled && app.id !== "account" && app.id !== "work");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  if (!apps.length) return null;

  return (
    <section className="bhd-programs-strip" aria-label={locale === "ar" ? "برامج BHD" : "BHD programs"} dir="rtl">
      <div className="bhd-programs-strip-inner">
        <span className="bhd-programs-strip-label">{locale === "ar" ? "برامج BHD" : "BHD programs"}</span>
        <nav className="bhd-programs-strip-nav">
          {apps.map((app: BhdApp) => {
            const label = locale === "ar" ? app.nameAr : app.nameEn;
            return (
              <a key={app.id} href={launchUrlForApp(app, origin || undefined)} title={label} className="bhd-programs-strip-item">
                <BhdAppIcon id={app.id} title={label} logoUrl={app.logoUrl} soft={app.soft} accent={app.accent} className="bhd-programs-strip-icon" />
                <span>{label}</span>
              </a>
            );
          })}
        </nav>
      </div>
    </section>
  );
}
