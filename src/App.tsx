import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute, PublicOnlyRoute } from '@/app/ProtectedRoute'
import { AppLayout } from '@/layouts/AppLayout'

import { SplashPage } from '@/pages/auth/SplashPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { LoginPage } from '@/pages/auth/LoginPage'

import { HomePage } from '@/pages/home/HomePage'

import { HabitsListPage } from '@/pages/habits/HabitsListPage'
import { AddEditHabitPage } from '@/pages/habits/AddEditHabitPage'
import { HabitDetailsPage } from '@/pages/habits/HabitDetailsPage'

import { CalendarPage } from '@/pages/calendar/CalendarPage'
import { CalendarDayPage } from '@/pages/calendar/CalendarDayPage'

import { WorkoutDetailsPage } from '@/pages/gym/WorkoutDetailsPage'
import { GymCalendarPage } from '@/pages/gym/GymCalendarPage'

import { FinanceOverviewPage } from '@/pages/finance/FinanceOverviewPage'
import { IncomePage } from '@/pages/finance/IncomePage'
import { AddIncomePage } from '@/pages/finance/AddIncomePage'
import { ExpensesPage } from '@/pages/finance/ExpensesPage'
import { AddExpensePage } from '@/pages/finance/AddExpensePage'
import { BudgetPage } from '@/pages/finance/BudgetPage'

import { SavingsOverviewPage } from '@/pages/savings/SavingsOverviewPage'
import { AddSavingsCategoryPage } from '@/pages/savings/AddSavingsCategoryPage'
import { SavingsCategoryPage } from '@/pages/savings/SavingsCategoryPage'
import { AddSavingsTransactionPage } from '@/pages/savings/AddSavingsTransactionPage'

import { DebtOverviewPage } from '@/pages/debt/DebtOverviewPage'
import { AddDebtPage } from '@/pages/debt/AddDebtPage'
import { DebtDetailsPage } from '@/pages/debt/DebtDetailsPage'
import { AddDebtPaymentPage } from '@/pages/debt/AddDebtPaymentPage'

import { ProfilePage } from '@/pages/profile/ProfilePage'
import { AppearanceSettingsPage } from '@/pages/profile/AppearanceSettingsPage'
import { NotificationSettingsPage } from '@/pages/profile/NotificationSettingsPage'
import { SecuritySettingsPage } from '@/pages/profile/SecuritySettingsPage'
import { AppLockSettingsPage } from '@/pages/profile/AppLockSettingsPage'

function App() {
  return (
    <Routes>
      <Route
        path="/splash"
        element={
          <PublicOnlyRoute>
            <SplashPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <RegisterPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<HomePage />} />

        <Route path="/habits" element={<HabitsListPage />} />
        <Route path="/habits/new" element={<AddEditHabitPage />} />
        <Route path="/habits/:habitId" element={<HabitDetailsPage />} />
        <Route path="/habits/:habitId/edit" element={<AddEditHabitPage />} />

        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/calendar/:date" element={<CalendarDayPage />} />

        <Route path="/gym" element={<WorkoutDetailsPage />} />
        <Route path="/gym/calendar" element={<GymCalendarPage />} />
        <Route path="/gym/:date" element={<WorkoutDetailsPage />} />

        <Route path="/finance" element={<FinanceOverviewPage />} />
        <Route path="/finance/income" element={<IncomePage />} />
        <Route path="/finance/income/new" element={<AddIncomePage />} />
        <Route path="/finance/expenses" element={<ExpensesPage />} />
        <Route path="/finance/expense/new" element={<AddExpensePage />} />
        <Route path="/finance/budget" element={<BudgetPage />} />

        <Route path="/savings" element={<SavingsOverviewPage />} />
        <Route path="/savings/new" element={<AddSavingsCategoryPage />} />
        <Route path="/savings/:categoryId" element={<SavingsCategoryPage />} />
        <Route path="/savings/:categoryId/transaction" element={<AddSavingsTransactionPage />} />

        <Route path="/debt" element={<DebtOverviewPage />} />
        <Route path="/debt/new" element={<AddDebtPage />} />
        <Route path="/debt/:debtId" element={<DebtDetailsPage />} />
        <Route path="/debt/:debtId/payment" element={<AddDebtPaymentPage />} />

        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/appearance" element={<AppearanceSettingsPage />} />
        <Route path="/profile/notifications" element={<NotificationSettingsPage />} />
        <Route path="/profile/security" element={<SecuritySettingsPage />} />
        <Route path="/profile/app-lock" element={<AppLockSettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
