export function buildEscalationRoute(escalationId: string, fromRunId?: string | null) {
  const normalizedId = escalationId.trim();
  if (!normalizedId) {
    return '';
  }
  if (!fromRunId?.trim()) {
    return `/escalation/${normalizedId}`;
  }
  return `/escalation/${normalizedId}?fromRun=${encodeURIComponent(fromRunId.trim())}`;
}
