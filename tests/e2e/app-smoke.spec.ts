import { expect, test, type Page, type Route } from '@playwright/test';

const APP_ORIGIN = 'http://127.0.0.1:4173';
const API_BASE_URL = `${APP_ORIGIN}/mock-api`;
const SESSION_TOKEN = 'demo-session-token';

type MockRun = {
  run_id: string;
  intake_mode: string;
  repo_path: string;
  repo_url?: string | null;
  repo_name: string;
  repo_host?: string | null;
  repo_owner?: string | null;
  repo_slug?: string | null;
  clone_mode: string;
  base_branch: string;
  workspace_path: string;
  head_sha_at_start: string | null;
  status: string;
  baseline_status: string | null;
  concurrency_slot: number | null;
  spec_text: string;
  issue_title?: string | null;
  issue_url?: string | null;
  issue_body?: string | null;
  feature_request_text?: string | null;
  target_branch?: string | null;
  auto_deliver?: boolean;
  push_on_complete?: boolean;
  delivery_remote_name?: string;
  policy_pack: string;
  created_at: string;
  updated_at: string;
  artifacts: unknown[];
};

type MockDelivery = {
  branch_name: string;
  commit_sha: string;
  commit_message: string;
  pushed: boolean;
  remote_name: string | null;
  remote_url_redacted: string | null;
  push_error: string | null;
  changed_files: string[];
  delivered_at: string;
};

type MockRunReport = {
  run_id: string;
  status: string;
  summary: {
    total_slices: number;
    approved_slices: number;
    rejected_slices: number;
    pending_slices: number;
    total_iterations: number;
    max_slice_iterations: number;
    multi_iteration_slices: number;
    iteration_exhausted_slices: number;
    total_escalations: number;
    resolved_escalations: number;
    artifact_count: number;
  };
  delivery: MockDelivery | null;
  markdown: string;
  artifact_paths: string[];
};

function isoAt(hour: number, minute: number) {
  return new Date(Date.UTC(2026, 3, 2, hour, minute, 0)).toISOString();
}

function buildRun(overrides: Partial<MockRun>): MockRun {
  return {
    run_id: 'run-default',
    intake_mode: 'local',
    repo_path: '/home/marc/Documents/github/acme/widgets',
    repo_url: null,
    repo_name: 'widgets',
    repo_host: null,
    repo_owner: null,
    repo_slug: null,
    clone_mode: 'copy',
    base_branch: 'main',
    workspace_path: '/tmp/dev-harness/workspaces/run-default',
    head_sha_at_start: 'abc123',
    status: 'RUN_COMPLETE',
    baseline_status: 'PASS',
    concurrency_slot: 1,
    spec_text: 'Tighten the operator console and preserve delivery controls.',
    issue_title: null,
    issue_url: null,
    issue_body: null,
    feature_request_text: null,
    target_branch: null,
    auto_deliver: false,
    push_on_complete: false,
    delivery_remote_name: 'origin',
    policy_pack: 'default',
    created_at: isoAt(8, 0),
    updated_at: isoAt(8, 30),
    artifacts: [],
    ...overrides,
  };
}

function buildReport(runId: string, delivery: MockDelivery | null): MockRunReport {
  return {
    run_id: runId,
    status: 'RUN_COMPLETE',
    summary: {
      total_slices: 2,
      approved_slices: 2,
      rejected_slices: 0,
      pending_slices: 0,
      total_iterations: 3,
      max_slice_iterations: 2,
      multi_iteration_slices: 1,
      iteration_exhausted_slices: 0,
      total_escalations: 0,
      resolved_escalations: 0,
      artifact_count: 0,
    },
    delivery,
    markdown: '# Mock report',
    artifact_paths: [],
  };
}

