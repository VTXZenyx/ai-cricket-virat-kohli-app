# AI Virat Kohli — 

interactive Virat Kohli-inspired mentor built around cricket, competition, discipline, fitness, confidence, pressure, and mindset.

The app combines a retro sports desktop-style interface with a code-built animated cricket ball, text conversations, voice conversations, knowledge retrieval, and future video-call support.

> This is a fan-made project. It is not affiliated with or endorsed by Virat Kohli. Any exact voice, likeness, or other protected material should only be used with appropriate authorization or licensing.

## Current Tech Stack

### Frontend

- Next.js
- React
- TypeScript
- CSS
- Browser MediaRecorder API
- Web Audio API

### Backend

- Python
- FastAPI
- `uv`

### Language Model

- Ollama
- Qwen3:8b
- Runs locally

### Speech-to-Text

- MLX Whisper
- Optimized for Apple Silicon
- FFmpeg for audio processing

### Voice Generation

- Fish Audio

### Knowledge / Database

- Supabase
- PostgreSQL
- Approved Virat-related knowledge records
- Keyword-based retrieval for Phase 1
- pgvector planned later

### Video

- Tavus integration prepared
- Video-call functionality is still part of Phase 1 development

---

## Project Structure

```text
kohli-ai-mentor-final-vscode/
├── .vscode/
│   ├── tasks.json
│   ├── extensions.json
│   └── settings.json
│
├── backend/
│   ├── app/
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── calls.py
│   │   │   ├── chat.py
│   │   │   ├── knowledge.py
│   │   │   ├── stt.py
│   │   │   └── tts.py
│   │   │
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── fish_audio_service.py
│   │   │   ├── knowledge_service.py
│   │   │   ├── openai_service.py
│   │   │   ├── tavus_service.py
│   │   │   └── whisper_service.py
│   │   │
│   │   ├── config.py
│   │   ├── main.py
│   │   ├── persona.py
│   │   └── schemas.py
│   │
│   ├── .env.example
│   ├── pyproject.toml
│   └── uv.lock
│
├── frontend/
│   ├── public/
│   │   └── icon.svg
│   │
│   ├── src/
│   │   ├── app/
│   │   │   ├── globals.css
│   │   │   ├── layout.tsx
│   │   │   ├── manifest.ts
│   │   │   └── page.tsx
│   │   │
│   │   ├── components/
│   │   │   ├── CallModal.tsx
│   │   │   ├── ChatExperience.tsx
│   │   │   ├── CricketBall.tsx
│   │   │   └── ViratDesktop.tsx
│   │   │
│   │   └── lib/
│   │       └── api.ts
│   │
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── scripts/
│   └── dev.sh
│
├── .gitignore
├── LICENSE
└── README.md
```

---

## What Currently Works

The current prototype includes:

- draggable desktop-style main window
- minimize, close, and reopen behaviour
- custom Virat/Kohli-inspired sports interface
- code-built spinning cricket ball
- Message / Voice / Video modes
- real local text conversations using Qwen3:8b
- Virat-inspired personality prompt
- conversation history
- Supabase knowledge retrieval
- approved knowledge filtering
- microphone recording
- local speech-to-text using MLX Whisper
- generated voice responses using Fish Audio
- working voice pipeline from microphone to spoken response
- Web Audio API playback
- call timer and call interface
- video-call UI ready for Tavus integration

---

# How Text Chat Works

```text
User message
     ↓
Next.js frontend
     ↓
FastAPI /api/chat
     ↓
Virat-inspired persona
     +
Conversation history
     +
Relevant Supabase knowledge
     ↓
Ollama
     ↓
Qwen3:8b
     ↓
Response returned to frontend
```

The language model runs locally using Ollama, meaning normal text generation does not require a paid LLM API.

---

# How Voice Calls Work

The current voice-call prototype uses a turn-based pipeline:

```text
User speaks
     ↓
Browser microphone
     ↓
MediaRecorder
     ↓
FastAPI /api/stt
     ↓
MLX Whisper
     ↓
Transcript
     ↓
FastAPI /api/chat
     ↓
Qwen3:8b + Persona + Supabase
     ↓
Text response
     ↓
FastAPI /api/tts
     ↓
Fish Audio
     ↓
Web Audio API
     ↓
Spoken response
```

The current version uses:

```text
MIC → Speak → STOP
```

Automatic silence detection and more natural hands-free conversation are planned improvements.

---

# First-Time Setup

## 1. Clone the Repository

```bash
git clone https://github.com/VTXZenyx/ai-cricket-virat-kohli-app.git
```

Then:

```bash
cd ai-cricket-virat-kohli-app
```

Open it in VS Code:

```bash
code .
```

---

## 2. Install Ollama

Install Ollama on the computer that will run the project.

Then download Qwen:

```bash
ollama pull qwen3:8b
```

Check that Ollama is running:

```bash
ollama list
```

You should see:

```text
qwen3:8b
```

The Ollama API normally runs at:

```text
http://127.0.0.1:11434
```

---

## 3. Backend Setup

Open a terminal:

```bash
cd backend
```

Create your local environment file:

```bash
cp .env.example .env
```

Install dependencies:

```bash
uv sync
```

---

## 4. Install FFmpeg

MLX Whisper requires FFmpeg.

On macOS with Homebrew:

