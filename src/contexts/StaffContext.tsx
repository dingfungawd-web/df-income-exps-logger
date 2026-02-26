import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface StaffContextType {
  staffName: string;
  setStaffName: (name: string) => void;
  logout: () => void;
  isLoggedIn: boolean;
}

const StaffContext = createContext<StaffContextType | null>(null);

const STAFF_KEY = 'df_staff_name';

export const StaffProvider = ({ children }: { children: ReactNode }) => {
  const [staffName, setStaffNameState] = useState(() => localStorage.getItem(STAFF_KEY) || '');

  const setStaffName = (name: string) => {
    const trimmed = name.trim();
    setStaffNameState(trimmed);
    localStorage.setItem(STAFF_KEY, trimmed);
  };

  const logout = () => {
    setStaffNameState('');
    localStorage.removeItem(STAFF_KEY);
  };

  return (
    <StaffContext.Provider value={{ staffName, setStaffName, logout, isLoggedIn: !!staffName }}>
      {children}
    </StaffContext.Provider>
  );
};

export const useStaff = () => {
  const ctx = useContext(StaffContext);
  if (!ctx) throw new Error('useStaff must be used within StaffProvider');
  return ctx;
};
