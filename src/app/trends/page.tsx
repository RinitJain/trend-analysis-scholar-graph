
'use client';

import { useEffect, useState } from "react";

export default function TrendsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTrends() {
      try {
        const res = await fetch("/api/read-trends", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        console.error("Error fetching trends:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchTrends();
  }, []);

  if (loading) return <div className="p-6">⏳ Loading extrapolated trends...</div>;
  if (error) return <div className="p-6 text-red-500">❌ Error: {error}</div>;
  if (!data) return <div className="p-6">No trends data found.</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Future Research Directions in {data.topic}</h1>

      <section className="bg-muted p-4 rounded-xl">
        <h2 className="font-semibold mb-2">Overall Summary</h2>
        <p className="text-sm text-gray-700">{data.overall_summary}</p>
      </section>

      <section>
        <h2 className="font-semibold text-lg mb-4">🔮 Predicted Research Gaps</h2>
        <div className="space-y-6">
          {data.predicted_gaps.map((gap: any, idx: number) => (
            <div key={idx} className="border rounded-xl p-4 shadow-sm">
              <h3 className="font-semibold text-primary mb-1">
                {gap.predicted_research_gap}
              </h3>
              <p className="text-sm mb-2">{gap.description}</p>
              <p className="text-xs text-gray-600">
                Confidence: {(gap.confidence * 100).toFixed(0)}%
              </p>
              <p className="text-xs text-gray-700 mt-2">
                <strong>Supporting Papers:</strong>{" "}
                {gap.supporting_papers.join(", ")}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
