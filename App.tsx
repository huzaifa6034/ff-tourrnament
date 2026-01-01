
import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Screen, Tournament, User } from './types';
import { CloudflareService } from './services/cloudflare';

const TOURNAMENTS: Tournament[] = [
  { id: '1', title: 'Grand Master Cup', type: 'Solo', entryFee: 40, prizePool: 2000, perKill: 10, startTime: '18:00', slotsFull: 30, totalSlots: 48, map: 'Bermuda' },
  { id: '2', title: 'Elite Squad Battle', type: 'Squad', entryFee: 120, prizePool: 6000, perKill: 25, startTime: '20:30', slotsFull: 8, totalSlots: 12, map: 'Purgatory' },
  { id: '3', title: 'Rush Hour Solo', type: 'Solo', entryFee: 20, prizePool: 800, perKill: 5, startTime: '22:00', slotsFull: 40, totalSlots: 48, map: 'Kalahari' },
];

const App: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('AUTH');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Tournament | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);

  const [formData, setFormData] = useState({ email: '', password: '', username: '' });
  const [authError, setAuthError] = useState('');

  // 1. Check for existing Cloudflare session on mount
  useEffect(() => {
    const currentUser = CloudflareService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      setScreen('HOME');
    }
  }, []);

  // 2. Poll for balance updates (Since D1 isn't real-time like Firestore)
  useEffect(() => {
    if (user?.uid && screen !== 'AUTH') {
      const interval = setInterval(async () => {
        try {
          const latestBalance = await CloudflareService.getBalance(user.uid);
          if (latestBalance !== user.balance) {
            setUser({ ...user, balance: latestBalance });
          }
        } catch (e) {
          console.error("Balance sync failed");
        }
      }, 10000); // Check every 10 seconds
      return () => clearInterval(interval);
    }
  }, [user?.uid, screen]);

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError('');

    try {
      if (screen === 'SIGNUP') {
        const newUser = await CloudflareService.signUp(formData);
        setUser(newUser);
        setScreen('HOME');
      } else {
        const loggedUser = await CloudflareService.signIn(formData.email, formData.password);
        setUser(loggedUser);
        setScreen('HOME');
      }
    } catch (err: any) {
      setAuthError(err.message || "Cloudflare Connection Error. Ensure your Worker is deployed.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await CloudflareService.logout();
    setUser(null);
    setScreen('AUTH');
  };

  const joinMatch = async (match: Tournament) => {
    if (!user) return;
    if (user.balance < match.entryFee) {
      alert("Insufficient funds!");
      setScreen('WALLET');
      return;
    }

    setLoading(true);
    try {
      const newBalance = user.balance - match.entryFee;
      const success = await CloudflareService.updateBalance(user.uid, newBalance);
      if (success) {
        setUser({ ...user, balance: newBalance });
        alert(`Successfully Joined ${match.title}!`);
        setScreen('HOME');
      }
    } catch (e) {
      alert("Database error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyResult = async (file: File) => {
    setIsVerifying(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const base64Data = (reader.result as string).split(',')[1];
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: { parts: [{ inlineData: { data: base64Data, mimeType: file.type } }, { text: "Extract player name, rank, and kills from this Free Fire result." }] }
        });
        setAiResult(response.text || "Could not parse result.");
      } catch (e) {
        setAiResult("AI verification failed.");
      } finally {
        setIsVerifying(false);
      }
    };
  };

  // Auth UI Section
  const renderAuth = () => (
    <div className="min-h-screen bg-[#020617] p-8 flex flex-col justify-center animate-fadeIn">
      <div className="text-center mb-10">
        <div className="w-20 h-20 bg-orange-500 rounded-3xl mx-auto flex items-center justify-center text-black text-4xl font-black mb-6 shadow-[0_0_30px_rgba(249,115,22,0.3)]">CF</div>
        <h1 className="gaming-font text-3xl font-black text-white italic">BATTLE HUB <span className="text-orange-500 text-sm block not-italic">Cloudflare Edition</span></h1>
      </div>

      <form onSubmit={handleAuthAction} className="space-y-4 max-w-sm mx-auto w-full">
        {screen === 'SIGNUP' && (
          <input 
            type="text" placeholder="In-Game Name" required
            className="w-full bg-slate-900 border border-white/5 rounded-2xl py-5 px-6 text-white outline-none focus:border-orange-500 transition-all"
            value={formData.username}
            onChange={e => setFormData({...formData, username: e.target.value})}
          />
        )}
        <input 
          type="email" placeholder="Email" required
          className="w-full bg-slate-900 border border-white/5 rounded-2xl py-5 px-6 text-white outline-none focus:border-orange-500 transition-all"
          value={formData.email}
          onChange={e => setFormData({...formData, email: e.target.value})}
        />
        <input 
          type="password" placeholder="Password" required
          className="w-full bg-slate-900 border border-white/5 rounded-2xl py-5 px-6 text-white outline-none focus:border-orange-500 transition-all"
          value={formData.password}
          onChange={e => setFormData({...formData, password: e.target.value})}
        />
        
        {authError && <div className="text-rose-500 text-xs text-center font-bold bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">{authError}</div>}
        
        <button type="submit" disabled={loading} className="w-full bg-orange-500 text-white font-black py-5 rounded-2xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-widest text-sm">
          {loading ? 'Connecting to D1...' : (screen === 'AUTH' ? 'Secure Login' : 'Create Cloud Account')}
        </button>
      </form>

      <div className="mt-8 text-center">
        <button onClick={() => setScreen(screen === 'AUTH' ? 'SIGNUP' : 'AUTH')} className="text-slate-500 text-sm">
          {screen === 'AUTH' ? "Need a D1 Account? " : "Already have one? "}
          <span className="text-orange-400 font-bold underline">Click here</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#020617] text-slate-200 relative overflow-x-hidden">
      {loading && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-orange-400 gaming-font text-[10px] tracking-[0.2em]">ACCESSING D1 DATABASE...</p>
        </div>
      )}

      {(screen === 'AUTH' || screen === 'SIGNUP') ? (
        renderAuth()
      ) : (
        <>
          {/* Header */}
          <div className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 p-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white font-black italic">CF</div>
               <h1 className="gaming-font font-black text-xs">BATTLE HUB</h1>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/20 px-3 py-1.5 rounded-full flex items-center gap-2">
               <i className="fa-solid fa-coins text-orange-500 text-[10px]"></i>
               <span className="text-orange-400 font-black text-sm">₹{user?.balance}</span>
            </div>
          </div>

          <div className="pb-32 p-4">
            {screen === 'HOME' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-orange-600 to-rose-700 p-6 rounded-[32px] shadow-2xl relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                   <h2 className="gaming-font text-white text-xl font-black mb-1">CLOUDFLARE D1</h2>
                   <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest">Global SQL Database Sync</p>
                </div>

                {TOURNAMENTS.map(match => (
                  <div key={match.id} className="bg-slate-900/50 border border-white/5 rounded-3xl p-5 hover:border-orange-500/50 transition-all" onClick={() => { setSelectedMatch(match); setScreen('TOURNAMENT_DETAIL'); }}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="bg-slate-800 text-slate-400 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest">{match.type} • {match.map}</span>
                        <h4 className="gaming-font text-white font-bold mt-1">{match.title}</h4>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-500 text-[8px] font-bold uppercase">Prize</p>
                        <p className="text-xl font-black text-orange-400">₹{match.prizePool}</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-bold">
                       <div className="flex gap-4">
                         <span className="text-slate-500 uppercase">Entry <span className="text-white">₹{match.entryFee}</span></span>
                         <span className="text-slate-500 uppercase">Kill <span className="text-white">₹{match.perKill}</span></span>
                       </div>
                       <span className="text-orange-500">{match.slotsFull}/{match.totalSlots} JOINED</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {screen === 'TOURNAMENT_DETAIL' && selectedMatch && (
              <div className="animate-fadeIn p-2">
                 <button onClick={() => setScreen('HOME')} className="mb-6 flex items-center gap-2 text-slate-500 text-[10px] font-black uppercase"><i className="fa-solid fa-chevron-left"></i> Back</button>
                 <div className="bg-slate-900 border border-white/5 rounded-[40px] p-8">
                    <h2 className="gaming-font text-2xl font-black text-white mb-6">{selectedMatch.title}</h2>
                    <div className="space-y-4 mb-8">
                       <div className="flex justify-between border-b border-white/5 pb-4"><span className="text-slate-500 text-xs font-bold uppercase">Winning Prize</span><span className="text-emerald-400 font-black">₹{selectedMatch.prizePool}</span></div>
                       <div className="flex justify-between border-b border-white/5 pb-4"><span className="text-slate-500 text-xs font-bold uppercase">Entry Fee</span><span className="text-white font-black">₹{selectedMatch.entryFee}</span></div>
                    </div>
                    <button onClick={() => joinMatch(selectedMatch)} className="w-full bg-orange-500 text-white font-black py-5 rounded-2xl shadow-xl shadow-orange-500/20">JOIN VIA D1 TRANSACTION</button>
                 </div>
              </div>
            )}

            {screen === 'WALLET' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="bg-slate-950 p-10 rounded-[40px] border border-white/5 text-center shadow-2xl">
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4">D1 Vault Balance</p>
                  <h3 className="text-6xl font-black text-white mb-10">₹{user?.balance}</h3>
                  <button className="w-full bg-orange-500 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest mb-3">Top Up</button>
                  <button className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest">Withdrawal</button>
                </div>
              </div>
            )}

            {screen === 'PROFILE' && (
              <div className="animate-fadeIn space-y-6">
                <div className="bg-slate-900 p-8 rounded-[40px] text-center border border-white/5">
                   <div className="w-20 h-20 bg-orange-500 rounded-full mx-auto flex items-center justify-center text-3xl mb-4"><i className="fa-solid fa-server text-white"></i></div>
                   <h2 className="gaming-font text-xl font-black">{user?.username}</h2>
                   <p className="text-slate-500 text-[10px] font-bold mt-1 uppercase tracking-widest">{user?.email}</p>
                </div>
                <button onClick={handleLogout} className="w-full bg-rose-500/10 p-5 rounded-2xl flex justify-between items-center border border-rose-500/20 text-xs font-black text-rose-500">
                   <span>CLOSE CONNECTION</span>
                   <i className="fa-solid fa-circle-xmark"></i>
                </button>
              </div>
            )}

            {screen === 'RESULT_UPLOAD' && (
              <div className="space-y-6 p-2">
                <h2 className="gaming-font text-xl font-black">RESULT VERIFIER</h2>
                <div className="bg-slate-950 border-2 border-dashed border-slate-800 rounded-3xl p-10 text-center relative overflow-hidden group">
                  <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => e.target.files?.[0] && handleVerifyResult(e.target.files[0])} />
                  <i className="fa-solid fa-microchip text-4xl text-orange-500 mb-4 group-hover:rotate-12 transition-transform"></i>
                  <p className="font-black text-sm uppercase">Upload Gameplay Screenshot</p>
                  <p className="text-[10px] text-slate-500 mt-2 font-bold uppercase tracking-widest">AI Will Verify Kills</p>
                </div>
                {isVerifying && <div className="text-center py-6 animate-pulse text-orange-500 font-black text-[10px]">AI ANALYZING DATA...</div>}
                {aiResult && <div className="bg-slate-900 p-6 rounded-3xl border border-orange-500/20 font-mono text-[10px] text-slate-400 whitespace-pre-wrap leading-relaxed shadow-inner">{aiResult}</div>}
              </div>
            )}
          </div>

          {/* Nav */}
          <nav className="fixed bottom-6 left-6 right-6 max-w-[calc(28rem-3rem)] mx-auto bg-slate-900/95 backdrop-blur-2xl border border-white/10 p-4 rounded-[32px] flex justify-around items-center shadow-2xl z-50">
            {[
              { s: 'HOME', i: 'fa-trophy', l: 'Matches' },
              { s: 'WALLET', i: 'fa-receipt', l: 'Cash' },
              { s: 'RESULT_UPLOAD', i: 'fa-bolt-lightning', l: 'Verify' },
              { s: 'PROFILE', i: 'fa-id-card', l: 'Stats' }
            ].map(item => (
              <button key={item.s} onClick={() => setScreen(item.s as Screen)} className={`flex flex-col items-center transition-all ${screen === item.s ? 'text-orange-400 scale-110' : 'text-slate-600'}`}>
                <i className={`fa-solid ${item.i} text-lg mb-1`}></i>
                <span className="text-[8px] font-black uppercase tracking-tighter">{item.l}</span>
              </button>
            ))}
          </nav>
        </>
      )}
    </div>
  );
};

export default App;
