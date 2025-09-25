import { useEffect, useMemo, useState } from 'react';
import EChartBar from './components/EChartBar';
import type { RspRecord } from './types';

// Month order
const CY_MONTH_ORDER = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FY_MONTH_ORDER = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];

// Month name mapping
function monthShortFromLabel(label: string): string {
  const m = label.split(',')[0].trim();
  if (!m) return '';
  const mapping: Record<string, string> = {
    january:'Jan', february:'Feb', march:'Mar', april:'Apr', may:'May', june:'Jun',
    july:'Jul', august:'Aug', september:'Sep', october:'Oct', november:'Nov', december:'Dec',
    jan:'Jan', feb:'Feb', mar:'Mar', apr:'Apr', jun:'Jun', jul:'Jul', aug:'Aug', sep:'Sep', oct:'Oct', nov:'Nov', dec:'Dec'
  };
  const key = m.toLowerCase();
  return mapping[key] || (m.charAt(0).toUpperCase() + m.slice(1,3).toLowerCase());
}

// CSV parser
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let i = 0, cur = '', inQuotes = false;
  let curRow: string[] = [];

  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < text.length && text[i + 1] === '"') {
        cur += '"'; i += 2; continue;
      }
      inQuotes = !inQuotes; i++; continue;
    }
    if (!inQuotes && (ch === ',' || ch === '\n' || ch === '\r')) {
      curRow.push(cur); cur = '';
      if (ch === '\n') { rows.push(curRow); curRow = []; }
      i++;
      if (ch === '\r' && i < text.length && text[i] === '\n') { i++; rows.push(curRow); curRow = []; }
      continue;
    }
    cur += ch; i++;
  }
  if (cur.length > 0 || inQuotes) curRow.push(cur);
  if (curRow.length) rows.push(curRow);
  return rows;
}

function findPriceIndex(header: string[]) {
  for (let i = 0; i < header.length; i++) {
    const h = header[i].toLowerCase();
    if (h.includes('retail') || h.includes('rsp') || h.includes('selling price') || h.includes('price')) return i;
  }
  return header.length - 1;
}

