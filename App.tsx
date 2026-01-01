
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
      if (currentUser.role === 'admin') {
         // If admin was logged in, we can decide where to send them
         // but for safety, we send them to HOME first
      }
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
          if (loggedUser.role !== 'admin') {
            throw new Error("Unauthorized: You are not an administrator.");
          }
          setUser(loggedUser);
          openAdmin();
        } else {
          setUser(loggedUser);
          setScreen('HOME');
        }
      }
      loadData();
    } catch (err: any) {
      setAuthError(err.message || "Authentication Failed");
    } finally {
      setLoading(false);
    }
  };

  // Add joinMatch function to handle tournament participation and fee deduction
  const joinMatch = async (match: Tournament) => {
    if (!user) return;
    if (user.balance < match.entryFee) {
      alert("Insufficient balance! Please recharge your vault.");
      setScreen('WALLET');
      return;
    }

    if (!confirm(`Join ${match.title} for ₹${match.entryFee}?`)) return;

    setLoading(true);
    try {
      const newBalance = user.balance - match.entryFee;
      const success = await CloudflareService.updateBalance(user.uid, newBalance);
      if (success) {
        // Update local state to reflect balance change immediately
        setUser({ ...user, balance: newBalance });
        alert("Successfully joined the tournament! Room ID and Password will be shared on your registered email 15 mins before start.");
        setScreen('HOME');
      } else {
        alert("Failed to join match. Please try again.");
      }
    } catch (e) {
      alert("An error occurred while joining the match.");
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
      alert("Failed to create tournament.");
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
    try {
      const users = await CloudflareService.adminGetAllUsers();
      setAdminUsers(users);
      setScreen('ADMIN');
    } catch (e) {
      alert("Could not load Admin data.");
      setScreen('HOME');
    } finally {
      setLoading(false);
    }
  };

  const addAdminBalance = async (uid: string, currentBalance: number) => {
    const amount = prompt("Enter amount to add (₹):");
    if (!amount || isNaN(parseFloat(amount))) return;
    const newBal = currentBalance + parseFloat(amount);
    setLoading(true);
    await CloudflareService.updateBalance(uid, newBal);
    const users = await CloudflareService.adminGetAllUsers();
    setAdminUsers(users);
    setLoading(false);
  };

  const renderAdminLogin = () => (
    <div className="min-h-screen bg-slate-950 p-8 flex flex-col justify-center animate-fadeIn">
      <div className="text-center mb-10">
        <div className="w-20 h-20 bg-cyan-500 rounded-2xl mx-auto flex items-center justify-center text-black text-4xl mb-4 shadow-[0_0_30px_rgba(6,182,212,0.3)]">
          <i className="fa-solid fa-shield-halved"></i>
        </div>
        <h2 className="gaming-font text-2xl font-black text-white uppercase tracking-widest">Admin Portal</h2>
        <p className="text-cyan-500 text-[10px] font-bold uppercase mt-2">Secure Management Access Only</p>
      </div>

      <form onSubmit={(e) => handleAuthAction(e, true)} className="space-y-4 max-w-sm mx-auto w-full">
        <input 
          type="email" placeholder="Admin Email" required
          className="w-full bg-slate-900 border border-cyan-500/20 rounded-2xl py-4 px-6 text-white outline-none focus:border-cyan-500"
          value={formData.email}
          onChange={e => setFormData({...formData, email: e.target.value})}
        />
        <input 
          type="password" placeholder="Secure Password" required
          className="w-full bg-slate-900 border border-cyan-500/20 rounded-2xl py-4 px-6 text-white outline-none focus:border-cyan-500"
          value={formData.password}
          onChange={e => setFormData({...formData, password: e.target.value})}
        />
        {authError && <p className="text-rose-500 text-[10px] text-center font-bold bg-rose-500/10 p-3 rounded-xl">{authError}</p>}
        <button type="submit" className="w-full bg-cyan-500 text-black font-black py-4 rounded-2xl uppercase tracking-widest hover:scale-105 transition-all">
          Authorize Access
        </button>
      </form>
      <button onClick={() => { setScreen('AUTH'); setAuthError(''); }} className="mt-8 text-slate-500 text-[10px] font-bold uppercase text-center">Back to Player App</button>
    </div>
  );

  const renderAdmin = () => (
    <div className="p-6 space-y-8 animate-fadeIn pb-32">
       <div className="flex justify-between items-center">
          <h2 className="gaming-font text-xl font-black text-cyan-400 tracking-tighter">CONTROL CENTER</h2>
          <button onClick={() => setScreen('HOME')} className="bg-slate-800 px-4 py-2 rounded-xl text-[8px] font-black uppercase text-white border border-white/5">Exit Console</button>
       </div>

       <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-900/80 p-5 rounded-3xl border border-cyan-500/20">
             <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Users</p>
             <p className="text-2xl font-black text-white">{adminUsers.length}</p>
          </div>
          <div className="bg-slate-900/80 p-5 rounded-3xl border border-cyan-500/20">
             <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Tournaments</p>
             <p className="text-2xl font-black text-white">{tournaments.length}</p>
          </div>
       </div>

       <div className="bg-slate-900/40 p-6 rounded-[32px] border border-white/5">
          <div className="flex justify-between items-center mb-6">
             <h3 className="gaming-font text-[10px] font-black text-white uppercase tracking-widest">Live Matches</h3>
             <button onClick={() => setScreen('ADMIN_MATCHES')} className="bg-cyan-500 text-black px-3 py-1.5 rounded-lg text-[9px] font-black uppercase shadow-lg shadow-cyan-500/20">Add New</button>
          </div>
          <div className="space-y-3">
             {tournaments.map(t => (
               <div key={t.id} className="flex justify-between items-center p-4 bg-black/40 rounded-2xl border border-white/5">
                  <div>
                    <p className="text-white font-black text-xs">{t.title}</p>
                    <p className="text-slate-500 text-[8px] uppercase tracking-tighter">₹{t.entryFee} • {t.map} • {t.type}</p>
                  </div>
                  <button onClick={() => deleteMatch(t.id)} className="text-rose-500/50 hover:text-rose-500 transition-colors"><i className="fa-solid fa-trash-can"></i></button>
               </div>
             ))}
          </div>
       </div>

       <div className="bg-slate-900/40 p-6 rounded-[32px] border border-white/5">
          <h3 className="gaming-font text-[10px] font-black text-white uppercase tracking-widest mb-6">User Database</h3>
          <div className="space-y-4">
             {adminUsers.map(u => (
               <div key={u.uid} className="flex justify-between items-center p-4 bg-black/20 rounded-2xl border border-white/5">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-white font-black text-xs">{u.username}</p>
                      {u.role === 'admin' && <span className="text-[7px] bg-cyan-500/20 text-cyan-400 px-1.5 rounded-full font-black uppercase">Staff</span>}
                    </div>
                    <p className="text-emerald-400 text-[9px] font-black">₹{u.balance}</p>
                  </div>
                  <button onClick={() => addAdminBalance(u.uid, u.balance)} className="bg-slate-800 p-2 rounded-lg text-emerald-500 text-[8px] font-black uppercase border border-emerald-500/20">Recharge</button>
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
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-orange-500 font-black text-[10px] tracking-[0.3em] uppercase">Processing Query...</p>
        </div>
      )}

      {screen === 'ADMIN_AUTH' ? (
        renderAdminLogin()
      ) : (screen === 'AUTH' || screen === 'SIGNUP') ? (
        <div className="min-h-screen bg-[#020617] p-8 flex flex-col justify-center animate-fadeIn">
          <div className="text-center mb-10">
            <div className="w-24 h-24 bg-gradient-to-tr from-orange-600 to-orange-400 rounded-3xl mx-auto flex items-center justify-center text-white text-5xl font-black mb-6 border-4 border-white/10 shadow-[0_0_50px_rgba(249,115,22,0.2)]">FF</div>
            <h1 className="gaming-font text-3xl font-black text-white tracking-tighter">BATTLE HUB</h1>
            <p className="text-slate-600 text-[9px] font-bold uppercase tracking-[0.4em] mt-2">D1 Cloud Database</p>
          </div>
          <form onSubmit={(e) => handleAuthAction(e)} className="space-y-4">
            {screen === 'SIGNUP' && (
              <input type="text" placeholder="Gamer ID Name" required className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 px-6 text-white outline-none focus:border-orange-500" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
            )}
            <input type="email" placeholder="Email Address" required className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 px-6 text-white outline-none focus:border-orange-500" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            <input type="password" placeholder="Secret Password" required className="w-full bg-slate-900 border border-white/10 rounded-2xl py-4 px-6 text-white outline-none focus:border-orange-500" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            {authError && <p className="text-rose-500 text-[10px] text-center font-bold bg-rose-500/5 p-3 rounded-xl border border-rose-500/10">{authError}</p>}
            <button type="submit" className="w-full bg-orange-500 text-white font-black py-4 rounded-2xl uppercase tracking-widest border-b-4 border-orange-700 active:scale-95 transition-all">
              {screen === 'AUTH' ? 'ENTER LOBBY' : 'JOIN THE TEAM'}
            </button>
          </form>
          <button onClick={() => { setScreen(screen === 'AUTH' ? 'SIGNUP' : 'AUTH'); setAuthError(''); }} className="mt-8 text-slate-500 text-[10px] font-black uppercase text-center w-full">
            {screen === 'AUTH' ? "Need an account? " : "Already a member? "} <span className="text-orange-500 underline">Switch</span>
          </button>

          {/* Secret Portal Link at Bottom */}
          <button onClick={() => { setScreen('ADMIN_AUTH'); setAuthError(''); }} className="mt-16 text-slate-800 text-[8px] font-black uppercase hover:text-cyan-900 transition-colors">Admin Portal Access</button>
        </div>
      ) : screen === 'ADMIN' ? (
        renderAdmin()
      ) : screen === 'ADMIN_MATCHES' ? (
        <div className="p-8 animate-fadeIn pb-20">
           <button onClick={() => setScreen('ADMIN')} className="mb-6 flex items-center gap-2 text-slate-500 text-[10px] font-black uppercase"><i className="fa-solid fa-arrow-left"></i> Back to Console</button>
           <h2 className="gaming-font text-2xl font-black text-cyan-400 mb-8">CREATE MATCH</h2>
           <form onSubmit={createMatch} className="space-y-4">
              <input type="text" placeholder="Tournament Name" required className="w-full bg-slate-900 p-4 rounded-xl border border-white/10 text-sm" value={newMatch.title} onChange={e => setNewMatch({...newMatch, title: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <select className="bg-slate-900 p-4 rounded-xl border border-white/10 text-xs text-slate-400" value={newMatch.type} onChange={e => setNewMatch({...newMatch, type: e.target.value})}>
                   <option>Solo</option><option>Duo</option><option>Squad</option>
                </select>
                <input type="text" placeholder="Map Name" className="bg-slate-900 p-4 rounded-xl border border-white/10 text-sm" value={newMatch.map} onChange={e => setNewMatch({...newMatch, map: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                   <p className="text-[8px] font-black text-slate-500 uppercase ml-2">Entry Fee (₹)</p>
                   <input type="number" className="bg-slate-900 p-4 rounded-xl border border-white/10 w-full text-sm" value={newMatch.entryFee} onChange={e => setNewMatch({...newMatch, entryFee: parseInt(e.target.value)})} />
                </div>
                <div className="space-y-1">
                   <p className="text-[8px] font-black text-slate-500 uppercase ml-2">Prize Pool (₹)</p>
                   <input type="number" className="bg-slate-900 p-4 rounded-xl border border-white/10 w-full text-sm" value={newMatch.prizePool} onChange={e => setNewMatch({...newMatch, prizePool: parseInt(e.target.value)})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                   <p className="text-[8px] font-black text-slate-500 uppercase ml-2">Per Kill (₹)</p>
                   <input type="number" className="bg-slate-900 p-4 rounded-xl border border-white/10 w-full text-sm" value={newMatch.perKill} onChange={e => setNewMatch({...newMatch, perKill: parseInt(e.target.value)})} />
                </div>
                <div className="space-y-1">
                   <p className="text-[8px] font-black text-slate-500 uppercase ml-2">Start Time</p>
                   <input type="text" placeholder="e.g. 09:00 PM" className="bg-slate-900 p-4 rounded-xl border border-white/10 w-full text-sm" value={newMatch.startTime} onChange={e => setNewMatch({...newMatch, startTime: e.target.value})} />
                </div>
              </div>
              <button type="submit" className="w-full bg-cyan-500 text-black font-black py-4 rounded-xl uppercase tracking-widest mt-6 shadow-xl shadow-cyan-500/20 active:scale-95 transition-all">Broadcast Match</button>
           </form>
        </div>
      ) : (
        <>
          {/* Header */}
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
                <div className="bg-gradient-to-br from-indigo-950 to-slate-900 p-6 rounded-[32px] border border-white/10 relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 blur-3xl rounded-full"></div>
                   <h2 className="gaming-font text-white text-lg font-black uppercase tracking-tight">PLAYER: {user?.username}</h2>
                   <div className="flex gap-4 mt-4">
                      <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                        <p className="text-[7px] text-slate-500 font-black uppercase tracking-widest">Earnings</p>
                        <p className="text-xs font-black text-emerald-400">₹{user?.totalEarnings || 0}</p>
                      </div>
                      {user?.role === 'admin' && (
                        <button onClick={openAdmin} className="bg-cyan-500/20 text-cyan-400 px-4 py-2 rounded-xl border border-cyan-500/20 text-[7px] font-black uppercase tracking-widest flex items-center gap-2">
                          <i className="fa-solid fa-lock-open"></i> Admin Panel
                        </button>
                      )}
                   </div>
                </div>

                <div className="flex justify-between items-center px-1">
                  <h3 className="gaming-font text-[9px] font-black tracking-widest text-slate-500 uppercase">Live Tournaments</h3>
                  <button onClick={loadData} className="text-[10px] text-orange-500 font-black px-2 py-1"><i className="fa-solid fa-rotate-right"></i></button>
                </div>

                {tournaments.length === 0 && (
                  <div className="p-10 text-center bg-slate-900/20 rounded-3xl border border-dashed border-white/5">
                     <i className="fa-solid fa-ghost text-slate-700 text-3xl mb-4"></i>
                     <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest">No Matches Live</p>
                  </div>
                )}

                {tournaments.map(match => (
                  <div key={match.id} className="bg-slate-900/40 border border-white/5 rounded-3xl p-5 hover:bg-slate-900/60 transition-all cursor-pointer group" onClick={() => { setSelectedMatch(match); setScreen('TOURNAMENT_DETAIL'); }}>
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex gap-3 items-center">
                        <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center border border-white/5 text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-all">
                           <i className={`fa-solid ${match.type === 'Solo' ? 'fa-user' : 'fa-users'}`}></i>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="bg-orange-500/10 text-orange-500 text-[7px] font-black px-1.5 py-0.5 rounded uppercase">{match.map}</span>
                            <span className="text-slate-500 text-[8px] font-bold uppercase">{match.startTime}</span>
                          </div>
                          <h4 className="gaming-font text-white font-bold mt-1 text-sm tracking-tighter uppercase">{match.title}</h4>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-600 text-[7px] font-bold uppercase">Pool</p>
                        <p className="text-base font-black text-white italic">₹{match.prizePool}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                        <div className="bg-black/20 p-2 rounded-xl text-center border border-white/5 flex justify-between px-4"><span className="text-[7px] text-slate-500 font-black uppercase">Fee</span><span className="text-[10px] font-black text-white">₹{match.entryFee}</span></div>
                        <div className="bg-black/20 p-2 rounded-xl text-center border border-white/5 flex justify-between px-4"><span className="text-[7px] text-slate-500 font-black uppercase">Kill</span><span className="text-[10px] font-black text-white">₹{match.perKill}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {screen === 'TOURNAMENT_DETAIL' && selectedMatch && (
              <div className="animate-fadeIn">
                 <button onClick={() => setScreen('HOME')} className="mb-6 flex items-center gap-2 text-slate-500 text-[10px] font-black uppercase"><i className="fa-solid fa-arrow-left"></i> BACK TO LOBBY</button>
                 <div className="bg-slate-900/50 border border-white/5 rounded-[40px] p-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-orange-500"></div>
                    <h2 className="gaming-font text-xl font-black text-white text-center mb-10 tracking-tight uppercase">{selectedMatch.title}</h2>
                    <div className="space-y-4 mb-10">
                       <div className="flex justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
                         <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Grand Prize</span>
                         <span className="text-emerald-400 font-black text-xl italic">₹{selectedMatch.prizePool}</span>
                       </div>
                       <div className="flex justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
                         <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Entry Fee</span>
                         <span className="text-white font-black text-xl">₹{selectedMatch.entryFee}</span>
                       </div>
                    </div>
                    <button onClick={() => joinMatch(selectedMatch)} className="w-full bg-orange-500 text-white font-black py-5 rounded-3xl uppercase tracking-[0.2em] text-sm shadow-xl shadow-orange-500/20 border-b-4 border-orange-700 active:translate-y-1 transition-all">JOIN BATTLE</button>
                 </div>
              </div>
            )}

            {screen === 'PROFILE' && (
              <div className="space-y-4 animate-fadeIn">
                 <div className="bg-slate-900 p-8 rounded-[40px] text-center border border-white/5 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-orange-500"></div>
                    <div className="w-20 h-20 bg-slate-800 rounded-3xl mx-auto mb-4 flex items-center justify-center text-4xl shadow-xl border border-white/5">
                      <i className="fa-solid fa-user-ninja text-white"></i>
                    </div>
                    <h2 className="gaming-font text-xl font-black text-white uppercase tracking-tight">{user?.username}</h2>
                    <p className="text-orange-500 text-[8px] font-black uppercase mt-1 tracking-[0.3em]">{user?.email}</p>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-900/50 p-5 rounded-2xl border border-white/5 text-center">
                       <p className="text-2xl font-black text-white italic">{user?.matchesPlayed || 0}</p>
                       <p className="text-[7px] text-slate-500 uppercase font-black tracking-widest">Matches</p>
                    </div>
                    <div className="bg-slate-900/50 p-5 rounded-2xl border border-white/5 text-center">
                       <p className="text-2xl font-black text-emerald-400 italic">₹{user?.totalEarnings || 0}</p>
                       <p className="text-[7px] text-slate-500 uppercase font-black tracking-widest">Earnings</p>
                    </div>
                 </div>

                 <button onClick={() => CloudflareService.logout().then(() => setScreen('AUTH'))} className="w-full bg-rose-500/5 p-5 rounded-2xl flex justify-between items-center text-rose-500 text-[10px] font-black uppercase tracking-widest border border-rose-500/10 hover:bg-rose-500/10 transition-colors">
                    <span>Close Session</span>
                    <i className="fa-solid fa-power-off"></i>
                 </button>
              </div>
            )}

            {screen === 'WALLET' && (
              <div className="space-y-6 animate-fadeIn">
                 <div className="bg-slate-950 p-10 rounded-[40px] border border-white/5 text-center shadow-2xl">
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4">Vault Balance</p>
                    <h3 className="text-6xl font-black text-white mb-10 italic">₹{user?.balance}<span className="text-orange-500 text-sm">.00</span></h3>
                    <div className="grid grid-cols-2 gap-3">
                       <button className="bg-orange-500 text-white font-black py-4 rounded-xl text-[10px] uppercase tracking-widest border-b-4 border-orange-700">Recharge</button>
                       <button className="bg-slate-900 text-white font-black py-4 rounded-xl text-[10px] uppercase tracking-widest border border-white/10">Withdraw</button>
                    </div>
                 </div>
              </div>
            )}

            {screen === 'RESULT_UPLOAD' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="bg-slate-950 border-2 border-dashed border-slate-800 rounded-[40px] p-12 text-center group hover:border-orange-500/30 transition-all relative">
                   <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" accept="image/*" onChange={(e) => e.target.files?.[0] && (async () => {
                      setIsVerifying(true);
                      setAiResult(null);
                      const file = e.target.files![0];
                      const reader = new FileReader();
                      reader.readAsDataURL(file);
                      reader.onload = async () => {
                        try {
                          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                          const base64Data = (reader.result as string).split(',')[1];
                          const response = await ai.models.generateContent({
                            model: 'gemini-3-flash-preview',
                            contents: { parts: [{ inlineData: { data: base64Data, mimeType: file.type } }, { text: "Verify Free Fire result screenshot. Get Player Name and Kills." }] }
                          });
                          setAiResult(response.text || "Scan failed.");
                        } catch (e) { setAiResult("AI offline."); } finally { setIsVerifying(false); }
                      };
                   })()} />
                   <i className="fa-solid fa-camera-retro text-4xl text-orange-500/20 mb-4 group-hover:text-orange-500 transition-colors"></i>
                   <p className="font-black text-[11px] uppercase tracking-widest text-white">Upload Game Screenshot</p>
                   <p className="text-[8px] text-slate-600 mt-2 font-black uppercase">AI will auto-verify kills</p>
                </div>
                {isVerifying && <div className="text-center text-orange-500 animate-pulse font-black text-[9px] uppercase">AI Analyzing...</div>}
                {aiResult && <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5 font-mono text-[10px] text-slate-400 whitespace-pre-wrap">{aiResult}</div>}
              </div>
            )}
          </div>

          <nav className="fixed bottom-6 left-6 right-6 max-w-[calc(28rem-3rem)] mx-auto bg-slate-950/90 backdrop-blur-2xl border border-white/10 p-4 rounded-[32px] flex justify-around items-center shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50">
            {[
              { s: 'HOME', i: 'fa-gamepad' },
              { s: 'WALLET', i: 'fa-indian-rupee-sign' },
              { s: 'RESULT_UPLOAD', i: 'fa-brain' },
              { s: 'PROFILE', i: 'fa-user' }
            ].map(item => (
              <button key={item.s} onClick={() => setScreen(item.s as Screen)} className={`p-3 rounded-xl transition-all ${screen === item.s ? 'bg-orange-500/10 text-orange-500 scale-110 shadow-lg shadow-orange-500/5' : 'text-slate-600 hover:text-slate-400'}`}>
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
