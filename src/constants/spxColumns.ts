export const SPX_53_ORIGINAL_COLUMNS: readonly string[] = [
  'Order ID',
  'SLS Tracking Number',
  'Shopee Order SN',
  'Longitude',
  'Latitude',
  'Sort Code Name',
  'Ward Name',
  'Location Type',
  'Driver ID',
  'Driver Name',
  'Driver Phone',
  'Received Time',
  'Current Station Received Time',
  'Delivering Time',
  'Delivered Time',
  'OnHold Time',
  'OnHoldReason',
  'Reschedule Date',
  'Status',
  'Reject remark',
  'COD Amount',
  'Manifest Number',
  'Order Account',
  'Original ASF',
  'Rounding ASF',
  'Total of On Hold Times',
  'Reschedule Time',
  'Delivery Attempts',
  'Bulky Type',
  'SLA Target Date',
  'Time to SLA',
  'Payment Method',
  'Current Station',
  'Shop ID',
  'Shop Category',
  'High Value',
  'Co-Check',
  'Zone ID',
  'Zone',
  'Destination Station',
  'Next Station',
  'Pickup Station',
  'Driver Contract Type',
  'Collected Time',
  'Transported to sp time',
  'SLA Tag',
  'Allow Partial Delivery',
  'Partial Delivery Tag',
  'Specical Dg Type',
  'Damaged Tag',
  'Return Destination',
  'Chargeable Weight',
  'Cache Type',
] as const;

export const CYCLE_COUNT_APPENDED_COLUMNS = [
  'Địa chỉ',
  'Cycle Count Time',
  'Cycle Count Status',
] as const;

export interface SampleOrderTemplate {
  orderId: string;
  sortCode: string;
  ward: string;
  locationType: string;
  deliveringTime: string;
  onHoldTime: string;
  onHoldReason: string;
  codAmount?: string;
  totalOnHoldTimes?: string;
  address?: string;
}

