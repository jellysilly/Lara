<h1 align="center">Lara</h1>
<p align="center">An ocean-themed, local-first roleplay frontend.</p>

Lara is a browser frontend for roleplay with language models, in the spirit of
SillyTavern: character cards, personas, lorebooks, swipes, branching chats — but
with a calmer interface, a proper token budget meter, a memory book, and a card
generator that can work from a wiki link.

Everything lives in your browser. Characters, chats and API keys are stored in
IndexedDB on your device and are never uploaded anywhere except to the model
provider you configure.

<sub>[Русская версия ниже](#lara-по-русски)</sub>

---

## Features

**Chat**
- Streaming replies with a stop button, plus continue, regenerate and impersonate
- Swipes: alternative replies on the last message, kept side by side
- Edit, delete, hide-from-prompt, copy, and branch a new chat from any message
- Many chats per character, with branch lineage preserved
- Markdown rendering with narration and *spoken lines* styled apart
- Author's note injected at a configurable depth

**Characters, personas, lorebooks**
- Character Card V2 import and export, both as embedded PNG and as JSON
- Full card editor: description, personality, scenario, greetings, alternate
  greetings, example dialogue, per-card system prompt and post-history instructions
- Personas — who *you* are in the scene — with their own avatars
- Lorebooks (world info) with primary and secondary keys, AND/NOT logic,
  constant entries, insertion order, position, depth, probability, recursive
  scanning, a token budget and a live activation tester
- Imports SillyTavern world-info JSON as well as Lara's own format

**Generator**
- Writes characters, personas or whole lorebooks from a short brief, a wiki
  link, or both
- Reads Wikipedia, Fandom and any other MediaWiki site directly; other pages go
  through an optional CORS proxy
- Pick exactly which fields to write, set tone, length and output language,
  then edit the draft — or ask for a single field to be rewritten — before saving

**Token counter**
- Live context meter in the composer: what the next prompt costs and what is left
- Full breakdown by section — system prompt, character, persona, lorebook,
  memory, history, post-history — plus the reply reserve
- Session and all-time totals, an optional token allowance with a remaining
  counter, and per-message completion costs
- The estimator calibrates itself against real usage numbers reported by your
  provider, so the meter converges on the model you actually use

**Memory book**
- Long-term notes injected into every prompt of a chat
- Summarize the recent scene into a note on demand, or automatically every N messages
- Pin entries so they survive trimming, disable entries without deleting them,
  and watch the memory budget against the context window

**Look and feel**
- Three built-in ocean themes — Lagoon, Seafoam, Coral — each with a light and a
  deep-water dark variant, plus a system-follows mode
- Two chat styles: **flat** and **bubble**
- Three avatar modes: **messenger** (sides), **above the message**, and **none**,
  with adjustable size and shape
- Text size, chat width, message spacing, serif prose, glass blur and ambient
  waves are all adjustable; animations can be switched off entirely and
  `prefers-reduced-motion` is honoured
- English and Russian, English by default

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static bundle in dist/
npm run preview  # serve the build
```

`dist/` is a plain static site — any static host or `npx serve dist` will do.
The build uses relative asset paths, so serving it from a subdirectory works.

## Connecting a model

Open **Settings → Connection** and add a profile:

| Provider | Base URL | Notes |
| --- | --- | --- |
| OpenAI compatible | `https://api.openai.com/v1` | Also OpenRouter, Together, Groq, LM Studio (`http://localhost:1234/v1`), llama.cpp, Ollama's OpenAI endpoint, KoboldCpp |
| Anthropic | `https://api.anthropic.com` | Sent with `anthropic-dangerous-direct-browser-access` |
| Google Gemini | `https://generativelanguage.googleapis.com` | |

**Load models** fills in a model list; **Test connection** falls back to a
one-token ping for gateways that do not expose `/models`.

Because Lara runs entirely in the browser, the endpoint must allow browser
requests (CORS). Local servers usually need a flag — for example
`--cors` for KoboldCpp, or `OLLAMA_ORIGINS=*` for Ollama.

Your key is stored in this browser only and is sent to nobody but the provider
in the URL you configured. Anyone with access to the same browser profile can
read it, as with any local-first app.

## Macros

`{{char}}`, `{{user}}`, `{{persona}}`, `{{description}}`, `{{personality}}`,
`{{scenario}}`, `{{time}}`, `{{date}}`, `{{weekday}}`, `{{random:a,b,c}}`,
`{{roll:d20}}` — usable in card fields, prompts, the author's note and lorebook
entries.

## Data

**Settings → Data** exports everything — characters, personas, lorebooks, chats
and settings — as a single JSON file, and imports it back. Deleting local data
clears IndexedDB and reloads.

## Project layout

```
src/
  lib/          prompt builder, lorebook engine, tokenizer, API clients,
                character-card PNG codec, wiki fetcher, generator, markdown
  store/        zustand stores: settings, library, chats, ui
  components/   layout, chat, characters, personas, lorebook, memory,
                generator, settings, ui primitives
  styles/       base, themes (3 palettes x light/dark), layout, components, chat
  i18n/         en + ru dictionaries with plural support
```

## Not included yet

Group chats, extension/plugin APIs, TTS and image generation, regex-based
message post-processing, and Text Completion (non-chat) endpoints.

---

<h2 id="lara-по-русски">Lara по-русски</h2>

Lara — браузерный фронтенд для ролевых игр с языковыми моделями, в духе
SillyTavern: карточки персонажей, персоны, лорбуки, свайпы, ветки чатов — но со
спокойным интерфейсом, честным счётчиком токенов, книгой памяти и генератором
карточек, который умеет работать по ссылке на вики.

Всё хранится в вашем браузере. Персонажи, чаты и API-ключи лежат в IndexedDB на
вашем устройстве и никуда не выгружаются — только вашему провайдеру модели.

### Что умеет

- **Чат:** потоковая генерация со стопом, продолжение, перегенерация, «ответить
  за меня», свайпы, редактирование и удаление сообщений, скрытие из промпта,
  ветки от любого сообщения, несколько чатов на персонажа, заметка автора с
  настраиваемой глубиной вставки.
- **Карточки:** импорт и экспорт Character Card V2 — и PNG со встроенными
  данными, и JSON. Полный редактор: описание, характер, сценарий, приветствия,
  альтернативные приветствия, примеры диалогов, системный промпт карточки.
- **Персоны:** кто вы внутри сцены, со своими аватарами.
- **Лорбуки:** основные и дополнительные ключи, логика И/НЕ, постоянные записи,
  порядок и позиция вставки, глубина, вероятность, рекурсивное сканирование,
  лимит токенов и живая проверка срабатывания. Импортируется world info из
  SillyTavern.
- **Генератор:** пишет персонажа, персону или целый лорбук по короткому заданию,
  по ссылке на вики или по тому и другому сразу. Wikipedia, Fandom и другие
  MediaWiki читаются напрямую, остальные страницы — через CORS-прокси. Можно
  выбрать, какие поля писать, задать тон, объём и язык результата, а потом
  отредактировать черновик или переписать отдельное поле.
- **Счётчик токенов:** живой индикатор контекста в поле ввода (сколько занято и
  сколько осталось), подробный разбор по секциям, итоги за сессию и за всё
  время, необязательный лимит с остатком. Оценка сама калибруется по реальным
  цифрам от провайдера.
- **Книга памяти:** долговременные заметки в каждом промпте чата, суммаризация
  сцены по кнопке или автоматически каждые N сообщений, закрепление записей,
  бюджет памяти относительно окна контекста.
- **Оформление:** три морские темы — «Лагуна», «Пена», «Коралл» — каждая со
  светлым и глубоководным тёмным вариантом; два стиля чата (плоский и пузыри);
  три режима аватаров (мессенджер, над сообщением, без аватаров) с настройкой
  размера и формы; размер текста, ширина чата, отступы, шрифт с засечками,
  размытие стекла и фоновые волны. Анимации выключаются целиком.
- **Два языка:** английский (по умолчанию) и русский.

### Быстрый старт

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # статическая сборка в dist/
```

### Подключение модели

**Настройки → Подключение**, добавьте профиль: OpenAI-совместимый
(`https://api.openai.com/v1`, а также OpenRouter, LM Studio, llama.cpp,
KoboldCpp), Anthropic (`https://api.anthropic.com`) или Google Gemini.

Lara работает целиком в браузере, поэтому эндпоинт должен разрешать запросы из
браузера (CORS). Локальным серверам обычно нужен флаг — например `--cors` у
KoboldCpp или `OLLAMA_ORIGINS=*` у Ollama.

Ключ хранится только в этом браузере и уходит только тому провайдеру, чей адрес
вы указали.

### Чего пока нет

Групповые чаты, API расширений, TTS и генерация изображений, обработка
сообщений регулярными выражениями, Text Completion эндпоинты.
