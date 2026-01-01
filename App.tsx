import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Screen, Tournament, User, Transaction } from './types';
import { CloudflareService } from './services/cloudflare';

const App: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('AUTH');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [joinedTournaments, setJoinedTournaments] = useState<string[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  // Admin States
  const [adminTab, setAdminTab] = useState<'DASHBOARD' | 'USERS' | 'MATCHES' | 'REQUESTS'>('DASHBOARD');
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [adminTransactions, setAdminTransactions] = useState<Transaction[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [viewingTx, setViewingTx] = useState<Transaction | null>(null);

  // User Action States
  const [depositAmount, setDepositAmount] = useState('');
  const [depositSS, setDepositSS] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawDetails, setWithdrawDetails] = useState('');

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
    } catch (e) { console.error("Data load failed"); }
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
    if (screen === 'HOME') loadData();
    if (screen === 'ADMIN') openAdmin();
  }, [screen]);

  const speakUrduInstructions = () => {
    const text = "Huzaifa bin Sardar ke is JazzCash number par paise bhejiye aur payment ka screenshot yahan upload karke submit karden. Shukriya.";
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ur-PK';
    window.speechSynthesis.speak(utterance);
  };

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
          if (loggedUser.role !== 'admin') throw new Error("Admin access required.");
          setUser(loggedUser);
          setScreen('ADMIN');
        } else {
          setUser(loggedUser);
          setScreen('HOME');
        }
      }
      loadData();
    } catch (err: any) { setAuthError(err.message || "Auth Error"); } finally { setLoading(false); }
  };

  const openAdmin = async () => {
    setLoading(true);
    try {
      const [users, matches, txs] = await Promise.all([
        CloudflareService.adminGetAllUsers(),
        CloudflareService.getTournaments(),
        CloudflareService.adminGetTransactions()
      ]);
      setAdminUsers(users);
      setTournaments(matches);
      setAdminTransactions(txs);
    } catch (e) { setScreen('HOME'); } finally { setLoading(false); }
  };

  const handleDepositSubmit = async () => {
    if (!user || !depositAmount || !depositSS) return alert("Saray khaney (fields) puray karein.");
    setLoading(true);
    const success = await CloudflareService.createTransaction({
      user_uid: user.uid,
      type: 'DEPOSIT',
      amount: parseFloat(depositAmount),
      details: depositSS
    });
    if (success) {
      alert("Aapki request bhej di gayi hai. Admin verify karke jald balance add kardenge.");
      setScreen('WALLET');
    }
    setLoading(false);
  };

  const handleWithdrawSubmit = async () => {
    if (!user || !withdrawAmount || !withdrawDetails) return alert("Amount aur Account info zaroori hai.");
    if (parseFloat(withdrawAmount) > user.balance) return alert("Aapka balance kam hai.");
    setLoading(true);
    const success = await CloudflareService.createTransaction({
      user_uid: user.uid,
      type: 'WITHDRAW',
      amount: parseFloat(withdrawAmount),
      details: withdrawDetails
    });
    if (success) {
      alert("Withdrawal request bhej di gayi hai.");
      setScreen('WALLET');
    }
    setLoading(false);
  };

  const processTx = async (tx: Transaction, status: 'APPROVED' | 'REJECTED') => {
    if (!confirm(`Are you sure you want to ${status}?`)) return;
    setLoading(true);
    const success = await CloudflareService.adminUpdateTransaction(tx.id, status, tx.user_uid, tx.amount);
    if (success) {
      setViewingTx(null);
      openAdmin();
    }
    setLoading(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setDepositSS(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#020617] text-slate-200 relative overflow-x-hidden border-x border-white/5 font-sans">
      {loading && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center p-10 text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-orange-500 font-black text-[10px] tracking-widest uppercase italic">SYNCING WITH DATABASE...</p>
        </div>
      )}

      {/* ADMIN TRANSACTION REVIEW MODAL */}
      {viewingTx && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/95 backdrop-blur-md">
           <div className="w-full bg-slate-900 border border-white/10 rounded-[40px] p-8 space-y-6 shadow-2xl animate-fadeIn max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center">
                 <h3 className="gaming-font text-white uppercase text-sm">{viewingTx.type} REQUEST</h3>
                 <button onClick={() => setViewingTx(null)} className="text-slate-500"><i className="fa-solid fa-xmark"></i></button>
              </div>
              <div className="space-y-4">
                 <div className="flex justify-between text-xs p-3 bg-black/20 rounded-xl">
                    <span className="text-slate-500">USER:</span>
                    <span className="text-white font-black">{viewingTx.username}</span>
                 </div>
                 <div className="flex justify-between text-xs p-3 bg-black/20 rounded-xl">
                    <span className="text-slate-500">AMOUNT:</span>
                    <span className="text-emerald-400 font-black">₹{viewingTx.amount}</span>
                 </div>
                 {viewingTx.type === 'DEPOSIT' ? (
                   <div className="space-y-2">
                      <p className="text-[9px] text-slate-500 uppercase font-black text-center">Proof Screenshot</p>
                      <div className="bg-black/40 p-2 rounded-2xl border border-white/5">
                         <img src={viewingTx.details} alt="Proof" className="w-full rounded-xl shadow-lg" />
                      </div>
                   </div>
                 ) : (
                   <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                      <p className="text-[9px] text-slate-500 uppercase mb-2 font-black">Payment Destination</p>
                      <p className="text-xs text-white italic bg-black/20 p-4 rounded-xl">{viewingTx.details}</p>
                   </div>
                 )}
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4">
                 <button onClick={() => processTx(viewingTx, 'REJECTED')} className="py-5 rounded-2xl text-[10px] font-black uppercase text-rose-500 bg-rose-500/10 border border-rose-500/20 active:scale-95 transition-all">Reject</button>
                 <button onClick={() => processTx(viewingTx, 'APPROVED')} className="py-5 rounded-2xl text-[10px] font-black uppercase text-black bg-emerald-500 shadow-xl shadow-emerald-500/20 active:scale-95 transition-all">Verify & Approve</button>
              </div>
           </div>
        </div>
      )}

      {screen === 'DEPOSIT' ? (
        <div className="p-8 animate-fadeIn">
           <div className="flex justify-between items-center mb-10">
              <h2 className="gaming-font text-xl font-black text-orange-500 uppercase">Deposit Center</h2>
              <button onClick={() => setScreen('WALLET')} className="text-slate-500 text-[10px] font-black uppercase underline">Cancel</button>
           </div>
           
           <div className="space-y-8">
              <div className="bg-slate-900/60 p-8 rounded-[40px] border border-white/10 shadow-2xl relative overflow-hidden group">
                 <div className="absolute -top-10 -right-10 w-32 h-32 bg-orange-500/5 blur-[60px] rounded-full"></div>
                 
                 <div className="text-center mb-8">
                    <p className="text-orange-500 font-black text-xs uppercase tracking-widest mb-2 italic">Official JazzCash Number</p>
                    <div className="bg-black/40 p-6 rounded-[30px] border border-orange-500/20 relative group-hover:border-orange-500/40 transition-all">
                       <p className="text-3xl text-white font-black tracking-[0.1em] mb-1">03165864192</p>
                       <p className="text-[10px] text-orange-400 font-bold uppercase tracking-widest">HUZAIFA BIN SARDAR</p>
                    </div>
                 </div>

                 <div className="bg-orange-500/10 p-5 rounded-3xl border border-orange-500/20 text-center relative">
                    <p className="text-slate-200 text-[11px] font-bold leading-relaxed mb-4">
                      "Upar diye gaye number par JazzCash karein aur payment ka screenshot upload karein."
                    </p>
                    <button onClick={speakUrduInstructions} className="flex items-center gap-3 bg-orange-500 text-white px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest mx-auto shadow-lg shadow-orange-500/20 active:scale-95 transition-all">
                       <i className="fa-solid fa-volume-high"></i> Listen Instructions
                    </button>
                 </div>
              </div>

              <div className="bg-slate-900/40 p-8 rounded-[40px] border border-white/5 space-y-6 shadow-xl">
                 <div className="space-y-1">
                    <p className="text-[9px] text-slate-500 uppercase ml-4 mb-1 font-black">Amount Sent (PKR)</p>
                    <input type="number" placeholder="Enter amount..." className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white text-xs outline-none focus:border-orange-500 transition-all" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />
                 </div>
                 
                 <div className="space-y-1">
                    <p className="text-[9px] text-slate-500 uppercase ml-4 mb-1 font-black">Payment Receipt</p>
                    <div className="w-full h-40 bg-black/40 border border-dashed border-white/10 rounded-[35px] flex flex-col items-center justify-center relative overflow-hidden cursor-pointer hover:border-orange-500 transition-all">
                       {depositSS ? (
                         <img src={depositSS} className="w-full h-full object-cover opacity-60" />
                       ) : (
                         <div className="text-center">
                            <i className="fa-solid fa-cloud-arrow-up text-3xl text-slate-700 mb-2"></i>
                            <p className="text-[8px] text-slate-500 uppercase font-black">Upload Screenshot</p>
                         </div>
                       )}
                       <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={handleFileUpload} />
                    </div>
                 </div>
              </div>

              <button onClick={handleDepositSubmit} className="w-full bg-orange-500 text-white font-black py-5 rounded-[30px] uppercase tracking-widest shadow-2xl shadow-orange-500/30 border-b-4 border-orange-800 active:scale-95 transition-all">Submit Payment Request</button>
           </div>
        </div>
      ) : screen === 'WITHDRAW' ? (
        <div className="p-8 animate-fadeIn">
           <div className="flex justify-between items-center mb-8">
              <h2 className="gaming-font text-xl font-black text-rose-500 uppercase">Withdrawal Hub</h2>
              <button onClick={() => setScreen('WALLET')} className="text-slate-500 text-[10px] font-black uppercase underline">Back</button>
           </div>
           
           <div className="bg-slate-900/60 p-8 rounded-[40px] border border-white/10 shadow-2xl space-y-6">
              <div className="bg-rose-500/5 p-6 rounded-3xl border border-rose-500/10 text-center">
                 <p className="text-slate-400 text-[8px] uppercase font-black mb-1">Available Credits</p>
                 <p className="text-4xl text-white font-black italic tracking-tighter">₹{user?.balance.toFixed(0)}</p>
              </div>

              <div className="space-y-4">
                 <div>
                    <p className="text-[8px] text-slate-500 uppercase ml-4 mb-1 font-black">Amount to Withdraw</p>
                    <input type="number" placeholder="Min ₹100" className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white text-xs outline-none" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} />
                 </div>
                 <div>
                    <p className="text-[8px] text-slate-500 uppercase ml-4 mb-1 font-black">Account Details</p>
                    <textarea placeholder="e.g. JazzCash 03XXXXXXXX - Full Name" className="w-full h-24 bg-black/40 border border-white/10 rounded-2xl p-4 text-white text-xs outline-none resize-none" value={withdrawDetails} onChange={e => setWithdrawDetails(e.target.value)}></textarea>
                 </div>
              </div>

              <button onClick={handleWithdrawSubmit} className="w-full bg-rose-500 text-white font-black py-5 rounded-[30px] uppercase tracking-widest shadow-xl shadow-rose-500/20 active:scale-95 transition-all">Request Payout</button>
           </div>
        </div>
      ) : screen === 'ADMIN' ? (
        <div className="min-h-screen flex flex-col animate-fadeIn">
           <div className="p-6 bg-slate-950 border-b border-white/5 flex justify-between items-center sticky top-0 z-50">
              <h2 className="gaming-font text-lg font-black text-cyan-400 uppercase tracking-tighter">Command Console</h2>
              <button onClick={() => setScreen('HOME')} className="bg-slate-800 px-4 py-2 rounded-xl text-[8px] font-black uppercase">Exit</button>
           </div>
           
           <div className="flex bg-slate-900/50 p-2 gap-2 mx-4 my-4 rounded-[28px] border border-white/5 overflow-x-auto no-scrollbar">
              {['DASHBOARD', 'USERS', 'MATCHES', 'REQUESTS'].map(tab => (
                <button key={tab} onClick={() => setAdminTab(tab as any)} className={`px-5 py-3 rounded-2xl text-[9px] font-black uppercase transition-all duration-300 flex-shrink-0 ${adminTab === tab ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/30' : 'text-slate-500'}`}>{tab}</button>
              ))}
           </div>

           <div className="flex-1 p-4 pb-32 overflow-y-auto">
              {adminTab === 'REQUESTS' && (
                <div className="space-y-4">
                   <div className="flex justify-between items-center px-4">
                      <h3 className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Pending Payouts & Deposits</h3>
                      <button onClick={openAdmin} className="text-cyan-500"><i className="fa-solid fa-rotate"></i></button>
                   </div>
                   <div className="space-y-3">
                      {adminTransactions.filter(t => t.status === 'PENDING').map(t => (
                        <div key={t.id} className="bg-slate-900/80 p-5 rounded-[35px] border border-white/10 flex justify-between items-center">
                           <div className="flex gap-4 items-center">
                              <div className={`w-10 h-10 ${t.type === 'DEPOSIT' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'} rounded-xl flex items-center justify-center`}>
                                 <i className={`fa-solid ${t.type === 'DEPOSIT' ? 'fa-arrow-down' : 'fa-arrow-up'}`}></i>
                              </div>
                              <div>
                                 <p className="text-white font-black text-xs uppercase">{t.username}</p>
                                 <p className="text-[9px] text-emerald-400 font-black italic">₹{t.amount}</p>
                              </div>
                           </div>
                           <button onClick={() => setViewingTx(t)} className="bg-cyan-500 text-black px-4 py-2 rounded-xl text-[8px] font-black uppercase shadow-lg shadow-cyan-500/10">VIEW</button>
                        </div>
                      ))}
                      {adminTransactions.filter(t => t.status === 'PENDING').length === 0 && (
                        <div className="text-center py-20 bg-slate-900/20 rounded-[40px] border border-dashed border-white/5">
                           <p className="text-slate-600 text-[10px] uppercase font-black tracking-widest italic">All caught up!</p>
                        </div>
                      )}
                   </div>
                </div>
              )}
              {adminTab === 'DASHBOARD' && (
                <div className="space-y-6">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-900 p-6 rounded-[35px] border border-white/10 shadow-xl">
                         <p className="text-[8px] text-slate-500 uppercase mb-1 font-black">Active Requests</p>
                         <p className="text-3xl font-black text-orange-500">{adminTransactions.filter(t => t.status === 'PENDING').length}</p>
                      </div>
                      <div className="bg-slate-900 p-6 rounded-[35px] border border-white/10 shadow-xl">
                         <p className="text-[8px] text-slate-500 uppercase mb-1 font-black">Total Users</p>
                         <p className="text-3xl font-black text-white">{adminUsers.length}</p>
                      </div>
                   </div>
                </div>
              )}
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
               <span className="text-white font-black text-xs">₹{user?.balance.toFixed(0)}</span>
            </div>
          </div>

          <div className="pb-32 p-5">
            {screen === 'WALLET' && (
              <div className="space-y-6 animate-fadeIn">
                 <button onClick={() => setScreen('HOME')} className="text-slate-500 text-[10px] font-black uppercase underline">Back Home</button>
                 <div className="bg-slate-950 p-12 rounded-[50px] border border-white/5 text-center shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 blur-3xl rounded-full"></div>
                    <p className="text-slate-500 text-[10px] uppercase mb-6 tracking-widest">Available Credits</p>
                    <h3 className="text-7xl font-black text-white mb-12 italic tracking-tighter">₹{user?.balance.toFixed(0)}</h3>
                    <div className="grid grid-cols-2 gap-4">
                       <button onClick={() => setScreen('DEPOSIT')} className="bg-orange-500 text-white font-black py-5 rounded-3xl uppercase tracking-widest shadow-xl shadow-orange-500/20 active:scale-95 transition-all">Deposit</button>
                       <button onClick={() => setScreen('WITHDRAW')} className="bg-slate-900 text-white font-black py-5 rounded-3xl border border-white/10 active:scale-95 transition-all">Withdraw</button>
                    </div>
                 </div>
                 
                 <div className="bg-slate-900/40 p-6 rounded-[35px] border border-white/5">
                    <p className="text-[8px] text-slate-600 uppercase font-black mb-4 tracking-widest text-center">Transaction Log</p>
                    <p className="text-[10px] text-slate-700 text-center uppercase italic font-black py-4">Request history is being synced...</p>
                 </div>
              </div>
            )}

            {screen === 'HOME' && (
               <div className="space-y-6">
                 <div className="bg-gradient-to-br from-indigo-950/80 to-slate-900 p-8 rounded-[40px] border border-white/10">
                    <h2 className="gaming-font text-white text-lg font-black uppercase tracking-tight">SOLDIER: {user?.username}</h2>
                    <div className="flex gap-4 mt-6">
                      <div className="bg-white/5 px-5 py-3 rounded-2xl border border-white/5 flex-1">
                        <p className="text-[7px] text-slate-500 font-black uppercase mb-1">Wins</p>
                        <p className="text-lg font-black text-emerald-400 italic">₹{user?.totalEarnings || 0}</p>
                      </div>
                      <div className="bg-white/5 px-5 py-3 rounded-2xl border border-white/5 flex-1">
                        <p className="text-[7px] text-slate-500 font-black uppercase mb-1">Matches</p>
                        <p className="text-lg font-black text-white italic">{user?.matchesPlayed || 0}</p>
                      </div>
                   </div>
                    {user?.role === 'admin' && (
                      <button onClick={() => setScreen('ADMIN')} className="mt-6 w-full bg-cyan-500 text-black py-4 rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3">
                        <i className="fa-solid fa-terminal"></i> COMMAND CONSOLE
                      </button>
                    )}
                 </div>
                 
                 <div className="flex justify-between items-center px-2">
                  <h3 className="gaming-font text-[10px] font-black tracking-widest text-slate-500 uppercase">Live Operations</h3>
                  <button onClick={loadData} className="text-orange-500"><i className="fa-solid fa-rotate-right"></i></button>
                </div>

                 {tournaments.map(match => (
                    <div key={match.id} className="bg-slate-900/40 border border-white/5 rounded-[40px] p-6 shadow-xl mb-4">
                       <div className="flex justify-between items-start mb-4">
                          <h4 className="gaming-font text-white font-black text-sm uppercase">{match.title}</h4>
                          <span className="text-emerald-400 font-black italic">₹{match.prizePool}</span>
                       </div>
                       <div className="flex justify-between text-[10px] uppercase font-black text-slate-500">
                          <span>{match.map} • {match.type}</span>
                          <span className="text-orange-500">{match.startTime}</span>
                       </div>
                    </div>
                 ))}
               </div>
            )}
            
            {screen === 'AUTH' && (
               <div className="min-h-[80vh] flex flex-col justify-center p-8">
                  <div className="text-center mb-12">
                     <div className="w-20 h-20 bg-orange-500 rounded-3xl mx-auto flex items-center justify-center text-white text-4xl mb-4 shadow-xl shadow-orange-500/20 italic font-black">FF</div>
                     <h1 className="gaming-font text-3xl font-black text-white uppercase italic">Battle Hub</h1>
                     <p className="text-slate-500 text-[10px] uppercase tracking-[0.3em] mt-2">Elite Tournament Portal</p>
                  </div>
                  <form onSubmit={handleAuthAction} className="space-y-4">
                     {authError && <p className="text-rose-500 text-[10px] font-black uppercase text-center bg-rose-500/10 p-3 rounded-xl">{authError}</p>}
                     <input type="email" placeholder="Email Address" className="w-full bg-slate-900 border border-white/5 rounded-2xl py-5 px-6 text-white text-sm outline-none focus:border-orange-500 transition-all" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                     <input type="password" placeholder="Account Password" className="w-full bg-slate-900 border border-white/5 rounded-2xl py-5 px-6 text-white text-sm outline-none focus:border-orange-500 transition-all" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                     <button type="submit" className="w-full bg-orange-500 py-5 rounded-2xl font-black uppercase tracking-widest text-white shadow-xl shadow-orange-500/20 active:scale-95 transition-all">Initialize Login</button>
                  </form>
                  <button onClick={() => setScreen('SIGNUP')} className="mt-8 text-slate-500 text-[10px] font-black uppercase tracking-widest text-center w-full underline">Create New Warrior Account</button>
                  <button onClick={() => setScreen('ADMIN_AUTH')} className="mt-4 text-slate-700 text-[8px] font-black uppercase tracking-widest text-center w-full">Admin Secure Login</button>
               </div>
            )}

            {screen === 'SIGNUP' && (
               <div className="min-h-[80vh] flex flex-col justify-center p-8">
                  <div className="text-center mb-10">
                     <h1 className="gaming-font text-2xl font-black text-white uppercase">New Recruit</h1>
                  </div>
                  <form onSubmit={handleAuthAction} className="space-y-4">
                     <input type="text" placeholder="Gamer Username" className="w-full bg-slate-900 border border-white/5 rounded-2xl py-5 px-6 text-white text-sm outline-none focus:border-orange-500" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
                     <input type="email" placeholder="Email Address" className="w-full bg-slate-900 border border-white/5 rounded-2xl py-5 px-6 text-white text-sm outline-none focus:border-orange-500" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                     <input type="password" placeholder="Create Password" className="w-full bg-slate-900 border border-white/5 rounded-2xl py-5 px-6 text-white text-sm outline-none focus:border-orange-500" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                     <button type="submit" className="w-full bg-emerald-500 py-5 rounded-2xl font-black uppercase tracking-widest text-black shadow-xl shadow-emerald-500/20 active:scale-95">Register Soldier</button>
                  </form>
                  <button onClick={() => setScreen('AUTH')} className="mt-8 text-slate-500 text-[10px] font-black uppercase text-center w-full underline">Existing Account? Login</button>
               </div>
            )}
            
            {screen === 'ADMIN_AUTH' && (
              <div className="min-h-[80vh] flex flex-col justify-center p-8">
                <div className="text-center mb-10">
                   <div className="w-16 h-16 bg-cyan-500 rounded-2xl mx-auto flex items-center justify-center text-black text-3xl mb-4 shadow-xl shadow-cyan-500/20"><i className="fa-solid fa-shield-halved"></i></div>
                   <h1 className="gaming-font text-xl font-black text-white uppercase italic">Security Clearance</h1>
                </div>
                <form onSubmit={(e) => handleAuthAction(e, true)} className="space-y-4">
                  <input type="email" placeholder="Admin Email" className="w-full bg-slate-900 border border-cyan-500/20 rounded-2xl py-5 px-6 text-white text-sm" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                  <input type="password" placeholder="Admin Password" className="w-full bg-slate-900 border border-cyan-500/20 rounded-2xl py-5 px-6 text-white text-sm" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                  <button type="submit" className="w-full bg-cyan-500 py-5 rounded-2xl font-black uppercase tracking-widest text-black shadow-xl shadow-cyan-500/20">Access Console</button>
                </form>
                <button onClick={() => setScreen('AUTH')} className="mt-8 text-slate-500 text-[10px] font-black uppercase text-center w-full underline">Back to Lobby</button>
              </div>
            )}
          </div>

          <nav className="fixed bottom-8 left-6 right-6 max-w-[calc(28rem-3rem)] mx-auto bg-slate-950/90 backdrop-blur-3xl border border-white/10 p-5 rounded-[40px] flex justify-around items-center z-50 shadow-2xl">
            {[
              { s: 'HOME', i: 'fa-gamepad' },
              { s: 'LEADERBOARD', i: 'fa-ranking-star' },
              { s: 'WALLET', i: 'fa-indian-rupee-sign' },
              { s: 'PROFILE', i: 'fa-user' }
            ].map(item => (
              <button key={item.s} onClick={() => setScreen(item.s as Screen)} className={`p-4 rounded-2xl transition-all duration-300 ${screen === item.s ? 'bg-orange-500 text-white scale-110 shadow-lg shadow-orange-500/20' : 'text-slate-600 hover:text-slate-400'}`}>
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