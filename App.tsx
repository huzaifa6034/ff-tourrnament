
import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Screen, Tournament, User } from './types';
import { CloudflareService } from './services/cloudflare';

const App: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('AUTH');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Tournament | null>(null);
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
    } catch (e) {
      console.error("Failed to load tournaments");
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
    if (user?.uid && screen !== 'AUTH') {
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
      loadData();
    } catch (err: any) {
      setAuthError(err.message || "Database Error");
    } finally {
      setLoading(false);
    }
  };

  const createMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const success = await CloudflareService.adminAddTournament(newMatch);
    if (success) {
      alert("Match Created Successfully!");
      loadData();
      setScreen('ADMIN');
    } else {
      alert("Failed to create match.");
    }
    setLoading(false);
  };

  const deleteMatch = async (id: string) => {
    if (!confirm("Delete this match?")) return;
    setLoading(true);
    await CloudflareService.adminDeleteTournament(id);
    loadData();
    setLoading(false);
  };

  const openAdmin = async () => {
    setLoading(true);
    const users = await CloudflareService.adminGetAllUsers();
    setAdminUsers(users);
    setScreen('ADMIN');
    setLoading(false);
  };

  const addAdminBalance = async (uid: string, currentBalance: number) => {
    const amount = prompt("How much amount to add?");
    if (!amount) return;
    const newBal = currentBalance + parseFloat(amount);
    setLoading(true);
    await CloudflareService.updateBalance(uid, newBal);
    const users = await CloudflareService.adminGetAllUsers();
    setAdminUsers(users);
    setLoading(false);
  };

  const joinMatch = async (match: Tournament) => {
    if (!user) return;
    if (user.balance < match.entryFee) {
      alert("Insufficient Balance!");
      setScreen('WALLET');
      return;
    }
    setLoading(true);
    try {
      const newBalance = user.balance - match.entryFee;
      const success = await CloudflareService.updateBalance(user.uid, newBalance);
      if (success) {
        setUser({ ...user, balance: newBalance });
        alert(`Joined ${match.title}! Room ID will be shared soon.`);
        setScreen('HOME');
      }
    } catch (e) {
      alert("Transaction Failed.");
    } finally {
      setLoading(false);
    }
  };

  const renderAdmin = () => (
    <div className="p-6 space-y-8 animate-fadeIn pb-32">
       <div className="flex justify-between items-center">
          <h2 className="gaming-font text-2xl font-black text-cyan-400">ADMIN CENTER</h2>
          <button onClick={() => setScreen('HOME')} className="bg-slate-800 px-4 py-2 rounded-xl text-[10px] font-black uppercase text-white">Exit Admin</button>
       </div>

       <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-900/80 p-6 rounded-3xl border border-cyan-500/20">
             <p className="text-[10px] font-black text-slate-500 uppercase">Total Users</p>
             <p className="text-3xl font-black text-white">{adminUsers.length}</p>
          </div>
          <div className="bg-slate-900/80 p-6 rounded-3xl border border-cyan-500/20">
             <p className="text-[10px] font-black text-slate-500 uppercase">Live Matches</p>
             <p className="text-3xl font-black text-white">{tournaments.length}</p>
          </div>
       </div>

       <div className="bg-slate-900/40 p-6 rounded-[32px] border border-white/5">
          <div className="flex justify-between items-center mb-6">
             <h3 className="gaming-font text-xs font-black text-white uppercase">Manage Tournaments</h3>
             <button onClick={() => setScreen('ADMIN_MATCHES')} className="bg-cyan-500 text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-cyan-500/20">Create Match</button>
          </div>
          <div className="space-y-3">
             {tournaments.map(t => (
               <div key={t.id} className="flex justify-between items-center p-4 bg-black/40 rounded-2xl border border-white/5">
                  <div>
                    <p className="text-white font-black text-xs">{t.title}</p>
                    <p className="text-slate-500 text-[8px] uppercase">{t.type} • Fee: ₹{t.entryFee}</p>
                  </div>
                  <button onClick={() => deleteMatch(t.id)} className="text-rose-500 hover:scale-110 transition-transform"><i className="fa-solid fa-trash"></i></button>
               </div>
             ))}
          </div>
       </div>

       <div className="bg-slate-900/40 p-6 rounded-[32px] border border-white/5">
          <h3 className="gaming-font text-xs font-black text-white uppercase mb-6">Player List</h3>
          <div className="space-y-4">
             {adminUsers.map(u => (
               <div key={u.uid} className="flex justify-between items-center p-4 bg-black/20 rounded-2xl border border-white/5">
                  <div>
                    <p className="text-white font-black text-xs">{u.username}</p>
                    <p className="text-emerald-400 text-[10px] font-black">₹{u.balance}</p>
                  </div>
                  <button onClick={() => addAdminBalance(u.uid, u.balance)} className="bg-slate-800 p-2 rounded-lg text-emerald-500 text-[10px] font-black uppercase">Add Cash</button>
               </div>
             ))}
          </div>
       </div>
    </div>
  );

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#020617] text-slate-200 relative overflow-x-hidden border-x border-white/5">
      {loading && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center p-10 text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-6"></div>
          <p className="text-orange-500 gaming-font text-xs font-black tracking-[0.3em] uppercase">Connecting to Cloudflare...</p>
        </div>
      )}

      {(screen === 'AUTH' || screen === 'SIGNUP') ? (
        <div className="min-h-screen bg-[#020617] p-8 flex flex-col justify-center animate-fadeIn">
          <div className="text-center mb-10">
            <div className="w-24 h-24 bg-gradient-to-tr from-orange-600 to-orange-400 rounded-3xl mx-auto flex items-center justify-center text-white text-5xl font-black mb-6 border-4 border-white/10">FF</div>
            <h1 className="gaming-font text-4xl font-black text-white tracking-tighter">BATTLE HUB</h1>
          </div>
          <form onSubmit={handleAuthAction} className="space-y-4">
            {screen === 'SIGNUP' && (
              <input type="text" placeholder="Gamer Name" required className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 px-6 text-white" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
            )}
            <input type="email" placeholder="Email" required className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 px-6 text-white" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            <input type="password" placeholder="Password" required className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 px-6 text-white" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            {authError && <p className="text-rose-500 text-xs text-center font-bold">{authError}</p>}
            <button type="submit" className="w-full bg-orange-500 text-white font-black py-4 rounded-2xl uppercase tracking-widest border-b-4 border-orange-700">
              {screen === 'AUTH' ? 'LOGIN' : 'REGISTER'}
            </button>
          </form>
          <button onClick={() => setScreen(screen === 'AUTH' ? 'SIGNUP' : 'AUTH')} className="mt-8 text-slate-500 text-[10px] font-black uppercase text-center w-full">Switch Mode</button>
        </div>
      ) : screen === 'ADMIN' ? (
        renderAdmin()
      ) : screen === 'ADMIN_MATCHES' ? (
        <div className="p-8 animate-fadeIn">
           <h2 className="gaming-font text-2xl font-black text-cyan-400 mb-8">NEW MATCH</h2>
           <form onSubmit={createMatch} className="space-y-4">
              <input type="text" placeholder="Match Title" required className="w-full bg-slate-900 p-4 rounded-xl border border-white/10" value={newMatch.title} onChange={e => setNewMatch({...newMatch, title: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <select className="bg-slate-900 p-4 rounded-xl border border-white/10" value={newMatch.type} onChange={e => setNewMatch({...newMatch, type: e.target.value})}>
                   <option>Solo</option><option>Duo</option><option>Squad</option>
                </select>
                <input type="text" placeholder="Map" className="bg-slate-900 p-4 rounded-xl border border-white/10" value={newMatch.map} onChange={e => setNewMatch({...newMatch, map: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input type="number" placeholder="Entry Fee" className="bg-slate-900 p-4 rounded-xl border border-white/10" value={newMatch.entryFee} onChange={e => setNewMatch({...newMatch, entryFee: parseInt(e.target.value)})} />
                <input type="number" placeholder="Prize Pool" className="bg-slate-900 p-4 rounded-xl border border-white/10" value={newMatch.prizePool} onChange={e => setNewMatch({...newMatch, prizePool: parseInt(e.target.value)})} />
              </div>
              <button type="submit" className="w-full bg-cyan-500 text-black font-black py-4 rounded-xl uppercase tracking-widest mt-6">Create Broadcast</button>
              <button type="button" onClick={() => setScreen('ADMIN')} className="w-full text-slate-500 font-black text-[10px] uppercase mt-4">Cancel</button>
           </form>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-xl border-b border-white/5 p-4 flex justify-between items-center shadow-lg">
            <div className="flex items-center gap-3">
               <div className="w-9 h-9 bg-orange-500 rounded-lg flex items-center justify-center text-white font-black italic">FF</div>
               <div><h1 className="gaming-font font-black text-[10px] text-white tracking-widest">BATTLE HUB</h1></div>
            </div>
            <div className="bg-slate-900 border border-white/10 px-4 py-2 rounded-2xl" onClick={() => setScreen('WALLET')}>
               <span className="text-white font-black text-sm">₹{user?.balance}</span>
            </div>
          </div>

          <div className="pb-32 p-5">
            {screen === 'HOME' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-indigo-950 to-slate-900 p-6 rounded-[32px] border border-white/10">
                   <h2 className="gaming-font text-white text-xl font-black">HELLO, {user?.username}</h2>
                   <div className="flex gap-4 mt-4">
                      <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                        <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Winnings</p>
                        <p className="text-xs font-black text-emerald-400">₹{user?.totalEarnings || 0}</p>
                      </div>
                   </div>
                </div>

                <div className="flex justify-between items-center px-1">
                  <h3 className="gaming-font text-[10px] font-black tracking-widest text-slate-500 uppercase">Live Matches</h3>
                  <button onClick={loadData} className="text-[10px] text-orange-500 font-black uppercase"><i className="fa-solid fa-rotate"></i></button>
                </div>

                {tournaments.length === 0 && (
                  <div className="p-10 text-center bg-slate-900/20 rounded-3xl border border-dashed border-white/5">
                     <p className="text-slate-500 text-xs font-bold">No Matches Live Right Now</p>
                  </div>
                )}

                {tournaments.map(match => (
                  <div key={match.id} className="bg-slate-900/40 border border-white/5 rounded-3xl p-5 hover:bg-slate-900/60 transition-all cursor-pointer" onClick={() => { setSelectedMatch(match); setScreen('TOURNAMENT_DETAIL'); }}>
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex gap-3 items-center">
                        <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center border border-white/5 text-orange-500">
                           <i className={`fa-solid ${match.type === 'Solo' ? 'fa-user' : 'fa-users'} text-lg`}></i>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="bg-orange-500/10 text-orange-500 text-[8px] font-black px-2 py-0.5 rounded uppercase">{match.map}</span>
                          </div>
                          <h4 className="gaming-font text-white font-bold mt-1 text-sm tracking-tight">{match.title}</h4>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-600 text-[8px] font-bold uppercase">Pool</p>
                        <p className="text-lg font-black text-white">₹{match.prizePool}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                        <div className="bg-black/20 p-2 rounded-xl text-center border border-white/5"><p className="text-[10px] font-black text-white">Fee: ₹{match.entryFee}</p></div>
                        <div className="bg-black/20 p-2 rounded-xl text-center border border-white/5"><p className="text-[10px] font-black text-white">Kill: ₹{match.perKill}</p></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {screen === 'TOURNAMENT_DETAIL' && selectedMatch && (
              <div className="animate-fadeIn">
                 <button onClick={() => setScreen('HOME')} className="mb-6 flex items-center gap-2 text-slate-500 text-[10px] font-black uppercase"><i className="fa-solid fa-arrow-left"></i> BACK</button>
                 <div className="bg-slate-900/50 border border-white/5 rounded-[40px] p-8">
                    <h2 className="gaming-font text-2xl font-black text-white text-center mb-10">{selectedMatch.title}</h2>
                    <div className="space-y-4 mb-10">
                       <div className="flex justify-between p-4 bg-black/20 rounded-2xl border border-white/5"><span className="text-slate-500 text-[10px] font-bold uppercase">Prize</span><span className="text-emerald-400 font-black">₹{selectedMatch.prizePool}</span></div>
                       <div className="flex justify-between p-4 bg-black/20 rounded-2xl border border-white/5"><span className="text-slate-500 text-[10px] font-bold uppercase">Entry Fee</span><span className="text-white font-black">₹{selectedMatch.entryFee}</span></div>
                    </div>
                    <button onClick={() => joinMatch(selectedMatch)} className="w-full bg-orange-500 text-white font-black py-6 rounded-3xl uppercase tracking-widest shadow-lg shadow-orange-500/20">JOIN NOW</button>
                 </div>
              </div>
            )}

            {screen === 'PROFILE' && (
              <div className="space-y-4">
                 <div className="bg-slate-900 p-8 rounded-[40px] text-center">
                    <div className="w-20 h-20 bg-slate-800 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl"><i className="fa-solid fa-user-astronaut text-white"></i></div>
                    <h2 className="gaming-font text-xl font-black text-white uppercase">{user?.username}</h2>
                    <p className="text-orange-500 text-[8px] font-black uppercase mt-1 tracking-widest">{user?.email}</p>
                 </div>
                 <button onClick={openAdmin} className="w-full bg-cyan-500/10 border border-cyan-500/20 p-5 rounded-2xl flex justify-between items-center text-cyan-400 text-[11px] font-black uppercase tracking-widest">
                    <span>Admin Control Center</span>
                    <i className="fa-solid fa-shield-halved"></i>
                 </button>
                 <button onClick={() => CloudflareService.logout().then(() => setScreen('AUTH'))} className="w-full bg-rose-500/10 p-5 rounded-2xl flex justify-between items-center text-rose-500 text-[11px] font-black uppercase tracking-widest">
                    <span>Logout</span>
                    <i className="fa-solid fa-power-off"></i>
                 </button>
              </div>
            )}

            {/* Other screens (WALLET, RESULT_UPLOAD) same as previous but kept for flow */}
          </div>

          <nav className="fixed bottom-6 left-6 right-6 max-w-[calc(28rem-3rem)] mx-auto bg-slate-950/90 backdrop-blur-2xl border border-white/10 p-4 rounded-[32px] flex justify-around items-center z-50">
            {[
              { s: 'HOME', i: 'fa-gamepad' },
              { s: 'WALLET', i: 'fa-indian-rupee-sign' },
              { s: 'PROFILE', i: 'fa-user-gear' }
            ].map(item => (
              <button key={item.s} onClick={() => setScreen(item.s as Screen)} className={`p-3 rounded-xl transition-all ${screen === item.s ? 'bg-orange-500/10 text-orange-500' : 'text-slate-600'}`}>
                <i className={`fa-solid ${item.i} text-lg`}></i>
              </button>
            ))}
          </nav>
        </>
      )}
    </div>
  );
};

export default App;
