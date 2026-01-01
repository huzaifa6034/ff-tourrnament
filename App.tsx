
import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Screen, Tournament, User } from './types';
import { CloudflareService } from './services/cloudflare';

const TOURNAMENTS: Tournament[] = [
  { id: '1', title: 'FF CHAMPIONS TROPHY', type: 'Solo', entryFee: 50, prizePool: 2500, perKill: 15, startTime: '06:00 PM', slotsFull: 42, totalSlots: 48, map: 'Bermuda' },
  { id: '2', title: 'ELITE SQUAD SCRIMS', type: 'Squad', entryFee: 200, prizePool: 8000, perKill: 40, startTime: '08:30 PM', slotsFull: 10, totalSlots: 12, map: 'Purgatory' },
  { id: '3', title: 'NOOB TO PRO BATTLE', type: 'Solo', entryFee: 10, prizePool: 500, perKill: 5, startTime: '10:00 PM', slotsFull: 20, totalSlots: 48, map: 'Kalahari' },
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

  useEffect(() => {
    const currentUser = CloudflareService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      setScreen('HOME');
    }
  }, []);

  useEffect(() => {
    if (user?.uid && screen !== 'AUTH') {
      const interval = setInterval(async () => {
        try {
          const latestBalance = await CloudflareService.getBalance(user.uid);
          if (latestBalance !== user.balance) {
            setUser(prev => prev ? { ...prev, balance: latestBalance } : null);
          }
        } catch (e) {
          console.error("D1 Sync Error");
        }
      }, 5000);
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
      setAuthError(err.message || "Database Error: Please ensure 'users' table is created in D1 Console.");
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
      alert("Paisa khatam! Recharge karein.");
      setScreen('WALLET');
      return;
    }

    setLoading(true);
    try {
      const newBalance = user.balance - match.entryFee;
      const success = await CloudflareService.updateBalance(user.uid, newBalance);
      if (success) {
        setUser({ ...user, balance: newBalance });
        alert(`Joined ${match.title}! Check your room ID in matches.`);
        setScreen('HOME');
      }
    } catch (e) {
      alert("Cloudflare D1 Transaction Failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyResult = async (file: File) => {
    setIsVerifying(true);
    setAiResult(null);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const base64Data = (reader.result as string).split(',')[1];
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: { 
            parts: [
              { inlineData: { data: base64Data, mimeType: file.type } }, 
              { text: "This is a Free Fire game result screenshot. Extract: 1. Player Name, 2. Rank/Position, 3. Total Kills. Format it as a neat report." }
            ] 
          }
        });
        setAiResult(response.text || "Could not read image.");
      } catch (e) {
        setAiResult("AI verification failed. Please check internet.");
      } finally {
        setIsVerifying(false);
      }
    };
  };

  const renderAuth = () => (
    <div className="min-h-screen bg-[#020617] p-8 flex flex-col justify-center animate-fadeIn">
      <div className="text-center mb-10">
        <div className="w-24 h-24 bg-gradient-to-tr from-orange-600 to-orange-400 rounded-3xl mx-auto flex items-center justify-center text-white text-5xl font-black mb-6 shadow-[0_0_50px_rgba(249,115,22,0.4)] border-4 border-white/10">FF</div>
        <h1 className="gaming-font text-4xl font-black text-white italic tracking-tighter">BATTLE <span className="text-orange-500">HUB</span></h1>
        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.4em] mt-2">D1 Database Powered</p>
      </div>

      <form onSubmit={handleAuthAction} className="space-y-4 max-w-sm mx-auto w-full">
        {screen === 'SIGNUP' && (
          <div className="relative">
            <i className="fa-solid fa-user absolute left-6 top-1/2 -translate-y-1/2 text-slate-500"></i>
            <input 
              type="text" placeholder="Free Fire ID Name" required
              className="w-full bg-slate-900/50 border border-white/10 rounded-2xl py-5 pl-14 pr-6 text-white outline-none focus:border-orange-500 transition-all placeholder:text-slate-600"
              value={formData.username}
              onChange={e => setFormData({...formData, username: e.target.value})}
            />
          </div>
        )}
        <div className="relative">
          <i className="fa-solid fa-envelope absolute left-6 top-1/2 -translate-y-1/2 text-slate-500"></i>
          <input 
            type="email" placeholder="Email Address" required
            className="w-full bg-slate-900/50 border border-white/10 rounded-2xl py-5 pl-14 pr-6 text-white outline-none focus:border-orange-500 transition-all placeholder:text-slate-600"
            value={formData.email}
            onChange={e => setFormData({...formData, email: e.target.value})}
          />
        </div>
        <div className="relative">
          <i className="fa-solid fa-lock absolute left-6 top-1/2 -translate-y-1/2 text-slate-500"></i>
          <input 
            type="password" placeholder="Password" required
            className="w-full bg-slate-900/50 border border-white/10 rounded-2xl py-5 pl-14 pr-6 text-white outline-none focus:border-orange-500 transition-all placeholder:text-slate-600"
            value={formData.password}
            onChange={e => setFormData({...formData, password: e.target.value})}
          />
        </div>
        
        {authError && <div className="text-rose-400 text-[10px] text-center font-bold bg-rose-500/10 p-4 rounded-xl border border-rose-500/20 animate-pulse">{authError}</div>}
        
        <button type="submit" disabled={loading} className="w-full bg-orange-500 text-white font-black py-5 rounded-2xl shadow-[0_10px_30px_rgba(249,115,22,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-widest text-sm mt-4 border-b-4 border-orange-700">
          {loading ? 'SYNCING DATABASE...' : (screen === 'AUTH' ? 'LOGIN TO BATTLE' : 'REGISTER PLAYER')}
        </button>
      </form>

      <div className="mt-10 text-center">
        <button onClick={() => setScreen(screen === 'AUTH' ? 'SIGNUP' : 'AUTH')} className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">
          {screen === 'AUTH' ? "Don't have an account? " : "Already registered? "}
          <span className="text-orange-500 underline ml-1">Switch here</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#020617] text-slate-200 relative overflow-x-hidden border-x border-white/5">
      {loading && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center p-10 text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-6"></div>
          <p className="text-orange-500 gaming-font text-xs font-black tracking-[0.3em] uppercase">Processing D1 Query...</p>
          <p className="text-slate-500 text-[10px] mt-2">Connecting to Cloudflare Global Network</p>
        </div>
      )}

      {(screen === 'AUTH' || screen === 'SIGNUP') ? (
        renderAuth()
      ) : (
        <>
          <div className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-xl border-b border-white/5 p-4 flex justify-between items-center shadow-lg">
            <div className="flex items-center gap-3">
               <div className="w-9 h-9 bg-orange-500 rounded-lg flex items-center justify-center text-white font-black italic shadow-inner">FF</div>
               <div>
                  <h1 className="gaming-font font-black text-[10px] leading-none text-white tracking-widest">BATTLE HUB</h1>
                  <span className="text-[8px] text-emerald-500 font-bold uppercase tracking-tighter">● Server Online</span>
               </div>
            </div>
            <div className="bg-slate-900 border border-white/10 px-4 py-2 rounded-2xl flex items-center gap-2 group cursor-pointer hover:border-orange-500/50 transition-colors" onClick={() => setScreen('WALLET')}>
               <i className="fa-solid fa-wallet text-orange-500 text-xs"></i>
               <span className="text-white font-black text-sm">₹{user?.balance}</span>
               <i className="fa-solid fa-plus-circle text-emerald-500 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"></i>
            </div>
          </div>

          <div className="pb-32 p-5">
            {screen === 'HOME' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-indigo-950 to-slate-900 p-6 rounded-[32px] border border-white/10 relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-40 h-40 bg-orange-500/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                   <h2 className="gaming-font text-white text-xl font-black mb-1">WELCOME, {user?.username}</h2>
                   <div className="flex gap-4 mt-4">
                      <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                        <p className="text-[8px] text-slate-500 font-black uppercase">Earnings</p>
                        <p className="text-xs font-black text-emerald-400">₹{user?.totalEarnings || 0}</p>
                      </div>
                      <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                        <p className="text-[8px] text-slate-500 font-black uppercase">Played</p>
                        <p className="text-xs font-black text-orange-400">{user?.matchesPlayed || 0}</p>
                      </div>
                   </div>
                </div>

                <div className="flex justify-between items-center px-1">
                  <h3 className="gaming-font text-[10px] font-black tracking-widest text-slate-500 uppercase">Live Tournaments</h3>
                  <div className="h-px flex-1 bg-white/5 mx-4"></div>
                </div>

                {TOURNAMENTS.map(match => (
                  <div key={match.id} className="bg-slate-900/40 border border-white/5 rounded-3xl p-5 hover:bg-slate-900/60 transition-all cursor-pointer group" onClick={() => { setSelectedMatch(match); setScreen('TOURNAMENT_DETAIL'); }}>
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex gap-3 items-center">
                        <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center border border-white/5 text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-all">
                           <i className={`fa-solid ${match.type === 'Solo' ? 'fa-user' : 'fa-users'} text-lg`}></i>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="bg-orange-500/10 text-orange-500 text-[8px] font-black px-2 py-0.5 rounded uppercase">{match.map}</span>
                            <span className="text-slate-500 text-[8px] font-bold uppercase tracking-widest">{match.startTime}</span>
                          </div>
                          <h4 className="gaming-font text-white font-bold mt-1 text-sm tracking-tight">{match.title}</h4>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-600 text-[8px] font-bold uppercase">Pool</p>
                        <p className="text-lg font-black text-white">₹{match.prizePool}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="bg-black/20 p-2 rounded-xl text-center border border-white/5">
                           <p className="text-[7px] text-slate-500 uppercase font-black">Entry</p>
                           <p className="text-[10px] font-black text-white">₹{match.entryFee}</p>
                        </div>
                        <div className="bg-black/20 p-2 rounded-xl text-center border border-white/5">
                           <p className="text-[7px] text-slate-500 uppercase font-black">Per Kill</p>
                           <p className="text-[10px] font-black text-white">₹{match.perKill}</p>
                        </div>
                        <div className="bg-black/20 p-2 rounded-xl text-center border border-white/5">
                           <p className="text-[7px] text-slate-500 uppercase font-black">Mode</p>
                           <p className="text-[10px] font-black text-white">{match.type}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                       <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-orange-500 rounded-full" style={{ width: `${(match.slotsFull / match.totalSlots) * 100}%` }}></div>
                       </div>
                       <span className="text-[9px] font-black text-orange-500 uppercase">{match.slotsFull}/{match.totalSlots} JOINED</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {screen === 'TOURNAMENT_DETAIL' && selectedMatch && (
              <div className="animate-fadeIn">
                 <button onClick={() => setScreen('HOME')} className="mb-6 flex items-center gap-2 text-slate-500 text-[10px] font-black uppercase hover:text-white transition-colors"><i className="fa-solid fa-arrow-left"></i> BACK TO LOBBY</button>
                 <div className="bg-slate-900/50 border border-white/5 rounded-[40px] p-8 relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-orange-500/10 to-transparent"></div>
                    <div className="text-center mb-8 relative z-10">
                      <div className="w-20 h-20 bg-orange-500/10 rounded-3xl mx-auto flex items-center justify-center text-4xl text-orange-500 mb-4 border border-orange-500/20">
                         <i className="fa-solid fa-trophy"></i>
                      </div>
                      <h2 className="gaming-font text-2xl font-black text-white">{selectedMatch.title}</h2>
                      <p className="text-orange-500 text-[10px] font-black mt-2 tracking-[0.2em] uppercase">Tournament Rules Applied</p>
                    </div>

                    <div className="space-y-4 mb-10">
                       <div className="flex justify-between items-center bg-black/20 p-4 rounded-2xl border border-white/5">
                         <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Grand Prize</span>
                         <span className="text-emerald-400 font-black text-xl">₹{selectedMatch.prizePool}</span>
                       </div>
                       <div className="flex justify-between items-center bg-black/20 p-4 rounded-2xl border border-white/5">
                         <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Entry Fee</span>
                         <span className="text-white font-black text-xl">₹{selectedMatch.entryFee}</span>
                       </div>
                       <div className="flex justify-between items-center bg-black/20 p-4 rounded-2xl border border-white/5">
                         <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Map & Mode</span>
                         <span className="text-orange-400 font-black text-sm uppercase">{selectedMatch.map} • {selectedMatch.type}</span>
                       </div>
                    </div>

                    <button onClick={() => joinMatch(selectedMatch)} className="w-full bg-orange-500 text-white font-black py-6 rounded-3xl shadow-2xl shadow-orange-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-[0.2em] text-sm border-b-4 border-orange-700">
                      CONFIRM ENTRY
                    </button>
                 </div>
              </div>
            )}

            {screen === 'WALLET' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="bg-slate-950 p-10 rounded-[40px] border border-white/5 text-center shadow-2xl relative overflow-hidden">
                  <div className="absolute bottom-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full -mb-10 -mr-10 blur-3xl"></div>
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4">Vault Balance</p>
                  <h3 className="text-6xl font-black text-white mb-10">₹{user?.balance}<span className="text-orange-500 text-sm">.00</span></h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <button className="bg-orange-500 text-white font-black py-5 rounded-2xl text-[10px] uppercase tracking-widest border-b-4 border-orange-700 active:translate-y-1 transition-all">Add Money</button>
                    <button className="bg-slate-900 text-white font-black py-5 rounded-2xl text-[10px] uppercase tracking-widest border border-white/5 hover:bg-slate-800 transition-all">Withdraw</button>
                  </div>
                </div>

                <div className="bg-slate-900/30 rounded-3xl p-6 border border-white/5">
                   <h4 className="gaming-font text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Recent Transactions</h4>
                   <div className="space-y-4">
                      <div className="flex justify-between items-center py-2">
                         <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-500 text-xs"><i className="fa-solid fa-gift"></i></div>
                            <div>
                               <p className="text-[10px] font-black text-white">Welcome Bonus</p>
                               <p className="text-[8px] text-slate-500">D1 Init Success</p>
                            </div>
                         </div>
                         <span className="text-emerald-400 font-black text-xs">+₹100</span>
                      </div>
                   </div>
                </div>
              </div>
            )}

            {screen === 'PROFILE' && (
              <div className="animate-fadeIn space-y-6">
                <div className="bg-slate-900 p-10 rounded-[40px] text-center border border-white/5 relative overflow-hidden shadow-2xl">
                   <div className="absolute top-0 left-0 w-full h-1 bg-orange-500"></div>
                   <div className="w-24 h-24 bg-gradient-to-tr from-slate-800 to-slate-700 rounded-3xl mx-auto flex items-center justify-center text-4xl mb-6 shadow-xl border border-white/10 relative overflow-hidden group">
                      <i className="fa-solid fa-user-ninja text-white group-hover:scale-125 transition-transform"></i>
                      <div className="absolute inset-0 bg-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                   </div>
                   <h2 className="gaming-font text-2xl font-black text-white uppercase tracking-tight">{user?.username}</h2>
                   <p className="text-orange-500 text-[10px] font-bold mt-2 uppercase tracking-[0.3em]">{user?.email}</p>
                   
                   <div className="grid grid-cols-2 gap-4 mt-10">
                      <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                         <p className="text-xl font-black text-white">{user?.matchesPlayed || 0}</p>
                         <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest mt-1">Total Battles</p>
                      </div>
                      <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                         <p className="text-xl font-black text-emerald-400">₹{user?.totalEarnings || 0}</p>
                         <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest mt-1">Net Profits</p>
                      </div>
                   </div>
                </div>

                <div className="space-y-3">
                  <button className="w-full bg-slate-900/50 p-5 rounded-2xl flex justify-between items-center border border-white/5 hover:bg-slate-800 transition-all text-[11px] font-black uppercase tracking-widest">
                     <span className="flex items-center gap-3"><i className="fa-solid fa-gear text-slate-500"></i> Settings</span>
                     <i className="fa-solid fa-chevron-right text-[10px] text-slate-700"></i>
                  </button>
                  <button className="w-full bg-slate-900/50 p-5 rounded-2xl flex justify-between items-center border border-white/5 hover:bg-slate-800 transition-all text-[11px] font-black uppercase tracking-widest">
                     <span className="flex items-center gap-3"><i className="fa-solid fa-circle-question text-slate-500"></i> Help Center</span>
                     <i className="fa-solid fa-chevron-right text-[10px] text-slate-700"></i>
                  </button>
                  <button onClick={handleLogout} className="w-full bg-rose-500/5 p-6 rounded-2xl flex justify-between items-center border border-rose-500/10 text-[11px] font-black text-rose-500 uppercase tracking-widest hover:bg-rose-500/10 transition-all">
                     <span>CLOSE SECURE SESSION</span>
                     <i className="fa-solid fa-power-off"></i>
                  </button>
                </div>
              </div>
            )}

            {screen === 'RESULT_UPLOAD' && (
              <div className="space-y-6 p-2 animate-fadeIn">
                <div className="text-center mb-8">
                  <h2 className="gaming-font text-2xl font-black text-white tracking-tight">VERIFIER AI</h2>
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">Automatic Kill Detection</p>
                </div>

                <div className="bg-slate-950 border-2 border-dashed border-slate-800 rounded-[40px] p-12 text-center relative overflow-hidden group hover:border-orange-500/50 transition-all">
                  <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" accept="image/*" onChange={(e) => e.target.files?.[0] && handleVerifyResult(e.target.files[0])} />
                  <div className="w-20 h-20 bg-orange-500/5 rounded-full mx-auto flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                     <i className="fa-solid fa-cloud-arrow-up text-4xl text-orange-500"></i>
                  </div>
                  <p className="font-black text-sm uppercase tracking-wider text-white">Upload Screenshot</p>
                  <p className="text-[10px] text-slate-500 mt-3 font-bold uppercase leading-relaxed max-w-[200px] mx-auto">AI scans results for player name and kill count verification.</p>
                </div>

                {isVerifying && (
                  <div className="bg-slate-900 rounded-3xl p-8 text-center border border-orange-500/20 shadow-2xl">
                    <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-orange-500 font-black text-[10px] uppercase tracking-[0.3em] animate-pulse">Scanning Metadata...</p>
                  </div>
                )}

                {aiResult && (
                  <div className="bg-slate-900/50 p-6 rounded-[32px] border border-orange-500/20 font-mono text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed shadow-inner relative overflow-hidden animate-fadeIn">
                    <div className="absolute top-0 right-0 p-3 bg-orange-500 text-black font-black text-[8px] rounded-bl-xl uppercase">AI VERIFIED</div>
                    {aiResult}
                  </div>
                )}
              </div>
            )}
          </div>

          <nav className="fixed bottom-6 left-6 right-6 max-w-[calc(28rem-3rem)] mx-auto bg-slate-950/90 backdrop-blur-2xl border border-white/10 p-4 rounded-[32px] flex justify-around items-center shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50">
            {[
              { s: 'HOME', i: 'fa-gamepad', l: 'Matches' },
              { s: 'WALLET', i: 'fa-indian-rupee-sign', l: 'Vault' },
              { s: 'RESULT_UPLOAD', i: 'fa-brain', l: 'Verify' },
              { s: 'PROFILE', i: 'fa-user-gear', l: 'Profile' }
            ].map(item => (
              <button key={item.s} onClick={() => setScreen(item.s as Screen)} className={`flex flex-col items-center gap-1 transition-all duration-300 ${screen === item.s ? 'text-orange-500 scale-110' : 'text-slate-600 hover:text-slate-400'}`}>
                <div className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${screen === item.s ? 'bg-orange-500/10' : ''}`}>
                   <i className={`fa-solid ${item.i} text-lg`}></i>
                </div>
                <span className={`text-[8px] font-black uppercase tracking-tighter ${screen === item.s ? 'opacity-100' : 'opacity-50'}`}>{item.l}</span>
              </button>
            ))}
          </nav>
        </>
      )}
    </div>
  );
};

export default App;
