"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppSettings } from "@/lib/app-context";
import { useAuth } from "@/components/auth/AuthProvider";
import HomeSettings from "@/components/settings/HomeSettings";
import { getUser, updatePreferences } from "@/lib/api";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-card bg-surface-container-lowest shadow-card p-6">
      <h2 className="text-sm font-semibold text-on-surface">{title}</h2>
      {children}
    </section>
  );
}

type MeasurementSystem = "metric" | "imperial";

export default function SettingsPage() {
  const settings = useAppSettings();
  const { user, me, signOut } = useAuth();
  const router = useRouter();

  const [measurementSystem, setMeasurementSystem] = useState<MeasurementSystem>("metric");
  const [savingUnits, setSavingUnits] = useState(false);

  useEffect(() => {
    if (!me?.id || !settings.homeId) return;
    getUser(me.id, settings.homeId)
      .then((profile) => {
        if (profile.measurementSystem) setMeasurementSystem(profile.measurementSystem);
      })
      .catch(() => {});
  }, [me?.id, settings.homeId]);

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  async function handleMeasurementSystem(value: MeasurementSystem) {
    setMeasurementSystem(value);
    setSavingUnits(true);
    try {
      await updatePreferences(settings.homeId, { measurementSystem: value });
    } finally {
      setSavingUnits(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <h1 className="text-xl font-semibold text-on-surface">Settings</h1>

        <Section title="Account">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-on-surface-variant">Signed in as:</span>
            <span className="truncate font-medium text-on-surface">
              {user?.email ?? "—"}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              className="ml-auto rounded-full bg-primary px-4 py-1.5 text-xs text-on-primary"
            >
              Sign out
            </button>
          </div>
        </Section>

        <Section title="Preferences">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-on-surface-variant">Measurement units:</span>
            <div className="flex rounded-full bg-surface-container p-0.5">
              {(["metric", "imperial"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  disabled={savingUnits}
                  onClick={() => handleMeasurementSystem(opt)}
                  className={`rounded-full px-4 py-1 text-xs capitalize transition-colors disabled:opacity-50 ${
                    measurementSystem === opt
                      ? "bg-primary text-on-primary"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Home">
          <HomeSettings />
        </Section>

      </div>
    </div>
  );
}
