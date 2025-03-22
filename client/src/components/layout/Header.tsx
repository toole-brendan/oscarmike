import React from 'react';
import { useLocation } from 'wouter';
import { BarChart3 } from 'lucide-react';

const Header: React.FC = () => {
  const [_, navigate] = useLocation();
  
  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
        <div 
          className="flex items-center cursor-pointer" 
          onClick={() => navigate('/')}
        >
          <BarChart3 className="h-8 w-8 text-primary" />
          <h1 className="ml-2 text-xl font-bold text-neutral-dark">PT Test AI</h1>
        </div>
        
        <nav>
          <button 
            className="flex items-center text-sm font-medium text-gray-700 hover:text-primary focus:outline-none"
          >
            <span>John D.</span>
            <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center ml-2">
              <span className="text-xs font-medium">JD</span>
            </div>
          </button>
        </nav>
      </div>
    </header>
  );
};

export default Header;
