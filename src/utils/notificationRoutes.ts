import { Notification } from '../types';

// Maps a notification to a route/tab based on type/entity
export function resolveNotificationTarget(n: Notification, role?: string) {
  const base =
    role === 'recruiter' ? '/recruiter' :
    role === 'developer' ? '/developer' :
    role === 'admin' ? '/admin' :
    '/dashboard';

  // Normalize defensively (some installs use slight variations)
  const type = (n.type || '').toLowerCase();

  // Treat these as "test completion" for recruiters
  const testCompletionTypes = new Set([
    'test_completion',
    'test_completed',
    'test_result',
    'test_complete'
  ]);

  switch (true) {
    case type === 'message':
      return {
        path: `${base}?tab=messages`,
        state: { fromNotification: true, messageId: n.entity_id }
      };

    case type === 'job_interest':
      // Recruiter "My Jobs" tab
      return {
        path: `${base}?tab=my-jobs`,
        state: { fromNotification: true, jobRoleId: n.entity_id }
      };

    case type === 'test_assignment':
      // Developer taking the test (adjust if your flow is different)
      if (role === 'developer') {
        return { path: `/test/${n.entity_id}`, state: { fromNotification: true } };
      }
      // For non-developers, fall back to tracker
      return {
        path: `${base}?tab=tracker`,
        state: { fromNotification: true, assignmentId: n.entity_id }
      };

    case testCompletionTypes.has(type):
      // Recruiter sees test results/tracker
      return {
        path: `${base}?tab=tracker`,
        state: { fromNotification: true, assignmentId: n.entity_id }
      };

    default:
      // Safe fallback: land user on their dashboard; add tab if you like
      return { path: base, state: { fromNotification: true } };
  }
}
