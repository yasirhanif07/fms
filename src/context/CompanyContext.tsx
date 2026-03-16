"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface Company {
  id: string;
  name: string;
  description?: string | null;
}

interface CompanyContextType {
  companies: Company[];
  activeCompanyId: string | null;
  activeCompany: Company | null;
  setActiveCompanyId: (id: string) => void;
  refreshCompanies: () => void;
}

const CompanyContext = createContext<CompanyContextType>({
  companies: [],
  activeCompanyId: null,
  activeCompany: null,
  setActiveCompanyId: () => {},
  refreshCompanies: () => {},
});

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompanyId, setActiveCompanyIdState] = useState<string | null>(null);

  const fetchCompanies = async () => {
    const res = await fetch("/api/companies");
    if (res.ok) {
      const data = await res.json();
      setCompanies(data);
      const stored = localStorage.getItem("fms_active_company");
      const valid = data.find((c: Company) => c.id === stored);
      if (valid) {
        setActiveCompanyIdState(valid.id);
      } else if (data.length > 0) {
        setActiveCompanyIdState(data[0].id);
        localStorage.setItem("fms_active_company", data[0].id);
      }
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const setActiveCompanyId = (id: string) => {
    setActiveCompanyIdState(id);
    localStorage.setItem("fms_active_company", id);
  };

  const activeCompany = companies.find((c) => c.id === activeCompanyId) || null;

  return (
    <CompanyContext.Provider
      value={{ companies, activeCompanyId, activeCompany, setActiveCompanyId, refreshCompanies: fetchCompanies }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export const useCompany = () => useContext(CompanyContext);
