import React, { useRef, useState } from 'react';
import { CheckCircle, XCircle, Loader2, Sun, Moon, Monitor, Download, Upload } from 'lucide-react';
import { useSettingsStore } from '@/store/settingsStore';
import type { ExportedSettings } from '@/store/settingsStore';
import { testConnection, normalizeUrl } from '@/lib/spoolmanApi';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';

function ThemeButtonGroup() {
  const { theme, setTheme } = useSettingsStore();
  const options = [
    { value: 'light' as const, icon: <Sun className="h-4 w-4" />, label: 'Light' },
    { value: 'dark' as const, icon: <Moon className="h-4 w-4" />, label: 'Dark' },
    { value: 'system' as const, icon: <Monitor className="h-4 w-4" />, label: 'System' },
  ];

  return (
    <div className="inline-flex rounded-md border border-input overflow-hidden m-auto">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          title={opt.label}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 text-sm transition-colors border-l border-input first:border-l-0',
            theme === opt.value
              ? 'bg-primary text-primary-foreground'
              : 'bg-background text-foreground hover:bg-accent'
          )}
        >
          {opt.icon}
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

function ImportExportSection() {
  const { exportSettings, importSettings } = useSettingsStore();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleExport() {
    const data = exportSettings();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'spoolprint-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so the same file can be re-imported if needed
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as ExportedSettings;
        if (
          data.version !== 1 ||
          !Array.isArray(data.labelProfiles) ||
          !Array.isArray(data.printerProfiles)
        ) {
          throw new Error('Unrecognised file format');
        }
        importSettings(data);
        toast.success('Settings imported. Reloading…');
        setTimeout(() => window.location.reload(), 800);
      } catch (err) {
        toast.error(
          err instanceof Error ? `Import failed: ${err.message}` : 'Import failed: invalid file'
        );
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Import / Export</h3>
      <p className="text-xs text-muted-foreground">
        Back up all profiles and settings to a JSON file, or restore from a previous backup.
      </p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4" />
          Export
        </Button>
        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-4 w-4" />
          Import
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleImport}
        />
      </div>
    </div>
  );
}

export function GeneralSettings() {
  const { spoolmanUrl, setSpoolmanUrl, showDebugLog, setShowDebugLog } = useSettingsStore();
  const [draft, setDraft] = useState(spoolmanUrl);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const version = await testConnection(draft);
      setTestResult({ ok: true, message: `Connected! Spoolman v${version}` });
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Connection failed',
      });
    } finally {
      setTesting(false);
    }
  }

  function handleSave() {
    setSpoolmanUrl(normalizeUrl(draft));
    setTestResult(null);
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      {/* Theme */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Appearance</h3>
        <ThemeButtonGroup />
      </div>

      {/* Spoolman URL */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Spoolman Connection</h3>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="spoolman-url">Server URL</Label>
          <Input
            id="spoolman-url"
            type="url"
            placeholder="http://localhost:7912"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Without trailing slash. Must allow CORS from this origin.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handleTest} disabled={testing || !draft} variant="outline">
            {testing && <Loader2 className="h-4 w-4 animate-spin" />}
            Test Connection
          </Button>
          <Button onClick={handleSave} disabled={draft === spoolmanUrl}>
            Save
          </Button>
        </div>

        {testResult && (
          <div className={`flex items-center gap-2 text-sm ${testResult.ok ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
            {testResult.ok ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {testResult.message}
          </div>
        )}
      </div>

      {/* Import / Export */}
      <ImportExportSection />

      {/* Developer options */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Developer</h3>
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={showDebugLog}
            onCheckedChange={(v) => setShowDebugLog(!!v)}
          />
          <span className="text-sm">Show debug log on print page</span>
        </label>
      </div>
    </div>
  );
}
