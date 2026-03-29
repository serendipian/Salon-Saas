import React from 'react';
import { Outlet } from 'react-router-dom';

export const FinancesLayout: React.FC = () => {
  return (
    <div>
      <Outlet />
    </div>
  );
};
