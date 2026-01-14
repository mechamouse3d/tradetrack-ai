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
import { Plus, Database, TrendingUp, Upload, Loader2 } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

// Initial dummy data to populate the view immediately for the guest user
const INITIAL_TRANSACTIONS: Transaction[] = [
  { id: '1', date: '2025-05-31', type: 'BUY', account: 'TFSA', exchange: 'NASDAQ', symbol: 'OKTA', name: 'Okta Inc', shares: 60, price: 90.5, currency: 'USD' },
  { id: '2', date: '2025-08-30', type: 'BUY', account: 'TFSA', exchange: 'NASDAQ', symbol: 'OKTA', name: 'Okta Inc', shares: 15, price: 79.69, currency: 'USD' },
  { id: '3', date: '2025-01-28', type: 'BUY', account: 'TFSA', exchange: 'NASDAQ', symbol: 'NVDA', name: 'Nvidia Corp', shares: 100, price: 117.88, currency: 'USD' },
  { id: '4', date: '2025-02-15', type: 'BUY', account: 'RRSP', exchange: 'NASDAQ', symbol: 'NVDA', name: 'Nvidia Corp', shares: 40, price: 181.58, currency: 'USD' },
  { id: '5', date: '2025-06-27', type: 'BUY', account: 'RRSP', exchange: 'NASDAQ', symbol: 'GTLB', name: 'Gitlab Inc', shares: 200, price: 44.72, currency: 'USD' },
  { id: '6', date: '2025-12-03', type: 'SELL', account: 'RRSP', exchange: 'NASDAQ', symbol: 'OKTA', name: 'Okta Inc', shares: 20, price: 105.00, currency: 'USD' },
];

const INITIAL_PRICES: Record<string, number> = {
  'OKTA': 94.07,
  'NVDA': 185.81,
  'GTLB': 35.85,
  'SMCI': 28.60,
  'META': 631.09
};

