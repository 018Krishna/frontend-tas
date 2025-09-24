export type RspRecord = {
  country: string
  yearLabel: string // e.g. "Financial Year (Apr - Mar), 2025" or a plain year
  monthLabel: string // e.g. "June, 2025"
  dateISO: string // 2025-06-20
  product: string // Petrol or Diesel
  city: string // Metro city
  price: number // RSP value, missing treated as 0
}
