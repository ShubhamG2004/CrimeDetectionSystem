"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";

const COLORS = {
  HIGH: "#dc2626",
  MEDIUM: "#f59e0b",
  LOW: "#16a34a",
};

export default function AnalyticsCharts({
  dailyData,
  severityData,
  cameraData,
}) {
  return (
    <>
      {/* DAILY INCIDENTS */}
      <div className="mb-10">
        <h2 className="font-semibold mb-2">
          Incidents Per Day
        </h2>

        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={dailyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#2563eb"
              strokeWidth={3}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* SEVERITY PIE */}
        <div>
          <h2 className="font-semibold mb-2">
            Severity Distribution
          </h2>

          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={severityData}
                dataKey="value"
                nameKey="name"
                outerRadius={100}
                label
              >
                {severityData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={COLORS[entry.name]}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* CAMERA BAR */}
        <div>
          <h2 className="font-semibold mb-2">
            Incidents by Camera
          </h2>

          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={cameraData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="camera" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#16a34a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
