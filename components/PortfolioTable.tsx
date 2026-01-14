import React, { useState } from 'react';
import { Transaction, StockSummary } from '../types';
import { ChevronDown, ChevronRight, Edit2, Trash2 } from 'lucide-react';

interface PortfolioTableProps {
  portfolio: StockSummary[];
  onDelete: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
}

const PortfolioTable: React.FC<PortfolioTableProps> = ({ portfolio, onDelete, onEdit }) => {
  // Map of symbol -> boolean to track expanded state
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    // Initialize all as expanded for better first impression
    portfolio.reduce((acc, stock) => ({ ...acc, [stock.symbol]: true }), {})
  );

  const toggleGroup = (symbol: string) => {
    setExpandedGroups(prev => ({ ...prev, [symbol]: !prev[symbol] }));
  };

  if (portfolio.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-slate-200">
        <p className="text-slate-500">No transactions found. Add one to get started!</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left table-fixed min-w-[1000px]">
          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 w-12"></th>
              <th className="px-4 py-3 w-[8%]">Symbol</th>
              <th className="px-4 py-3 w-[15%]">Stock Name</th>
              <th className="px-4 py-3 text-right w-[8%]">Shares</th>
              <th className="px-4 py-3 text-right w-[10%]">Avg Price</th>
              <th className="px-4 py-3 text-right w-[10%]">Total Cost</th>
              <th className="px-4 py-3 text-right w-[12%]">Current Price</th>
              <th className="px-4 py-3 text-right w-[12%]">Market Value</th>
              <th className="px-4 py-3 text-right w-[10%]">Unrealized P/L</th>
              <th className="px-4 py-3 text-right w-[10%]">Realized P/L</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {portfolio.map((stock) => {
              const isExpanded = expandedGroups[stock.symbol];
              const unrealizedPL = stock.currentPrice 
                ? (stock.currentPrice - stock.avgCost) * stock.totalShares 
                : 0;
              const marketValue = stock.currentPrice 
                ? stock.currentPrice * stock.totalShares
                : 0;

              return (
                <React.Fragment key={stock.symbol}>
                  {/* Summary Row */}
                  <tr className="bg-slate-50/50 hover:bg-slate-100 transition-colors">
                    <td className="px-4 py-3 text-center cursor-pointer" onClick={() => toggleGroup(stock.symbol)}>
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-800 truncate">{stock.symbol}</td>
                    <td className="px-4 py-3 font-medium text-slate-700 truncate">{stock.name}</td>
                    <td className="px-4 py-3 text-right font-medium">{stock.totalShares.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">${stock.avgCost.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-medium">${stock.totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-right">
                         {stock.currentPrice ? `$${stock.currentPrice.toFixed(2)}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                        {stock.currentPrice ? `$${marketValue.toLocaleString(undefined, {minimumFractionDigits: 2})}` : '-'}
                    </td>
                    <td className={`px-4 py-3 text-right font-bold ${unrealizedPL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                       {stock.currentPrice ? `$${unrealizedPL.toLocaleString(undefined, {minimumFractionDigits: 2})}` : '-'}
                    </td>
                    <td className={`px-4 py-3 text-right font-bold ${stock.realizedPL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      ${stock.realizedPL.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </td>
                  </tr>

                  {/* Expanded Details Rows */}
                  {isExpanded && (
                    <tr className="bg-white">
                      <td colSpan={10} className="p-0">
                        <div className="border-b border-slate-100 bg-slate-50/30">
                           <table className="w-full text-xs">
                               <thead className="text-slate-400 bg-slate-100/50">
                                   <tr>
                                       <th className="px-8 py-2 text-left w-[12%]">Date</th>
                                       <th className="px-4 py-2 text-left w-[8%]">Type</th>
                                       <th className="px-4 py-2 text-left w-[10%]">Account</th>
                                       <th className="px-4 py-2 text-left w-[10%]">Exchange</th>
                                       <th className="px-4 py-2 text-right w-[10%]">Shares</th>
                                       <th className="px-4 py-2 text-right w-[10%]">Price</th>
                                       <th className="px-4 py-2 text-right w-[10%]">Total Cost</th>
                                       <th className="px-4 py-2 text-right w-[15%]">Current Value</th>
                                       <th className="px-4 py-2 text-right w-[15%]">Action</th>
                                   </tr>
                               </thead>
                               <tbody className="divide-y divide-slate-100">
                                   {stock.transactions.map(t => {
                                       const currentTxValue = stock.currentPrice ? t.shares * stock.currentPrice : null;
                                       return (
                                       <tr key={t.id} className="hover:bg-slate-50">
                                           <td className="px-8 py-2">{t.date}</td>
                                           <td className={`px-4 py-2 font-bold ${t.type === 'BUY' ? 'text-blue-600' : 'text-amber-600'}`}>
                                               {t.type}
                                           </td>
                                           <td className="px-4 py-2">{t.account}</td>
                                           <td className="px-4 py-2">{t.exchange}</td>
                                           <td className="px-4 py-2 text-right">{t.shares}</td>
                                           <td className="px-4 py-2 text-right">${t.price.toFixed(2)}</td>
                                           <td className="px-4 py-2 text-right">${(t.shares * t.price).toLocaleString()}</td>
                                           <td className="px-4 py-2 text-right font-medium text-slate-600">
                                               {currentTxValue !== null ? `$${currentTxValue.toLocaleString(undefined, {minimumFractionDigits: 2})}` : '-'}
                                           </td>
                                           <td className="px-4 py-2 text-right flex items-center justify-end gap-2">
                                               <button onClick={() => onEdit(t)} className="text-slate-400 hover:text-blue-600 transition-colors p-1">
                                                   <Edit2 size={14} />
                                               </button>
                                               <button onClick={() => onDelete(t.id)} className="text-slate-400 hover:text-rose-600 transition-colors p-1">
                                                   <Trash2 size={14} />
                                               </button>
                                           </td>
                                       </tr>
                                   )})}
                               </tbody>
                           </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PortfolioTable;