
import React, { useState, useEffect } from 'react';
import { Box, Layers, School, MapPin, Users as UsersIcon, ArrowUp, Info } from 'lucide-react';
import { toTitleCase } from '../lib/utils';
import Equipment from './Equipment';
import Schools from './Schools';
import Locations from './Locations';
import Users from './Users';

import PageHeader from './PageHeader';

interface CatalogProps {
  initialTab?: 'equipment' | 'bundle' | 'school' | 'location' | 'users';
  isDarkMode?: boolean;
  userRole?: string | null;
  currentUsername?: string | null;
}

const Catalog: React.FC<CatalogProps> = ({ initialTab = 'equipment', isDarkMode = false, userRole = 'Staff', currentUsername = null }) => {
  const [activeTab, setActiveTab] = useState<'equipment' | 'bundle' | 'school' | 'location' | 'users'>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const isAdmin = userRole === 'Admin' || userRole === 'SUPERADMIN';

  const renderContent = () => {
    switch (activeTab) {
      case 'equipment':
        return <Equipment initialTab="equipment" isDarkMode={isDarkMode} userRole={userRole} />;
      case 'bundle':
        return <Equipment initialTab="bundle" isDarkMode={isDarkMode} userRole={userRole} />;
      case 'school':
        return <Schools isDarkMode={isDarkMode} userRole={userRole} />;
      case 'location':
        return <Locations isDarkMode={isDarkMode} userRole={userRole} />;
      case 'users':
        if (!isAdmin) return <Equipment initialTab="equipment" isDarkMode={isDarkMode} userRole={userRole} />;
        return <Users isDarkMode={isDarkMode} userRole={userRole} currentUsername={currentUsername} />;
      default:
        return <Equipment initialTab="equipment" isDarkMode={isDarkMode} userRole={userRole} />;
    }
  };

  const getHeaderData = () => {
    switch (activeTab) {
      case 'equipment':
        return { title: 'Equipment', description: 'Manage standardized equipment and identifiers' };
      case 'bundle':
        return { title: 'Bundles', description: 'Configure predefined equipment packages' };
      case 'school':
        return { title: 'Schools', description: 'Manage school partners and buffer accounts' };
      case 'location':
        return { title: 'Locations', description: 'Track inventory across all physical locations' };
      case 'users':
        return { title: 'System Users', description: 'Manage user accounts and access permissions' };
      default:
        return { title: 'Catalog', description: '' };
    }
  };

  const { title, description } = getHeaderData();

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <div className="px-6 lg:px-12 pt-0 pb-0">
        <PageHeader 
          title={title}
          description={description}
          isDarkMode={isDarkMode}
        />
      </div>

      {/* Content Area */}
      <div className="flex-grow overflow-hidden px-6 lg:px-12">
        {renderContent()}
      </div>
    </div>
  );
};

export default Catalog;
