import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

type Props = {
  series: number[]
  labels?: string[]
  color?: string
}

export default function PowerChart({ series, labels, color = '#2563eb' }: Props) {
  const data = {
    labels: labels ?? series.map((_, i) => `${i}`),
    datasets: [
      {
        label: 'Total power (W)',
        data: series,
        fill: true,
        backgroundColor: 'rgba(37,99,235,0.08)',
        borderColor: color,
        tension: 0.35,
        pointRadius: 0,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        display: true,
        grid: { display: false },
        ticks: {
          color: '#64748b',
          maxRotation: 0,
          autoSkip: true,
        },
      },
      y: {
        grid: { color: 'rgba(148, 163, 184, 0.16)' },
        ticks: { callback: (v: any) => `${v}W`, color: '#64748b' },
      },
    },
  }

  return (
    <div style={{ width: '100%', height: 160 }}>
      <Line data={data} options={options as any} />
    </div>
  )
}
