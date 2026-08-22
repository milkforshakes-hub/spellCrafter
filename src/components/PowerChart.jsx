import { Line } from 'react-chartjs-2';
import { getPowerBands } from '../utils/powerBands';
import { Chart as ChartJS, LineElement, PointElement, CategoryScale, LinearScale, Legend, Tooltip } from 'chart.js';
import { useMemo } from 'react';

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Legend, Tooltip);

export default function PowerChart({ spellLevel, spellPower }) {
  const clampedLevel = Math.max(1, spellLevel);
  const levels = [...Array(clampedLevel + 2).keys()];
  const bands = levels.map((lvl) => getPowerBands(lvl));

  const data = {
    labels: levels,
    datasets: [
      {
        label: "MinPower",
        data: bands.map(b => b.minPower),
        borderColor: "purple",
        borderWidth: 2,
        pointRadius: 0,
      },
      {
        label: "AvgPowerDown",
        data: bands.map(b => b.avgDown),
        borderColor: "lightgreen",
        borderDash: [5, 5],
        borderWidth: 2,
        pointRadius: 0,
      },
      {
        label: "AvgPowerUp",
        data: bands.map(b => b.avgUp),
        borderColor: "orange",
        borderDash: [5, 5],
        borderWidth: 2,
        pointRadius: 0,
      },
      {
        label: "MaxPower",
        data: bands.map(b => b.maxPower),
        borderColor: "red",
        borderWidth: 2,
        pointRadius: 0,
      },
      {
        label: "Final Power",
        data: [{ x: Number(spellLevel), y: spellPower }],
        borderColor: "blue",
        backgroundColor: "blue",
        pointBorderColor: "blue",
        pointBackgroundColor: "blue",
        pointRadius: 4,
        pointHoverRadius: 8,
        pointBorderWidth: 2,
        showLine: false,
        type: "line"
      }
    ]
  };

  const options = useMemo(() => ({
    responsive: true, // VERY IMPORTANT!
    maintainAspectRatio: false, // Allow flexible height
    plugins: {
      legend: { position: "top" }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: "Power" }
      },
      x: {
        title: { display: true, text: "Level" },
        ticks: { stepSize: 1 }
      }
    }
  }), [clampedLevel]);

  return (
    <div className="w-full h-64 relative">
      <Line 
        key={`${spellLevel}-${spellPower}`} 
        data={data} 
        options={{
          ...options,
          maintainAspectRatio: true,
          aspectRatio: 1.5
        }} 
      />
    </div>
  );
}
