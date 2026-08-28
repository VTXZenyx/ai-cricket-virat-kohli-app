# AI Virat Kohli  Mentor App

A fan-made conversational mentor experience inspired by Virat Kohli's competitive mindset, discipline, cricket mentality, fitness standards, and approach to pressure.

The project combines a sports-game-inspired interface with local language-model inference, knowledge retrieval, text streaming, speech-to-text, and low-latency voice conversations.
## Current Features

### Text Chat

- real local chatbot powered by **Ollama**
- **Qwen3:8b** model
- token-by-token streamed responses
- Virat-inspired mentor persona
- approved knowledge retrieval from Supabase
- conversation history
- text-to-speech Listen option

### Hands-Free Voice Calls

The voice call works as a continuous conversation:

```text
User speaks
    ↓
Silence detected automatically
    ↓
MLX Whisper transcription
    ↓
Qwen begins streaming
    ↓
First completed sentence
    ↓
Fish Audio begins generating speech
    ↓
Speech starts while Qwen continues thinking
    ↓
Later sentences are prepared in the background
    ↓
AI finishes speaking
    ↓
Microphone automatically listens again




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
│   │       ├── api.ts
│   │       └── voiceStreaming.ts
│   │
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── scripts/
│
├── .gitignore
├── LICENSE
└── README.md
