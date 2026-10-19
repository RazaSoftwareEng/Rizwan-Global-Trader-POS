// Picks the data source: demo mode (browser storage) or Supabase.
import { USE_MOCK } from './supabase'
import * as real from './supabaseApi'
import * as mock from './mockApi'

export const {
  DOC_TYPES,
  getDefaultCompany,
  saveCompany,
  listCustomers,
  saveCustomer,
  deleteCustomer,
  listProducts,
  saveProduct,
  importProducts,
  deleteProduct,
  listDocuments,
  getDocument,
  createDocument,
  setInvoiceStatus,
  convertQuotation,
  getDashboardData,
  listUsers,
  createUser,
  updateUser,
  setUserPassword,
  deleteUser,
} = USE_MOCK ? mock : real
