import { useState } from 'react';
import {
  Check,
  Download,
  Droplets,
  Eraser,
  Plug,
  Plus,
  RefreshCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import type { ApiProfile, GenerationPreset, Language, Provider } from '@/types';
import { useT } from '@/lib/useT';
import { downloadFile, pickFile, readAsText, splitList, formatBytes } from '@/lib/utils';
import { fetchModels, complete, ApiError } from '@/lib/api';
import { db } from '@/lib/db';
import { resetCalibration } from '@/lib/tokenizer';
import {
  DEFAULT_IMPERSONATE_PROMPT,
  DEFAULT_POST_HISTORY,
  DEFAULT_SUMMARY_PROMPT,
  DEFAULT_SYSTEM_PROMPT,
} from '@/lib/prompt';
import { activePreset, createPreset, createProfile, defaultSettings, useSettings } from '@/store/settings';
import { useLibrary } from '@/store/library';
import { useChats } from '@/store/chats';
import { useUi } from '@/store/ui';
import { TopBar } from '@/components/layout/TopBar';
import { Field, Section, Segmented, Select, Slider, Switch, TextArea, TextInput } from '@/components/ui/Primitives';
import { UsageStats } from '@/components/chat/TokenMeter';
import { AppearanceSettings } from './AppearanceSettings';
import { RegexSettings } from './RegexSettings';

const TABS = ['connection', 'generation', 'prompts', 'regex', 'appearance', 'data', 'about'] as const;
type Tab = (typeof TABS)[number];

function ConnectionTab() {
  const t = useT();
  const profiles = useSettings((state) => state.apiProfiles);
  const tokenAllowance = useSettings((state) => state.tokenAllowance);
  const activeId = useSettings((state) => state.activeApiProfileId);
  const upsertProfile = useSettings((state) => state.upsertProfile);
  const removeProfile = useSettings((state) => state.removeProfile);
  const patch = useSettings((state) => state.patch);
  const patchPrompt = useSettings((state) => state.patchPrompt);
  const toast = useUi((state) => state.toast);
  const askConfirm = useUi((state) => state.askConfirm);

  const [models, setModels] = useState<Record<string, string[]>>({});
  const [testing, setTesting] = useState<string | null>(null);

  const testProfile = async (profile: ApiProfile) => {
    setTesting(profile.id);
    try {
      const list = await fetchModels(profile);
      setModels((current) => ({ ...current, [profile.id]: list }));
      toast(t('settings.api.ok', { n: list.length }), 'success');
    } catch (listError) {
      // Some gateways do not expose /models — fall back to a one token ping.
      try {
        await complete({
          profile,
          preset: { ...createPreset(), maxTokens: 1, streaming: false },
          forceNonStreaming: true,
          messages: [{ role: 'user', content: 'ping' }],
        });
        toast(t('settings.api.okSimple'), 'success');
      } catch (error) {
        const message = error instanceof ApiError ? error.message : String(listError);
        toast(t('settings.api.failed', { message }), 'error');
      }
    } finally {
      setTesting(null);
    }
  };

  return (
    <>
      <Section
        title={t('settings.api.profiles')}
        action={
          <button type="button" className="btn btn-sm btn-primary" onClick={() => upsertProfile(createProfile())}>
            <Plus size={15} />
            {t('settings.api.newProfile')}
          </button>
        }
      >
        {!profiles.length && <p className="tiny muted">{t('common.empty')}</p>}

        {profiles.map((profile) => {
          const update = (value: Partial<ApiProfile>) => upsertProfile({ ...profile, ...value });
          const isActive = profile.id === activeId;
          return (
            <details className="collapsible" key={profile.id} open={isActive}>
              <summary>
                <Plug size={14} />
                <span className="truncate" style={{ flex: 1 }}>
                  {profile.name || t('common.unnamed')}
                </span>
                {isActive && <span className="chip tiny chip-accent">{t('settings.api.active')}</span>}
              </summary>

              <div className="collapsible-body stack">
                <div className="grid-2">
                  <Field label={t('common.name')}>
                    <TextInput value={profile.name} onChange={(event) => update({ name: event.target.value })} />
                  </Field>
                  <Field label={t('settings.api.provider')}>
                    <Select
                      value={profile.provider}
                      onChange={(event) => update({ provider: event.target.value as Provider })}
                    >
                      <option value="openai">{t('settings.api.provider.openai')}</option>
                      <option value="anthropic">{t('settings.api.provider.anthropic')}</option>
                      <option value="google">{t('settings.api.provider.google')}</option>
                      <option value="custom">{t('settings.api.provider.custom')}</option>
                    </Select>
                  </Field>
                </div>

                <Field
                  label={t('settings.api.baseUrl')}
                  hint={
                    profile.provider === 'openai'
                      ? 'https://api.openai.com/v1 · http://localhost:1234/v1 · https://openrouter.ai/api/v1'
                      : profile.provider === 'anthropic'
                        ? 'https://api.anthropic.com'
                        : undefined
                  }
                >
                  <TextInput
                    value={profile.baseUrl}
                    placeholder="https://api.openai.com/v1"
                    inputMode="url"
                    onChange={(event) => update({ baseUrl: event.target.value })}
                  />
                </Field>

                <Field label={t('settings.api.apiKey')} hint={t('settings.api.keyHint')}>
                  <TextInput
                    type="password"
                    value={profile.apiKey}
                    autoComplete="off"
                    onChange={(event) => update({ apiKey: event.target.value })}
                  />
                </Field>

                <Field
                  label={t('settings.api.model')}
                  action={
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={testing === profile.id}
                      onClick={() => void testProfile(profile)}
                    >
                      <RefreshCcw size={13} />
                      {testing === profile.id ? t('settings.api.testing') : t('settings.api.fetchModels')}
                    </button>
                  }
                >
                  <TextInput
                    value={profile.model}
                    list={`models-${profile.id}`}
                    placeholder="gpt-4o-mini"
                    onChange={(event) => update({ model: event.target.value })}
                  />
                  <datalist id={`models-${profile.id}`}>
                    {(models[profile.id] ?? []).map((model) => (
                      <option key={model} value={model} />
                    ))}
                  </datalist>
                </Field>

                <Slider
                  label={t('settings.api.contextSize')}
                  min={2048}
                  max={262144}
                  step={1024}
                  value={profile.contextSize}
                  onChange={(contextSize) => update({ contextSize })}
                  format={(value) => `${Math.round(value / 1024)}k`}
                />

                <div className="row-wrap">
                  {!isActive && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => {
                        patch({ activeApiProfileId: profile.id });
                        patchPrompt({ contextSize: profile.contextSize });
                      }}
                    >
                      <Check size={15} />
                      {t('settings.api.activate')}
                    </button>
                  )}
                  <button type="button" className="btn btn-sm" onClick={() => void testProfile(profile)}>
                    {t('settings.api.test')}
                  </button>
                  <span className="spacer" />
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={async () => {
                      if (await askConfirm(t('common.delete'), true)) removeProfile(profile.id);
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </details>
          );
        })}
      </Section>

      <Section title={t('tokens.title')}>
        <UsageStats />
        <Slider
          label={t('tokens.allowance')}
          min={0}
          max={5_000_000}
          step={50_000}
          value={tokenAllowance}
          onChange={(tokenAllowance) => patch({ tokenAllowance })}
          format={(value) => (value ? `${Math.round(value / 1000)}k` : '—')}
          hint={t('tokens.allowanceHint')}
        />
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => {
            useSettings.getState().resetUsage();
            resetCalibration();
            toast(t('toast.saved'), 'success');
          }}
        >
          <Eraser size={15} />
          {t('tokens.resetCounters')}
        </button>
      </Section>
    </>
  );
}

