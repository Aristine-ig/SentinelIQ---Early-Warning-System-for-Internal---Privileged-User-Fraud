import type { AppUser, Customer, AccountStatus } from '@/types';
import { subtractDays, subtractMonths } from './utils';

const FIRST_NAMES = [
  'Aarav', 'Sneha', 'Rohan', 'Priya', 'Vikram', 'Ananya', 'Arjun', 'Kavya',
  'Rahul', 'Pooja', 'Amit', 'Divya', 'Siddharth', 'Meera', 'Kiran', 'Nisha',
  'Rajesh', 'Sunita', 'Deepak', 'Lakshmi', 'Aditya', 'Rekha', 'Suresh', 'Usha',
  'Manish', 'Shilpa', 'Prakash', 'Geeta', 'Vijay', 'Asha', 'Arun', 'Bhavna',
  'Sachin', 'Jyoti', 'Naveen', 'Smita', 'Ajay', 'Lata', 'Sanjay', 'Vandana',
  'Nitin', 'Ritu', 'Pankaj', 'Seema', 'Gaurav', 'Kamla', 'Vinod', 'Archana',
  'Hemant', 'Nidhi', 'Sunil', 'Preeti', 'Manoj', 'Madhuri', 'Rakesh', 'Sarla',
  'Dinesh', 'Pushpa', 'Ramesh', 'Sarita',
];

const LAST_NAMES = [
  'Sharma', 'Patel', 'Singh', 'Kumar', 'Gupta', 'Mehta', 'Joshi', 'Verma',
  'Mishra', 'Agarwal', 'Reddy', 'Nair', 'Iyer', 'Bose', 'Das', 'Roy',
  'Chatterjee', 'Banerjee', 'Mukherjee', 'Pillai', 'Menon', 'Shah', 'Jain',
  'Srivastava', 'Tiwari', 'Yadav', 'Pandey', 'Chaudhary', 'Kapoor', 'Malhotra',
];

const BRANCHES = [
  'Mumbai Main Branch', 'Delhi Connaught Place', 'Bangalore MG Road',
  'Chennai Anna Nagar', 'Hyderabad Banjara Hills', 'Kolkata Park Street',
  'Pune FC Road', 'Ahmedabad CG Road',
];

const BRANCH_IFSC: Record<string, string> = {
  'Mumbai Main Branch':      'SCBK0001001',
  'Delhi Connaught Place':   'SCBK0002001',
  'Bangalore MG Road':       'SCBK0003001',
  'Chennai Anna Nagar':      'SCBK0004001',
  'Hyderabad Banjara Hills': 'SCBK0005001',
  'Kolkata Park Street':     'SCBK0006001',
  'Pune FC Road':            'SCBK0007001',
  'Ahmedabad CG Road':       'SCBK0008001',
};

const EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'rediffmail.com'];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateAadhaar(): string {
  return Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
}

function generatePAN(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return (
    Array.from({ length: 5 }, () => randomItem(letters.split(''))).join('') +
    Array.from({ length: 4 }, () => Math.floor(Math.random() * 10)).join('') +
    randomItem(letters.split(''))
  );
}

function generateAccountNumber(): string {
  return Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
}

function generateMobile(): string {
  const prefixes = ['70', '80', '90', '91', '98', '99', '77', '88'];
  return randomItem(prefixes) + Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join('');
}

