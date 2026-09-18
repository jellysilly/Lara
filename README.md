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

**Regex scripts**
- Find-and-replace rules that run over messages, with `/pattern/flags` or a bare pattern
- Three independent stages: what **you read**, what the **model reads**, and what
  gets **saved** — so you can hide reasoning blocks from the transcript without
  destroying them, or strip them from the prompt without touching the display
- Scoped by message kind (your messages, model replies, system messages, world
  info), by depth window, and by character
- `$1`…`$9`, `{{match}}` and the usual `{{char}}`/`{{user}}` macros in the
  replacement, plus trim-out strings
- Reorderable — they run top to bottom — with a live tester in the settings
- Imports SillyTavern regex scripts as well as Lara's own export

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

`dist/` is a plain static site. `npm run serve` starts a dependency-free static
server (`scripts/serve.mjs`) on <http://localhost:8080>; `PORT` and `HOST`
override the defaults, and `HOST=0.0.0.0` makes it reachable from other devices
on your network. Any other static host works too — the build uses relative asset
paths, so serving it from a subdirectory is fine.

## Running on Android (Termux)

Lara is a static site, so a phone can host it for itself. In [Termux](https://termux.dev):

```bash
pkg install -y git nodejs-lts
git clone https://github.com/jellysilly/Lara
cd Lara
npm run termux
```

That installs dependencies, builds, and serves on <http://localhost:8080> — open
it in the phone's browser. The script also takes a wake lock so Android does not
suspend the server mid-scene.

```bash
bash scripts/termux.sh --serve   # skip install and build, just serve
bash scripts/termux.sh --lan     # also reachable from your local network
PORT=3000 bash scripts/termux.sh # different port
```

Notes:

- Node 20 or newer is required. `pkg install nodejs-lts` gives you a recent one.
- The first `npm install` and build take a few minutes on a phone. If the build
  runs out of memory, build on a computer and copy the `dist/` folder over —
  `npm run serve` only needs `dist/` and `scripts/serve.mjs`.
- `http://localhost` counts as a secure context, so storage and clipboard behave
  normally. Over `--lan` the clipboard falls back to a legacy copy path.
- Everything still stays on the device; the only outbound traffic is to whatever
  model endpoint you configure.

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
  lib/          prompt builder, lorebook engine, regex engine, tokenizer,
                API clients, character-card PNG codec, wiki fetcher,
                generator, markdown
  store/        zustand stores: settings, library, chats, ui
  components/   layout, chat, characters, personas, lorebook, memory,
                generator, settings, ui primitives
  styles/       base, themes (3 palettes x light/dark), layout, components, chat
  i18n/         en + ru dictionaries with plural support
scripts/
  serve.mjs     dependency-free static server for dist/
  termux.sh     one-shot Android setup: install, build, serve
```

## Not included yet

Group chats, extension/plugin APIs, TTS and image generation, and Text
Completion (non-chat) endpoints.

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
- **Регексы:** правила поиска и замены по сообщениям — `/шаблон/флаги` или
  просто шаблон. Три независимых этапа: что **видите вы**, что **видит модель**
  и что **сохраняется**, так что блок размышлений можно спрятать из чата, не
  стирая его, или убрать из промпта, не трогая отображение. Область действия
  задаётся типом сообщения (ваши, ответы модели, системные, лорбуки), диапазоном
  глубины и списком персонажей. В замене работают `$1`…`$9`, `{{match}}`,
  `{{char}}`, `{{user}}` и вырезаемые подстроки. Порядок скриптов меняется, есть
  живая проверка. Импортируются скрипты SillyTavern.
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

### Запуск на Android (Termux)

Lara — статический сайт, так что телефон может раздавать её сам себе.
В [Termux](https://termux.dev):

```bash
pkg install -y git nodejs-lts
git clone https://github.com/jellysilly/Lara
cd Lara
npm run termux
```

Скрипт поставит зависимости, соберёт проект и поднимет сервер на
<http://localhost:8080> — откройте адрес в браузере телефона. Заодно берётся
wake lock, чтобы Android не усыпил сервер посреди сцены.

```bash
bash scripts/termux.sh --serve   # только раздать уже собранное
bash scripts/termux.sh --lan     # доступ с других устройств в сети
PORT=3000 bash scripts/termux.sh # другой порт
```

Нужен Node 20 или новее (`pkg install nodejs-lts`). Первая установка и сборка на
телефоне занимают несколько минут; если не хватает памяти — соберите на
компьютере и скопируйте папку `dist/`, для раздачи нужны только она и
`scripts/serve.mjs`.

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

Групповые чаты, API расширений, TTS и генерация изображений, Text Completion
эндпоинты.
