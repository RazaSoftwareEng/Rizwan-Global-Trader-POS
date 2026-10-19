import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './auth/AuthProvider'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import DocumentList from './pages/DocumentList'
import DocumentForm from './pages/DocumentForm'
import DocumentDetail from './pages/DocumentDetail'
import Catalog from './pages/Catalog'
import Customers from './pages/Customers'
import Users from './pages/Users'
import Settings from './pages/Settings'

const adminOnly = (el) => <RequireAuth adminOnly>{el}</RequireAuth>

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        {/* key forces a fresh component when switching between invoice and quotation routes */}
        <Route path="invoices" element={<DocumentList key="invoice" type="invoice" />} />
        <Route path="invoices/new" element={<DocumentForm key="invoice" type="invoice" />} />
        <Route path="invoices/:id" element={<DocumentDetail key="invoice" type="invoice" />} />
        <Route path="quotations" element={<DocumentList key="quotation" type="quotation" />} />
        <Route path="quotations/new" element={<DocumentForm key="quotation" type="quotation" />} />
        <Route path="quotations/:id" element={<DocumentDetail key="quotation" type="quotation" />} />
        <Route path="customers" element={<Customers />} />
        <Route path="catalog" element={adminOnly(<Catalog />)} />
        <Route path="users" element={adminOnly(<Users />)} />
        <Route path="settings" element={adminOnly(<Settings />)} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
