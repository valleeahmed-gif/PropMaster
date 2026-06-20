export type UserRole = 'landlord' | 'tenant';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
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

export interface Property {
  id: string;
  ownerId: string;
  name: string;
  address: string;
  city: string;
  province: Province;
  rentAmount: number;
  unitNumber?: string;
  erfSize?: number;
  leaseStart?: string;
  leaseEnd?: string;
  createdAt: string;
}

export interface Tenant {
  id: string;
  ownerId: string;
  userId?: string;
  name: string;
  email: string;
  phone: string;
  inviteStatus: 'none' | 'pending' | 'accepted';
  createdAt: string;
}

export interface Lease {
  id: string;
  propertyId: string;
  tenantId: string;
  ownerId: string;
  startDate: string;
  endDate?: string;
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
