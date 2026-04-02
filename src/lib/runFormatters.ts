export function formatPausedOperation(operation: string | null | undefined) {
  switch (operation) {
    case 'create_plan':
      return 'Create Plan';
    case 'review_plan':
      return 'Review Plan';
    case 'reconcile_plan':
      return 'Reconcile Plan';
    case 'generate_slices':
      return 'Generate Slices';
    case 'implement_slice':
      return 'Implement Slice';
    case 'review_slice':
      return 'Review Slice';
    case 'fix_slice':
      return 'Repair Slice';
    default:
      return operation ?? 'Unknown Step';
  }
}
