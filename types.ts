import type React from 'react';

// Enums for status
export enum AppointmentStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW'
}

// General Settings Domain
export interface SalonSettings {
  name: string;
  // Address (structured)
  address: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
  neighborhood: string;
  // Contact
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  logoUrl: string | null;
  // Social media
  instagram: string;
  facebook: string;
  tiktok: string;
  googleMapsUrl: string;
  // Business
  businessRegistration: string;
  currency: string;
  vatRate: number;
  schedule?: WorkSchedule;
}

// Shared Types
export interface DateRange {
  from: Date;
  to: Date;
  label?: string; // e.g., "Today", "Last 7 Days"
}

// Service & Products Domain
export interface ServiceVariant {
  id: string;
  name: string; // e.g., "Short Hair", "Long Hair"
  durationMinutes: number;
  price: number;
  cost: number; // Internal cost for profit calculation
  additionalCost: number; // Extra material cost (caps, tips, accessories)
}

export interface ServiceCategory {
  id: string;
  name: string;
  color: string;
  icon?: string;
  sortOrder?: number;
}

export interface ServiceSettings {
  defaultDuration: number;
  defaultVariantName: string;
  showCostsInList: boolean;
  defaultView: 'card' | 'table';
}

export interface Service {
  id: string;
  name: string;
  categoryId: string;
  description: string;
  variants: ServiceVariant[];
  active: boolean;
  price?: number;
  durationMinutes?: number;
}

export interface ProductSettings {
  lowStockThreshold: number;
  showCostsInList: boolean;
  defaultView: 'card' | 'table';
}

// Product Domain
export type UsageType = 'internal' | 'retail' | 'both';

export interface ProductCategory {
  id: string;
  name: string;
  color: string;
  sortOrder?: number;
}

export interface Brand {
  id: string;
  name: string;
  supplierId?: string;
  supplierName?: string;
  color: string;
  sortOrder?: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  brandId?: string;
  brand?: string;
  usageType: UsageType;
  price: number;
  cost: number; // Cost per item
  sku: string; // Stock Keeping Unit
  barcode?: string;
  stock: number;
  supplierId?: string;
  supplier?: string;
  active: boolean;
}

// Supplier Domain
export interface Supplier {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  website?: string;
  address?: string;
  category: string; // e.g. 'Produits', 'Matériel', 'Charges'
  paymentTerms?: string; // e.g. '30 jours fin de mois'
  active: boolean;
  notes?: string;
}

// Staff/Team Domain
export interface WorkDay {
  isOpen: boolean;
  start: string; // "09:00"
  end: string;   // "18:00"
}

export interface WorkSchedule {
  monday: WorkDay;
  tuesday: WorkDay;
  wednesday: WorkDay;
  thursday: WorkDay;
  friday: WorkDay;
  saturday: WorkDay;
  sunday: WorkDay;
}

export interface BonusTier {
  target: number; // Revenue target (CA)
  bonus: number;  // Bonus amount
}

export interface StaffMember {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  role: 'Manager' | 'Stylist' | 'Assistant' | 'Receptionist';
  email: string;
  phone: string;
  color: string; // For calendar
  photoUrl?: string;
  bio?: string;
  skills: string[]; // IDs of categories or services they can perform
  active: boolean;
  membershipId?: string;
  deletedAt?: string;

  // HR & Contract
  startDate: string;
  endDate?: string; // For fixed term
  contractType?: 'CDI' | 'CDD' | 'Freelance' | 'Apprentissage' | 'Stage';
  weeklyHours?: number;
  
  // Compensation
  commissionRate: number; // Percentage (0-100)
  baseSalary?: number;
  bonusTiers?: BonusTier[]; // New flexible bonus system
  iban?: string;
  socialSecurityNumber?: string;

  // Personal
  birthDate?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactRelation?: string; // New field
  emergencyContactPhone?: string;

  schedule: WorkSchedule;
}

export type PayoutType = 'SALARY' | 'COMMISSION' | 'BONUS' | 'OTHER';
export type PayoutStatus = 'PENDING' | 'PAID' | 'CANCELLED';

export interface StaffPayout {
  id: string;
  salonId: string;
  staffId: string;
  type: PayoutType;
  status: PayoutStatus;
  amount: number;
  referenceAmount?: number;
  rateSnapshot?: number;
  periodStart: string;
  periodEnd: string;
  paidAt?: string;
  notes?: string;
  createdAt: string;
}

export interface StaffActivityEvent {
  eventType: 'appointment_completed' | 'appointment_cancelled' | 'appointment_no_show' | 'sale';
  eventDate: string;
  description: string;
  clientName: string;
  metadata: Record<string, unknown>;
}

export interface StaffClient {
  clientId: string;
  clientFirstName: string;
  clientLastName: string;
  visitCount: number;
  totalRevenue: number;
  lastVisit: string;
}

