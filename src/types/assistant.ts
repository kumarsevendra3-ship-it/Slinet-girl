export type AssistantState =
  | 'IDLE'
  | 'CONNECTING'
  | 'LISTENING'
  | 'SPEAKING'
  | 'PROCESSING'
  | 'ERROR';

export interface DeviceContact {
  id: string;
  name: string;
  phone: string;
  relationship?: string;
  avatarColor?: string;
}

export interface ToolCallPayload {
  id: string;
  name: string;
  args: Record<string, any>;
}

export interface ToolResult {
  success: boolean;
  action: string;
  message?: string;
  error?: string;
  details?: any;
}

export interface ActionLogItem {
  id: string;
  timestamp: string;
  action: string;
  description: string;
  status: 'pending' | 'success' | 'failure';
  details?: any;
}

export interface DiagnosticLog {
  id: string;
  timestamp: string;
  category: 'LIVE' | 'MIC' | 'AUDIO_OUT' | 'TOOL' | 'ERROR';
  message: string;
  data?: any;
}

export interface AndroidBridgeInterface {
  isNative?: () => boolean;
  openWhatsApp?: (phone?: string, message?: string) => Promise<boolean>;
  openApp?: (appName: string) => Promise<boolean>;
  openUrl?: (url: string) => Promise<boolean>;
  makeCall?: (phoneNumber: string) => Promise<boolean>;
  searchContacts?: (query: string) => Promise<DeviceContact[]>;
}

declare global {
  interface Window {
    AndroidBridge?: AndroidBridgeInterface;
    Capacitor?: any;
  }
}
