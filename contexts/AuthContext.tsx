
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../src/lib/supabase';
import { Session } from '@supabase/supabase-js';

interface User {
    id: string;
    name: string;
    email: string;
    credits: number;
}

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loginWithGoogle: () => Promise<void>;
    loginWithIdToken: (token: string) => Promise<void>;
    loginAsGuest: () => void;
    logout: () => Promise<void>;
    deductCredits: (cost: number, action: string) => Promise<boolean>;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch user profile (credits) from 'profiles' table
    const fetchProfile = async (userId: string, email: string) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (data) {
                setUser({
                    id: userId,
                    email: email,
                    name: data.full_name || email.split('@')[0],
                    credits: data.credits
                });
            }
        } catch (e) {
            console.error("Error fetching profile:", e);
        }
    };

    useEffect(() => {
        // 1. Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session?.user) {
                fetchProfile(session.user.id, session.user.email!);
            } else {
                // Check if Guest Mode active
                const guestMode = localStorage.getItem('guest_mode');
                if (guestMode === 'true') {
                    loginAsGuest();
                }
            }
            setIsLoading(false);
        });

        // 2. Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session?.user) {
                fetchProfile(session.user.id, session.user.email!);
                localStorage.removeItem('guest_mode');
            } else if (!localStorage.getItem('guest_mode')) {
                setUser(null);
            }
            setIsLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const loginWithGoogle = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });
    };

    const loginWithIdToken = async (token: string) => {
        const { error } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: token,
        });
        if (error) {
            console.error("ID Token Login failed:", error);
            alert("Login failed: " + error.message);
        }
    };

    const loginAsGuest = () => {
        const mockUser = {
            id: 'guest',
            name: 'Guest',
            email: 'guest@example.com',
            credits: 100
        };
        localStorage.setItem('guest_mode', 'true');
        setUser(mockUser);
    };

    const logout = async () => {
        await supabase.auth.signOut();
        localStorage.removeItem('guest_mode');
        setUser(null);
        setSession(null);
    };

    const deductCredits = async (cost: number, action: string): Promise<boolean> => {
        if (!user) return false;

        // Guest Mode Logic
        if (user.id === 'guest') {
            if (user.credits >= cost) {
                setUser({ ...user, credits: user.credits - cost });
                return true;
            }
            alert("Insufficient guest credits.");
            return false;
        }

        // Real User Logic - Optimistic update handled by checking DB first via RPC if needed,
        // but for now, we trust the render server to perform the deduction transactionally.
        // However, we check local state first for UX.
        if (user.credits < cost) {
            alert("Insufficient credits.");
            return false;
        }

        // We assume the Render Server or specific AI Service call will perform the server-side deduction.
        // But for "Client-side" AI calls (like Gemini Text Gen), we call Supabase RPC directly.
        try {
            // Only deduct here if it's purely client-side logic. 
            // For Render Server, we pass the token and let server deduct.
            // BUT, to keep simple: We deduct here for AI generation tasks.
            const { error } = await supabase.rpc('deduct_credits', { user_id: user.id, amount: cost });
            
            if (error) {
                console.error("Credit deduction failed:", error);
                return false;
            }

            // Refresh local state
            fetchProfile(user.id, user.email);
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    };

    return (
        <AuthContext.Provider value={{ user, session, loginWithGoogle, loginWithIdToken, loginAsGuest, logout, deductCredits, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within an AuthProvider");
    return context;
};
    