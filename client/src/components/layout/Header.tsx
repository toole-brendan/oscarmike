import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { BarChart3, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Header: React.FC = () => {
  const [_, navigate] = useLocation();
  // We'll simulate a logged-in state for now
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  
  const handleLogout = () => {
    setIsLoggedIn(false);
    navigate('/login');
  };
  
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
        
        <nav className="flex items-center space-x-4">
          {isLoggedIn ? (
            <div className="flex items-center space-x-4">
              <button 
                className="flex items-center text-sm font-medium text-gray-700 hover:text-primary focus:outline-none"
                onClick={() => navigate('/')}
              >
                <span>John D.</span>
                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center ml-2">
                  <span className="text-xs font-medium">JD</span>
                </div>
              </button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleLogout}
                className="text-gray-500"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/login')}
              >
                Login
              </Button>
              <Button 
                variant="default" 
                size="sm"
                onClick={() => navigate('/register')}
              >
                Register
              </Button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;
