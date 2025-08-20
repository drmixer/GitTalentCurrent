import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';

const EmailConfirmPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/pending-approval');
    }, 5000); // Redirect after 5 seconds

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-lg p-8 space-y-6 text-center bg-white rounded-lg shadow-md">
        <CheckCircle className="w-16 h-16 mx-auto text-green-500" />
        <h2 className="text-2xl font-bold text-gray-900">Email Confirmed!</h2>
        <p className="text-gray-600">
          Thank you for confirming your email address. Your account is now active but requires admin approval before you can fully access the platform.
        </p>
        <p className="text-gray-600">
          You will receive an email notification as soon as your account has been approved.
        </p>
        <p className="mt-4 text-sm text-gray-500">
          You will be redirected to our 'Pending Approval' page shortly.
        </p>
      </div>
    </div>
  );
};

export default EmailConfirmPage;