function GenerationTab() {
  const t = useT();
  const settings = useSettings();
  const upsertPreset = useSettings((state) => state.upsertPreset);
  const removePreset = useSettings((state) => state.removePreset);
  const patch = useSettings((state) => state.patch);
  const preset = activePreset(settings);
  const update = (value: Partial<GenerationPreset>) => upsertPreset({ ...preset, ...value });

  return (
    <Section
      title={t('settings.gen.presets')}
      action={
        <div className="row">
          <button type="button" className="btn btn-sm" onClick={() => upsertPreset(createPreset(`Preset ${settings.presets.length + 1}`))}>
            <Plus size={15} />
          </button>
          {settings.presets.length > 1 && (
            <button type="button" className="btn btn-sm btn-danger" onClick={() => removePreset(preset.id)}>
              <Trash2 size={15} />
            </button>
          )}
        </div>
      }
    >
      <div className="grid-2">
        <Field label={t('common.name')}>
          <TextInput value={preset.name} onChange={(event) => update({ name: event.target.value })} />
        </Field>
        <Field label={t('settings.gen.presets')}>
          <Select value={preset.id} onChange={(event) => patch({ activePresetId: event.target.value })}>
            {settings.presets.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Slider
        label={t('settings.gen.temperature')}
        min={0}
        max={2}
        step={0.05}
        value={preset.temperature}
        onChange={(temperature) => update({ temperature })}
        format={(value) => value.toFixed(2)}
      />
      <Slider
        label={t('settings.gen.topP')}
        min={0}
        max={1}
        step={0.01}
        value={preset.topP}
        onChange={(topP) => update({ topP })}
        format={(value) => value.toFixed(2)}
      />
      <Slider
        label={t('settings.gen.topK')}
        min={0}
        max={200}
        value={preset.topK}
        onChange={(topK) => update({ topK })}
        format={(value) => (value ? String(value) : '—')}
      />
      <Slider
        label={t('settings.gen.maxTokens')}
        min={64}
        max={4096}
        step={32}
        value={preset.maxTokens}
        onChange={(maxTokens) => update({ maxTokens })}
      />
      <div className="grid-2">
        <Slider
          label={t('settings.gen.presencePenalty')}
          min={-2}
          max={2}
          step={0.05}
          value={preset.presencePenalty}
          onChange={(presencePenalty) => update({ presencePenalty })}
          format={(value) => value.toFixed(2)}
        />
        <Slider
          label={t('settings.gen.frequencyPenalty')}
          min={-2}
          max={2}
          step={0.05}
          value={preset.frequencyPenalty}
          onChange={(frequencyPenalty) => update({ frequencyPenalty })}
          format={(value) => value.toFixed(2)}
        />
      </div>

      <Field label={t('settings.gen.stop')}>
        <TextInput value={preset.stop.join(', ')} onChange={(event) => update({ stop: splitList(event.target.value) })} />
      </Field>

      <Switch
        checked={preset.streaming}
        onChange={(streaming) => update({ streaming })}
        label={t('settings.gen.streaming')}
      />
    </Section>
  );
}

function PromptsTab() {
  const t = useT();
  const prompt = useSettings((state) => state.prompt);
  const patchPrompt = useSettings((state) => state.patchPrompt);

  return (
    <>
      <Section title={t('settings.tab.prompts')}>
        <Field
          label={t('settings.prompt.system')}
          hint={t('settings.prompt.macrosHint')}
          action={
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => patchPrompt({ systemPrompt: DEFAULT_SYSTEM_PROMPT })}
            >
              {t('common.reset')}
            </button>
          }
        >
          <TextArea
            value={prompt.systemPrompt}
            style={{ minHeight: 190 }}
            onChange={(event) => patchPrompt({ systemPrompt: event.target.value })}
          />
        </Field>

        <Field
          label={t('settings.prompt.postHistory')}
          hint={t('settings.prompt.postHistoryHint')}
          action={
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => patchPrompt({ postHistoryInstructions: DEFAULT_POST_HISTORY })}
            >
              {t('common.reset')}
            </button>
          }
        >
          <TextArea
            value={prompt.postHistoryInstructions}
            onChange={(event) => patchPrompt({ postHistoryInstructions: event.target.value })}
          />
        </Field>

        <Field
          label={t('settings.prompt.impersonate')}
          action={
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => patchPrompt({ impersonatePrompt: DEFAULT_IMPERSONATE_PROMPT })}
            >
              {t('common.reset')}
            </button>
          }
        >
          <TextArea
            value={prompt.impersonatePrompt}
            onChange={(event) => patchPrompt({ impersonatePrompt: event.target.value })}
          />
        </Field>

        <Field
          label={t('settings.prompt.summary')}
          action={
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => patchPrompt({ summaryPrompt: DEFAULT_SUMMARY_PROMPT })}
            >
              {t('common.reset')}
            </button>
          }
        >
          <TextArea value={prompt.summaryPrompt} onChange={(event) => patchPrompt({ summaryPrompt: event.target.value })} />
        </Field>
      </Section>

      <Section title={t('tokens.context')}>
        <Slider
          label={t('settings.prompt.contextSize')}
          min={1024}
          max={262144}
          step={1024}
          value={prompt.contextSize}
          onChange={(contextSize) => patchPrompt({ contextSize })}
          format={(value) => `${Math.round(value / 1024)}k`}
        />
        <Slider
          label={t('settings.prompt.responseTokens')}
          min={64}
          max={4096}
          step={32}
          value={prompt.responseTokens}
          onChange={(responseTokens) => patchPrompt({ responseTokens })}
        />
        <Switch
          checked={prompt.includeExampleDialogue}
          onChange={(includeExampleDialogue) => patchPrompt({ includeExampleDialogue })}
          label={t('settings.prompt.examples')}
        />
        <Switch
          checked={prompt.trimSentences}
          onChange={(trimSentences) => patchPrompt({ trimSentences })}
          label={t('settings.prompt.trim')}
        />
        <Switch
          checked={prompt.useCharacterSystemPrompt}
          onChange={(useCharacterSystemPrompt) => patchPrompt({ useCharacterSystemPrompt })}
          label={t('settings.prompt.useCharPrompt')}
        />
      </Section>
    </>
  );
}