async function fulfillJson(route: Route, status: number, payload: unknown) {
  await route.fulfill({
    status,
    headers: {
      'access-control-allow-origin': APP_ORIGIN,
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'Authorization,Content-Type',
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

async function installMockApi(page: Page) {
  const existingRun = buildRun({
    run_id: 'run-existing',
    intake_mode: 'remote',
    repo_path: '/tmp/dev-harness/workspaces/run-existing',
    repo_url: 'https://github.com/acme/widgets',
    repo_host: 'github.com',
    repo_owner: 'acme',
    repo_slug: 'widgets',
    clone_mode: 'clone',
    spec_text: 'Fix the widget settings badge alignment on small screens.',
    issue_title: 'Settings badge overlaps the status bar',
    issue_url: 'https://github.com/acme/widgets/issues/42',
    issue_body: 'Pixel devices show the session badge inside the OS status area.',
    target_branch: 'fix/settings-badge',
    auto_deliver: true,
    push_on_complete: false,
    updated_at: isoAt(9, 15),
  });

  const delivery = {
    branch_name: 'fix/settings-badge',
    commit_sha: '1234567890abcdef',
    commit_message: 'Fix settings badge spacing',
    pushed: true,
    remote_name: 'origin',
    remote_url_redacted: 'https://github.com/acme/widgets.git',
    push_error: null,
    changed_files: ['src/components/AppShell.tsx'],
    delivered_at: isoAt(9, 20),
  };

  const runs = new Map<string, MockRun>([[existingRun.run_id, existingRun]]);
  const reports = new Map<string, MockRunReport>([
    [existingRun.run_id, buildReport(existingRun.run_id, delivery)],
  ]);
  const slices = new Map<string, unknown[]>([[existingRun.run_id, []]]);
  const events = new Map<string, unknown[]>([[existingRun.run_id, []]]);
  const escalations = new Map<string, unknown[]>([[existingRun.run_id, []]]);
  let createdRunCounter = 1;

  await page.addInitScript((apiBaseUrl: string) => {
    window.localStorage.setItem(
      'harness.runtime-config',
      JSON.stringify({
        apiBaseUrl,
        sessionToken: '',
        username: '',
      }),
    );
    window.localStorage.removeItem('harness.app-pin');
    window.localStorage.removeItem('harness.recent-escalations');
  }, API_BASE_URL);

  await page.addInitScript(() => {
    try {
      Object.defineProperty(window, 'PushManager', {
        configurable: true,
        value: undefined,
      });
    } catch {
      // ignore
    }
    try {
      Object.defineProperty(window, 'Notification', {
        configurable: true,
        value: undefined,
      });
    } catch {
      // ignore
    }
  });

  await page.route('**/mock-api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace('/mock-api', '');
    const method = request.method();

    if (method === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': APP_ORIGIN,
          'access-control-allow-methods': 'GET,POST,OPTIONS',
          'access-control-allow-headers': 'Authorization,Content-Type',
        },
      });
      return;
    }

    if (path === '/health/ready' && method === 'GET') {
      await fulfillJson(route, 200, { ok: true });
      return;
    }

    if ((path === '/api/v1/operator/session' || path === '/api/v1/operator/session/') && method === 'POST') {
      await fulfillJson(route, 200, {
        session_token: SESSION_TOKEN,
        expires_at: isoAt(18, 0),
        operator: {
          operator_id: 'operator-1',
          username: 'marc',
        },
      });
      return;
    }

    if (
      (path === '/api/v1/operator/session' ||
        path === '/api/v1/operator/session/' ||
        path === '/api/v1/operator/me') &&
      method === 'GET'
    ) {
      const auth = request.headers().authorization;
      if (auth !== `Bearer ${SESSION_TOKEN}`) {
        await fulfillJson(route, 401, { detail: 'Unauthorized' });
        return;
      }
      await fulfillJson(route, 200, {
        auth_type: 'session',
        operator: {
          operator_id: 'operator-1',
          username: 'marc',
        },
        expires_at: isoAt(18, 0),
      });
      return;
    }

    if ((path === '/api/v1/operator/session' || path === '/api/v1/operator/session/') && method === 'DELETE') {
      await fulfillJson(route, 204, {});
      return;
    }

    if (path === '/api/v1/operator/push/config' && method === 'GET') {
      await fulfillJson(route, 200, {
        enabled: false,
        web_enabled: false,
        native_android_enabled: false,
        vapid_public_key: null,
      });
      return;
    }

    if (path === '/api/v1/runs/repositories' && method === 'GET') {
      await fulfillJson(route, 200, [
        {
          repo_name: 'widgets',
          repo_path: '/home/marc/Documents/github/acme/widgets',
          root_path: '/home/marc/Documents/github',
          relative_path: 'acme/widgets',
          current_branch: 'main',
        },
        {
          repo_name: 'terminal-app',
          repo_path: '/home/marc/Documents/github/acme/terminal-app',
          root_path: '/home/marc/Documents/github',
          relative_path: 'acme/terminal-app',
          current_branch: 'main',
        },
      ]);
      return;
    }

    if (path === '/api/v1/runs/repositories/policy' && method === 'GET') {
      await fulfillJson(route, 200, {
        local_roots: ['/home/marc/Documents/github'],
        remote_enabled: true,
        allowed_remote_hosts: ['github.com'],
        allowed_remote_owners: ['acme'],
      });
      return;
    }

    if (path === '/api/v1/runs' && method === 'GET') {
      await fulfillJson(route, 200, Array.from(runs.values()));
      return;
    }

    if (path === '/api/v1/runs' && method === 'POST') {
      const payload = request.postDataJSON() as Record<string, unknown>;
      const runId = `run-created-${createdRunCounter++}`;
      const repoUrl = typeof payload.repo_url === 'string' ? payload.repo_url : null;
      const repoPath =
        typeof payload.repo_path === 'string' && payload.repo_path
          ? payload.repo_path
          : '/tmp/dev-harness/workspaces/run-created';
      const repoSlug = repoUrl ? repoUrl.replace(/\.git$/, '').split('/').slice(-2).join('/') : null;
      const repoName = repoSlug ? repoSlug.split('/')[1] : repoPath.split('/').pop() ?? 'repo';
      const nextRun = buildRun({
        run_id: runId,
        intake_mode: repoUrl ? 'remote' : 'local',
        repo_path: repoPath,
        repo_url: repoUrl,
        repo_host: repoUrl ? new URL(repoUrl).hostname : null,
        repo_owner: repoSlug ? repoSlug.split('/')[0] : null,
        repo_slug: repoSlug ? repoSlug.split('/')[1] : null,
        repo_name: repoName,
        clone_mode: repoUrl ? 'clone' : 'copy',
        status: 'RUN_COMPLETE',
        spec_text: String(payload.spec_text ?? ''),
        issue_title: typeof payload.issue_title === 'string' ? payload.issue_title : null,
        issue_url: typeof payload.issue_url === 'string' ? payload.issue_url : null,
        issue_body: typeof payload.issue_body === 'string' ? payload.issue_body : null,
        feature_request_text:
          typeof payload.feature_request_text === 'string' ? payload.feature_request_text : null,
        target_branch: typeof payload.target_branch === 'string' ? payload.target_branch : null,
        auto_deliver: Boolean(payload.auto_deliver),
        push_on_complete: Boolean(payload.push_on_complete),
        delivery_remote_name:
          typeof payload.delivery_remote_name === 'string'
            ? payload.delivery_remote_name
            : 'origin',
        updated_at: isoAt(10, createdRunCounter),
      });
      runs.set(runId, nextRun);
      reports.set(runId, buildReport(runId, null));
      slices.set(runId, []);
      events.set(runId, []);
      escalations.set(runId, []);
      await fulfillJson(route, 200, nextRun);
      return;
    }

    const runReportMatch = path.match(/^\/api\/v1\/runs\/([^/]+)\/report$/);
    if (runReportMatch && method === 'GET') {
      await fulfillJson(route, 200, reports.get(runReportMatch[1]) ?? buildReport(runReportMatch[1], null));
      return;
    }

    const runEventsMatch = path.match(/^\/api\/v1\/runs\/([^/]+)\/events$/);
    if (runEventsMatch && method === 'GET') {
      await fulfillJson(route, 200, events.get(runEventsMatch[1]) ?? []);
      return;
    }

    const runSlicesMatch = path.match(/^\/api\/v1\/runs\/([^/]+)\/slices$/);
    if (runSlicesMatch && method === 'GET') {
      await fulfillJson(route, 200, slices.get(runSlicesMatch[1]) ?? []);
      return;
    }

    const runEscalationsMatch = path.match(/^\/api\/v1\/runs\/([^/]+)\/escalations$/);
    if (runEscalationsMatch && method === 'GET') {
      await fulfillJson(route, 200, escalations.get(runEscalationsMatch[1]) ?? []);
      return;
    }

    const runMatch = path.match(/^\/api\/v1\/runs\/([^/]+)$/);
    if (runMatch && method === 'GET') {
      const run = runs.get(runMatch[1]);
      if (!run) {
        await fulfillJson(route, 404, { detail: 'Run not found' });
        return;
      }
      await fulfillJson(route, 200, run);
      return;
    }

    await fulfillJson(route, 404, {
      detail: `Unhandled mock route: ${method} ${path}`,
    });
  });
}

