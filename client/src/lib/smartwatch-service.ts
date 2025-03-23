import { useState, useEffect } from 'react';

// Add Web Bluetooth API type definitions
declare global {
  interface Navigator {
    bluetooth?: {
      requestDevice(options: {
        filters?: Array<{
          services?: string[];
          name?: string;
          namePrefix?: string;
        }>;
        optionalServices?: string[];
      }): Promise<{
        id: string;
        name?: string;
        gatt?: any;
      }>;
    };
  }
}

// Types for smartwatch data
export interface SmartWatchRunData {
  distance: number;       // Distance in miles
  heartRate: number;      // Heart rate in BPM
  timestamp: number;      // Timestamp in milliseconds
  pace: number;           // Pace in minutes per mile (seconds)
  latitude?: number;      // GPS latitude
  longitude?: number;     // GPS longitude
  altitude?: number;      // Altitude in meters
  cadence?: number;       // Steps per minute
  calories?: number;      // Calories burned
}

export interface TrackPoint {
  latitude: number;
  longitude: number;
  altitude?: number;
  timestamp: number;
  heartRate?: number;
}

export interface RunSummary {
  totalDistance: number;  // miles
  totalTime: number;      // seconds
  avgHeartRate: number;   // BPM
  maxHeartRate: number;   // BPM
  avgPace: number;        // seconds per mile
  startTime: number;      // timestamp
  endTime: number;        // timestamp
  trackPoints: TrackPoint[]; // GPS track
  calories?: number;      // calories burned
  verified: boolean;      // Whether the run is verified by smartwatch data
}

export type SmartWatchBrand = 'garmin' | 'apple' | 'fitbit' | 'samsung' | 'polar' | 'suunto' | 'coros' | 'unknown';

export interface SmartWatchDevice {
  id: string;
  name: string;
  brand: SmartWatchBrand;
  connected: boolean;
}

// Main service class for smartwatch connectivity
export class SmartWatchService {
  private static instance: SmartWatchService;
  private devices: SmartWatchDevice[] = [];
  private activeDevice: SmartWatchDevice | null = null;
  private runData: SmartWatchRunData[] = [];
  private listeners: Set<(data: SmartWatchRunData) => void> = new Set();
  private connectionListeners: Set<(device: SmartWatchDevice | null) => void> = new Set();
  private webBluetoothAvailable = typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  private garminConnectAvailable = false; // Will check API availability
  private fitbitApiAvailable = false;     // Will check API availability

  // Singleton pattern
  private constructor() {
    this.checkApiAvailability();
  }

  public static getInstance(): SmartWatchService {
    if (!SmartWatchService.instance) {
      SmartWatchService.instance = new SmartWatchService();
    }
    return SmartWatchService.instance;
  }

  // Check API availability for different smartwatch platforms
  private async checkApiAvailability(): Promise<void> {
    // Check if Garmin Connect API is available
    try {
      // In a real implementation, this would check if the Garmin Connect API is available
      const response = await fetch('/api/garmin/status', { method: 'HEAD' });
      this.garminConnectAvailable = response.ok;
    } catch (error) {
      this.garminConnectAvailable = false;
    }

    // Check if Fitbit API is available
    try {
      // In a real implementation, this would check if the Fitbit API is available
      const response = await fetch('/api/fitbit/status', { method: 'HEAD' });
      this.fitbitApiAvailable = response.ok;
    } catch (error) {
      this.fitbitApiAvailable = false;
    }
  }

  // Scan for available devices
  public async scanForDevices(): Promise<SmartWatchDevice[]> {
    this.devices = [];
    
    if (this.webBluetoothAvailable && navigator.bluetooth) {
      try {
        // For Web Bluetooth API
        const device = await navigator.bluetooth.requestDevice({
          filters: [
            { services: ['heart_rate'] },
            { services: ['fitness_machine'] },
            { namePrefix: 'Garmin' },
            { namePrefix: 'Apple Watch' },
            { namePrefix: 'Fitbit' },
            { namePrefix: 'Galaxy Watch' },
            { namePrefix: 'Polar' },
            { namePrefix: 'Suunto' },
            { namePrefix: 'COROS' }
          ],
          optionalServices: ['heart_rate', 'fitness_machine', 'battery_service']
        });

        const deviceBrand = this.identifyDeviceBrand(device.name || '');
        
        this.devices.push({
          id: device.id,
          name: device.name || 'Unknown Device',
          brand: deviceBrand,
          connected: false
        });
      } catch (error) {
        console.error('Error scanning for Bluetooth devices:', error);
      }
    }

    // Simulate finding external API connected devices
    if (this.garminConnectAvailable) {
      this.devices.push({
        id: 'garmin-api-device',
        name: 'Garmin Connect',
        brand: 'garmin',
        connected: false
      });
    }

    if (this.fitbitApiAvailable) {
      this.devices.push({
        id: 'fitbit-api-device',
        name: 'Fitbit',
        brand: 'fitbit',
        connected: false
      });
    }

    return this.devices;
  }

