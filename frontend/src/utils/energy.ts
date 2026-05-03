// Energy monitoring utilities
export const formatPower = (watts: number): string => {
  if (watts >= 1000) {
    return `${(watts / 1000).toFixed(2)} kW`
  }
  return `${watts.toFixed(2)} W`
}

export const formatCurrency = (amount: number, currency: string = 'RM'): string => {
  return `${currency} ${amount.toFixed(2)}`
}

export const calculateRuntime = (powerUsage: number, cost: number): number => {
  // Simple calculation: assumes average rate of 1 RM per 100W per hour
  return (cost / powerUsage) * 100
}
