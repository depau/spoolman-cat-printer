import React, {useState, useRef, ReactNode} from 'react';
import {
  Plus, Trash2, Copy, HelpCircle,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  RotateCwSquare, SquareIcon as SquareAspect,
  Type, ALargeSmall, AArrowUp, AArrowDown, ListChevronsUpDown, CaseUpper, Columns2, Square, Rows2,
} from 'lucide-react';
import Editor, {BeforeMount} from '@monaco-editor/react';
import {useSettingsStore} from '@/store/settingsStore';
import {usePrintJobStore} from '@/store/printJobStore';
import type {
  LabelProfile,
  LabelLayout,
  DitheringAlgorithm,
  TextAlign,
  VerticalAlign,
  StyleMode,
  QrContentMode
} from '@/types/profiles';
import type {ISpool} from '@/types/spoolman';
import {generateId} from '@/lib/utils';
import {generateEasyCss} from '@/lib/labelRenderer';
import {LabelPreview, PreviewModeToggle} from '@/components/LabelPreview';
import type {LabelPreviewMode} from '@/components/LabelPreview';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select';
import {Checkbox} from '@/components/ui/checkbox';
import {Slider} from '@/components/ui/slider';
import {Tabs, TabsList, TabsTrigger, TabsContent} from '@/components/ui/tabs';
import {IconRadioGroup} from '@/components/ui/icon-radio-group';
import {Dialog, DialogContent, DialogHeader, DialogTitle} from '@/components/ui/dialog';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip';
import {useToast} from '@/hooks/useToast';
import {cn} from '@/lib/utils';
import {Box, TextField} from "@radix-ui/themes";

// ── Template variable documentation ──────────────────────────────────────────

const TEMPLATE_FIELDS = [
  {
    group: 'Spool', fields: [
      {name: 'id', desc: 'Spool ID number'},
      {name: 'location', desc: 'Storage location'},
      {name: 'comment', desc: 'Spool comment'},
      {name: 'remaining_weight', desc: 'Remaining weight (g)'},
      {name: 'used_weight', desc: 'Used weight (g)'},
      {name: 'initial_weight', desc: 'Initial weight (g)'},
      {name: 'remaining_length', desc: 'Remaining length (mm)'},
      {name: 'used_length', desc: 'Used length (mm)'},
      {name: 'price', desc: 'Spool price'},
      {name: 'first_used', desc: 'First use date'},
      {name: 'last_used', desc: 'Last use date'},
      {name: 'extra.*', desc: 'Custom spool fields (e.g. extra.my_field)'},
    ]
  },
  {
    group: 'Filament', fields: [
      {name: 'filament.name', desc: 'Filament name'},
      {name: 'filament.material', desc: 'Material (PLA, PETG, …)'},
      {name: 'filament.color_hex', desc: 'Color hex code (no #)'},
      {name: 'filament.settings_extruder_temp', desc: 'Extruder temp (°C)'},
      {name: 'filament.settings_bed_temp', desc: 'Bed temp (°C)'},
      {name: 'filament.diameter', desc: 'Diameter (mm)'},
      {name: 'filament.weight', desc: 'Total filament weight (g)'},
      {name: 'filament.article_number', desc: 'Article / SKU'},
      {name: 'filament.comment', desc: 'Filament comment'},
      {name: 'filament.extra.*', desc: 'Custom filament fields'},
    ]
  },
  {
    group: 'Vendor', fields: [
      {name: 'filament.vendor.name', desc: 'Vendor/brand name'},
      {name: 'filament.vendor.comment', desc: 'Vendor comment'},
      {name: 'filament.vendor.extra.*', desc: 'Custom vendor fields'},
    ]
  },
  {
    group: 'System', fields: [
      {name: 'spoolman_host', desc: 'Spoolman base URL'},
    ]
  },
];

const QR_TEMPLATE_PRESETS: Record<QrContentMode, string> = {
  'spoolman-id': 'web+spoolman:s-{{id}}',
  'web-url': '{{spoolman_host}}/spool/{{id}}',
  'custom': '',
};

