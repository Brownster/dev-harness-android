# Dev-Harness Android App

This is the companion Android application for the **Dev-Harness** orchestrator. Originally built as a React/Vite progressive web app, it is now wrapped natively using **Capacitor** to run as a full Android APK. 

It provides a mobile-first "Terminal" aesthetic, featuring native haptic feedback, to serve as a mobile control center for operators.

## 📱 What this App Does
This app allows a human operator to monitor and govern the AI agents running on the backend:
*   **Run Creation**: Start new AI runs directly from your phone by pasting a spec or attaching an outline file.
*   **Live Run Tracking**: Monitor active runs, see the number of slices pending/completed, and track the active generation/evaluation iteration loops.
*   **Artifact Inspection**: Dive into the generated plans, review the Codex/Claude execution logs, and read policy verdicts.
*   **Human-in-the-Loop Escalations**: When the AI gets stuck, it pauses and requests help. Use this app to read the agent's question, view the context (including evaluator critiques), and submit a binding decision to resume or block the run.
*   **Operator Authentication**: Securely sign in to the backend using username and password to establish a revocable session.
*   **Web Push Alerts**: Receive native push notifications when an escalation requires your attention, deep-linking you straight to the decision screen.

---

## 🚀 Building the APK (GitHub Actions)

You do not need to install Android Studio to build this app. A GitHub Action is configured to build the APK for you:
1. Go to the **Actions** tab in your GitHub repository.
2. Select **Build Android APK** from the left sidebar.
3. Click **Run workflow**. 
4. Once completed, the APK will be available to download from the newly created GitHub Release.

---

## 💻 Local Development

If you want to modify the UI or run the app locally in a browser:

### Prerequisites
*   Node.js (v20+)
*   npm or yarn
*   A running instance of the `dev-harness` backend API.

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy the example environment file:
```bash
cp .env.example .env.local
```
You may configure the following variable in your `.env.local`:
*   `VITE_BACKEND_API_URL`: Optional default backend URL. If you are using **Tailscale**, this can be your machine's Tailscale IP (e.g., `http://100.x.y.z:8000`).

*(Note: The app relies on runtime operator sign-in. The backend URL can also be changed within the app's settings tab).*

### 3. Run the Development Server
```bash
npm run dev
```
The application will be available at `http://localhost:3000`.

---

## 🔗 Architecture & Backend Integration

The app communicates with the `dev-harness` FastAPI backend through `src/services/api.ts`. 

### Data Models
The TypeScript interfaces in `src/types.ts` are mapped directly to the backend's Pydantic schemas (using `snake_case` properties like `run_id` and `created_at`).

### Authentication Flow
1.  The operator enters the backend URL in the app's config tab.
2.  The operator signs in with a username and password.
3.  The backend returns a revocable session token.
4.  All actions (fetching runs, reading artifacts, resolving escalations) use `Authorization: Bearer <session-token>`.

---

## 📱 Mobile Preview & Deep Linking

*   **Desktop Preview**: When viewing the app on a desktop browser, a "Mobile Preview" toggle is available in the top-left corner to simulate a physical device frame.
*   **Deep Linking**: The app uses hash routing so static hosting can open escalation URLs reliably, for example `/#/escalation/esc_123`. During development, you can use the "Simulate Deep Link" button in the header to test the routing and fetching logic for a specific escalation.
