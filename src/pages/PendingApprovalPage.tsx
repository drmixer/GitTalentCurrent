import { Mail, Clock } from 'lucide-react';

const PendingApprovalPage = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-lg p-8 space-y-6 text-center bg-white rounded-lg shadow-md">
        <Clock className="w-16 h-16 mx-auto text-blue-500" />
        <h2 className="text-2xl font-bold text-gray-900">Account Pending Approval</h2>
        <p className="text-gray-600">
          Thank you for signing up! Your account has been created and is currently awaiting approval from our admin team.
        </p>
        <p className="text-gray-600">
          You will receive an email notification as soon as your account is approved. This usually takes 24-48 hours.
        </p>
        <div className="pt-4 mt-4 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            If you have any questions, please contact our support team.
          </p>
          <a
            href="mailto:support@gittalent.dev"
            className="inline-flex items-center mt-2 font-medium text-blue-600 hover:text-blue-500"
          >
            <Mail className="w-4 h-4 mr-2" />
            support@mail.gittalent.dev
          </a>
        </div>
      </div>
    </div>
  );
};

export default PendingApprovalPage;
