import type { Station } from '../types.js';

/**
 * A sample of major Indian Railways stations.
 *
 * This is bundled reference data for the offline `mock` provider and for
 * resolving station names to codes. It is a representative subset (not the
 * full ~7,000 station list) and coordinates are approximate.
 */
export const STATIONS: Station[] = [
  { code: 'NDLS', name: 'New Delhi', state: 'Delhi', zone: 'NR', lat: 28.6431, lon: 77.2197 },
  { code: 'DLI', name: 'Delhi Junction', state: 'Delhi', zone: 'NR', lat: 28.6614, lon: 77.2275 },
  { code: 'NZM', name: 'Hazrat Nizamuddin', state: 'Delhi', zone: 'NR', lat: 28.5883, lon: 77.2519 },
  { code: 'ANVT', name: 'Anand Vihar Terminal', state: 'Delhi', zone: 'NR', lat: 28.6469, lon: 77.3155 },
  { code: 'DEE', name: 'Delhi Sarai Rohilla', state: 'Delhi', zone: 'NR', lat: 28.6642, lon: 77.1878 },

  { code: 'CSMT', name: 'Chhatrapati Shivaji Maharaj Terminus', state: 'Maharashtra', zone: 'CR', lat: 18.9401, lon: 72.8353 },
  { code: 'BCT', name: 'Mumbai Central', state: 'Maharashtra', zone: 'WR', lat: 18.9712, lon: 72.8194 },
  { code: 'LTT', name: 'Lokmanya Tilak Terminus', state: 'Maharashtra', zone: 'CR', lat: 19.0679, lon: 72.8994 },
  { code: 'BDTS', name: 'Bandra Terminus', state: 'Maharashtra', zone: 'WR', lat: 19.0622, lon: 72.8406 },
  { code: 'DR', name: 'Dadar', state: 'Maharashtra', zone: 'CR', lat: 19.0186, lon: 72.8442 },
  { code: 'TNA', name: 'Thane', state: 'Maharashtra', zone: 'CR', lat: 19.1863, lon: 72.9756 },
  { code: 'KYN', name: 'Kalyan Junction', state: 'Maharashtra', zone: 'CR', lat: 19.2437, lon: 73.1300 },
  { code: 'PUNE', name: 'Pune Junction', state: 'Maharashtra', zone: 'CR', lat: 18.5286, lon: 73.8742 },
  { code: 'NGP', name: 'Nagpur Junction', state: 'Maharashtra', zone: 'CR', lat: 21.1530, lon: 79.0886 },
  { code: 'BSL', name: 'Bhusaval Junction', state: 'Maharashtra', zone: 'CR', lat: 21.0450, lon: 75.7850 },
  { code: 'NK', name: 'Nashik Road', state: 'Maharashtra', zone: 'CR', lat: 19.9483, lon: 73.8370 },
  { code: 'ST', name: 'Surat', state: 'Gujarat', zone: 'WR', lat: 21.2050, lon: 72.8410 },
  { code: 'BRC', name: 'Vadodara Junction', state: 'Gujarat', zone: 'WR', lat: 22.3100, lon: 73.1810 },
  { code: 'ADI', name: 'Ahmedabad Junction', state: 'Gujarat', zone: 'WR', lat: 23.0258, lon: 72.5873 },
  { code: 'RJT', name: 'Rajkot Junction', state: 'Gujarat', zone: 'WR', lat: 22.3039, lon: 70.8022 },

  { code: 'HWH', name: 'Howrah Junction', state: 'West Bengal', zone: 'ER', lat: 22.5839, lon: 88.3425 },
  { code: 'SDAH', name: 'Sealdah', state: 'West Bengal', zone: 'ER', lat: 22.5675, lon: 88.3703 },
  { code: 'KOAA', name: 'Kolkata', state: 'West Bengal', zone: 'ER', lat: 22.6030, lon: 88.3750 },
  { code: 'NJP', name: 'New Jalpaiguri', state: 'West Bengal', zone: 'NFR', lat: 26.6857, lon: 88.4303 },
  { code: 'ASN', name: 'Asansol Junction', state: 'West Bengal', zone: 'ER', lat: 23.6833, lon: 86.9833 },

  { code: 'MAS', name: 'MGR Chennai Central', state: 'Tamil Nadu', zone: 'SR', lat: 13.0827, lon: 80.2757 },
  { code: 'MS', name: 'Chennai Egmore', state: 'Tamil Nadu', zone: 'SR', lat: 13.0790, lon: 80.2610 },
  { code: 'CBE', name: 'Coimbatore Junction', state: 'Tamil Nadu', zone: 'SR', lat: 10.9975, lon: 76.9674 },
  { code: 'MDU', name: 'Madurai Junction', state: 'Tamil Nadu', zone: 'SR', lat: 9.9195, lon: 78.1193 },
  { code: 'TPJ', name: 'Tiruchirappalli Junction', state: 'Tamil Nadu', zone: 'SR', lat: 10.7950, lon: 78.6890 },

  { code: 'SBC', name: 'KSR Bengaluru City Junction', state: 'Karnataka', zone: 'SWR', lat: 12.9784, lon: 77.5726 },
  { code: 'YPR', name: 'Yesvantpur Junction', state: 'Karnataka', zone: 'SWR', lat: 13.0237, lon: 77.5370 },
  { code: 'MYS', name: 'Mysuru Junction', state: 'Karnataka', zone: 'SWR', lat: 12.3125, lon: 76.6394 },
  { code: 'UBL', name: 'Hubballi Junction', state: 'Karnataka', zone: 'SWR', lat: 15.3450, lon: 75.1370 },
  { code: 'MAJN', name: 'Mangaluru Junction', state: 'Karnataka', zone: 'SR', lat: 12.8700, lon: 74.8800 },

  { code: 'SC', name: 'Secunderabad Junction', state: 'Telangana', zone: 'SCR', lat: 17.4344, lon: 78.5013 },
  { code: 'HYB', name: 'Hyderabad Deccan (Nampally)', state: 'Telangana', zone: 'SCR', lat: 17.3850, lon: 78.4750 },
  { code: 'KCG', name: 'Kacheguda', state: 'Telangana', zone: 'SCR', lat: 17.3900, lon: 78.5000 },
  { code: 'BZA', name: 'Vijayawada Junction', state: 'Andhra Pradesh', zone: 'SCR', lat: 16.5170, lon: 80.6200 },
  { code: 'VSKP', name: 'Visakhapatnam Junction', state: 'Andhra Pradesh', zone: 'ECoR', lat: 17.7270, lon: 83.3040 },
  { code: 'TPTY', name: 'Tirupati', state: 'Andhra Pradesh', zone: 'SCR', lat: 13.6288, lon: 79.4192 },

  { code: 'ERS', name: 'Ernakulam Junction', state: 'Kerala', zone: 'SR', lat: 9.9700, lon: 76.2870 },
  { code: 'TVC', name: 'Thiruvananthapuram Central', state: 'Kerala', zone: 'SR', lat: 8.4880, lon: 76.9510 },
  { code: 'CLT', name: 'Kozhikode', state: 'Kerala', zone: 'SR', lat: 11.2480, lon: 75.7790 },

  { code: 'JP', name: 'Jaipur Junction', state: 'Rajasthan', zone: 'NWR', lat: 26.9196, lon: 75.7880 },
  { code: 'JU', name: 'Jodhpur Junction', state: 'Rajasthan', zone: 'NWR', lat: 26.2950, lon: 73.0240 },
  { code: 'AII', name: 'Ajmer Junction', state: 'Rajasthan', zone: 'NWR', lat: 26.4610, lon: 74.6390 },
  { code: 'UDZ', name: 'Udaipur City', state: 'Rajasthan', zone: 'NWR', lat: 24.5800, lon: 73.6900 },
  { code: 'KOTA', name: 'Kota Junction', state: 'Rajasthan', zone: 'WCR', lat: 25.1800, lon: 75.8400 },

  { code: 'LKO', name: 'Lucknow Charbagh', state: 'Uttar Pradesh', zone: 'NR', lat: 26.8310, lon: 80.9230 },
  { code: 'CNB', name: 'Kanpur Central', state: 'Uttar Pradesh', zone: 'NCR', lat: 26.4550, lon: 80.3500 },
  { code: 'ALD', name: 'Prayagraj Junction', state: 'Uttar Pradesh', zone: 'NCR', lat: 25.4400, lon: 81.8300 },
  { code: 'BSB', name: 'Varanasi Junction', state: 'Uttar Pradesh', zone: 'NER', lat: 25.3270, lon: 82.9860 },
  { code: 'AGC', name: 'Agra Cantt', state: 'Uttar Pradesh', zone: 'NCR', lat: 27.1570, lon: 77.9900 },
  { code: 'MTJ', name: 'Mathura Junction', state: 'Uttar Pradesh', zone: 'NCR', lat: 27.4900, lon: 77.6700 },
  { code: 'GKP', name: 'Gorakhpur Junction', state: 'Uttar Pradesh', zone: 'NER', lat: 26.7600, lon: 83.3700 },

  { code: 'PNBE', name: 'Patna Junction', state: 'Bihar', zone: 'ECR', lat: 25.6020, lon: 85.1370 },
  { code: 'DNR', name: 'Danapur', state: 'Bihar', zone: 'ECR', lat: 25.6300, lon: 85.0500 },
  { code: 'MFP', name: 'Muzaffarpur Junction', state: 'Bihar', zone: 'ECR', lat: 26.1200, lon: 85.3900 },
  { code: 'GAYA', name: 'Gaya Junction', state: 'Bihar', zone: 'ECR', lat: 24.7900, lon: 85.0000 },

  { code: 'BPL', name: 'Bhopal Junction', state: 'Madhya Pradesh', zone: 'WCR', lat: 23.2680, lon: 77.4020 },
  { code: 'INDB', name: 'Indore Junction', state: 'Madhya Pradesh', zone: 'WR', lat: 22.7200, lon: 75.8600 },
  { code: 'JBP', name: 'Jabalpur Junction', state: 'Madhya Pradesh', zone: 'WCR', lat: 23.1700, lon: 79.9400 },
  { code: 'GWL', name: 'Gwalior Junction', state: 'Madhya Pradesh', zone: 'NCR', lat: 26.2200, lon: 78.1700 },
  { code: 'JHS', name: 'Jhansi Junction', state: 'Uttar Pradesh', zone: 'NCR', lat: 25.4500, lon: 78.5800 },
  { code: 'ET', name: 'Itarsi Junction', state: 'Madhya Pradesh', zone: 'WCR', lat: 22.6100, lon: 77.7600 },

  { code: 'BBS', name: 'Bhubaneswar', state: 'Odisha', zone: 'ECoR', lat: 20.2700, lon: 85.8400 },
  { code: 'PURI', name: 'Puri', state: 'Odisha', zone: 'ECoR', lat: 19.8100, lon: 85.8300 },
  { code: 'CTC', name: 'Cuttack', state: 'Odisha', zone: 'ECoR', lat: 20.4700, lon: 85.8800 },

  { code: 'ASR', name: 'Amritsar Junction', state: 'Punjab', zone: 'NR', lat: 31.6340, lon: 74.8720 },
  { code: 'LDH', name: 'Ludhiana Junction', state: 'Punjab', zone: 'NR', lat: 30.9120, lon: 75.8520 },
  { code: 'JUC', name: 'Jalandhar City', state: 'Punjab', zone: 'NR', lat: 31.3260, lon: 75.5760 },
  { code: 'UMB', name: 'Ambala Cantt Junction', state: 'Haryana', zone: 'NR', lat: 30.3780, lon: 76.8320 },
  { code: 'CDG', name: 'Chandigarh', state: 'Chandigarh', zone: 'NR', lat: 30.7050, lon: 76.8000 },

  { code: 'DDN', name: 'Dehradun', state: 'Uttarakhand', zone: 'NR', lat: 30.3160, lon: 78.0320 },
  { code: 'HW', name: 'Haridwar Junction', state: 'Uttarakhand', zone: 'NR', lat: 29.9450, lon: 78.1640 },
  { code: 'JAT', name: 'Jammu Tawi', state: 'Jammu and Kashmir', zone: 'NR', lat: 32.7050, lon: 74.8580 },
  { code: 'GHY', name: 'Guwahati', state: 'Assam', zone: 'NFR', lat: 26.1830, lon: 91.7500 },
  { code: 'RNC', name: 'Ranchi Junction', state: 'Jharkhand', zone: 'SER', lat: 23.3700, lon: 85.3300 },
  { code: 'TATA', name: 'Tatanagar Junction', state: 'Jharkhand', zone: 'SER', lat: 22.7800, lon: 86.2000 },
  { code: 'R', name: 'Raipur Junction', state: 'Chhattisgarh', zone: 'SECR', lat: 21.2400, lon: 81.6300 },
  { code: 'MAO', name: 'Madgaon Junction', state: 'Goa', zone: 'KR', lat: 15.2700, lon: 73.9600 },
];

/** Fast lookup by station code. */
export const STATION_BY_CODE = new Map<string, Station>(
  STATIONS.map((s) => [s.code, s]),
);
