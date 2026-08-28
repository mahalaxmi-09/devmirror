# DevMirror AI (SaaS Platform)

> **Debug. Reflect. Improve.**

DevMirror AI is an intelligent developer platform combining a voice-driven autonomous debugger agent (**SkillDebug**) with a personal engineering coach reflector (**SkillMirror**).

---

## Key Features

1. **SkillDebug Workspace**:
   - Web Speech API microphone system + text inputs.
   - Dynamic sandbox execution for running units tests and verification assertions.
   - Interactive project files visualizer, line highlight markers, and custom side-by-side patch diff previews.
   - Step-by-step progress tracking for agents.
   
2. **SkillMirror Assessment**:
   - Highlights strongest areas vs gaps using logs and transcript records.
   - Renders radar capability chart telemetry (Communication, Problem Solving, Strategy, Technical Understanding, and Independent Reasoning).
   - Generates personalized challenges featuring multi-mode progress hints.

3. **Hybrid Database Client**:
   - Supports out-of-the-box local executions via self-initializing SQLite files (`devmirror.db`).
   - Supports production-ready PostgreSQL connections (e.g. Supabase) by specifying `DATABASE_URL` in `.env`.

4. **Self-Contained Offline Simulation**:
   - If a Gemini API Key is not set in process environment, the service invokes a rule-based analyzer that successfully patches the controlled demo authentication bug and evaluates performance profiles without errors.

---

## Quick Start Guide

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **NPM**: v9.0.0 or higher

### Installation
Dependencies for both the frontend client and backend server have already been pre-installed successfully in this workspace directory.

### Configuration
1. Rename the example file `.env.example` to `.env` in the root:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and fill in your Gemini API key (optional, fallbacks to mock analysis if left blank):
   ```env
   GEMINI_API_KEY=your_actual_gemini_api_key
   ```

### Running the Platform
From the root directory, start both services concurrently by running:
```bash
npm run dev
```

- **Frontend Client**: Runs at [http://localhost:3000](http://localhost:3000)
- **Backend Service API**: Runs at [http://localhost:5000](http://localhost:5000)

### Controlled Demo Walkthrough
1. Navigate to [http://localhost:3000](http://localhost:3000) and click **Start Debugging**.
2. Create an account or sign in.
3. Click the **🚀 Run Controlled Demo (Auto-bug)** button on your dashboard.
4. The workspace initializes a Javascript React + Node demo mission preloaded with code and failures.
5. Click **Submit to AI Debug Agent** / **Analyze** -> The debugger locates the authentication header issue.
6. Click **Apply to Sandbox** -> The backend writes code and runs tests. You will see green terminal console outputs showing passing runs!
7. The **View My SkillMirror** navigation button will unlock at the bottom of the agent timeline. Click it to view your radar scores and accept personalized coding challenges!
