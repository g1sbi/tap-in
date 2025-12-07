import { supabase } from './supabase';

/**
 * Initialize anonymous authentication session
 * Called on app startup to ensure user is authenticated
 */
export async function initializeAuth(): Promise<void> {
  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.warn('Session check error:', sessionError.message);
      // Continue to try anonymous sign-in
    }

    if (!session) {
      const { data, error } = await supabase.auth.signInAnonymously();
      
      if (error) {
        // Provide more helpful error message
        const errorMessage = error.message || 'Unknown error';
        const helpfulMessage = errorMessage.includes('missing destination name scopes')
          ? 'Supabase configuration error: Please ensure Anonymous authentication is enabled in your Supabase dashboard (Authentication > Providers > Anonymous).'
          : `Failed to initialize anonymous auth: ${errorMessage}`;
        
        console.error('Auth initialization error:', {
          message: error.message,
          status: error.status,
          helpfulMessage,
        });
        
        throw new Error(helpfulMessage);
      }

      if (data?.session) {
        console.log('Anonymous authentication successful');
      }
    } else {
      console.log('Existing session found');
    }
  } catch (error) {
    // Re-throw with context
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Unexpected auth error: ${String(error)}`);
  }
}

/**
 * Get current user ID
 */
export async function getCurrentUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id || null;
}

