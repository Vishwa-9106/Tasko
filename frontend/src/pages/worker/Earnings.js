import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Calendar, 
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Filter
} from 'lucide-react';
import { authAPI } from '../../services/api';

const Earnings = () => {
  const [timeframe, setTimeframe] = useState('month');
  const [stats, setStats] = useState({
    totalEarnings: 0,
    thisMonth: 0,
    pendingPayouts: 0,
    completedJobs: 0
  });
  const [transactions, setTransactions] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Load earnings data on component mount
  useEffect(() => {
    loadEarningsData();
  }, []);

  const loadEarningsData = async () => {
    try {
      setLoading(true);
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      // Load bookings to calculate earnings
      const savedBookings = JSON.parse(localStorage.getItem('userBookings') || '[]');
      const completedBookings = savedBookings.filter(b => b.status === 'completed');
      const pendingBookings = savedBookings.filter(b => b.status === 'pending');
      
      // Calculate stats from real bookings
      const totalEarnings = completedBookings.reduce((sum, booking) => sum + (booking.amount || 0), 0);
      const thisMonth = completedBookings
        .filter(b => new Date(b.date).getMonth() === new Date().getMonth())
        .reduce((sum, booking) => sum + (booking.amount || 0), 0);
      const pendingPayouts = pendingBookings.reduce((sum, booking) => sum + (booking.amount || 0), 0);
      
      setStats({
        totalEarnings,
        thisMonth,
        pendingPayouts,
        completedJobs: completedBookings.length
      });

      // Generate transactions from bookings
      const earningTransactions = completedBookings.map(booking => ({
        id: booking._id || booking.id,
        type: 'earning',
        description: `${booking.service} - ${booking.customer?.name || 'Customer'}`,
        amount: booking.amount || 0,
        date: booking.date,
        status: 'completed'
      }));

      const pendingTransactions = pendingBookings.map(booking => ({
        id: `pending_${booking._id || booking.id}`,
        type: 'earning',
        description: `${booking.service} - ${booking.customer?.name || 'Customer'}`,
        amount: booking.amount || 0,
        date: booking.date,
        status: 'pending'
      }));

      setTransactions([...earningTransactions, ...pendingTransactions].slice(0, 10));

      // Generate chart data from last 6 months
      const monthlyData = [];
      const currentDate = new Date();
      for (let i = 5; i >= 0; i--) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const monthBookings = completedBookings.filter(b => {
          const bookingDate = new Date(b.date);
          return bookingDate.getMonth() === date.getMonth() && bookingDate.getFullYear() === date.getFullYear();
        });
        const monthEarnings = monthBookings.reduce((sum, booking) => sum + (booking.amount || 0), 0);
        
        monthlyData.push({
          month: date.toLocaleDateString('en-US', { month: 'short' }),
          earnings: monthEarnings
        });
      }
      setChartData(monthlyData);
      
    } catch (err) {
      console.error('Earnings load error:', err);
      setError('Failed to load earnings data');
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, change, icon: Icon, color }) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">₹{value}</p>
          {change && (
            <div className={`flex items-center mt-2 text-sm ${
              change > 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {change > 0 ? (
                <ArrowUpRight className="h-4 w-4 mr-1" />
              ) : (
                <ArrowDownRight className="h-4 w-4 mr-1" />
              )}
              {Math.abs(change || 0)}% from last month
            </div>
          )}
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  );

  const TransactionRow = ({ transaction }) => (
    <div className="flex items-center justify-between py-4 border-b border-gray-200 last:border-b-0">
      <div className="flex items-center">
        <div className={`p-2 rounded-full mr-4 ${
          transaction.type === 'earning' 
            ? 'bg-green-100' 
            : 'bg-blue-100'
        }`}>
          {transaction.type === 'earning' ? (
            <ArrowUpRight className={`h-4 w-4 ${
              transaction.type === 'earning' ? 'text-green-600' : 'text-blue-600'
            }`} />
          ) : (
            <ArrowDownRight className="h-4 w-4 text-blue-600" />
          )}
        </div>
        <div>
          <p className="font-medium text-gray-900">{transaction.description}</p>
          <p className="text-sm text-gray-600">{transaction.date}</p>
        </div>
      </div>
      <div className="text-right">
        <p className={`font-semibold ${
          transaction.amount > 0 ? 'text-green-600' : 'text-blue-600'
        }`}>
          {transaction.amount > 0 ? '+' : ''}₹{Math.abs(transaction.amount)}
        </p>
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
          transaction.status === 'completed'
            ? 'bg-green-100 text-green-800'
            : 'bg-yellow-100 text-yellow-800'
        }`}>
          {transaction.status}
        </span>
      </div>
    </div>
  );

  const EarningsChart = () => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Earnings Overview</h3>
        <select 
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="year">This Year</option>
        </select>
      </div>
      
      <div className="h-64 flex items-end justify-between space-x-2">
        {chartData.map((data, index) => (
          <div key={index} className="flex-1 flex flex-col items-center">
            <div 
              className="w-full bg-primary-600 rounded-t-lg transition-all duration-300 hover:bg-primary-700"
              style={{ 
                height: `${(data.earnings / Math.max(...chartData.map(d => d.earnings))) * 200}px`,
                minHeight: '20px'
              }}
            />
            <p className="text-xs text-gray-600 mt-2">{data.month}</p>
            <p className="text-xs font-semibold text-gray-900">₹{data.earnings}</p>
          </div>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-2">Loading earnings...</span>
      </div>
    );
  }

  return (
    <div className="p-6">
      {error && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm text-yellow-600">{error}</p>
        </div>
      )}
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Earnings</h1>
          <p className="text-gray-600 mt-2">Track your income and payment history</p>
        </div>
        <div className="flex space-x-3">
          <button className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </button>
          <button className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Earnings"
          value={stats.totalEarnings}
          change={12}
          icon={DollarSign}
          color="bg-green-500"
        />
        <StatCard
          title="This Month"
          value={stats.thisMonth}
          change={8}
          icon={TrendingUp}
          color="bg-blue-500"
        />
        <StatCard
          title="Pending Payouts"
          value={stats.pendingPayouts}
          icon={CreditCard}
          color="bg-yellow-500"
        />
        <StatCard
          title="Completed Jobs"
          value={stats.completedJobs}
          change={15}
          icon={Calendar}
          color="bg-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Earnings Chart */}
        <div className="lg:col-span-2">
          <EarningsChart />
        </div>

        {/* Payment Info */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Information</h3>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Bank Account</span>
                <span className="text-xs text-gray-500">Primary</span>
              </div>
              <p className="text-sm text-gray-900">**** **** **** 1234</p>
              <p className="text-xs text-gray-600">Chase Bank</p>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Next Payout</span>
                <span className="font-medium text-gray-900">Jan 19, 2024</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Payout Amount</span>
                <span className="font-medium text-green-600">₹{stats.pendingPayouts}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Processing Fee</span>
                <span className="font-medium text-gray-900">₹25</span>
              </div>
            </div>

            <button className="w-full mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
              Update Payment Method
            </button>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
        </div>
        <div className="p-6">
          {transactions.map((transaction) => (
            <TransactionRow key={transaction.id} transaction={transaction} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Earnings;
