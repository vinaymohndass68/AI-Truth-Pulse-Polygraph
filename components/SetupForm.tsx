
import React, { useState } from 'react';
import { SubjectProfile } from '../types';

interface SetupFormProps {
  onComplete: (profile: SubjectProfile) => void;
}

export const SetupForm: React.FC<SetupFormProps> = ({ onComplete }) => {
  const [profile, setProfile] = useState<SubjectProfile>({
    name: '',
    age: '',
    sex: 'other',
    context: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (profile.name && profile.context) {
      onComplete(profile);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 glass-panel rounded-2xl border border-blue-500/20 shadow-2xl">
      <div className="text-center mb-8">
        <i className="fas fa-fingerprint text-5xl text-blue-500 mb-4"></i>
        <h2 className="text-3xl font-bold text-white tracking-tight">System Initialization</h2>
        <p className="text-slate-400 mt-2">Configure the interrogation parameters and subject profile.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-blue-400 mb-2 uppercase tracking-wider">Investigation Context</label>
          <textarea
            required
            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all h-32"
            placeholder="Describe the situation... (e.g., 'Investigation regarding the missing server room access logs on Friday night.')"
            value={profile.context}
            onChange={e => setProfile({ ...profile, context: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-blue-400 mb-2 uppercase tracking-wider">Subject Name</label>
            <input
              required
              type="text"
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Full Name"
              value={profile.name}
              onChange={e => setProfile({ ...profile, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-blue-400 mb-2 uppercase tracking-wider">Subject Age</label>
            <input
              required
              type="number"
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="e.g. 28"
              value={profile.age}
              onChange={e => setProfile({ ...profile, age: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-blue-400 mb-2 uppercase tracking-wider">Biological Sex</label>
          <div className="flex gap-4">
            {['male', 'female', 'other'].map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setProfile({ ...profile, sex: s })}
                className={`flex-1 py-3 rounded-lg border capitalize transition-all ${
                  profile.sex === s 
                    ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/20' 
                    : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-500'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-4 rounded-xl shadow-xl transition-all flex items-center justify-center gap-3 group"
        >
          <span>PROCEED TO CALIBRATION</span>
          <i className="fas fa-chevron-right group-hover:translate-x-1 transition-transform"></i>
        </button>
      </form>
    </div>
  );
};
