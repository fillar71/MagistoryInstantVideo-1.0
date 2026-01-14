
import { createClient } from '@supabase/supabase-js';

// Expect these in Environment Variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("⚠️ SUPABASE_URL or SERVICE_ROLE_KEY missing. Authentication will fail.");
}

// Admin client to perform DB operations bypass RLS
// Initialize only if keys are present to avoid crash on startup
export const supabaseAdmin = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) 
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

export const verifyUserAndDeductCredits = async (authHeader: string | undefined, cost: number) => {
    if (!supabaseAdmin) {
         console.error("Authentication failed: Server missing Supabase credentials.");
         throw new Error("Server Configuration Error: Authentication unavailable.");
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error("Missing or invalid Authorization header");
    }

    const token = authHeader.split(' ')[1];

    // 1. Verify User Token
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
        throw new Error("Invalid or expired token");
    }

    // 2. Check & Deduct Credits via RPC (Atomic Transaction)
    // Ensure 'deduct_credits' function exists in Supabase SQL
    const { error: rpcError } = await supabaseAdmin.rpc('deduct_credits', { 
        user_id: user.id, 
        amount: cost 
    });

    if (rpcError) {
        throw new Error(rpcError.message || "Failed to deduct credits (Insufficient funds)");
    }

    return user;
};
