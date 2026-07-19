import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Appshell from "./layout/Appshell";
import DashboardPage from "./pages/DashboardPage";
import TransactionsPage from "./pages/TransactionsPage";
import FinancePage from "./pages/FinancePage";
import LoansPage from "./pages/LoansPage";
import CustomersPage from "./pages/CustomersPage";
import SupportPage from "./pages/SupportPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Appshell />}>
          <Route index element={<DashboardPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="finance" element={<FinancePage />} />
          <Route path="loans" element={<LoansPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="support" element={<SupportPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