  // Connect to a device
  public async connectDevice(deviceId: string): Promise<boolean> {
    const device = this.devices.find(d => d.id === deviceId);
    if (!device) return false;

    try {
      if (deviceId === 'garmin-api-device') {
        // Connect to Garmin API
        await this.connectToGarminApi();
        device.connected = true;
      } else if (deviceId === 'fitbit-api-device') {
        // Connect to Fitbit API
        await this.connectToFitbitApi();
        device.connected = true;
      } else if (this.webBluetoothAvailable) {
        // Connect via Web Bluetooth
        await this.connectViaBluetooth(deviceId);
        device.connected = true;
      }

      this.activeDevice = device;
      this.notifyConnectionListeners(device);
      return true;
    } catch (error) {
      console.error(`Error connecting to device ${deviceId}:`, error);
      return false;
    }
  }

  // Disconnect the active device
  public async disconnectDevice(): Promise<void> {
    if (this.cleanupDataCollection) {
      this.cleanupDataCollection();
      this.cleanupDataCollection = null;
    }
    
    if (this.activeDevice) {
      const device = this.activeDevice;
      device.connected = false;
      this.activeDevice = null;
      this.notifyConnectionListeners(null);
    }
    this.runData = [];
  }

  // Start recording run data
  public startRecording(): void {
    // Clear previous run data
    this.runData = [];
    
    // If we have an active device, begin fetching data
    if (this.activeDevice) {
      this.startDataCollection();
    }
  }

  // Stop recording
  public stopRecording(): RunSummary | null {
    if (this.cleanupDataCollection) {
      this.cleanupDataCollection();
      this.cleanupDataCollection = null;
    }
    
    if (this.runData.length === 0) return null;

    // Calculate run summary
    const summary = this.calculateRunSummary();
    
    // Reset run data
    this.runData = [];
    
    return summary;
  }

  // Calculate summary statistics
  private calculateRunSummary(): RunSummary {
    const startTime = this.runData[0]?.timestamp || Date.now();
    const endTime = this.runData[this.runData.length - 1]?.timestamp || Date.now();
    const totalTime = (endTime - startTime) / 1000; // Convert to seconds
    
    let totalDistance = 0;
    let totalHeartRate = 0;
    let maxHeartRate = 0;
    let trackPoints: TrackPoint[] = [];
    
    this.runData.forEach(data => {
      totalDistance = Math.max(totalDistance, data.distance); // Use the final distance as total
      totalHeartRate += data.heartRate;
      maxHeartRate = Math.max(maxHeartRate, data.heartRate);
      
      if (data.latitude && data.longitude) {
        trackPoints.push({
          latitude: data.latitude,
          longitude: data.longitude,
          altitude: data.altitude,
          timestamp: data.timestamp,
          heartRate: data.heartRate
        });
      }
    });
    
    const avgHeartRate = Math.round(totalHeartRate / this.runData.length);
    const avgPace = totalDistance > 0 ? Math.round(totalTime / totalDistance) : 0;
    
    // Verify the run based on distance and trackpoints
    const verified = totalDistance >= 2 && trackPoints.length >= 10;
    
    return {
      totalDistance,
      totalTime,
      avgHeartRate,
      maxHeartRate,
      avgPace,
      startTime,
      endTime,
      trackPoints,
      verified
    };
  }

