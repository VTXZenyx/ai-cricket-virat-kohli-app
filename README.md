# AI Virat Kohli — Phase 1 VS Code Template

A **runnable fan-made prototype** with the UI direction you selected: Tavus/Bad-Santa-style draggable desktop window mechanics, a code-built animated cricket ball, Virat Kohli-inspired blue/red/gold sports styling, text chat, voice/video call buttons, and Supabase knowledge integration-ready backend.

> This is a fan-made AI experience. It is not Virat Kohli and is not affiliated with or endorsed by Virat Kohli. Use an exact voice or likeness only if appropriately authorized/licensed.

## Project structure

```text
kohli-ai-mentor-final-vscode/
├── .vscode/
│   ├── tasks.json
│   ├── extensions.json
│   └── settings.json
├── backend/
│   ├── app/
│   │   ├── routes/
│   │   │   ├── calls.py
│   │   │   ├── chat.py
│   │   │   ├── knowledge.py
│   │   │   └── tts.py
│   │   ├── services/
│   │   │   ├── elevenlabs_service.py
│   │   │   ├── knowledge_service.py
│   │   │   ├── openai_service.py
│   │   │   └── tavus_service.py
│   │   ├── config.py
│   │   ├── main.py
│   │   ├── persona.py
│   │   └── schemas.py
│   ├── .env.example
│   └── pyproject.toml
├── frontend/
│   ├── public/
│   │   └── icon.svg
│   ├── src/
│   │   ├── app/
│   │   │   ├── globals.css
│   │   │   ├── layout.tsx
│   │   │   ├── manifest.ts
│   │   │   └── page.tsx
│   │   ├── components/
│   │   │   ├── CallModal.tsx
│   │   │   ├── ChatExperience.tsx
│   │   │   ├── CricketBall.tsx
│   │   │   └── ViratDesktop.tsx
│   │   └── lib/
│   │       └── api.ts
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── scripts/
│   └── dev.sh
├── .gitignore
└── README.md
```

## What works without API keys

You can run the project immediately in **demo mode**:

- draggable AI Virat Kohli window
- close/minimize/reopen from taskbar
- code-built spinning cricket ball
- Message / Voice / Video UI
- working text-chat flow with local demo replies
- demo voice/video call screens
- browser speech fallback for AI replies

## First-time setup on your Mac

### 1. Open this folder in VS Code

Use **File → Open Folder** and select this project root.

### 2. Backend install

In VS Code Terminal 1:

```bash
cd backend
cp .env.example .env
uv sync
```

If you do not have `uv` installed, install it first or use a normal Python virtual environment.

### 3. Frontend install

In VS Code Terminal 2:

```bash
cd frontend
cp .env.example .env.local
npm install
```

### 4. Run both

You have two options.

**Option A — VS Code task**

Press:

```text
Cmd + Shift + P
```

Search:

```text
Tasks: Run Task
```

Choose:

```text
Run Phase 1
```

**Option B — two terminals**

Backend:

```bash
cd backend
uv run fastapi dev app/main.py
```

Frontend:

```bash
cd frontend
npm run dev
```

Then open:

```text
http://localhost:3000
```

Backend health check:

```text
http://127.0.0.1:8000/health
```

## Add OpenAI

Edit `backend/.env`:

```env
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-5.6-terra
```

Restart the backend.

## Connect your current Supabase project

In **Supabase → Project Settings / Connect / API Keys**, get your project URL and **server-side service-role key**.

Put them only in `backend/.env`:

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_server_side_key
```

Never put the service-role key in `frontend/`.

This template expects your current table:

```text
virat_knowledge
```

and only retrieves rows where:

```text
approved = true
```

For Phase 1 it uses simple keyword ranking. Later replace `knowledge_service.py` with pgvector similarity search.

Test the connection at:

```text
http://127.0.0.1:8000/api/knowledge/status
```

Example search:

```text
http://127.0.0.1:8000/api/knowledge/search?q=pressure%20confidence
```

## Add Tavus

Edit `backend/.env`:

```env
TAVUS_API_KEY=
TAVUS_PERSONA_ID=
TAVUS_REPLICA_ID=
```

The same backend route is used for:

- voice → `audio_only: true`
- video → `audio_only: false`

Without these values, the UI uses the built-in demo call screens.

## Add ElevenLabs

Use an authorized/licensed voice:

```env
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
ELEVENLABS_MODEL_ID=eleven_flash_v2_5
```

Without it, the Listen button uses browser speech synthesis.

## Most important files for you to edit

### Main homepage / draggable window

```text
frontend/src/components/ViratDesktop.tsx
```

### Cricket ball

```text
frontend/src/components/CricketBall.tsx
```

The ball is SVG/CSS code — not a PNG.

### All styling / colours / background

```text
frontend/src/app/globals.css
```

### Chat UI

```text
frontend/src/components/ChatExperience.tsx
```

### AI personality

```text
backend/app/persona.py
```

### OpenAI behavior

```text
backend/app/services/openai_service.py
```

### Supabase knowledge retrieval

```text
backend/app/services/knowledge_service.py
```

### Tavus call integration

```text
backend/app/services/tavus_service.py
```

## Phase 1 target

A Phase 1 release is done when a user can:

1. open the live web app
2. move/close/reopen the main Virat Kohli window
3. message the AI mentor
4. get a real OpenAI response
5. retrieve relevant approved knowledge from Supabase
6. start a real Tavus voice call
7. start a real Tavus video call
8. use it on desktop and mobile
9. see no exposed private API keys
10. understand that this is a fan-made AI experience
