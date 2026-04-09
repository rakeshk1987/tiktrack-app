import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { Lock, Mail, User } from 'lucide-react';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Create the Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Initialize the Firestore Document for this Parent
      await setDoc(doc(db, 'users', user.uid), {
        id: user.uid,
        email: user.email,
        name: name,
        role: 'parent_admin',
        created_at: new Date().toISOString()
      });

      // Show success
      setSuccess(true);
      setTimeout(() => {
        navigate('/'); 
      }, 1500);

    } catch (err: any) {
      setError(err.message || 'Failed to create account');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4">
      <div className="bg-surface w-full max-w-md rounded-3xl shadow-xl overflow-hidden mt-8">
        <div className="p-8">
          <h2 className="text-2xl font-bold text-text mb-2 text-center">Setup Family Office</h2>
          <p className="text-textMuted text-sm text-center mb-6">Create the Administrator Parent Account</p>
          
          {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-6">{error}</div>}
          {success && <div className="bg-green-50 text-green-700 font-bold border border-green-200 text-center p-3 rounded-lg mb-6 shadow-sm">Workspace successfully created! Redirecting... 🚀</div>}

          <form onSubmit={handleSignup} className="space-y-4">
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-textMuted" size={20} />
              <input 
                type="text" 
                placeholder="Full Name" 
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-textMuted" size={20} />
              <input 
                type="email" 
                placeholder="Email Address" 
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
                placeholder="Secure Password" 
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
              {loading ? 'Creating workspace...' : 'Register Parent Account'}
            </button>
          </form>
        </div>

        <div className="bg-gray-50 p-6 border-t border-gray-100 text-center flex flex-col gap-2">
          <p className="text-textMuted text-sm">
            Child accounts are created from the dashboard after registration.
          </p>
          <p className="text-textMuted text-sm border-t pt-4">
            Already registered? <Link to="/login" className="text-primary font-bold hover:underline">Sign in instead</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
