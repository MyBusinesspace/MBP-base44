import { useState, useEffect } from 'react';
import { AppSettings } from '@/entities/all';

export const CURRENCIES = [
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham', flag: '🇦🇪' },
  { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
  { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧' },
  { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal', flag: '🇸🇦' },
  { code: 'QAR', symbol: 'QAR', name: 'Qatari Riyal', flag: '🇶🇦' },
  { code: 'KWD', symbol: 'KWD', name: 'Kuwaiti Dinar', flag: '🇰🇼' },
  { code: 'BHD', symbol: 'BHD', name: 'Bahraini Dinar', flag: '🇧🇭' },
  { code: 'OMR', symbol: 'OMR', name: 'Omani Rial', flag: '🇴🇲' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', flag: '🇨🇦' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', flag: '🇦🇺' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', flag: '🇨🇭' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', flag: '🇯🇵' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', flag: '🇨🇳' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', flag: '🇮🇳' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', flag: '🇸🇬' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', flag: '🇲🇾' },
  { code: 'EGP', symbol: 'EGP', name: 'Egyptian Pound', flag: '🇪🇬' },
  { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee', flag: '🇵🇰' },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', flag: '🇧🇩' },
];

export function getCurrencySymbol(code) {
  const currency = CURRENCIES.find(c => c.code === code);
  return currency?.symbol || code || 'AED';
}

let cachedCurrencyCode = null;
let cacheTime = 0;

export function usePayrollCurrency() {
  const [currencyCode, setCurrencyCode] = useState(cachedCurrencyCode || 'AED');

  useEffect(() => {
    const now = Date.now();
    if (cachedCurrencyCode && now - cacheTime < 60000) {
      setCurrencyCode(cachedCurrencyCode);
      return;
    }
    AppSettings.filter({ setting_key: 'payroll_currency_code' }).then(results => {
      const code = results[0]?.setting_value || 'AED';
      cachedCurrencyCode = code;
      cacheTime = Date.now();
      setCurrencyCode(code);
    }).catch(() => {});
  }, []);

  const symbol = getCurrencySymbol(currencyCode);

  const format = (amount) => {
    const num = (amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${symbol} ${num}`;
  };

  return { currencyCode, symbol, format };
}