```bash
brew install ffmpeg
```

Check it:

```bash
which ffmpeg
```

Expected Apple Silicon path:

```text
/opt/homebrew/bin/ffmpeg
```

---

## 5. Frontend Setup

Open another terminal:

```bash
cd frontend
```

Create your local frontend environment:

```bash
cp .env.example .env.local
```

Install packages:

```bash
npm install
```

Your local frontend environment should contain:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

---

# Environment Variables

Private keys must only be stored inside:

```text
backend/.env
```

Do not commit this file to GitHub.

Example configuration:

```env
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:8b

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

FISH_AUDIO_API_KEY=
FISH_AUDIO_REFERENCE_ID=
FISH_AUDIO_MODEL=s2.1-pro-free

WHISPER_MODEL=mlx-community/whisper-small-mlx

TAVUS_API_KEY=
TAVUS_PERSONA_ID=
TAVUS_REPLICA_ID=
```

The frontend should only contain safe public configuration such as:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

Never place private Supabase, Fish Audio, or Tavus keys in the frontend.

---

# Running the Project

You normally need three services running.

## Terminal 1 — Ollama

Ollama normally runs as a background service.

Check:

```bash
ollama list
```

---

## Terminal 2 — Backend

```bash
cd backend
```

Then:

```bash
export PATH="/opt/homebrew/bin:$PATH"
uv run fastapi dev app/main.py
```

Backend:

```text
http://127.0.0.1:8000
```

Health check:

```text
http://127.0.0.1:8000/health
```

---

## Terminal 3 — Frontend

```bash
cd frontend
npm run dev
```

Open:

```text
http://localhost:3000
```

---

# Supabase Knowledge System

The application currently uses two main Supabase tables.

## `sources`

Stores information about where material came from, including:

- platform
- source URL
- source title
- transcript
- caption
- source quality
- verification status
- processing status

## `virat_knowledge`

Stores cleaned knowledge extracted from sources.

Example fields include:

- topic
- subtopic
- knowledge type
- content
- quote text
- verification
- confidence
- tags
- approved status

Only knowledge where:

```text
approved = true
```

is intended to be used by the mentor.

Current Phase 1 retrieval uses keyword matching.

A later version can use:

```text
Embeddings
+
Supabase pgvector
+
Semantic similarity search
```

---

# Important Files

## Main Interface

```text
frontend/src/components/ViratDesktop.tsx
```

Controls the main draggable desktop-style application window.

---

## Cricket Ball

```text
frontend/src/components/CricketBall.tsx
```

The cricket ball is created using code rather than a PNG image.

---

## Styling

```text
frontend/src/app/globals.css
```

Contains the primary:

- blue
- navy
- red
- gold
- stadium-inspired styling
- animations
- call interface styling

---

## Text Chat

```text
frontend/src/components/ChatExperience.tsx
```

Handles the chat interface.

---

## Voice / Video Call Interface

```text
frontend/src/components/CallModal.tsx
```

Handles:

- microphone recording
- call states
- voice playback
- call controls
- video-call interface

---

## Personality

```text
backend/app/persona.py
```

Contains the personality and behavioural instructions used by the local language model.

---

## Language Model Service

```text
backend/app/services/openai_service.py
```

Despite the current filename, this service is being used for the Ollama/Qwen language-model connection.

The filename can be renamed later to something clearer such as:

```text
ollama_service.py
```

---

## Speech Recognition

```text
backend/app/services/whisper_service.py
```

Uses MLX Whisper to convert recorded speech into text.

---

## Voice Generation

```text
backend/app/services/fish_audio_service.py
```

Generates spoken responses.

---

## Knowledge Retrieval

```text
backend/app/services/knowledge_service.py
```

Retrieves approved knowledge from Supabase.

---

## Video Integration

```text
backend/app/services/tavus_service.py
```

Contains the Tavus integration used for future video conversations.

---

# API Routes

Current backend routes include:

```text
POST /api/chat
POST /api/stt
POST /api/tts

GET  /api/knowledge/status
GET  /api/knowledge/search

POST /api/calls/session
POST /api/calls/{conversation_id}/end

GET  /health
```

---

# Current Phase 1 Goal

Phase 1 aims to deliver a polished prototype where users can:

1. open the application
2. move, minimize, close, and reopen the main window
3. interact through text
4. receive real responses from the local Qwen model
5. retrieve approved Virat-related knowledge from Supabase
6. speak through their microphone
7. convert speech locally using MLX Whisper
8. receive generated spoken responses
9. start a video conversation through Tavus
10. use the application on desktop and mobile
11. keep all private API keys secure
12. clearly understand that the project is fan-made

---

# Planned Improvements

After the basic Phase 1 functionality is stable:

- faster Qwen response times
- streamed text responses
- shorter voice latency
- automatic silence detection
- automatic listening after a spoken response
- natural hands-free voice conversation
- better speech recognition for cricket-specific names
- pgvector semantic knowledge search
- expanded verified Virat knowledge dataset
- Tavus video conversations
- improved mobile design
- production deployment
- performance monitoring

---

## Git Workflow

Before starting work on another computer:

```bash
git pull
```

After making changes:

```bash
git add .
git commit -m "Describe your changes"
git push
```

This keeps the latest version of the project synchronized through GitHub.
