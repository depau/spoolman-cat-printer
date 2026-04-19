import React, {useState, useEffect} from 'react';
import {Printer, ExternalLink, Settings} from 'lucide-react';
import {PrintPage} from '@/pages/PrintPage';
import {SettingsPage} from '@/pages/SettingsPage';
import {useSettingsStore} from '@/store/settingsStore';
import {setPrinterToastCallback} from '@/store/printerStore';
import {ToastProvider} from '@/components/ui/toast';
import {TooltipProvider} from '@/components/ui/tooltip';
import {useToast} from '@/hooks/useToast';
import {cn} from '@/lib/utils';

type Page = 'print' | 'settings';

const VALID_TABS = ['general', 'label-profiles', 'printer-profiles'];

function parseHash(): { page: Page; tab: string } {
  const hash = window.location.hash.slice(1);
  if (hash === 'settings') return {page: 'settings', tab: 'general'};
  if (hash.startsWith('settings/')) {
    const tab = hash.slice(9);
    return {page: 'settings', tab: VALID_TABS.includes(tab) ? tab : 'general'};
  }
  return {page: 'print', tab: 'general'};
}

function setHash(page: Page, tab?: string) {
  const hash = page === 'print' ? 'print' : tab && tab !== 'general' ? `settings/${tab}` : 'settings';
  if (window.location.hash !== `#${hash}`) {
    window.location.hash = hash;
  }
}

// Inner component so it can use useToast (which requires ToastProvider context)
function AppInner() {
  const [page, setPage] = useState<Page>(() => parseHash().page);
  const [settingsTab, setSettingsTab] = useState<string>(() => parseHash().tab);
  const {theme, spoolmanUrl} = useSettingsStore();
  const toast = useToast();

  // Register printer toast callback
  useEffect(() => {
    setPrinterToastCallback((type, msg) => {
      if (type === 'success') toast.success(msg);
      else if (type === 'error') toast.error(msg);
      else toast.info(msg);
    });
  }, [toast]);

  // Sync hash with state
  useEffect(() => {
    setHash(page, settingsTab);
  }, [page, settingsTab]);

  // Listen to browser back/forward
  useEffect(() => {
    function onHashChange() {
      const {page: p, tab: t} = parseHash();
      setPage(p);
      // Only update the settings tab from the hash when actually on settings,
      // otherwise navigating to #print would reset the remembered tab to 'general'
      if (p === 'settings') setSettingsTab(t);
    }

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      localStorage.setItem('spoolprint-theme', 'dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
      localStorage.setItem('spoolprint-theme', 'light');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
      localStorage.removeItem('spoolprint-theme');
    }
  }, [theme]);

  function goToSettings(tab?: string) {
    if (tab) setSettingsTab(tab);
    setPage('settings');
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header
        className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
              <Printer size={20}/>
            </div>
            <h1 className="text-xl font-bold tracking-tight">Spoolman Cat Printer</h1>
          </div>

          {/* Tab navigation */}
          <nav className="flex items-center gap-1 bg-muted p-1 rounded-lg">
            <button
              onClick={() => setPage('print')}
              className={cn(
                'flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all',
                page === 'print'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Printer size={16}/> Print
            </button>
            <button
              onClick={() => goToSettings()}
              className={cn(
                'flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all',
                page === 'settings'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Settings size={16}/> Settings
            </button>
          </nav>

          {/* Spoolman link */}
          <div className="flex items-center gap-4">
            <a
              href={spoolmanUrl}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5 inline-block"/><span className="hidden sm:inline"> Spoolman</span>
            </a>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-auto">
        {page === 'print' ? (
          <PrintPage onNavigateSettings={goToSettings}/>
        ) : (
          <SettingsPage
            tab={settingsTab}
            onTabChange={(t) => setSettingsTab(t)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t py-6 bg-muted/30">
        <div
          className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>© 2026 Davide Depau • <a href="https://github.com/depau/spoolman-cat-printer" target="_blank"
                                             rel="noopener">GitHub</a></p>
          <div className="flex items-center gap-4">
            <span>Powered by <a href="https://github.com/opuu/cat-printer" target="_blank"
                                rel="noopener">@opuu/cat-printer</a></span>
            <span>Made with ❤️ by Davide Depau</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function App() {
  return (
    <TooltipProvider delayDuration={400}>
      <ToastProvider>
        <AppInner/>
      </ToastProvider>
    </TooltipProvider>
  );
}
