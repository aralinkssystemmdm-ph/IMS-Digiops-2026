
import React, { useState } from 'react';
import { User, Lock, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const BACKGROUND_IMAGE_URL = "https://dev-aralinksassets.pantheonsite.io/wp-content/uploads/2026/04/869f1342f1d5d15337b2bbf470ad2382.jpg";

interface LoginPageProps {
  onLogin: (username: string, fullName: string, role: string) => void;
  onGoToSignUp: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, onGoToSignUp }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isSupabaseConfigured) {
      setError('Database is not connected.');
      return;
    }

    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error: queryError } = await supabase
        .from('user_accounts')
        .select('*')
        .eq('username', username.trim())
        .eq('password', password.trim())
        .single();

      if (queryError || !data) {
        throw new Error('Incorrect username or password.');
      }

      onLogin(data.username, data.full_name, data.role || 'Staff');
    } catch (err: any) {
      setError(err.message || 'An error occurred during login.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    if (error) setError(null);
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 font-sans bg-white dark:bg-slate-950">
      {/* LEFT SIDE (IMAGE PANEL) */}
      <div className="hidden lg:block relative h-full p-4">
        <div className="relative h-full w-full rounded-3xl overflow-hidden shadow-2xl">
          <img 
            src={BACKGROUND_IMAGE_URL} 
            alt="Background" 
            className="absolute inset-0 w-full h-full object-cover" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          
          {/* Logo at top-left of image panel */}
          <div className="absolute top-8 left-8 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/20 backdrop-blur-sm">
              <img 
                src="https://dev-true-lovers-of-god.pantheonsite.io/wp-content/uploads/2026/01/aralinks.jpg" 
                alt="Logo" 
                className="w-full h-full object-cover" 
              />
            </div>
          </div>

          {/* Overlay content at bottom-left */}
          <div className="absolute bottom-12 left-12 text-white space-y-2 max-w-md">
            <p className="text-lg font-medium opacity-90">Get access</p>
            <h2 className="text-4xl font-bold leading-tight text-white" style={{ color: 'white' }}>
              to your inventory dashboard and manage everything seamlessly.
            </h2>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE (FORM PANEL) */}
      <div className="flex items-center justify-center p-8 sm:p-12 lg:p-24">
        <div className="max-w-md w-full space-y-10">
          {/* FORM HEADER */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <img 
                src="https://dev-true-lovers-of-god.pantheonsite.io/wp-content/uploads/2026/01/aralinks.jpg" 
                alt="Logo" 
                className="w-6 h-6 rounded-full object-cover" 
              />
              <span className="text-sm font-medium tracking-wide">Aralinks <span style={{ color: 'var(--brand-accent)' }}>Inventory</span></span>
            </div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight">Welcome Back!</h1>
            <p className="text-orange-500 font-semibold">Sign in to access your dashboard.</p>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="text-red-500 shrink-0" size={20} />
              <p className="text-red-700 dark:text-red-300 text-sm font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-5">
              {/* USERNAME FIELD */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Username</label>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Enter your username"
                    value={username}
                    onChange={handleInputChange(setUsername)}
                    required
                    className="w-full h-12 pr-4 pl-12 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                  />
                  <div className="absolute left-4 inset-y-0 flex items-center text-orange-500 pointer-events-none">
                    <User size={18} />
                  </div>
                </div>
              </div>

              {/* PASSWORD FIELD */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Password</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={handleInputChange(setPassword)}
                    required
                    className="w-full h-12 pl-12 pr-12 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                  />
                  <div className="absolute left-4 inset-y-0 flex items-center text-orange-500 pointer-events-none">
                    <Lock size={18} />
                  </div>
                  <div className="absolute right-4 inset-y-0 flex items-center">
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-orange-500 hover:text-orange-600 transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* LOGIN BUTTON */}
            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white rounded-full font-bold shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                "LOGIN"
              )}
            </button>
          </form>

          {/* FOOTER TEXT */}
          <div className="text-center">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Create an account? <span onClick={onGoToSignUp} className="text-orange-500 cursor-pointer font-bold hover:underline underline-offset-4">Register</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
