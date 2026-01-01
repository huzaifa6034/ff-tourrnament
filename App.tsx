
import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Screen, Tournament, User } from './types';
import { CloudflareService } from './services/cloudflare';

const App: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('AUTH');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
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
            const session = CloudflareService.getCurrentUser();
            if (session) {
              session.balance = latestBalance;
              localStorage.setItem('bh_session', JSON.stringify(session));
            }
          }
        } catch (e) {}
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [user?.uid, screen]);

  useEffect(() => {
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
          if (loggedUser.role !== 'admin') {
            throw new Error("Unauthorized: Admin access required.");
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

  const handleRecharge = async () => {
    if (!user) return;
    const amount = prompt("Enter amount to recharge (₹):");
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) return;
    
    setLoading(true);
    try {
      const rechargeVal = parseFloat(amount);
      const newBalance = user.balance + rechargeVal;
      const success = await CloudflareService.updateBalance(user.uid, newBalance);
      if (success) {
        setUser({ ...user, balance: newBalance });
        alert(`Success! ₹${rechargeVal} added.`);
      } else {
        alert("Failed.");
      }
    } catch (e) {
      alert("Error.");
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!user) return;
    const amount = prompt("Enter amount to withdraw (₹):");
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) return;
    
    const withdrawVal = parseFloat(amount);
    if (withdrawVal > user.balance) {
      alert("Insufficient balance!");
      return;
    }

    setLoading(true);
    try {
      const newBalance = user.balance - withdrawVal;
      const success = await CloudflareService.updateBalance(user.uid, newBalance);
      if (success) {
        setUser({ ...user, balance: newBalance });
        alert(`Withdrawal processed!`);
      } else {
        alert("Failed.");
      }
    } catch (e) {
      alert("Error.");
    } finally {
      setLoading(false);
    }
  };

  const joinMatch = async (match: Tournament) => {
    if (!user) return;
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
        const newBalance = user.balance - match.entryFee;
        setUser({ ...user, balance: newBalance });
        alert("Joined successfully! Good luck Warrior.");
        setScreen('HOME');
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
      alert("Access Denied.");
      setScreen('HOME');
    } finally {
      setLoading(false);
    }
  };

  const addAdminBalance = async (uid: string, currentBalance: number) => {
    const amount = prompt("Amount to add (₹):");
    if (!amount || isNaN(parseFloat(amount))) return;
    const newBal = currentBalance + parseFloat(amount);
    setLoading(true);
    await CloudflareService.updateBalance(uid, newBal);
    const users = await CloudflareService.adminGetAllUsers();
    setAdminUsers(users);
    setLoading(false);
  };

  const editUserStats = async (targetUser: User) => {
    const earnings = prompt("Edit Total Earnings (₹):", targetUser.totalEarnings.toString());
    const matches = prompt("Edit Matches Played:", targetUser.matchesPlayed.toString());
    
    if (earnings === null || matches === null) return;

    setLoading(true);
    try {
      const success = await CloudflareService.adminUpdateUser(targetUser.uid, {
        totalEarnings: parseFloat(earnings),
        matchesPlayed: parseInt(matches)
      });
      if (success) {
        const users = await CloudflareService.adminGetAllUsers();
        setAdminUsers(users);
        alert("Stats Updated!");
      }
    } catch (e) { alert("Error."); } finally { setLoading(false); }
  };

  const toggleUserRole = async (targetUser: User) => {
    const newRole = targetUser.role === 'admin' ? 'player' : 'admin';
    if (!confirm(`Change ${targetUser.username}'s role to ${newRole}?`)) return;
    
    setLoading(true);
    try {
      const success = await CloudflareService.adminUpdateUser(targetUser.uid, { role: newRole as any });
      if (success) {
        const users = await CloudflareService.adminGetAllUsers();
        setAdminUsers(users);
        alert("Role Updated!");
      }
    } catch (e) { alert("Error."); } finally { setLoading(false); }
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
            {authError && <p className="text-rose-500 text-[10px] text-center font-bold">{authError}</p>}
            <button type="submit" className="w-full bg-cyan-500 text-black font-black py-4 rounded-2xl uppercase tracking-widest hover:scale-105 transition-all">Enter Console</button>
          </form>
          <button onClick={() => setScreen('AUTH')} className="mt-8 text-slate-500 text-[10px] font-bold uppercase text-center w-full underline">Back to Lobby</button>
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
              <h3 className="gaming-font text-[10px] font-black text-white uppercase tracking-widest mb-6">User Database ({adminUsers.length})</h3>
              <div className="space-y-4">
                 {adminUsers.map(u => (
                   <div key={u.uid} className="p-4 bg-black/40 rounded-3xl border border-white/5 space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                             <p className="text-white font-black text-xs">{u.username}</p>
                             <span className={`text-[7px] px-1.5 rounded-full font-black uppercase ${u.role === 'admin' ? 'bg-cyan-500 text-black' : 'bg-slate-700 text-slate-400'}`}>{u.role}</span>
                          </div>
                          <p className="text-slate-500 text-[8px] tracking-tight">{u.email}</p>
                        </div>
                        <p className="text-emerald-400 text-sm font-black italic">₹{u.balance}</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 bg-black/20 p-3 rounded-2xl border border-white/5">
                         <div className="text-center border-r border-white/5">
                            <p className="text-[7px] text-slate-500 font-black uppercase">Matches</p>
                            <p className="text-xs text-white font-black italic">{u.matchesPlayed}</p>
                         </div>
                         <div className="text-center">
                            <p className="text-[7px] text-slate-500 font-black uppercase">Total Won</p>
                            <p className="text-xs text-orange-500 font-black italic">₹{u.totalEarnings}</p>
                         </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => addAdminBalance(u.uid, u.balance)} className="flex-1 min-w-[80px] bg-emerald-500/10 p-2.5 rounded-xl text-emerald-500 text-[8px] font-black uppercase border border-emerald-500/20 active:scale-95 transition-all">Recharge</button>
                        <button onClick={() => editUserStats(u)} className="flex-1 min-w-[80px] bg-orange-500/10 p-2.5 rounded-xl text-orange-500 text-[8px] font-black uppercase border border-orange-500/20 active:scale-95 transition-all">Edit Stats</button>
                        <button onClick={() => toggleUserRole(u)} className="flex-1 min-w-[80px] bg-cyan-500/10 p-2.5 rounded-xl text-cyan-500 text-[8px] font-black uppercase border border-cyan-500/20 active:scale-95 transition-all">Change Role</button>
                      </div>
                   </div>
                 ))}
              </div>
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
                        <p className="text-slate-500 text-[8px] uppercase tracking-tighter">₹{t.entryFee} • {t.startTime}</p>
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
                <div className="bg-gradient-to-br from-indigo-950/80 to-slate-900 p-8 rounded-[40px] border border-white/10 relative overflow-hidden shadow-2xl">
                   <div className="absolute -top-10 -left-10 w-40 h-40 bg-orange-500/5 blur-3xl rounded-full"></div>
                   <h2 className="gaming-font text-white text-lg font-black uppercase tracking-tight">GAMER: {user?.username}</h2>
                   <div className="flex gap-4 mt-6">
                      <div className="bg-white/5 px-5 py-3 rounded-2xl border border-white/5">
                        <p className="text-[7px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1">Total Earned</p>
                        <p className="text-lg font-black text-emerald-400 italic">₹{user?.totalEarnings || 0}</p>
                      </div>
                      <div className="bg-white/5 px-5 py-3 rounded-2xl border border-white/5">
                        <p className="text-[7px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1">Matches</p>
                        <p className="text-lg font-black text-white italic">{user?.matchesPlayed || 0}</p>
                      </div>
                   </div>
                   {user?.role === 'admin' && (
                     <button onClick={openAdmin} className="mt-6 w-full bg-cyan-500/10 text-cyan-400 py-3 rounded-2xl border border-cyan-500/20 text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-cyan-500/20 transition-all">
                       <i className="fa-solid fa-screwdriver-wrench"></i> OPEN ADMIN DASHBOARD
                     </button>
                   )}
                </div>

                <div className="flex justify-between items-center px-2">
                  <h3 className="gaming-font text-[10px] font-black tracking-widest text-slate-500 uppercase">Live Tournaments</h3>
                  <button onClick={loadData} className="text-orange-500 hover:rotate-180 transition-transform duration-500"><i className="fa-solid fa-rotate-right"></i></button>
                </div>

                {tournaments.length === 0 ? (
                  <div className="bg-slate-900/40 p-12 rounded-[40px] border border-white/5 text-center">
                    <i className="fa-solid fa-ghost text-slate-800 text-4xl mb-4"></i>
                    <p className="text-slate-600 font-black text-[10px] uppercase tracking-widest">No Matches Scheduled</p>
                  </div>
                ) : (
                  tournaments.map(match => (
                    <div key={match.id} className="bg-slate-900/40 border border-white/5 rounded-[40px] p-6 hover:bg-slate-900/60 transition-all cursor-pointer group" onClick={() => joinMatch(match)}>
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex gap-4 items-center">
                          <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center border border-white/5 text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-all shadow-lg">
                             <i className={`fa-solid ${match.type === 'Solo' ? 'fa-user' : 'fa-users'} text-xl`}></i>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="bg-orange-500 text-white text-[8px] font-black px-2 py-0.5 rounded-lg uppercase tracking-widest">{match.map}</span>
                              <span className="text-slate-500 text-[10px] font-black italic">{match.startTime}</span>
                            </div>
                            <h4 className="gaming-font text-white font-black text-sm uppercase tracking-tight">{match.title}</h4>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-slate-500 text-[8px] font-black uppercase tracking-widest">Prize Pool</p>
                          <p className="text-xl font-black text-emerald-400 italic">₹{match.prizePool}</p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center pt-4 border-t border-white/5">
                        <div className="flex gap-4">
                           <div>
                              <p className="text-[7px] text-slate-600 font-black uppercase">Entry</p>
                              <p className="text-xs text-white font-black italic">₹{match.entryFee}</p>
                           </div>
                           <div>
                              <p className="text-[7px] text-slate-600 font-black uppercase">Per Kill</p>
                              <p className="text-xs text-white font-black italic">₹{match.perKill}</p>
                           </div>
                        </div>
                        <button className="bg-orange-500/10 text-orange-500 text-[9px] font-black px-4 py-2 rounded-xl border border-orange-500/20 group-hover:bg-orange-500 group-hover:text-white transition-all">JOIN NOW</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {screen === 'LEADERBOARD' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="text-center mb-10">
                  <div className="inline-block p-4 bg-orange-500/10 rounded-3xl mb-4 border border-orange-500/20 shadow-[0_0_30px_rgba(249,115,22,0.15)]">
                    <i className="fa-solid fa-trophy text-orange-500 text-5xl drop-shadow-lg"></i>
                  </div>
                  <h2 className="gaming-font text-2xl font-black text-white uppercase tracking-tight">World Ranking</h2>
                  <p className="text-slate-500 text-[9px] font-bold uppercase tracking-[0.4em] mt-2">Elite Players Database</p>
                </div>

                <div className="bg-slate-900/40 border border-white/5 rounded-[40px] overflow-hidden shadow-2xl">
                  <div className="grid grid-cols-6 p-6 border-b border-white/5 bg-white/5 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <span className="col-span-1 text-center">Rank</span>
                    <span className="col-span-3">Warrior</span>
                    <span className="col-span-2 text-right">Earnings</span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {leaderboard.map((player, index) => (
                      <div key={player.username} className={`grid grid-cols-6 p-6 items-center transition-all ${player.username === user?.username ? 'bg-orange-500/10 border-l-4 border-orange-500' : ''}`}>
                        <div className="col-span-1 flex justify-center">
                          {index === 0 ? <i className="fa-solid fa-crown text-2xl text-yellow-400 drop-shadow-md"></i> : 
                           index === 1 ? <i className="fa-solid fa-medal text-xl text-slate-300"></i> :
                           index === 2 ? <i className="fa-solid fa-medal text-xl text-orange-800"></i> :
                           <span className="text-xs font-black text-slate-600">{index + 1}</span>}
                        </div>
                        <div className="col-span-3 pl-2">
                          <p className={`text-sm font-black uppercase tracking-tight ${player.username === user?.username ? 'text-orange-500' : 'text-white'}`}>{player.username}</p>
                          <p className="text-[9px] text-slate-600 font-bold uppercase italic">{player.matchesPlayed} Matches Played</p>
                        </div>
                        <div className="col-span-2 text-right">
                          <p className="text-emerald-400 font-black text-lg italic">₹{player.totalEarnings}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {screen === 'WALLET' && (
              <div className="space-y-6 animate-fadeIn">
                 <button onClick={() => setScreen('HOME')} className="flex items-center gap-2 text-slate-500 text-[10px] font-black uppercase tracking-widest mb-4 hover:text-white transition-all"><i className="fa-solid fa-arrow-left"></i> BACK TO HUB</button>
                 <div className="bg-slate-950 p-12 rounded-[50px] border border-white/5 text-center shadow-[0_30px_60px_rgba(0,0,0,0.5)] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-orange-500/5 blur-3xl rounded-full"></div>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] mb-6">Secured Vault</p>
                    <h3 className="text-7xl font-black text-white mb-12 italic tracking-tighter shadow-orange-500/20">₹{user?.balance}<span className="text-orange-500 text-xl font-bold italic">.00</span></h3>
                    <div className="grid grid-cols-2 gap-4">
                       <button onClick={handleRecharge} className="bg-orange-500 text-white font-black py-5 rounded-2xl text-[11px] uppercase tracking-widest border-b-4 border-orange-700 active:translate-y-1 transition-all shadow-xl shadow-orange-500/20">Deposit</button>
                       <button onClick={handleWithdraw} className="bg-slate-900 text-white font-black py-5 rounded-2xl text-[11px] uppercase tracking-widest border border-white/10 active:scale-95 transition-all">Withdraw</button>
                    </div>
                 </div>
              </div>
            )}

            {screen === 'PROFILE' && (
              <div className="space-y-6 animate-fadeIn">
                 <div className="bg-slate-900 p-10 rounded-[50px] text-center border border-white/5 relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-orange-500 to-rose-500"></div>
                    <div className="w-24 h-24 bg-slate-800 rounded-[35px] mx-auto mb-6 flex items-center justify-center text-5xl shadow-2xl border border-white/10 text-orange-500">
                      <i className="fa-solid fa-user-ninja"></i>
                    </div>
                    <h2 className="gaming-font text-2xl font-black text-white uppercase tracking-tighter">{user?.username}</h2>
                    <p className="text-slate-500 text-[10px] font-black uppercase mt-2 tracking-[0.3em] opacity-60 italic">{user?.email}</p>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-900/40 p-5 rounded-3xl border border-white/5">
                      <p className="text-[8px] text-slate-500 font-black uppercase mb-1">Status</p>
                      <p className="text-xs text-white font-black uppercase tracking-widest">{user?.role === 'admin' ? 'ELITE STAFF' : 'ACTIVE PLAYER'}</p>
                    </div>
                    <div className="bg-slate-900/40 p-5 rounded-3xl border border-white/5">
                      <p className="text-[8px] text-slate-500 font-black uppercase mb-1">Since</p>
                      <p className="text-xs text-white font-black uppercase tracking-widest">2024</p>
                    </div>
                 </div>

                 <button onClick={() => CloudflareService.logout().then(() => setScreen('AUTH'))} className="w-full bg-rose-500/10 p-6 rounded-3xl flex justify-between items-center text-rose-500 text-[11px] font-black uppercase tracking-widest border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all active:scale-95 group">
                    <span>TERMINATE SESSION</span>
                    <i className="fa-solid fa-power-off group-hover:rotate-12"></i>
                 </button>
              </div>
            )}

            {screen === 'RESULT_UPLOAD' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="text-center mb-8">
                  <h2 className="gaming-font text-2xl font-black text-white uppercase">AI SCANNER</h2>
                  <p className="text-slate-500 text-[9px] font-bold uppercase tracking-[0.3em] mt-2">Upload Screenshot to Verify Result</p>
                </div>
                <div className="bg-slate-950 border-4 border-dashed border-slate-800 rounded-[50px] p-16 text-center relative group hover:border-orange-500 transition-all shadow-inner">
                   <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" accept="image/*" onChange={(e) => e.target.files?.[0] && (async () => {
                      setIsVerifying(true); setAiResult(null);
                      const file = e.target.files![0];
                      const reader = new FileReader(); reader.readAsDataURL(file);
                      reader.onload = async () => {
                        try {
                          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                          const base64Data = (reader.result as string).split(',')[1];
                          const response = await ai.models.generateContent({
                            model: 'gemini-3-flash-preview',
                            contents: { parts: [{ inlineData: { data: base64Data, mimeType: file.type } }, { text: "Verify Free Fire end-game result screenshot. Extract: Player Name, Rank/Position, and Total Kills. Respond in structured text." }] }
                          });
                          setAiResult(response.text || "Scan failed.");
                        } catch (e) { setAiResult("AI Verification Engine Offline."); } finally { setIsVerifying(false); }
                      };
                   })()} />
                   <i className="fa-solid fa-cloud-arrow-up text-6xl text-slate-800 mb-6 group-hover:text-orange-500 group-hover:scale-110 transition-all"></i>
                   <p className="font-black text-[12px] uppercase tracking-[0.2em] text-slate-500">Tap to upload file</p>
                </div>
                {isVerifying && (
                   <div className="bg-orange-500/10 p-6 rounded-3xl border border-orange-500/20 text-center">
                     <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                     <p className="text-orange-500 animate-pulse font-black text-[10px] uppercase tracking-widest">AI Engine Analysing Gameplay Data...</p>
                   </div>
                )}
                {aiResult && (
                   <div className="bg-slate-900/80 p-8 rounded-[40px] border border-white/5 font-mono text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed shadow-2xl relative">
                     <div className="absolute top-4 right-6 text-[8px] font-black text-orange-500 uppercase">Analysis Complete</div>
                     {aiResult}
                   </div>
                )}
              </div>
            )}
          </div>

          <nav className="fixed bottom-8 left-6 right-6 max-w-[calc(28rem-3rem)] mx-auto bg-slate-950/90 backdrop-blur-3xl border border-white/10 p-5 rounded-[40px] flex justify-around items-center shadow-[0_30px_60px_rgba(0,0,0,0.8)] z-50">
            {[
              { s: 'HOME', i: 'fa-gamepad' },
              { s: 'LEADERBOARD', i: 'fa-ranking-star' },
              { s: 'WALLET', i: 'fa-indian-rupee-sign' },
              { s: 'RESULT_UPLOAD', i: 'fa-brain' },
              { s: 'PROFILE', i: 'fa-user' }
            ].map(item => (
              <button key={item.s} onClick={() => setScreen(item.s as Screen)} className={`p-4 rounded-2xl transition-all duration-300 ${screen === item.s ? 'bg-orange-500 text-white scale-110 shadow-[0_0_20px_rgba(249,115,22,0.4)]' : 'text-slate-600 hover:text-slate-400 active:scale-90'}`}>
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