// Robust price parser
function parsePrice(priceRaw: string): number {
  if (!priceRaw) return 0;
  const cleaned = priceRaw.replace(/[^\d.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function App() {
  const [rawRecords, setRawRecords] = useState<RspRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedFuel, setSelectedFuel] = useState<string>('Petrol');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [yearMode, setYearMode] = useState<'FY' | 'CY'>('FY');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const r = await fetch('/RSP.csv');
        if (!r.ok) throw new Error('Failed to fetch RSP.csv. Put it in public/RSP.csv');
        const txt = await r.text();
        const rows = parseCSV(txt);
        if (rows.length < 2) { setError('CSV seems empty or malformed'); setLoading(false); return; }

        const header = rows[0].map(h => h.trim());
        const priceIdx = findPriceIndex(header);

        const parsed: RspRecord[] = [];
        for (let rIdx = 1; rIdx < rows.length; rIdx++) {
          const row = rows[rIdx];
          if (!row || row.length === 0) continue;
          while (row.length < header.length) row.push('');
          const country = (row[0] ?? '').trim();
          const yearLabel = (row[1] ?? '').replace(/["']/g, '').trim();
          const monthLabel = (row[2] ?? '').trim();
          const dateISO = (row[3] ?? '').trim();
          const product = (row[4] ?? '').trim();
          const city = (row[5] ?? '').trim();
          const priceNum = parsePrice(row[priceIdx] ?? '');
          parsed.push({ country, yearLabel, monthLabel, dateISO, product, city, price: priceNum });
        }

        setRawRecords(parsed);
        const cities = Array.from(new Set(parsed.map(r => r.city).filter(Boolean))).sort();
        setSelectedCity(cities[0] ?? '');
        setSelectedFuel(parsed.find(p => p.product)?.product || 'Petrol');
        setLoading(false);
      } catch (err: any) {
        setError(String(err.message || err));
        setLoading(false);
      }
    }
    load();
  }, []);

  const cities = useMemo(() => Array.from(new Set(rawRecords.map(r => r.city).filter(Boolean))).sort(), [rawRecords]);
  const fuels = useMemo(() => Array.from(new Set(rawRecords.map(r => r.product).filter(Boolean))).sort(), [rawRecords]);

  const years = useMemo(() => {
    const set = new Set<string>();
    rawRecords.forEach(r => {
      if (!r.dateISO) return;
      const d = new Date(r.dateISO);
      if (isNaN(d.getTime())) return;
      if (yearMode === 'FY') {
        const month = d.getMonth() + 1;
        const fyStartYear = month >= 4 ? d.getFullYear() : d.getFullYear() - 1;
        set.add(`${fyStartYear}-${fyStartYear+1}`);
      } else {
        set.add(`${d.getFullYear()}`);
      }
    });
    return Array.from(set).sort();
  }, [rawRecords, yearMode]);

  useEffect(() => {
    if (years.length && !selectedYear) setSelectedYear(years[0]);
  }, [years, selectedYear]);

  const { categories, values } = useMemo(() => {
    const cats = yearMode === 'FY' ? FY_MONTH_ORDER : CY_MONTH_ORDER;
    const sums: Record<string, { sum: number; count: number }> = {};
    cats.forEach(m => { sums[m] = { sum: 0, count: 0 }; });

    rawRecords.forEach(r => {
      if (!r.city || !r.product || !r.dateISO) return;
      if (selectedCity && r.city !== selectedCity) return;
      if (selectedFuel && r.product !== selectedFuel) return;
      const d = new Date(r.dateISO);
      if (isNaN(d.getTime())) return;

      let yearKey = '';
      if (yearMode === 'FY') {
        const month = d.getMonth() + 1;
        const fyStartYear = month >= 4 ? d.getFullYear() : d.getFullYear() - 1;
        yearKey = `${fyStartYear}-${fyStartYear+1}`;
      } else {
        yearKey = `${d.getFullYear()}`;
      }
      if (selectedYear && yearKey !== selectedYear) return;

      const mshort = monthShortFromLabel(r.monthLabel);
      if (!mshort) return;
      if (!sums[mshort]) sums[mshort] = { sum: 0, count: 0 };
      sums[mshort].sum += r.price;
      sums[mshort].count += 1;
    });

    const vals = cats.map(m => {
      const entry = sums[m];
      return entry && entry.count > 0 ? Number((entry.sum / entry.count).toFixed(2)) : 0;
    });
    return { categories: cats, values: vals };
  }, [rawRecords, selectedCity, selectedFuel, selectedYear, yearMode]);

  if (loading) return <div style={{ padding:24 }}>Loading dataset...</div>;
  if (error) return <div style={{ padding:24, color:'red' }}>Error: {error}</div>;

  return (
    <div className="container" style={{ padding: 20 }}>
      <div className="header" style={{ marginBottom: 20 }}>
        <h2>RSP - Petrol & Diesel (Monthly Average)</h2>
        <p style={{ color:'#6b7280' }}>Choose metro city, fuel type, and year mode</p>
      </div>

      <div className="controls" style={{ display:'flex', gap:20, marginBottom:20 }}>
        <div>
          <label>Metro City</label><br />
          <select value={selectedCity} onChange={e => setSelectedCity(e.target.value)}>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label>Fuel Type</label><br />
          <select value={selectedFuel} onChange={e => setSelectedFuel(e.target.value)}>
            {fuels.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        <div>
          <label>Year Mode</label><br />
          <select value={yearMode} onChange={e => setYearMode(e.target.value as 'FY'|'CY')}>
            <option value="FY">Financial Year</option>
            <option value="CY">Calendar Year</option>
          </select>
        </div>

        <div>
          <label>{yearMode === 'FY' ? 'Financial Year' : 'Calendar Year'}</label><br />
          <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="chart-wrapper">
        {values.every(v => v === 0) ? (
          <div style={{ padding:20 }}>No data for selected combination</div>
        ) : (
          <EChartBar
            categories={categories}
            values={values}
            title={`${selectedFuel} — ${selectedCity} — ${selectedYear} (${yearMode})`}
            unit="INR/L"
            fuelType={selectedFuel}
          />
        )}
      </div>

      <div className="footer" style={{ marginTop: 20, fontSize: 12, color:'#6b7280' }}>
        Data: National Data & Analytics Platform (NITI Aayog). Missing values treated as 0.
      </div>
    </div>
  );
}

export default App;
