import { Notification } from '../types';

// Maps a notification to a route/tab based on type/entity and role
export function resolveNotificationTarget(n: Notification | any, role?: string) {
  const base =
    role === 'recruiter' ? '/recruiter' :
    role === 'developer' ? '/developer' :
    role === 'admin' ? '/admin' :
    '/dashboard';

  const type = (n?.type || '').toLowerCase();

  const testCompletionTypes = new Set([
    'test_completion',
    'test_completed',
    'test_result',
    'test_complete'
  ]);

  // Normalize job application naming (some installs used "job_interest")
  const isJobApplication = type === 'job_application' || type === 'job_interest';

  // Prefer explicit link if present on row
  if (n?.link && typeof n.link === 'string') {
    // If link is absolute, keep it; if it's a tab param, append to base
    if (n.link.startsWith('/')) {
      return { path: n.link, state: { fromNotification: true } };
    }
    return { path: `${base}${n.link}`, state: { fromNotification: true } };
  }

  switch (true) {
    case type.includes('message'):
      return {
        path: `${base}?tab=messages`,
        state: { fromNotification: true, messageId: n.entity_id }
      };

    case isJobApplication:
      // Recruiter "My Jobs" tab is the typical landing spot
      return {
        path: `${base}?tab=my-jobs`,
        state: { fromNotification: true, jobRoleId: n.entity_id }
      };

    case type === 'test_assignment':
      // Developer taking the test: deep-link if entity_id is the assignment/test id
      if (role === 'developer' && n?.entity_id) {
        // Adjust if your test-taking route is different
        return { path: `/test/${n.entity_id}`, state: { fromNotification: true } };
      }
      // Fallback to tests tab
      return {
        path: `${base}?tab=tests`,
        state: { fromNotification: true, assignmentId: n.entity_id }
      };

    case testCompletionTypes.has(type):
      // Recruiter sees test results / tracker
      return {
        path: `${base}?tab=tracker`,
        state: { fromNotification: true, assignmentId: n.entity_id }
      };

    default:
      // Safe fallback
      return { path: base, state: { fromNotification: true } };
  }
}
