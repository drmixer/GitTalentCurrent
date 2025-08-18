import { Notification } from '../types';

// Maps a notification to a route/tab based on type/entity
export function resolveNotificationTarget(n: Notification, role?: string) {
  const base =
    role === 'recruiter' ? '/recruiter' :
    role === 'developer' ? '/developer' :
    role === 'admin' ? '/admin' :
    '/dashboard';

  switch (n.type) {
    case 'message':
      return {
        path: `${base}?tab=messages`,
        state: { fromNotification: true, messageId: n.entity_id }
      };
    case 'job_interest':
      // Recruiters viewing candidates/pipeline for the job role
      return {
        path: `${base}?tab=pipeline`,
        state: { fromNotification: true, jobRoleId: n.entity_id }
      };
    case 'test_assignment':
      // Developer taking the test
      return {
        path: `/test/${n.entity_id}`,
        state: { fromNotification: true }
      };
    case 'test_completion':
      // Recruiter viewing test results
      return {
        path: `${base}?tab=tests`,
        state: { fromNotification: true, assignmentId: n.entity_id }
      };
    default:
      return { path: base, state: { fromNotification: true } };
  }
}
