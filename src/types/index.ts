export type UserRole = 'landlord' | 'tenant';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

/** Landlord business identity — printed on invoices and reports. */
export interface CompanyProfile {
  companyName?: string;
  companyEmail?: string;
  companyPhone?: string;
  companyAddress?: string;
  vatNumber?: string;
  registrationNumber?: string;
}

export type Province =
  | 'Gauteng'
  | 'Western Cape'
  | 'KwaZulu-Natal'
  | 'Eastern Cape'
  | 'Limpopo'
  | 'Mpumalanga'
  | 'North West'
  | 'Free State'
  | 'Northern Cape';

export type PropertyCategory = 'residential' | 'commercial' | 'industrial';
export type PropertyType =
  | 'apartment' | 'bungalow' | 'cluster' | 'complex' | 'cottage' | 'farm'
  | 'small_holding' | 'flat' | 'house' | 'retirement' | 'room' | 'townhouse'
  | 'sectional_title' | 'freehold';
export type BathroomType = 'shower_only' | 'ensuite' | 'shower_on_tub';

export interface Property {
  id: string;
  ownerId: string;
  name: string;
  address: string;
  suburb?: string;
  postalCode?: string;
  city: string;
  province: Province;
  category?: PropertyCategory;
  propertyType?: PropertyType;
  bedrooms?: number;
  bathrooms?: number;
  bathroomType?: BathroomType;
  floor?: string;
  block?: string;
  /** Legacy — rent now lives on the lease. Kept optional for back-compat. */
  rentAmount?: number;
  unitNumber?: string;
  erfSize?: number;
  leaseStart?: string;
  leaseEnd?: string;
  createdAt: string;
}

export type CustomerType = 'individual' | 'business';

export interface Tenant {
  id: string;
  ownerId: string;
  userId?: string;
  customerType: CustomerType;
  firstName?: string;
  lastName?: string;
  /** Display name — derived from first/last (individual) or business name. */
  name: string;
  idNumber?: string;
  countryIssuing?: string;
  email: string;
  secondaryEmail?: string;
  landline?: string;
  /** Cell number. */
  phone: string;
  businessAddress?: string;
  businessAddress2?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankBranchCode?: string;
  inviteStatus: 'none' | 'pending' | 'accepted';
  createdAt: string;
}

export type LeaseType = 'fixed_term' | 'month_to_month';
export type RentFrequency = 'monthly' | 'quarterly' | 'half_yearly' | 'yearly';

export interface Lease {
  id: string;
  propertyId: string;
  tenantId: string;
  ownerId: string;
  leaseType: LeaseType;
  startDate: string;
  durationMonths?: number;
  endDate?: string;
  rentFrequency: RentFrequency;
  dueDay?: number;
  rentAmount: number;
  depositPaid: number;
  status: 'active' | 'ended' | 'pending';
  createdAt: string;
}

export interface PropertyCost {
  id: string;
  propertyId: string;
  ownerId: string;
  month: number;
  year: number;
  totalAmount: number;
  notes?: string;
  createdAt: string;
}

export interface UtilityBreakdown {
  id: string;
  propertyCostId: string;
  label: string;
  amount: number;
  isRecoverable: boolean;
  isRecurring: boolean;
  createdAt: string;
}

export interface InvoiceLineItem {
  description: string;
  amount: number;
}

export interface Invoice {
  id: string;
  propertyId: string;
  leaseId: string;
  ownerId: string;
  invoiceNumber: string;
  month: number;
  year: number;
  dueDate: string;
  lineItems: InvoiceLineItem[];
  totalAmount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'partial';
  createdAt: string;
}

export interface Payment {
  id: string;
  propertyId: string;
  leaseId?: string;
  invoiceId?: string;
  ownerId: string;
  amount: number;
  paymentDate: string;
  method: 'payfast' | 'eft' | 'cash' | 'other';
  payfastPaymentId?: string;
  status: 'pending' | 'verified' | 'failed';
  notes?: string;
  createdAt: string;
}

export type MaintenancePriority = 'low' | 'medium' | 'high' | 'urgent';
export type MaintenanceStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface MaintenanceRequest {
  id: string;
  propertyId: string;
  leaseId?: string;
  tenantId?: string;
  ownerId: string;
  title: string;
  description: string;
  status: MaintenanceStatus;
  priority: MaintenancePriority;
  images?: string[];
  resolutionNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StatementUpload {
  id: string;
  propertyId: string;
  ownerId: string;
  filePath: string;
  fileName: string;
  extractedData?: ExtractedLineItem[];
  extractionStatus: 'pending' | 'processing' | 'complete' | 'failed';
  propertyCostId?: string;
  uploadedAt: string;
}

export interface ExtractedLineItem {
  label: string;
  amount: number;
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export type ActiveTab = 'overview' | 'leases' | 'invoices' | 'payments' | 'costs' | 'maintenance' | 'documents';
