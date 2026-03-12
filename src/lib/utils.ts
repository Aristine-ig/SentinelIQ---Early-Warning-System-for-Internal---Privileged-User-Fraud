import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Severity } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(prefix: string): string {
  return `${prefix}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
}

export function generateAlertId(): string {
  const num = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
  return `ALT-${num}`;
}

export function generateLogId(): string {
  const num = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
  return `LOG-${num}`;
}

export function simulateIP(): string {
  return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

export function isOffHours(date: Date): boolean {
  const hour = date.getHours();
  return hour >= 22 || hour < 6;
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function maskAadhaar(aadhaar: string): string {
  return `XXXX-XXXX-${aadhaar.slice(-4)}`;
}

export function maskPAN(pan: string): string {
  return `${pan.slice(0, 2)}XXXXXXX${pan.slice(-2)}`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function getSeverity(score: number): Severity {
  if (score < 30) return 'Low';
  if (score < 50) return 'Medium';
  if (score < 75) return 'High';
  if (score < 90) return 'Critical';
  return 'Severe';
}

export function getSeverityBg(severity: Severity): string {
  const map: Record<Severity, string> = {
    Low: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    Medium: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    High: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    Critical: 'bg-red-500/20 text-red-300 border-red-500/40',
    Severe: 'bg-rose-500/30 text-rose-200 border-rose-400/60',
  };
  return map[severity];
}

export function getSeverityColor(severity: Severity): string {
  const map: Record<Severity, string> = {
    Low: '#10b981',
    Medium: '#f59e0b',
    High: '#f97316',
    Critical: '#ef4444',
    Severe: '#fb7185',
  };
  return map[severity];
}

export function subtractDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export function subtractMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString();
}

export function subtractMinutes(minutes: number, from?: string): string {
  const d = from ? new Date(from) : new Date();
  d.setMinutes(d.getMinutes() - minutes);
  return d.toISOString();
}

export function minutesDiff(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 60000;
}
