import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { Lock, Mail } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const formatAuthError = (code?: string) => {
    switch (code) {
      case 'auth/invalid-email':
        return 'Please enter a valid email or username.';
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'Incorrect credentials. Please check username/email and password.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a few minutes and try again.';
      default:
        return 'Login failed. Please try again.';
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Allow children to login by username instead of typing the hidden email domain.
      const normalized = email.trim().toLowerCase();
      const formattedEmail = normalized.includes('@') ? normalized : `${normalized}@tiktrack.family`;
      await signInWithEmailAndPassword(auth, formattedEmail, password);
      navigate('/'); // AuthContext will redirect based on role
    } catch (err: any) {
      setError(formatAuthError(err?.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-extrabold text-primary mb-2">TikTrack</h1>
        <p className="text-textMuted font-medium">Your Family's Growth Ecosystem</p>
      </div>

      <div className="bg-surface w-full max-w-md rounded-3xl shadow-xl overflow-hidden">
        <div className="p-8">
          <h2 className="text-2xl font-bold text-text mb-6 text-center">Welcome Back</h2>
          
          {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-6">{error}</div>}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-textMuted" size={20} />
              <input 
                type="text" 
                placeholder="Email Address or Username" 
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-textMuted" size={20} />
              <input 
                type="password" 
                placeholder="Password" 
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-primary text-white font-bold py-3.5 rounded-xl mt-6 hover:bg-primary/90 transition-colors disabled:opacity-70"
            >
              {loading ? 'Logging in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <div className="bg-gray-50 p-6 border-t border-gray-100 text-center">
          <p className="text-textMuted text-sm">
            Are you a Parent starting a new workspace? <br/>
            <Link to="/signup" className="text-primary font-bold hover:underline">Register your Family</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
