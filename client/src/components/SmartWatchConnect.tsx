import React from 'react';
import { Button } from '@/components/ui/button';
import { useSmartWatch, SmartWatchBrand } from '@/lib/smartwatch-service';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Watch, Bluetooth, RefreshCw, WifiOff } from 'lucide-react';

interface SmartWatchConnectProps {
  onConnected?: () => void;
  className?: string;
}

const getBrandIcon = (brand: SmartWatchBrand) => {
  switch (brand) {
    case 'garmin':
      return '🇬'; // Simple letter as a placeholder
    case 'apple':
      return '🍎';
    case 'fitbit':
      return '🇫';
    case 'samsung':
      return '🇸';
    case 'polar':
      return '🇵';
    case 'suunto':
      return '🇸';
    case 'coros':
      return '🇨';
    default:
      return '⌚';
  }
};

const SmartWatchConnect: React.FC<SmartWatchConnectProps> = ({ onConnected, className = '' }) => {
  const {
    device,
    devices,
    scanning,
    connecting,
    supportedBrands,
    scanForDevices,
    connectDevice,
    disconnectDevice,
  } = useSmartWatch();

  // Handle scan button click
  const handleScan = async () => {
    await scanForDevices();
  };

  // Handle device selection
  const handleDeviceSelect = async (deviceId: string) => {
    await connectDevice(deviceId);
    
    // Notify parent component when connected
    if (onConnected) {
      onConnected();
    }
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    await disconnectDevice();
  };

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Watch className="mr-2 h-5 w-5" />
          Smartwatch Connection
        </CardTitle>
        <CardDescription>
          Connect your smartwatch to track and verify your runs
        </CardDescription>
      </CardHeader>

      <CardContent>
        {device ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-lg mr-2">{getBrandIcon(device.brand)}</span>
                <div>
                  <h3 className="text-base font-medium">{device.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {device.brand.charAt(0).toUpperCase() + device.brand.slice(1)}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                Connected
              </Badge>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {supportedBrands.length === 0 ? (
              <div className="text-center py-4">
                <WifiOff className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
                <p className="mt-2 text-muted-foreground">
                  No smartwatch connectivity is available on this device.
                </p>
                <p className="text-sm text-muted-foreground">
                  Try using a device with Bluetooth capabilities.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center mb-4">
                  <Bluetooth className="mr-2 h-5 w-5 text-primary" />
                  <p className="text-sm">
                    Supported brands: {supportedBrands.map(brand => 
                      brand.charAt(0).toUpperCase() + brand.slice(1)
                    ).join(', ')}
                  </p>
                </div>
                
                {devices.length > 0 ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select a device:</label>
                    <Select onValueChange={handleDeviceSelect} disabled={connecting}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose a smartwatch" />
                      </SelectTrigger>
                      <SelectContent>
                        {devices.map(device => (
                          <SelectItem key={device.id} value={device.id}>
                            <div className="flex items-center">
                              <span className="mr-2">{getBrandIcon(device.brand)}</span>
                              {device.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {connecting ? 'Connecting...' : 'Select your device from the list'}
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <p className="text-sm mb-2">No devices found nearby</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between">
        {device ? (
          <Button variant="outline" onClick={handleDisconnect} className="w-full">
            Disconnect
          </Button>
        ) : (
          <Button 
            onClick={handleScan} 
            disabled={scanning || connecting} 
            className="w-full"
          >
            {scanning ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Scanning...
              </>
            ) : (
              'Scan for Devices'
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default SmartWatchConnect; 