  // Subscribe to data updates
  public subscribeToData(callback: (data: SmartWatchRunData) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Subscribe to connection changes
  public subscribeToConnection(callback: (device: SmartWatchDevice | null) => void): () => void {
    this.connectionListeners.add(callback);
    // Immediately notify with current state
    if (this.activeDevice) {
      callback(this.activeDevice);
    }
    return () => this.connectionListeners.delete(callback);
  }

  // Get list of supported brands
  public getSupportedBrands(): SmartWatchBrand[] {
    const brands: SmartWatchBrand[] = [];
    
    if (this.webBluetoothAvailable) {
      brands.push('garmin', 'apple', 'fitbit', 'samsung', 'polar', 'suunto', 'coros');
    }
    
    if (this.garminConnectAvailable) {
      if (!brands.includes('garmin')) brands.push('garmin');
    }
    
    if (this.fitbitApiAvailable) {
      if (!brands.includes('fitbit')) brands.push('fitbit');
    }
    
    return brands;
  }

  // Check if the brand is supported
  public isBrandSupported(brand: SmartWatchBrand): boolean {
    return this.getSupportedBrands().includes(brand);
  }

  // Get current active device
  public getActiveDevice(): SmartWatchDevice | null {
    return this.activeDevice;
  }

  // Export run data as GPX
  public exportAsGPX(summary: RunSummary): string {
    const header = `<?xml version="1.0" encoding="UTF-8"?>
<gpx creator="OMPT Run Tracker" version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <time>${new Date(summary.startTime).toISOString()}</time>
  </metadata>
  <trk>
    <name>OMPT 2-Mile Run</name>
    <trkseg>`;
    
    const points = summary.trackPoints.map(point => {
      return `      <trkpt lat="${point.latitude}" lon="${point.longitude}">
        <ele>${point.altitude || 0}</ele>
        <time>${new Date(point.timestamp).toISOString()}</time>
        ${point.heartRate ? `<extensions><hr>${point.heartRate}</hr></extensions>` : ''}
      </trkpt>`;
    }).join('\n');
    
    const footer = `    </trkseg>
  </trk>
</gpx>`;
    
    return `${header}\n${points}\n${footer}`;
  }

  // Private methods
  private identifyDeviceBrand(deviceName: string): SmartWatchBrand {
    deviceName = deviceName.toLowerCase();
    
    if (deviceName.includes('garmin')) return 'garmin';
    if (deviceName.includes('apple')) return 'apple';
    if (deviceName.includes('fitbit')) return 'fitbit';
    if (deviceName.includes('galaxy') || deviceName.includes('samsung')) return 'samsung';
    if (deviceName.includes('polar')) return 'polar';
    if (deviceName.includes('suunto')) return 'suunto';
    if (deviceName.includes('coros')) return 'coros';
    
    return 'unknown';
  }

  private async connectToGarminApi(): Promise<void> {
    // In a real implementation, this would authenticate with Garmin Connect API
    // and set up the connection for data retrieval
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Connected to Garmin Connect API');
  }

  private async connectToFitbitApi(): Promise<void> {
    // In a real implementation, this would authenticate with Fitbit API
    // and set up the connection for data retrieval
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Connected to Fitbit API');
  }

  private async connectViaBluetooth(deviceId: string): Promise<void> {
    // In a real implementation, this would establish a Bluetooth connection
    // and set up the necessary GATT services and characteristics
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`Connected to Bluetooth device ${deviceId}`);
  }

  private startDataCollection(): void {
    if (!this.activeDevice) return;

    // In a real implementation, this would handle the actual data collection
    // from the connected device via Web Bluetooth or API
    
    // For now, we'll simulate data collection with a timer
    const dataInterval = setInterval(() => {
      // Current distance
      const lastDistance = this.runData.length > 0 
        ? this.runData[this.runData.length - 1].distance 
        : 0;
      
      // Simulate gradual distance increase (with some randomness)
      const distanceIncrement = 0.01 + (Math.random() * 0.01); // 0.01-0.02 miles per update
      const newDistance = Math.min(2.1, lastDistance + distanceIncrement); // Cap at 2.1 miles
      
      // Simulate heart rate with some variation
      const baseHeartRate = 150;
      const heartRateVariation = Math.floor(Math.random() * 15) - 7; // -7 to +7 BPM
      const newHeartRate = baseHeartRate + heartRateVariation;
      
      // Simulate GPS data
      const baseLatitude = 37.7749; // Example starting point (San Francisco)
      const baseLongitude = -122.4194;
      const latVariation = (Math.random() * 0.001) * (newDistance / 0.1);
      const longVariation = (Math.random() * 0.001) * (newDistance / 0.1);
      
      // Create data point
      const dataPoint: SmartWatchRunData = {
        distance: newDistance,
        heartRate: newHeartRate,
        timestamp: Date.now(),
        pace: 600 + Math.floor(Math.random() * 60), // Around 10min/mile pace (600 seconds)
        latitude: baseLatitude + latVariation,
        longitude: baseLongitude + longVariation,
        altitude: 10 + Math.floor(Math.random() * 5), // Small altitude variations
        cadence: 170 + Math.floor(Math.random() * 10), // Steps per minute
        calories: Math.floor(newDistance * 100) // Rough estimate
      };
      
      // Add to run data array
      this.runData.push(dataPoint);
      
      // Notify listeners
      this.notifyDataListeners(dataPoint);
      
      // If we've reached 2 miles, we can stop the interval
      if (newDistance >= 2) {
        clearInterval(dataInterval);
      }
    }, 5000); // Update every 5 seconds

    // This was causing a linter error - don't return a function from a void method
    // Instead, store the cleanup function in a class property that can be called when needed
    this.cleanupDataCollection = () => clearInterval(dataInterval);
  }