const App: React.FC = () => {
  const { user, isLoading: isAuthLoading } = useAuth();
  
  // State for data
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentPrices, setCurrentPrices] = useState<Record<string, number>>(INITIAL_PRICES);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // State for UI
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  // Load data based on user session
  useEffect(() => {
    if (isAuthLoading) return;

    const txKey = user ? `transactions_${user.id}` : 'transactions_guest';
    const pricesKey = user ? `prices_${user.id}` : 'prices_guest';

    const savedTx = localStorage.getItem(txKey);
    const savedPrices = localStorage.getItem(pricesKey);

    if (savedTx) {
      setTransactions(JSON.parse(savedTx));
    } else {
      // If guest, show initial data. If user (new), show empty.
      setTransactions(user ? [] : INITIAL_TRANSACTIONS);
    }

    if (savedPrices) {
      setCurrentPrices(JSON.parse(savedPrices));
    } else {
      setCurrentPrices(INITIAL_PRICES);
    }
    
    setIsDataLoaded(true);
  }, [user, isAuthLoading]);

  // Save data whenever it changes (only if loaded)
  useEffect(() => {
    if (!isDataLoaded || isAuthLoading) return;

    const txKey = user ? `transactions_${user.id}` : 'transactions_guest';
    const pricesKey = user ? `prices_${user.id}` : 'prices_guest';

    localStorage.setItem(txKey, JSON.stringify(transactions));
    localStorage.setItem(pricesKey, JSON.stringify(currentPrices));
  }, [transactions, currentPrices, user, isDataLoaded, isAuthLoading]);

  const handleSaveTransaction = (transactionData: Transaction | Omit<Transaction, 'id'>) => {
    if ('id' in transactionData) {
      // Editing existing transaction
      setTransactions(prev => prev.map(t => t.id === transactionData.id ? transactionData as Transaction : t));
    } else {
      // Adding new transaction
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

  const updatePrice = (symbol: string, price: number) => {
    setCurrentPrices(prev => ({ ...prev, [symbol]: price }));
  };

  // --- Logic to Process Data ---
  const { portfolio, stats } = useMemo(() => {
    // 1. Group by Symbol
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

    // 2. Calculate Stats per Stock
    Object.entries(groups).forEach(([symbol, txs]) => {
      // Sort transactions by date
      txs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      let sharesHeld = 0;
      let totalCost = 0;
      let realizedPL = 0;

      txs.forEach(t => {
        if (t.type === 'BUY') {
          sharesHeld += t.shares;
          totalCost += t.shares * t.price;
        } else if (t.type === 'SELL') {
          // Calculate average cost at the moment of sale
          const avgCostPerShare = sharesHeld > 0 ? totalCost / sharesHeld : 0;
          const costOfSoldShares = t.shares * avgCostPerShare;
          const revenue = t.shares * t.price;
          
          realizedPL += (revenue - costOfSoldShares);
          
          // Reduce holding
          sharesHeld -= t.shares;
          totalCost -= costOfSoldShares;
        }
      });

      // Avoid negative zero
      if (sharesHeld < 0.000001) {
          sharesHeld = 0;
          totalCost = 0;
      }

      const avgCost = sharesHeld > 0 ? totalCost / sharesHeld : 0;
      const currentPrice = currentPrices[symbol] || null;
      
      // Aggregate Globals
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

    // 3. Sort by Stock Name as requested
    stockSummaries.sort((a, b) => a.name.localeCompare(b.name));

    return {
      portfolio: stockSummaries,
      stats: {
        totalValue,
        totalCostBasis,
        totalRealizedPL,
        totalUnrealizedPL
      }
    };
  }, [transactions, currentPrices]);

  // Data for chart
  const allocationData = portfolio
    .filter(s => s.totalShares > 0 && s.currentPrice)
    .map(s => ({
      name: s.symbol,
      value: (s.currentPrice || 0) * s.totalShares
    }));

  if (isAuthLoading || !isDataLoaded) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50">
              <div className="flex flex-col items-center gap-2">
                  <Loader2 className="animate-spin text-indigo-600" size={32} />
                  <p className="text-slate-500 font-medium">Loading your portfolio...</p>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
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
                className="hidden md:flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-lg font-medium transition-colors text-sm"
              >
                <Upload size={16} /> Import
              </button>
              <button 
                onClick={openAddTransaction}
                className="hidden md:flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg font-medium transition-colors text-sm"
              >
                <Plus size={16} /> Transaction
              </button>
              
              <div className="w-px h-6 bg-slate-200 mx-1 hidden md:block"></div>
              
              <UserMenu onLoginClick={() => setIsLoginOpen(true)} />
          </div>
        </div>
      </header>

      {/* Mobile Action Bar */}
      <div className="md:hidden bg-white border-b border-slate-200 p-4 flex gap-2">
          <button 
            onClick={() => setIsImportOpen(true)}
            className="flex-1 flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Upload size={18} /> Import
          </button>
          <button 
            onClick={openAddTransaction}
            className="flex-1 flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus size={18} /> Add Trade
          </button>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <StatsCards stats={stats} />

        {/* Holdings Table - Full Width */}
        <div className="w-full">
            <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Database size={20} className="text-slate-400" /> Holdings
            </h2>
            <span className="text-xs text-slate-500">Sorted by Name</span>
            </div>
            <PortfolioTable 
            portfolio={portfolio} 
            onDelete={deleteTransaction} 
            onEdit={handleEditTransaction}
            />
        </div>

        {/* Charts & Information Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Portfolio Allocation */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-slate-500 text-sm font-medium mb-4">Portfolio Allocation</h3>
            <div className="h-64 w-full">
                {allocationData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                        <Pie
                            data={allocationData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {allocationData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip 
                            formatter={(value: number) => `$${value.toLocaleString()}`}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        </PieChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                        Add current prices to see allocation
                    </div>
                )}
            </div>
            {/* Legend */}
            <div className="mt-4 grid grid-cols-2 gap-2">
                {allocationData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                            <span className="text-slate-600 font-medium">{entry.name}</span>
                        </div>
                        <span className="text-slate-400">
                            {((entry.value / stats.totalValue) * 100).toFixed(1)}%
                        </span>
                    </div>
                ))}
            </div>
            </div>
            
            {/* Instructions Panel */}
            <div className="h-full">
                <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100 h-full flex flex-col justify-between">
                    <div>
                        <h4 className="font-bold text-indigo-900 mb-2">Did you know?</h4>
                        <p className="text-sm text-indigo-700 leading-relaxed mb-4">
                            You can add transactions using natural language or by uploading files!
                        </p>
                        <div className="space-y-3">
                            <div className="bg-white p-3 rounded-lg border border-indigo-100 text-xs text-slate-600 italic">
                                "Bought 50 shares of Microsoft at 320.50 yesterday for my TFSA"
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-indigo-100 text-xs text-slate-600 italic">
                                "Sold 10 NVDA at 450 USD from my RRSP account"
                            </div>
                        </div>
                    </div>
                    <div className="mt-6 pt-6 border-t border-indigo-200">
                        <div className="flex items-center gap-3">
                             <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                                 <Upload size={20} />
                             </div>
                             <div className="text-xs text-indigo-800">
                                 <span className="font-bold">New!</span> Upload PDF statements or screenshots to import multiple trades instantly.
                             </div>
                        </div>
                    </div>
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

      {isLoginOpen && (
          <LoginModal onClose={() => setIsLoginOpen(false)} />
      )}
    </div>
  );
};

export default App;
