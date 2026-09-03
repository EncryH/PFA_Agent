export type EmergencyReceipt = {
  id: string;
  createdAt: string;
  amount: string;
  bank: string;
  account: string;
  status: "processing";
};

const STORAGE_KEY = "ansimEmergencyReceipts";
const MAX_ENTRIES = 20;
export const EMERGENCY_RECEIPT_EVENT = "ansim-emergency-receipts";

export function readEmergencyReceipts(): EmergencyReceipt[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) as EmergencyReceipt[] : [];
  } catch {
    return [];
  }
}

export function saveEmergencyReceipt(receipt: EmergencyReceipt) {
  const receipts = readEmergencyReceipts().filter((item) => item.id !== receipt.id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([receipt, ...receipts].slice(0, MAX_ENTRIES)));
  window.dispatchEvent(new Event(EMERGENCY_RECEIPT_EVENT));
}
