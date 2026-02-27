import { createContext, useContext, useState, type ReactNode } from 'react';

interface StaffContextType {
  staffName: string;
  isAdmin: boolean;
  isLoggedIn: boolean;
  setStaffLogin: (name: string, admin: boolean) => void;
  logout: () => void;
}

const StaffContext = createContext<StaffContextType | null>(null);

const STAFF_KEY = 'df_staff_name';
const ADMIN_KEY = 'df_is_admin';

export const StaffProvider = ({ children }: { children: ReactNode }) => {
  const [staffName, setStaffName] = useState(() => sessionStorage.getItem(STAFF_KEY) || '');
  const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem(ADMIN_KEY) === 'true');

  const setStaffLogin = (name: string, admin: boolean) => {
    setStaffName(name);
    setIsAdmin(admin);
    sessionStorage.setItem(STAFF_KEY, name);
    sessionStorage.setItem(ADMIN_KEY, admin ? 'true' : 'false');
  };

  const logout = () => {
    setStaffName('');
    setIsAdmin(false);
    sessionStorage.removeItem(STAFF_KEY);
    sessionStorage.removeItem(ADMIN_KEY);
  };

  return (
    <StaffContext.Provider value={{ staffName, isAdmin, isLoggedIn: !!staffName, setStaffLogin, logout }}>
      {children}
    </StaffContext.Provider>
  );
};

export const useStaff = () => {
  const ctx = useContext(StaffContext);
  if (!ctx) throw new Error('useStaff must be used within StaffProvider');
  return ctx;
};
