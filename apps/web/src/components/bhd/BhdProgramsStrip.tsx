import { useEffect, useState } from "react";
import { launchUrlForApp, type BhdApp } from "../../lib/bhd/apps";
import { useBhdCatalog } from "../../lib/identity/use-bhd-catalog";
import { BhdAppIcon } from "./BhdAppIcon";

type Props = {
  locale?: "ar" | "en";
  /** Icon-only row for header actions. */
  compact?: boolean;
};

/** Live catalog icon strip — header (compact) or full labeled strip. */
export function BhdProgramsStrip({ locale = "ar", compact = false }: Props) {
  const apps = useBhdCatalog().filter((app) => app.enabled && app.id !== "account" && app.id !== "work");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  if (!apps.length) return null;

  return (
    <section
      className={compact ? "bhd-programs-strip bhd-programs-strip-compact" : "bhd-programs-strip"}
      aria-label={locale === "ar" ? "برامج BHD" : "BHD programs"}
      dir="rtl"
    >
      <div className="bhd-programs-strip-inner">
        {!compact && (
          <span className="bhd-programs-strip-label">{locale === "ar" ? "برامج BHD" : "BHD programs"}</span>
        )}
        <nav className="bhd-programs-strip-nav">
          {apps.map((app: BhdApp) => {
            const label = locale === "ar" ? app.nameAr : app.nameEn;
            return (
              <a
                key={app.id}
                href={launchUrlForApp(app, origin || undefined)}
                title={label}
                className={compact ? "bhd-programs-chip" : "bhd-programs-strip-item"}
              >
                <BhdAppIcon
                  id={app.id}
                  title={label}
                  logoUrl={app.logoUrl}
                  soft={app.soft}
                  accent={app.accent}
                  className="bhd-programs-strip-icon"
                />
                {!compact && <span>{label}</span>}
              </a>
            );
          })}
        </nav>
      </div>
    </section>
  );
}

export default BhdProgramsStrip;
