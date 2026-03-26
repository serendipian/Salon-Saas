
import { useState, useMemo } from 'react';
import { useAppContext } from '../../../context/AppContext';

export const useTeam = () => {
  const { team, addStaffMember, updateStaffMember, appointments } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTeam = useMemo(() => {
    return team.filter(member => 
      member.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.lastName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [team, searchTerm]);

  // Helper to calculate stats per member
  const getMemberStats = (memberId: string) => {
    const memberAppointments = appointments.filter(a => a.staffId === memberId);
    const today = new Date().toISOString().slice(0, 10);
    const todaysAppointments = memberAppointments.filter(a => a.date.startsWith(today));
    const totalRevenue = memberAppointments.reduce((sum, a) => sum + a.price, 0);

    return {
      totalAppointments: memberAppointments.length,
      todayCount: todaysAppointments.length,
      totalRevenue
    };
  };

  return {
    team: filteredTeam,
    searchTerm,
    setSearchTerm,
    addStaffMember,
    updateStaffMember,
    getMemberStats
  };
};