  // Add property to store cleanup function
  private cleanupDataCollection: (() => void) | null = null;

  private notifyDataListeners(data: SmartWatchRunData): void {
    this.listeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error('Error in data listener:', error);
      }
    });
  }

  private notifyConnectionListeners(device: SmartWatchDevice | null): void {
    this.connectionListeners.forEach(listener => {
      try {
        listener(device);
      } catch (error) {
        console.error('Error in connection listener:', error);
      }
    });
  }
}

// React hook for using the smartwatch service
export function useSmartWatch() {
  const [device, setDevice] = useState<SmartWatchDevice | null>(null);
  const [data, setData] = useState<SmartWatchRunData | null>(null);
  const [devices, setDevices] = useState<SmartWatchDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [recording, setRecording] = useState(false);
  const [supportedBrands, setSupportedBrands] = useState<SmartWatchBrand[]>([]);

  // Initialize on component mount
  useEffect(() => {
    const service = SmartWatchService.getInstance();
    
    // Get supported brands
    setSupportedBrands(service.getSupportedBrands());
    
    // Set up subscriptions
    const dataUnsubscribe = service.subscribeToData(newData => {
      setData(newData);
    });
    
    const connectionUnsubscribe = service.subscribeToConnection(newDevice => {
      setDevice(newDevice);
      setConnecting(false);
    });
    
    // Check if already connected
    const activeDevice = service.getActiveDevice();
    if (activeDevice) {
      setDevice(activeDevice);
    }
    
    // Cleanup function
    return () => {
      dataUnsubscribe();
      connectionUnsubscribe();
    };
  }, []);

  // Scan for devices
  const scanForDevices = async () => {
    setScanning(true);
    try {
      const service = SmartWatchService.getInstance();
      const foundDevices = await service.scanForDevices();
      setDevices(foundDevices);
    } finally {
      setScanning(false);
    }
  };

  // Connect to a device
  const connectDevice = async (deviceId: string) => {
    setConnecting(true);
    const service = SmartWatchService.getInstance();
    await service.connectDevice(deviceId);
  };

  // Disconnect the device
  const disconnectDevice = async () => {
    const service = SmartWatchService.getInstance();
    await service.disconnectDevice();
  };

  // Start recording
  const startRecording = () => {
    const service = SmartWatchService.getInstance();
    service.startRecording();
    setRecording(true);
  };

  // Stop recording and get summary
  const stopRecording = (): RunSummary | null => {
    const service = SmartWatchService.getInstance();
    const summary = service.stopRecording();
    setRecording(false);
    return summary;
  };

  // Export run as GPX
  const exportGPX = (summary: RunSummary): string => {
    const service = SmartWatchService.getInstance();
    return service.exportAsGPX(summary);
  };

  // Return the hook interface
  return {
    device,         // Currently connected device
    data,           // Latest data from the device
    devices,        // Available devices
    scanning,       // Whether currently scanning
    connecting,     // Whether currently connecting
    recording,      // Whether currently recording
    supportedBrands, // Supported smartwatch brands
    scanForDevices, // Function to scan for devices
    connectDevice,  // Function to connect to a device
    disconnectDevice, // Function to disconnect
    startRecording, // Function to start recording
    stopRecording,  // Function to stop recording
    exportGPX       // Function to export as GPX
  };
} 