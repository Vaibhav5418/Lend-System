import { useState, useEffect } from 'react';
import {
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Landmark,
  Wallet,
  Percent,
  AlertTriangle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
  Line,
} from 'recharts';
import { api } from '../api/client';
import type { ProfitDashboardData } from '../types';
import { formatCurrencyShort } from '../utils/formatters';

function formatAmount(amount: number): string {
  return formatCurrencyShort(amount);
}

export default function ProfitDashboard() {
  const [data, setData] = useState<ProfitDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getProfitDashboard()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-slate-500">Loading profit analytics...</div>;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;
  if (!data) return null;

  const kpiCards = [
    { label: 'Total Invested Funds', value: formatAmount(data.totalInvestedFunds), icon: Landmark, bg: 'bg-violet-100', color: 'text-violet-600' },
    { label: 'Total Deployed Funds', value: formatAmount(data.totalDeployedFunds), icon: Wallet, bg: 'bg-sky-100', color: 'text-sky-600' },
    { label: 'Interest Receivable', value: formatAmount(data.totalInterestReceivable), icon: ArrowDownRight, bg: 'bg-emerald-100', color: 'text-emerald-600' },
    { label: 'Interest Payable', value: formatAmount(data.totalInterestPayable), icon: ArrowUpRight, bg: 'bg-amber-100', color: 'text-amber-600' },
    { label: 'Net Spread Profit', value: formatAmount(data.netSpreadProfit), icon: TrendingUp, bg: data.netSpreadProfit >= 0 ? 'bg-emerald-100' : 'bg-red-100', color: data.netSpreadProfit >= 0 ? 'text-emerald-600' : 'text-red-600' },
    { label: 'Realized Profit', value: formatAmount(data.realizedProfit), icon: DollarSign, bg: data.realizedProfit >= 0 ? 'bg-green-100' : 'bg-red-100', color: data.realizedProfit >= 0 ? 'text-green-600' : 'text-red-600' },
  ];

  const spreadCards = [
    { label: 'Avg Investor Rate', value: `${data.avgInvestorRate}%`, color: 'text-violet-700' },
    { label: 'Avg Borrower Rate', value: `${data.avgBorrowerRate}%`, color: 'text-sky-700' },
    { label: 'Avg Spread', value: `${data.avgSpread}%`, color: data.avgSpread >= 0 ? 'text-emerald-700' : 'text-red-700' },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Profit Engine</h1>
        <p className="text-slate-600 mt-1 text-sm">Platform profit via interest spread — NBFC / P2P accounting</p>
      </div>

      {/* Spread Explanation Banner */}
      <div className="bg-gradient-to-r from-violet-50 to-sky-50 border border-violet-200 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-2">
          <Percent className="w-5 h-5 text-violet-600" />
          <span className="text-sm font-semibold text-slate-800">Interest Spread Model</span>
        </div>
        <div className="flex flex-wrap gap-6 text-sm">
          {spreadCards.map((c) => (
            <div key={c.label} className="flex items-center gap-2">
              <span className="text-slate-500">{c.label}:</span>
              <span className={`font-bold ${c.color}`}>{c.value}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Profit = Borrower Rate - Investor Rate. Example: 15% borrower - 5% investor = 10% platform margin.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 hover:shadow-md transition-shadow">
              <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <p className="text-xs text-slate-500 uppercase font-medium tracking-wide">{card.label}</p>
              <p className="text-lg font-bold text-slate-900 mt-0.5 truncate" title={card.value}>{card.value}</p>
            </div>
          );
        })}
      </div>

      {/* Status Row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Landmark className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Active Investors</p>
            <p className="text-xl font-bold text-slate-900">{data.activeInvestors}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Active Loans</p>
            <p className="text-xl font-bold text-slate-900">{data.activeLoans}</p>
          </div>
        </div>
        {data.defaultedLoans > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-red-200 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-red-500">Defaulted Loans</p>
              <p className="text-xl font-bold text-red-700">{data.defaultedLoans}</p>
            </div>
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Monthly Profit Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 sm:p-6">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Monthly Profit Analytics</h3>
          <div className="w-full h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.monthlyProfit} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="fillProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#64748b" tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} stroke="#64748b" tickLine={false} width={60}
                  tickFormatter={(v) => formatAmount(v)} />
                <Tooltip
                  contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  formatter={(value: number | undefined) => [formatAmount(value ?? 0), '']}
                />
                <Area type="monotone" dataKey="netProfit" name="Net Profit" stroke="#10b981" strokeWidth={2.5} fill="url(#fillProfit)" />
                <Line type="monotone" dataKey="interestCollected" name="Collected" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="interestPaid" name="Paid Out" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: 8 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Funds Flow Bar Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 sm:p-6">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Funds Flow Overview</h3>
          <div className="w-full h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: 'Invested', amount: data.totalInvestedFunds, fill: '#8b5cf6' },
                  { name: 'Deployed', amount: data.totalDeployedFunds, fill: '#0ea5e9' },
                  { name: 'Int. Receivable', amount: data.totalInterestReceivable, fill: '#10b981' },
                  { name: 'Int. Payable', amount: data.totalInterestPayable, fill: '#f59e0b' },
                  { name: 'Collected', amount: data.interestCollectedFromBorrowers, fill: '#06b6d4' },
                  { name: 'Paid Out', amount: data.interestPaidToInvestors, fill: '#a78bfa' },
                ]}
                layout="vertical"
                margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={(v) => formatAmount(v)} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} stroke="#64748b" />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  formatter={(value: number | undefined) => [formatAmount(value ?? 0), 'Amount']}
                />
                <Bar dataKey="amount" name="Amount" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