export function seedCustomers(): Customer[] {
  const customers: Customer[] = [];
  const usedNames = new Set<string>();

  // Ensure at least 15 Dormant and 10 Inactive
  // Total 60: 15 Dormant, 10 Inactive, 35 Active
  const statuses: AccountStatus[] = [
    ...Array(15).fill('Dormant'),
    ...Array(10).fill('Inactive'),
    ...Array(35).fill('Active'),
  ];

  // Shuffle statuses
  for (let i = statuses.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [statuses[i], statuses[j]] = [statuses[j], statuses[i]];
  }

  for (let i = 0; i < 60; i++) {
    let fullName = '';
    do {
      fullName = `${randomItem(FIRST_NAMES)} ${randomItem(LAST_NAMES)}`;
    } while (usedNames.has(fullName));
    usedNames.add(fullName);

    const status = statuses[i];
    let lastTransactionDate: string;
    let dateOpened: string;

    if (status === 'Dormant') {
      // No activity for 24+ months
      const monthsAgo = randomBetween(24, 48);
      lastTransactionDate = subtractMonths(monthsAgo);
      dateOpened = subtractMonths(monthsAgo + randomBetween(6, 24));
    } else if (status === 'Inactive') {
      // No activity for 12–24 months
      const monthsAgo = randomBetween(13, 23);
      lastTransactionDate = subtractMonths(monthsAgo);
      dateOpened = subtractMonths(monthsAgo + randomBetween(6, 24));
    } else {
      // Active: within last 12 months
      const daysAgo = randomBetween(1, 360);
      lastTransactionDate = subtractDays(daysAgo);
      dateOpened = subtractMonths(randomBetween(1, 60));
    }

    const accountType = randomItem(['Savings', 'Current', 'Fixed Deposit'] as const);
    let balance: number;
    if (accountType === 'Fixed Deposit') {
      balance = randomBetween(50000, 5000000);
    } else if (accountType === 'Current') {
      balance = randomBetween(10000, 2000000);
    } else {
      balance = randomBetween(1000, 500000);
    }

    const kycStatus = randomItem(['Verified', 'Verified', 'Verified', 'Pending', 'Expired'] as const);
    const emailName = fullName.toLowerCase().replace(' ', '.').replace(/[^a-z.]/g, '');
    const branch = randomItem(BRANCHES);

    customers.push({
      id: `CUST${String(i + 1).padStart(4, '0')}`,
      fullName,
      aadhaar: generateAadhaar(),
      pan: generatePAN(),
      accountNumber: generateAccountNumber(),
      accountType,
      balance,
      accountStatus: status,
      lastTransactionDate,
      dateOpened,
      mobile: generateMobile(),
      email: `${emailName}@${randomItem(EMAIL_DOMAINS)}`,
      branch,
      kycStatus,
      bankName: 'SecureBank Ltd.',
      ifscCode: BRANCH_IFSC[branch],
    });
  }

  return customers;
}

export function seedUsers(): AppUser[] {
  return [
    {
      id: 'USR001',
      loginId: 'sneha.patel',
      password: 'Pass@1234',
      fullName: 'Sneha Patel',
      role: 'Teller',
      department: 'Retail Banking',
      systemAccess: 'Core Banking',
      isAdmin: false,
      status: 'active',
      createdAt: subtractDays(180),
    },
    {
      id: 'USR002',
      loginId: 'rohit.mehta',
      password: 'Pass@1234',
      fullName: 'Rohit Mehta',
      role: 'Loan Officer',
      department: 'Credit',
      systemAccess: 'Loan Origination',
      isAdmin: false,
      status: 'active',
      createdAt: subtractDays(365),
    },
    {
      id: 'USR006',
      loginId: 'branch.manager',
      password: 'Pass@1234',
      fullName: 'Rajiv Sharma',
      role: 'Branch Manager',
      department: 'Operations',
      systemAccess: 'All Systems',
      isAdmin: false,
      status: 'active',
      createdAt: subtractDays(400),
    },
    {
      id: 'USR003',
      loginId: 'priya.iyer',
      password: 'Pass@1234',
      fullName: 'Priya Iyer',
      role: 'Treasury Analyst',
      department: 'Treasury',
      systemAccess: 'Treasury',
      isAdmin: false,
      status: 'active',
      createdAt: subtractDays(200),
    },
    {
      id: 'USR004',
      loginId: 'arjun.sharma',
      password: 'Pass@1234',
      fullName: 'Arjun Sharma',
      role: 'DB Administrator',
      department: 'IT',
      systemAccess: 'All Systems',
      isAdmin: false,
      status: 'active',
      createdAt: subtractDays(90),
    },
    {
      id: 'USR005',
      loginId: 'kavita.nair',
      password: 'Pass@1234',
      fullName: 'Kavita Nair',
      role: 'Compliance Officer',
      department: 'Compliance',
      systemAccess: 'Customer Database',
      isAdmin: false,
      status: 'active',
      createdAt: subtractDays(120),
    },
  ];
}

export const ADMIN_USER: AppUser = {
  id: 'ADMIN001',
  loginId: 'admin',
  password: 'admin123',
  fullName: 'System Administrator',
  role: 'IT Admin',
  department: 'Administration',
  systemAccess: 'All Systems',
  isAdmin: true,
  status: 'active',
  createdAt: new Date().toISOString(),
};