export const SAMPLE_SPX_ORDERS: SampleOrderTemplate[] = [
  {
    orderId: 'SPXVN069287747489',
    sortCode: 'SOC-SGN-01',
    ward: 'Phường Bến Nghé, Quận 1',
    locationType: 'Commercial Building',
    deliveringTime: '2026-09-15 08:30:15',
    onHoldTime: '2026-09-15 11:20:45',
    onHoldReason: 'Customer requested reschedule',
    codAmount: '185,000 VND',
    totalOnHoldTimes: '1',
    address: 'Tòa nhà Bitexco, 2 Hải Triều, P. Bến Nghé, Q.1',
  },
  {
    orderId: 'SPXVN068234675589',
    sortCode: 'SOC-SGN-02',
    ward: 'Phường Tân Định, Quận 1',
    locationType: 'Residential',
    deliveringTime: '2026-09-15 09:15:20',
    onHoldTime: '2026-09-15 14:05:10',
    onHoldReason: 'Recipient reject',
    codAmount: '320,000 VND',
    totalOnHoldTimes: '2',
    address: '45 Trần Khánh Dư, P. Tân Định, Q.1',
  },
  {
    orderId: 'SPXVN067123456789',
    sortCode: 'SOC-SGN-03',
    ward: 'Phường Võ Thị Sáu, Quận 3',
    locationType: 'Shop House',
    deliveringTime: '2026-09-15 09:40:00',
    onHoldTime: '2026-09-15 15:30:22',
    onHoldReason: 'Reject - Buyers change their mind',
    codAmount: '0 VND',
    totalOnHoldTimes: '1',
    address: '112 Nguyễn Đình Chiểu, P. Võ Thị Sáu, Q.3',
  },
  {
    orderId: 'SPXVN066987123456',
    sortCode: 'SOC-SGN-01',
    ward: 'Phường Đa Kao, Quận 1',
    locationType: 'Office Tower',
    deliveringTime: '2026-09-15 10:12:00',
    onHoldTime: '2026-09-15 13:45:00',
    onHoldReason: 'Reject - Wrong item',
    codAmount: '540,000 VND',
    totalOnHoldTimes: '1',
    address: '36 Đinh Tiên Hoàng, P. Đa Kao, Q.1',
  },
  {
    orderId: 'SPXVN065432198765',
    sortCode: 'SOC-SGN-04',
    ward: 'Phường 12, Quận Bình Thạnh',
    locationType: 'Apartment Complex',
    deliveringTime: '2026-09-15 10:30:40',
    onHoldTime: '2026-09-15 14:20:18',
    onHoldReason: 'Khách hẹn giao lại sau 18h tối do đi vắng',
    codAmount: '210,000 VND',
    totalOnHoldTimes: '2',
    address: 'Chung cư Mỹ Phước, 280 Bùi Hữu Nghĩa, P.12, Bình Thạnh',
  },
  {
    orderId: 'SPXVN064567890123',
    sortCode: 'SOC-SGN-02',
    ward: 'Phường Thảo Điền, TP Thủ Đức',
    locationType: 'Villa / Compound',
    deliveringTime: '2026-09-15 11:00:12',
    onHoldTime: '2026-09-15 16:10:05',
    onHoldReason: '', // Empty reason to test "Không có lý do OnHold"
    codAmount: '95,000 VND',
    totalOnHoldTimes: '1',
    address: '18 Quốc Hương, P. Thảo Điền, TP Thủ Đức',
  },
  {
    orderId: 'SPXVN063345678901',
    sortCode: 'SOC-SGN-05',
    ward: 'Phường An Phú, TP Thủ Đức',
    locationType: 'Condominium',
    deliveringTime: '2026-09-15 11:45:50',
    onHoldTime: '2026-09-15 16:40:11',
    onHoldReason: 'Chờ người nhận chuyển khoản xác nhận COD',
    codAmount: '450,000 VND',
    totalOnHoldTimes: '1',
    address: 'Masteri An Phú, 179 Xa Lộ Hà Nội, P. An Phú, TP Thủ Đức',
  },
  {
    orderId: 'SPXVN062901234567',
    sortCode: 'SOC-SGN-03',
    ward: 'Phường 4, Quận Tân Bình',
    locationType: 'Commercial',
    deliveringTime: '2026-09-15 13:10:25',
    onHoldTime: '2026-09-15 16:55:00',
    onHoldReason: 'Severe weather delay / Heavy rain flood',
    codAmount: '120,000 VND',
    totalOnHoldTimes: '3',
    address: '88 Bạch Đằng, P.4, Q. Tân Bình',
  },
];

/**
 * Builds a realistic 53-column row matching SPX format
 */
