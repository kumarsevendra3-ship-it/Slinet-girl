import { DeviceContact, ToolResult } from '../types/assistant';
import { logger } from './logger';

export const DEFAULT_CONTACTS: DeviceContact[] = [
  { id: '1', name: 'Mom', phone: '+919876543210', relationship: 'Mother', avatarColor: '#ec4899' },
  { id: '2', name: 'Mummy', phone: '+919876543210', relationship: 'Mother', avatarColor: '#ec4899' },
  { id: '3', name: 'Dad', phone: '+919876543211', relationship: 'Father', avatarColor: '#3b82f6' },
  { id: '4', name: 'Papa', phone: '+919876543211', relationship: 'Father', avatarColor: '#3b82f6' },
  { id: '5', name: 'Rahul Sharma', phone: '+919876543220', relationship: 'Friend (College)', avatarColor: '#10b981' },
  { id: '6', name: 'Rahul Verma', phone: '+919876543221', relationship: 'Colleague (Work)', avatarColor: '#f59e0b' },
  { id: '7', name: 'Priya Patel', phone: '+919876543230', relationship: 'Friend', avatarColor: '#8b5cf6' },
  { id: '8', name: 'Doctor Mehta', phone: '+919876543240', relationship: 'Physician', avatarColor: '#06b6d4' },
];

export class DeviceActionBridge {
  private contacts: DeviceContact[] = [];

  constructor() {
    this.loadContacts();
  }

  public isNativeAndroid(): boolean {
    return (
      typeof window !== 'undefined' &&
      (!!window.AndroidBridge?.isNative?.() ||
        !!(window as any).Capacitor?.isNativePlatform?.() ||
        !!(window as any).Android)
    );
  }

  public getPlatformMode(): 'native' | 'browser' {
    return this.isNativeAndroid() ? 'native' : 'browser';
  }

  public getContacts(): DeviceContact[] {
    return [...this.contacts];
  }

  public addContact(contact: Omit<DeviceContact, 'id'>): DeviceContact {
    const newContact: DeviceContact = {
      ...contact,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    };
    this.contacts.push(newContact);
    this.saveContacts();
    return newContact;
  }

  public deleteContact(id: string): void {
    this.contacts = this.contacts.filter((c) => c.id !== id);
    this.saveContacts();
  }

  private loadContacts(): void {
    try {
      const saved = localStorage.getItem('arushi_contacts');
      if (saved) {
        this.contacts = JSON.parse(saved);
      } else {
        this.contacts = [...DEFAULT_CONTACTS];
        this.saveContacts();
      }
    } catch {
      this.contacts = [...DEFAULT_CONTACTS];
    }
  }

  private saveContacts(): void {
    try {
      localStorage.setItem('arushi_contacts', JSON.stringify(this.contacts));
    } catch {
      // ignore
    }
  }

  /**
   * Tool: openWhatsApp
   */
  public async openWhatsApp(args?: {
    message?: string;
    phoneNumber?: string;
  }): Promise<ToolResult> {
    logger.log('TOOL', 'Executing action: openWhatsApp', args);

    if (this.isNativeAndroid() && window.AndroidBridge?.openWhatsApp) {
      try {
        const ok = await window.AndroidBridge.openWhatsApp(
          args?.phoneNumber,
          args?.message
        );
        return {
          success: ok,
          action: 'openWhatsApp',
          message: ok
            ? 'WhatsApp opened on Android device.'
            : 'WhatsApp could not be opened by native bridge.',
        };
      } catch (err: any) {
        return {
          success: false,
          action: 'openWhatsApp',
          error: `Native WhatsApp launch failed: ${err?.message || err}`,
        };
      }
    }

    // Web browser fallback
    try {
      let targetUrl = 'https://web.whatsapp.com';
      if (args?.phoneNumber) {
        const cleanPhone = args.phoneNumber.replace(/[^0-9]/g, '');
        targetUrl = `https://wa.me/${cleanPhone}`;
        if (args.message) {
          targetUrl += `?text=${encodeURIComponent(args.message)}`;
        }
      } else if (args?.message) {
        targetUrl = `https://wa.me/?text=${encodeURIComponent(args.message)}`;
      }

      window.open(targetUrl, '_blank', 'noopener,noreferrer');
      return {
        success: true,
        action: 'openWhatsApp',
        message: 'WhatsApp opened in browser tab / app deep link.',
        details: { url: targetUrl },
      };
    } catch (err: any) {
      return {
        success: false,
        action: 'openWhatsApp',
        error: `Could not launch WhatsApp: ${err?.message || err}`,
      };
    }
  }

