import React, { useState, useEffect } from 'react';
import { Transaction, TransactionType } from '../types';
import { parseTransactionWithAI } from '../services/geminiService';
import { Sparkles, Plus, Loader2, Save } from 'lucide-react';

interface TransactionFormProps {
  onSave: (transaction: Transaction | Omit<Transaction, 'id'>) => void;
  onClose: () => void;
  initialData?: Transaction;
}

const TransactionForm: React.FC<TransactionFormProps> = ({ onSave, onClose, initialData }) => {
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'BUY' as TransactionType,
    symbol: '',
    name: '',
    shares: '',
    price: '',
    account: 'TFSA',
    exchange: 'NASDAQ',
    currency: 'USD'
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        date: initialData.date,
        type: initialData.type,
        symbol: initialData.symbol,
        name: initialData.name,
        shares: initialData.shares.toString(),
        price: initialData.price.toString(),
        account: initialData.account,
        exchange: initialData.exchange,
        currency: initialData.currency
      });
    }
  }, [initialData]);

  const handleAIParse = async () => {
    if (!aiInput.trim()) return;
    setIsAIProcessing(true);
    try {
      const result = await parseTransactionWithAI(aiInput);
      if (result) {
        setFormData(prev => ({
          ...prev,
          date: result.date || prev.date,
          type: (result.type?.toUpperCase() === 'SELL' ? 'SELL' : 'BUY') as TransactionType,
          symbol: result.symbol?.toUpperCase() || prev.symbol,
          name: result.name || prev.name,
          shares: result.shares?.toString() || prev.shares,
          price: result.price?.toString() || prev.price,
          account: result.account || prev.account,
          exchange: result.exchange || prev.exchange,
          currency: result.currency || prev.currency
        }));
      }
    } catch (error) {
      console.error("AI Parse failed", error);
    } finally {
      setIsAIProcessing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const transactionData = {
      date: formData.date,
      type: formData.type,
      symbol: formData.symbol.toUpperCase(),
      name: formData.name || formData.symbol.toUpperCase(), // Fallback name
      shares: Number(formData.shares),
      price: Number(formData.price),
      account: formData.account,
      exchange: formData.exchange,
      currency: formData.currency
    };

    if (initialData) {
      onSave({ ...transactionData, id: initialData.id });
    } else {
      onSave(transactionData);
    }
    onClose();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">
        <div className="bg-slate-900 p-6 flex justify-between items-center">
          <h2 className="text-white text-xl font-bold flex items-center gap-2">
            {initialData ? <Save className="text-emerald-400" /> : <Plus className="text-emerald-400" />} 
            {initialData ? 'Edit Transaction' : 'New Transaction'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            ✕
          </button>
        </div>

        <div className="p-6">
          {/* AI Section - only show for new transactions as it replaces everything */}
          {!initialData && (
            <div className="mb-8 bg-indigo-50 rounded-xl p-4 border border-indigo-100">
              <label className="block text-indigo-900 text-sm font-bold mb-2 flex items-center gap-2">
                <Sparkles size={16} className="text-indigo-600" /> 
                Smart Fill with AI
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder="e.g., Bought 10 shares of Apple at $150 yesterday for my RRSP"
                  className="flex-1 px-4 py-2 rounded-lg border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
                <button
                  onClick={handleAIParse}
                  disabled={isAIProcessing || !aiInput}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isAIProcessing ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                  Auto-Fill
                </button>
              </div>
              <p className="text-xs text-indigo-400 mt-2">
                Powered by Gemini. Describe your trade naturally.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 text-xs font-bold mb-1">Date</label>
              <input required name="date" type="date" value={formData.date} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-slate-700 text-xs font-bold mb-1">Type</label>
              <select name="type" value={formData.type} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-700 text-xs font-bold mb-1">Symbol</label>
              <input required name="symbol" type="text" placeholder="e.g. AAPL" value={formData.symbol} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none uppercase" />
            </div>
             <div>
              <label className="block text-slate-700 text-xs font-bold mb-1">Company Name</label>
              <input required name="name" type="text" placeholder="e.g. Apple Inc." value={formData.name} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-slate-700 text-xs font-bold mb-1">Shares</label>
              <input required name="shares" type="number" step="any" min="0" value={formData.shares} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-slate-700 text-xs font-bold mb-1">Price</label>
              <input required name="price" type="number" step="any" min="0" value={formData.price} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-slate-700 text-xs font-bold mb-1">Account</label>
              <input name="account" type="text" placeholder="TFSA" value={formData.account} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-slate-700 text-xs font-bold mb-1">Exchange</label>
              <input name="exchange" type="text" placeholder="NASDAQ" value={formData.exchange} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
               <label className="block text-slate-700 text-xs font-bold mb-1">Currency</label>
               <select name="currency" value={formData.currency} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                 <option value="USD">USD</option>
                 <option value="CAD">CAD</option>
               </select>
            </div>

            <div className="md:col-span-2 mt-4 flex justify-end gap-3">
              <button type="button" onClick={onClose} className="px-5 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg">Cancel</button>
              <button type="submit" className="px-5 py-2 bg-blue-600 text-white font-medium hover:bg-blue-700 rounded-lg shadow-sm">
                {initialData ? 'Update Transaction' : 'Save Transaction'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default TransactionForm;