export function buildSampleSpxRow(sample: SampleOrderTemplate, index: number): Record<string, string> {
  const row: Record<string, string> = {};
  
  SPX_53_ORIGINAL_COLUMNS.forEach((col) => {
    switch (col) {
      case 'Order ID':
        row[col] = sample.orderId;
        break;
      case 'SLS Tracking Number':
        row[col] = `VN${sample.orderId.slice(5)}SLS`;
        break;
      case 'Shopee Order SN':
        row[col] = `260915${100000 + index}SP`;
        break;
      case 'Longitude':
        row[col] = '106.7009';
        break;
      case 'Latitude':
        row[col] = '10.7769';
        break;
      case 'Sort Code Name':
        row[col] = sample.sortCode;
        break;
      case 'Ward Name':
        row[col] = sample.ward;
        break;
      case 'Location Type':
        row[col] = sample.locationType;
        break;
      case 'Driver ID':
        row[col] = `DRV-${8800 + (index % 5)}`;
        break;
      case 'Driver Name':
        row[col] = ['Nguyễn Văn Tuấn', 'Trần Đình Hoàng', 'Lê Hữu Phúc', 'Phạm Minh Đức'][index % 4];
        break;
      case 'Driver Phone':
        row[col] = `09${(87654321 + index).toString().slice(0, 8)}`;
        break;
      case 'Received Time':
        row[col] = '2026-09-15 06:15:00';
        break;
      case 'Current Station Received Time':
        row[col] = '2026-09-15 07:05:22';
        break;
      case 'Delivering Time':
        row[col] = sample.deliveringTime;
        break;
      case 'Delivered Time':
        row[col] = '';
        break;
      case 'OnHold Time':
        row[col] = sample.onHoldTime;
        break;
      case 'OnHoldReason':
        row[col] = sample.onHoldReason;
        break;
      case 'Reschedule Date':
        row[col] = sample.onHoldReason.includes('reschedule') ? '2026-09-16' : '';
        break;
      case 'Status':
        row[col] = 'ON_HOLD';
        break;
      case 'Reject remark':
        row[col] = '';
        break;
      case 'COD Amount':
        row[col] = sample.codAmount || `${(150000 + index * 45000).toLocaleString('vi-VN')} VND`;
        break;
      case 'Manifest Number':
        row[col] = 'MNF-20260915-09';
        break;
      case 'Order Account':
        row[col] = 'VN_RETAIL_SELLER';
        break;
      case 'Original ASF':
        row[col] = '25000';
        break;
      case 'Rounding ASF':
        row[col] = '25000';
        break;
      case 'Total of On Hold Times':
        row[col] = sample.totalOnHoldTimes || `${(index % 3) + 1}`;
        break;
      case 'Reschedule Time':
        row[col] = sample.onHoldReason.includes('reschedule') ? '2026-09-16 09:00:00' : '';
        break;
      case 'Delivery Attempts':
        row[col] = '1';
        break;
      case 'Bulky Type':
        row[col] = 'Standard Parcel';
        break;
      case 'SLA Target Date':
        row[col] = '2026-09-15 22:00:00';
        break;
      case 'Time to SLA':
        row[col] = '4.5 hrs';
        break;
      case 'Payment Method':
        row[col] = index % 2 === 0 ? 'COD' : 'ShopeePay';
        break;
      case 'Current Station':
        row[col] = 'SPX Hub Tân Bình';
        break;
      case 'Shop ID':
        row[col] = `SHOP-${92000 + index}`;
        break;
      case 'Shop Category':
        row[col] = 'Electronics & Gadgets';
        break;
      case 'High Value':
        row[col] = index % 3 === 0 ? 'YES' : 'NO';
        break;
      case 'Co-Check':
        row[col] = 'YES';
        break;
      case 'Zone ID':
        row[col] = `ZN-0${(index % 4) + 1}`;
        break;
      case 'Zone':
        row[col] = 'Khu vực Trung tâm';
        break;
      case 'Destination Station':
        row[col] = 'SPX Hub Tân Bình';
        break;
      case 'Next Station':
        row[col] = 'End Station';
        break;
      case 'Pickup Station':
        row[col] = 'SPX Mega Hub Củ Chi';
        break;
      case 'Driver Contract Type':
        row[col] = 'Full-time Rider';
        break;
      case 'Collected Time':
        row[col] = '2026-09-14 20:10:00';
        break;
      case 'Transported to sp time':
        row[col] = '2026-09-15 04:30:00';
        break;
      case 'SLA Tag':
        row[col] = 'Same-Day Target';
        break;
      case 'Allow Partial Delivery':
        row[col] = 'NO';
        break;
      case 'Partial Delivery Tag':
        row[col] = 'NO';
        break;
      case 'Specical Dg Type':
        row[col] = 'None';
        break;
      case 'Damaged Tag':
        row[col] = sample.onHoldReason.includes('Damaged') ? 'YES' : 'NO';
        break;
      case 'Return Destination':
        row[col] = 'N/A';
        break;
      case 'Chargeable Weight':
        row[col] = '0.45 kg';
        break;
      case 'Cache Type':
        row[col] = 'Non-Cache Booking';
        break;
      default:
        row[col] = '';
    }
  });

  return row;
}

/**
 * Creates a sample CSV text string containing the 53 original columns and sample rows
 */
export function generateSampleCsvContent(): string {
  const headers = [...SPX_53_ORIGINAL_COLUMNS];
  const rows = SAMPLE_SPX_ORDERS.map((sample, idx) => {
    const rowObj = buildSampleSpxRow(sample, idx);
    return headers.map((header) => {
      const val = rowObj[header] ?? '';
      // Escape quotes and wrap in quotes if contains comma or newline or quotes
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}