// ── Synthetic preview spool ───────────────────────────────────────────────────

const SYNTHETIC_SPOOL: ISpool = {
  id: 1, registered: new Date().toISOString(), first_used: null, last_used: null,
  archived: false, location: 'Shelf A', comment: null, price: 19.99,
  remaining_weight: 750, initial_weight: 1000, spool_weight: null,
  used_weight: 250, remaining_length: 250000, used_length: 83000, extra: {},
  filament: {
    id: 1, registered: new Date().toISOString(), name: 'PLA+ Red', material: 'PLA+',
    color_hex: 'FF3333', color_hexes: null, density: 1.24, diameter: 1.75, weight: 1000,
    spool_weight: 250, price: 19.99, article_number: 'eSUN-PLA+-RED-1KG', comment: null,
    settings_extruder_temp: 210, settings_bed_temp: 60, external_id: null, extra: {},
    vendor: {
      id: 1,
      registered: new Date().toISOString(),
      name: 'eSUN',
      comment: null,
      empty_spool_weight: 250,
      external_id: null,
      extra: {}
    },
  },
};

// ── Monaco setup: Handlebars + Markdown hybrid language ───────────────────────

const handleBeforeMount: BeforeMount = (monaco) => {
  if (monaco.languages.getLanguages().some((lang: { id: string }) => lang.id === 'handlebars-markdown')) return;

  monaco.languages.register({id: 'handlebars-markdown'});
  monaco.languages.setMonarchTokensProvider('handlebars-markdown', {
    tokenizer: {
      root: [
        // Handlebars block open tags: {{#ifval ...}} {{#if ...}} etc.
        [/\{\{#[\w]+/, {token: 'keyword.hbs', next: '@hbs_expr'}],
        // Handlebars block close tags: {{/ifval}} etc.
        [/\{\{\/[\w]+\}\}/, 'keyword.hbs'],
        // Handlebars expressions: {{variable}} or {{helper args}}
        [/\{\{/, {token: 'delimiter.hbs', next: '@hbs_expr'}],
        // Markdown headings
        [/^#{1,6} .*$/, 'keyword'],
        // Markdown bold+italic ***...***
        [/\*\*\*[^*]+\*\*\*/, 'strong'],
        // Markdown bold **...**
        [/\*\*[^*]+\*\*/, 'strong'],
        // Markdown italic *...*
        [/\*[^*]+\*/, 'emphasis'],
        // Markdown inline code `...`
        [/`[^`]+`/, 'string'],
        // Anything else
        [/./, ''],
      ],
      hbs_expr: [
        [/\}\}/, {token: 'delimiter.hbs', next: '@pop'}],
        [/[a-zA-Z_][\w.]*/, 'variable.hbs'],
        [/"[^"]*"/, 'string.hbs'],
        [/'[^']*'/, 'string.hbs'],
        [/./, 'string.hbs'],
      ],
    },
  });

  monaco.editor.defineTheme('hbs-light', {
    base: 'vs',
    inherit: true,
    rules: [
      {token: 'keyword.hbs', foreground: '0000cc', fontStyle: 'bold'},
      {token: 'delimiter.hbs', foreground: '795e26', fontStyle: 'bold'},
      {token: 'variable.hbs', foreground: '001080'},
      {token: 'string.hbs', foreground: 'a31515'},
      {token: 'keyword', foreground: '0451a5', fontStyle: 'bold'},
      {token: 'strong', fontStyle: 'bold'},
      {token: 'emphasis', fontStyle: 'italic'},
      {token: 'string', foreground: '098658'},
    ],
    colors: {},
  });

  monaco.editor.defineTheme('hbs-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      {token: 'keyword.hbs', foreground: '569cd6', fontStyle: 'bold'},
      {token: 'delimiter.hbs', foreground: 'ce9178', fontStyle: 'bold'},
      {token: 'variable.hbs', foreground: '9cdcfe'},
      {token: 'string.hbs', foreground: 'ce9178'},
      {token: 'keyword', foreground: '4ec9b0', fontStyle: 'bold'},
      {token: 'strong', fontStyle: 'bold'},
      {token: 'emphasis', fontStyle: 'italic'},
      {token: 'string', foreground: '6a9955'},
    ],
    colors: {},
  });
};

// ── Dialogs ───────────────────────────────────────────────────────────────────

function TemplateFieldsDialog({open, onClose}: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Available Template Fields</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-3">
          Use <code className="font-mono text-xs bg-muted px-1 rounded">{'{{field}}'}</code> for values,{' '}
          <code className="font-mono text-xs bg-muted px-1 rounded">{'{{#ifval field}}…{{/ifval}}'}</code> to show only
          when non-empty.
          Spoolman supports custom fields via{' '}
          <code className="font-mono text-xs bg-muted px-1 rounded">extra</code> objects.
        </p>
        {TEMPLATE_FIELDS.map(({group, fields}) => (
          <div key={group} className="mb-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{group}</h4>
            <div className="space-y-1">
              {fields.map(({name, desc}) => (
                <div key={name} className="flex items-baseline gap-2 text-sm">
                  <code
                    className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded flex-shrink-0">{`{{${name}}}`}</code>
                  <span className="text-muted-foreground text-xs">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </DialogContent>
    </Dialog>
  );
}

// ── Style toolbar (Easy mode) ─────────────────────────────────────────────────

function IconBtn({
                   icon,
                   label,
                   onClick,
                   active,
                   className,
                 }: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded transition-colors text-xs',
            active
              ? 'bg-primary text-primary-foreground'
              : 'bg-background text-foreground hover:bg-accent',
            className
          )}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function EasyStyleToolbar({profile, onChange}: { profile: LabelProfile; onChange: (p: LabelProfile) => void }) {
  function update(patch: Partial<LabelProfile>) {
    onChange({...profile, ...patch});
  }

  return (
    <div className="flex items-center gap-1 flex-wrap rounded-md border bg-muted/30 px-2 py-1.5">
      {/* Font family with Type icon */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Box maxWidth="150px" className="h-7">
            <TextField.Root
              className="h-full text-xs"
              size="1"
              placeholder="monospace"
              value={profile.easyFontFamily}
              onChange={(e) => update({easyFontFamily: e.target.value})}
            >
              <TextField.Slot>
                <Type height="16" width="16" className="m-1"/>
              </TextField.Slot>
            </TextField.Root>
          </Box>
        </TooltipTrigger>
        <TooltipContent>Font family</TooltipContent>
      </Tooltip>

      {/* Font size: icon + input + +/- buttons */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Box maxWidth="60px" className="h-7">
            <TextField.Root
              className="h-full"
              size="1"
              value={profile.easyFontSizePx}
              onChange={(e) => update({easyFontSizePx: Number(e.target.value)})}
              min={6}
              max={200}
            >
              <TextField.Slot>
                <ALargeSmall height="16" width="16" className="m-1"/>
              </TextField.Slot>
            </TextField.Root>
          </Box>
        </TooltipTrigger>
        <TooltipContent>Font size (px)</TooltipContent>
      </Tooltip>
      <div className="flex rounded overflow-hidden border border-input">
        <IconBtn
          icon={<AArrowDown className="h-3.5 w-3.5"/>}
          label="Decrease font size"
          onClick={() => update({easyFontSizePx: Math.max(6, profile.easyFontSizePx - 1)})}
        />
        <IconBtn
          icon={<AArrowUp className="h-3.5 w-3.5"/>}
          label="Increase font size"
          onClick={() => update({easyFontSizePx: profile.easyFontSizePx + 1})}
          className="border-l border-input"
        />
      </div>

      <div className="w-px h-5 bg-border mx-0.5"/>

      {/* Line height with icon */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Box maxWidth="60px" className="h-7 w-14">
            <TextField.Root
              className="h-full text-xs"
              size="1"
              type="number"
              step={0.1}
              value={profile.easyLineHeight}
              onChange={(e) => update({easyLineHeight: Number(e.target.value)})}
              min={0.8}
              max={5}
            >
              <TextField.Slot>
                <ListChevronsUpDown height="16" width="16" className="m-1"/>
              </TextField.Slot>
            </TextField.Root>
          </Box>
        </TooltipTrigger>
        <TooltipContent>Line height</TooltipContent>
      </Tooltip>

      <div className="w-px h-5 bg-border mx-0.5"/>

      {/* Text alignment */}
      <IconRadioGroup
        size="sm"
        value={profile.easyTextAlign}
        onChange={(v) => update({easyTextAlign: v as TextAlign})}
        options={[
          {value: 'left', icon: <AlignLeft className="h-3.5 w-3.5"/>, label: 'Align left'},
          {value: 'center', icon: <AlignCenter className="h-3.5 w-3.5"/>, label: 'Align center'},
          {value: 'right', icon: <AlignRight className="h-3.5 w-3.5"/>, label: 'Align right'},
          {value: 'justify', icon: <AlignJustify className="h-3.5 w-3.5"/>, label: 'Justify'},
        ]}
      />

      {/* Vertical alignment */}
      <IconRadioGroup
        size="sm"
        value={profile.easyVerticalAlign}
        onChange={(v) => update({easyVerticalAlign: v as VerticalAlign})}
        options={[
          {value: 'top', icon: <AlignStartHorizontal className="h-3.5 w-3.5"/>, label: 'Align to top'},
          {value: 'center', icon: <AlignCenterHorizontal className="h-3.5 w-3.5"/>, label: 'Center vertically'},
          {value: 'bottom', icon: <AlignEndHorizontal className="h-3.5 w-3.5"/>, label: 'Align to bottom'},
        ]}
      />
    </div>
  );
}

// ── Preview panel ─────────────────────────────────────────────────────────────

function PreviewPanel({profile}: { profile: LabelProfile }) {
  const {getActivePrinterProfile, spoolmanUrl} = useSettingsStore();
  const previewSpool = usePrintJobStore((s) => s.getSelectedSpools()[0] ?? null);
  const [mode, setMode] = useState<LabelPreviewMode>('html');
  const printerProfile = getActivePrinterProfile();

  const widthMm = profile.widthMm;
  const heightMm = profile.heightMm;

  return (
    <div className="flex flex-col gap-2 items-center">
      <div className="flex items-center gap-2 w-full">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex-1">Preview</p>
        <PreviewModeToggle mode={mode} onChange={setMode}/>
      </div>

      {printerProfile && (
        <LabelPreview
          spool={previewSpool ?? SYNTHETIC_SPOOL}
          labelProfile={profile}
          printerProfile={printerProfile}
          spoolmanHost={spoolmanUrl}
          mode={mode}
        />
      )}

      <p className="text-xs text-muted-foreground text-center">
        {widthMm}×{heightMm ?? '∞'}mm{mode === 'png' ? ' · exact output' : ''}
      </p>
    </div>
  );
}

// ── Profile form ──────────────────────────────────────────────────────────────

function ProfileForm({profile, onChange}: { profile: LabelProfile; onChange: (p: LabelProfile) => void }) {
  const [showFields, setShowFields] = useState(false);

  function update(patch: Partial<LabelProfile>) {
    onChange({...profile, ...patch});
  }

  const unlimitedHeight = profile.heightMm === null;
  const isDark = document.documentElement.classList.contains('dark');
  const monacoTheme = isDark ? 'hbs-dark' : 'hbs-light';

  function handleQrModeChange(mode: QrContentMode) {
    const template = mode !== 'custom' ? QR_TEMPLATE_PRESETS[mode] : profile.qrContentTemplate;
    update({qrContentMode: mode, qrContentTemplate: template});
  }

  function handleSwitchToAdvanced() {
    update({styleMode: 'advanced', advancedCss: generateEasyCss(profile)});
  }

  function handleSwitchToEasy() {
    if (profile.advancedCss && profile.advancedCss !== generateEasyCss(profile)) {
      if (!confirm('Switch to Easy mode? Your custom CSS changes will be lost.')) return;
    }
    update({styleMode: 'easy'});
  }

  return (
    <div className="flex flex-col gap-4">
      <TemplateFieldsDialog open={showFields} onClose={() => setShowFields(false)}/>

      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <Label>Name</Label>
        <Input value={profile.name} onChange={(e) => update({name: e.target.value})}/>
      </div>

      {/* Size + Gap */}
      <div className="flex flex-col gap-2">
        <Label>Size (mm)</Label>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">W</span>
          <Input type="number" className="w-20" value={profile.widthMm}
                 onChange={(e) => update({widthMm: Number(e.target.value)})}/>
          <span className="text-sm text-muted-foreground">×</span>
          <Input type="number" className="w-20" value={profile.heightMm ?? ''}
                 disabled={unlimitedHeight} placeholder="∞"
                 onChange={(e) => update({heightMm: e.target.value ? Number(e.target.value) : null})}/>
          <span className="text-sm text-muted-foreground">H</span>
          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
            <Checkbox
              checked={unlimitedHeight}
              onCheckedChange={(v) => update({heightMm: v ? null : 30, orientation: 'portrait'})}
            />
            Unlimited
          </label>
          {!unlimitedHeight && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground ml-2">Gap</span>
              <Input type="number" className="w-16" value={profile.gapMm}
                     onChange={(e) => update({gapMm: Number(e.target.value)})}/>
              <span className="text-sm text-muted-foreground">mm</span>
            </div>
          )}
        </div>
      </div>

      {/* Margins */}
      <div className="flex flex-col gap-1.5">
        <Label>Margins (mm)</Label>
        <div className="flex items-center gap-2">
          {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
            <span className="text-sm text-muted-foreground">{side.charAt(0).toUpperCase() + side.slice(1)}
              <Input key={side} type="number" className="w-16" title={side.charAt(0).toUpperCase() + side.slice(1)}
                     value={profile.margins[side]}
                     onChange={(e) => update({margins: {...profile.margins, [side]: Number(e.target.value)}})}/>
              </span>
          ))}
        </div>
      </div>

      {/* Layout */}
      <div className="flex flex-col gap-2">
        <Label>Layout</Label>


        <div className="flex items-center gap-2 flex-wrap">

          <div className="inline-flex rounded-md border border-input overflow-hidden">
            {([
              ['qr-left-text-right', 'Horizontal', (<Columns2 height="16" width="16"/>)],
              ['qr-top-text-bottom', 'Vertical', (<Rows2 height="16" width="16"/>)],
              ['text-only', 'Text only', (<Square height="16" width="16"/>)],
            ] as [LabelLayout, string, ReactNode][]).map(([value, label, Icon]) => (
              <button
                key={value}
                onClick={() => update({layout: value})}
                title={label}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 text-sm transition-colors border-l border-input first:border-l-0',
                  profile.layout === value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-foreground hover:bg-accent'
                )}
              >
                {Icon}
                <span>{label}</span>
              </button>
            ))}
            <div className="m-auto"></div>
          </div>

          {/* Border */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground ml-2">Border</span>
            <Input
              type="number"
              className="w-20"
              min={0}
              max={20}
              value={profile.borderWidthPx ?? 0}
              onChange={(e) => update({borderWidthPx: Number(e.target.value)})}
            />
            <span className="text-sm text-muted-foreground">px</span>
          </div>

          {/* Orientation */}
          {!unlimitedHeight && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground ml-2">Orientation</span>
              <IconRadioGroup
                value={profile.orientation}
                onChange={(v) => update({orientation: v as 'portrait' | 'landscape'})}
                options={[
                  {value: 'portrait', icon: <CaseUpper className="h-4 w-4"/>, label: 'Upright (portrait)'},
                  {
                    value: 'landscape',
                    icon: <CaseUpper className="h-4 w-4 rotate-90"/>,
                    label: 'Sideways — rotate 90° (landscape)'
                  },
                ]}
              />
            </div>
          )}
        </div>
      </div>

      {/* Template */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Label className="flex-1">Template (Handlebars + Markdown)</Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowFields(true)}>
                <HelpCircle className="h-3.5 w-3.5"/>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Available fields</TooltipContent>
          </Tooltip>
          <Tabs value={profile.styleMode}
                onValueChange={(v) => v === 'advanced' ? handleSwitchToAdvanced() : handleSwitchToEasy()}>
            <TabsList className="h-6">
              <TabsTrigger value="easy" className="text-xs h-5 px-2">Easy</TabsTrigger>
              <TabsTrigger value="advanced" className="text-xs h-5 px-2">CSS</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {profile.styleMode === 'easy' ? (
          <EasyStyleToolbar profile={profile} onChange={onChange}/>
        ) : (
          <span className="text-sm ml-2">Template</span>
        )}
        <div className="monaco-editor-container rounded-md overflow-hidden border">
          <Editor
            height="200px"
            language="handlebars-markdown"
            theme={monacoTheme}
            value={profile.labelTemplate}
            onChange={(v) => update({labelTemplate: v ?? ''})}
            beforeMount={handleBeforeMount}
            options={{
              minimap: {enabled: false},
              fontSize: 12,
              lineNumbers: 'off',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
            }}
          />
        </div>
        {profile.styleMode === 'advanced' && (
          <>
            <span className="text-sm ml-2">Stylesheet</span>
            <div className="monaco-editor-container">
              <Editor
                height="300px"
                language="css"
                theme={isDark ? 'vs-dark' : 'vs'}
                value={profile.advancedCss}
                onChange={(v) => update({advancedCss: v ?? ''})}
                options={{
                  minimap: {enabled: false},
                  fontSize: 12,
                  lineNumbers: 'off',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on'
                }}
              />
            </div>
          </>
        )}
      </div>


      {/* QR settings */}
      {profile.layout !== 'text-only' && (
        <div className="flex flex-col gap-2 rounded-md border p-3">
          <Label>QR Code</Label>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Content</Label>
            <Select value={profile.qrContentMode} onValueChange={(v) => handleQrModeChange(v as QrContentMode)}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="spoolman-id">Spoolman ID (web+spoolman:s-{'{{id}}'})</SelectItem>
                <SelectItem value="web-url">Web URL (Spoolman spool page)</SelectItem>
                <SelectItem value="custom">Custom template</SelectItem>
              </SelectContent>
            </Select>
            {profile.qrContentMode === 'custom' && (
              <Input
                value={profile.qrContentTemplate}
                onChange={(e) => update({qrContentTemplate: e.target.value})}
                placeholder="e.g. https://example.com/spool/{{id}}"
              />
            )}
            {profile.qrContentMode !== 'custom' && (
              <p className="text-xs text-muted-foreground font-mono">{QR_TEMPLATE_PRESETS[profile.qrContentMode]}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Scale: {profile.qrScaleFactor}</Label>
            <Slider min={1} max={15} step={1} value={[profile.qrScaleFactor]}
                    onValueChange={([v]) => update({qrScaleFactor: v})}/>
          </div>
          {profile.layout === 'qr-left-text-right' && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Column gap (mm)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  className="w-20"
                  min={0}
                  max={20}
                  step={0.5}
                  value={profile.columnGapMm ?? 2}
                  onChange={(e) => update({columnGapMm: Number(e.target.value)})}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dithering */}
      <div className="flex flex-col gap-2">
        <Label>Dithering algorithm</Label>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={profile.dithering} onValueChange={(v) => update({dithering: v as DitheringAlgorithm})}>
            <SelectTrigger className="w-44"><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="floyd-steinberg">Floyd-Steinberg</SelectItem>
              <SelectItem value="threshold">Threshold</SelectItem>
              <SelectItem value="bayer">Bayer</SelectItem>
              <SelectItem value="dot">Dot</SelectItem>
            </SelectContent>
          </Select>
          {profile.dithering === 'threshold' && (
            <div className="flex items-center gap-2 flex-1 min-w-32">
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                Threshold: {Math.round((profile.ditheringThreshold / 255) * 100)}%
              </span>
              <Slider
                className="flex-1"
                min={0} max={255} step={1}
                value={[profile.ditheringThreshold]}
                onValueChange={([v]) => update({ditheringThreshold: v})}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main editor component ─────────────────────────────────────────────────────

export function LabelProfileEditor() {
  const {
    labelProfiles,
    activeLabelProfileId,
    setActiveLabelProfileId,
    upsertLabelProfile,
    deleteLabelProfile
  } = useSettingsStore();
  const toast = useToast();

  const [draft, setDraft] = useState<LabelProfile | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selected = labelProfiles.find((p) => p.id === activeLabelProfileId) ?? labelProfiles[0];
  const editing = draft ?? selected;

  function handleSelect(id: string) {
    if (draft) upsertLabelProfile(draft);
    setActiveLabelProfileId(id);
    setDraft(null);
  }

  function handleChange(p: LabelProfile) {
    setDraft(p);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      upsertLabelProfile(p);
      setDraft(null);
      toast.success('Profile saved');
    }, 1000);
  }

  function handleAdd() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const base = draft ?? selected;
    const newP: LabelProfile = {...(base ?? labelProfiles[0]), id: generateId(), name: 'New Label Profile'};
    upsertLabelProfile(newP);
    setActiveLabelProfileId(newP.id);
    setDraft(null);
  }

  function handleDuplicate() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const base = draft ?? selected;
    if (!base) return;
    const dup: LabelProfile = {...base, id: generateId(), name: `${base.name} (copy)`};
    upsertLabelProfile(dup);
    setActiveLabelProfileId(dup.id);
    setDraft(null);
  }

  function handleDelete() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (!selected || labelProfiles.length <= 1) return;
    deleteLabelProfile(selected.id);
    setDraft(null);
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
      {/* Profile list */}
      <div className="lg:w-52 flex-shrink-0">
        <div className="flex flex-col gap-0.5 rounded-md border overflow-hidden">
          {labelProfiles.map((p) => (
            <button key={p.id} onClick={() => handleSelect(p.id)}
                    className={cn('text-left px-3 py-2 text-sm transition-colors hover:bg-accent',
                      p.id === activeLabelProfileId && 'bg-accent font-medium')}>
              {p.name}
            </button>
          ))}
        </div>
        <div className="flex gap-1 mt-2">
          <Button size="icon" variant="outline" onClick={handleAdd} title="New"><Plus className="h-4 w-4"/></Button>
          <Button size="icon" variant="outline" onClick={handleDuplicate} title="Duplicate"><Copy className="h-4 w-4"/></Button>
          <Button size="icon" variant="outline" onClick={handleDelete} disabled={labelProfiles.length <= 1}
                  title="Delete"><Trash2 className="h-4 w-4"/></Button>
        </div>
      </div>

      {/* Editor + preview */}
      {editing && (
        <div className="flex flex-col gap-4 flex-1 min-w-0 lg:flex-row">
          {/* Preview: top for narrow, right for wide */}
          <div className="lg:order-2 lg:w-64 flex-shrink-0">
            <PreviewPanel profile={editing}/>
          </div>
          <div className="flex-1 min-w-0 overflow-y-auto">
            <ProfileForm profile={editing} onChange={handleChange}/>
          </div>
        </div>
      )}
    </div>
  );
}
