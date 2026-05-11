# Space Fractions — Code Agent

A minimal **Claude Code-style agentic loop** that reads your architecture documents and generates a complete Node.js project, powered by the **DeepSeek API**.

## How it works

```
Architecture JSON + UML Views
        ↓
  agent.js (agentic loop)
        ↓
  DeepSeek API  ←→  tool calls (write_file, read_file, list_files)
        ↓
  generated/   ← complete runnable project
```

The loop mirrors how Claude Code works:
1. Send system prompt + architecture context to DeepSeek
2. DeepSeek returns `tool_calls` (e.g. `write_file src/game/gameService.js`)
3. Agent executes the tool (writes the file to disk)
4. Tool result appended to message history
5. Repeat until model calls `task_complete`

## Setup

### 1. Get a DeepSeek API key
→ https://platform.deepseek.com/api_keys

### 2. Configure
```bash
cp .env.example .env
# Edit .env and set your DEEPSEEK_API_KEY
```

### 3. Run the agent
```bash
# Using deepseek-chat (DeepSeek-V3) — fast and cheap
npm run generate

# Using deepseek-reasoner (DeepSeek-R1) — stronger reasoning
npm run generate:reasoner

# Or inline:
DEEPSEEK_API_KEY=sk-... node agent.js
```

### 4. Run the generated project
```bash
cd generated
npm install
cp .env.example .env          # fill in PostgreSQL / Redis creds
psql $DATABASE_URL -f sql/init.sql
npm start
# → http://localhost:3000
```

## Model comparison

| Model | Speed | Cost | Best for |
|---|---|---|---|
| `deepseek-chat` (V3) | Fast | ~$0.001/1K tokens | Default code generation |
| `deepseek-reasoner` (R1) | Slower | ~$0.005/1K tokens | Complex architecture decisions |

## Project structure

```
space-fractions-agent/
├── agent.js               ← the code agent (this file)
├── package.json
├── .env.example
├── docs/
│   ├── architecture.json  ← structured input (parsed from Architecture_Documentation.md)
│   └── architecture_view.md ← UML PlantUML diagrams
└── generated/             ← output (created when agent runs)
    ├── src/
    │   ├── game/
    │   ├── question/
    │   └── user/
    ├── public/index.html  ← the game UI
    ├── sql/init.sql
    ├── Dockerfile
    ├── docker-compose.yml
    └── README.md
```

## What gets generated

The agent produces a **full-stack web game**:

- **Backend**: Node.js + Express REST API (GameComponent, QuestionComponent, UserComponent)
- **Frontend**: `public/index.html` — a beautiful space-themed fraction quiz game
  - Animated starfield canvas
  - Floating rocket mascot
  - Multiple-choice fraction questions (1/2 + 1/4 = ?)
  - Live score HUD
  - Grade + celebration at the end
- **Database**: PostgreSQL schema + 10 seed questions
- **DevOps**: Dockerfile, docker-compose, Kubernetes deployment
- **Tests**: Jest unit tests
- **Docs**: OpenAPI spec + README
