import React from 'react';
import { useLocation, Link } from 'wouter';
import { Home, BookOpen, Trophy, Settings } from 'lucide-react';

const MobileNav: React.FC = () => {
  const [location] = useLocation();
  
  return (
    <nav className="bg-white border-t border-gray-200 fixed bottom-0 inset-x-0 z-10 sm:hidden">
      <div className="grid grid-cols-4">
        <Link href="/">
          <button 
            className={`flex flex-col items-center justify-center py-3 ${
              location === '/' ? 'text-primary' : 'text-gray-500'
            }`}
          >
            <Home className="h-6 w-6" />
            <span className="text-xs mt-1">Home</span>
          </button>
        </Link>
        
        <button 
          className="flex flex-col items-center justify-center py-3 text-gray-500"
        >
          <BookOpen className="h-6 w-6" />
          <span className="text-xs mt-1">History</span>
        </button>
        
        <Link href="/leaderboard">
          <button 
            className={`flex flex-col items-center justify-center py-3 ${
              location === '/leaderboard' ? 'text-primary' : 'text-gray-500'
            }`}
          >
            <Trophy className="h-6 w-6" />
            <span className="text-xs mt-1">Leaderboard</span>
          </button>
        </Link>
        
        <button 
          className="flex flex-col items-center justify-center py-3 text-gray-500"
        >
          <Settings className="h-6 w-6" />
          <span className="text-xs mt-1">Settings</span>
        </button>
      </div>
    </nav>
  );
};

export default MobileNav;
