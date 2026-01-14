
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { MagicWandIcon, PlayIcon } from './icons';
import { GoogleLogin } from '@react-oauth/google';

interface LoginModalProps {
    isOpen: boolean;
    onClose?: () => void;
    message?: string;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, message }) => {
    const { loginAsGuest, loginWithIdToken } = useAuth();
    const [loginError, setLoginError] = useState<string | null>(null);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[100] animate-fade-in">
            <div className="bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700 text-center max-w-md w-full relative">
                
                {onClose && (
                    <button 
                        onClick={onClose}
                        className="absolute top-4 right-4 text-gray-500 hover:text-white text-xl"
                    >
                        ✕
                    </button>
                )}

                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-900/50">
                         <MagicWandIcon className="w-8 h-8 text-white" />
                    </div>
                </div>

                <h2 className="text-2xl font-bold text-white mb-2">Welcome to Magistory</h2>
                <p className="text-gray-400 mb-8">{message || "Sign in to generate AI videos instantly."}</p>
                
                <div className="flex flex-col gap-4">
                    {/* Google Login via ID Token */}
                    <div className="w-full flex flex-col items-center">
                        <GoogleLogin
                            onSuccess={(credentialResponse) => {
                                setLoginError(null);
                                if (credentialResponse.credential) {
                                    loginWithIdToken(credentialResponse.credential);
                                    if(onClose) onClose();
                                }
                            }}
                            onError={() => {
                                console.log('Login Failed');
                                setLoginError("Login Failed. Please add your domain to 'Authorized JavaScript origins' in Google Cloud Console.");
                            }}
                            theme="filled_blue"
                            size="large"
                            width="320"
                            shape="rectangular"
                            text="signin_with"
                        />
                        {loginError && (
                            <div className="mt-3 p-3 bg-red-900/30 border border-red-500/50 rounded text-xs text-red-200 w-full text-center leading-relaxed">
                                <strong>Configuration Error:</strong><br/>
                                {loginError}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3 my-2 opacity-50">
                        <div className="h-px bg-gray-600 flex-1"></div>
                        <span className="text-[10px] uppercase tracking-widest text-gray-400">OR</span>
                        <div className="h-px bg-gray-600 flex-1"></div>
                    </div>

                    <button 
                        onClick={() => {
                            loginAsGuest();
                            if(onClose) onClose();
                        }}
                        className="w-full py-3 bg-gray-700 text-white hover:bg-gray-600 font-bold rounded-lg transition-transform hover:scale-[1.02] flex items-center justify-center gap-2"
                    >
                        <PlayIcon className="w-5 h-5 text-white" />
                        Enter Guest Mode (Offline)
                    </button>
                    
                    <p className="text-[10px] text-gray-500 mt-2">
                        Guest mode data is saved to your browser only.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginModal;
