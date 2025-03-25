import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'wouter';
import { BarChart3, LogOut, Trophy, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const Header: React.FC = () => {
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState<{id: number, username: string} | null>(null);
  
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUserData(parsedUser);
        setIsLoggedIn(true);
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('user');
      }
    }
  }, []);
  
  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    setUserData(null);
    
    toast({
      title: 'Logged out successfully',
      description: 'You have been logged out of your account',
      variant: 'default',
    });
    
    navigate('/login');
  };
  
  const openCameraTest = () => {
    // Open camera test in a new tab
    window.open('/camera-test.html', '_blank');
  };
  
  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
        <Link href="/">
          <div className="flex items-center cursor-pointer">
            <BarChart3 className="h-8 w-8 text-primary" />
            <h1 className="ml-2 text-xl font-bold font-mono tracking-[0.15em] text-neutral-dark">PT CHAMPION</h1>
          </div>
        </Link>
        
        <nav className="flex items-center space-x-4">
          {isLoggedIn ? (
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={openCameraTest}
                className="text-gray-700 hover:text-primary"
              >
                <Camera className="h-4 w-4 mr-2" />
                Camera Test
              </Button>
              <Link href="/leaderboard">
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-gray-700 hover:text-primary"
                >
                  <Trophy className="h-4 w-4 mr-2" />
                  Leaderboard
                </Button>
              </Link>
              <Link href="/">
                <button 
                  className="flex items-center text-sm font-medium text-gray-700 hover:text-primary focus:outline-none"
                >
                  <span>{userData?.username || 'User'}</span>
                  <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center ml-2">
                    <span className="text-xs font-medium">{userData?.username ? userData.username.substring(0, 2).toUpperCase() : 'U'}</span>
                  </div>
                </button>
              </Link>
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
              <Link href="/login">
                <Button 
                  variant="ghost" 
                  size="sm"
                >
                  Login
                </Button>
              </Link>
              <Link href="/register">
                <Button 
                  variant="default" 
                  size="sm"
                >
                  Register
                </Button>
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;
