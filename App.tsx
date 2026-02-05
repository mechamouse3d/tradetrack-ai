import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, StockSummary, PortfolioStats } from './types';
import StatsCards from './components/StatsCards';
import TransactionForm from './components/TransactionForm';
import PortfolioTable from './components/PortfolioTable';
import FileImportModal from './components/FileImportModal';
import LoginModal from './components/LoginModal';
import UserMenu from './components/UserMenu';
import DataManagementModal from './components/DataManagementModal';
import { useAuth } from './contexts/AuthContext';
import { fetchCurrentPrices } from './services/geminiService';
import { PieChart as RechartsPieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Plus, Database, TrendingUp, Upload, Loader2, ArrowRight, Sparkles, RefreshCw, ExternalLink, ShieldCheck, Cloud, CloudOff, Clock, HardDrive, PieChart as PieChartIcon, AlertCircle } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

const App: React.FC = () => {
  const { user, isLoading: isAuthLoading } = useAuth();
  
  // State for data
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentPrices, setCurrentPrices] = useState<Record<string, number>>({});
  const [priceSources, setPriceSources] = useState<any[]>([]);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isRefreshingPrices, setIsRefreshingPrices] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // State for UI
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isDataMgmtOpen, setIsDataMgmtOpen] = useState(false);

  // 1. User-Specific Data Loading
  useEffect(() => {
    if (isAuthLoading) return;
    setIsDataLoaded(false);

    if (!user) {
      if (!isGuestMode) {
        setTransactions([]);
        setCurrentPrices({});
        setPriceSources([]);
      }
      setIsDataLoaded(true);
      return;
    }

    const txKey = `transactions_${user.id}`;
    const pricesKey = `prices_${user.id}`;
    const savedTx = localStorage.getItem(txKey);
    const savedPrices = localStorage.getItem(pricesKey);

    if (savedTx) setTransactions(JSON.parse(savedTx));
    else setTransactions([]);

    if (savedPrices) setCurrentPrices(JSON.parse(savedPrices));
    
    setIsDataLoaded(true);
  }, [user, isAuthLoading, isGuestMode]);

  // 2. Dynamic Price Fetching
  const portfolioSymbols = useMemo(() => {
    const symbols = new Set(transactions.map(t => t.symbol.toUpperCase().trim()));
    return Array.from(symbols);
  }, [transactions]);

  const updateMarketPrices = async (symbolsToFetch: string[]) => {
    if (symbolsToFetch.length === 0) return;
    setIsRefreshingPrices(true);
    setPriceError(null);
    try {
      const { prices, sources } = await fetchCurrentPrices(symbolsToFetch);
      setCurrentPrices(prev => ({ ...prev, ...prices }));
      setPriceSources(sources);
    } catch (err: any) {
      console.error("Failed to fetch market data", err);
      const msg = err?.message || "";
      if (msg.includes("429")) {
        setPriceError("Rate limit hit. Prices will retry shortly.");
      } else {
        setPriceError("Market data unavailable.");
      }
    } finally {
      setIsRefreshingPrices(false);
    }
  };

  useEffect(() => {
    if (isDataLoaded && portfolioSymbols.length > 0) {
      const missingPrices = portfolioSymbols.filter(s => currentPrices[s] === undefined);
      if (missingPrices.length > 0) {
        updateMarketPrices(portfolioSymbols);
      }
    }
  }, [portfolioSymbols, isDataLoaded]);

  // 3. User-Specific Auto-Save
  useEffect(() => {
    if (!isDataLoaded || isAuthLoading || !user) return;
    const txKey = `transactions_${user.id}`;
    const pricesKey = `prices_${user.id}`;
    localStorage.setItem(txKey, JSON.stringify(transactions));
    localStorage.setItem(pricesKey, JSON.stringify(currentPrices));
    setLastSaved(new Date());
  }, [transactions, currentPrices, user, isDataLoaded, isAuthLoading]);

  const handleSaveTransaction = (transactionData: Transaction | Omit<Transaction, 'id'>) => {
    const normalizedData = {
        ...transactionData,
        symbol: transactionData.symbol.toUpperCase().trim(),
        type: transactionData.type.toString().toUpperCase().trim() as 'BUY' | 'SELL'
    };

    if ('id' in normalizedData) {
      setTransactions(prev => prev.map(t => t.id === normalizedData.id ? normalizedData as Transaction : t));
    } else {
      const newTransaction = { ...normalizedData, id: Math.random().toString(36).substr(2, 9) };
      setTransactions(prev => [...prev, newTransaction]);
    }
    setIsFormOpen(false);
    setEditingTransaction(null);
  };

  const clearUserCache = () => {
    if (!user) return;
    const txKey = `transactions_${user.id}`;
    const pricesKey = `prices_${user.id}`;
    localStorage.removeItem(txKey);
    localStorage.removeItem(pricesKey);
    setTransactions([]);
    setCurrentPrices({});
    setIsDataMgmtOpen(false);
  };

  const exportUserData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(transactions, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `tradetrack_export_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setIsFormOpen(true);
  };

  const openAddTransaction = () => {
    setEditingTransaction(null);
    setIsFormOpen(true);
  };

  const handleBulkImport = (newTransactions: Omit<Transaction, 'id'>[]) => {
      const transactionsWithIds = newTransactions.map(t => {
          const rawType = t.type ? t.type.toString().toUpperCase() : 'BUY';
          const normalizedType = rawType.includes('SELL') || rawType.includes('SOLD') ? 'SELL' : 'BUY';
          return {
            ...t,
            type: normalizedType as 'BUY' | 'SELL',
            symbol: t.symbol.toUpperCase().trim(),
            id: Math.random().toString(36).substr(2, 9)
          };
      });
      setTransactions(prev => [...prev, ...transactionsWithIds]);
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const { portfolio, stats } = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    transactions.forEach(t => {
      const symbolKey = t.symbol.toUpperCase().trim();
      if (!groups[symbolKey]) groups[symbolKey] = [];
      groups[symbolKey].push(t);
    });

    const stockSummaries: StockSummary[] = [];
    let totalRealizedPL = 0;
    let totalCostBasis = 0;
    let totalValue = 0;
    let totalUnrealizedPL = 0;

    Object.entries(groups).forEach(([symbol, txs]) => {
      txs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      let sharesHeld = 0;
      let totalCost = 0;
      let realizedPL = 0;

      txs.forEach(t => {
        const shares = Number(t.shares);
        const price = Number(t.price);
        const type = (t.type || '').toString().toUpperCase().trim();
        if (isNaN(shares) || isNaN(price)) return;
        if (type === 'BUY') {
          sharesHeld += shares;
          totalCost += shares * price;
        } else if (type === 'SELL') {
          const avgCostPerShare = sharesHeld > 0 ? totalCost / sharesHeld : 0;
          const costOfSoldShares = shares * avgCostPerShare;
          realizedPL += (shares * price - costOfSoldShares);
          sharesHeld -= shares;
          totalCost -= costOfSoldShares;
        }
      });

      if (sharesHeld < 0.000001) { sharesHeld = 0; totalCost = 0; }
      const avgCost = sharesHeld > 0 ? totalCost / sharesHeld : 0;
      const currentPrice = currentPrices[symbol] || null;
      totalRealizedPL += realizedPL;
      totalCostBasis += totalCost;
      
      if (currentPrice !== null && sharesHeld > 0) {
          const marketVal = sharesHeld * currentPrice;
          totalValue += marketVal;
          totalUnrealizedPL += (marketVal - totalCost);
      } else {
           totalValue += totalCost;
      }

      stockSummaries.push({
        symbol,
        name: txs[0]?.name || symbol,
        totalShares: sharesHeld,
        avgCost: avgCost,
        currentPrice: currentPrice,
        totalInvested: totalCost,
        realizedPL: realizedPL,
        transactions: txs
      });
    });

    stockSummaries.sort((a, b) => a.name.localeCompare(b.name));
    return {
      portfolio: stockSummaries,
      stats: { totalValue, totalCostBasis, totalRealizedPL, totalUnrealizedPL }
    };
  }, [transactions, currentPrices]);

  const allocationData = portfolio
    .filter(s => s.totalShares > 0 && s.currentPrice)
    .map(s => ({
      name: s.symbol,
      value: (s.currentPrice || 0) * s.totalShares
    }));

  if (isAuthLoading) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50">
              <div className="flex flex-col items-center gap-2">
                  <Loader2 className="animate-spin text-indigo-600" size={32} />
                  <p className="text-slate-500 font-medium">Authenticating Portfolio...</p>
              </div>
          </div>
      );
  }

  if (!user && !isGuestMode) {
    return (
      <div className="min-h-screen bg-[#FDFDFF]">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-50/50 rounded-full blur-3xl -z-10 -translate-y-1/2 translate-x-1/2" />
        <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between relative">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-200"><TrendingUp size={24} /></div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">TradeTrack AI</h1>
          </div>
          <button onClick={() => setIsLoginOpen(true)} className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold transition-all shadow-xl shadow-slate-200">Sign In</button>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-32 relative text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-sm font-bold border border-indigo-100/50 shadow-sm mb-10"><Sparkles size={16} /> Powered by Gemini Flash 3</div>
            <h2 className="text-5xl lg:text-7xl font-extrabold text-slate-900 leading-[1.1] tracking-tight mb-8">Your portfolio, <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500">smarter than ever.</span></h2>
            <p className="text-xl text-slate-600 leading-relaxed mx-auto max-w-2xl mb-12">Securely track trades across any exchange, calculate FIFO P/L instantly, and persist data to your private account.</p>
            <div className="flex flex-wrap justify-center gap-5">
              <button onClick={() => setIsLoginOpen(true)} className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-lg transition-all shadow-2xl shadow-indigo-200 flex items-center gap-2">Get Started Free <ArrowRight size={20} /></button>
              <button onClick={() => setIsGuestMode(true)} className="px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-2xl font-bold text-lg transition-all shadow-sm">Try Live Demo</button>
            </div>
        </main>
        {isLoginOpen && <LoginModal onClose={() => setIsLoginOpen(false)} />}
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 bg-slate-50">
      {isGuestMode && !user && (
        <div className="bg-slate-800 text-white px-4 py-2.5 text-center text-xs font-bold flex items-center justify-center gap-4 sticky top-0 z-40">
          <CloudOff size={14} className="text-amber-400" />
          <span>DEMO MODE: No data is being saved to an account.</span>
          <button onClick={() => setIsGuestMode(false)} className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition-colors">Sign In to Save</button>
        </div>
      )}

      <header className={`bg-white border-b border-slate-200 sticky z-30 ${isGuestMode && !user ? 'top-10' : 'top-0'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 p-2 rounded-lg text-white"><TrendingUp size={24} /></div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">TradeTrack AI</h1>
            </div>
            
            {user && (
              <div className="hidden lg:flex items-center gap-3 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full">
                <div className="flex items-center gap-1.5 text-emerald-600">
                  <Cloud size={14} />
                  <span className="text-[10px] font-black uppercase tracking-wider">Sync Active</span>
                </div>
                <div className="w-px h-3 bg-slate-200"></div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Clock size={12} />
                  <span className="text-[10px] font-medium">
                    {lastSaved ? `Saved ${lastSaved.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : 'Saving...'}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
              <div className="flex flex-col items-end mr-2">
                {priceError && <span className="text-[9px] text-rose-500 font-bold uppercase animate-pulse">{priceError}</span>}
                <button onClick={() => updateMarketPrices(portfolioSymbols)} disabled={isRefreshingPrices} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors" title="Refresh Live Prices">
                   <RefreshCw size={18} className={isRefreshingPrices ? 'animate-spin' : ''} />
                </button>
              </div>
              <button onClick={() => setIsImportOpen(true)} className="hidden md:flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3.5 py-2 rounded-xl font-medium transition-colors text-sm">
                <Upload size={16} /> Import
              </button>
              <button onClick={openAddTransaction} className="hidden md:flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl font-medium transition-colors text-sm shadow-md">
                <Plus size={16} /> Transaction
              </button>
              <div className="w-px h-6 bg-slate-200 mx-1 hidden md:block"></div>
              <UserMenu onLoginClick={() => setIsLoginOpen(true)} onManageDataClick={() => setIsDataMgmtOpen(true)} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <StatsCards stats={stats} />

        <div className="w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Database size={20} className="text-indigo-500" /> Current Holdings</h2>
              <div className="flex items-center gap-4">
                {priceSources.length > 0 && (
                  <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400">
                    <span className="font-bold uppercase">Sources:</span>
                    <div className="flex gap-2">
                      {priceSources.slice(0, 2).map((chunk, i) => (
                        <a key={i} href={chunk.web?.uri} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-500 flex items-center gap-1"><ExternalLink size={10} /> {i+1}</a>
                      ))}
                    </div>
                  </div>
                )}
                <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg font-bold uppercase tracking-tight flex items-center gap-1">
                  <ShieldCheck size={12} /> User-Encrypted Cache
                </span>
              </div>
            </div>
            <PortfolioTable portfolio={portfolio} onDelete={deleteTransaction} onEdit={handleEditTransaction} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="text-slate-800 text-sm font-bold flex items-center gap-2 mb-6"><PieChartIcon size={18} className="text-indigo-500" /> Portfolio Allocation</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    <div className="h-64 w-full">
                        {allocationData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <RechartsPieChart>
                                <Pie data={allocationData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={8} dataKey="value" stroke="none">
                                    {allocationData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                                <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                </RechartsPieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400 text-sm italic border-2 border-dashed border-slate-100 rounded-2xl">No active holdings.</div>
                        )}
                    </div>
                    <div className="space-y-3">
                        {allocationData.map((entry, index) => (
                            <div key={entry.name} className="flex items-center justify-between text-sm p-2 hover:bg-slate-50 rounded-lg transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                    <span className="text-slate-700 font-bold">{entry.name}</span>
                                </div>
                                <div className="text-right">
                                    <div className="text-slate-900 font-medium">${entry.value.toLocaleString()}</div>
                                    <div className="text-[10px] text-slate-400 font-bold">{((entry.value / stats.totalValue) * 100).toFixed(1)}%</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div className="bg-indigo-600 p-8 rounded-2xl text-white shadow-xl flex flex-col justify-between h-full relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><HardDrive size={120} /></div>
                <div>
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-6"><ShieldCheck size={24} /></div>
                    <h4 className="text-2xl font-bold mb-4">Secure Cache</h4>
                    <p className="text-indigo-100 text-sm leading-relaxed mb-6">Your data is stored locally but tied to your unique Auth0 account. You can export or clear your private cache at any time.</p>
                </div>
                <div className="flex flex-col gap-3">
                    <button onClick={openAddTransaction} className="w-full py-4 bg-white text-indigo-600 rounded-xl font-bold hover:bg-indigo-50 transition-colors shadow-lg flex items-center justify-center gap-2"><Plus size={20} /> New Transaction</button>
                    <button onClick={() => setIsDataMgmtOpen(true)} className="w-full py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2">Manage Local Storage</button>
                </div>
            </div>
        </div>
      </main>

      {isFormOpen && <TransactionForm onSave={handleSaveTransaction} onClose={() => setIsFormOpen(false)} initialData={editingTransaction || undefined} />}
      {isImportOpen && <FileImportModal onImport={handleBulkImport} onClose={() => setIsImportOpen(false)} />}
      {isLoginOpen && <LoginModal onClose={() => setIsLoginOpen(false)} />}
      {isDataMgmtOpen && <DataManagementModal transactionsCount={transactions.length} onClearCache={clearUserCache} onExport={exportUserData} onClose={() => setIsDataMgmtOpen(false)} />}
    </div>
  );
};

export default App;