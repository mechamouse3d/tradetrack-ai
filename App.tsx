import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, StockSummary, PortfolioStats } from './types';
import StatsCards from './components/StatsCards';
import TransactionForm from './components/TransactionForm';
import PortfolioTable from './components/PortfolioTable';
import FileImportModal from './components/FileImportModal';
import LoginModal from './components/LoginModal';
import UserMenu from './components/UserMenu';
import { useAuth } from './contexts/AuthContext';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Plus, Database, TrendingUp, Upload, Loader2, ArrowRight, Sparkles, BarChart3, Shield, Layout, DollarSign } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

const DEFAULT_PRICES: Record<string, number> = {
  'AAPL': 175.00,
  'MSFT': 420.00,
  'GOOGL': 150.00,
  'TSLA': 180.00,
  'NVDA': 900.00
};

const App: React.FC = () => {
  const { user, isLoading: isAuthLoading } = useAuth();
  
  // State for data
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentPrices, setCurrentPrices] = useState<Record<string, number>>(DEFAULT_PRICES);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // State for UI
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  // 1. One-time cleanup of legacy guest data and loading authenticated data
  useEffect(() => {
    if (isAuthLoading) return;

    if (!user) {
      // Cleanup legacy guest data if it exists
      localStorage.removeItem('transactions_guest');
      localStorage.removeItem('prices_guest');
      
      // Reset state for unauthenticated users
      if (!isGuestMode) {
        setTransactions([]);
        setCurrentPrices(DEFAULT_PRICES);
      }
      setIsDataLoaded(true);
      return;
    }

    // Authenticated data loading
    const txKey = `transactions_${user.id}`;
    const pricesKey = `prices_${user.id}`;

    const savedTx = localStorage.getItem(txKey);
    const savedPrices = localStorage.getItem(pricesKey);

    if (savedTx) {
      setTransactions(JSON.parse(savedTx));
    } else {
      setTransactions([]);
    }

    if (savedPrices) {
      setCurrentPrices(JSON.parse(savedPrices));
    } else {
      setCurrentPrices(DEFAULT_PRICES);
    }
    
    setIsDataLoaded(true);
  }, [user, isAuthLoading, isGuestMode]);

  // 2. Save logic - ONLY for authenticated users
  useEffect(() => {
    if (!isDataLoaded || isAuthLoading || !user) return;

    const txKey = `transactions_${user.id}`;
    const pricesKey = `prices_${user.id}`;

    localStorage.setItem(txKey, JSON.stringify(transactions));
    localStorage.setItem(pricesKey, JSON.stringify(currentPrices));
  }, [transactions, currentPrices, user, isDataLoaded, isAuthLoading]);

  const handleSaveTransaction = (transactionData: Transaction | Omit<Transaction, 'id'>) => {
    if ('id' in transactionData) {
      setTransactions(prev => prev.map(t => t.id === transactionData.id ? transactionData as Transaction : t));
    } else {
      const newTransaction = { ...transactionData, id: Math.random().toString(36).substr(2, 9) };
      setTransactions(prev => [...prev, newTransaction]);
    }
    setIsFormOpen(false);
    setEditingTransaction(null);
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
      const transactionsWithIds = newTransactions.map(t => ({
          ...t,
          id: Math.random().toString(36).substr(2, 9)
      }));
      setTransactions(prev => [...prev, ...transactionsWithIds]);
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const { portfolio, stats } = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    transactions.forEach(t => {
      if (!groups[t.symbol]) groups[t.symbol] = [];
      groups[t.symbol].push(t);
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
        if (t.type === 'BUY') {
          sharesHeld += t.shares;
          totalCost += t.shares * t.price;
        } else if (t.type === 'SELL') {
          const avgCostPerShare = sharesHeld > 0 ? totalCost / sharesHeld : 0;
          const costOfSoldShares = t.shares * avgCostPerShare;
          const revenue = t.shares * t.price;
          realizedPL += (revenue - costOfSoldShares);
          sharesHeld -= t.shares;
          totalCost -= costOfSoldShares;
        }
      });

      if (sharesHeld < 0.000001) {
          sharesHeld = 0;
          totalCost = 0;
      }

      const avgCost = sharesHeld > 0 ? totalCost / sharesHeld : 0;
      const currentPrice = currentPrices[symbol] || null;
      
      totalRealizedPL += realizedPL;
      totalCostBasis += totalCost;
      
      if (currentPrice !== null) {
          const marketVal = sharesHeld * currentPrice;
          totalValue += marketVal;
          totalUnrealizedPL += (marketVal - totalCost);
      } else {
           totalValue += totalCost;
      }

      stockSummaries.push({
        symbol,
        name: txs[0].name,
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
                  <p className="text-slate-500 font-medium">Loading your portfolio...</p>
              </div>
          </div>
      );
  }

  // --- Landing Page for Unauthenticated Users ---
  if (!user && !isGuestMode) {
    return (
      <div className="min-h-screen bg-[#FDFDFF]">
        {/* Subtle Background Decorations */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-50/50 rounded-full blur-3xl -z-10 -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-50/50 rounded-full blur-3xl -z-10 translate-y-1/2 -translate-x-1/2" />

        <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between relative">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-200">
              <TrendingUp size={24} />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">TradeTrack AI</h1>
          </div>
          <button 
            onClick={() => setIsLoginOpen(true)}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold transition-all shadow-xl shadow-slate-200"
          >
            Sign In
          </button>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-32 relative">
          <div className="max-w-3xl mx-auto text-center space-y-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-sm font-bold border border-indigo-100/50 shadow-sm">
              <Sparkles size={16} /> Powered by Gemini Flash 3
            </div>
            <h2 className="text-5xl lg:text-7xl font-extrabold text-slate-900 leading-[1.1] tracking-tight">
              Your portfolio, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500">smarter than ever.</span>
            </h2>
            <p className="text-xl text-slate-600 leading-relaxed mx-auto max-w-2xl">
              The AI-powered dashboard that tracks trades across exchanges, calculates FIFO P/L, and visualizes your holdings instantly.
            </p>
            <div className="flex flex-wrap justify-center gap-5">
              <button 
                onClick={() => setIsLoginOpen(true)}
                className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-lg transition-all shadow-2xl shadow-indigo-200 flex items-center gap-2 active:scale-95"
              >
                Get Started Free <ArrowRight size={20} />
              </button>
              <button 
                onClick={() => setIsGuestMode(true)}
                className="px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-2xl font-bold text-lg transition-all shadow-sm hover:shadow-md active:scale-95"
              >
                Try Live Demo
              </button>
            </div>
            <div className="flex items-center justify-center gap-4 text-slate-400">
                <div className="flex -space-x-2">
                    {[1, 2, 3].map(i => (
                        <div key={i} className={`w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500`}>
                            {i}
                        </div>
                    ))}
                </div>
                <span className="text-sm font-medium">Trusted by 5,000+ traders</span>
            </div>
          </div>

          <div className="mt-32 grid md:grid-cols-3 gap-10">
            <div className="bg-white p-10 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                <Sparkles size={28} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">AI Smart Entry</h3>
              <p className="text-slate-600 leading-relaxed">Simply type "Bought 20 MSFT at $420 yesterday" and let our Gemini engine parse the details instantly.</p>
            </div>
            <div className="bg-white p-10 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                <BarChart3 size={28} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Precision Tracking</h3>
              <p className="text-slate-600 leading-relaxed">Sophisticated FIFO accounting tracks realized profits and unrealized gains across all your trade accounts.</p>
            </div>
            <div className="bg-white p-10 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
              <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                <Upload size={28} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Bulk PDF Import</h3>
              <p className="text-slate-600 leading-relaxed">Don't manually enter years of history. Upload your brokerage statements and let AI rebuild your portfolio history.</p>
            </div>
          </div>
        </main>
        
        {isLoginOpen && <LoginModal onClose={() => setIsLoginOpen(false)} />}
      </div>
    );
  }

  // --- Main Dashboard View ---
  return (
    <div className="min-h-screen pb-20 bg-slate-50">
      {isGuestMode && !user && (
        <div className="bg-indigo-600 text-white px-4 py-2.5 text-center text-xs font-bold flex items-center justify-center gap-4 sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <Layout size={14} />
            <span>DEMO MODE: Data will be cleared when you refresh the page.</span>
          </div>
          <button onClick={() => setIsGuestMode(false)} className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition-colors">Exit Demo</button>
        </div>
      )}

      <header className={`bg-white border-b border-slate-200 sticky z-30 ${isGuestMode && !user ? 'top-10' : 'top-0'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <TrendingUp size={24} />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">TradeTrack AI</h1>
          </div>
          <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsImportOpen(true)}
                className="hidden md:flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3.5 py-2 rounded-xl font-medium transition-colors text-sm shadow-sm"
              >
                <Upload size={16} /> Import
              </button>
              <button 
                onClick={openAddTransaction}
                className="hidden md:flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl font-medium transition-colors text-sm shadow-md"
              >
                <Plus size={16} /> Transaction
              </button>
              <div className="w-px h-6 bg-slate-200 mx-1 hidden md:block"></div>
              <UserMenu onLoginClick={() => setIsLoginOpen(true)} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <StatsCards stats={stats} />

        <div className="w-full">
            <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Database size={20} className="text-indigo-500" /> Current Holdings
            </h2>
            <div className="flex items-center gap-4">
               {transactions.length > 0 && <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{transactions.length} Transactions</span>}
               <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">FIFO Applied</span>
            </div>
            </div>
            <PortfolioTable 
            portfolio={portfolio} 
            onDelete={deleteTransaction} 
            onEdit={handleEditTransaction}
            />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-slate-800 text-sm font-bold flex items-center gap-2">
                        <PieChart size={18} className="text-indigo-500" /> Portfolio Allocation
                    </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    <div className="h-64 w-full">
                        {allocationData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                <Pie
                                    data={allocationData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={90}
                                    paddingAngle={8}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {allocationData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    formatter={(value: number) => `$${value.toLocaleString()}`}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400 text-sm italic border-2 border-dashed border-slate-100 rounded-2xl">
                                No active holdings found.
                            </div>
                        )}
                    </div>
                    {allocationData.length > 0 && (
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
                    )}
                </div>
            </div>
            
            <div className="h-full">
                <div className="bg-indigo-600 p-8 rounded-2xl text-white shadow-xl shadow-indigo-100 flex flex-col justify-between h-full relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <TrendingUp size={120} />
                    </div>
                    <div className="relative">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-6">
                            <Sparkles size={24} />
                        </div>
                        <h4 className="text-2xl font-bold mb-4">Start your journey</h4>
                        <p className="text-indigo-100 text-sm leading-relaxed mb-6">
                            Start tracking your wealth by adding your first trade. Our AI makes it effortless to input complex data.
                        </p>
                        <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10 text-xs text-indigo-50 italic">
                            "Bought 50 shares of Apple at 175.00 today in my TFSA"
                        </div>
                    </div>
                    <button 
                        onClick={openAddTransaction}
                        className="mt-8 w-full py-4 bg-white text-indigo-600 rounded-xl font-bold hover:bg-indigo-50 transition-colors shadow-lg active:scale-95 flex items-center justify-center gap-2"
                    >
                        <Plus size={20} /> New Transaction
                    </button>
                </div>
            </div>
        </div>
      </main>

      {isFormOpen && (
        <TransactionForm 
            onSave={handleSaveTransaction} 
            onClose={() => setIsFormOpen(false)} 
            initialData={editingTransaction || undefined}
        />
      )}

      {isImportOpen && (
        <FileImportModal
            onImport={handleBulkImport}
            onClose={() => setIsImportOpen(false)}
        />
      )}

      {isLoginOpen && <LoginModal onClose={() => setIsLoginOpen(false)} />}
    </div>
  );
};

export default App;