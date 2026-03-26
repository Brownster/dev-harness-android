# Dev-Harness Android (PWA)

This is the front-end application for the **Dev-Harness** orchestrator. It is built as a progressive web app (PWA) using React, Vite, and Tailwind CSS. It is designed with a mobile-first "Terminal" aesthetic, featuring haptic feedback and pull-to-refresh interactions, to serve as a replacement for Mattermost notifications.

## Key Features
*   **Run Review**: Open a run-linked escalation and inspect current run status and report data.
*   **Escalation Decisions**: Receive human-in-the-loop requests directly in the app.
*   **Runtime Device Config**: Store the backend URL locally on the device.
*   **Operator Sign-In**: Authenticate with a username and password to receive a revocable operator session.
*   **Session Authentication**: Uses Bearer session tokens for both read and response actions.
*   **Web Push Alerts**: After sign-in, enable browser notifications and receive escalation alerts that deep-link into the matching escalation screen.

---

## 🚀 Getting Started Locally

### Prerequisites
*   Node.js (v18+)
*   npm or yarn
*   A running instance of the `dev-harness` backend API.

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy the example environment file and fill in your specific details:

```bash
cp .env.example .env.local
```

You may configure the following variable in your `.env.local`:
*   `VITE_BACKEND_API_URL`: Optional default backend URL. If you are using **Tailscale**, this can be your machine's Tailscale IP (for example `http://100.x.y.z:8000`).

The app now expects operator sign-in at runtime. Only the backend URL is configured in `.env.local`.

### 3. Run the Development Server
```bash
npm run dev
```
The application will be available at `http://localhost:3000` (or whichever port Vite assigns). It is configured to host on `0.0.0.0` so you can easily access it from your physical mobile device over your Tailscale network.

---

## 🔗 Architecture & Backend Integration

The app communicates with the `dev-harness` FastAPI backend through `src/services/api.ts`. 

### Data Models
The TypeScript interfaces in `src/types.ts` are mapped directly to the backend's Pydantic schemas (using `snake_case` properties like `run_id` and `created_at`).

### Authentication Flow
1.  The operator enters the backend URL in the app.
2.  The operator signs in with username and password.
3.  The backend returns a revocable session token.
4.  Fetching Runs, Run Reports, Escalations, and responding to escalations all use `Authorization: Bearer <session-token>`.
5.  If Web Push is enabled on the backend, the app can register this device through the service worker and receive escalation notifications.

---

## 📱 Mobile Preview & Deep Linking

*   **Desktop Preview**: When viewing the app on a desktop browser, a "Mobile Preview" toggle is available in the top-left corner to simulate a physical device frame.
*   **Deep Linking**: The app uses hash routing so static hosting can open escalation URLs reliably, for example `/#/escalation/esc_123`. During development, you can use the "Simulate Deep Link" button in the header to test the routing and fetching logic for a specific escalation.
