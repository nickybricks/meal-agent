/**
 * settings/page.tsx — Settings page (route: /settings).
 */

"use client";

import { useAppSettings } from "@/lib/app-context";
import ApiKeyManager from "@/components/settings/ApiKeyManager";
import ModelParams from "@/components/settings/ModelParams";
import OllamaStatus from "@/components/settings/OllamaStatus";
import ToolToggle from "@/components/settings/ToolToggle";
import LangSmithStatus from "@/components/settings/LangSmithStatus";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const settings = useAppSettings();

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <h1 className="text-xl font-semibold text-neutral-900">Settings</h1>

        <Section title="API Keys">
          <ApiKeyManager />
        </Section>

        <Section title="Model Parameters">
          <ModelParams
            temperature={settings.temperature}
            topP={settings.topP}
            maxTokens={settings.maxTokens}
            onChange={({ temperature, topP, maxTokens }) => {
              settings.setTemperature(temperature);
              settings.setTopP(topP);
              settings.setMaxTokens(maxTokens);
            }}
          />
        </Section>

        <Section title="Tool Toggles">
          <ToolToggle
            enabledTools={settings.enabledTools}
            onChange={settings.setEnabledTools}
          />
        </Section>

        <Section title="Ollama">
          <OllamaStatus />
        </Section>

        <Section title="LangSmith">
          <LangSmithStatus />
        </Section>

        <Section title="Session">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-neutral-500">Session ID:</span>
            <code className="truncate rounded bg-neutral-100 px-2 py-0.5 text-xs">
              {settings.sessionId}
            </code>
            <button
              type="button"
              onClick={settings.newSession}
              className="ml-auto rounded bg-neutral-900 px-3 py-1 text-xs text-white hover:bg-neutral-700"
            >
              Start new session
            </button>
          </div>
        </Section>
      </div>
    </div>
  );
}