// Client Domain
export interface ClientPermissions {
  socialMedia: boolean;
  marketing: boolean;
  other: boolean;
  otherDetail?: string;
}

export interface Client {
  id: string;
  // Section 1: Main
  photoUrl?: string;
  firstName: string;
  lastName: string;
  gender?: 'Homme' | 'Femme';
  ageGroup?: string;
  city?: string;
  profession?: string;
  company?: string;
  notes?: string; // Moved to Section 1
  
  // Section 2: Medical
  allergies?: string;

  // Section 3: Relation
  status?: 'ACTIF' | 'VIP' | 'INACTIF';
  preferredStaffId?: string;

  // Section 4: Contact Extended
  email: string;
  phone: string;
  socialNetwork?: string;
  socialUsername?: string;
  instagram?: string;
  whatsapp?: string;
  preferredChannel?: string; // 'Téléphone', 'WhatsApp', 'Instagram', 'Email', 'Autre'
  otherChannelDetail?: string;
  preferredLanguage?: string;

  // Section 5: Acquisition
  contactDate?: string; // ISO Date
  contactMethod?: string; // 'Walk-in', 'Appel', 'Message'
  messageChannel?: string; // If method is Message
  acquisitionSource?: string;
  acquisitionDetail?: string; // For Influencer name or Other detail

  // Section 6: Permissions
  permissions?: ClientPermissions;

  // Computed/System
  totalVisits: number;
  totalSpent: number;
  firstVisitDate?: string;
  lastVisitDate?: string;
  createdAt: string;
}

// Appointment Domain
export interface Appointment {
  id: string;
  clientId: string;
  clientName: string; // Denormalized for easier display in mock
  serviceId: string;
  serviceName: string; // Denormalized
  date: string; // ISO string
  durationMinutes: number;
  staffId: string;
  staffName: string;
  status: AppointmentStatus;
  variantId?: string;
  variantName: string;
  price: number;
  notes?: string;
  groupId?: string | null;
  deletedAt?: string | null;
}

export interface AppointmentGroup {
  id: string;
  clientId: string;
  clientName: string;
  notes: string;
  reminderMinutes: number | null;
  status: AppointmentStatus;
  appointments: Appointment[];
}

export interface ServiceBlockState {
  id: string;
  categoryId: string | null;
  serviceId: string | null;
  variantId: string | null;
  staffId: string | null;
  date: string | null;
  hour: number | null;
  minute: number;
}

// POS & Cart Domain
export interface CartItem {
  id: string; // Unique ID for the cart line item
  referenceId: string; // ID of the product or service variant
  type: 'SERVICE' | 'PRODUCT';
  name: string;
  variantName?: string;
  price: number; // The ACTUAL selling price (potentially discounted)
  originalPrice?: number; // The reference price before discount
  quantity: number;
  cost?: number; // Added for Profitability calculation
  note?: string; // Reason for discount or modification
  staffId?: string;
  staffName?: string;
  originalItemId?: string;
}

export interface PaymentEntry {
  id: string;
  method: string; // 'Espèces', 'Carte Bancaire', etc.
  amount: number;
  icon?: React.ComponentType; // Optional for UI, handled within component usually
}

export interface Transaction {
  id: string;
  date: string; // ISO String
  total: number;
  clientName?: string;
  clientId?: string;
  appointmentId?: string;
  items: CartItem[];
  payments: PaymentEntry[];
  type: 'SALE' | 'VOID' | 'REFUND';
  originalTransactionId?: string;
  reasonCategory?: string;
  reasonNote?: string;
}

// Accounting Domain
// Changed from Enum to string to support dynamic categories from Settings
export type ExpenseCategory = string; 

// Settings Types
export interface RecurringExpense {
  id: string;
  name: string;
  amount: number;
  frequency: 'Mensuel' | 'Annuel' | 'Hebdomadaire';
  nextDate: string;
}

export interface ExpenseCategorySetting {
  id: string;
  name: string;
  color: string;
}

export type PaymentMethod = 'especes' | 'carte' | 'virement' | 'cheque' | 'prelevement';

export interface Expense {
  id: string;
  date: string;
  description: string;
  category: ExpenseCategory; // ID of the category setting
  amount: number;
  supplier?: string;
  supplierId?: string;
  proofUrl?: string; // For scanned receipt
  paymentMethod?: PaymentMethod;
}

export interface LedgerEntry {
  id: string;
  date: string;
  type: 'INCOME' | 'EXPENSE';
  label: string;
  category: string;
  amount: number;
  details?: Transaction | Expense;
}

// Mock Data Types for Dashboard
export interface KPIData {
  label: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
}

export type ViewState = 'LIST' | 'CALENDAR' | 'DETAILS' | 'ADD' | 'EDIT';
