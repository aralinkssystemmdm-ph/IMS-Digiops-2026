
import React, { useState } from 'react';
import { UserCheck, ChevronDown, AlertCircle, Loader2, Check, Eye, EyeOff, User } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const BACKGROUND_IMAGE_URL = "https://dev-aralinksassets.pantheonsite.io/wp-content/uploads/2026/04/869f1342f1d5d15337b2bbf470ad2382.jpg";

interface SignUpPageProps {
  onSignUpSuccess: () => void;
  onGoToLogin: () => void;
}

const SignUpPage: React.FC<SignUpPageProps> = ({ onSignUpSuccess, onGoToLogin }) => {
  const [firstName, setFirstName] = useState('');
  const [middleInitial, setMiddleInitial] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('Staff');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isSupabaseConfigured) {
      setError('Database is not connected.');
      return;
    }

    if (!firstName.trim() || !lastName.trim() || !username.trim() || !password.trim() || !confirmPassword.trim()) {
      setError('Required fields are missing.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: existingUser } = await supabase
        .from('user_accounts')
        .select('username')
        .eq('username', username.trim())
        .single();

      if (existingUser) {
        throw new Error('This username is already taken.');
      }

      const combinedFullName = `${firstName.trim()} ${middleInitial.trim() ? middleInitial.trim() + '. ' : ''}${lastName.trim()}`;

      const { error: insertError } = await supabase
        .from('user_accounts')
        .insert([{
          username: username.trim(),
          password: password.trim(),
          full_name: combinedFullName,
          first_name: firstName.trim(),
          middle_initial: middleInitial.trim().substring(0, 1),
          last_name: lastName.trim(),
          role: role
        }]);

      if (insertError) throw insertError;

      setSuccess(true);
      setTimeout(() => {
        onSignUpSuccess();
      }, 1500);

    } catch (err: any) {
      setError(err.message || 'An error occurred during registration.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
            <p className="text-lg font-medium opacity-90">Set up</p>
            <h2 className="text-4xl font-bold leading-tight text-white" style={{ color: 'white' }}>
              your account and take control of your inventory seamlessly
            </h2>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE (FORM PANEL) */}
      <div className="flex items-center justify-center p-8 sm:p-12 lg:p-24 overflow-y-auto">
        <div className="max-w-lg w-full space-y-8">
          {/* HEADER SECTION */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-slate-400">
              <img 
                src="https://dev-true-lovers-of-god.pantheonsite.io/wp-content/uploads/2026/01/aralinks.jpg" 
                alt="Logo" 
                className="w-6 h-6 rounded-full object-cover" 
              />
              <span className="text-sm font-medium tracking-wide">Aralinks <span style={{ color: 'var(--brand-accent)' }}>Inventory</span></span>
            </div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight">Create Account</h1>
            <p className="text-orange-500 font-semibold text-sm">Create your account to start managing your inventory.</p>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="text-red-500 shrink-0" size={20} />
              <p className="text-red-700 dark:text-red-300 text-sm font-medium leading-tight">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <Check className="text-emerald-500 shrink-0" size={20} />
              <p className="text-emerald-700 dark:text-emerald-300 text-sm font-medium">Account created! Redirecting to login...</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* ROW 1: First Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">First name</label>
              <input 
                type="text" 
                placeholder="Enter your firstname"
                value={firstName}
                onChange={handleInputChange(setFirstName)}
                required
                className="w-full h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none transition-all"
              />
            </div>

            {/* ROW 2: Middle Initial */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">
                Middle Initial <span className="text-orange-500 font-medium italic">(Optional)</span>
              </label>
              <input 
                type="text" 
                placeholder="Enter your middle initial"
                maxLength={1}
                value={middleInitial}
                onChange={handleInputChange(setMiddleInitial)}
                className="w-full h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none transition-all"
              />
            </div>

            {/* ROW 3: Last Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Last Name</label>
              <input 
                type="text" 
                placeholder="Enter your lastname"
                value={lastName}
                onChange={handleInputChange(setLastName)}
                required
                className="w-full h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none transition-all"
              />
            </div>

            {/* ROW 4: Username & Role */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Username</label>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Enter your username"
                    value={username}
                    onChange={handleInputChange(setUsername)}
                    required
                    className="w-full h-10 px-4 pr-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none transition-all"
                  />
                  <div className="absolute right-4 inset-y-0 flex items-center text-orange-500 pointer-events-none">
                    <User size={16} />
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Role</label>
                <div className="relative">
                  <select 
                    value={role}
                    onChange={handleInputChange(setRole)}
                    required
                    className="w-full h-10 pl-4 pr-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm appearance-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none transition-all cursor-pointer"
                  >
                    <option value="Staff">Staff</option>
                    <option value="Admin">Admin</option>
                  </select>
                  <div className="absolute right-4 inset-y-0 flex items-center text-orange-500 pointer-events-none">
                    <ChevronDown size={16} />
                  </div>
                </div>
              </div>
            </div>

            {/* ROW 5: Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={handleInputChange(setPassword)}
                  required
                  className="w-full h-10 px-4 pr-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none transition-all"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 inset-y-0 flex items-center text-orange-500 hover:text-orange-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* ROW 6: Confirm Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Confirm Password</label>
              <div className="relative">
                <input 
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={handleInputChange(setConfirmPassword)}
                  required
                  className="w-full h-10 px-4 pr-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none transition-all"
                />
                <button 
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 inset-y-0 flex items-center text-orange-500 hover:text-orange-600 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* BUTTON */}
            <button 
              type="submit" 
              disabled={isSubmitting || success} 
              className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white rounded-full font-bold shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2 mt-4"
            >
              {isSubmitting ? (
                <Loader2 className="animate-spin" size={20} />
              ) : success ? (
                <Check size={20} />
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          {/* FOOTER TEXT */}
          <div className="text-center">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Already have an account? <span onClick={onGoToLogin} className="text-orange-500 cursor-pointer font-bold hover:underline underline-offset-4">Login</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;
