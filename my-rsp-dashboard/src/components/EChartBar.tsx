import React, { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

interface Props {
  categories: string[]
  values: number[]
  title?: string
  unit?: string
  fuelType?: string
}

export default function EChartBar({ categories, values, title, unit, fuelType }: Props) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.EChartsType | null>(null)

  useEffect(() => 
    {
    if (!chartRef.current) return
    if (!chartInstance.current)
       {
      chartInstance.current = echarts.init(chartRef.current)
    }
    const chart = chartInstance.current

    // dynamic colors
    const color = fuelType === 'Diesel' ? '#16a34a' : '#3b82f6'

    const option: echarts.EChartsOption =
     {
      title:
       {
        text: title || '',
        left: 'center',
        textStyle: { fontSize: 16, fontWeight: 'bold' }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) =>
           {
          const p = params[0]
          return `${p.axisValue}<br/>${p.value} ${unit || ''}`
        }
      },
      grid:
       { left: 50, right: 30, bottom: 80, top: 60 },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: {
          rotate: 45,          // tilt labels
          interval: 0,         // show all
          fontSize: 12,
          margin: 12
        }
      },

      yAxis:
       {
        type: 'value',
        name: unit || '',
        nameLocation: 'end',
        nameGap: 16,
        axisLine: { show: true },
        splitLine: { lineStyle: { type: 'dashed' } }
      },
      series: [
        {
          name: unit || 'Value',
          type: 'bar',
          data: values,
          itemStyle: {
            color,
            borderRadius: [4, 4, 0, 0]
          },
          barMaxWidth: 40
        }
      ]
    }

    chart.setOption(option)
             const handleResize = () => chart.resize()
  window.addEventListener('resize', handleResize)
    return () => 
      {
      window.removeEventListener('resize', handleResize)
            chart.dispose()
      chartInstance.current = null
    }
  },     [categories, values, title, unit, fuelType])

  return <div ref={chartRef} style={{ width: '100%', height: 400 }} />
}
