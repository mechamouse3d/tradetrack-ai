import React from 'react';
import { X, ShieldCheck, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LoginModalProps {
  onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ onClose }) => {
  const { loginWithEmail, register, error } = useAuth();

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative max-h-[90vh] overflow-y-auto">
        <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
        >
            <X size={20} />
        </button>
        
        <div className="p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
                <ShieldCheck size={32} className="text-indigo-600" />
            </div>

            <h2 className="text-2xl font-bold text-slate-900 mb-2">Secure Authentication</h2>
            
            <div className="w-full">
                <p className="text-slate-500 mb-8">
                    TradeTrack AI uses Auth0 to ensure your portfolio data is safe and accessible only to you.
                </p>

                {error && (
                <div className="mb-6 p-3 bg-rose-50 text-rose-600 rounded-lg text-sm w-full flex flex-col gap-1 items-start text-left">
                    <div className="flex items-center gap-2 font-semibold">
                        <AlertCircle size={16} /> 
                        <span>Authentication Error</span>
                    </div>
                    <span>{error}</span>
                </div>
                )}

                <div className="flex flex-col gap-3 w-full">
                    <button 
                        onClick={() => loginWithEmail()}
                        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 rounded-xl transition-all shadow-sm"
                    >
                        <LogIn size={20} />
                        <span>Log In</span>
                    </button>
                    
                    <button 
                        onClick={() => register()}
                        className="w-full flex items-center justify-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium py-3 px-4 rounded-xl transition-all"
                    >
                        <span>Create Account</span>
                    </button>
                </div>
                
                <p className="mt-6 text-xs text-slate-400">
                    You will be redirected to our secure login page.
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;