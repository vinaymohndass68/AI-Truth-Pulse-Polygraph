
import React from 'react';
import { SubjectProfile, QuestionRecord } from '../types';

interface ReportProps {
  profile: SubjectProfile;
  records: QuestionRecord[];
  onRestart: () => void;
}

export const Report: React.FC<ReportProps> = ({ profile, records, onRestart }) => {
  const truths = records.filter(r => r.verdict === 'TRUTH').length;
  const lies = records.filter(r => r.verdict === 'LIE').length;
  const deceptionRate = records.length > 0 ? Math.round((lies / records.length) * 100) : 0;

  const downloadData = () => {
    const data = {
      subject: profile,
      sessionDate: new Date().toISOString(),
      summary: { total: records.length, truths, lies, deceptionRate: `${deceptionRate}%` },
      transcript: records
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `polygraph-report-${profile.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="glass-panel p-8 rounded-3xl border border-blue-500/20">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white mb-1">Interrogation Report</h2>
            <p className="text-slate-400 font-mono text-sm">Case ID: {crypto.randomUUID().slice(0, 8).toUpperCase()}</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={downloadData}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm flex items-center gap-2 transition-all border border-slate-700"
            >
              <i className="fas fa-download"></i> Download JSON
            </button>
            <button
              onClick={onRestart}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm flex items-center gap-2 transition-all"
            >
              <i className="fas fa-redo"></i> New Case
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
            <div className="text-[10px] text-slate-500 uppercase font-bold">Subject</div>
            <div className="text-white font-medium truncate">{profile.name}</div>
          </div>
          <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
            <div className="text-[10px] text-slate-500 uppercase font-bold">Age / Sex</div>
            <div className="text-white font-medium">{profile.age} / {profile.sex}</div>
          </div>
          <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
            <div className="text-[10px] text-slate-500 uppercase font-bold">Total Qs</div>
            <div className="text-white font-bold">{records.length}</div>
          </div>
          <div className={`p-4 rounded-2xl border ${deceptionRate > 50 ? 'bg-red-500/10 border-red-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
            <div className="text-[10px] text-slate-500 uppercase font-bold">Deception Prob.</div>
            <div className={`text-xl font-black ${deceptionRate > 50 ? 'text-red-500' : 'text-green-500'}`}>{deceptionRate}%</div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest px-2">Detailed Transcript</h3>
          <div className="overflow-hidden rounded-2xl border border-white/5 bg-black/20">
            <table className="w-full text-left">
              <thead className="bg-white/5 text-[10px] uppercase font-black text-slate-400">
                <tr>
                  <th className="p-4">#</th>
                  <th className="p-4">Question / Subject Response</th>
                  <th className="p-4 text-center">Verdict</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {records.map((r, i) => (
                  <tr key={r.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 text-slate-500 font-mono text-sm align-top">{i + 1}</td>
                    <td className="p-4 space-y-1">
                      <div className="text-slate-200 text-sm font-medium">{r.question}</div>
                      <div className="text-slate-500 text-xs italic">" {r.answer} "</div>
                    </td>
                    <td className="p-4 align-top text-center">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest ${
                        r.verdict === 'TRUTH' ? 'bg-green-500/20 text-green-500 border border-green-500/30' : 'bg-red-500/20 text-red-500 border border-red-500/30'
                      }`}>
                        {r.verdict}
                      </span>
                    </td>
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-12 text-center text-slate-600 italic">No data recorded during session.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