  /**
   * Tool: openApp
   */
  public async openApp(appName: string): Promise<ToolResult> {
    logger.log('TOOL', `Executing action: openApp (${appName})`);

    const normalized = appName.trim().toLowerCase();

    // Native Android bridge path
    if (this.isNativeAndroid() && window.AndroidBridge?.openApp) {
      try {
        const ok = await window.AndroidBridge.openApp(normalized);
        return {
          success: ok,
          action: 'openApp',
          message: ok
            ? `${appName} opened on Android device.`
            : `Could not open ${appName} via native bridge.`,
        };
      } catch (err: any) {
        return {
          success: false,
          action: 'openApp',
          error: `Native app launch failed: ${err?.message || err}`,
        };
      }
    }

    // Web Browser fallback with allowlist
    const webAppDirectory: Record<
      string,
      { url: string; label: string; isHardwareOnly?: boolean }
    > = {
      whatsapp: { url: 'https://web.whatsapp.com', label: 'WhatsApp' },
      youtube: { url: 'https://www.youtube.com', label: 'YouTube' },
      instagram: { url: 'https://www.instagram.com', label: 'Instagram' },
      spotify: { url: 'https://open.spotify.com', label: 'Spotify' },
      maps: { url: 'https://maps.google.com', label: 'Google Maps' },
      'google maps': { url: 'https://maps.google.com', label: 'Google Maps' },
      chrome: { url: 'https://www.google.com', label: 'Google Chrome' },
      gmail: { url: 'https://mail.google.com', label: 'Gmail' },
      twitter: { url: 'https://x.com', label: 'X (Twitter)' },
      x: { url: 'https://x.com', label: 'X (Twitter)' },
      camera: {
        url: '',
        label: 'Camera',
        isHardwareOnly: true,
      },
      calculator: {
        url: 'https://www.google.com/search?q=calculator',
        label: 'Calculator',
      },
      settings: {
        url: '',
        label: 'Device Settings',
        isHardwareOnly: true,
      },
    };

    const target = webAppDirectory[normalized];

    if (!target) {
      return {
        success: false,
        action: 'openApp',
        error: `Application "${appName}" is not in the supported browser allowlist. In browser mode, only verified web apps (YouTube, WhatsApp, Instagram, Spotify, Google Maps, Gmail, Twitter/X) can be opened.`,
      };
    }

    if (target.isHardwareOnly) {
      return {
        success: false,
        action: 'openApp',
        error: `Direct device hardware control for ${target.label} is only available when Arushi is packaged as an Android APK with native Android permissions.`,
      };
    }

    try {
      window.open(target.url, '_blank', 'noopener,noreferrer');
      return {
        success: true,
        action: 'openApp',
        message: `${target.label} web app opened successfully.`,
        details: { app: target.label, url: target.url },
      };
    } catch (err: any) {
      return {
        success: false,
        action: 'openApp',
        error: `Failed to open ${target.label}: ${err?.message || err}`,
      };
    }
  }

  /**
   * Tool: openUrl
   */
  public async openUrl(url: string): Promise<ToolResult> {
    logger.log('TOOL', `Executing action: openUrl (${url})`);

    let validatedUrl = url.trim();
    if (!/^https?:\/\//i.test(validatedUrl)) {
      validatedUrl = 'https://' + validatedUrl;
    }

    try {
      const parsed = new URL(validatedUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return {
          success: false,
          action: 'openUrl',
          error: 'Only HTTP and HTTPS URLs are permitted.',
        };
      }

      if (this.isNativeAndroid() && window.AndroidBridge?.openUrl) {
        const ok = await window.AndroidBridge.openUrl(parsed.href);
        return {
          success: ok,
          action: 'openUrl',
          message: ok ? `Opened ${parsed.hostname}` : 'Failed to open via native bridge',
        };
      }

      window.open(parsed.href, '_blank', 'noopener,noreferrer');
      return {
        success: true,
        action: 'openUrl',
        message: `Opened website ${parsed.hostname}`,
        details: { url: parsed.href },
      };
    } catch (err: any) {
      return {
        success: false,
        action: 'openUrl',
        error: `Invalid URL: ${err?.message || err}`,
      };
    }
  }

