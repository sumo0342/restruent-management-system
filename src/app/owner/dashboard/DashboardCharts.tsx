"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ["#FF5722", "#F59E0B", "#10B981", "#6366F1"];

const tooltipStyle = {
  backgroundColor: "rgba(15, 23, 42, 0.9)",
  border: "1px solid rgba(255, 255, 255, 0.15)",
  borderRadius: "12px",
  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
  color: "#F8FAFC",
  backdropFilter: "blur(12px)",
  fontSize: "12px",
};

export function DashboardCharts({
  salesByDay,
  topItems,
  waiterOrders,
  paymentMix,
}: {
  salesByDay: { day: string; total: number }[];
  topItems: { name: string; qty: number }[];
  waiterOrders: { name: string; count: number }[];
  paymentMix: { method: string; amount: number }[];
}) {
  return (
    <div className="grid md:grid-cols-2 gap-4 animate-stagger">
      <ChartCard title="Sales, last 7 days">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={salesByDay}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#94A3B8" }} stroke="rgba(255, 255, 255, 0.1)" />
            <YAxis tick={{ fontSize: 12, fill: "#94A3B8" }} stroke="rgba(255, 255, 255, 0.1)" />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="total" fill="#FF5722" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Top-selling items">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={topItems} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" />
            <XAxis type="number" tick={{ fontSize: 12, fill: "#94A3B8" }} stroke="rgba(255, 255, 255, 0.1)" />
            <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: "#94A3B8" }} stroke="rgba(255, 255, 255, 0.1)" />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="qty" fill="#F59E0B" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Orders by waiter, today">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={waiterOrders}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#94A3B8" }} stroke="rgba(255, 255, 255, 0.1)" />
            <YAxis tick={{ fontSize: 12, fill: "#94A3B8" }} allowDecimals={false} stroke="rgba(255, 255, 255, 0.1)" />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="count" fill="#10B981" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Payment method, today">
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={paymentMix} dataKey="amount" nameKey="method" innerRadius={50} outerRadius={80}>
              {paymentMix.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card-lift p-5 rounded-2xl">
      <p className="text-sm font-bold text-white tracking-wide mb-3">{title}</p>
      {children}
    </div>
  );
}