function DataTab() {
  const t = useT();
  const settings = useSettings();
  const patch = useSettings((state) => state.patch);
  const replaceAll = useSettings((state) => state.replaceAll);
  const library = useLibrary();
  const importAll = useLibrary((state) => state.importAll);
  const importChats = useChats((state) => state.importChats);
  const toast = useUi((state) => state.toast);
  const askConfirm = useUi((state) => state.askConfirm);
  const [size, setSize] = useState(0);

  const exportAll = async () => {
    const chats = await db.loadAllChats();
    const { hydrated: _h, sessionUsage: _s, ...settingsSnapshot } = settings;
    const payload = {
      app: 'lara',
      version: 1,
      exportedAt: new Date().toISOString(),
      characters: library.characters,
      personas: library.personas,
      lorebooks: library.lorebooks,
      chats,
      settings: Object.fromEntries(
        Object.entries(settingsSnapshot).filter(([, value]) => typeof value !== 'function'),
      ),
    };
    downloadFile(JSON.stringify(payload, null, 2), `lara-backup-${Date.now()}.json`);
    toast(t('toast.exported'), 'success');
  };

  const importBackup = async () => {
    const file = await pickFile('.json,application/json');
    if (!file) return;
    if (!(await askConfirm(t('settings.data.importConfirm')))) return;
    try {
      const data = JSON.parse(await readAsText(file));
      importAll(data);
      if (Array.isArray(data.chats)) await importChats(data.chats);
      if (data.settings) replaceAll({ ...defaultSettings, ...data.settings });
      toast(t('toast.imported'), 'success');
    } catch {
      toast(t('toast.error'), 'error');
    }
  };

  return (
    <>
      <Section title={t('settings.tab.data')}>
        <p className="tiny muted">{t('settings.data.exportHint')}</p>
        <div className="row-wrap">
          <button type="button" className="btn btn-sm" onClick={() => void exportAll()}>
            <Download size={15} />
            {t('settings.data.export')}
          </button>
          <button type="button" className="btn btn-sm" onClick={() => void importBackup()}>
            <Upload size={15} />
            {t('settings.data.import')}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={async () => setSize(await db.estimateSize())}
          >
            {t('settings.data.storage', { n: size ? formatBytes(size) : '—' })}
          </button>
        </div>
      </Section>

      <Section title={t('settings.data.corsProxy')}>
        <Field label={t('settings.data.corsProxy')} hint={t('settings.data.corsProxyHint')}>
          <TextInput
            value={settings.corsProxy}
            placeholder="https://proxy.example/?url="
            onChange={(event) => patch({ corsProxy: event.target.value })}
          />
        </Field>
      </Section>

      <Section title={t('settings.data.clear')}>
        <button
          type="button"
          className="btn btn-danger"
          onClick={async () => {
            if (!(await askConfirm(t('settings.data.clearConfirm'), true))) return;
            await db.clearAll();
            localStorage.clear();
            location.reload();
          }}
        >
          <Trash2 size={15} />
          {t('settings.data.clear')}
        </button>
      </Section>
    </>
  );
}