async function signIn(page: Page) {
  await page.goto('/#/settings');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.getByLabel('Username').fill('marc');
  await page.getByLabel('Password').fill('pass123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByRole('button', { name: 'Sign Out' })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await installMockApi(page);
});

test('signs in and navigates across the primary app surfaces', async ({ page }) => {
  await signIn(page);

  await page.getByRole('button', { name: 'Home' }).click();
  await expect(page.getByRole('heading', { name: 'Runs' })).toBeVisible();
  await expect(page.getByText('delivery fix/settings-badge')).toBeVisible();

  await page.getByRole('button', { name: /widgets/i }).click();
  await expect(page).toHaveURL(/#\/runs\/run-existing$/);
  await expect(page.getByRole('button', { name: 'Open Issue', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Escalations' }).click();
  await expect(page.getByRole('heading', { name: 'Escalations' })).toBeVisible();
});

test('creates a run from a remote issue url and opens the run console', async ({ page }) => {
  await signIn(page);

  await page.getByRole('button', { name: 'Home' }).click();
  await page.getByRole('button', { name: 'Create Run' }).click();
  await expect(page.getByRole('heading', { name: 'Start Run' })).toBeVisible();
  await expect(page.getByText('Loading approved repositories…')).not.toBeVisible();

  await page.getByRole('button', { name: 'Remote URL' }).click();
  await page
    .getByPlaceholder('https://github.com/example/project.git')
    .fill('https://github.com/acme/widgets/issues/42');

  await expect(page.getByText('Normalized to')).toContainText('https://github.com/acme/widgets');
  await expect(page.getByText('Detected From URL')).toBeVisible();
  await expect(page.getByText('issue #42')).toBeVisible();

  await page.getByRole('button', { name: 'Use as Issue Context' }).click();
  await expect(page.getByText('Issue Context', { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('Short issue title')).toHaveValue('acme/widgets Issue #42');
  await page
    .getByPlaceholder('Paste the issue body, reproduction notes, failure details, or acceptance notes.')
    .fill('Fix the issue without regressing the new session badge flow.');
  await page
    .getByPlaceholder('Optional delivery branch, e.g. feat/harness-output')
    .fill('fix/issue-42');

  const submitRun = page.getByTestId('create-run-submit');
  await submitRun.scrollIntoViewIfNeeded();
  await expect(submitRun).toBeEnabled();
  await submitRun.evaluate((button: HTMLButtonElement) => button.click());

  await expect(page).toHaveURL(/#\/runs\/run-created-1$/);
});

test('locks and unlocks the stored session with a local app pin', async ({ page }) => {
  await signIn(page);

  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

  await page.getByPlaceholder('4 to 8 digits').fill('1234');
  await page.getByPlaceholder('Repeat PIN').fill('1234');
  await page.getByRole('button', { name: 'Set PIN' }).click();
  await expect(page.getByText('PIN enabled')).toBeVisible();

  await page.getByRole('button', { name: 'Lock Now' }).click();
  await expect(page.getByRole('heading', { name: 'Unlock Terminal' })).toBeVisible();
  await page.getByPlaceholder('4 to 8 digits').fill('1234');
  await page.getByRole('button', { name: 'Unlock' }).click();

  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByText('A local PIN is active for this device.')).toBeVisible();
});