  /**
   * Tool: makeCall
   */
  public async makeCall(phoneNumber: string): Promise<ToolResult> {
    logger.log('TOOL', `Executing action: makeCall (${phoneNumber})`);

    const clean = phoneNumber.replace(/[^0-9+]/g, '');
    if (!clean || clean.length < 3) {
      return {
        success: false,
        action: 'makeCall',
        error: `Invalid phone number format: "${phoneNumber}". Please provide a valid phone number.`,
      };
    }

    if (this.isNativeAndroid() && window.AndroidBridge?.makeCall) {
      try {
        const ok = await window.AndroidBridge.makeCall(clean);
        return {
          success: ok,
          action: 'makeCall',
          message: ok
            ? `Dialing ${clean} via native phone service.`
            : `Native calling service failed for ${clean}.`,
        };
      } catch (err: any) {
        return {
          success: false,
          action: 'makeCall',
          error: `Native dialer failed: ${err?.message || err}`,
        };
      }
    }

    // Web browser fallback: trigger tel: URI
    try {
      const telUri = `tel:${encodeURIComponent(clean)}`;
      window.location.href = telUri;
      return {
        success: true,
        action: 'makeCall',
        message: `Device dialer opened for ${clean}.`,
        details: { phone: clean },
      };
    } catch (err: any) {
      return {
        success: false,
        action: 'makeCall',
        error: `Could not trigger phone dialer: ${err?.message || err}`,
      };
    }
  }

  /**
   * Tool: callContact
   */
  public async callContact(contactName: string): Promise<ToolResult> {
    logger.log('TOOL', `Executing action: callContact (${contactName})`);

    const query = contactName.trim().toLowerCase();

    // Native Android contacts integration
    if (this.isNativeAndroid() && window.AndroidBridge?.searchContacts) {
      try {
        const nativeMatches = await window.AndroidBridge.searchContacts(query);
        if (nativeMatches.length === 1) {
          return await this.makeCall(nativeMatches[0].phone);
        } else if (nativeMatches.length > 1) {
          const names = nativeMatches.map((m) => m.name).join(', ');
          return {
            success: false,
            action: 'callContact',
            error: `I found multiple contacts matching "${contactName}": ${names}. Which one should I call?`,
            details: { matches: nativeMatches },
          };
        } else {
          return {
            success: false,
            action: 'callContact',
            error: `I could not find any contact named "${contactName}" in device contacts.`,
          };
        }
      } catch (err: any) {
        logger.log('ERROR', 'Native contacts search error', err);
      }
    }

    // Match in saved contacts list
    const matches = this.contacts.filter((c) => {
      const name = c.name.toLowerCase();
      const rel = c.relationship?.toLowerCase() || '';
      return (
        name.includes(query) ||
        query.includes(name) ||
        rel.includes(query) ||
        query.includes(rel)
      );
    });

    if (matches.length === 0) {
      return {
        success: false,
        action: 'callContact',
        error: `I couldn't find any contact named "${contactName}". Would you like to specify their phone number?`,
      };
    }

    // If exact single match or single match
    if (matches.length === 1) {
      const target = matches[0];
      const callResult = await this.makeCall(target.phone);
      return {
        ...callResult,
        action: 'callContact',
        message: `Calling ${target.name} (${target.phone})...`,
        details: { contact: target },
      };
    }

    // Multiple matches found! Follow rule 24: DO NOT GUESS.
    const namesWithDetails = matches
      .map((c) => `${c.name}${c.relationship ? ` (${c.relationship})` : ''}`)
      .join(', ');

    return {
      success: false,
      action: 'callContact',
      error: `I found multiple contacts for "${contactName}": ${namesWithDetails}. Which one would you like to call?`,
      details: {
        matches: matches.map((m) => ({ name: m.name, phone: m.phone, relationship: m.relationship })),
      },
    };
  }
}

export const deviceActionBridge = new DeviceActionBridge();
