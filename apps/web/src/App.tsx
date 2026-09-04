import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { LoginPage } from "./pages/LoginPage";
import { OverviewPage } from "./pages/OverviewPage";
import { ProductsListPage } from "./pages/products/ProductsListPage";
import { ProductEditorPage } from "./pages/products/ProductEditorPage";
import { WholesaleAccountsListPage } from "./pages/wholesale/WholesaleAccountsListPage";
import { WholesaleAccountDetailPage } from "./pages/wholesale/WholesaleAccountDetailPage";
import { WholesaleApplicationNewPage } from "./pages/wholesale/WholesaleApplicationNewPage";
import { QuotesListPage } from "./pages/quotes/QuotesListPage";
import { QuoteEditorPage } from "./pages/quotes/QuoteEditorPage";
import { QuoteDetailPage } from "./pages/quotes/QuoteDetailPage";
import { InvoicesListPage } from "./pages/invoices/InvoicesListPage";
import { InvoiceEditorPage } from "./pages/invoices/InvoiceEditorPage";
import { InvoiceDetailPage } from "./pages/invoices/InvoiceDetailPage";
import { OrdersListPage } from "./pages/orders/OrdersListPage";
import { OrderDetailPage } from "./pages/orders/OrderDetailPage";
import { CustomersListPage } from "./pages/customers/CustomersListPage";
import { CustomerDetailPage } from "./pages/customers/CustomerDetailPage";
import { ContentPage } from "./pages/content/ContentPage";
import { SettingsPage } from "./pages/settings/SettingsPage";
import { NotFoundPage } from "./pages/NotFoundPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<OverviewPage />} />

            <Route
              path="products"
              element={
                <ProtectedRoute roles={["CONTENT_EDITOR"]}>
                  <ProductsListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="products/new"
              element={
                <ProtectedRoute roles={["CONTENT_EDITOR"]}>
                  <ProductEditorPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="products/:id"
              element={
                <ProtectedRoute roles={["CONTENT_EDITOR"]}>
                  <ProductEditorPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="wholesale-accounts"
              element={
                <ProtectedRoute roles={["ORDER_MANAGER"]}>
                  <WholesaleAccountsListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="wholesale-accounts/new"
              element={
                <ProtectedRoute roles={["ORDER_MANAGER"]}>
                  <WholesaleApplicationNewPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="wholesale-accounts/:id"
              element={
                <ProtectedRoute roles={["ORDER_MANAGER"]}>
                  <WholesaleAccountDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="quotes"
              element={
                <ProtectedRoute roles={["ORDER_MANAGER"]}>
                  <QuotesListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="quotes/new"
              element={
                <ProtectedRoute roles={["ORDER_MANAGER"]}>
                  <QuoteEditorPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="quotes/:id"
              element={
                <ProtectedRoute roles={["ORDER_MANAGER"]}>
                  <QuoteDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="invoices"
              element={
                <ProtectedRoute roles={["ORDER_MANAGER"]}>
                  <InvoicesListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="invoices/new"
              element={
                <ProtectedRoute roles={["ORDER_MANAGER"]}>
                  <InvoiceEditorPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="invoices/:id"
              element={
                <ProtectedRoute roles={["ORDER_MANAGER"]}>
                  <InvoiceDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="orders"
              element={
                <ProtectedRoute roles={["ORDER_MANAGER"]}>
                  <OrdersListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="orders/:id"
              element={
                <ProtectedRoute roles={["ORDER_MANAGER"]}>
                  <OrderDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="customers"
              element={
                <ProtectedRoute roles={["ORDER_MANAGER"]}>
                  <CustomersListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="customers/:id"
              element={
                <ProtectedRoute roles={["ORDER_MANAGER"]}>
                  <CustomerDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="content"
              element={
                <ProtectedRoute roles={["CONTENT_EDITOR"]}>
                  <ContentPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="settings"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="/404" element={<NotFoundPage />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
