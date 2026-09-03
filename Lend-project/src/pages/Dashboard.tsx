import { useMemo } from 'react';
import { TrendingUp, Users, DollarSign, ArrowUp, ArrowDown, Wallet, Landmark } from 'lucide-react';
import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';
import { useInquiryCache } from '../context/InquiryCacheContext';
import DashboardSkeleton from '../components/DashboardSkeleton';
import { formatCurrencyShort } from '../utils/formatters';

const formatFunding = (amount: number): string => {
  return formatCurrencyShort(amount);
};

export default function Dashboard() {
  const { inquiries, loading, error } = useInquiryCache();

  const borrowers = inquiries.filter((i) => i.type === 'Borrower');
  const investors = inquiries.filter((i) => i.type === 'Investor');

  const totalBorrowerFunding = useMemo(
    () => borrowers.reduce((sum, b) => sum + (b.borrowerDetails?.loanAmount ?? 0), 0),
    [borrowers]
  );
  const totalInvestmentFunding = useMemo(
    () => investors.reduce((sum, i) => sum + (i.investorDetails?.investmentAmount ?? 0), 0),
    [investors]
  );

  const stats = [
    { label: 'Total Inquiries', value: String(inquiries.length), change: '', trend: 'up' as const, icon: TrendingUp, bg: 'bg-blue-100', iconColor: 'text-blue-600' },
    { label: 'Active Borrowers', value: String(borrowers.length), change: '', trend: 'up' as const, icon: Users, bg: 'bg-emerald-100', iconColor: 'text-emerald-600' },
    { label: 'Active Investors', value: String(investors.length), change: '', trend: 'up' as const, icon: DollarSign, bg: 'bg-violet-100', iconColor: 'text-violet-600' },
    { label: 'Total Borrower Funding', value: formatFunding(totalBorrowerFunding), change: '', trend: 'up' as const, icon: Wallet, bg: 'bg-sky-100', iconColor: 'text-sky-600' },
    { label: 'Total Investment Funding', value: formatFunding(totalInvestmentFunding), change: '', trend: 'up' as const, icon: Landmark, bg: 'bg-fuchsia-100', iconColor: 'text-fuchsia-600' },
  ];

  const trendDays = 14;
  const inquiryTrendData = useMemo(() => {
    const days: { date: string; label: string; inquiries: number; borrowers: number; investors: number }[] = [];
    for (let i = trendDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const day = d.getDate();
      const mon = d.getMonth() + 1;
      const label = `${day}/${mon}`;
      const dayInquiries = inquiries.filter((inq) => (inq.createdAt || '').toString().startsWith(dateStr));
      days.push({
        date: dateStr,
        label,
        inquiries: dayInquiries.length,
        borrowers: dayInquiries.filter((i) => i.type === 'Borrower').length,
        investors: dayInquiries.filter((i) => i.type === 'Investor').length,
      });
    }
    return days;
  }, [inquiries]);

  const pipelineData = useMemo(
    () => [
      { name: 'Borrowers', value: borrowers.length, fill: '#0ea5e9' },
      { name: 'Investors', value: investors.length, fill: '#8b5cf6' },
    ],
    [borrowers.length, investors.length]
  );

  const fundingBarData = useMemo(
    () => [
      { name: 'Borrower Funding', amount: totalBorrowerFunding, fill: '#0284c7' },
      { name: 'Investment Funding', amount: totalInvestmentFunding, fill: '#7c3aed' },
    ],
    [totalBorrowerFunding, totalInvestmentFunding]
  );

  if (loading) return <DashboardSkeleton />;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600 mt-1 text-sm sm:text-base">Welcome back! Here's your overview</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-5">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const isUp = stat.trend === 'up';
          return (
            <div
              key={stat.label}
              className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 sm:p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-11 h-11 rounded-xl ${stat.bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${stat.iconColor}`} />
                </div>
                {stat.change && (
                  <div className={`flex items-center gap-1 text-xs font-medium ${isUp ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {isUp ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
                    <span>{stat.change}</span>
                  </div>
                )}
              </div>
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-0.5">{stat.label}</p>
              <p className="text-lg sm:text-xl font-bold text-slate-900 truncate" title={stat.value}>
                {stat.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="min-w-0 bg-white rounded-xl shadow-sm border border-slate-200/80 p-5 sm:p-6">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Inquiry Trend (Last 14 Days)</h3>
          <div className="w-full h-[300px] min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={inquiryTrendData} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="fillInquiries" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#64748b" tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} stroke="#64748b" allowDecimals={false} tickLine={false} width={28} />
                <Tooltip
                  contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                  formatter={(value: number | undefined) => [value ?? 0, 'Count']}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ''}
                />
                <Area type="monotone" dataKey="inquiries" name="Inquiries" stroke="#0ea5e9" strokeWidth={2.5} fill="url(#fillInquiries)" />
                <Line type="monotone" dataKey="borrowers" name="Borrowers" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="investors" name="Investors" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Legend wrapperStyle={{ paddingTop: 8 }} iconType="circle" iconSize={8} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="min-w-0 bg-white rounded-xl shadow-sm border border-slate-200/80 p-5 sm:p-6">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Pipeline Distribution</h3>
          <div className="w-full h-[300px] min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pipelineData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {pipelineData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} stroke="#fff" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number | undefined) => [value ?? 0, 'Count']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Funding bar */}
      <div className="min-w-0 bg-white rounded-xl shadow-sm border border-slate-200/80 p-5 sm:p-6">
        <h3 className="text-base font-semibold text-slate-800 mb-4">Funding Overview</h3>
        <div className="w-full h-[300px] min-h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={fundingBarData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={(v) => formatFunding(v)} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} stroke="#64748b" />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                formatter={(value: number | undefined) => [formatFunding(value ?? 0), 'Amount']}
              />
              <Bar dataKey="amount" name="Amount" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
