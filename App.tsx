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
  const [adminTab, setAdminTab] = useState<'DASHBOARD' | 'USERS' | 'MATCHES'>('DASHBOARD');
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingMatch, setEditingMatch] = useState<Tournament | null>(null);
  const [selectedMatchPlayers, setSelectedMatchPlayers] = useState<any[]>([]);
  const [isViewingPlayers, setIsViewingPlayers] = useState<string | null>(null);

  const [newMatch, setNewMatch] = useState({
    title: '', type: 'Solo', entryFee: 10, prizePool: 100, perKill: 5, startTime: '08:00 PM', totalSlots: 50, map: 'Bermuda', roomId: '', roomPassword: ''
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
    if (user?.uid && screen !== 'AUTH' && screen !== 'ADMIN_AUTH' && screen !== 'SIGNUP') {
      const interval = setInterval(async () => {
        try {
          const latestBalance = await CloudflareService.getBalance(user.uid);
          if (latestBalance !== user.balance) {
            setUser(prev => prev ? { ...prev, balance: latestBalance } : null);
          }
        } catch (e) {}
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [user?.uid, screen]);

  useEffect(() => {
    if (screen === 'HOME') loadData();
    if (screen === 'LEADERBOARD') fetchLeaderboard();
    if (screen === 'ADMIN') openAdmin();
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
          setScreen('ADMIN');
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

  const joinMatch = async (match: Tournament) => {
    if (!user) return;
    if (joinedTournaments.includes(match.id)) return;
    if (match.slotsFull >= match.totalSlots) return;
    if (user.balance < match.entryFee) { setScreen('WALLET'); return; }

    if (!confirm(`Join ${match.title}? (₹${match.entryFee})`)) return;

    setLoading(true);
    try {
      const success = await CloudflareService.joinTournament(user.uid, match.id, match.entryFee);
      if (success) {
        setJoinedTournaments([...joinedTournaments, match.id]);
        loadData();
        alert("Registered!");
      }
    } catch (e) { alert("Error joining."); } finally { setLoading(false); }
  };

  const saveMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const dataToSave = editingMatch || newMatch;
    const success = await CloudflareService.adminAddTournament(dataToSave);
    if (success) {
      loadData();
      setEditingMatch(null);
      setScreen('ADMIN');
    }
    setLoading(false);
  };

  // Fixed missing deleteMatch function by implementing it within the App component
  const deleteMatch = async (id: string) => {
    if (!confirm("Are you sure you want to delete this match?")) return;
    setLoading(true);
    try {
      const success = await CloudflareService.adminDeleteTournament(id);
      if (success) {
        loadData();
      } else {
        alert("Failed to delete match.");
      }
    } catch (e) {
      console.error("Deletion failed", e);
      alert("Error deleting match.");
    } finally {
      setLoading(false);
    }
  };

  const openAdmin = async () => {
    setLoading(true);
    try {
      const users = await CloudflareService.adminGetAllUsers();
      setAdminUsers(users);
      const matches = await CloudflareService.getTournaments();
      setTournaments(matches);
    } catch (e) {
      alert("Access Denied.");
      setScreen('HOME');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    setLoading(true);
    const success = await CloudflareService.adminUpdateUser(editingUser.uid, editingUser);
    if (success) {
      setEditingUser(null);
      openAdmin();
    } else {
      alert("Failed to update user.");
    }
    setLoading(false);
  };

  const viewMatchParticipants = async (tid: string) => {
    setLoading(true);
    const players = await CloudflareService.getTournamentParticipants(tid);
    setSelectedMatchPlayers(players);
    setIsViewingPlayers(tid);
    setLoading(false);
  };

  const filteredUsers = adminUsers.filter(u => 
    u.username.toLowerCase().includes(userSearch.toLowerCase()) || 
    u.email?.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#020617] text-slate-200 relative overflow-x-hidden border-x border-white/5">
      {loading && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center p-10 text-center">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-cyan-500 font-black text-[10px] tracking-[0.3em] uppercase">Processing Request...</p>
        </div>
      )}

      {/* ADMIN EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
           <div className="w-full bg-slate-900 border border-white/10 rounded-[40px] p-8 space-y-6 shadow-2xl animate-fadeIn">
              <h3 className="gaming-font text-white uppercase text-sm">Manage Warrior</h3>
              <div className="space-y-4">
                 <div>
                    <p className="text-[8px] text-slate-500 uppercase mb-1 ml-2">Username</p>
                    <input type="text" className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white text-xs" value={editingUser.username} onChange={e => setEditingUser({...editingUser, username: e.target.value})} />
                 </div>
                 <div>
                    <p className="text-[8px] text-slate-500 uppercase mb-1 ml-2">Balance (₹)</p>
                    <input type="number" className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white text-xs" value={editingUser.balance} onChange={e => setEditingUser({...editingUser, balance: parseFloat(e.target.value)})} />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-[8px] text-slate-500 uppercase mb-1 ml-2">Earnings (₹)</p>
                        <input type="number" className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white text-xs" value={editingUser.totalEarnings} onChange={e => setEditingUser({...editingUser, totalEarnings: parseFloat(e.target.value)})} />
                    </div>
                    <div>
                        <p className="text-[8px] text-slate-500 uppercase mb-1 ml-2">Role</p>
                        <select className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white text-xs" value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value as any})}>
                           <option value="player">Player</option>
                           <option value="admin">Admin</option>
                        </select>
                    </div>
                 </div>
                 <div className="flex items-center gap-3 p-4 bg-black/20 rounded-2xl border border-white/5">
                    <input type="checkbox" id="ban-check" checked={editingUser.isBanned} onChange={e => setEditingUser({...editingUser, isBanned: e.target.checked})} />
                    <label htmlFor="ban-check" className="text-[10px] font-black uppercase text-rose-500">Banned Account</label>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4">
                 <button onClick={() => setEditingUser(null)} className="py-4 rounded-2xl text-[9px] font-black uppercase text-slate-500 bg-slate-800">Cancel</button>
                 <button onClick={handleUpdateUser} className="py-4 rounded-2xl text-[9px] font-black uppercase text-black bg-cyan-500 shadow-lg shadow-cyan-500/20">Apply Changes</button>
              </div>
           </div>
        </div>
      )}

      {/* VIEW PARTICIPANTS MODAL */}
      {isViewingPlayers && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
           <div className="w-full max-h-[70vh] flex flex-col bg-slate-900 border border-white/10 rounded-[40px] p-8 shadow-2xl animate-fadeIn">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="gaming-font text-white uppercase text-sm">Squad Registry</h3>
                 <button onClick={() => setIsViewingPlayers(null)} className="text-slate-500"><i className="fa-solid fa-xmark"></i></button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                 {selectedMatchPlayers.length === 0 ? (
                   <p className="text-slate-600 text-[10px] text-center py-10 uppercase italic">No warriors joined yet</p>
                 ) : selectedMatchPlayers.map((p, i) => (
                   <div key={p.uid} className="flex justify-between items-center p-4 bg-black/40 rounded-2xl border border-white/5">
                      <div className="flex items-center gap-3">
                         <span className="text-[9px] text-slate-600 font-black">#{i+1}</span>
                         <div>
                            <p className="text-white text-xs font-black uppercase">{p.username}</p>
                            <p className="text-[8px] text-slate-500">{p.email}</p>
                         </div>
                      </div>
                      <button onClick={() => { setIsViewingPlayers(null); setEditingUser(adminUsers.find(au => au.uid === p.uid) || null); }} className="text-cyan-500 text-xs"><i className="fa-solid fa-gear"></i></button>
                   </div>
                 ))}
              </div>
              <p className="text-[8px] text-center text-slate-600 mt-6 uppercase font-black tracking-widest">{selectedMatchPlayers.length} Total Participants</p>
           </div>
        </div>
      )}

      {screen === 'ADMIN_AUTH' ? (
        <div className="min-h-screen bg-slate-950 p-8 flex flex-col justify-center animate-fadeIn">
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-cyan-500 rounded-2xl mx-auto flex items-center justify-center text-black text-4xl mb-4 shadow-[0_0_30px_rgba(6,182,212,0.3)]">
              <i className="fa-solid fa-shield-halved"></i>
            </div>
            <h2 className="gaming-font text-2xl font-black text-white uppercase tracking-widest">Admin Portal</h2>
          </div>
          <form onSubmit={(e) => handleAuthAction(e, true)} className="space-y-4 max-w-sm mx-auto w-full">
            <input type="email" placeholder="Admin Email" required className="w-full bg-slate-900 border border-cyan-500/20 rounded-2xl py-4 px-6 text-white outline-none focus:border-cyan-500" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            <input type="password" placeholder="Secure Password" required className="w-full bg-slate-900 border border-cyan-500/20 rounded-2xl py-4 px-6 text-white outline-none focus:border-cyan-500" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            <button type="submit" className="w-full bg-cyan-500 text-black font-black py-4 rounded-2xl uppercase tracking-widest">Enter Console</button>
          </form>
          <button onClick={() => setScreen('AUTH')} className="mt-8 text-slate-500 text-[10px] font-bold uppercase text-center w-full underline">Back to Lobby</button>
        </div>
      ) : screen === 'ADMIN' ? (
        <div className="min-h-screen flex flex-col animate-fadeIn">
           <div className="p-6 bg-slate-950 border-b border-white/5 flex justify-between items-center sticky top-0 z-50">
              <h2 className="gaming-font text-xl font-black text-cyan-400 uppercase tracking-tighter">Command Center</h2>
              <button onClick={() => setScreen('HOME')} className="bg-slate-800 px-4 py-2 rounded-xl text-[8px] font-black uppercase border border-white/5 shadow-inner">Exit Hub</button>
           </div>
           
           <div className="flex bg-slate-900/50 p-2 gap-2 mx-4 my-4 rounded-[28px] border border-white/5">
              {['DASHBOARD', 'USERS', 'MATCHES'].map(tab => (
                <button key={tab} onClick={() => setAdminTab(tab as any)} className={`flex-1 py-3 rounded-2xl text-[9px] font-black uppercase transition-all duration-300 ${adminTab === tab ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/30 scale-[1.02]' : 'text-slate-500'}`}>{tab}</button>
              ))}
           </div>

           <div className="flex-1 p-4 pb-32 overflow-y-auto">
              {adminTab === 'DASHBOARD' && (
                <div className="space-y-6">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-[35px] border border-white/10 shadow-xl">
                         <div className="w-8 h-8 bg-cyan-500/10 text-cyan-500 rounded-lg flex items-center justify-center mb-3"><i className="fa-solid fa-users text-xs"></i></div>
                         <p className="text-[8px] text-slate-500 uppercase mb-1 font-black">Registered</p>
                         <p className="text-3xl font-black text-white italic">{adminUsers.length}</p>
                      </div>
                      <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-[35px] border border-white/10 shadow-xl">
                         <div className="w-8 h-8 bg-emerald-500/10 text-emerald-500 rounded-lg flex items-center justify-center mb-3"><i className="fa-solid fa-indian-rupee-sign text-xs"></i></div>
                         <p className="text-[8px] text-slate-500 uppercase mb-1 font-black">Economy</p>
                         <p className="text-3xl font-black text-emerald-400 italic">₹{adminUsers.reduce((sum, u) => sum + u.balance, 0).toFixed(0)}</p>
                      </div>
                      <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-[35px] border border-white/10 shadow-xl col-span-2 flex justify-between items-center">
                         <div>
                            <p className="text-[8px] text-slate-500 uppercase mb-1 font-black">Active Matches</p>
                            <p className="text-3xl font-black text-orange-500 italic">{tournaments.length}</p>
                         </div>
                         <button onClick={() => setAdminTab('MATCHES')} className="bg-white/5 border border-white/10 p-4 rounded-2xl text-xs"><i className="fa-solid fa-arrow-right"></i></button>
                      </div>
                   </div>
                   <div className="bg-slate-900/40 p-8 rounded-[40px] border border-white/5 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-[60px] rounded-full"></div>
                      <h3 className="gaming-font text-[10px] text-white uppercase mb-4 tracking-widest border-b border-white/5 pb-3">Security Alerts</h3>
                      <div className="space-y-4">
                         {adminUsers.filter(u => u.isBanned).length > 0 ? (
                            adminUsers.filter(u => u.isBanned).map(u => (
                              <div key={u.uid} className="flex items-center gap-3 text-rose-500 bg-rose-500/5 p-3 rounded-xl border border-rose-500/10">
                                 <i className="fa-solid fa-circle-exclamation text-[10px]"></i>
                                 <span className="text-[9px] font-black uppercase">{u.username} is currently restricted</span>
                              </div>
                            ))
                         ) : (
                           <p className="text-[9px] text-slate-600 uppercase text-center py-4 italic">No critical security issues detected</p>
                         )}
                      </div>
                   </div>
                </div>
              )}

              {adminTab === 'USERS' && (
                <div className="space-y-4">
                   <div className="relative mb-6">
                      <i className="fa-solid fa-magnifying-glass absolute left-5 top-1/2 -translate-y-1/2 text-slate-600"></i>
                      <input type="text" placeholder="Search warrior by name or email..." className="w-full bg-slate-950 border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-xs text-white outline-none focus:border-cyan-500 transition-all" value={userSearch} onChange={e => setUserSearch(e.target.value)} />
                   </div>
                   <div className="space-y-3">
                      {filteredUsers.map(u => (
                        <div key={u.uid} className={`bg-slate-900/60 p-5 rounded-[30px] border ${u.isBanned ? 'border-rose-500/20 opacity-70' : 'border-white/5'} flex justify-between items-center group active:scale-95 transition-all`}>
                           <div className="flex gap-4 items-center">
                              <div className={`w-12 h-12 ${u.isBanned ? 'bg-rose-500' : u.role === 'admin' ? 'bg-cyan-500' : 'bg-slate-800'} rounded-2xl flex items-center justify-center text-black shadow-lg`}>
                                 <i className={`fa-solid ${u.isBanned ? 'fa-user-slash' : u.role === 'admin' ? 'fa-user-shield' : 'fa-user-ninja'} text-lg`}></i>
                              </div>
                              <div>
                                 <div className="flex items-center gap-2">
                                    <p className="text-white font-black text-xs uppercase tracking-tight">{u.username}</p>
                                    {u.role === 'admin' && <span className="bg-cyan-500/20 text-cyan-400 text-[7px] font-black px-1.5 rounded uppercase">Master</span>}
                                 </div>
                                 <p className="text-[8px] text-slate-500 mt-0.5">{u.email}</p>
                                 <p className="text-[10px] text-emerald-400 font-black mt-1 italic">₹{u.balance.toFixed(0)}</p>
                              </div>
                           </div>
                           <button onClick={() => setEditingUser(u)} className="bg-white/5 border border-white/10 text-slate-500 p-3 rounded-xl hover:text-cyan-400 hover:border-cyan-500/30 transition-all"><i className="fa-solid fa-sliders"></i></button>
                        </div>
                      ))}
                      {filteredUsers.length === 0 && <p className="text-center text-slate-600 text-[10px] py-10 uppercase font-black italic">No matches found</p>}
                   </div>
                </div>
              )}

              {adminTab === 'MATCHES' && (
                <div className="space-y-5">
                   <button onClick={() => { setEditingMatch(null); setScreen('ADMIN_MATCHES'); }} className="w-full bg-orange-500 py-5 rounded-[28px] text-[10px] font-black uppercase tracking-widest shadow-xl shadow-orange-500/20 border-b-4 border-orange-700 active:scale-95 transition-all">Launch New Operation</button>
                   {tournaments.map(t => (
                     <div key={t.id} className="bg-slate-900/80 p-6 rounded-[40px] border border-white/10 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-500 group-hover:bg-cyan-500 transition-colors"></div>
                        <div className="flex justify-between items-start mb-6">
                           <div>
                              <div className="flex items-center gap-2 mb-2">
                                 <span className="bg-black/40 text-slate-500 text-[8px] font-black px-2 py-0.5 rounded-lg border border-white/5 uppercase">{t.map}</span>
                                 <span className="text-orange-500 text-[10px] font-black italic">{t.startTime}</span>
                              </div>
                              <h4 className="gaming-font text-white font-black text-sm uppercase">{t.title}</h4>
                           </div>
                           <div className="flex gap-2">
                              <button onClick={() => { setEditingMatch(t); setScreen('ADMIN_MATCHES'); }} className="bg-white/5 p-2.5 rounded-xl text-slate-500 border border-white/5"><i className="fa-solid fa-pen-to-square"></i></button>
                              <button onClick={() => deleteMatch(t.id)} className="bg-rose-500/10 p-2.5 rounded-xl text-rose-500/50 hover:text-rose-500 border border-rose-500/10"><i className="fa-solid fa-trash-can"></i></button>
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                           <div className="bg-black/30 p-4 rounded-2xl border border-white/5 text-center">
                              <p className="text-[8px] text-slate-600 uppercase mb-1">Room ID</p>
                              <p className="text-xs text-white font-mono font-black">{t.roomId || 'MISSING'}</p>
                           </div>
                           <div className="bg-black/30 p-4 rounded-2xl border border-white/5 text-center">
                              <p className="text-[8px] text-slate-600 uppercase mb-1">Passkey</p>
                              <p className="text-xs text-white font-mono font-black">{t.roomPassword || 'MISSING'}</p>
                           </div>
                        </div>

                        <div className="flex gap-3">
                           <button onClick={() => viewMatchParticipants(t.id)} className="flex-1 bg-cyan-500/10 text-cyan-500 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest border border-cyan-500/20 active:scale-95 transition-all">Registry ({t.slotsFull})</button>
                           <div className="bg-white/5 border border-white/5 px-4 rounded-2xl flex items-center justify-center">
                              <span className="text-[10px] text-white font-black">₹{t.entryFee}</span>
                           </div>
                        </div>
                     </div>
                   ))}
                </div>
              )}
           </div>
        </div>
      ) : screen === 'ADMIN_MATCHES' ? (
        <div className="p-8 animate-fadeIn pb-20">
           <div className="flex justify-between items-center mb-8">
              <h2 className="gaming-font text-xl font-black text-orange-500 uppercase">{editingMatch ? 'Modify Spec' : 'New Operation'}</h2>
              <button onClick={() => setScreen('ADMIN')} className="text-slate-500 text-[10px] font-black uppercase underline">Abort</button>
           </div>
           <form onSubmit={saveMatch} className="space-y-5 bg-slate-900/60 p-8 rounded-[40px] border border-white/10 shadow-2xl">
              <div className="space-y-1">
                 <p className="text-[8px] text-slate-500 uppercase ml-3 font-black">Operation Name</p>
                 <input type="text" placeholder="Title" required className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white text-xs outline-none focus:border-orange-500" 
                  value={editingMatch ? editingMatch.title : newMatch.title} 
                  onChange={e => editingMatch ? setEditingMatch({...editingMatch, title: e.target.value}) : setNewMatch({...newMatch, title: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                    <p className="text-[8px] text-slate-500 uppercase ml-3 font-black">Mode</p>
                    <select className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white text-xs outline-none" 
                       value={editingMatch ? editingMatch.type : newMatch.type} 
                       onChange={e => editingMatch ? setEditingMatch({...editingMatch, type: e.target.value}) : setNewMatch({...newMatch, type: e.target.value})}>
                       <option>Solo</option><option>Duo</option><option>Squad</option>
                    </select>
                 </div>
                 <div className="space-y-1">
                    <p className="text-[8px] text-slate-500 uppercase ml-3 font-black">Sector (Map)</p>
                    <input type="text" placeholder="Map" className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white text-xs outline-none" 
                       value={editingMatch ? editingMatch.map : newMatch.map} 
                       onChange={e => editingMatch ? setEditingMatch({...editingMatch, map: e.target.value}) : setNewMatch({...newMatch, map: e.target.value})} />
                 </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                 <div><p className="text-[8px] text-slate-500 uppercase ml-2 mb-1 font-black">Entry</p><input type="number" className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-[10px]" value={editingMatch ? editingMatch.entryFee : newMatch.entryFee} onChange={e => editingMatch ? setEditingMatch({...editingMatch, entryFee: parseInt(e.target.value)}) : setNewMatch({...newMatch, entryFee: parseInt(e.target.value)})} /></div>
                 <div><p className="text-[8px] text-slate-500 uppercase ml-2 mb-1 font-black">Pool</p><input type="number" className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-[10px]" value={editingMatch ? editingMatch.prizePool : newMatch.prizePool} onChange={e => editingMatch ? setEditingMatch({...editingMatch, prizePool: parseInt(e.target.value)}) : setNewMatch({...newMatch, prizePool: parseInt(e.target.value)})} /></div>
                 <div><p className="text-[8px] text-slate-500 uppercase ml-2 mb-1 font-black">Slots</p><input type="number" className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-[10px]" value={editingMatch ? editingMatch.totalSlots : newMatch.totalSlots} onChange={e => editingMatch ? setEditingMatch({...editingMatch, totalSlots: parseInt(e.target.value)}) : setNewMatch({...newMatch, totalSlots: parseInt(e.target.value)})} /></div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-6 border-t border-white/5">
                 <div><p className="text-[8px] text-cyan-500 uppercase ml-2 mb-1 font-black">Room ID</p><input type="text" placeholder="ID" className="w-full bg-black/40 border border-cyan-500/20 rounded-2xl p-4 text-white text-xs font-mono" value={editingMatch ? (editingMatch.roomId || '') : newMatch.roomId} onChange={e => editingMatch ? setEditingMatch({...editingMatch, roomId: e.target.value}) : setNewMatch({...newMatch, roomId: e.target.value})} /></div>
                 <div><p className="text-[8px] text-cyan-500 uppercase ml-2 mb-1 font-black">Passkey</p><input type="text" placeholder="PW" className="w-full bg-black/40 border border-cyan-500/20 rounded-2xl p-4 text-white text-xs font-mono" value={editingMatch ? (editingMatch.roomPassword || '') : newMatch.roomPassword} onChange={e => editingMatch ? setEditingMatch({...editingMatch, roomPassword: e.target.value}) : setNewMatch({...newMatch, roomPassword: e.target.value})} /></div>
              </div>

              <div className="space-y-1">
                 <p className="text-[8px] text-slate-500 uppercase ml-3 font-black">Sync Time</p>
                 <input type="text" placeholder="Start Time (e.g. 10:00 PM)" className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white text-xs outline-none" value={editingMatch ? editingMatch.startTime : newMatch.startTime} onChange={e => editingMatch ? setEditingMatch({...editingMatch, startTime: e.target.value}) : setNewMatch({...newMatch, startTime: e.target.value})} />
              </div>
              
              <button type="submit" className="w-full bg-orange-500 text-white font-black py-5 rounded-[28px] uppercase tracking-widest mt-6 shadow-xl shadow-orange-500/20 border-b-4 border-orange-700 active:scale-95">
                {editingMatch ? 'Confirm Update' : 'Publish Operation'}
              </button>
           </form>
        </div>
      ) : (
        <>
          <div className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-xl border-b border-white/5 p-4 flex justify-between items-center shadow-lg">
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white font-black italic shadow-inner">FF</div>
               <div><h1 className="gaming-font font-black text-[9px] text-white tracking-widest uppercase">Battle Hub</h1></div>
            </div>
            <div className="bg-slate-900 border border-white/10 px-4 py-1.5 rounded-xl cursor-pointer active:scale-95 transition-transform" onClick={() => setScreen('WALLET')}>
               <span className="text-white font-black text-xs">₹{user?.balance.toFixed(0)}</span>
            </div>
          </div>

          <div className="pb-32 p-5">
            {screen === 'HOME' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-indigo-950/80 to-slate-900 p-8 rounded-[40px] border border-white/10 relative overflow-hidden shadow-2xl">
                   <h2 className="gaming-font text-white text-lg font-black uppercase tracking-tight">SOLDIER: {user?.username}</h2>
                   <div className="flex gap-4 mt-6">
                      <div className="bg-white/5 px-5 py-3 rounded-2xl border border-white/5 flex-1">
                        <p className="text-[7px] text-slate-500 font-black uppercase mb-1">Earnings</p>
                        <p className="text-lg font-black text-emerald-400 italic">₹{user?.totalEarnings || 0}</p>
                      </div>
                      <div className="bg-white/5 px-5 py-3 rounded-2xl border border-white/5 flex-1">
                        <p className="text-[7px] text-slate-500 font-black uppercase mb-1">Battles</p>
                        <p className="text-lg font-black text-white italic">{user?.matchesPlayed || 0}</p>
                      </div>
                   </div>
                   {user?.role === 'admin' && (
                     <button onClick={() => setScreen('ADMIN')} className="mt-6 w-full bg-cyan-500 text-black py-4 rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl shadow-cyan-500/20 active:scale-95 transition-all">
                       <i className="fa-solid fa-terminal"></i> OPEN COMMAND CONSOLE
                     </button>
                   )}
                </div>

                <div className="flex justify-between items-center px-2">
                  <h3 className="gaming-font text-[10px] font-black tracking-widest text-slate-500 uppercase">Live Operations</h3>
                  <button onClick={loadData} className="text-orange-500"><i className="fa-solid fa-rotate-right"></i></button>
                </div>

                {tournaments.length === 0 ? (
                  <div className="text-center py-20 bg-slate-900/20 rounded-[40px] border border-dashed border-white/5">
                     <p className="text-slate-600 text-[10px] uppercase font-black tracking-[0.4em]">No active matches</p>
                  </div>
                ) : tournaments.map(match => {
                  const isJoined = joinedTournaments.includes(match.id);
                  const isFull = match.slotsFull >= match.totalSlots;
                  const slotPercent = Math.min(100, (match.slotsFull / match.totalSlots) * 100);

                  return (
                    <div key={match.id} className={`bg-slate-900/40 border ${isJoined ? 'border-emerald-500/40' : isFull ? 'border-rose-500/20' : 'border-white/5'} rounded-[40px] p-6 group transition-all shadow-xl`}>
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex gap-4 items-center">
                          <div className={`w-12 h-12 ${isJoined ? 'bg-emerald-500 text-white' : isFull ? 'bg-slate-900 text-slate-700' : 'bg-slate-800 text-orange-500'} rounded-2xl flex items-center justify-center border border-white/5 shadow-lg`}>
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

                      {/* Room Details for Joined Players */}
                      {isJoined && (
                        <div className="mb-6 p-5 bg-emerald-500/5 rounded-[30px] border border-emerald-500/20 animate-fadeIn relative overflow-hidden">
                           <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                           <p className="text-[8px] text-emerald-500 font-black uppercase mb-4 tracking-widest text-center">Operation Credentials</p>
                           <div className="flex justify-around gap-4">
                              <div className="text-center flex-1">
                                 <p className="text-[7px] text-slate-500 uppercase mb-1">Room ID</p>
                                 <p className="text-xs text-white font-mono font-black">{match.roomId || 'Waiting...'}</p>
                              </div>
                              <div className="text-center flex-1 border-l border-white/5">
                                 <p className="text-[7px] text-slate-500 uppercase mb-1">Password</p>
                                 <p className="text-xs text-white font-mono font-black">{match.roomPassword || 'Waiting...'}</p>
                              </div>
                           </div>
                           {(!match.roomId || !match.roomPassword) && (
                             <p className="text-[7px] text-slate-600 text-center mt-4 animate-pulse italic">Details sync 15m before launch</p>
                           )}
                        </div>
                      )}

                      <div className="mb-4 space-y-2">
                        <div className="flex justify-between text-[8px] font-black uppercase tracking-widest">
                           <span className={isFull ? 'text-rose-500' : 'text-slate-500'}>{isFull ? 'Sector Full' : 'Filling Fast'}</span>
                           <span className="text-white">{match.slotsFull} / {match.totalSlots}</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-white/5">
                           <div className={`h-full transition-all duration-700 ${isFull ? 'bg-rose-500' : 'bg-orange-500'}`} style={{ width: `${slotPercent}%` }}></div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-4 border-t border-white/5">
                        <div className="flex gap-4">
                           <div><p className="text-[7px] text-slate-600 font-black uppercase">Entry</p><p className="text-xs text-white font-black italic">₹{match.entryFee}</p></div>
                           <div><p className="text-[7px] text-slate-600 font-black uppercase">Kill</p><p className="text-xs text-white font-black italic">₹{match.perKill}</p></div>
                        </div>
                        {isJoined ? (
                          <span className="bg-emerald-500/20 text-emerald-500 text-[9px] font-black px-6 py-2 rounded-xl border border-emerald-500/20 shadow-lg shadow-emerald-500/10">MISSION READY ✅</span>
                        ) : isFull ? (
                          <span className="bg-rose-500/10 text-rose-500 text-[9px] font-black px-6 py-2 rounded-xl border border-rose-500/20 opacity-50">FULL 🚫</span>
                        ) : (
                          <button onClick={() => joinMatch(match)} className="bg-orange-500 text-white text-[9px] font-black px-6 py-2 rounded-xl border-b-4 border-orange-700 active:scale-95 transition-all shadow-lg shadow-orange-500/20">JOIN NOW</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {screen === 'LEADERBOARD' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="text-center mb-10">
                  <div className="inline-block p-4 bg-orange-500/10 rounded-3xl mb-4 border border-orange-500/20">
                    <i className="fa-solid fa-trophy text-orange-500 text-5xl"></i>
                  </div>
                  <h2 className="gaming-font text-2xl font-black text-white uppercase">World Ranking</h2>
                  <p className="text-slate-500 text-[8px] uppercase tracking-[0.4em] mt-2">Elite Vanguard</p>
                </div>
                <div className="bg-slate-900/40 border border-white/5 rounded-[40px] overflow-hidden shadow-2xl">
                  {leaderboard.length === 0 ? <p className="text-slate-600 text-[8px] text-center py-20 uppercase font-black">Syncing Rankings...</p> : leaderboard.map((player, index) => (
                    <div key={player.username} className={`p-6 border-b border-white/5 flex justify-between items-center ${player.username === user?.username ? 'bg-orange-500/10' : ''}`}>
                       <div className="flex items-center gap-4">
                          <span className={`font-black text-lg ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-slate-300' : index === 2 ? 'text-orange-800' : 'text-slate-600'}`}>#{index+1}</span>
                          <div>
                             <p className="text-white font-black uppercase text-sm">{player.username}</p>
                             <p className="text-[8px] text-slate-500 uppercase">{player.matchesPlayed} Missions</p>
                          </div>
                       </div>
                       <p className="text-emerald-400 font-black italic text-lg">₹{player.totalEarnings}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {screen === 'RESULT_UPLOAD' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="text-center mb-8">
                  <h2 className="gaming-font text-2xl font-black text-white uppercase tracking-tight">AI VERIFIER</h2>
                  <p className="text-slate-500 text-[9px] font-bold uppercase tracking-[0.3em] mt-2">Instant Reward Scanning</p>
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
                            contents: { parts: [{ inlineData: { data: base64Data, mimeType: file.type } }, { text: "Verify Free Fire end-game result. Extract: Player Name, Position, and Total Kills. Only respond with the extracted data clearly." }] }
                          });
                          setAiResult(response.text || "Scan failed.");
                        } catch (e) { setAiResult("AI verification failed. Please try again."); } finally { setIsVerifying(false); }
                      };
                   })()} />
                   <i className="fa-solid fa-cloud-arrow-up text-6xl text-slate-800 mb-6 group-hover:text-orange-500 group-hover:scale-110 transition-all"></i>
                   <p className="font-black text-[10px] uppercase tracking-[0.3em] text-slate-500">Scan Match Outcome</p>
                </div>
                {isVerifying && (
                   <div className="bg-orange-500/10 p-8 rounded-3xl border border-orange-500/20 text-center">
                     <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                     <p className="text-orange-500 animate-pulse font-black text-[10px] uppercase tracking-widest">Neural Link Scanning...</p>
                   </div>
                )}
                {aiResult && (
                   <div className="bg-slate-900/80 p-8 rounded-[40px] border border-white/5 font-mono text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed shadow-2xl">
                     <p className="text-orange-500 font-black mb-4 uppercase tracking-widest border-b border-white/5 pb-2 text-[8px]">Intelligence Summary</p>
                     {aiResult}
                   </div>
                )}
              </div>
            )}

            {screen === 'WALLET' && (
              <div className="space-y-6 animate-fadeIn">
                 <button onClick={() => setScreen('HOME')} className="text-slate-500 text-[10px] font-black uppercase underline flex items-center gap-2"> Lobby</button>
                 <div className="bg-slate-950 p-12 rounded-[50px] border border-white/5 text-center shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 blur-3xl rounded-full"></div>
                    <p className="text-slate-500 text-[10px] uppercase mb-6 tracking-widest">Available Credits</p>
                    <h3 className="text-7xl font-black text-white mb-12 italic tracking-tighter">₹{user?.balance.toFixed(0)}</h3>
                    <div className="grid grid-cols-2 gap-4">
                       <button onClick={() => alert("Terminal connection offline.")} className="bg-orange-500 text-white font-black py-5 rounded-2xl uppercase tracking-widest shadow-xl shadow-orange-500/20 active:scale-95 transition-all">Deposit</button>
                       <button onClick={() => alert("Verification in progress.")} className="bg-slate-900 text-white font-black py-5 rounded-2xl border border-white/10 active:scale-95 transition-all">Withdraw</button>
                    </div>
                 </div>
              </div>
            )}

            {screen === 'PROFILE' && (
              <div className="space-y-6 animate-fadeIn">
                 <div className="bg-slate-900 p-10 rounded-[50px] text-center border border-white/5 relative overflow-hidden shadow-2xl">
                    <div className="w-24 h-24 bg-slate-800 rounded-[35px] mx-auto mb-6 flex items-center justify-center text-5xl text-orange-500 shadow-inner">
                      <i className="fa-solid fa-user-ninja"></i>
                    </div>
                    <h2 className="gaming-font text-2xl font-black text-white uppercase tracking-tight">{user?.username}</h2>
                    <p className="text-slate-500 text-[10px] font-black uppercase mt-2 opacity-60 italic tracking-widest">{user?.email}</p>
                 </div>
                 <button onClick={() => CloudflareService.logout().then(() => setScreen('AUTH'))} className="w-full bg-rose-500/10 p-6 rounded-3xl flex justify-between items-center text-rose-500 text-[11px] font-black uppercase tracking-widest border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all active:scale-95 group shadow-xl shadow-rose-500/10">
                    <span>SEVER CONNECTION</span><i className="fa-solid fa-power-off group-hover:rotate-12 transition-transform"></i>
                 </button>
              </div>
            )}
          </div>

          <nav className="fixed bottom-8 left-6 right-6 max-w-[calc(28rem-3rem)] mx-auto bg-slate-950/90 backdrop-blur-3xl border border-white/10 p-5 rounded-[40px] flex justify-around items-center z-50 shadow-2xl shadow-black">
            {[
              { s: 'HOME', i: 'fa-gamepad' },
              { s: 'LEADERBOARD', i: 'fa-ranking-star' },
              { s: 'WALLET', i: 'fa-indian-rupee-sign' },
              { s: 'RESULT_UPLOAD', i: 'fa-brain' },
              { s: 'PROFILE', i: 'fa-user' }
            ].map(item => (
              <button key={item.s} onClick={() => setScreen(item.s as Screen)} className={`p-4 rounded-2xl transition-all duration-300 ${screen === item.s ? 'bg-orange-500 text-white scale-110 shadow-[0_0_20px_rgba(249,115,22,0.4)]' : 'text-slate-600 hover:text-slate-400'}`}>
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