export function SettingsPage() {
  const t = useT();
  const tab = useUi((state) => state.settingsTab) as Tab;
  const setTab = useUi((state) => state.setSettingsTab);
  const language = useSettings((state) => state.language);
  const patch = useSettings((state) => state.patch);

  return (
    <>
      <TopBar title={t('settings.title')}>
        <Select
          value={language}
          onChange={(event) => patch({ language: event.target.value as Language })}
          style={{ width: 'auto', minWidth: 120 }}
          aria-label={t('common.language')}
        >
          <option value="en">English</option>
          <option value="ru">Русский</option>
        </Select>
      </TopBar>

      <div className="scroll-area">
        <div className="page">
          <div className="tabs" role="tablist">
            {TABS.map((key) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>
                {t(`settings.tab.${key}` as Parameters<typeof t>[0])}
              </button>
            ))}
          </div>

          {tab === 'connection' && <ConnectionTab />}
          {tab === 'generation' && <GenerationTab />}
          {tab === 'prompts' && <PromptsTab />}
          {tab === 'regex' && <RegexSettings />}
          {tab === 'appearance' && <AppearanceSettings />}
          {tab === 'data' && <DataTab />}
          {tab === 'about' && (
            <Section title={t('settings.tab.about')}>
              <div className="row" style={{ gap: 'var(--space-3)' }}>
                <span className="lore-mark">
                  <Droplets size={20} />
                </span>
                <div className="stack" style={{ gap: 2 }}>
                  <strong>{t('app.name')}</strong>
                  <span className="tiny muted">{t('app.tagline')}</span>
                </div>
              </div>
              <p className="small muted">{t('settings.about.body')}</p>
              <Segmented
                label={t('common.language')}
                value={language}
                onChange={(value) => patch({ language: value })}
                options={[
                  { value: 'en', label: 'English' },
                  { value: 'ru', label: 'Русский' },
                ]}
              />
            </Section>
          )}
        </div>
      </div>
    </>
  );
}
