import React, { useState } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Calendar, 
  Download,
  Eye,
  BarChart3
} from 'lucide-react';

const Earnings = () => {
  const [timeRange, setTimeRange] = useState('month');
  
  const earningsData = {
    total: 2450,
    thisMonth: 850,
    lastMonth: 720,
    growth: 18.1,
    completedJobs: 48,
    avgPerJob: 51
  };

  const recentEarnings = [
    {
      id: 1,
      date: '2024-01-15',
      service: 'House Cleaning',
      customer: 'Sarah Johnson',
      amount: 80,
      status: 'paid'
    },
    {
      id: 2,
      date: '2024-01-14',
      service: 'Bathroom Deep Clean',
      customer: 'Mike Chen',
      amount: 45,
      status: 'paid'
    },
    {
      id: 3,
      date: '2024-01-13',
      service: 'Home Cooking',
      customer: 'Emma Davis',
      amount: 60,
      status: 'pending'
    },
    {
      id: 4,
      date: '2024-01-12',
      service: 'Laundry Service',
      customer: 'Robert Wilson',
      amount: 35,
      status: 'paid'
    },
    {
      id: 5,
      date: '2024-01-11',
      service: 'House Cleaning',
      customer: 'Lisa Brown',
      amount: 80,
      status: 'paid'
    }
  ];

  const monthlyData = [
    { month: 'Jul', amount: 1200 },
    { month: 'Aug', amount: 1450 },
    { month: 'Sep', amount: 1680 },
    { month: 'Oct', amount: 1320 },
    { month: 'Nov', amount: 1890 },
    { month: 'Dec', amount: 2100 },
    { month: 'Jan', amount: 2450 }
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Earnings</h1>
          <p className="text-gray-600 mt-2">Track your income and payment history</p>
        </div>
        <div className="flex space-x-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
          <button className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Earnings</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">${earningsData.total}</p>
              <div className="flex items-center mt-2">
                <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-sm font-medium text-green-600">
                  +{earningsData.growth}% from last month
                </span>
              </div>
            </div>
            <div className="p-3 rounded-full bg-green-500">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">This Month</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">${earningsData.thisMonth}</p>
              <p className="text-sm text-gray-500 mt-2">vs ${earningsData.lastMonth} last month</p>
            </div>
            <div className="p-3 rounded-full bg-blue-500">
              <Calendar className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completed Jobs</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{earningsData.completedJobs}</p>
              <p className="text-sm text-gray-500 mt-2">Total jobs completed</p>
            </div>
            <div className="p-3 rounded-full bg-purple-500">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Average per Job</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">${earningsData.avgPerJob}</p>
              <p className="text-sm text-gray-500 mt-2">Average earning per job</p>
            </div>
            <div className="p-3 rounded-full bg-orange-500">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Earnings Chart */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Earnings Overview</h2>
            <button className="flex items-center text-sm text-gray-600 hover:text-gray-900">
              <Eye className="h-4 w-4 mr-1" />
              View Details
            </button>
          </div>
          
          {/* Simple Bar Chart */}
          <div className="space-y-4">
            {monthlyData.map((data, index) => (
              <div key={index} className="flex items-center">
                <div className="w-12 text-sm text-gray-600">{data.month}</div>
                <div className="flex-1 mx-4">
                  <div className="bg-gray-200 rounded-full h-6">
                    <div
                      className="bg-primary-600 h-6 rounded-full flex items-center justify-end pr-2"
                      style={{ width: `${(data.amount / Math.max(...monthlyData.map(d => d.amount))) * 100}%` }}
                    >
                      <span className="text-xs text-white font-medium">${data.amount}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Earnings */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Recent Earnings</h2>
          <div className="space-y-4">
            {recentEarnings.map((earning) => (
              <div key={earning.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{earning.service}</p>
                  <p className="text-xs text-gray-600">{earning.customer}</p>
                  <p className="text-xs text-gray-500">{earning.date}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">${earning.amount}</p>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(earning.status)}`}>
                    {earning.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-4 text-sm text-primary-600 hover:text-primary-700 font-medium">
            View All Transactions
          </button>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Bank Account</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-900">**** **** **** 1234</p>
              <p className="text-xs text-gray-600">Chase Bank - Checking</p>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Payment Schedule</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-900">Weekly Payouts</p>
              <p className="text-xs text-gray-600">Every Friday at 5:00 PM</p>
            </div>
          </div>
        </div>
        <button className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
          Update Payment Info
        </button>
      </div>
    </div>
  );
};

export default Earnings;
