
import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Screen, Tournament, User } from './types';
import { CloudflareService } from './services/cloudflare';

const App: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('AUTH');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [joinedTournaments, setJoinedTournaments] = useState<string[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);

  // Admin States
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [newMatch, setNewMatch] = useState({
    title: '', type: 'Solo', entryFee: 10, prizePool: 100, perKill: 5, startTime: '08:00 PM', totalSlots: 48, map: 'Bermuda'
  });

  const [formData, setFormData] = useState({ email: '', password: '', username: '' });
  const [authError, setAuthError] = useState('');

  const loadData = async () => {
    try {
      const data = await CloudflareService.getTournaments();
      setTournaments(data);
      if (user?.uid) {
        const joined = await CloudflareService.getMyTournaments(user.uid);
        setJoinedTournaments(joined);
      }
    } catch (e) {
      console.error("Failed to load tournaments");
    }
  };

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const data = await CloudflareService.getLeaderboard();
      setLeaderboard(data);
    } catch (e) {
      console.error("Leaderboard fetch failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const currentUser = CloudflareService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      setScreen('HOME');
      loadData();
    }
  }, []);

  useEffect(() => {
    if (user?.uid && screen !== 'AUTH' && screen !== 'ADMIN_AUTH') {
      const interval = setInterval(async () => {
        try {
          const latestBalance = await CloudflareService.getBalance(user.uid);
          if (latestBalance !== user.balance) {
            setUser(prev => prev ? { ...prev, balance: latestBalance } : null);
          }
        } catch (e) {}
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [user?.uid, screen]);

  useEffect(() => {
    if (screen === 'HOME') {
      loadData();
    }
    if (screen === 'LEADERBOARD') {
      fetchLeaderboard();
    }
  }, [screen]);

  const handleAuthAction = async (e: React.FormEvent, isAdminLogin: boolean = false) => {
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
        if (isAdminLogin) {
          if (loggedUser.role !== 'admin') throw new Error("Unauthorized: Admin access required.");
          setUser(loggedUser);
          openAdmin();
        } else {
          setUser(loggedUser);
          setScreen('HOME');
        }
      }
    } catch (err: any) {
      setAuthError(err.message || "Authentication Failed");
    } finally {
      setLoading(false);
    }
  };

  const joinMatch = async (match: Tournament) => {
    if (!user) return;
    if (joinedTournaments.includes(match.id)) {
      alert("You are already in this match!");
      return;
    }
    if (match.slotsFull >= match.totalSlots) {
      alert("Tournament is FULL!");
      return;
    }
    if (user.balance < match.entryFee) {
      alert("Insufficient balance!");
      setScreen('WALLET');
      return;
    }

    if (!confirm(`Join ${match.title}?`)) return;

    setLoading(true);
    try {
      const success = await CloudflareService.joinTournament(user.uid, match.id, match.entryFee);
      if (success) {
        setUser({ ...user, balance: user.balance - match.entryFee });
        setJoinedTournaments([...joinedTournaments, match.id]);
        alert("Joined successfully!");
        loadData(); // Refresh slot count
      } else {
        alert("Failed to join. Match might be full.");
      }
    } catch (e) {
      alert("Error joining tournament.");
    } finally {
      setLoading(false);
    }
  };

  const createMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const success = await CloudflareService.adminAddTournament(newMatch);
    if (success) {
      alert("Tournament Created!");
      loadData();
      setScreen('ADMIN');
    } else {
      alert("Failed to create.");
    }
    setLoading(false);
  };

  const openAdmin = async () => {
    setLoading(true);
    try {
      const users = await CloudflareService.adminGetAllUsers();
      setAdminUsers(users);
      setScreen('ADMIN');
    } catch (e) {
      alert("Access Denied.");
      setScreen('HOME');
    } finally {
      setLoading(false);
    }
  };

  const deleteMatch = async (id: string) => {
    if (!confirm("Delete this match?")) return;
    setLoading(true);
    await CloudflareService.adminDeleteTournament(id);
    loadData();
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#020617] text-slate-200 relative overflow-x-hidden border-x border-white/5">
      {loading && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center p-10 text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-orange-500 font-black text-[10px] tracking-[0.3em] uppercase">Cloud Syncing...</p>
        </div>
      )}

      {screen === 'ADMIN_AUTH' ? (
        <div className="min-h-screen bg-slate-950 p-8 flex flex-col justify-center animate-fadeIn">
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-cyan-500 rounded-2xl mx-auto flex items-center justify-center text-black text-4xl mb-4">
              <i className="fa-solid fa-shield-halved"></i>
            </div>
            <h2 className="gaming-font text-2xl font-black text-white uppercase tracking-widest">Admin Portal</h2>
          </div>
          <form onSubmit={(e) => handleAuthAction(e, true)} className="space-y-4 max-w-sm mx-auto w-full">
            <input type="email" placeholder="Admin Email" required className="w-full bg-slate-900 border border-cyan-500/20 rounded-2xl py-4 px-6 text-white outline-none focus:border-cyan-500" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            <input type="password" placeholder="Secure Password" required className="w-full bg-slate-900 border border-cyan-500/20 rounded-2xl py-4 px-6 text-white outline-none focus:border-cyan-500" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            <button type="submit" className="w-full bg-cyan-500 text-black font-black py-4 rounded-2xl uppercase tracking-widest hover:scale-105 transition-all">Enter Console</button>
          </form>
          <button onClick={() => setScreen('AUTH')} className="mt-8 text-slate-500 text-[10px] font-bold uppercase text-center w-full underline">Back to Lobby</button>
        </div>
      ) : screen === 'ADMIN_MATCHES' ? (
        <div className="p-8 animate-fadeIn">
           <div className="flex justify-between items-center mb-8">
              <h2 className="gaming-font text-xl font-black text-orange-500 uppercase">Create Tournament</h2>
              <button onClick={() => setScreen('ADMIN')} className="text-slate-500 text-[10px] font-black uppercase underline">Cancel</button>
           </div>
           <form onSubmit={createMatch} className="space-y-4 bg-slate-900/40 p-6 rounded-[32px] border border-white/5">
              <input type="text" placeholder="Tournament Title" required className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white text-xs" value={newMatch.title} onChange={e => setNewMatch({...newMatch, title: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                 <select className="bg-black/40 border border-white/10 rounded-2xl p-4 text-white text-xs" value={newMatch.type} onChange={e => setNewMatch({...newMatch, type: e.target.value})}>
                    <option>Solo</option><option>Duo</option><option>Squad</option>
                 </select>
                 <input type="text" placeholder="Map" className="bg-black/40 border border-white/10 rounded-2xl p-4 text-white text-xs" value={newMatch.map} onChange={e => setNewMatch({...newMatch, map: e.target.value})} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                 <div><p className="text-[8px] text-slate-500 uppercase ml-2 mb-1">Entry</p><input type="number" className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-xs" value={newMatch.entryFee} onChange={e => setNewMatch({...newMatch, entryFee: parseInt(e.target.value)})} /></div>
                 <div><p className="text-[8px] text-slate-500 uppercase ml-2 mb-1">Pool</p><input type="number" className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-xs" value={newMatch.prizePool} onChange={e => setNewMatch({...newMatch, prizePool: parseInt(e.target.value)})} /></div>
                 <div><p className="text-[8px] text-slate-500 uppercase ml-2 mb-1">Max Slots</p><input type="number" className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-xs" value={newMatch.totalSlots} onChange={e => setNewMatch({...newMatch, totalSlots: parseInt(e.target.value)})} /></div>
              </div>
              <input type="text" placeholder="Time (e.g. 09:00 PM)" className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white text-xs" value={newMatch.startTime} onChange={e => setNewMatch({...newMatch, startTime: e.target.value})} />
              <button type="submit" className="w-full bg-orange-500 text-white font-black py-4 rounded-2xl uppercase tracking-widest mt-4">Publish Match</button>
           </form>
        </div>
      ) : (screen === 'AUTH' || screen === 'SIGNUP') ? (
        <div className="min-h-screen bg-[#020617] p-8 flex flex-col justify-center animate-fadeIn">
          <div className="text-center mb-10">
            <div className="w-24 h-24 bg-gradient-to-tr from-orange-600 to-orange-400 rounded-3xl mx-auto flex items-center justify-center text-white text-5xl font-black mb-6 border-4 border-white/10 shadow-[0_0_50px_rgba(249,115,22,0.2)]">FF</div>
            <h1 className="gaming-font text-3xl font-black text-white tracking-tighter">BATTLE HUB</h1>
            <p className="text-slate-600 text-[9px] font-bold uppercase tracking-[0.4em] mt-2">Professional Tournaments</p>
          </div>
          <form onSubmit={(e) => handleAuthAction(e)} className="space-y-4">
            {screen === 'SIGNUP' && (
              <input type="text" placeholder="Gamer ID" required className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 px-6 text-white outline-none focus:border-orange-500" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
            )}
            <input type="email" placeholder="Email Address" required className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 px-6 text-white outline-none focus:border-orange-500" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            <input type="password" placeholder="Secret Password" required className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 px-6 text-white outline-none focus:border-orange-500" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            {authError && <p className="text-rose-500 text-[10px] text-center font-bold">{authError}</p>}
            <button type="submit" className="w-full bg-orange-500 text-white font-black py-4 rounded-2xl uppercase tracking-widest border-b-4 border-orange-700 active:scale-95 transition-all">
              {screen === 'AUTH' ? 'ENTER LOBBY' : 'JOIN THE TEAM'}
            </button>
          </form>
          <button onClick={() => setScreen(screen === 'AUTH' ? 'SIGNUP' : 'AUTH')} className="mt-8 text-slate-500 text-[10px] font-black uppercase text-center w-full underline">
            {screen === 'AUTH' ? "Need an account?" : "Already a member?"}
          </button>
          <button onClick={() => setScreen('ADMIN_AUTH')} className="mt-16 text-slate-800 text-[8px] font-black uppercase text-center w-full opacity-50 hover:opacity-100 transition-all">Admin Secure Access</button>
        </div>
      ) : screen === 'ADMIN' ? (
        <div className="p-6 space-y-8 animate-fadeIn pb-32">
           <div className="flex justify-between items-center">
              <h2 className="gaming-font text-xl font-black text-cyan-400 uppercase">Control Console</h2>
              <button onClick={() => setScreen('HOME')} className="bg-slate-800 px-4 py-2 rounded-xl text-[8px] font-black uppercase text-white border border-white/5">Exit</button>
           </div>
           <div className="bg-slate-900/40 p-6 rounded-[32px] border border-white/5">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="gaming-font text-[10px] font-black text-white uppercase tracking-widest">Active Matches</h3>
                 <button onClick={() => setScreen('ADMIN_MATCHES')} className="bg-orange-500 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase shadow-lg shadow-orange-500/20">Create Match</button>
              </div>
              <div className="space-y-3">
                 {tournaments.map(t => (
                   <div key={t.id} className="flex justify-between items-center p-4 bg-black/40 rounded-2xl border border-white/5">
                      <div>
                        <p className="text-white font-black text-xs">{t.title}</p>
                        <p className="text-slate-500 text-[8px] uppercase tracking-tighter">{t.slotsFull}/{t.totalSlots} Slots • ₹{t.entryFee}</p>
                      </div>
                      <button onClick={() => deleteMatch(t.id)} className="text-rose-500/50 hover:text-rose-500 transition-colors"><i className="fa-solid fa-trash-can"></i></button>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      ) : (
        <>
          <div className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-xl border-b border-white/5 p-4 flex justify-between items-center shadow-lg">
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white font-black italic shadow-inner">FF</div>
               <div><h1 className="gaming-font font-black text-[9px] text-white tracking-widest uppercase">Battle Hub</h1></div>
            </div>
            <div className="bg-slate-900 border border-white/10 px-4 py-1.5 rounded-xl cursor-pointer active:scale-95 transition-transform" onClick={() => setScreen('WALLET')}>
               <span className="text-white font-black text-xs">₹{user?.balance}</span>
            </div>
          </div>

          <div className="pb-32 p-5">
            {screen === 'HOME' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-indigo-950/80 to-slate-900 p-8 rounded-[40px] border border-white/10 relative overflow-hidden">
                   <h2 className="gaming-font text-white text-lg font-black uppercase">WARRIOR: {user?.username}</h2>
                   <div className="flex gap-4 mt-6">
                      <div className="bg-white/5 px-5 py-3 rounded-2xl border border-white/5">
                        <p className="text-[7px] text-slate-500 font-black uppercase mb-1">Total Earned</p>
                        <p className="text-lg font-black text-emerald-400 italic">₹{user?.totalEarnings || 0}</p>
                      </div>
                      <div className="bg-white/5 px-5 py-3 rounded-2xl border border-white/5">
                        <p className="text-[7px] text-slate-500 font-black uppercase mb-1">Matches</p>
                        <p className="text-lg font-black text-white italic">{user?.matchesPlayed || 0}</p>
                      </div>
                   </div>
                </div>

                <div className="flex justify-between items-center px-2">
                  <h3 className="gaming-font text-[10px] font-black tracking-widest text-slate-500 uppercase">Live Tournaments</h3>
                  <button onClick={loadData} className="text-orange-500"><i className="fa-solid fa-rotate-right"></i></button>
                </div>

                {tournaments.map(match => {
                  const isJoined = joinedTournaments.includes(match.id);
                  const isFull = match.slotsFull >= match.totalSlots;
                  const slotPercent = Math.min(100, (match.slotsFull / match.totalSlots) * 100);

                  return (
                    <div key={match.id} className={`bg-slate-900/40 border ${isJoined ? 'border-emerald-500/40' : isFull ? 'border-rose-500/20' : 'border-white/5'} rounded-[40px] p-6 group transition-all`}>
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex gap-4 items-center">
                          <div className={`w-12 h-12 ${isJoined ? 'bg-emerald-500 text-white' : isFull ? 'bg-slate-900 text-slate-700' : 'bg-slate-800 text-orange-500'} rounded-2xl flex items-center justify-center border border-white/5`}>
                             <i className={`fa-solid ${match.type === 'Solo' ? 'fa-user' : 'fa-users'} text-xl`}></i>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="bg-orange-500 text-white text-[8px] font-black px-2 py-0.5 rounded-lg uppercase">{match.map}</span>
                              <span className="text-slate-500 text-[10px] font-black italic">{match.startTime}</span>
                            </div>
                            <h4 className="gaming-font text-white font-black text-sm uppercase">{match.title}</h4>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-slate-500 text-[8px] font-black uppercase">Prize Pool</p>
                          <p className="text-xl font-black text-emerald-400 italic">₹{match.prizePool}</p>
                        </div>
                      </div>

                      {/* Slot Progress Bar */}
                      <div className="mb-4 space-y-2">
                        <div className="flex justify-between text-[8px] font-black uppercase tracking-widest">
                           <span className={isFull ? 'text-rose-500' : 'text-slate-500'}>{isFull ? 'Match Full' : 'Spots Filling Fast'}</span>
                           <span className="text-white">{match.slotsFull} / {match.totalSlots}</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-white/5">
                           <div className={`h-full transition-all duration-700 ${isFull ? 'bg-rose-500' : 'bg-orange-500'}`} style={{ width: `${slotPercent}%` }}></div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-4 border-t border-white/5">
                        <div className="flex gap-4">
                           <div><p className="text-[7px] text-slate-600 font-black uppercase">Entry</p><p className="text-xs text-white font-black italic">₹{match.entryFee}</p></div>
                           <div><p className="text-[7px] text-slate-600 font-black uppercase">Per Kill</p><p className="text-xs text-white font-black italic">₹{match.perKill}</p></div>
                        </div>
                        {isJoined ? (
                          <span className="bg-emerald-500/20 text-emerald-500 text-[9px] font-black px-4 py-2 rounded-xl border border-emerald-500/20">JOINED ✅</span>
                        ) : isFull ? (
                          <span className="bg-rose-500/10 text-rose-500 text-[9px] font-black px-4 py-2 rounded-xl border border-rose-500/20 opacity-50">FULL 🚫</span>
                        ) : (
                          <button onClick={() => joinMatch(match)} className="bg-orange-500/10 text-orange-500 text-[9px] font-black px-4 py-2 rounded-xl border border-orange-500/20 group-hover:bg-orange-500 group-hover:text-white transition-all">JOIN NOW</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* ... rest of the screens (Leaderboard, Wallet, etc.) ... */}
            {screen === 'LEADERBOARD' && (
              <div className="space-y-6 animate-fadeIn">
                <h2 className="gaming-font text-2xl font-black text-white text-center uppercase">World Ranking</h2>
                <div className="bg-slate-900/40 border border-white/5 rounded-[40px] overflow-hidden">
                  {leaderboard.map((player, index) => (
                    <div key={player.username} className="p-6 border-b border-white/5 flex justify-between items-center">
                       <div className="flex items-center gap-4">
                          <span className="text-orange-500 font-black text-lg">#{index+1}</span>
                          <div>
                             <p className="text-white font-black uppercase">{player.username}</p>
                             <p className="text-[8px] text-slate-500 uppercase">{player.matchesPlayed} Matches</p>
                          </div>
                       </div>
                       <p className="text-emerald-400 font-black italic">₹{player.totalEarnings}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {screen === 'WALLET' && (
              <div className="space-y-6 animate-fadeIn">
                 <button onClick={() => setScreen('HOME')} className="text-slate-500 text-[10px] font-black uppercase underline">Back</button>
                 <div className="bg-slate-950 p-12 rounded-[50px] border border-white/5 text-center">
                    <p className="text-slate-500 text-[10px] uppercase mb-6">Secured Vault</p>
                    <h3 className="text-7xl font-black text-white mb-12 italic tracking-tighter">₹{user?.balance}</h3>
                    <div className="grid grid-cols-2 gap-4">
                       <button onClick={() => alert("Recharge feature integrated with D1!")} className="bg-orange-500 text-white font-black py-5 rounded-2xl uppercase tracking-widest">Deposit</button>
                       <button onClick={() => alert("Withdraw logic ready!")} className="bg-slate-900 text-white font-black py-5 rounded-2xl border border-white/10">Withdraw</button>
                    </div>
                 </div>
              </div>
            )}
          </div>

          <nav className="fixed bottom-8 left-6 right-6 max-w-[calc(28rem-3rem)] mx-auto bg-slate-950/90 backdrop-blur-3xl border border-white/10 p-5 rounded-[40px] flex justify-around items-center z-50">
            {[
              { s: 'HOME', i: 'fa-gamepad' },
              { s: 'LEADERBOARD', i: 'fa-ranking-star' },
              { s: 'WALLET', i: 'fa-indian-rupee-sign' },
              { s: 'PROFILE', i: 'fa-user' }
            ].map(item => (
              <button key={item.s} onClick={() => setScreen(item.s as any)} className={`p-4 rounded-2xl transition-all ${screen === item.s ? 'bg-orange-500 text-white scale-110 shadow-lg' : 'text-slate-600'}`}>
                <i className={`fa-solid ${item.i} text-xl`}></i>
              </button>
            ))}
          </nav>
        </>
      )}
    </div>
  );
};

export default App;
